// lib/assessments/topical.ts
// Topical checks — a single subject/strand/topic, rated per student, meant to
// be fast enough that teachers actually do them between term assessments.
// Distinct from a general/term assessment: real strand+topic granularity,
// one subject at a time, no parent `assessments` row required.

import { repos } from '@/lib/repositories'
import { updateFromAssessment } from '@/lib/learnerModel/updater'
import { levelToApproxMarks, type CBCLevel } from './gradeCalculator'

export type TopicalRating = {
  studentId: string
  rating:    CBCLevel
}

export type RecordTopicalAssessmentInput = {
  classId:   string
  teacherId: string
  subject:   string
  strand:    string
  topic:     string
  term:      number
  year:      number
  ratings:   TopicalRating[]
}

export async function recordTopicalAssessment(
  input: RecordTopicalAssessmentInput,
): Promise<{ recorded: number }> {
  if (input.ratings.length === 0) return { recorded: 0 }

  const studentNames = await repos.assessments.findStudentNamesByIds(
    input.ratings.map(r => r.studentId),
  )

  const now = new Date().toISOString()

  await repos.assessments.insertTopicalAssessments(
    input.ratings.map(r => ({
      class_id:   input.classId,
      teacher_id: input.teacherId,
      student_id: r.studentId,
      subject:    input.subject,
      strand:     input.strand,
      topic:      input.topic,
      rating:     r.rating,
      marks:      levelToApproxMarks(r.rating),
      term:       input.term,
      year:       input.year,
    })),
  )

  await Promise.allSettled(
    input.ratings.map(r =>
      updateFromAssessment({
        studentId:     r.studentId,
        studentName:   studentNames.get(r.studentId) ?? 'Student',
        subjectScores: { [input.subject]: r.rating },
        subjectMarks:  { [input.subject]: levelToApproxMarks(r.rating) },
        strand:        input.strand,
        subStrand:     input.topic,
        subject:       input.subject,
        term:          input.term,
        year:          input.year,
        assessedAt:    now,
      }),
    ),
  )

  return { recorded: input.ratings.length }
}
