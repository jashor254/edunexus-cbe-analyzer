// lib/career/careerEngine.ts

import { createServiceClient } from '@/utils/supabase/service'
import type {
  Career,
  CareerSummary,
  CareerSearchFilters,
  StudentCareerInterest,
  CareerMatchWithDetail,
  SkillTimelineItem,
  ParentCareerSummary,
} from './types'

// Column lists — always explicit, never select('*')
const CAREER_FULL_COLS = [
  'id', 'slug', 'title', 'category', 'description',
  'doors', 'ai_impact', 'subject_importance',
  'kenya_market_outlook', 'salary_range_kes',
  'required_subjects', 'skill_timeline', 'future_skills',
  'kenya_examples', 'pathway', 'disclaimer',
  'created_at', 'updated_at',
].join(', ')

const CAREER_SUMMARY_COLS = [
  'id', 'slug', 'title', 'category', 'description',
  'ai_impact', 'kenya_market_outlook',
  'salary_range_kes', 'required_subjects', 'pathway',
].join(', ')

// ── READ ──────────────────────────────────────────────────────────────────────

export async function getCareerBySlug(slug: string): Promise<Career | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('careers')
    .select(CAREER_FULL_COLS)
    .eq('slug', slug)
    .single()

  if (error || !data) return null
  return data as unknown as Career
}

export async function searchCareers(filters: CareerSearchFilters): Promise<CareerSummary[]> {
  const supabase = createServiceClient()

  let query = supabase.from('careers').select(CAREER_SUMMARY_COLS)

  if (filters.q) {
    query = query.or(`title.ilike.%${filters.q}%,description.ilike.%${filters.q}%`)
  }
  if (filters.category) {
    query = query.eq('category', filters.category)
  }

  const { data, error } = await query.order('title').limit(20)
  if (error) throw new Error(`Career search failed: ${error.message}`)

  return (data ?? []).map(d => ({
    ...(d as object),
    ai_impact: { level: ((d as { ai_impact?: { level?: string } }).ai_impact?.level) ?? 'medium' },
  })) as unknown as CareerSummary[]
}

export async function getAllCareers(): Promise<CareerSummary[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('careers')
    .select(CAREER_SUMMARY_COLS)
    .order('title')

  if (error) throw new Error(`Failed to load careers: ${error.message}`)

  return (data ?? []).map(d => ({
    ...(d as object),
    ai_impact: { level: ((d as { ai_impact?: { level?: string } }).ai_impact?.level) ?? 'medium' },
  })) as unknown as CareerSummary[]
}

// ── SKILL TIMELINE HELPERS ────────────────────────────────────────────────────

export function getAgeRangeLabel(age: number): string {
  if (age <= 13) return '10–13'
  if (age <= 16) return '14–16'
  if (age <= 19) return '17–19'
  return '20–24'
}

export function getCurrentSkillsForAge(timeline: SkillTimelineItem[], age: number): SkillTimelineItem | null {
  const label = getAgeRangeLabel(age)
  return timeline.find(t => t.age_range === label) ?? null
}

export function getNextSkillsForAge(timeline: SkillTimelineItem[], age: number): SkillTimelineItem | null {
  const ranges = ['10–13', '14–16', '17–19', '20–24']
  const currentLabel = getAgeRangeLabel(age)
  const idx = ranges.indexOf(currentLabel)
  if (idx === -1 || idx >= ranges.length - 1) return null
  return timeline.find(t => t.age_range === ranges[idx + 1]) ?? null
}

// ── STUDENT MATCHES ───────────────────────────────────────────────────────────

export async function getMatchesForStudent(studentId: string): Promise<CareerMatchWithDetail[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('student_career_matches')
    .select(
      `id, student_id, career_id, match_score, match_reasoning, subject_gaps, skill_gaps, generated_at,
       career:careers(id, slug, title, category, description, ai_impact, kenya_market_outlook, salary_range_kes, required_subjects, pathway)`
    )
    .eq('student_id', studentId)
    .order('match_score', { ascending: false })
    .limit(5)

  if (error) throw new Error(`Failed to load matches: ${error.message}`)

  return (data ?? []).map(d => ({
    ...(d as object),
    career: {
      ...((d as { career: object }).career as object),
      ai_impact: { level: ((d as { career: { ai_impact?: { level?: string } } }).career?.ai_impact?.level) ?? 'medium' },
    },
  })) as unknown as CareerMatchWithDetail[]
}

