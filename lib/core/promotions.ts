import { repos } from '@/lib/repositories'
import type { LearnerPromotion, RunPromotionInput } from '@/types/core'
import { createBlueprintSnapshot } from '@/lib/learnerBlueprint/snapshot'
import { enrollLearner } from '@/lib/core/learners'

export async function getLearnerPromotionHistory(
  learnerId: string,
  schoolId: string
): Promise<LearnerPromotion[]> {
  return repos.learners.listPromotionHistory(learnerId, schoolId)
}

/**
 * Sprint 12 Wave 2 (Critical 2, Release Blocker Remediation) — before this
 * fix, runAnnualPromotion only ever inserted an audit-log row
 * (learner_promotions); it never touched learner_enrollments at all. A
 * "promoted" learner had zero active enrollment anywhere until manually
 * fixed, and a "graduated" learner's old enrollment was left dangling
 * "active" forever. See docs/architecture/sprint12-release-blocker-investigation.md
 * (Critical 2) and lib/core/promotions.reenrollmentGap.test.ts (the
 * regression test this fix is required to flip from pass-by-documenting-
 * the-gap to pass-by-fixing-it).
 *
 * Reuses only existing repository methods — zero new repository code:
 *   - repos.learners.withdrawActiveEnrollments (already proven correct by
 *     transferLearner's identical use, lib/core/transfers.ts)
 *   - lib/core/learners.ts's enrollLearner (already a thin, side-effect-
 *     free wrapper over repos.learners.upsertEnrollment)
 *   - repos.learners.listPromotionHistory (existing read, reused below as
 *     a duplicate-promotion guard)
 */
