// lib/paperIntelligence/upload.ts
//
// Mark first, file after (docs/engineering/mark-papers-flow-plan.md). Review
// only reports completed scripts; this is where a teacher who is satisfied
// with the whole paper files its marks to ONE destination:
//
//   topical — each complete script's total becomes the learner's assignment
//             score through recordSubmissionMark (same bounds, notification,
//             assignment-mark evidence and correction key as a typed mark).
//             A quick-created paper becomes 'closed' and so appears in the
//             gradebook like any other assignment.
//   termly  — the totals become ONE subject's marks in a class assessment
//             (Opener, CAT, Mid-Term, End-Term, Exam, KJSEA SBA) through
//             mergeSubjectMarks, then the same learner-model + assessment
//             evidence follow-ups the CSV upload route runs. recordSubmissionMark
//             is never called on this path, so no mark is evidenced twice.
//
// One paper, one destination (paper_mark_uploads is UNIQUE per assignment):
// uploading again after a correction re-files to the SAME place, and a
// request for a different place is refused rather than filing twice.
//
// Server-only. Its own DB reads/writes live in uploadStore.ts. Callers
// authorize first (requireAssignmentClassTeacher); a termly assessment must
// also be the calling teacher's own (getAssessmentById scopes by teacher).

import { recordSubmissionMark } from '@/lib/assignments/markSubmission'
import { getAssessmentById } from '@/lib/assessments/getters'
import {
  createAssessment,
  mergeSubjectMarks,
  triggerLearnerModelUpdates,
  AssessmentLockedError,
} from '@/lib/assessments/mutations'
import { recordAssessmentEvidence } from '@/lib/assessments/evidence'
import { buildAssessmentTitle } from '@/lib/assessments/assessmentTypeCatalog'
import { convertScore } from '@/lib/assessments/subjectMarkMerge'
import type { ClassAssessment } from '@/lib/assessments/types'
import { findRubricsForAssignment } from './rubrics'
import { findScriptMarksForAssignment } from './scriptMarks'
import { findReviewSubmissions } from './reviewContext'
import { scriptCompletion } from './reviewGrouping'
import { findPaper, findExistingUpload, closePaper, recordUpload, type UploadDestination, type FileablePaper, type ExistingUpload } from './uploadStore'

export class UploadError extends Error {}

export type { UploadDestination, FileablePaper, ExistingUpload } from './uploadStore'
export { PaperNotFoundError } from './uploadStore'

export type CompleteScript = { submissionId: string; studentId: string; learnerName: string; total: number }

export type UploadReadiness = {
  paper: FileablePaper
  /** Learners on the paper's class list. */
  rosterCount: number
  /** Fully reviewed and within "marked out of" — what an upload files. */
  complete: CompleteScript[]
  /** Fully reviewed but above "marked out of" — refused until the teacher fixes it. */
  overMarkedOutOf: Array<{ submissionId: string; learnerName: string; total: number }>
  /** Marked by the AI but not every question reviewed yet. */
  incomplete: number
  existing: ExistingUpload | null
}

/** A termly assessment the teacher can file into: an existing one, or one created on the spot. */
export type TermlyTarget =
  | { destination: 'termly'; subject: string; assessmentId: string }
  | { destination: 'termly'; subject: string; newAssessment: { assessmentType: string; term: '1' | '2' | '3'; year: number; maxScore: number } }

export type UploadTarget = { destination: 'topical' } | TermlyTarget

export type UploadOutcome = {
  destination: UploadDestination
  classAssessmentId: string | null
  filed: Array<{ learnerName: string; total: number; filedScore: number }>
  refused: Array<{ learnerName: string; reason: string }>
  overMarkedOutOf: UploadReadiness['overMarkedOutOf']
  incomplete: number
  /** Notifications + evidence + learner-model updates — run after the response. */
  followUps: Array<() => Promise<void>>
}

export async function getUploadReadiness(assignmentId: string): Promise<UploadReadiness> {
  const [paper, rubricRows, marks, submissions, existing] = await Promise.all([
    findPaper(assignmentId),
    findRubricsForAssignment(assignmentId),
    findScriptMarksForAssignment(assignmentId),
    findReviewSubmissions(assignmentId),
    findExistingUpload(assignmentId),
  ])
  const rubricIds = rubricRows.map(r => r.id)
  const marksBySubmission = new Map<string, typeof marks>()
  for (const m of marks) marksBySubmission.set(m.submission_id, [...(marksBySubmission.get(m.submission_id) ?? []), m])

  const readiness: UploadReadiness = { paper, rosterCount: submissions.length, complete: [], overMarkedOutOf: [], incomplete: 0, existing }
  for (const s of submissions) {
    const forScript = marksBySubmission.get(s.submissionId)
    if (!forScript?.length) continue
    const completion = scriptCompletion(rubricIds, forScript)
    if (!completion.complete) { readiness.incomplete++; continue }
    if (completion.total > paper.maxScore) readiness.overMarkedOutOf.push({ submissionId: s.submissionId, learnerName: s.name, total: completion.total })
    else readiness.complete.push({ submissionId: s.submissionId, studentId: s.studentId, learnerName: s.name, total: completion.total })
  }
  return readiness
}

