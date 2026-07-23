// lib/learnerBlueprint/composeAcademicRecord.ts
//
// Academic Record -> Assessment -> Projection Engine, exclusively
// (ADR-0005 §2.2, RAS §9). Reads via recomputeLearnerProjection() only —
// never a direct `assessments`/`class_assessments` read, the exact gap
// `sprint-12c-academic-clinic-hardening.md` found already open in the
// older lib/academicClinic/ pipeline. This composer does not repeat it.

import type { BlueprintSection, AcademicRecordData, SubjectRecord, CompetencyRecord } from './types'
import type { ProjectionAccessResult } from './projectionAccess'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'

const OWNER = 'lib/projection/recompute.recomputeLearnerProjection'

export async function composeAcademicRecord(
  legacyStudentId: string | null,
  projectionAccess?: ProjectionAccessResult
): Promise<BlueprintSection<AcademicRecordData>> {
  if (!legacyStudentId) {
    return {
      status: 'unavailable',
      owner: OWNER,
      freshness: 'live',
      data: null,
      unavailableReason: 'No legacy student identity bridged for this learner (see learner-record-layer-decisions.md Decision 3) — Projection Engine cannot be queried.',
    }
  }

  try {
    if (projectionAccess?.error) throw projectionAccess.error
    const projection = projectionAccess?.projection ?? await recomputeLearnerProjection(legacyStudentId)

    const bySubject: SubjectRecord[] = projection.academic
      ? Object.values(projection.academic.value.bySubject).map(s => ({
          subject: s.subject,
          latestLevel: s.latestLevel,
          trend: s.trend,
        }))
      : []

    const competencies: CompetencyRecord[] = projection.knowledge
      ? Object.entries(projection.knowledge.value.bySubject).map(([subject, k]) => ({
          subject,
          currentLevel: k.currentLevel,
        }))
      : []

    const data: AcademicRecordData = {
      overallTrend: projection.growth?.value.trend ?? null,
      bySubject,
      competencies,
      confidence: projection.academic?.confidence ?? null,
      lastComputed: projection.academic?.lastComputed ?? null,
    }

    return { status: 'available', owner: OWNER, freshness: 'live', data }
  } catch (error) {
    return {
      status: 'unavailable',
      owner: OWNER,
      freshness: 'live',
      data: null,
      unavailableReason: error instanceof Error ? error.message : 'Academic Record composition failed',
    }
  }
}
