// lib/knowledgeGraph/quickWins.ts
// Layer 2 — "what should this learner fix first" for a subject+grade that has
// a real knowledge graph (Grade 7 Mathematics today). Wraps the existing
// backward root-cause engine's data sources with a forward blast-radius
// ranking — it does not duplicate graph storage or re-fetch per node.
//
// Frontier logic: a weak topic that is a HARD prerequisite for at least one
// unmastered downstream topic is a hard stop — it outranks a weak topic whose
// downstream impact is only soft nudges, even if the soft-only topic has a
// larger raw blast radius. Blast radius is the volume signal; hard-blocking
// is the urgency signal, and urgency wins ties first.

import { getNodesForSubjectGrade, getEdgesForSubjectGrade, buildStudentNodeData } from './queries'
import { transitiveDependents } from './forwardTraversal'
import type { KnowledgeNode, KnowledgeEdge, StudentNodeData } from './types'

const MASTERY_THRESHOLD = 3

export type QuickWin = {
  nodeId:             string
  topicName:          string
  strand:             string
  rating:             number   // the learner's current rating on this weak topic (1-4)
  blastRadius:        number   // count of unmastered transitive descendants
  hardBlockedCount:   number   // direct unmastered dependents reached via a 'hard' edge
  softBlockedCount:   number   // direct unmastered dependents reached via a 'soft' edge
  unlockedTopicNames: string[] // sample of unmastered descendant names, for the reason string
  reason:             string
}

function isUnmastered(studentData: StudentNodeData, nodeId: string): boolean {
  const rating = studentData[nodeId]
  return rating === undefined || rating < MASTERY_THRESHOLD
}

function buildReason(
  topicName: string,
  blastRadius: number,
  hardBlockedCount: number,
  unlockedTopicNames: string[],
): string {
  if (blastRadius === 0) {
    return `Fix ${topicName} — it's currently weak with no downstream topics depending on it yet.`
  }

  const sample = unlockedTopicNames.slice(0, 3).join(', ')
  const suffix = unlockedTopicNames.length > 3 ? '...' : ''
  const topicWord = blastRadius === 1 ? 'topic' : 'topics'

  const base = `Fix ${topicName} first — unblocks ${blastRadius} later ${topicWord} (${sample}${suffix})`

  if (hardBlockedCount === 0) return `${base}.`

  const hardWord = hardBlockedCount === 1 ? 'one of them' : `${hardBlockedCount} of them`
  return `${base}, and it's a hard prerequisite for ${hardWord}.`
}

/**
 * Pure ranking core — takes already-fetched nodes/edges/studentData and
 * returns weak topics ranked by frontier logic. No DB, no I/O.
 */
export function rankQuickWins(
  nodes:       KnowledgeNode[],
  edges:       KnowledgeEdge[],
  studentData: StudentNodeData,
  topN:        number = 5,
): QuickWin[] {
  const nodesById = new Map(nodes.map(n => [n.node_id, n]))

  // getEdgesForSubjectGrade only filters on the PREREQUISITE's subject+grade —
  // a node's edges can legitimately reach a different subject (e.g. Whole
  // Numbers -> an Integrated Science node) or a cross_grade dependent (e.g.
  // Whole Numbers -> a Grade 8 Math node). Scope is "this subject+grade only,"
  // so any edge whose dependent falls outside the given `nodes` set is
  // dropped before traversal — otherwise blast radius silently counts topics
  // the caller never asked about, and their names can't even be resolved.
  const inScopeEdges = edges.filter(e => nodesById.has(e.prerequisite_node_id) && nodesById.has(e.dependent_node_id))

  const weakNodes = nodes.filter(n => {
    const rating = studentData[n.node_id]
    return rating !== undefined && rating < MASTERY_THRESHOLD
  })

  const quickWins: QuickWin[] = weakNodes.map(node => {
    const descendants = transitiveDependents(inScopeEdges, node.node_id)
    const unmasteredDescendants = [...descendants].filter(id => isUnmastered(studentData, id))

    const directEdges = inScopeEdges.filter(e => e.prerequisite_node_id === node.node_id)
    const hardBlockedCount = directEdges.filter(
      e => e.dependency_type === 'hard' && isUnmastered(studentData, e.dependent_node_id),
    ).length
    const softBlockedCount = directEdges.filter(
      e => e.dependency_type === 'soft' && isUnmastered(studentData, e.dependent_node_id),
    ).length

    const unlockedTopicNames = unmasteredDescendants
      .map(id => nodesById.get(id)?.name)
      .filter((name): name is string => Boolean(name))

    const blastRadius = unmasteredDescendants.length

    return {
      nodeId:      node.node_id,
      topicName:   node.name,
      strand:      node.strand,
      rating:      studentData[node.node_id],
      blastRadius,
      hardBlockedCount,
      softBlockedCount,
      unlockedTopicNames,
      reason: buildReason(node.name, blastRadius, hardBlockedCount, unlockedTopicNames),
    }
  })

  return quickWins
    .sort((a, b) =>
      (b.hardBlockedCount - a.hardBlockedCount) ||
      (b.blastRadius - a.blastRadius) ||
      (b.softBlockedCount - a.softBlockedCount) ||
      a.topicName.localeCompare(b.topicName),
    )
    .slice(0, topN)
}

/** Thin DB-fetching wrapper — fetches once, hands off to the pure ranking core. */
export async function computeQuickWins(
  learnerId: string,
  subject:   string = 'mathematics',
  grade:     number = 7,
  topN:      number = 5,
): Promise<QuickWin[]> {
  const [nodes, edges, studentData] = await Promise.all([
    getNodesForSubjectGrade(subject, grade),
    getEdgesForSubjectGrade(subject, grade),
    buildStudentNodeData(learnerId, grade),
  ])

  return rankQuickWins(nodes, edges, studentData, topN)
}