export async function saveCareerMatches(
  studentId: string,
  matches: Array<{
    career_slug: string
    match_score: number
    match_reasoning: string
    subject_gaps: unknown
    skill_gaps: unknown
  }>
): Promise<void> {
  const supabase = createServiceClient()

  const slugs = matches.map(m => m.career_slug)
  const { data: careers, error: lookupError } = await supabase
    .from('careers')
    .select('id, slug')
    .in('slug', slugs)

  if (lookupError) throw new Error(`Failed to look up career IDs: ${lookupError.message}`)

  const slugToId = Object.fromEntries((careers ?? []).map(c => [c.slug, c.id]))

  const rows = matches
    .filter(m => slugToId[m.career_slug])
    .map(m => ({
      student_id: studentId,
      career_id: slugToId[m.career_slug],
      match_score: m.match_score,
      match_reasoning: m.match_reasoning,
      subject_gaps: m.subject_gaps,
      skill_gaps: m.skill_gaps,
      generated_at: new Date().toISOString(),
    }))

  const { error } = await supabase
    .from('student_career_matches')
    .upsert(rows, { onConflict: 'student_id,career_id' })

  if (error) throw new Error(`Failed to save matches: ${error.message}`)
}

// ── STUDENT INTERESTS ─────────────────────────────────────────────────────────

export async function getInterestsForStudent(studentId: string): Promise<StudentCareerInterest[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('student_career_interests')
    .select('id, student_id, career_id, career_slug, interest_level, notes, explored_at, created_at')
    .eq('student_id', studentId)
    .order('explored_at', { ascending: false })

  if (error) throw new Error(`Failed to load interests: ${error.message}`)
  return (data ?? []) as StudentCareerInterest[]
}

export async function saveCareerInterest(
  studentId: string,
  careerSlug: string,
  interestLevel: number,
  notes?: string
): Promise<StudentCareerInterest> {
  const supabase = createServiceClient()

  const { data: career } = await supabase
    .from('careers')
    .select('id')
    .eq('slug', careerSlug)
    .maybeSingle()

  const { data, error } = await supabase
    .from('student_career_interests')
    .insert({
      student_id: studentId,
      career_id: career?.id ?? null,
      career_slug: careerSlug,
      interest_level: interestLevel,
      notes: notes ?? null,
      explored_at: new Date().toISOString(),
    })
    .select('id, student_id, career_id, career_slug, interest_level, notes, explored_at, created_at')
    .single()

  if (error) throw new Error(`Failed to save interest: ${error.message}`)
  return data as StudentCareerInterest
}

// ── PARENT SUMMARY ────────────────────────────────────────────────────────────

export async function generateParentSummary(studentId: string): Promise<ParentCareerSummary> {
  const supabase = createServiceClient()

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, name, date_of_birth')
    .eq('id', studentId)
    .single()

  if (studentError || !student) throw new Error('Student not found')

  const studentAge = student.date_of_birth
    ? Math.floor((Date.now() - new Date(student.date_of_birth as string).getTime()) / (365.25 * 24 * 3600 * 1000))
    : 14

  const topCareers = await getMatchesForStudent(studentId)

  const currentAgeSkills: Record<string, string[]> = {}
  const nextAgeSkills: Record<string, string[]> = {}

  for (const match of topCareers) {
    const careerFull = await getCareerBySlug(match.career.slug)
    if (!careerFull) continue
    const current = getCurrentSkillsForAge(careerFull.skill_timeline, studentAge)
    const next = getNextSkillsForAge(careerFull.skill_timeline, studentAge)
    if (current) currentAgeSkills[match.career.title] = current.skills
    if (next) nextAgeSkills[match.career.title] = next.skills
  }

  const overallReadiness = topCareers.length > 0
    ? `${student.name} shows strongest alignment with ${topCareers[0]?.career.title ?? 'multiple careers'} based on current subject performance.`
    : 'No career matches generated yet. Add assessment scores to see career alignment.'

  const parentActions = [
    'Ensure strong performance in core subjects (especially Mathematics and English).',
    `Explore extracurricular activities aligned with ${topCareers[0]?.career.title ?? 'areas of interest'}.`,
    'Discuss the skill age timeline with your child so they understand what to learn now.',
    'Visit a professional in their top career field if possible.',
    'Review subject gaps and consider tutoring in weak areas.',
  ]

  return {
    student_name: student.name as string,
    student_age: studentAge,
    top_careers: topCareers,
    current_age_skills: currentAgeSkills,
    next_age_skills: nextAgeSkills,
    overall_readiness: overallReadiness,
    parent_actions: parentActions,
  }
}

// ── SUBJECT STRENGTH SUGGESTIONS ─────────────────────────────────────────────

export async function getCareersBySubjectStrength(
  subjectScores: Record<string, number>
): Promise<CareerSummary[]> {
  const topSubjects = Object.entries(subjectScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([subject]) => subject.toLowerCase())

  if (topSubjects.length === 0) return getAllCareers()

  const all = await getAllCareers()
  return all
    .map(c => {
      const required = (c.required_subjects as string[]).map(s => s.toLowerCase())
      const overlap = topSubjects.filter(s => required.some(r => r.includes(s) || s.includes(r))).length
      return { career: c, overlap }
    })
    .sort((a, b) => b.overlap - a.overlap)
    .map(s => s.career)
}

// ── SEED RUNNER ───────────────────────────────────────────────────────────────

export async function runSeed(): Promise<{ inserted: number; errors: string[] }> {
  const { seedCareers } = await import('./seedCareers')
  return seedCareers()
}
