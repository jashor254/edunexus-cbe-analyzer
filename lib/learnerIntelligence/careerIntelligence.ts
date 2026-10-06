// lib/learnerIntelligence/careerIntelligence.ts
// Career Intelligence — pure reasoning only.
//
// Junior (Grade 7–9): explore broad career FAMILIES with evidence — never a
// predicted career. Senior (Grade 10–12): specific career alignment, still
// evidence + confidence per recommendation. Both modes reuse the same
// deterministic, AI-free capabilityMatchEngine — no duplicate matching logic.
//
// Pure-Domain Test Isolation Audit / Career Intelligence Canonical Boundary
// Purity Audit — this file previously also held every DB/Projection/AI-backed
// Career operation (resolveFreshCapabilityProfile, buildCareerIntelligence,
// getCareerBlueprintSummary, resolveCanonicalCareerMatches), which meant
// importing careerModeForGrade() — a two-line, zero-dependency function —
// also statically imported @/lib/repositories, @/lib/projection/recompute
// and @/lib/career/careerEngine, eagerly constructing a Supabase client for
// all 42 repositories at import time. That orchestration now lives in the
// sibling module lib/learnerIntelligence/careerIntelligenceOrchestration.ts,
// which imports FROM this file — never the reverse. This file's dependency
// graph is deliberately limited to pure types and pure deterministic logic:
// no Supabase, no repositories, no projection recompute, no AI, no network,
// no environment credentials required merely to import it.
//
// careerModeForGrade() remains physically defined here — not moved, not
// re-exported from elsewhere — per the canonical-ownership invariant
// careerMode.architecture.test.ts and careerCanonicalization.architecture.test.ts
// enforce.

import type { CapabilityCareerMatch, CareerCategory, CareerPathway } from '@/lib/career/types'
import { SENIOR_PATHWAYS } from '@/lib/curriculum/subjects'
import type { Insight } from './insight'

// Exported (Sprint 12M) so `getCareerBlueprintSummary`
// (lib/learnerIntelligence/careerIntelligenceOrchestration.ts) — and any
// other consumer needing the same cluster-level label a specific career maps
// to — reuses this one label map instead of inventing a second one.
export const CATEGORY_LABEL: Record<CareerCategory, string> = {
  technology:  'Engineering & Technology',
  health:      'Health Sciences',
  agriculture: 'Agriculture & Environmental Sciences',
  creative:    'Creative Industries',
  business:    'Business',
  trades:      'Trades & Technical Careers',
  education:   'Education',
  environment: 'Environmental Sciences',
  media:       'Media & Communication',
  finance:     'Finance',
}

export type CareerFamilyInsight = {
  category:            CareerCategory
  categoryLabel:        string
  insight:              Insight
  exampleCareerTitles:  string[]
}

export type CareerMatchInsight = {
  careerSlug:    string
  careerTitle:   string
  /** Propagated from `CapabilityCareerMatch.career_category` — already computed by `computeCapabilityMatches`, never re-derived here. Added Sprint 12M so cluster-level consumers (Blueprint) don't need a second read to learn a match's category. */
  careerCategory: CareerCategory
  tier:          CapabilityCareerMatch['tier']
  alignmentPct:  number
  insight:       Insight
  /** The CBC Senior pathway the corpus files this career under (FIX 4). */
  careerPathway: CareerPathway | null
  /**
   * Whether this career sits inside the learner's own Senior pathway (FIX 4).
   * Null when the learner's pathway is not on record (or the career has no
   * pathway), so no inside/outside claim is made without evidence.
   */
  pathwayRelation: PathwayRelation | null
}

// ── Senior pathway honesty (FIX 4) ──────────────────────────────────────────
//
// Senior matching is partly circular: pathway choice → subjects taken →
// capability dimensions → matches, so most matches confirm the pathway the
// learner already chose. This is not redesigned. Instead each match is tagged
// within/cross pathway, the strongest cross-pathway match that reaches at
// least the stretch tier is surfaced on its own, and the output carries one
// line explaining the circularity. None of this changes any score or order,
// and nothing here implies a within-pathway career is the better career.

export type PathwayRelation = 'within_pathway' | 'cross_pathway'

/** Validates a stored pathway string against the one canonical list (lib/curriculum/subjects.ts). */
export function asCareerPathway(value: string | null | undefined): CareerPathway | null {
  return value && (SENIOR_PATHWAYS as readonly string[]).includes(value) ? (value as CareerPathway) : null
}

