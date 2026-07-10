import { createServiceClient } from '@/utils/supabase/service'
import { getClassLearnerProfiles } from '@/lib/learnerModel/queries'
import type { PrerequisiteAlert } from '@/lib/learnerModel/types'
import { PREREQUISITE_MISSING_LEVEL_THRESHOLD as MISSING_THRESHOLD, PREREQUISITE_PCT_ALERT_THRESHOLD as PCT_ALERT_THRESHOLD } from '@/lib/knowledgeGraph/types'

// Computed live from knowledge_state — no dependency on a cached panel that
// only exists once someone has opened the Monday-panel screen. Only surfaces
// a gap when the class already has real data for BOTH the dependent topic
// and its prerequisite — i.e. topics actually being taught, not a
// hypothetical scan of the whole curriculum.
export async function computeClassPrerequisiteGaps(classId: string): Promise<PrerequisiteAlert[]> {
  const db       = createServiceClient()
  const profiles = await getClassLearnerProfiles(classId)
  const total    = profiles.length
  if (total === 0) return []

  const substrandKeys = new Set<string>()
  for (const p of profiles) {
    for (const key of Object.keys(p.knowledge_state)) substrandKeys.add(key)
  }
  if (substrandKeys.size === 0) return []

  const substrandNames = [...substrandKeys]
    .map((key) => key.split(':')[1])
    .filter((name): name is string => Boolean(name))

  const { data: nodes } = await db
    .from('knowledge_nodes')
    .select('node_id, name, remediation')

  if (!nodes?.length) return []

  // knowledge_edges references the human-readable node_id code (e.g.
  // "G9-MAT-NUM-T01"), not knowledge_nodes.id — mixing the two means this
  // query silently returns nothing (the bug present in the production
  // prerequisite-readiness route).
  const matchedNodeCodes = new Set(
    nodes
      .filter((n) => substrandNames.some((name) => (n.name as string).toLowerCase() === name.toLowerCase()))
      .map((n) => n.node_id as string),
  )
  if (matchedNodeCodes.size === 0) return []

  const { data: edges } = await db
    .from('knowledge_edges')
    .select('prerequisite_node_id, dependent_node_id')
    .in('dependent_node_id', [...matchedNodeCodes])

  if (!edges?.length) return []

  const nodeByCode = new Map(nodes.map((n) => [n.node_id as string, n]))
  const alerts: PrerequisiteAlert[] = []

  for (const edge of edges) {
    const dependentNode = nodeByCode.get(edge.dependent_node_id as string)
    const prereqNode    = nodeByCode.get(edge.prerequisite_node_id as string)
    if (!dependentNode || !prereqNode) continue

    const prereqKeys = [...substrandKeys].filter(
      (k) => (k.split(':')[1] ?? '').toLowerCase() === (prereqNode.name as string).toLowerCase(),
    )
    if (prereqKeys.length === 0) continue // class has no real data for this prerequisite yet

    const missingIds: string[] = []
    for (const p of profiles) {
      const entry = prereqKeys.map((k) => p.knowledge_state[k]).find(Boolean)
      if (!entry || entry.level <= MISSING_THRESHOLD) missingIds.push(p.student_id)
    }

    const pctAffected = missingIds.length / total
    if (pctAffected < PCT_ALERT_THRESHOLD) continue

    alerts.push({
      lesson_substrand:  dependentNode.name as string,
      missing_prereq:    prereqNode.name as string,
      students_affected: missingIds.length,
      pct_affected:      Math.round(pctAffected * 100),
      suggested_warmup:  (prereqNode.remediation as string[] | null)?.[0]
        ?? `Review "${prereqNode.name as string}" with the class before continuing`,
      student_names:     [],
    })
  }

  return alerts
}
