// lib/academicClinic/canonicalCareerAdapter.ts
//
// Phase 9.1.6 — corpus convergence, additive only.
//
// lib/academicClinic/careerEngine.ts's CAREER_DATABASE (40 hardcoded entries)
// and Postgres `careers` (43+ rows) are two live authorities for the same
// domain (see docs/architecture/phase9-career-discovery-audit.md's headline
// finding). scripts/migrate-academic-careers-to-supabase.ts already proved
// 40 of the 40 CAREER_DATABASE entries have a corresponding Postgres row
// (15 under an aliased pre-existing slug, 25 migrated directly from this
// same data) — so the real gap is narrower than "two disconnected corpora":
// it is that CareerEngine.matchCareers() still iterates the frozen
// CAREER_DATABASE snapshot, so a career published to Postgres AFTER that
// one-off migration (career #44 onward, or any future edit to an existing
// canonical row) never reaches Academic Clinic.
//
// This module does NOT replace CAREER_DATABASE and does NOT touch any of
// its 40 existing entries — doing so would require reconstructing
// `kenyaShortageScore` (never written to Postgres at all) and the exact
// numeric `matchRequirements.minimumLevels` (only survives in Postgres as a
// 3-tier `subject_importance` bucket) with real precision loss, which would
// change existing careers' match scores — the opposite of "preserve
// Academic Clinic semantics" (Phase 9.1.6 §7). See careerEngine.ts's own
// header comment: this engine's catalog was already deliberately left
// as-is once, as "a larger migration, not a hardening fix."
//
// Instead: adaptCanonicalCareersForClinic() converts ONLY the canonical
// careers CAREER_DATABASE does NOT already represent into the CareerData
// shape, so CareerEngine.matchCareers() can score them ADDITIONALLY,
// alongside the untouched legacy 40. A career already covered by
// CAREER_DATABASE (directly or via ALIAS) is excluded here — it keeps
// using its existing, unchanged hardcoded entry, so pre/post outputs for
// every existing career are byte-identical.
import type { Career, CareerCategory, AIImpact } from '@/lib/career/types'
import {
  CAREER_DATABASE,
  type CareerData,
  type AIDisruptionRisk,
  type JobGrowthOutlook,
  type EarningPotential,
  type DemandLevel,
} from './careerEngine'

// Mirrors scripts/migrate-academic-careers-to-supabase.ts's ALIAS_MAP
// (academicClinic id -> the pre-existing Postgres slug it was matched to).
// Not imported directly: that file is a one-off migration script, not a
// library module, and importing production code from scripts/ would invert
// the intended dependency direction. This is small, historical, and
// low-churn — it only needs to change if a NEW alias between the two
// corpora is discovered, which is exactly the kind of change corpus
// convergence work is meant to surface, not hide.
const CLINIC_ALIAS_TARGETS = new Set<string>([
  'software-engineer', 'medical-doctor', 'civil-engineer', 'agricultural-scientist',
  'environmental-scientist', 'journalist-content-creator', 'graphic-designer-creative-technologist',
  'teacher-education-technologist', 'accountant-financial-analyst', 'advocate-lawyer',
  'social-worker-community-developer', 'economist-policy-analyst', 'counselling-psychologist',
  'sports-coach-athlete-development',
])

/** Every Postgres slug CAREER_DATABASE already represents, one way or another. */
export function clinicRepresentedSlugs(): Set<string> {
  const autoSlugged = CAREER_DATABASE.map(c => c.id.replace(/_/g, '-'))
  return new Set([...autoSlugged, ...CLINIC_ALIAS_TARGETS])
}

function toClinicPathway(pathway: Career['pathway']): CareerData['pathway'] {
  // Inverse of migrate-academic-careers-to-supabase.ts's toPathway(). The
  // canonical enum has no other values, so this is exhaustive, not a guess.
  return pathway === 'Arts & Sports Science' ? 'Arts & Sports' : pathway
}

// career.kenya_demand is a real canonical field carrying genuine shortage
// signal — this is a derived value from real data, not an invented one.
// Absent kenya_demand gets 0 (no shortage bonus assumed), never a guessed
// middle value: an unknown shortage should never look the same as a
// confirmed 'balanced' one to the +15-point bonus in scoreCareer().
function toShortageScore(demand: Career['kenya_demand']): number {
  switch (demand) {
    case 'critical_shortage': return 90
    case 'undersupplied':     return 65
    case 'balanced':          return 40
    case 'saturated':         return 15
    default:                  return 0
  }
}

// Inverse of migrate-academic-careers-to-supabase.ts's aiLevel mapping.
// Phase 2.1 — exported alongside toGrowthOutlook, same reason.
export function toDisruptionRisk(level: AIImpact['level'] | undefined): AIDisruptionRisk {
  switch (level) {
    case 'low':          return 'low'
    case 'medium':       return 'moderate'
    case 'high':         return 'high'
    case 'transforming': return 'very_high'
    default:             return 'moderate'
  }
}

const DISRUPTION_PERCENTAGE: Record<AIDisruptionRisk, number> = {
  very_low: 5, low: 15, moderate: 35, high: 60, very_high: 80,
}

