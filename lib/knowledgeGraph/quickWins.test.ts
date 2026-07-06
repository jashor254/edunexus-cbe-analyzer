// lib/knowledgeGraph/quickWins.test.ts
// Run with: npx tsx --test lib/knowledgeGraph/quickWins.test.ts
// Pure core only (rankQuickWins) — no DB, no network.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rankQuickWins } from './quickWins'
import type { KnowledgeNode, KnowledgeEdge, StudentNodeData } from './types'

function node(nodeId: string, name: string, strand = 'Numbers'): KnowledgeNode {
  return {
    id: nodeId, node_id: nodeId, node_type: 'topic', subject: 'mathematics', grade: 7,
    level: 'Junior', strand, name, core_concepts: [], importance: 'Critical',
    misconceptions: [], weak_mastery_signs: [], remediation: [], career_relevance: [],
    parent_node_id: null,
  }
}

function edge(prereq: string, dependent: string, type: 'hard' | 'soft', weight = 0.8): KnowledgeEdge {
  return { id: `${prereq}->${dependent}`, prerequisite_node_id: prereq, dependent_node_id: dependent, dependency_type: type, weight, cross_grade: false, notes: null }
}

test('a weak node with a hard-blocked dependent outranks one with only soft-blocked dependents, even with equal blast radius', () => {
  const nodes = [
    node('A', 'Topic A'), node('B', 'Topic B'),
    node('X', 'Downstream X'), node('Y', 'Downstream Y'),
  ]
  const edges = [
    edge('A', 'X', 'hard'),
    edge('B', 'Y', 'soft'),
  ]
  const studentData: StudentNodeData = { A: 1, B: 1, X: 1, Y: 1 } // both weak, both downstream unmastered

  const results = rankQuickWins(nodes, edges, studentData)
  assert.equal(results[0].nodeId, 'A')
  assert.equal(results[0].hardBlockedCount, 1)
  assert.equal(results[1].nodeId, 'B')
  assert.equal(results[1].hardBlockedCount, 0)
})

test('larger raw blast radius wins when hard-blocked counts are tied', () => {
  const nodes = [
    node('A', 'Topic A'), node('B', 'Topic B'),
    node('X1', 'X1'), node('X2', 'X2'), node('Y1', 'Y1'),
  ]
  const edges = [
    edge('A', 'X1', 'soft'), edge('A', 'X2', 'soft'),
    edge('B', 'Y1', 'soft'),
  ]
  const studentData: StudentNodeData = { A: 1, B: 1, X1: 1, X2: 1, Y1: 1 }

  const results = rankQuickWins(nodes, edges, studentData)
  assert.equal(results[0].nodeId, 'A')
  assert.equal(results[0].blastRadius, 2)
  assert.equal(results[1].nodeId, 'B')
  assert.equal(results[1].blastRadius, 1)
})

test('mastered nodes (rating >= 3) are never returned as quick wins', () => {
  const nodes = [node('A', 'Topic A'), node('B', 'Topic B')]
  const edges: KnowledgeEdge[] = []
  const studentData: StudentNodeData = { A: 3, B: 4 }

  assert.equal(rankQuickWins(nodes, edges, studentData).length, 0)
})

test('unassessed downstream nodes count as unmastered for blast radius', () => {
  const nodes = [node('A', 'Topic A'), node('X', 'Downstream X')]
  const edges = [edge('A', 'X', 'hard')]
  const studentData: StudentNodeData = { A: 1 } // X never assessed at all

  const [win] = rankQuickWins(nodes, edges, studentData)
  assert.equal(win.blastRadius, 1)
  assert.equal(win.hardBlockedCount, 1)
})

test('mastered downstream nodes do not count toward blast radius', () => {
  const nodes = [node('A', 'Topic A'), node('X', 'Downstream X')]
  const edges = [edge('A', 'X', 'hard')]
  const studentData: StudentNodeData = { A: 1, X: 4 } // X already mastered

  const [win] = rankQuickWins(nodes, edges, studentData)
  assert.equal(win.blastRadius, 0)
  assert.equal(win.hardBlockedCount, 0)
})

test('transitive (two-hop) unmastered descendants count toward blast radius', () => {
  const nodes = [node('A', 'Topic A'), node('X', 'X'), node('Y', 'Y')]
  const edges = [edge('A', 'X', 'hard'), edge('X', 'Y', 'soft')]
  const studentData: StudentNodeData = { A: 1, X: 1, Y: 1 }

  const [win] = rankQuickWins(nodes, edges, studentData)
  assert.equal(win.blastRadius, 2) // X and Y both unmastered descendants of A
})

test('reason string names unlocked topics and mentions hard-prerequisite count', () => {
  const nodes = [node('A', 'Fractions'), node('X', 'Decimals'), node('Y', 'Money')]
  const edges = [edge('A', 'X', 'hard'), edge('A', 'Y', 'soft')]
  const studentData: StudentNodeData = { A: 1, X: 1, Y: 1 }

  const [win] = rankQuickWins(nodes, edges, studentData)
  assert.match(win.reason, /Fix Fractions first/)
  assert.match(win.reason, /unblocks 2 later topics/)
  assert.match(win.reason, /Decimals/)
  assert.match(win.reason, /hard prerequisite for one of them/)
})

test('reason string handles zero blast radius gracefully', () => {
  const nodes = [node('A', 'Isolated Topic')]
  const edges: KnowledgeEdge[] = []
  const studentData: StudentNodeData = { A: 1 }

  const [win] = rankQuickWins(nodes, edges, studentData)
  assert.equal(win.blastRadius, 0)
  assert.match(win.reason, /no downstream topics depending on it yet/)
})

test('edges reaching outside the given node set (cross-subject or cross-grade) do not count toward blast radius', () => {
  // A is in scope. X is NOT in the `nodes` list passed in — simulates a real
  // knowledge_edges row where the dependent belongs to a different subject
  // or a cross_grade dependent, which getEdgesForSubjectGrade legitimately
  // returns (it only filters on the PREREQUISITE's subject+grade).
  const nodes = [node('A', 'Topic A')] // note: 'X' deliberately not included
  const edges = [edge('A', 'X', 'hard')]
  const studentData: StudentNodeData = { A: 1, X: 1 }

  const [win] = rankQuickWins(nodes, edges, studentData)
  assert.equal(win.blastRadius, 0)
  assert.equal(win.hardBlockedCount, 0)
  assert.deepEqual(win.unlockedTopicNames, [])
})

test('topN limits result count', () => {
  const nodes = ['A', 'B', 'C'].map(id => node(id, id))
  const edges: KnowledgeEdge[] = []
  const studentData: StudentNodeData = { A: 1, B: 1, C: 1 }

  assert.equal(rankQuickWins(nodes, edges, studentData, 2).length, 2)
})
