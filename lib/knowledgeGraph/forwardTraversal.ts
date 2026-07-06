// lib/knowledgeGraph/forwardTraversal.ts
// Pure, DB-free forward graph traversal (prerequisite -> dependents). No AI.
//
// Everything else in lib/knowledgeGraph/traversal.ts walks BACKWARD (a failing
// topic -> its prerequisites, via getPrerequisiteEdges). Computing blast radius
// needs the opposite direction: given a weak topic, how much downstream work
// does fixing it unblock? This module builds an in-memory adjacency map over
// an edge set already fetched from the DB (getEdgesForSubjectGrade) and walks
// forward from there — no additional queries, no per-node DB round trips.

import type { KnowledgeEdge } from './types'

/**
 * Returns every node transitively unlocked by `nodeId` (nodeId's downstream
 * descendants via prerequisite_node_id -> dependent_node_id), excluding
 * nodeId itself. Visited-set traversal — safe even if the edge set somehow
 * contained a cycle (it would simply never revisit a node, not loop forever).
 */
export function transitiveDependents(edges: KnowledgeEdge[], nodeId: string): Set<string> {
  const adjacency = new Map<string, string[]>()
  for (const edge of edges) {
    const list = adjacency.get(edge.prerequisite_node_id) ?? []
    list.push(edge.dependent_node_id)
    adjacency.set(edge.prerequisite_node_id, list)
  }

  const visited = new Set<string>()
  const stack = [...(adjacency.get(nodeId) ?? [])]

  while (stack.length > 0) {
    const next = stack.pop()!
    if (visited.has(next)) continue
    visited.add(next)
    stack.push(...(adjacency.get(next) ?? []))
  }

  return visited
}

/** Direct (one-hop) dependents of nodeId — used to report hard-vs-soft counts. */
export function directDependentEdges(edges: KnowledgeEdge[], nodeId: string): KnowledgeEdge[] {
  return edges.filter(e => e.prerequisite_node_id === nodeId)
}
