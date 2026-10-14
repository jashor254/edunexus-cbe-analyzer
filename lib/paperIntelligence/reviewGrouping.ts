// lib/paperIntelligence/reviewGrouping.ts
//
// Pure — arranges the class's AI proposals for review BY QUESTION (Phase 1
// design: a teacher marks question 1a for all 45 learners, then 1b, the way
// they mark paper — not script by script).
//
// For each question:
//   - agreeGroups: proposals the AI is confident about with nothing for the
//     teacher to decide, grouped by mark ("5/5 — 12 learners"). One tap
//     confirms a whole group.
//   - yourCall: anything that needs a judgment — unreadable, low marking
//     confidence, plausible answers the scheme does not list, or a question the
//     AI found no answer for on a marked script.
//   - reviewed: already confirmed/overridden, still changeable.
// And whether each learner's script is complete (every question reviewed), so
// its total can be finalized.

import { PAPER_INTELLIGENCE_LIMITS } from '@/lib/config/paperIntelligence'
import type { ScriptMarkRow, ScriptMarkStatus } from './scriptMarks'
import type { MarkedPoint } from './types'

/**
 * A proposal a teacher should look at rather than wave through: the AI could
 * not read it, was unsure of its own marking, or found answers the scheme does
 * not list (the teacher decides whether they earn). Phase 0: the AI's own
 * uncertainty flags covered 3 of the 4 questions where it and the teacher
 * disagreed.
 */
export function needsAttention(m: { uncertain: boolean; grading_confidence: number | null; proposed_mark: number; plausible_mark: number }): boolean {
  return m.uncertain || (m.grading_confidence ?? 0) < PAPER_INTELLIGENCE_LIMITS.reviewBelowGradingConfidence || m.plausible_mark > m.proposed_mark
}

export type ReviewRubric = {
  id: string
  questionNumber: number
  label: string
  questionText: string
  maxMarks: number
  acceptedAnswers: string[]
}

export type ReviewLearner = { submissionId: string; name: string }

export type ReviewItem = {
  submissionId: string
  learnerName: string
  /** null when the AI returned nothing for this question on a marked script. */
  markId: string | null
  status: ScriptMarkStatus | 'missing'
  recognizedAnswer: string
  points: MarkedPoint[]
  proposedMark: number
  plausibleMark: number
  maxMark: number
  uncertain: boolean
  gradingConfidence: number | null
  rationale: string | null
  pageNumbers: number[]
  finalMark: number | null
}

export type AgreeGroup = { mark: number; items: ReviewItem[] }

export type QuestionReview = ReviewRubric & {
  agreeGroups: AgreeGroup[]
  yourCall: ReviewItem[]
  reviewed: ReviewItem[]
}

export function buildQuestionReviews(
  rubrics: ReviewRubric[],
  marks: ScriptMarkRow[],
  learners: ReviewLearner[],
): QuestionReview[] {
  const nameBySubmission = new Map(learners.map(l => [l.submissionId, l.name]))
  const markByKey = new Map(marks.map(m => [`${m.submission_id}:${m.rubric_id}`, m]))
  // Only scripts the AI has marked are reviewable; a learner never captured
  // has nothing to review yet.
  const marked = [...new Set(marks.map(m => m.submission_id))]
    .sort((a, b) => (nameBySubmission.get(a) ?? '').localeCompare(nameBySubmission.get(b) ?? ''))

  return [...rubrics].sort((a, b) => a.questionNumber - b.questionNumber).map(rubric => {
    const agree = new Map<number, ReviewItem[]>()
    const yourCall: ReviewItem[] = []
    const reviewed: ReviewItem[] = []

    for (const submissionId of marked) {
      const m = markByKey.get(`${submissionId}:${rubric.id}`)
      const learnerName = nameBySubmission.get(submissionId) ?? 'Unnamed learner'
      if (!m) {
        yourCall.push({
          submissionId, learnerName, markId: null, status: 'missing', recognizedAnswer: '', points: [],
          proposedMark: 0, plausibleMark: 0, maxMark: rubric.maxMarks, uncertain: true, gradingConfidence: null,
          rationale: 'No answer to this question was found on the script — check the photos and enter the mark.',
          pageNumbers: [], finalMark: null,
        })
        continue
      }
      const item: ReviewItem = {
        submissionId, learnerName, markId: m.id, status: m.status, recognizedAnswer: m.recognized_answer, points: m.points,
        proposedMark: m.proposed_mark, plausibleMark: m.plausible_mark, maxMark: m.max_mark, uncertain: m.uncertain,
        gradingConfidence: m.grading_confidence, rationale: m.rationale, pageNumbers: m.page_numbers, finalMark: m.final_mark,
      }
      if (m.status !== 'proposed') reviewed.push(item)
      else if (needsAttention(m)) yourCall.push(item)
      else agree.set(m.proposed_mark, [...(agree.get(m.proposed_mark) ?? []), item])
    }

    return {
      ...rubric,
      // Highest mark first — full-mark groups are the fastest to wave through.
      agreeGroups: [...agree.entries()].sort((a, b) => b[0] - a[0]).map(([mark, items]) => ({ mark, items })),
      yourCall,
      reviewed,
    }
  })
}

export type ScriptCompletion =
  | { complete: false; reviewedQuestions: number; totalQuestions: number }
  | { complete: true; total: number }

/** A script is complete when every rubric question has a teacher-reviewed mark. */
export function scriptCompletion(rubricIds: string[], marksForSubmission: Pick<ScriptMarkRow, 'rubric_id' | 'status' | 'final_mark'>[]): ScriptCompletion {
  const byRubric = new Map(marksForSubmission.map(m => [m.rubric_id, m]))
  let total = 0
  let reviewedQuestions = 0
  for (const id of rubricIds) {
    const m = byRubric.get(id)
    if (m && m.status !== 'proposed' && m.final_mark !== null) {
      reviewedQuestions++
      total += m.final_mark
    }
  }
  return reviewedQuestions === rubricIds.length && rubricIds.length > 0
    ? { complete: true, total }
    : { complete: false, reviewedQuestions, totalQuestions: rubricIds.length }
}
