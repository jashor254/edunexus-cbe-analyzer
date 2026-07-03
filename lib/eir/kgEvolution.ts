// lib/eir/kgEvolution.ts
// Pillar 6 — Knowledge Graph Evolution
//
// Discovers improvements to the Education Knowledge Graph (EKG) by analysing
// patterns across many learners:
//
//   - Missing prerequisite links (students consistently fail B after passing A)
//   - Alternative learning paths (some students master B → C in a different order)
//   - Difficulty calibration (nodes rated too easy/hard relative to actual outcomes)
//   - Learning bottlenecks (substrand where disproportionate students get stuck)
//   - Concept clusters (substrands that are always learned together)
//   - Common confusion pairs (students who fail A also fail B at high correlation)

import { createServiceClient } from '@/utils/supabase/service'
import type { EIRKGDiscovery, KGDiscoveryType } from './types'

// ── Discover KG Improvements ──────────────────────────────────────────────────
// Run periodically against the full dataset — not per-student.

export async function discoverKGImprovements(
  minStudentCount: number = 5,
): Promise<EIRKGDiscovery[]> {
  const db = createServiceClient()

  const discoveries: Omit<EIRKGDiscovery, 'id' | 'created_at' | 'updated_at'>[] = []

  // ── 1. Learning Bottlenecks ────────────────────────────────────────────────
  // Substrands where 40%+ of students are stuck at level 1 or 2.
  const { data: knowledgeRows } = await db
    .from('learner_model_profiles')
    .select('knowledge_state, student_id')
    .not('knowledge_state', 'is', null)
    .limit(500)

  if (knowledgeRows?.length) {
    const substrandStats = new Map<string, {
      subject: string; substrand: string
      totalStudents: number; stuckStudents: number
    }>()

    for (const row of knowledgeRows) {
      const state = row.knowledge_state as Record<string, { level: number }> | null
      if (!state) continue

      for (const [key, mastery] of Object.entries(state)) {
        const parts = key.split(':')
        if (parts.length < 2) continue
        const subject   = parts[0]
        const substrand = parts.slice(1).join(':')

        const existing = substrandStats.get(key) ?? { subject, substrand, totalStudents: 0, stuckStudents: 0 }
        existing.totalStudents += 1
        if (mastery.level <= 2) existing.stuckStudents += 1
        substrandStats.set(key, existing)
      }
    }

    for (const [, stats] of substrandStats) {
      if (stats.totalStudents < minStudentCount) continue
      const stuckRate = stats.stuckStudents / stats.totalStudents
      if (stuckRate >= 0.4) {
        discoveries.push({
          discovery_type:          'learning_bottleneck',
          subject:                 stats.subject,
          substrand:               stats.substrand,
          related_substrand:       null,
          description:             `${Math.round(stuckRate * 100)}% of ${stats.totalStudents} students are stuck at mastery level 1–2 in "${stats.substrand}". This is a learning bottleneck.`,
          evidence_count:          stats.stuckStudents,
          supporting_student_count: stats.stuckStudents,
          confidence:              Math.min(0.9, stats.totalStudents / 30),
          status:                  'hypothesis',
          validated_at:            null,
          rejected_at:             null,
          rejection_reason:        null,
          proposed_change:         `Review difficulty calibration or prerequisite ordering for "${stats.substrand}". Consider adding a scaffold concept node.`,
          applied_at:              null,
          evidence:                {
            stuck_rate: stuckRate,
            sample_size: stats.totalStudents,
            stuck_count: stats.stuckStudents,
          },
        })
      }
    }
  }

  // ── 2. Common Confusion Pairs ──────────────────────────────────────────────
  // Two substrands that fail together at high correlation (Pearson r > 0.7)
  // Simplified: look for substrands that co-occur in confirmed_gaps lists.

  const { data: gapRows } = await db
    .from('learner_model_profiles')
    .select('confirmed_gaps, student_id')
    .not('confirmed_gaps', 'is', null)
    .limit(500)

  if (gapRows?.length) {
    const pairCounts = new Map<string, number>()
    const pairEvidence = new Map<string, { a: string; b: string }>()

    for (const row of gapRows) {
      const gaps = row.confirmed_gaps as string[] | null
      if (!gaps || gaps.length < 2) continue

      for (let i = 0; i < gaps.length; i++) {
        for (let j = i + 1; j < gaps.length; j++) {
          const pair = [gaps[i], gaps[j]].sort().join('|||')
          pairCounts.set(pair, (pairCounts.get(pair) ?? 0) + 1)
          if (!pairEvidence.has(pair)) {
            pairEvidence.set(pair, { a: gaps[i], b: gaps[j] })
          }
        }
      }
    }

    for (const [pair, count] of pairCounts) {
      if (count < minStudentCount) continue
      const ev = pairEvidence.get(pair)
      if (!ev) continue

      discoveries.push({
        discovery_type:          'common_confusion_pair',
        subject:                 'Cross-subject',
        substrand:               ev.a,
        related_substrand:       ev.b,
        description:             `"${ev.a}" and "${ev.b}" fail together in ${count} students. These concepts may share a common root misconception or missing prerequisite.`,
        evidence_count:          count,
        supporting_student_count: count,
        confidence:              Math.min(0.85, count / 20),
        status:                  'hypothesis',
        validated_at:            null,
        rejected_at:             null,
        rejection_reason:        null,
        proposed_change:         `Investigate whether "${ev.a}" and "${ev.b}" share a hidden prerequisite. Consider adding a shared prerequisite node in the KG.`,
        applied_at:              null,
        evidence:                { co_failure_count: count },
      })
    }
  }

  // ── Persist new discoveries (skip if already exists) ──────────────────────
  const now = new Date().toISOString()
  const persisted: EIRKGDiscovery[] = []

  for (const disc of discoveries.slice(0, 20)) {   // cap at 20 per run
    // Check for existing discovery of same type + substrand
    const { data: existing } = await db
      .from('eir_kg_discoveries')
      .select('id, evidence_count, supporting_student_count')
      .eq('discovery_type', disc.discovery_type)
      .eq('substrand', disc.substrand)
      .eq('related_substrand', disc.related_substrand ?? '')
      .eq('status', 'hypothesis')
      .limit(1)
      .single()

    if (existing) {
      // Update evidence count
      await db
        .from('eir_kg_discoveries')
        .update({
          evidence_count:           existing.evidence_count + disc.evidence_count,
          supporting_student_count: disc.supporting_student_count,
          confidence:               disc.confidence,
          updated_at:               now,
        })
        .eq('id', existing.id)
    } else {
      const { data: inserted } = await db
        .from('eir_kg_discoveries')
        .insert({ ...disc, created_at: now, updated_at: now })
        .select()
        .single()
      if (inserted) persisted.push(inserted as EIRKGDiscovery)
    }
  }

  return persisted
}

