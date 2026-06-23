// lib/knowledgeGraph/traversal.ts
// Pure graph traversal — no AI. Deterministic and explainable.

import { createServiceClient } from '@/utils/supabase/service'
import { getPrerequisiteEdges, getNodeById } from './queries'
import type {
  StudentNodeData,
  RootCause,
  RootCauseResult,
  KnowledgeNode,
  KnowledgeEdge,
} from './types'

type DB = ReturnType<typeof createServiceClient>

// Mastery threshold — a rating of 3 (Meeting Expectations) or above is considered mastered
const MASTERY_THRESHOLD = 3
const DEFAULT_MAX_DEPTH  = 4

// Cache node + edge data within a single traversal call to avoid redundant DB queries
type TraversalCache = {
  nodes: Map<string, KnowledgeNode | null>
  edges: Map<string, KnowledgeEdge[]>
}

async function cachedGetNode(db: DB, nodeId: string, cache: TraversalCache): Promise<KnowledgeNode | null> {
  if (cache.nodes.has(nodeId)) return cache.nodes.get(nodeId) ?? null
  const node = await getNodeById(db, nodeId)
  cache.nodes.set(nodeId, node)
  return node
}

async function cachedGetEdges(db: DB, nodeId: string, cache: TraversalCache): Promise<KnowledgeEdge[]> {
  if (cache.edges.has(nodeId)) return cache.edges.get(nodeId)!
  const edges = await getPrerequisiteEdges(db, nodeId)
  cache.edges.set(nodeId, edges)
  return edges
}

// Core recursive traversal
async function traverse(
  db:          DB,
  nodeId:      string,
  studentData: StudentNodeData,
  depth:       number,
  maxDepth:    number,
  cache:       TraversalCache,
  visited:     Set<string>
): Promise<RootCause[]> {
  // Guard against cycles (shouldn't exist in a DAG but defensive programming)
  if (visited.has(nodeId)) return []
  visited.add(nodeId)

  const score = studentData[nodeId]

  // If this node is mastered, it is not a cause of any problem
  if (score !== undefined && score >= MASTERY_THRESHOLD) return []

  // Get prerequisites of this node
  const edges = await cachedGetEdges(db, nodeId, cache)

  // No prerequisites — this node itself is a root cause
  if (edges.length === 0) {
    const node = await cachedGetNode(db, nodeId, cache)
    if (!node) return []
    return [buildRootCause(node, score ?? null, 'root', depth, 0.99)]
  }

  const results: RootCause[] = []

  for (const edge of edges) {
    const prereqId    = edge.prerequisite_node_id
    const prereqScore = studentData[prereqId]

    // Unassessed prerequisite — flag but don't recurse (no data to trace)
    if (prereqScore === undefined) {
      const prereqNode = await cachedGetNode(db, prereqId, cache)
      if (prereqNode) {
        results.push(buildRootCause(prereqNode, null, 'unassessed', depth + 1, edge.weight))
      }
      continue
    }

    if (prereqScore < MASTERY_THRESHOLD) {
      // Prerequisite is also weak — recurse deeper unless at max depth
      if (depth >= maxDepth) {
        const prereqNode = await cachedGetNode(db, prereqId, cache)
        if (prereqNode) {
          results.push(buildRootCause(prereqNode, prereqScore, 'root', depth + 1, edge.weight))
        }
      } else {
        const deeper = await traverse(db, prereqId, studentData, depth + 1, maxDepth, cache, new Set(visited))
        if (deeper.length === 0) {
          // No deeper causes found — this prerequisite IS a root cause
          const prereqNode = await cachedGetNode(db, prereqId, cache)
          if (prereqNode) {
            results.push(buildRootCause(prereqNode, prereqScore, 'root', depth + 1, edge.weight))
          }
        } else {
          results.push(...deeper)
        }
      }
    } else {
      // Student has this prerequisite mastered but still struggles with dependent.
      // This is a surface cause — the gap is at this level, not deeper.
      const prereqNode = await cachedGetNode(db, prereqId, cache)
      if (prereqNode) {
        results.push(buildRootCause(prereqNode, prereqScore, 'surface', depth + 1, edge.weight))
      }
    }
  }

  return results
}

