// lib/ai/ragContext.ts
// Student context builder for Academic Clinic reports and Career matching.
// NOT used by Compass — Compass is self-contained in lib/compass/.

import { createServiceClient } from '@/utils/supabase/service'
import { type CurriculumType } from '@/lib/curriculum'

export interface StudentRAGContext {
  studentName:    string
  studentGrade:   number
  curriculumType: CurriculumType
  latestAssessment: {
    term:              number
    year:              number
    scores:            Record<string, number | string>
    strongestSubjects: string[]
    strugglingSubjects: string[]
    overallLevel:      string
  } | null
}

export async function buildStudentRAGContext(
  learnerId: string
): Promise<StudentRAGContext> {
  const db = createServiceClient()

  const [studentResult, assessmentsResult] = await Promise.all([
    db.from('students')
      .select('name, grade, curriculum_type')
      .eq('id', learnerId)
      .maybeSingle(),

    db.from('assessments')
      .select('subject_scores, term, year, curriculum_type')
      .eq('student_id', learnerId)
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  const student    = studentResult.data
  const latest     = assessmentsResult.data?.[0]
  const curriculum = (student?.curriculum_type ?? 'cbc') as CurriculumType
  const isIGCSE    = curriculum === 'igcse'

  let latestAssessment: StudentRAGContext['latestAssessment'] = null

  if (latest?.subject_scores) {
    const scores  = latest.subject_scores as Record<string, number | string>
    const entries = Object.entries(scores)

    if (isIGCSE) {
      const gradeToNum: Record<string, number> = {
        'A*': 9, 'A': 8, 'B': 7, 'C': 6, 'D': 5, 'E': 4, 'F': 3, 'G': 2, 'U': 1,
      }
      const nums = entries.map(([, v]) => gradeToNum[String(v)] ?? 0)
      const avg  = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0

      latestAssessment = {
        term:   latest.term,
        year:   latest.year,
        scores,
        strongestSubjects:  entries.filter(([, v]) => (gradeToNum[String(v)] ?? 0) >= 7).map(([s]) => s),
        strugglingSubjects: entries.filter(([, v]) => (gradeToNum[String(v)] ?? 0) <= 5).map(([s]) => s),
        overallLevel:
          avg >= 8 ? 'Grade A — Excellent' :
          avg >= 7 ? 'Grade B — Good' :
          avg >= 6 ? 'Grade C — Satisfactory' :
                     'Grade D or below — Needs support',
      }
    } else {
      const numEntries = entries.filter(([, v]) => typeof v === 'number') as [string, number][]
      const avg = numEntries.length
        ? numEntries.reduce((s, [, v]) => s + v, 0) / numEntries.length
        : 0

      latestAssessment = {
        term:   latest.term,
        year:   latest.year,
        scores,
        strongestSubjects:  numEntries.filter(([, v]) => v >= 3).sort(([,a],[,b]) => b-a).slice(0,3).map(([s]) => s),
        strugglingSubjects: numEntries.filter(([, v]) => v <= 2).sort(([,a],[,b]) => a-b).slice(0,3).map(([s]) => s),
        overallLevel:
          avg >= 3.5 ? 'Exceeds Expectations' :
          avg >= 2.5 ? 'Meets Expectations' :
          avg >= 1.5 ? 'Approaching Expectations' :
                       'Below Expectations',
      }
    }
  }

  return {
    studentName:    student?.name    ?? 'Student',
    studentGrade:   student?.grade   ?? 7,
    curriculumType: curriculum,
    latestAssessment,
  }
}

export function buildRAGSystemPrompt(context: StudentRAGContext): string {
  const { studentName, studentGrade, curriculumType, latestAssessment: a } = context
  const firstName = studentName.split(' ')[0]
  const isIGCSE   = curriculumType === 'igcse'

  let assessmentBlock = 'No assessments on record yet.'

  if (a) {
    const scoreLines = Object.entries(a.scores)
      .map(([subj, score]) => `  ${subj}: ${score}`)
      .join('\n')

    assessmentBlock = `Latest Assessment (${isIGCSE ? a.year : `Term ${a.term}, ${a.year}`}):
Overall: ${a.overallLevel}
Scores:\n${scoreLines}
Strongest: ${a.strongestSubjects.join(', ') || 'none'}
Needs support: ${a.strugglingSubjects.join(', ') || 'none'}`
  }

  return `Student: ${firstName} | ${isIGCSE ? 'Year' : 'Grade'} ${studentGrade} | ${curriculumType.toUpperCase()}

${assessmentBlock}

Use this context to personalise your response. Address the student by first name.`
}
