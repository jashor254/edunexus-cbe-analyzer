import { repos } from '@/lib/repositories'
import type { LearnerPromotion, RunPromotionInput } from '@/types/core'
import { createBlueprintSnapshot } from '@/lib/learnerBlueprint/snapshot'

export async function getLearnerPromotionHistory(
  learnerId: string,
  schoolId: string
): Promise<LearnerPromotion[]> {
  return repos.learners.listPromotionHistory(learnerId, schoolId)
}

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
      const fromClassId = await repos.learners.findActiveEnrollmentClass(
        decision.learner_id,
        input.academic_year_id
      )

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

      // Update learner status if graduating
      if (decision.promotion_type === 'graduated') {
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
      }

      processed++
    } catch (err) {
      errors.push(`Learner ${decision.learner_id}: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  return { processed, errors }
}

export async function previewPromotion(
  schoolId: string,
  academicYearId: string
): Promise<Array<{
  learner_id: string
  full_name: string
  admission_number: string
  current_class: string
  grade_name: string
  suggested_action: 'promote' | 'graduate'
}>> {
  const data = await repos.learners.findEnrollmentsByYear(schoolId, academicYearId)

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
    }
  })
}