export async function runAnnualPromotion(
  schoolId: string,
  processedBy: string,
  input: RunPromotionInput
): Promise<{ processed: number; errors: string[] }> {
  const errors: string[] = []
  let processed = 0

  // `processedBy` is a school_users.id (learner_promotions.processed_by's
  // FK target) — the graduation Blueprint Snapshot trigger below needs the
  // real auth.uid() instead, since composeBlueprint()'s internal permission
  // checks (e.g. Attendance's admin check) resolve membership from
  // auth.uid(), not a school_users row id. Resolved once, non-fatally —
  // falling back to processedBy itself (better an imperfect actor id on a
  // best-effort snapshot than blocking graduation on this lookup).
  const processedByAuthUserId = await repos.schools.findSchoolUserById(processedBy)
    .then(su => su?.user_id ?? processedBy)
    .catch(() => processedBy)

  for (const decision of input.decisions) {
    try {
      // Duplicate-promotion guard (Security Review finding, investigation
      // doc §Critical 2): learner_promotions has no unique constraint, so a
      // double-submitted batch would otherwise insert a second log row and
      // attempt a second enroll/withdraw cycle for the same learner+year.
      // Check-then-create, matching this codebase's established idiom
      // (onboardLearner, schoolActivation.ts) rather than a schema change.
      const history = await repos.learners.listPromotionHistory(decision.learner_id, schoolId)
      if (history.some(p => p.from_academic_year_id === input.academic_year_id)) {
        errors.push(`Learner ${decision.learner_id}: already has a promotion recorded for academic year ${input.academic_year_id} — skipped to avoid a duplicate.`)
        continue
      }

      const fromClassId = await repos.learners.findActiveEnrollmentClass(
        decision.learner_id,
        input.academic_year_id
      )

      const isTerminal = decision.promotion_type === 'graduated'
      if (!isTerminal && (!decision.to_class_id || !decision.to_academic_year_id)) {
        // A 'promoted'/'repeated' decision with no destination is not a
        // partial success — logging it anyway would recreate exactly the
        // "promotion happened but nothing really changed" defect this fix
        // exists to close. Reported per-learner, same as any other
        // per-decision failure; the rest of the batch proceeds.
        errors.push(`Learner ${decision.learner_id}: promotion_type "${decision.promotion_type}" requires both to_class_id and to_academic_year_id — no destination was provided.`)
        continue
      }

      await repos.learners.insertPromotion({
        school_id: schoolId,
        learner_id: decision.learner_id,
        from_class_id: fromClassId,
        to_class_id: decision.to_class_id ?? null,
        from_academic_year_id: input.academic_year_id,
        to_academic_year_id: decision.to_academic_year_id ?? null,
        promotion_type: decision.promotion_type,
        processed_by: processedBy,
        notes: decision.notes ?? null,
      })

      // Every promotion_type withdraws the OLD enrollment — a promoted,
      // repeated, or graduated learner is, in every case, no longer
      // actively enrolled in their old class. Status value 'withdrawn' is
      // distinct from transferLearner's 'transferred' (a different real-
      // world reason for the same mechanical withdrawal).
      await repos.learners.withdrawActiveEnrollments(decision.learner_id, 'withdrawn')

      if (isTerminal) {
        await repos.learners.updateStatusById(decision.learner_id, {
          status: 'graduated',
          graduation_date: new Date().toISOString().split('T')[0],
        })

        // Sprint 12K (ADR-0008 Part 3): the third and final frozen trigger.
        // Awaited but non-fatal (caught, never thrown) — a snapshot
        // failure must never block or roll back a real graduation
        // decision, which has already been recorded above.
        await createBlueprintSnapshot({
          coreLearnerId: decision.learner_id,
          schoolId,
          academicYearId: input.academic_year_id,
          termId: null,
          snapshotType: 'graduation',
          sourceRecordId: decision.learner_id,
          actorUserId: processedByAuthUserId,
        }).catch(err => console.error('[blueprint-snapshot] graduation:', err instanceof Error ? err.message : String(err)))
      } else {
        // 'promoted' or 'repeated' — create the real new enrollment.
        // RunPromotionInput's decision has no term_id field at all; resolve
        // one from the destination academic year's own term 1, mirroring
        // schoolActivation.ts's own term-creation convention (a promotion
        // always lands a learner at the start of the destination year).
        const destinationTerms = await repos.schools.listTerms(schoolId, decision.to_academic_year_id)
        const destinationTerm = destinationTerms[0]
        if (!destinationTerm) {
          errors.push(`Learner ${decision.learner_id}: destination academic year ${decision.to_academic_year_id} has no terms — enrollment could not be created (old enrollment was already withdrawn; re-run once the destination year has a term).`)
          continue
        }

        await enrollLearner({
          school_id: schoolId,
          learner_id: decision.learner_id,
          class_id: decision.to_class_id!,
          term_id: destinationTerm.id,
          academic_year_id: decision.to_academic_year_id!,
        })
      }

      processed++
    } catch (err) {
      errors.push(`Learner ${decision.learner_id}: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  return { processed, errors }
}

/**
 * Sprint 12 Wave 2 (High 4, Release Blocker Remediation) — `termId` is a
 * new, required parameter (the investigation confirmed no term context
 * existed on the previous year-scoped signature at all). `hasReportCard`
 * is a pure additive read composed from the existing
 * `repos.schools.listClassReportCards` — one batched call per distinct
 * class in the preview, never per learner. This is a WARNING, not a gate:
 * `runAnnualPromotion` above has no dependency on this field and will
 * still process a decision for a learner with `hasReportCard: false` —
 * schools may intentionally promote without complete academic evidence,
 * per this blocker's own brief ("support both").
 */
export async function previewPromotion(
  schoolId: string,
  academicYearId: string,
  termId: string
): Promise<Array<{
  learner_id: string
  full_name: string
  admission_number: string
  current_class: string
  grade_name: string
  suggested_action: 'promote' | 'graduate'
  hasReportCard: boolean
}>> {
  const data = await repos.learners.findEnrollmentsByYear(schoolId, academicYearId)

  const classIds = [...new Set(data.map(r => r.class_id).filter(Boolean))]
  const reportCardsByClass = new Map<string, Set<string>>()
  await Promise.all(classIds.map(async (classId) => {
    const cards = await repos.schools.listClassReportCards(classId, termId)
    reportCardsByClass.set(classId, new Set(cards.map(c => c.learner_id)))
  }))

  return data.map((r) => {
    const learner = r.learners as unknown as { first_name: string; middle_name: string | null; last_name: string; admission_number: string }
    const cls = r.classes as unknown as { display_name: string; grades: { name: string; level_order: number } }
    const isGrade9 = cls?.grades?.level_order === 11
    return {
      learner_id: r.learner_id,
      full_name: [learner?.first_name, learner?.middle_name, learner?.last_name].filter(Boolean).join(' '),
      admission_number: learner?.admission_number ?? '',
      current_class: cls?.display_name ?? '',
      grade_name: cls?.grades?.name ?? '',
      suggested_action: isGrade9 ? 'graduate' : 'promote',
      hasReportCard: reportCardsByClass.get(r.class_id)?.has(r.learner_id) ?? false,
    }
  })
}
