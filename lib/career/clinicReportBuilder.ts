// lib/career/clinicReportBuilder.ts
// Builds the in-page clinic report data from student profile + assessments + career matches.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getCareerBySlug, getMatchesForStudent, getCurrentSkillsForAge, getNextSkillsForAge, getAgeRangeLabel } from './careerEngine'
import { STANDARD_DISCLAIMER } from './types'
import type { ClinicReport, SubjectScoreRow, Career } from './types'

// CBC level labels
const LEVEL_LABELS: Record<number, string> = {
  1: 'Below Expectations',
  2: 'Approaching Expectations',
  3: 'Meets Expectations',
  4: 'Exceeds Expectations',
}

// Subject display names
function displayName(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function subjectStatus(score: number): SubjectScoreRow['status'] {
  if (score >= 3.5) return 'strong'
  if (score >= 2.5) return 'meets'
  if (score >= 1.5) return 'needs_work'
  return 'critical'
}

function calcAge(dob?: string | null): number {
  if (!dob) return 14
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000))
}

// ── Main builder ──────────────────────────────────────────────────────────────

export async function buildClinicReport(
  studentId: string,
  db: SupabaseClient
): Promise<ClinicReport> {

  // 1. Student profile
  const { data: student, error: studentError } = await db
    .from('students')
    .select('id, name, grade, curriculum_type, date_of_birth')
    .eq('id', studentId)
    .single()

  if (studentError || !student) throw new Error('Student not found')

  const grade = student.grade as number
  const curriculum = (student.curriculum_type as string) ?? 'cbc'
  const age = calcAge(student.date_of_birth as string | null)
  const ageRange = getAgeRangeLabel(age)

  // Junior: Grade 7-9 CBC; Senior: Grade 10+, IGCSE, Form 1-4
  const section: 'junior' | 'senior' =
    curriculum === 'igcse' || grade >= 10 ? 'senior' : 'junior'

  // 2. Latest assessment scores
  const { data: assessments } = await db
    .from('assessments')
    .select('subject, score, created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(40)

  // Latest score per subject
  const subjectMap: Record<string, number> = {}
  for (const a of assessments ?? []) {
    const key = (a.subject as string).toLowerCase()
    if (!(key in subjectMap)) subjectMap[key] = a.score as number
  }

  const subjectRows: SubjectScoreRow[] = Object.entries(subjectMap).map(([subj, score]) => ({
    subject: subj,
    display_name: displayName(subj),
    score,
    status: subjectStatus(score),
  }))

  const sorted = [...subjectRows].sort((a, b) => b.score - a.score)
  const topSubjects = sorted.slice(0, 3)
  const weakSubjects = sorted.slice(-2).reverse()

  const overall_score =
    subjectRows.length > 0
      ? subjectRows.reduce((s, r) => s + r.score, 0) / subjectRows.length
      : 0
  const overall_level = Math.max(1, Math.min(4, Math.round(overall_score))) as 1 | 2 | 3 | 4
  const overall_label = LEVEL_LABELS[overall_level]

  const topName = topSubjects[0]?.display_name ?? 'key subjects'
  const weakName = weakSubjects[0]?.display_name ?? 'a few areas'
  const summary_sentence = `${student.name} is performing at ${overall_label} overall, with strong ${topName} skills and room to grow in ${weakName}.`

  // 3. Learning context (pathway, first_subject, session_goal)
  const { data: ctx } = await db
    .from('student_learning_context')
    .select('recommended_pathway, first_subject, session_goal, overall_tier')
    .eq('student_id', studentId)
    .maybeSingle()

  const recommended_pathway = ctx?.recommended_pathway as string | null

  // 4. Dream career (from student_career_interests)
  const { data: interests } = await db
    .from('student_career_interests')
    .select('career_slug, notes')
    .eq('student_id', studentId)
    .order('interest_level', { ascending: false })
    .limit(1)

  const dream_career = interests?.[0]?.career_slug as string | null ?? null

  // 5. Top career match (senior only)
  let top_career = null
  let top_career_detail: Career | null = null

  if (section === 'senior') {
    const matches = await getMatchesForStudent(studentId)
    if (matches.length > 0) {
      top_career = matches[0]
      top_career_detail = await getCareerBySlug(top_career.career.slug)

      // Enrich subject gap rows with required scores
      if (top_career_detail) {
        const importance = top_career_detail.subject_importance ?? {}
        for (const row of subjectRows) {
          const imp = importance[row.subject]
          if (imp === 'critical') {
            row.required = 3
            row.gap = row.score < 3 ? 3 - row.score : 0
          } else if (imp === 'important') {
            row.required = 2
            row.gap = row.score < 2 ? 2 - row.score : 0
          }
        }
      }
    }
  }

  // 6. Skill timeline for top career (or fallback to generic)
  const skillTimeline = top_career_detail?.skill_timeline ?? []
  const current_phase = getCurrentSkillsForAge(skillTimeline, age)
  const next_phase = getNextSkillsForAge(skillTimeline, age)

  // 7. Parent actions (3 max, prioritized)
  const parent_actions: ClinicReport['parent_actions'] = []

  // Action 1: weakest subject
  if (weakSubjects.length > 0) {
    const weak = weakSubjects[0]
    const careerReason = top_career_detail
      ? `${weak.display_name} is ${top_career_detail.subject_importance?.[weak.subject] ?? 'important'} for ${top_career_detail.title}.`
      : `Improving ${weak.display_name} will open more career doors.`
    parent_actions.push({
      title: `Focus on ${weak.display_name}`,
      why: careerReason,
      action: `Prioritize ${weak.display_name} this term. Consider extra practice or a tutor if needed. Even 20 minutes of daily focused study compounds quickly.`,
    })
  }

  // Action 2: skill timeline for current age
  if (current_phase) {
    parent_actions.push({
      title: `Build Age-Appropriate Skills (Ages ${ageRange})`,
      why: current_phase.why,
      action: current_phase.parent_action,
    })
  } else {
    parent_actions.push({
      title: 'Explore Interests This Term',
      why: 'At this stage, broad exposure matters more than specialization.',
      action: 'Encourage trying at least one new activity — debate, coding club, gardening, drama. Interests discovered at this age often become careers.',
    })
  }

  // Action 3: Learning Compass session
  const firstSubject = ctx?.first_subject as string ?? topSubjects[0]?.display_name ?? 'their strongest subject'
  parent_actions.push({
    title: 'Start a Learning Compass Session',
    why: `The AI tutor already knows ${student.name}'s level and will start exactly where they are.`,
    action: `Start a session in ${firstSubject} — the AI knows their performance and will meet them at their level. First session shows immediate results.`,
    link: '/chat',
  })

  return {
    student_id: studentId,
    student_name: student.name as string,
    grade,
    age,
    curriculum_type: curriculum,
    section,
    generated_at: new Date().toISOString(),
    overall_score,
    overall_level,
    overall_label,
    top_subjects: topSubjects,
    weak_subjects: weakSubjects,
    summary_sentence,
    recommended_pathway,
    top_career,
    top_career_detail,
    dream_career,
    skill_timeline: skillTimeline,
    current_age_range: ageRange,
    current_phase,
    next_phase,
    parent_actions,
    disclaimer: STANDARD_DISCLAIMER,
  }
}
