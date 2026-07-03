// lib/eir/knowledgeBase.ts
// Pillar 10 — Educational Knowledge Base
//
// The structured repository of EduNexus educational research:
//
//   Hypotheses — proposed patterns waiting to be validated
//   Findings   — validated, evidence-backed discoveries
//
// This is the institutional memory of EIR: every pattern discovered,
// tested, and confirmed or rejected is recorded here permanently.

import { createServiceClient } from '@/utils/supabase/service'
import type {
  EIRHypothesis,
  EIRFinding,
  KnowledgeBaseReport,
  ResearchPillar,
  EvidenceStrength,
} from './types'

// ── Hypothesis Operations ─────────────────────────────────────────────────────

export async function proposeHypothesis(params: {
  pillar:       ResearchPillar
  title:        string
  description:  string
  proposedBy?:  EIRHypothesis['proposed_by']
  evidence?:    Record<string, unknown>[]
  tags?:        string[]
}): Promise<EIRHypothesis> {
  const db  = createServiceClient()
  const now = new Date().toISOString()

  const { data } = await db
    .from('eir_hypotheses')
    .insert({
      pillar:              params.pillar,
      title:               params.title,
      description:         params.description,
      status:              'proposed',
      evidence_count:      params.evidence?.length ?? 0,
      proposed_by:         params.proposedBy ?? 'system',
      proposed_at:         now,
      supporting_evidence: params.evidence ?? [],
      counter_evidence:    [],
      tags:                params.tags ?? [],
      created_at:          now,
      updated_at:          now,
    })
    .select()
    .single()

  if (!data) throw new Error('Failed to propose hypothesis')
  return data as EIRHypothesis
}

export async function startTestingHypothesis(hypothesisId: string): Promise<void> {
  const db  = createServiceClient()
  const now = new Date().toISOString()

  await db
    .from('eir_hypotheses')
    .update({ status: 'testing', testing_since: now, updated_at: now })
    .eq('id', hypothesisId)
}

export async function addEvidenceToHypothesis(
  hypothesisId: string,
  evidence:     Record<string, unknown>,
  supports:     boolean,
): Promise<void> {
  const db = createServiceClient()

  const { data: existing } = await db
    .from('eir_hypotheses')
    .select('supporting_evidence, counter_evidence, evidence_count')
    .eq('id', hypothesisId)
    .single()

  if (!existing) return

  const field = supports ? 'supporting_evidence' : 'counter_evidence'
  const current = (existing[field] as Record<string, unknown>[]) ?? []
  current.push({ ...evidence, recorded_at: new Date().toISOString() })

  await db
    .from('eir_hypotheses')
    .update({
      [field]:        current,
      evidence_count: (existing.evidence_count as number) + 1,
      updated_at:     new Date().toISOString(),
    })
    .eq('id', hypothesisId)
}

export async function validateHypothesis(
  hypothesisId: string,
): Promise<EIRFinding> {
  const db  = createServiceClient()
  const now = new Date().toISOString()

  const { data: hypothesis } = await db
    .from('eir_hypotheses')
    .select('id, pillar, title, description, supporting_evidence, evidence_count')
    .eq('id', hypothesisId)
    .single()

  if (!hypothesis) throw new Error('Hypothesis not found')

  await db
    .from('eir_hypotheses')
    .update({ status: 'validated', validated_at: now, updated_at: now })
    .eq('id', hypothesisId)

  const evidenceCount    = hypothesis.evidence_count as number
  const evidenceStrength = computeEvidenceStrength(evidenceCount)

  return publishFinding({
    hypothesisId,
    pillar:        hypothesis.pillar as ResearchPillar,
    title:         hypothesis.title as string,
    summary:       hypothesis.description as string,
    confidence:    Math.min(0.95, 0.5 + evidenceCount * 0.02),
    evidenceStrength,
    sampleSize:    evidenceCount,
    findingData:   { supporting_evidence: hypothesis.supporting_evidence },
  })
}

export async function rejectHypothesis(
  hypothesisId:   string,
  rejectionReason: string,
): Promise<void> {
  const db  = createServiceClient()
  const now = new Date().toISOString()

  await db
    .from('eir_hypotheses')
    .update({
      status:           'rejected',
      rejected_at:      now,
      rejection_reason: rejectionReason,
      updated_at:       now,
    })
    .eq('id', hypothesisId)
}

// ── Finding Operations ────────────────────────────────────────────────────────

export async function publishFinding(params: {
  hypothesisId?:       string
  pillar:              ResearchPillar
  title:               string
  summary:             string
  detail?:             string
  confidence?:         number
  evidenceStrength?:   EvidenceStrength
  sampleSize?:         number
  appliesToSubjects?:  string[]
  appliesToGrades?:    number[]
  appliesToCurricula?: string[]
  findingData?:        Record<string, unknown>
  actionRecommendation?: string
}): Promise<EIRFinding> {
  const db  = createServiceClient()
  const now = new Date().toISOString()

  const { data } = await db
    .from('eir_findings')
    .insert({
      hypothesis_id:         params.hypothesisId ?? null,
      pillar:                params.pillar,
      title:                 params.title,
      summary:               params.summary,
      detail:                params.detail ?? null,
      confidence:            params.confidence ?? null,
      evidence_strength:     params.evidenceStrength ?? 'weak',
      sample_size:           params.sampleSize ?? null,
      applies_to_subjects:   params.appliesToSubjects ?? [],
      applies_to_grades:     params.appliesToGrades ?? [],
      applies_to_curricula:  params.appliesToCurricula ?? ['cbc'],
      finding_data:          params.findingData ?? {},
      action_recommendation: params.actionRecommendation ?? null,
      published_at:          now,
      last_verified_at:      now,
      created_at:            now,
      updated_at:            now,
    })
    .select()
    .single()

  if (!data) throw new Error('Failed to publish finding')
  return data as EIRFinding
}

