// lib/learnerBlueprint/composeProgrammeAcademicRecord.ts
//
// Senior School Programme-aware Academic Record (Phase 2 — Senior School
// Programme Truth). The Junior path (composeAcademicRecord.ts) is untouched
// by this file and is not called from here — this is a sibling composer,
// selected by composeBlueprint.ts only for Senior-band learners.
//
// The question this answers is deliberately split in two, per the phase
// spec, and neither may answer the other's question:
//
//   Programme truth   — lib/curriculum/seniorProgramme.getCurrentSeniorProgramme()
//                        "what subjects is this learner actually taking?"
//   Evidence truth     — lib/projection/recompute.recomputeLearnerProjection()
//                        "what does admissible evidence say?"
//
// This composer NEVER writes to learner_programmes/learner_programme_subjects
// — read-only, exactly like every other Blueprint composer (rendering a
// report is not a placement event).

import type { BlueprintSection, AcademicRecordData, SubjectRecord } from './types'
import type { ProjectionAccessResult } from './projectionAccess'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { computeTrend } from '@/lib/projection/academicProjector'
import type { SubjectPerformance } from '@/lib/projection/types'
import { getCurrentSeniorProgramme } from '@/lib/curriculum/seniorProgramme'
import { getDeterministicAliasesForCode } from '@/lib/curriculum/evidenceSubjectResolution'
import { composeAcademicRecord } from './composeAcademicRecord'
import type { LearnerId, StudentId } from '@/lib/core/identityTypes'

const OWNER = 'lib/curriculum/seniorProgramme.getCurrentSeniorProgramme + lib/projection/recompute.recomputeLearnerProjection'

function mergeSubjectPerformance(entries: SubjectPerformance[]): {
  latestLevel: 1 | 2 | 3 | 4
  trend: SubjectPerformance['trend']
  evidenceCount: number
  latestEvidenceAt: string
} {
  const history = entries
    .flatMap(e => e.history)
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
  const levels = history.map(h => h.level)
  return {
    latestLevel: levels[levels.length - 1],
    trend: computeTrend(levels),
    evidenceCount: history.length,
    latestEvidenceAt: history[history.length - 1].at,
  }
}

export async function composeProgrammeAcademicRecord(
  coreLearnerId: LearnerId,
  legacyStudentId: StudentId | null,
  projectionAccess?: ProjectionAccessResult
): Promise<BlueprintSection<AcademicRecordData>> {
  try {
    const programmeResult = await getCurrentSeniorProgramme(coreLearnerId)

    if (programmeResult.status === 'unresolved') {
      // Senior learner, no canonical programme row yet. Do NOT invent one
      // from Evidence, pathway recommendation, school catalogue, or Grade 9
      // history (Phase 2 §16). Fall back to the legacy evidence-derived
      // view ONLY as a labeled, explicitly-not-programme-truth compatibility
      // section — the label is the point, not an implementation detail.
      const legacy = await composeAcademicRecord(legacyStudentId, projectionAccess)
      if (legacy.status !== 'available' || !legacy.data) {
        return {
          status: 'unavailable',
          owner: OWNER,
          freshness: 'live',
          data: null,
          unavailableReason: 'Senior programme membership is unresolved for this learner, and no legacy evidence-derived view is available either.',
        }
      }
      return {
        status: 'available',
        owner: OWNER,
        freshness: 'live',
        data: {
          ...legacy.data,
          programmeStatus: 'unresolved',
          source: 'legacy_evidence_view',
        },
      }
    }

    // Programme resolved — canonical subject membership is authoritative.
    let evidenceByRawSubject: Record<string, SubjectPerformance> = {}
    if (legacyStudentId && !projectionAccess?.error) {
      const projection = projectionAccess?.projection ?? await recomputeLearnerProjection(legacyStudentId)
      evidenceByRawSubject = projection.academic?.value.bySubject ?? {}
    }

    const attributedRawKeys = new Set<string>()
    const bySubject: SubjectRecord[] = []
    const evidenceInsufficientSubjects: Array<{ subject: string; subjectId: string }> = []

    for (const member of programmeResult.subjects) {
      const aliases = getDeterministicAliasesForCode(member.subjectCode)
      const matchingEntries: SubjectPerformance[] = []
      for (const alias of aliases) {
        const entry = evidenceByRawSubject[alias]
        if (entry) {
          matchingEntries.push(entry)
          attributedRawKeys.add(alias)
        }
      }

      if (matchingEntries.length === 0) {
        // Programme membership exists; admissible, attributable evidence
        // does not. This is the CSL case, and any other unassessed
        // programme subject — present, honestly labeled, never fabricated.
        evidenceInsufficientSubjects.push({ subject: member.subjectName, subjectId: member.subjectId })
        continue
      }

      const merged = mergeSubjectPerformance(matchingEntries)
      bySubject.push({
        subject: member.subjectName,
        latestLevel: merged.latestLevel,
        trend: merged.trend,
        evidenceCount: merged.evidenceCount,
        latestEvidenceAt: merged.latestEvidenceAt,
      })
    }

    const unattributedEvidenceSubjects = Object.keys(evidenceByRawSubject).filter(k => !attributedRawKeys.has(k))

    const data: AcademicRecordData = {
      // Phase 2 does not compute a single cross-subject overallTrend for
      // the programme-aware view — growthProjector.ts's netTrend concept is
      // deliberately not re-derived here to avoid a second, competing
      // implementation; deferred to whichever future phase wires this view
      // into composeGrowthTimeline.
      overallTrend: null,
      bySubject,
      competencies: [],
      confidence: projectionAccess?.projection?.academic?.confidence ?? null,
      lastComputed: projectionAccess?.projection?.academic?.lastComputed ?? null,
      programmeStatus: 'canonical',
      source: 'canonical_programme',
      evidenceInsufficientSubjects,
      unattributedEvidenceSubjects,
    }

    return { status: 'available', owner: OWNER, freshness: 'live', data }
  } catch (error) {
    return {
      status: 'unavailable',
      owner: OWNER,
      freshness: 'live',
      data: null,
      unavailableReason: error instanceof Error ? error.message : 'Programme-aware Academic Record composition failed',
    }
  }
}
