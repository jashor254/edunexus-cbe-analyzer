// scripts/reference-school/08-seed-teacher-validation-cases.ts
//
// Phase 4B (docs/research/living-blueprint-teacher-validation-script.md) —
// the reference school's 60 generally-seeded learners are all near-identical
// (one subject, one evidence point, `insufficient_data` trend, no risk, no
// approved action — confirmed by a full scan before this script was
// written). None of them represents a genuine "clear challenge" or "strong
// performer" case, and the one learner who does have a richer, differentiated
// profile (the Phase 3B demo learner) is currently coherence-FAIL-blocked by
// an immutable pre-Phase-4A-fix approved action, so his Blueprint doesn't
// render at all.
//
// This script adds real, additional Evidence for three ALREADY-SEEDED,
// real reference-school learners — through the exact same canonical
// evidence writer (`persistEvidenceBatch`, via an `ingestion_runs` row) the
// live teacher-gradebook path (`lib/assessments/evidence.ts`) uses — so
// Projection/Blueprint compute a genuinely different, honest picture for
// each. This is not fabricating a demo interaction (no assignment
// submission, no Compass session, no synthetic classroom event is
// invented) — it is seeding assessment-shaped Evidence exactly as the real
// gradebook pipeline would produce it, through the one writer every other
// evidence source in this codebase already goes through.
//
// Idempotent: persistEvidenceBatch's own claim-key dedup means re-running
// with the same (subject, assessmentType, academicYear, term) per learner
// updates/supersedes rather than duplicating.
//
// Run: npx tsx --env-file=.env.local scripts/reference-school/08-seed-teacher-validation-cases.ts

import { config } from 'dotenv'
config({ path: '.env.local' })

import { db, SCHOOL_NAME } from './shared'
import { repos } from '@/lib/repositories'
import type { LearnerEvidence } from '@/lib/intelligence/evidence'
import { EVIDENCE_SOURCE_TRUST_TIER } from '@/lib/intelligence/evidence'
import { computeConfidence, resolveReviewStatus } from '@/lib/intelligence/confidence'
import { persistEvidenceBatch } from '@/lib/intelligence/evidenceLifecycle'
import { marksToLevel } from '@/lib/assessments/gradeCalculator'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { composeBlueprintWithCoherence } from '@/lib/learnerBlueprint/composeBlueprint'
import { asLearnerId } from '@/lib/core/identityTypes'

const SOURCE = 'teacher_upload' as const
const EXTRACTION_METHOD = 'reference_school_validation_seed_v1'
const ACADEMIC_YEAR = 2026

type CaseSpec = {
  label: string
  coreLearnerId: string
  /** Each entry becomes its own ingestion run, inserted in order — created_at ordering (not `term`) is what academicProjector.ts sorts trend by. */
  points: { term: number; rawSubject: string; score: number }[]
}

// Selected from a full scan of all 60 reference-school learners (none of
// which had more than 1 subject / 1 evidence point / any risk flag / any
// approved action) — three distinct, real, already-enrolled learners, none
// of them the Phase 3B demo learner (07cf873b-...), each getting a
// different, honest evidence shape.
const CASES: CaseSpec[] = [
  {
    // Case 1 — "a learner with a clear supported challenge": two
    // Mathematics evidence points, declining level (3 -> 1), on top of the
    // learner's existing single Kiswahili point. Real decline, not a
    // fabricated one: academicProjector.ts's computeTrend() derives this
    // purely from insertion-ordered cbc_level, exactly as it would for a
    // real gradebook entry sequence.
    label: 'Cheruiyot Gitau — declining Mathematics evidence (clear challenge)',
    coreLearnerId: 'd3b3249a-7e08-484f-bfeb-55b7f231269f',
    points: [
      { term: 1, rawSubject: 'mathematics', score: 72 },
      { term: 2, rawSubject: 'mathematics', score: 28 },
    ],
  },
  {
    // Case 2 — "a learner performing strongly but requiring enrichment
    // rather than remediation": two Mathematics points improving into
    // Level 4, alongside an existing Level 4 Kiswahili point.
    label: 'Victor Gitau — improving Mathematics evidence into Level 4 (enrichment)',
    coreLearnerId: 'a5b220e5-593a-4153-ac27-75f0c25cfbf5',
    points: [
      { term: 1, rawSubject: 'mathematics', score: 68 },
      { term: 2, rawSubject: 'mathematics', score: 88 },
    ],
  },
  {
    // Case 3 — "a learner with insufficient or mixed evidence where
    // uncertainty must remain visible": exactly ONE new Mathematics point,
    // at a contrasting level from the learner's existing single Kiswahili
    // point. Each subject individually stays `insufficient_data` (n=1) —
    // genuinely thin, genuinely mixed, nothing hidden.
    label: 'Chebet Rotich — one contrasting Mathematics point (mixed/insufficient evidence)',
    coreLearnerId: 'f01f9abc-a250-474a-814c-34b8269003fa',
    points: [
      { term: 2, rawSubject: 'mathematics', score: 45 },
    ],
  },
]