function buildRootCause(
  node:        KnowledgeNode,
  performance: number | null,
  causeType:   RootCause['cause_type'],
  depth:       number,
  edgeWeight:  number
): RootCause {
  const gap = performance !== null && performance < MASTERY_THRESHOLD
    ? MASTERY_THRESHOLD - performance
    : 0

  return {
    node_id:           node.node_id,
    name:              node.name,
    strand:            node.strand,
    importance:        node.importance,
    performance,
    gap,
    depth,
    cause_type:        causeType,
    edge_weight:       edgeWeight,
    top_misconception: node.misconceptions[0] ?? null,
    top_remediation:   node.remediation[0] ?? null,
    weak_mastery_signs: node.weak_mastery_signs,
  }
}

function deduplicateAndRank(causes: RootCause[]): RootCause[] {
  // Keep one entry per node_id, preferring the one with the highest edge_weight
  const seen = new Map<string, RootCause>()
  for (const c of causes) {
    const existing = seen.get(c.node_id)
    if (!existing || c.edge_weight > existing.edge_weight) {
      seen.set(c.node_id, c)
    }
  }

  return Array.from(seen.values())
    // Root causes first, then surface, then unassessed
    .sort((a, b) => {
      const typeOrder = { root: 0, surface: 1, unassessed: 2 }
      const typeDiff  = typeOrder[a.cause_type] - typeOrder[b.cause_type]
      if (typeDiff !== 0) return typeDiff
      // Within same type: higher weight × gap first (most critical blocker)
      return (b.edge_weight * b.gap) - (a.edge_weight * a.gap)
    })
}

function buildInterventionChains(
  failingNodeName: string,
  rootCauses:      RootCause[]
): string[] {
  // Only emit chains for actual root causes, not surface or unassessed
  return rootCauses
    .filter(c => c.cause_type === 'root')
    .map(c => `${c.name} (Grade ${c.depth > 0 ? 'prerequisite' : 'current'}) → ${failingNodeName}`)
}

// ── Public function ────────────────────────────────────────────────────────────

export async function findRootCauses(
  db:          DB,
  failingNodeId: string,
  studentData: StudentNodeData,
  maxDepth:    number = DEFAULT_MAX_DEPTH
): Promise<RootCauseResult | null> {
  const cache: TraversalCache = {
    nodes: new Map(),
    edges: new Map(),
  }

  const failingNode = await cachedGetNode(db, failingNodeId, cache)
  if (!failingNode) return null

  const performance = studentData[failingNodeId] ?? null

  // If the student is already meeting expectations on this topic, nothing to report
  if (performance !== null && performance >= MASTERY_THRESHOLD) return null

  const rawCauses = await traverse(
    db,
    failingNodeId,
    studentData,
    0,
    maxDepth,
    cache,
    new Set<string>()
  )

  const rootCauses = deduplicateAndRank(rawCauses)

  return {
    failing_topic:       failingNodeId,
    failing_topic_name:  failingNode.name,
    subject:             failingNode.subject,
    performance:         performance ?? 0,
    root_causes:         rootCauses,
    intervention_chains: buildInterventionChains(failingNode.name, rootCauses),
  }
}

// Convenience: run findRootCauses across ALL weak topics for a student at once
export async function findAllRootCauses(
  db:            DB,
  weakNodeIds:   string[],    // node_ids where student rating < 3
  studentData:   StudentNodeData,
  maxDepth:      number = DEFAULT_MAX_DEPTH
): Promise<RootCauseResult[]> {
  const results = await Promise.all(
    weakNodeIds.map(nodeId => findRootCauses(db, nodeId, studentData, maxDepth))
  )
  return results.filter((r): r is RootCauseResult => r !== null)
}