// ── Validate a KG Discovery ───────────────────────────────────────────────────
// Admin/researcher marks a hypothesis as validated or rejected.

export async function validateKGDiscovery(
  discoveryId:     string,
  status:          'validated' | 'rejected',
  rejectionReason?: string,
): Promise<void> {
  const db  = createServiceClient()
  const now = new Date().toISOString()

  await db
    .from('eir_kg_discoveries')
    .update({
      status:           status,
      validated_at:     status === 'validated' ? now : null,
      rejected_at:      status === 'rejected'  ? now : null,
      rejection_reason: rejectionReason ?? null,
      updated_at:       now,
    })
    .eq('id', discoveryId)
}

// ── Get Open Discoveries ──────────────────────────────────────────────────────

export async function getOpenKGDiscoveries(
  subject?: string,
): Promise<EIRKGDiscovery[]> {
  const db = createServiceClient()

  let query = db
    .from('eir_kg_discoveries')
    .select(
      'id, discovery_type, subject, substrand, related_substrand, description, ' +
      'evidence_count, supporting_student_count, confidence, status, validated_at, ' +
      'rejected_at, rejection_reason, proposed_change, applied_at, evidence, created_at, updated_at'
    )
    .in('status', ['hypothesis', 'validating'])
    .order('confidence', { ascending: false })
    .limit(50)

  if (subject) {
    query = query.eq('subject', subject)
  }

  const { data } = await query
  return (data as unknown as EIRKGDiscovery[] | null) ?? []
}

// ── Mark Discovery Applied ────────────────────────────────────────────────────

export async function markKGDiscoveryApplied(discoveryId: string): Promise<void> {
  const db  = createServiceClient()
  const now = new Date().toISOString()

  await db
    .from('eir_kg_discoveries')
    .update({
      applied_at: now,
      status:     'validated',
      updated_at: now,
    })
    .eq('id', discoveryId)
}
