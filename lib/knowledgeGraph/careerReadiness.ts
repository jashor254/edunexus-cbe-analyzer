// lib/knowledgeGraph/careerReadiness.ts
// Maps a student's knowledge graph root causes to career-specific readiness language.
// Called from the career detail API to surface "why your chain matters for this career."

import type { RootCauseResult } from './types'

// Which graph subjects are relevant to each CapabilityDimension
const CAPABILITY_SUBJECT_MAP: Record<string, string[]> = {
  analytical_reasoning: ['mathematics'],
  technical_aptitude:   ['mathematics', 'integrated_science', 'physics', 'chemistry'],
  creative_thinking:    [],
  communication:        [],
  social_intelligence:  [],
  resilience:           [],
}

// Map KCSE/CBC required subject keys → knowledge graph subject strings
const KCSE_TO_GRAPH_SUBJECT: Record<string, string> = {
  mathematics:          'mathematics',
  core_mathematics:     'mathematics',
  essential_mathematics:'mathematics',
  biology:              'biology',
  chemistry:            'chemistry',
  physics:              'physics',
  integrated_science:   'integrated_science',
  kiswahili:            'kiswahili',
  kiswahili_lugha:      'kiswahili_lugha',
  kiswahili_fasihi:     'kiswahili_fasihi',
}

export type CareerReadinessChain = {
  subject:         string
  failing_topic:   string
  root_cause:      string
  chain_language:  string  // human-readable: "Root Cause → ... → Failing Topic → Career"
  severity:        'critical' | 'moderate' | 'minor'
}

export type CareerReadinessReport = {
  chains:              CareerReadinessChain[]
  has_gaps:            boolean
  readiness_language:  string   // one-sentence summary
}

/**
 * Given a career's required subjects and the student's root cause results,
 * returns chain language for the subjects that matter to this career.
 */
export function buildCareerReadinessChains(
  careerTitle:       string,
  requiredSubjects:  string[],
  rootCauses:        RootCauseResult[]
): CareerReadinessReport {
  if (rootCauses.length === 0) {
    return { chains: [], has_gaps: false, readiness_language: '' }
  }

  // Resolve which graph subjects this career needs
  const relevantSubjects = new Set<string>()
  for (const s of requiredSubjects) {
    const mapped = KCSE_TO_GRAPH_SUBJECT[s.toLowerCase()]
    if (mapped) relevantSubjects.add(mapped)
  }

  if (relevantSubjects.size === 0) {
    return { chains: [], has_gaps: false, readiness_language: '' }
  }

  const chains: CareerReadinessChain[] = []

  for (const result of rootCauses) {
    if (!relevantSubjects.has(result.subject)) continue

    const topCause = result.root_causes[0]
    if (!topCause) continue

    const gap = 3 - result.performance
    const severity: CareerReadinessChain['severity'] =
      gap >= 2 ? 'critical' : gap >= 1 ? 'moderate' : 'minor'

    // Build the chain: Root Cause → ... → Failing Topic → Career
    const middleNodes = result.root_causes
      .slice(1, 3)
      .map(c => c.name)
      .join(' → ')

    const chainParts = [topCause.name]
    if (middleNodes) chainParts.push(middleNodes)
    chainParts.push(result.failing_topic_name)
    chainParts.push(careerTitle)

    chains.push({
      subject:        result.subject,
      failing_topic:  result.failing_topic_name,
      root_cause:     topCause.name,
      chain_language: chainParts.join(' → '),
      severity,
    })
  }

  if (chains.length === 0) {
    return { chains: [], has_gaps: false, readiness_language: '' }
  }

  // Sort: critical first
  chains.sort((a, b) => {
    const order = { critical: 0, moderate: 1, minor: 2 }
    return order[a.severity] - order[b.severity]
  })

  const criticalCount = chains.filter(c => c.severity === 'critical').length
  const topSubject = chains[0].subject.replace(/_/g, ' ')

  const readiness_language = criticalCount > 0
    ? `${careerTitle} readiness reduced — ${criticalCount} critical knowledge gap${criticalCount > 1 ? 's' : ''} in ${topSubject} detected. Start with "${chains[0].root_cause}" to unlock the path.`
    : `Foundation for ${careerTitle} is developing — ${chains.length} gap${chains.length > 1 ? 's' : ''} in ${topSubject} to address.`

  return { chains, has_gaps: true, readiness_language }
}

/**
 * Derives relevant capability dimensions' subject gap chains.
 * Used when we have capability requirements but not explicit required_subjects.
 */
export function buildCapabilityReadinessChains(
  careerTitle:   string,
  capabilities:  Record<string, { minimum: number; weight: number }>,
  rootCauses:    RootCauseResult[]
): CareerReadinessReport {
  // Build an inferred required_subjects list from capability → subject mapping
  const inferredSubjects: string[] = []
  for (const [dim, req] of Object.entries(capabilities)) {
    if (req.weight >= 0.15) {  // only dimensions that matter (high weight)
      const subjects = CAPABILITY_SUBJECT_MAP[dim] ?? []
      inferredSubjects.push(...subjects)
    }
  }

  return buildCareerReadinessChains(careerTitle, inferredSubjects, rootCauses)
}
