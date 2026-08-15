import { repos } from '@/lib/repositories'
import type { LearnerPromotion, RunPromotionInput } from '@/types/core'
import { createBlueprintSnapshot } from '@/lib/learnerBlueprint/snapshot'
import { enrollLearner } from '@/lib/core/learners'
import { removeStaleLegacyRosterMembership } from '@/lib/core/academicBridge'
import { asLearnerId } from '@/lib/core/identityTypes'
import { SchoolMismatchError } from '@/lib/core/errors'

// Phase 6 (academic year progression) — the actual final grade is Grade 12
// (level_order 14, grades table), not Grade 9. previewPromotion's own
// terminal-grade detection only special-cased level_order 11 (Grade 9,
// junior_secondary's own stage-exit) — a Grade 12 learner fell through to
// the generic "promote" default with no Grade 13 to promote into. There is
// no invalid grade actually created (destination classes are always real,
// admin-picked, existing rows — the grades catalog itself has no level
// beyond 14), but the SUGGESTED action was wrong. Both real stage-exit
// points are named explicitly here rather than inferred from "is this the
// max grade in the school", which would silently misclassify a Junior-only
// school's Grade 9 as if it were the school's own final grade in a
// different way than intended.
const TERMINAL_GRADE_LEVEL_ORDERS = new Set([11, 14]) // Grade 9, Grade 12

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

  // Phase 6 (Task 28) — explicit, once-per-batch scoping proof for the
  // "FROM" year. findActiveEnrollmentClass below has no schoolId parameter
  // at all, so without this a learner_id from another school with (by
  // sheer non-overlap of foreign keys) no row at this academic_year_id
  // would already fail safely — but that safety was incidental, not
  // verified. Explicit here, matching moveLearnerToClass/enrollLearner's
  // own established pattern rather than relying on FK non-collision.
  const schoolAcademicYears = await repos.schools.listAcademicYears(schoolId)
  if (!schoolAcademicYears.some(y => y.id === input.academic_year_id)) {
    throw new SchoolMismatchError('This academic year does not belong to your school.')
  }

  for (const decision of input.decisions) {
    try {
      // Source learner must belong to this school — same explicit shape
      // Task 28 asks for on the destination side below.
      try {
        await repos.learners.findById(decision.learner_id, schoolId)
      } catch {
        errors.push(`Learner ${decision.learner_id}: does not belong to your school.`)
        continue
      }

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

      // Destination year must belong to this school too (Task 28) —
      // checked before any write, using the same batch-level list already
      // loaded above rather than a second query per decision.
      if (!isTerminal && !schoolAcademicYears.some(y => y.id === decision.to_academic_year_id)) {
        errors.push(`Learner ${decision.learner_id}: destination academic year does not belong to your school.`)
        continue
      }

      // Phase 11 — every remaining precondition for a NON-TERMINAL decision
      // is now resolved and validated HERE, before any write. Before this
      // fix, `decision.to_class_id`'s school-scoping and the destination
      // term's existence were both only discovered inside enrollLearner /
      // the enroll branch below, AFTER insertPromotion and
      // withdrawActiveEnrollments had already run — so either failure left
      // a learner withdrawn, promotion-logged, and enrolled nowhere,
      // permanently (the duplicate-promotion guard above then refused every
      // retry, since a promotion row for this academic_year_id already
      // existed). This is the exact defect the Phase 10 rehearsal found
      // (9 stranded synthetic learners). `destinationTerm` resolved here is
      // reused below — the enroll branch no longer re-resolves it.
      let destinationTerm: { id: string } | undefined
      if (!isTerminal) {
        try {
          await repos.teachers.findClassById(decision.to_class_id!, schoolId)
        } catch {
          errors.push(`Learner ${decision.learner_id}: destination class does not belong to your school.`)
          continue
        }

        const destinationTerms = await repos.schools.listTerms(schoolId, decision.to_academic_year_id!)
        destinationTerm = destinationTerms[0]
        if (!destinationTerm) {
          errors.push(`Learner ${decision.learner_id}: destination academic year has no terms yet — set up a term for it before promoting into it. Nothing was changed for this learner.`)
          continue
        }
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

      // Phase 5 convergence, extended to year progression (Task F): a
      // learner already bridged into the legacy gradebook for their old
      // class must not keep appearing on that class's legacy roster once
      // they've progressed/repeated/graduated out of it — same reasoning
      // as moveLearnerToClass's own wiring. Best-effort: an expected no-op
      // (never bridged) is silent; an actual failure is logged, never
      // rolled back or surfaced as if the promotion itself failed — the
      // canonical promotion above has already been recorded.
      try {
        await removeStaleLegacyRosterMembership(asLearnerId(decision.learner_id), fromClassId)
      } catch (err) {
        console.error('[promotions] legacy roster convergence failed (promotion already recorded)', {
          learnerId: decision.learner_id, fromClassId,
          error: err instanceof Error ? err.message : String(err),
        })
      }

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
          coreLearnerId: asLearnerId(decision.learner_id),
          schoolId,
          academicYearId: input.academic_year_id,
          termId: null,
          snapshotType: 'graduation',
          sourceRecordId: decision.learner_id,
          actorUserId: processedByAuthUserId,
        }).catch(err => console.error('[blueprint-snapshot] graduation:', err instanceof Error ? err.message : String(err)))
      } else {
        // 'promoted' or 'repeated' — create the real new enrollment.
        // RunPromotionInput's decision has no term_id field at all; term 1
        // of the destination academic year, mirroring schoolActivation.ts's
        // own term-creation convention (a promotion always lands a learner
        // at the start of the destination year). Already resolved and
        // validated above, before insertPromotion/withdrawActiveEnrollments
        // ran — this can no longer be the write that discovers a missing
        // term.
        await enrollLearner({
          school_id: schoolId,
          learner_id: decision.learner_id,
          class_id: decision.to_class_id!,
          term_id: destinationTerm!.id,
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
    const isTerminalGrade = TERMINAL_GRADE_LEVEL_ORDERS.has(cls?.grades?.level_order)
    return {
      learner_id: r.learner_id,
      full_name: [learner?.first_name, learner?.middle_name, learner?.last_name].filter(Boolean).join(' '),
      admission_number: learner?.admission_number ?? '',
      current_class: cls?.display_name ?? '',
      grade_name: cls?.grades?.name ?? '',
      suggested_action: isTerminalGrade ? 'graduate' : 'promote',
      hasReportCard: reportCardsByClass.get(r.class_id)?.has(r.learner_id) ?? false,
    }
  })
}