// scoreCareer()/buildMatchReasons()/buildGapSubjects() only ever read
// entries that ARE present in minimumLevels (Object.entries(...).every(...)
// — an omitted subject is silently excluded from the check, never treated
// as met or failed; confirmed by reading careerEngine.ts:2621-2624). So a
// required subject with no subject_importance entry is left out entirely
// here, rather than assigned a guessed minimum — "honest omission" per
// Phase 9.1.6 §15/§17, not a fabricated default.
function toMinimumLevels(
  requiredSubjects: string[],
  subjectImportance: Career['subject_importance'] | null | undefined,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const subject of requiredSubjects) {
    const importance = subjectImportance?.[subject]
    if (importance === 'critical') out[subject] = 4
    else if (importance === 'important') out[subject] = 3
    else if (importance === 'helpful') out[subject] = 1
    // else: no entry — omitted, not defaulted.
  }
  return out
}

function toEarningPotential(salary: Career['salary_range_kes']): EarningPotential {
  const midMax = salary?.mid?.max
  if (midMax === undefined || midMax === null) return 'moderate' // no signal — neutral, documented default
  if (midMax >= 350000) return 'exceptional'
  if (midMax >= 180000) return 'very_lucrative'
  if (midMax >= 90000)  return 'lucrative'
  if (midMax >= 40000)  return 'moderate'
  return 'lower_but_stable'
}

function toDemandLevel(demand: Career['kenya_demand']): DemandLevel {
  switch (demand) {
    case 'critical_shortage': return 'very_high'
    case 'undersupplied':     return 'high'
    case 'balanced':          return 'moderate'
    case 'saturated':         return 'low'
    default:                  return 'moderate' // no signal — neutral, documented default
  }
}

// Phase 2.1 — exported (was module-private) so canonicalSeniorGuidance.ts's
// canonical-career-match adapter can reuse the exact same level->outlook
// mapping instead of re-deriving a second copy of it.
export function toGrowthOutlook(level: AIImpact['level'] | undefined): JobGrowthOutlook {
  switch (level) {
    case 'low':          return 'stable'
    case 'medium':       return 'growing'
    case 'high':         return 'growing'
    case 'transforming': return 'booming'
    default:             return 'stable' // no signal — neutral, documented default
  }
}

/**
 * Converts one canonical Postgres Career into the Academic Clinic engine's
 * CareerData shape, using real canonical fields wherever a genuine
 * equivalent exists (see the per-field comments below) and honest,
 * explicitly-neutral defaults ONLY where Postgres has no comparable field
 * at all — never a fabricated precise value.
 */
export function toClinicCareerData(career: Career): CareerData {
  const requiredSubjects = career.required_subjects ?? []
  const disruptionRisk = toDisruptionRisk(career.ai_impact?.level)
  const futureSkills = career.future_skills ?? []

  return {
    id: career.slug,
    name: career.title,
    pathway: toClinicPathway(career.pathway),
    kenyaShortageScore: toShortageScore(career.kenya_demand),
    matchRequirements: {
      primarySubjects: requiredSubjects,
      minimumLevels: toMinimumLevels(requiredSubjects, career.subject_importance),
    },
    marketReality: {
      earningPotential: toEarningPotential(career.salary_range_kes),
      jobSecurity: 'moderate', // no canonical equivalent field exists — neutral, cosmetic only, never scored
      demandLevel: toDemandLevel(career.kenya_demand),
      kenyanContext: career.kenya_market_outlook ?? '',
    },
    cbeReadiness: {
      coreCompetencies: futureSkills.slice(0, 4),
      recommendedSeniorPath: career.pathway,
      universities: career.university_courses ?? [],
      tvetOptions: [], // no canonical TVET field exists (confirmed absent — see Phase 9 §26 finding)
    },
    aiImpact: {
      disruptionRisk,
      disruptionPercentage: DISRUPTION_PERCENTAGE[disruptionRisk],
      growthOutlook: toGrowthOutlook(career.ai_impact?.level),
      growthPercentage: 0, // no canonical equivalent — cosmetic only, never scored
      timeline: {
        shortTerm: '',
        midTerm: career.ai_impact?.timeline ?? '',
        longTerm: career.ai_impact?.honest_summary ?? '',
      },
      survivalStrategy: futureSkills,
    },
    realityCheck: {
      pros: career.ai_impact?.human_advantage ?? [],
      challenges: career.social_reality?.honest_reality_check ? [career.social_reality.honest_reality_check] : [],
      typicalDay: career.description ?? '',
    },
  }
}

/**
 * The only exported entry point. Filters canonical careers down to the ones
 * CAREER_DATABASE does not already represent, then adapts each. Pure — no
 * Supabase/repository import here; callers (assessmentPipeline.ts) fetch
 * canonical careers via the existing repository layer and pass the plain
 * array in, preserving the repository -> adapter -> pure matcher direction
 * (Phase 9.1.6 §10/§11).
 */
export function adaptCanonicalCareersForClinic(canonicalCareers: Career[]): CareerData[] {
  const represented = clinicRepresentedSlugs()
  return canonicalCareers
    .filter(c => !represented.has(c.slug))
    .map(toClinicCareerData)
}

// Re-exported for tests only — not part of the module's real surface.
export const _internal = { toShortageScore, toMinimumLevels, toClinicPathway, toDisruptionRisk }
export type { CareerCategory }
