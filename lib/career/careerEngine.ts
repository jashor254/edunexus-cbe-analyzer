// lib/career/careerEngine.ts

import { repos } from '@/lib/repositories'
import { callDeepSeek } from '@/lib/ai/deepseek'
import { publishEvent } from '@/lib/events/publish'
import { extractCapabilityProfile } from './capabilityExtractor'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { projectionToTimestampedScoreHistory, type TimestampedScoreSnapshot } from '@/lib/learnerIntelligence/projectionAdapters'
import { STANDARD_DISCLAIMER } from './types'
import { SENIOR_PATHWAYS } from '@/lib/curriculum/subjects'
import type {
  Career,
  CareerCategory,
  CareerPathway,
  CareerSearchFilters,
  CareerSummary,
  StudentCareerInterest,
  SkillTimelineItem,
  CapabilityProfile,
} from './types'

// ── SEARCH-OR-GENERATE (unlimited career database) ───────────────────────────

const VALID_CATEGORIES: CareerCategory[] = [
  'technology', 'health', 'agriculture', 'creative', 'business',
  'trades', 'education', 'environment', 'media', 'finance',
]
const VALID_PATHWAYS: CareerPathway[] = [...SENIOR_PATHWAYS]

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export async function generateCareerProfile(query: string): Promise<Omit<Career, 'id' | 'created_at' | 'updated_at'>> {
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

// ── READ ──────────────────────────────────────────────────────────────────────

export async function getCareerBySlug(slug: string): Promise<Career | null> {
  return repos.careers.findCareerBySlug(slug)
}

// Full career with all COS Phase 1 intelligence fields — used by the detail page.
export async function getCareerBySlugWithCOS(slug: string): Promise<Career | null> {
  return repos.careers.findCareerBySlugWithCOS(slug)
}

export async function searchCareers(filters: CareerSearchFilters): Promise<CareerSummary[]> {
  return repos.careers.searchCareers(filters)
}

// `searchOrGenerateCareer()` was removed here. It generated a career profile
// with DeepSeek and upserted it straight into `careers` — the table the match
// engine reads and every learner-facing surface renders as canonical knowledge.
// One learner's search could introduce AI-authored salary bands and KCSE
// minimums into the corpus with no human ever seeing them.
//
// Use `requestCareerKnowledge()` from lib/career/knowledgeRequests.ts, which
// routes generated profiles to `career_review_queue` and returns the asking
// learner a provisional preview carrying no unreviewed figures.

export async function getAllCareers(): Promise<CareerSummary[]> {
  return repos.careers.getAllCareers()
}

// Returns full Career objects including all COS Phase 1 intelligence columns.
// Used by the capability match engine — not for summary lists.
export async function getAllCareersWithCOS(): Promise<Career[]> {
  return repos.careers.getAllCareersWithCOS()
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

// ── STUDENT INTERESTS ─────────────────────────────────────────────────────────

export async function getInterestsForStudent(studentId: string): Promise<StudentCareerInterest[]> {
  return repos.careers.findInterestsForStudent(studentId)
}

export async function saveCareerInterest(
  studentId: string,
  careerSlug: string,
  interestLevel: number,
  notes?: string
): Promise<StudentCareerInterest> {
  const career = await repos.careers.findCareerIdBySlug(careerSlug)

  const saved = await repos.careers.insertCareerInterest({
    student_id:     studentId,
    career_id:      career?.id ?? null,
    career_slug:    careerSlug,
    interest_level: interestLevel,
    notes:          notes ?? null,
    explored_at:    new Date().toISOString(),
  })

  // Fired only after the insert above succeeds — analytics observing an
  // explicit learner action, never a trigger for one. Does not (and must
  // not) touch capability/Projection/pathway affinity; saving an interest
  // stays a pure insert (Phase 9 §14/§15's proven boundary).
  void publishEvent({
    event_type:    'student.career_interest.saved',
    resource_type: 'career_interest',
    resource_id:   saved.id,
    actor_id:      studentId,
    payload:       { careerSlug, careerId: career?.id ?? null, interestLevel },
  }).catch(err => console.error('[events] student.career_interest.saved:', err instanceof Error ? err.message : String(err)))

  return saved
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

export async function saveCapabilityProfile(
  studentId: string,
  profile: CapabilityProfile
): Promise<void> {
  await repos.careers.updateStudentCapabilityProfile(studentId, profile)
  await repos.careers.insertCapabilityHistory({
    student_id:         studentId,
    capability_profile: profile,
    assessment_count:   profile.assessment_count,
    computed_at:        profile.computed_at,
  })
}

/**
 * Merges two independently-sorted chronological score-history sources into
 * one true time-ordered sequence — pure, no I/O, unit-testable without a
 * database. Exported specifically so Phase H's blend logic (below) can be
 * verified directly, the same "separate pure computation from persistence"
 * split lib/projection/engine.ts (pure) vs recompute.ts (orchestration)
 * already establishes in this codebase.
 */
export function mergeChronologicalScoreHistories(
  ...sources: TimestampedScoreSnapshot[][]
): Array<Record<string, number>> {
  return sources
    .flat()
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .map(s => s.scores)
}

// Canonical recompute-and-persist path for `students.capability_profile`.
//
// Phase H (docs/architecture/learner-record-layer-decisions.md Decision 8,
// amended): sources from Projection (recomputeLearnerProjection ->
// projectionToTimestampedScoreHistory — the same Evidence-derived pattern
// Blueprint/Career Intelligence already use) BLENDED with the legacy
// `assessments` table, rather than switching to Projection alone. Projection
// only sees evidence that reached the Evidence Domain; `app/api/assessments/create/route.ts`
// (the Academic Clinic intake path) does not yet emit an Evidence Domain row
// (migration-ledger.md, Implementation Wave 3) — switching this function to
// Projection-only would have silently dropped capability signal for every
// Academic-Clinic-only student. Blending closes the "third independent
// capability store" duplication Decision 8 identified without that
// regression. Returns null (never persists a fabricated profile) when
// neither source has any evidence yet.
export async function recomputeAndSaveCapabilityProfile(
  studentId: string
): Promise<CapabilityProfile | null> {
  const [projection, legacyHistory] = await Promise.all([
    recomputeLearnerProjection(studentId),
    repos.learnerModel.findAssessmentHistory(studentId),
  ])

  const projectionSnapshots = projectionToTimestampedScoreHistory(projection)
  const legacySnapshots: TimestampedScoreSnapshot[] = legacyHistory.map(r => ({
    at: r.created_at,
    scores: r.subject_scores,
  }))

  const merged = mergeChronologicalScoreHistories(projectionSnapshots, legacySnapshots)
  if (merged.length === 0) return null

  const profile = extractCapabilityProfile(merged)
  await saveCapabilityProfile(studentId, profile)
  return profile
}

export async function getCapabilityProfile(
  studentId: string
): Promise<CapabilityProfile | null> {
  return repos.careers.findStudentCapabilityProfile(studentId)
}

export async function getCapabilityHistory(
  studentId: string,
  limit = 10
): Promise<Array<{ computed_at: string; profile: CapabilityProfile }>> {
  return repos.careers.findCapabilityHistory(studentId, limit)
}