export async function getFindings(params: {
  pillar?:  ResearchPillar
  subject?: string
  grade?:   number
  limit?:   number
}): Promise<EIRFinding[]> {
  const db = createServiceClient()

  let query = db
    .from('eir_findings')
    .select(
      'id, hypothesis_id, pillar, title, summary, detail, confidence, evidence_strength, ' +
      'sample_size, applies_to_subjects, applies_to_grades, applies_to_curricula, ' +
      'finding_data, action_recommendation, published_at, last_verified_at, created_at, updated_at'
    )
    .order('confidence', { ascending: false })
    .limit(params.limit ?? 20)

  if (params.pillar) query = query.eq('pillar', params.pillar)
  if (params.subject) query = query.contains('applies_to_subjects', [params.subject])
  if (params.grade)   query = query.contains('applies_to_grades', [params.grade])

  const { data } = await query
  return (data as unknown as EIRFinding[] | null) ?? []
}

// ── Knowledge Base Report ─────────────────────────────────────────────────────

export async function buildKnowledgeBaseReport(): Promise<KnowledgeBaseReport> {
  const db = createServiceClient()

  const [hypothesesResult, findingsResult] = await Promise.all([
    db
      .from('eir_hypotheses')
      .select('id, pillar, title, status, evidence_count, proposed_at, proposed_by, tags, created_at, updated_at, description, testing_since, validated_at, rejected_at, rejection_reason, supporting_evidence, counter_evidence')
      .order('proposed_at', { ascending: false })
      .limit(100),
    db
      .from('eir_findings')
      .select('id, hypothesis_id, pillar, title, summary, detail, confidence, evidence_strength, sample_size, applies_to_subjects, applies_to_grades, applies_to_curricula, finding_data, action_recommendation, published_at, last_verified_at, created_at, updated_at')
      .order('confidence', { ascending: false })
      .limit(100),
  ])

  const hypotheses = (hypothesesResult.data ?? []) as EIRHypothesis[]
  const findings   = (findingsResult.data  ?? []) as EIRFinding[]

  const pillars: ResearchPillar[] = [
    'misconception', 'trajectory', 'intervention', 'personalization',
    'career', 'kg_evolution', 'risk', 'explainability', 'validation', 'general',
  ]

  const byPillar: KnowledgeBaseReport['by_pillar'] = {} as KnowledgeBaseReport['by_pillar']
  for (const pillar of pillars) {
    byPillar[pillar] = {
      hypotheses: hypotheses.filter(h => h.pillar === pillar).length,
      findings:   findings.filter(f => f.pillar === pillar).length,
    }
  }

  const openHypotheses = hypotheses.filter(h => h.status === 'proposed' || h.status === 'testing')
  const topFindings    = [...findings]
    .sort((a, b) => {
      const strengthOrder = { very_strong: 4, strong: 3, moderate: 2, weak: 1 }
      const aScore = (strengthOrder[a.evidence_strength] ?? 0) + (a.confidence ?? 0)
      const bScore = (strengthOrder[b.evidence_strength] ?? 0) + (b.confidence ?? 0)
      return bScore - aScore
    })
    .slice(0, 5)

  return {
    total_hypotheses: hypotheses.length,
    total_findings:   findings.length,
    by_pillar:        byPillar,
    recent_findings:  findings.slice(0, 5),
    top_findings:     topFindings,
    open_hypotheses:  openHypotheses.slice(0, 10),
    generated_at:     new Date().toISOString(),
  }
}

// ── Auto-Propose Hypotheses From Evidence ────────────────────────────────────
// Called by the engine when a discovery or pattern is found — automatically
// creates a hypothesis if one doesn't already exist.

export async function autoProposeHypothesis(params: {
  pillar:       ResearchPillar
  title:        string
  description:  string
  evidence:     Record<string, unknown>
}): Promise<void> {
  const db = createServiceClient()

  // Don't create duplicates
  const { data: existing } = await db
    .from('eir_hypotheses')
    .select('id')
    .eq('title', params.title)
    .limit(1)
    .single()

  if (existing) {
    // Just add evidence to the existing hypothesis
    await addEvidenceToHypothesis(existing.id as string, params.evidence, true)
    return
  }

  await proposeHypothesis({
    pillar:       params.pillar,
    title:        params.title,
    description:  params.description,
    evidence:     [params.evidence],
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeEvidenceStrength(evidenceCount: number): EvidenceStrength {
  if (evidenceCount >= 50) return 'very_strong'
  if (evidenceCount >= 20) return 'strong'
  if (evidenceCount >= 5)  return 'moderate'
  return 'weak'
}
