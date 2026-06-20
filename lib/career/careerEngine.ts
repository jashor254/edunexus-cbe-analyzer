// lib/career/careerEngine.ts

import { createServiceClient } from '@/utils/supabase/service'
import { callDeepSeek } from '@/lib/ai/deepseek'
import { STANDARD_DISCLAIMER } from './types'
import type {
  Career,
  CareerCategory,
  CareerPathway,
  CareerSearchFilters,
  CareerSummary,
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

// COS-enriched columns — includes all Phase 1 capability intelligence fields
const CAREER_COS_COLS = [
  'id', 'slug', 'title', 'category', 'pathway', 'description',
  'doors', 'ai_impact', 'kenya_market_outlook', 'salary_range_kes',
  'required_subjects', 'disclaimer',
  // Phase 1 COS fields
  'required_capabilities', 'capability_cluster', 'difficulty', 'kenya_demand',
  'saturation_note', 'kcse_minimum', 'time_to_income_years', 'cost_to_qualify',
  'risk_level', 'prestige_level', 'social_reality',
  'alternative_career_slugs', 'complementary_career_slugs',
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

// Full career with all COS Phase 1 intelligence fields — used by the detail page.
export async function getCareerBySlugWithCOS(slug: string): Promise<Career | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('careers')
    .select(CAREER_COS_COLS)
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
  if (filters.pathway) {
    query = query.eq('pathway', filters.pathway)
  }

  const { data, error } = await query.order('title').limit(20)
  if (error) throw new Error(`Career search failed: ${error.message}`)

  return (data ?? []).map(d => ({
    ...(d as object),
    ai_impact: { level: ((d as { ai_impact?: { level?: string } }).ai_impact?.level) ?? 'medium' },
  })) as unknown as CareerSummary[]
}

// ── SEARCH-OR-GENERATE (unlimited career database) ───────────────────────────
// Every learner search resolves to a real career: we check the table first,
// and on a miss we generate a full profile via DeepSeek and persist it —
// so the database keeps growing with the careers students actually ask about,
// including new AI-era roles that don't exist in any seed list yet.

const VALID_CATEGORIES: CareerCategory[] = [
  'technology', 'health', 'agriculture', 'creative', 'business',
  'trades', 'education', 'environment', 'media', 'finance',
]
const VALID_PATHWAYS: CareerPathway[] = ['STEM', 'Social Sciences', 'Arts & Sports Science']

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

async function generateCareerProfile(query: string): Promise<Omit<Career, 'id' | 'created_at' | 'updated_at'>> {
  const systemPrompt = 'You are a Kenyan CBC career-guidance expert. Return ONLY valid JSON matching the exact schema requested — no markdown, no extra text.'
  const prompt = `Generate a complete career profile for: "${query}" — written for a Kenyan CBC (Competency-Based Curriculum) student and their parent.

Be honest about AI's impact — not fear-based, but a real balanced read of what's automating, what opportunities are emerging, and where humans still win.

Return ONLY this JSON (all fields required):
{
  "title": "exact career title",
  "category": "one of: ${VALID_CATEGORIES.join(', ')}",
  "pathway": "one of: ${VALID_PATHWAYS.join(', ')}",
  "description": "2-3 sentences on what this career actually involves day to day in Kenya",
  "kenya_market_outlook": "2-3 sentences on demand, employers, and outlook in Kenya specifically",
  "required_subjects": ["cbc_subject_key"],
  "subject_importance": { "cbc_subject_key": "critical|important|helpful" },
  "salary_range_kes": {
    "entry": { "min": 0, "max": 0, "label": "Entry level (0-2 years)" },
    "mid":   { "min": 0, "max": 0, "label": "Mid level (3-5 years)" },
    "senior":{ "min": 0, "max": 0, "label": "Senior (5+ years)" },
    "note": "Kenya salary context"
  },
  "doors": [
    { "type": "employment", "title": "...", "description": "..." },
    { "type": "self_employment", "title": "...", "description": "...", "startup_cost_kes": { "min": 0, "max": 0 }, "platforms": ["..."] },
    { "type": "entrepreneurship", "title": "...", "description": "...", "the_gap": "underserved Kenya problem this career solves", "example_ventures": ["..."], "market_note": "..." },
    { "type": "ai_era", "title": "...", "description": "...", "ai_opportunity": "...", "ai_sovereignty": { "the_shift": "what one person with AI can now do solo", "what_you_can_build": ["..."], "tools_to_learn": ["..."], "sovereignty_example": "believable Kenyan example: name, what built, what earns" } }
  ],
  "ai_impact": {
    "level": "low|medium|high|transforming",
    "replacing": ["task AI is automating"],
    "creating": ["new opportunity AI is creating"],
    "human_advantage": ["why humans still matter here"],
    "timeline": "when this shift happens",
    "honest_summary": "1-2 honest sentences on AI's real impact"
  },
  "future_skills": ["skill to build now"],
  "skill_timeline": [
    { "age_range": "10–13", "phase": "Foundation",   "skills": ["..."], "why": "...", "parent_action": "..." },
    { "age_range": "14–16", "phase": "Building",     "skills": ["..."], "why": "...", "parent_action": "..." },
    { "age_range": "17–19", "phase": "Specializing", "skills": ["..."], "why": "...", "parent_action": "..." },
    { "age_range": "20–24", "phase": "Career Entry", "skills": ["..."], "why": "...", "parent_action": "..." }
  ],
  "required_capabilities": {
    "analytical_reasoning": { "minimum": 0.0, "ideal": 0.0, "weight": 0.0, "note": "why this dimension matters for this career" },
    "communication":        { "minimum": 0.0, "ideal": 0.0, "weight": 0.0, "note": "..." },
    "creative_thinking":    { "minimum": 0.0, "ideal": 0.0, "weight": 0.0, "note": "..." },
    "technical_aptitude":   { "minimum": 0.0, "ideal": 0.0, "weight": 0.0, "note": "..." },
    "social_intelligence":  { "minimum": 0.0, "ideal": 0.0, "weight": 0.0, "note": "..." },
    "resilience":           { "minimum": 0.0, "ideal": 0.0, "weight": 0.0, "note": "..." }
  },
  "capability_cluster": ["top_dimension_key", "second_dimension_key"],
  "difficulty": "accessible|moderate|hard|very_hard",
  "kenya_demand": "critical_shortage|undersupplied|balanced|saturated",
  "saturation_note": "optional note if saturated, else null",
  "kcse_minimum": {
    "overall_grade": "e.g. B+",
    "subject_grades": { "subject_key": "grade" },
    "alternative_routes": ["route if KCSE minimum not met"],
    "note": "honest note on what grades actually matter vs what the system says"
  },
  "time_to_income_years": 0,
  "cost_to_qualify": { "min": 0, "max": 0, "note": "what this covers" },
  "risk_level": "low|medium|high|variable",
  "prestige_level": 3,
  "social_reality": {
    "prestige_level": 3,
    "common_misconception": "what people wrongly believe about this career",
    "honest_reality_check": "what the job is actually like day to day",
    "parent_frame": {
      "opening": "1 sentence to open the career conversation with a Kenyan parent",
      "key_points": ["concrete fact that changes a parent's perspective"],
      "honest_challenges": ["real challenge to acknowledge honestly"]
    }
  },
  "alternative_career_slugs": ["slug-of-similar-career"],
  "complementary_career_slugs": ["slug-of-career-that-pairs-well"]
}

Rules for capability weights: all 6 weights must sum to exactly 1.0. Minimum values: 0.10–0.75. Ideal values: 0.30–0.95. Weight the 2 most important dimensions heaviest.`

  const raw = await callDeepSeek(prompt, systemPrompt, { temperature: 0.4, maxTokens: 3500 })
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Career generation returned no JSON')
  const ai = JSON.parse(jsonMatch[0]) as Record<string, unknown>

  const category = VALID_CATEGORIES.includes(ai.category as CareerCategory) ? (ai.category as CareerCategory) : 'business'
  const pathway  = VALID_PATHWAYS.includes(ai.pathway as CareerPathway)   ? (ai.pathway  as CareerPathway)  : 'Social Sciences'

  return {
    slug:                 slugify((ai.title as string) || query),
    title:                (ai.title as string) || query,
    category,
    pathway,
    description:          (ai.description as string) ?? '',
    kenya_market_outlook: (ai.kenya_market_outlook as string) ?? '',
    required_subjects:    Array.isArray(ai.required_subjects) ? ai.required_subjects as string[] : ['mathematics', 'english'],
    subject_importance:   (ai.subject_importance as Career['subject_importance']) ?? {},
    salary_range_kes:     (ai.salary_range_kes as Career['salary_range_kes']) ?? null,
    doors:                Array.isArray(ai.doors) ? ai.doors as Career['doors'] : [],
    ai_impact:            (ai.ai_impact as Career['ai_impact']) ?? {
      level: 'medium', replacing: [], creating: [], human_advantage: [], timeline: '', honest_summary: '',
    },
    future_skills:        Array.isArray(ai.future_skills) ? ai.future_skills as string[] : [],
    skill_timeline:       Array.isArray(ai.skill_timeline) ? ai.skill_timeline as SkillTimelineItem[] : [],
    kenya_examples:       null,
    disclaimer:           STANDARD_DISCLAIMER,
    // COS fields — generated in same call so new careers are immediately match-able
    required_capabilities:      (ai.required_capabilities as Career['required_capabilities']) ?? null,
    capability_cluster:         Array.isArray(ai.capability_cluster) ? ai.capability_cluster as string[] : [],
    difficulty:                 (['accessible','moderate','hard','very_hard'].includes(ai.difficulty as string) ? ai.difficulty : 'moderate') as Career['difficulty'],
    kenya_demand:               (['critical_shortage','undersupplied','balanced','saturated'].includes(ai.kenya_demand as string) ? ai.kenya_demand : 'balanced') as Career['kenya_demand'],
    saturation_note:            (ai.saturation_note as string | null) ?? null,
    kcse_minimum:               (ai.kcse_minimum as Career['kcse_minimum']) ?? null,
    time_to_income_years:       typeof ai.time_to_income_years === 'number' ? ai.time_to_income_years : 4,
    cost_to_qualify:            (ai.cost_to_qualify as Career['cost_to_qualify']) ?? null,
    risk_level:                 (['low','medium','high','variable'].includes(ai.risk_level as string) ? ai.risk_level : 'medium') as Career['risk_level'],
    prestige_level:             typeof ai.prestige_level === 'number' ? ai.prestige_level as Career['prestige_level'] : 3,
    social_reality:             (ai.social_reality as Career['social_reality']) ?? null,
    alternative_career_slugs:   Array.isArray(ai.alternative_career_slugs)   ? ai.alternative_career_slugs   as string[] : [],
    complementary_career_slugs: Array.isArray(ai.complementary_career_slugs) ? ai.complementary_career_slugs as string[] : [],
    source:                     'ai_generated',
    search_count:               0,
  } as unknown as Omit<Career, 'id' | 'created_at' | 'updated_at'>
}

export async function searchOrGenerateCareer(query: string): Promise<Career> {
  const supabase = createServiceClient()
  const trimmed = query.trim()
  if (!trimmed) throw new Error('Career search query cannot be empty')

  const slug = slugify(trimmed)
  const existing = await getCareerBySlug(slug)
  if (existing) return existing

  const { data: titleMatch } = await supabase
    .from('careers')
    .select(CAREER_FULL_COLS)
    .ilike('title', `%${trimmed}%`)
    .limit(1)
    .maybeSingle()

  if (titleMatch) return titleMatch as unknown as Career

  const generated = await generateCareerProfile(trimmed)
  const { data: saved, error } = await supabase
    .from('careers')
    .upsert(generated, { onConflict: 'slug' })
    .select(CAREER_COS_COLS)
    .single()

  if (error) throw new Error(`Failed to save generated career: ${error.message}`)
  return saved as unknown as Career
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

// Returns full Career objects including all COS Phase 1 intelligence columns.
// Used by the capability match engine — not for summary lists.
export async function getAllCareersWithCOS(): Promise<Career[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('careers')
    .select(CAREER_COS_COLS)
    .order('title')

  if (error) throw new Error(`Failed to load careers with COS data: ${error.message}`)
  return (data ?? []) as unknown as Career[]
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

// ── CAPABILITY PROFILE DB LAYER ───────────────────────────────────────────────

import type { CapabilityProfile } from './types'

export async function saveCapabilityProfile(
  studentId: string,
  profile: CapabilityProfile
): Promise<void> {
  const supabase = createServiceClient()

  const { error: updateErr } = await supabase
    .from('students')
    .update({
      capability_profile:     profile,
      capability_computed_at: profile.computed_at,
    })
    .eq('id', studentId)

  if (updateErr) throw new Error(`saveCapabilityProfile update failed: ${updateErr.message}`)

  const { error: histErr } = await supabase
    .from('capability_history')
    .insert({
      student_id:         studentId,
      capability_profile: profile,
      assessment_count:   profile.assessment_count,
      computed_at:        profile.computed_at,
    })

  if (histErr) throw new Error(`saveCapabilityProfile history insert failed: ${histErr.message}`)
}

export async function getCapabilityProfile(
  studentId: string
): Promise<CapabilityProfile | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('students')
    .select('capability_profile')
    .eq('id', studentId)
    .single()

  if (error) throw new Error(`getCapabilityProfile failed: ${error.message}`)
  return (data?.capability_profile as CapabilityProfile) ?? null
}

export async function getCapabilityHistory(
  studentId: string,
  limit = 10
): Promise<Array<{ computed_at: string; profile: CapabilityProfile }>> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('capability_history')
    .select('computed_at, capability_profile')
    .eq('student_id', studentId)
    .order('computed_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`getCapabilityHistory failed: ${error.message}`)

  return (data ?? []).map(row => ({
    computed_at: row.computed_at as string,
    profile:     row.capability_profile as CapabilityProfile,
  }))
}
