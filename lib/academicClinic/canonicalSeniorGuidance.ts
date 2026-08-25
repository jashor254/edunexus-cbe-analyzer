// lib/academicClinic/canonicalSeniorGuidance.ts
//
// Phase 2.1 (Learner Report Architecture — canonical ownership cutover,
// Decision 2: "lib/career/ is the canonical owner of career ranking/
// matching. The Clinic/learner-wide report must not independently rank
// careers.").
//
// This is a presentation-only adapter: it maps the already-ranked,
// already-scored output of lib/learnerIntelligence/careerIntelligenceOrchestration.ts's
// resolveCanonicalCareerMatches() into the existing SeniorGuidance/CareerMatch
// shape the Clinic PDF/UI already render — it does not rescore, rerank, or
// recompute anything. It replaces generateSeniorGuidance()'s use of the
// legacy, non-canonical lib/academicClinic/careerEngine.ts (CareerEngine.matchCareers())
// as the source of a senior learner's top-career list.
//
// generateSeniorGuidance() itself is NOT deleted — it is still used by the
// one remaining, orphaned, unreachable-by-navigation client-only surface
// (app/academic-clinic/page.tsx's on-page preview, which has no server-side
// path to call the canonical career engine before this report is composed)
// and by analyzeDreamCareer() (a distinct feature, out of this phase's
// scope). Every LIVE, reachable, server-side report path — the auto-emailed/
// WhatsApp'd pipeline (assessmentPipeline.ts) and the on-demand paid
// download (clinicPdfHandler.ts) — now calls this adapter instead. See the
// Phase 2.1 closeout's "Remaining architectural limitations" for the
// orphaned-page exception, named explicitly rather than silently left.
import type { CanonicalCareerMatches } from '@/lib/learnerIntelligence/careerIntelligenceOrchestration'
import { toDisruptionRisk, toGrowthOutlook } from './canonicalCareerAdapter'
import type { SubjectProgress, SeniorGuidance, CareerMatch } from './types'

// Mirrors the confidence-band language capabilityMatchEngine.ts's own tier
// system already implies (primary >= 70, stretch >= 50, alternative < 50) —
// re-labeled into Clinic's pre-existing STRONG/GOOD/POSSIBLE vocabulary, not
// a new scoring rule. match_score already reflects the canonical engine's
// own assessment-count confidence cap (e.g. capped at 65 for a single
// assessment, per lib/career/capabilityMatchEngine.ts), so this presentation
// band inherits that sparse-evidence degradation for free.
function matchStrengthFromScore(score: number): 'STRONG' | 'GOOD' | 'POSSIBLE' {
  if (score >= 70) return 'STRONG'
  if (score >= 50) return 'GOOD'
  return 'POSSIBLE'
}

// Presentation-only gap explanation: which of the career's required subjects
// this learner has not yet reached a solid (Level 3+) mark in. This compares
// already-known subject levels against an already-known required-subjects
// list — it does not compute a new alignment score.
function buildGapSubjects(requiredSubjects: string[], subjects: SubjectProgress[]): string[] {
  return requiredSubjects.filter(reqSubj => {
    const match = subjects.find(s => s.subject === reqSubj)
    return !match || match.level < 3
  })
}

export function buildSeniorGuidanceFromCanonical(
  canonical: CanonicalCareerMatches,
  subjects: SubjectProgress[],
  firstName: string,
  grade: number,
): SeniorGuidance {
  // Zero-evidence boundary (Phase 2.1 Decision 5): resolveCanonicalCareerMatches
  // already distinguishes "no confirmed evidence at all" (insufficientEvidence:
  // true) from "some confirmed evidence, however sparse" (false, with a
  // score-capped, low-confidence-labeled match list) — this adapter must not
  // collapse those two states into the same message.
  if (canonical.insufficientEvidence || canonical.matches.length === 0) {
    return {
      topCareers: [],
      reasoning: `Career recommendations for ${firstName} require at least one teacher-confirmed assessment before a real match can be shown.`,
      nextSteps: [
        'Complete or confirm at least one assessment for this term',
        'Research KCSE minimum grade requirements for target university programmes',
        grade <= 10
          ? 'Speak with your career counsellor about pathway choices before Grade 10 selections'
          : 'Speak with your career counsellor about university pathway and subject choices',
      ],
      honestAssessment: 'Current evidence is insufficient to suggest a confident career match. Complete more assessments and focus on the action plan below — clearer pathway signals will emerge as performance data builds up.',
    }
  }

  const topCareers: CareerMatch[] = canonical.matches.slice(0, 3).map(m => {
    const gapSubjects = buildGapSubjects(m.career.required_subjects ?? [], subjects)
    const matchStrength = matchStrengthFromScore(m.match_score)
    const keyGap = gapSubjects.length > 0
      ? `${gapSubjects[0]} would benefit from structured support to meet ${m.career.title} entry requirements.`
      : `Based on available evidence, maintaining current performance across relevant subjects should keep this pathway open.`

    return {
      name: m.career.title,
      description: m.career.title,
      matchPercentage: m.match_score,
      matchStrength,
      whyItFits: m.match_reasoning,
      keyGap,
      kenyanPathway: m.career.pathway,
      requiredSubjects: m.career.required_subjects ?? undefined,
      aiImpact: {
        disruptionRisk: toDisruptionRisk(m.career.ai_impact.level),
        growthOutlook: toGrowthOutlook(m.career.ai_impact.level),
      },
    }
  })

  const honestAssessment = topCareers.length >= 2
    ? `Based on available evidence, ${topCareers[0].name} and ${topCareers[1].name} appear to be realistic pathways worth exploring. Confidence reflects how much confirmed evidence is on record so far — sustained effort and additional assessments will sharpen this alignment further.`
    : `Based on available evidence, ${topCareers[0].name} appears to be a realistic pathway worth exploring. Confidence reflects how much confirmed evidence is on record so far — sustained effort and additional assessments will sharpen this alignment further.`

  return {
    topCareers,
    reasoning: `Career recommendations are based on ${firstName}'s capability profile, sourced from confirmed evidence, and the entry requirements for each pathway in the Kenyan education system.`,
    nextSteps: [
      `Prioritise strengthening ${[...subjects].sort((a, b) => a.level - b.level)[0]?.displayName || 'priority subjects'} before the next term`,
      'Research KCSE minimum grade requirements for target university programmes',
      grade <= 10
        ? 'Speak with your career counsellor about pathway choices before Grade 10 selections'
        : 'Speak with your career counsellor about university pathway and subject choices',
    ],
    honestAssessment,
  }
}
