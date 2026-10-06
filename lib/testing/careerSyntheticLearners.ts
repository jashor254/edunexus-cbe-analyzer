// lib/testing/careerSyntheticLearners.ts
//
// Deterministic synthetic learners for the Career Intelligence regression
// suite (FIX 7). Each fixture is a full score history — raw CBC 1–4, one
// record per assessment, oldest first — so the REAL extractor, match engine
// and orchestration can run end to end without a database. Nothing here is a
// real learner.
//
// `syntheticCorpus()` is the curated 18-career seed corpus (SEED_CAREERS +
// CAREER_COS_META), the same facts runSeed writes to `careers`.

import { SEED_CAREERS, CAREER_COS_META } from '@/lib/career/seedCareers'
import type { Career } from '@/lib/career/types'

export type SyntheticLearner = {
  id: string
  label: string
  grade: number
  pathway: string | null
  history: Array<Record<string, number>>
}

/** A Senior STEM-ish subject set (CBC keys used by the capability weight maps). */
export const SENIOR_SUBJECTS = [
  'mathematics', 'english', 'kiswahili', 'community_service_learning',
  'physics', 'chemistry', 'computer_studies', 'art_design',
]

/** A Junior (Grade 7–9) subject set. */
export const JUNIOR_SUBJECTS = [
  'mathematics', 'english', 'kiswahili', 'integrated_science', 'social_studies',
  'pre_technical_studies', 'creative_arts_sports', 'cre',
]

/** Every subject follows the same series of CBC levels. */
export function uniformHistory(subjects: string[], series: number[]): Array<Record<string, number>> {
  return series.map(v => Object.fromEntries(subjects.map(s => [s, v])))
}

export const SYNTHETIC_LEARNERS: SyntheticLearner[] = [
  { id: 'syn-top-flat',     label: 'Consistently top (CBC 3.8 ×4)',           grade: 10, pathway: 'STEM', history: uniformHistory(SENIOR_SUBJECTS, [3.8, 3.8, 3.8, 3.8]) },
  { id: 'syn-recovery',     label: 'Dip mid-history, then recovery',           grade: 10, pathway: 'STEM', history: uniformHistory(SENIOR_SUBJECTS, [3.5, 2.5, 3.6, 3.6]) },
  { id: 'syn-bad-first',    label: 'One bad first assessment, then normal',    grade: 10, pathway: 'STEM', history: uniformHistory(SENIOR_SUBJECTS, [2.0, 3.5, 3.6, 3.5]) },
  { id: 'syn-single',       label: 'Single assessment (CBC 3.9)',              grade: 10, pathway: 'STEM', history: uniformHistory(SENIOR_SUBJECTS, [3.9]) },
  {
    id: 'syn-no-creative', label: 'No creative-dimension subjects assessed', grade: 10, pathway: 'STEM',
    // Excludes every CREATIVE_WEIGHTS subject (incl. english and pre_technical,
    // which carry small creative weights) so creative_thinking has confidence 0.
    history: uniformHistory(['mathematics', 'kiswahili', 'physics', 'chemistry', 'biology', 'computer_studies', 'community_service_learning'], [3.2, 3.3, 3.4, 3.5]),
  },
  { id: 'syn-accelerating', label: 'Accelerating to the top (2.0 → 3.9)',      grade: 10, pathway: 'STEM', history: uniformHistory(SENIOR_SUBJECTS, [2.0, 2.6, 3.4, 3.9]) },
  { id: 'syn-junior',       label: 'Junior learner (Grade 8)',                 grade: 8,  pathway: null,   history: uniformHistory(JUNIOR_SUBJECTS, [2.8, 3.0, 3.1, 3.3]) },
  { id: 'syn-no-evidence',  label: 'No evidence at all',                       grade: 10, pathway: 'STEM', history: [] },
]

/**
 * ~20 varied Senior learners from a fixed-seed generator, for the
 * entrepreneurial-tier base rate. Deterministic: same output every run.
 */
export function variedSeniorCohort(count = 20, seed = 20261006): SyntheticLearner[] {
  let state = seed >>> 0
  const next = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0   // LCG, Numerical Recipes constants
    return state / 0x100000000
  }
  const round1 = (v: number): number => Math.round(Math.min(4, Math.max(1, v)) * 10) / 10

  return Array.from({ length: count }, (_, i) => {
    const base  = 1.5 + next() * 2.3          // CBC 1.5–3.8
    const drift = (next() - 0.4) * 0.4        // per-assessment drift, slightly upward on average
    const history = Array.from({ length: 4 }, (_, t) =>
      Object.fromEntries(SENIOR_SUBJECTS.map(s => [s, round1(base + drift * t + (next() - 0.5) * 0.8)])),
    )
    return { id: `syn-varied-${i + 1}`, label: `Varied learner ${i + 1}`, grade: 10, pathway: 'STEM', history }
  })
}

/** The curated seed corpus with its capability metadata — what runSeed writes. */
export function syntheticCorpus(): Career[] {
  return SEED_CAREERS.map(c => ({ ...c, ...(CAREER_COS_META[c.slug] ?? {}) }) as unknown as Career)
}