async function resolveLegacyContext(coreLearnerId: string) {
  const supabase = db()
  const { data: legacyStudent, error } = await supabase
    .from('students')
    .select('id, teacher_id')
    .eq('external_id', coreLearnerId)
    .maybeSingle()
  if (error) throw error
  if (!legacyStudent?.teacher_id) throw new Error(`[validation-cases] no bridged legacy student/teacher for learner ${coreLearnerId}`)

  const { data: legacyTeacher, error: teacherErr } = await supabase
    .from('teachers')
    .select('id, user_id')
    .eq('id', legacyStudent.teacher_id)
    .maybeSingle()
  if (teacherErr) throw teacherErr
  if (!legacyTeacher?.user_id) throw new Error(`[validation-cases] bridged legacy teacher ${legacyStudent.teacher_id} has no user_id`)

  return { legacyStudentId: legacyStudent.id as string, legacyTeacherId: legacyTeacher.id as string, legacyTeacherUserId: legacyTeacher.user_id as string }
}

async function seedOnePoint(
  legacyStudentId: string,
  legacyTeacherId: string,
  initiatedByUserId: string,
  point: { term: number; rawSubject: string; score: number },
): Promise<void> {
  const confidence = computeConfidence({
    identityConfidence: 100,
    identityMatchType: 'external_id',
    fieldIssueCount: 0,
    source: SOURCE,
  })
  const reviewStatus = resolveReviewStatus(confidence)
  const importedAt = new Date().toISOString()

  const evidence: LearnerEvidence = {
    learnerId: legacyStudentId,
    extractedName: '',
    extractedExternalId: null,
    subject: point.rawSubject,
    rawSubject: point.rawSubject,
    score: point.score,
    cbcLevel: marksToLevel(point.score),
    assessmentType: 'cat',
    academicYear: ACADEMIC_YEAR,
    term: point.term,
    evidenceSource: SOURCE,
    trustTier: EVIDENCE_SOURCE_TRUST_TIER[SOURCE],
    evidenceConfidence: confidence,
    extractionMethod: EXTRACTION_METHOD,
    reviewStatus,
    rawInputRef: `reference_school_validation_seed:${legacyStudentId}:${point.rawSubject}:term${point.term}`,
    importedAt,
    issues: [],
    purposeId: null,
  }

  const { id: runId } = await repos.evidence.createIngestionRun({
    source: SOURCE,
    initiatedBy: initiatedByUserId,
    teacherId: legacyTeacherId,
    institution: null,
  })
  const result = await persistEvidenceBatch([evidence], runId)
  await repos.evidence.completeIngestionRun(runId, {
    recordCount: 1,
    confirmedCount: result.confirmedCount,
    pendingReviewCount: result.pendingReviewCount,
    rejectedCount: 0,
    processingDurationMs: 1,
  })
}

async function main() {
  const supabase = db()
  const { data: school } = await supabase.from('schools').select('id').eq('school_name', SCHOOL_NAME).single()
  if (!school) throw new Error('[validation-cases] reference school not found — run `npm run seed:reference-school` first')
  const { data: adminUser } = await supabase.from('school_users').select('user_id').eq('school_id', school.id).eq('role', 'school_admin').limit(1).single()

  for (const c of CASES) {
    console.log(`\n[${c.label}]`)
    const { legacyStudentId, legacyTeacherId, legacyTeacherUserId } = await resolveLegacyContext(c.coreLearnerId)

    for (const point of c.points) {
      await seedOnePoint(legacyStudentId, legacyTeacherId, legacyTeacherUserId, point)
      console.log(`  seeded ${point.rawSubject} term ${point.term}: score ${point.score} -> level ${marksToLevel(point.score)}`)
    }

    await recomputeLearnerProjection(legacyStudentId)

    const result = await composeBlueprintWithCoherence({ actorUserId: adminUser!.user_id, coreLearnerId: asLearnerId(c.coreLearnerId), schoolId: school.id })
    const subjects = result.blueprint.academicRecord.status === 'available' ? result.blueprint.academicRecord.data?.bySubject ?? [] : []
    console.log(`  coherence: ${result.coherence.result}`)
    console.log(`  subjects: ${subjects.map(s => `${s.subject}:L${s.latestLevel}:${s.trend}:n=${s.evidenceCount}`).join(', ')}`)
  }

  console.log('\n[done]')
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
