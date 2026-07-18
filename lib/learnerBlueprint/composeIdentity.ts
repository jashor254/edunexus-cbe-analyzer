// lib/learnerBlueprint/composeIdentity.ts
//
// Identity -> Core, exclusively (ADR-0005 §2.1, ADR-0006 Decisions #1).
// Reads via lib/core/learners.getLearnerHistory + lib/core/school's own
// exported functions — never a raw table read, never a second identity
// computation.

import { getLearner, getLearnerHistory } from '@/lib/core/learners'
import { getSchool, getCurrentAcademicYear, getCurrentTerm } from '@/lib/core/school'
import type { BlueprintIdentifiers, BlueprintSection, IdentityData } from './types'

const OWNER = 'lib/core/learners.getLearner + getLearnerHistory + lib/core/school'

export async function composeIdentity(
  ids: BlueprintIdentifiers
): Promise<BlueprintSection<IdentityData>> {
  try {
    const [learner, learnerWithEnrollment, school, academicYear, term] = await Promise.all([
      getLearner(ids.coreLearnerId, ids.schoolId),
      getLearnerHistory(ids.coreLearnerId, ids.schoolId),
      getSchool(ids.schoolId),
      getCurrentAcademicYear(ids.schoolId),
      getCurrentTerm(ids.schoolId),
    ])

    const activeEnrollment = learnerWithEnrollment.learner_enrollments
      .filter(e => e.status === 'active')
      .sort((a, b) => (a.enrollment_date < b.enrollment_date ? 1 : -1))[0]
      ?? learnerWithEnrollment.learner_enrollments[0]
      ?? null

    const data: IdentityData = {
      learnerName: [learner.first_name, learner.middle_name, learner.last_name].filter(Boolean).join(' '),
      admissionNumber: learner.admission_number,
      schoolName: school.school_name,
      currentClassName: activeEnrollment?.classes.display_name ?? null,
      academicYearLabel: academicYear?.name ?? null,
      termLabel: term?.name ?? null,
      guardians: learner.learner_guardians.map(g => ({
        fullName: g.full_name,
        relationship: g.relationship,
      })),
    }

    return { status: 'available', owner: OWNER, freshness: 'live', data }
  } catch (error) {
    return {
      status: 'unavailable',
      owner: OWNER,
      freshness: 'live',
      data: null,
      unavailableReason: error instanceof Error ? error.message : 'Identity composition failed',
    }
  }
}
