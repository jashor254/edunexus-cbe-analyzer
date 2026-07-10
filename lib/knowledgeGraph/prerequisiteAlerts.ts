// lib/knowledgeGraph/prerequisiteAlerts.ts
// Single shared implementation of "which students are missing a prerequisite
// for this upcoming lesson substrand" — used by both the Monday Panel
// (Layer 3) and the Prerequisite Readiness route. Previously each had its
// own copy; Monday Panel's copy joined knowledge_edges.dependent_node_id
// (a text node_id code, e.g. "G9-MAT-NUM-T01") against knowledge_nodes.id
// (a uuid), so the join always returned zero rows and prerequisite alerts
// silently never fired there. This function uses the corrected join (already
// proven in the Prerequisite Readiness route and lib/attentionFeed/prerequisiteGaps.ts)
// so both consumers now produce identical results from the same learner data.

import { createServiceClient } from '@/utils/supabase/service'
import type { getClassLearnerProfiles } from '@/lib/learnerModel/queries'
import type { PrerequisiteAlert } from '@/lib/learnerModel/types'
import { PREREQUISITE_MISSING_LEVEL_THRESHOLD as MISSING_THRESHOLD, PREREQUISITE_PCT_ALERT_THRESHOLD as PCT_ALERT_THRESHOLD } from './types'

export async function findPrerequisiteAlerts(
  db:        ReturnType<typeof createServiceClient>,
  profiles:  Awaited<ReturnType<typeof getClassLearnerProfiles>>,
  nameMap:   Map<string, string>,
  subject:   string,
  subStrand: string,
): Promise<PrerequisiteAlert[]> {
  // Find the knowledge node for this substrand
  const { data: node } = await db
    .from('knowledge_nodes')
    .select('id, node_id, name, strand, remediation, weak_mastery_signs')
    .eq('subject', subject.toLowerCase())
    .or(`name.ilike.%${subStrand}%,strand.ilike.%${subStrand}%`)
    .limit(1)
    .maybeSingle()

  if (!node) return []

  // knowledge_edges references the human-readable node_id code, not
  // knowledge_nodes.id — this is the join that was previously broken here.
  const { data: edges } = await db
    .from('knowledge_edges')
    .select('prerequisite_node_id, weight')
    .eq('dependent_node_id', node.node_id as string)
    .order('weight', { ascending: false })
    .limit(3)

  if (!edges?.length) return []

  const prereqCodes = edges.map(e => e.prerequisite_node_id as string)
  const { data: prereqNodes } = await db
    .from('knowledge_nodes')
    .select('node_id, name, strand, remediation')
    .in('node_id', prereqCodes)

  const total  = profiles.length
  const alerts: PrerequisiteAlert[] = []

  for (const prereq of prereqNodes ?? []) {
    const prereqName   = prereq.name as string
    const prereqStrand = prereq.strand as string

    const affectedIds: string[] = []
    for (const profile of profiles) {
      const state = profile.knowledge_state
      const matchKey = Object.keys(state).find(k =>
        k.toLowerCase().includes(prereqName.toLowerCase()) ||
        k.toLowerCase().includes(prereqStrand.toLowerCase())
      )
      if (!matchKey || state[matchKey].level <= MISSING_THRESHOLD) {
        affectedIds.push(profile.student_id)
      }
    }

    const pctAffected = total > 0 ? affectedIds.length / total : 0
    if (pctAffected < PCT_ALERT_THRESHOLD) continue

    const studentNames = affectedIds
      .slice(0, 5)
      .map(id => nameMap.get(id)?.split(' ')[0] ?? id.slice(-4))

    const remediation = (prereq.remediation as string[] | null)?.[0]
      ?? `Review "${prereqName}" before proceeding`

    alerts.push({
      lesson_substrand:  subStrand,
      missing_prereq:    prereqName,
      students_affected: affectedIds.length,
      pct_affected:      Math.round(pctAffected * 100),
      suggested_warmup:  remediation,
      student_names:     studentNames,
    })
  }

  return alerts
}