function describe(existing: ExistingUpload): string {
  return existing.destination === 'topical' ? 'a topical assignment' : `a termly assessment (${existing.subject ?? 'subject'})`
}

export async function uploadPaperMarks(input: {
  assignmentId: string
  teacherId: string
  teacherUserId: string
  target: UploadTarget
}): Promise<UploadOutcome> {
  const { target } = input
  const readiness = await getUploadReadiness(input.assignmentId)
  const { paper, existing } = readiness

  if (paper.isAdaptive) throw new UploadError('Adaptive assignments cannot be filed from Mark Papers yet.')
  if (readiness.complete.length === 0) throw new UploadError('No script is fully reviewed yet — review every question for at least one learner first.')
  if (existing && existing.destination !== target.destination) {
    throw new UploadError(`These marks were already uploaded to ${describe(existing)}. Uploading again updates them there.`)
  }

  const base = { overMarkedOutOf: readiness.overMarkedOutOf, incomplete: readiness.incomplete }
  let outcome: UploadOutcome

  if (target.destination === 'topical') {
    const results = await Promise.all(readiness.complete.map(c => recordSubmissionMark({
      assignment: { id: paper.id, max_score: paper.maxScore, subject: paper.subject, topic: paper.topic, substrand_id: paper.substrandId },
      target: { submissionId: c.submissionId },
      score: c.total,
      teacherId: input.teacherId,
      teacherUserId: input.teacherUserId,
    })))
    if (paper.origin === 'paper_marking' && paper.status === 'draft') await closePaper(paper.id)
    outcome = {
      ...base,
      destination: 'topical',
      classAssessmentId: null,
      filed: readiness.complete.map(c => ({ learnerName: c.learnerName, total: c.total, filedScore: c.total })),
      refused: [],
      followUps: results.map(r => r.followUp),
    }
  } else {
    const assessment = await resolveTermlyAssessment(input.teacherId, paper, target, existing)
    const scored = readiness.complete.map(c => ({ ...c, filedScore: convertScore(c.total, paper.maxScore, assessment.max_score) }))
    let merge: Awaited<ReturnType<typeof mergeSubjectMarks>>
    try {
      merge = await mergeSubjectMarks({
        assessment,
        teacherId: input.teacherId,
        subject: target.subject,
        entries: scored.map(s => ({ studentId: s.studentId, studentName: s.learnerName, score: s.filedScore })),
      })
    } catch (err) {
      if (err instanceof AssessmentLockedError) throw new UploadError(err.message)
      throw err
    }
    const refusedIds = new Set(merge.refused.map(r => r.studentId))
    outcome = {
      ...base,
      destination: 'termly',
      classAssessmentId: assessment.id,
      filed: scored.filter(s => !refusedIds.has(s.studentId)).map(s => ({ learnerName: s.learnerName, total: s.total, filedScore: s.filedScore })),
      refused: merge.refused.map(r => ({ learnerName: r.studentName, reason: r.reason })),
      followUps: merge.written > 0 ? [termlyFollowUp(assessment.id, input.teacherId, input.teacherUserId)] : [],
    }
  }

  await recordUpload({
    assignmentId: paper.id,
    destination: outcome.destination,
    classAssessmentId: outcome.classAssessmentId,
    subject: target.destination === 'termly' ? target.subject : null,
    uploadedBy: input.teacherId,
    learnerCount: outcome.filed.length,
  })
  return outcome
}

async function resolveTermlyAssessment(
  teacherId: string,
  paper: FileablePaper,
  target: TermlyTarget,
  existing: ExistingUpload | null,
): Promise<ClassAssessment> {
  if ('newAssessment' in target) {
    if (existing) throw new UploadError(`These marks were already uploaded to ${describe(existing)}. Uploading again updates them there.`)
    const n = target.newAssessment
    return createAssessment(teacherId, paper.classId, {
      title: buildAssessmentTitle(n.assessmentType, n.term, n.year),
      assessmentType: n.assessmentType,
      term: n.term,
      year: n.year,
      maxScore: n.maxScore,
      subjects: [target.subject],
    })
  }
  if (existing && (existing.classAssessmentId !== target.assessmentId || existing.subject !== target.subject)) {
    throw new UploadError(`These marks were already uploaded to ${describe(existing)}. Uploading again updates them there.`)
  }
  const assessment = await getAssessmentById(target.assessmentId, teacherId)
  if (!assessment) throw new UploadError('Assessment not found.')
  if (assessment.class_id !== paper.classId) throw new UploadError('That assessment belongs to a different class.')
  return assessment
}

function termlyFollowUp(assessmentId: string, teacherId: string, teacherUserId: string): () => Promise<void> {
  return async () => {
    try {
      await triggerLearnerModelUpdates(assessmentId, teacherId)
    } catch (e: unknown) {
      console.error('[paperIntelligence/upload] triggerLearnerModelUpdates failed:', e instanceof Error ? e.message : String(e), { assessmentId })
    }
    try {
      await recordAssessmentEvidence(assessmentId, teacherId, teacherUserId)
    } catch (e: unknown) {
      console.error('[paperIntelligence/upload] recordAssessmentEvidence failed:', e instanceof Error ? e.message : String(e), { assessmentId })
    }
  }
}