export function pathwayRelationFor(
  careerPathway: CareerPathway | null | undefined,
  learnerPathway: CareerPathway | null,
): PathwayRelation | null {
  if (!learnerPathway || !careerPathway) return null
  return careerPathway === learnerPathway ? 'within_pathway' : 'cross_pathway'
}

/**
 * The strongest cross-pathway match that reaches at least the stretch tier,
 * or null. Entrepreneurial-tier entries are excluded — they are a separate
 * promotion of one career that already appears in its scored tier.
 */
export function selectCrossPathwayHighlight(matches: CareerMatchInsight[]): CareerMatchInsight | null {
  let best: CareerMatchInsight | null = null
  for (const m of matches) {
    if (m.pathwayRelation !== 'cross_pathway') continue
    if (m.tier !== 'primary' && m.tier !== 'stretch') continue
    if (!best || m.alignmentPct > best.alignmentPct) best = m
  }
  return best
}

export function crossPathwayInsight(match: CareerMatchInsight, learnerPathway: CareerPathway): Insight {
  return {
    observation: `${match.careerTitle} sits outside your ${learnerPathway} pathway, yet your current evidence already reaches ${match.alignmentPct}% alignment with it.`,
    evidence:    match.insight.evidence,
    confidence:  match.insight.confidence,
    action:      `If it interests you, talk with your teacher or careers adviser about what moving toward ${match.careerTitle} from your current pathway would involve.`,
  }
}

/** The one-line circularity note every Senior output carries. */
export function seniorPathwayNote(learnerPathway: CareerPathway | null): string {
  return learnerPathway
    ? `These matches are shaped by the subjects you take in your ${learnerPathway} pathway, so most will sit inside it — that reflects your subject choices, not which careers would suit you best.`
    : 'Your Senior School pathway is not on record, so these matches are not marked as inside or outside it; they are still shaped by the subjects you have been assessed in.'
}

// ── Career Principle grade gate ─────────────────────────────────────────────
//
// The ONE place the Junior/Senior boundary is decided. Junior (Grade 7-9)
// always explores broad families, never a ranked/percentage career
// prediction; Senior (Grade 10-12) sees specific alignment. Every consumer
// that needs this decision (Career Explorer, Parent Career Intelligence,
// the Career Intelligence Report, and this module itself) must call this
// instead of re-deriving the boundary — see Sprint "Career Intelligence
// Canonicalization" Phase 1, which replaced 4 independent
// `grade >= 7 && grade <= 9` checks with this single export.
export type CareerMode = 'exploration' | 'planning'

export function careerModeForGrade(grade: number): CareerMode {
  return grade >= 7 && grade <= 9 ? 'exploration' : 'planning'
}

// Groups already-computed matches into broad category "families" — the one
// Junior-safe view every consumer of computeCapabilityMatches() must use
// instead of surfacing individual ranked/percentage predictions. Pure
// function over CapabilityCareerMatch[] so any consumer (Career Explorer,
// Parent Intelligence, the Career Intelligence Report) can reuse the exact
// same grouping instead of inventing its own — same matcher, same data,
// just regrouped for the audience the Career Principle requires.
export function familiesFromMatches(all: CapabilityCareerMatch[]): CareerFamilyInsight[] {
  const byCategory = new Map<CareerCategory, CapabilityCareerMatch[]>()
  for (const match of all) {
    const bucket = byCategory.get(match.career_category) ?? []
    bucket.push(match)
    byCategory.set(match.career_category, bucket)
  }

  const families: CareerFamilyInsight[] = []
  for (const [category, matches] of byCategory) {
    matches.sort((a, b) => b.alignment_score - a.alignment_score)
    const top = matches[0]
    const exampleTitles = matches.slice(0, 3).map(m => m.career_title)

    const evidence = [
      ...top.strengths.map(s => s.narrative),
      ...top.gaps.slice(0, 1).map(g => g.narrative),
    ]

    families.push({
      category,
      categoryLabel: CATEGORY_LABEL[category] ?? category,
      insight: {
        observation: `Current evidence suggests an emerging capability alignment with ${CATEGORY_LABEL[category] ?? category}.`,
        evidence:    evidence.length > 0 ? evidence : ['Not enough capability data yet to break this down further.'],
        confidence:  top.confidence,
        action:      `Explore this field through subjects, clubs, or projects related to: ${exampleTitles.join(', ')}.`,
      },
      exampleCareerTitles: exampleTitles,
    })
  }

  return families.sort((a, b) => {
    const scoreA = Math.max(...(byCategory.get(a.category) ?? []).map(m => m.alignment_score))
    const scoreB = Math.max(...(byCategory.get(b.category) ?? []).map(m => m.alignment_score))
    return scoreB - scoreA
  })
}
