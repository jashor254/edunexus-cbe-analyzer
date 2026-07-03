// lib/repositories/knowledge-graph.repository.ts
// All DB access for the knowledge graph domain.
// Note: the original queries.ts passed `db` as a parameter to every function.
// This repository uses `this.db` instead — callers no longer pass a client.

import { BaseRepository } from './base'
import type { KnowledgeNode, KnowledgeEdge, StudentNodeData } from '@/lib/knowledgeGraph/types'

// ── Column constants ───────────────────────────────────────────────────────────

const NODE_COLS =
  'id, node_id, node_type, subject, grade, level, strand, name, core_concepts, importance, misconceptions, weak_mastery_signs, remediation, career_relevance, parent_node_id'

const EDGE_COLS =
  'id, prerequisite_node_id, dependent_node_id, dependency_type, weight, cross_grade, notes'

export class KnowledgeGraphRepository extends BaseRepository {
  // ── Edges ─────────────────────────────────────────────────────────────────────

  /** Returns all prerequisite edges for a given dependent node, ordered by weight desc. */
  async getPrerequisiteEdges(dependentNodeId: string): Promise<KnowledgeEdge[]> {
    const { data, error } = await this.db
      .from('knowledge_edges')
      .select(EDGE_COLS)
      .eq('dependent_node_id', dependentNodeId)
      .order('weight', { ascending: false })

    if (error) throw new Error(`knowledge_edges query failed: ${error.message}`)
    return (data ?? []) as KnowledgeEdge[]
  }

  async getEdgesByDependentNodeIds(
    dependentNodeIds: string[],
  ): Promise<KnowledgeEdge[]> {
    if (dependentNodeIds.length === 0) return []
    const { data, error } = await this.db
      .from('knowledge_edges')
      .select(EDGE_COLS)
      .in('dependent_node_id', dependentNodeIds)

    if (error) throw new Error(`knowledge_edges batch query failed: ${error.message}`)
    return (data ?? []) as KnowledgeEdge[]
  }

  // ── Nodes ─────────────────────────────────────────────────────────────────────

  /** Returns a single node by its node_id (the domain identifier, not the uuid). */
  async getNodeById(nodeId: string): Promise<KnowledgeNode | null> {
    const { data, error } = await this.db
      .from('knowledge_nodes')
      .select(NODE_COLS)
      .eq('node_id', nodeId)
      .single()

    if (error) return null
    return data as KnowledgeNode
  }

  /** Returns multiple nodes by their node_ids in one query. */
  async getNodesByIds(nodeIds: string[]): Promise<KnowledgeNode[]> {
    if (nodeIds.length === 0) return []

    const { data, error } = await this.db
      .from('knowledge_nodes')
      .select(NODE_COLS)
      .in('node_id', nodeIds)

    if (error) throw new Error(`knowledge_nodes batch query failed: ${error.message}`)
    return (data ?? []) as KnowledgeNode[]
  }

  /** Returns multiple nodes by their uuid primary keys. */
  async getNodesByPkIds(pkIds: string[]): Promise<KnowledgeNode[]> {
    if (pkIds.length === 0) return []

    const { data, error } = await this.db
      .from('knowledge_nodes')
      .select(NODE_COLS)
      .in('id', pkIds)

    if (error) throw new Error(`knowledge_nodes pk batch query failed: ${error.message}`)
    return (data ?? []) as KnowledgeNode[]
  }

  /** Returns nodes by concept names (used for prerequisite gap checks). */
  async getNodesByConcepts(concepts: string[]): Promise<Array<{ id: string; concept: string }>> {
    if (concepts.length === 0) return []
    const { data } = await this.db
      .from('knowledge_nodes')
      .select('id, concept')
      .in('concept', concepts)
    return data ?? []
  }

  /** Returns all nodes for a given subject + grade (full graph view). */
  async getNodesForSubjectGrade(
    subject: string,
    grade: number,
  ): Promise<KnowledgeNode[]> {
    const { data, error } = await this.db
      .from('knowledge_nodes')
      .select(NODE_COLS)
      .eq('subject', subject)
      .eq('grade', grade)
      .order('strand')
      .order('node_id')

    if (error) throw new Error(`knowledge_nodes query failed: ${error.message}`)
    return (data ?? []) as KnowledgeNode[]
  }

  // ── Student node data (strand_assessments → node_assessment_map) ──────────────

  /**
   * Builds a StudentNodeData map from strand_assessments for a given student + grade.
   * Mirrors the original buildStudentNodeData() function — no business logic, pure DB.
   */
  async buildStudentNodeData(
    studentId: string,
    grade: number,
  ): Promise<StudentNodeData> {
    const { data: assessments, error: saError } = await this.db
      .from('strand_assessments')
      .select('subject, strand, topic, rating')
      .eq('student_id', studentId)

    if (saError) throw new Error(`strand_assessments query failed: ${saError.message}`)
    if (!assessments || assessments.length === 0) return {}

    const { data: mappings, error: mapError } = await this.db
      .from('node_assessment_map')
      .select('subject, strand, topic, node_id')
      .eq('grade', grade)

    if (mapError) throw new Error(`node_assessment_map query failed: ${mapError.message}`)
    if (!mappings || mappings.length === 0) return {}

    const mapLookup = new Map<string, string>()
    for (const m of mappings) {
      mapLookup.set(`${m.subject}|${m.strand}|${m.topic}`, m.node_id)
    }

    const nodeData: StudentNodeData = {}
    for (const a of assessments) {
      const key    = `${a.subject}|${a.strand}|${a.topic}`
      const nodeId = mapLookup.get(key)
      if (nodeId) {
        nodeData[nodeId] = a.rating
      }
    }

    return nodeData
  }

  // ── node_assessment_map ───────────────────────────────────────────────────────

  async getMappingsForGrade(
    grade: number,
  ): Promise<Array<{ subject: string; strand: string; topic: string; node_id: string }>> {
    const { data, error } = await this.db
      .from('node_assessment_map')
      .select('subject, strand, topic, node_id')
      .eq('grade', grade)

    if (error) throw new Error(`node_assessment_map query failed: ${error.message}`)
    return data ?? []
  }

  async findNodeByConceptLike(concept: string): Promise<{ id: string; concept: string } | null> {
    const { data, error } = await this.db
      .from('knowledge_nodes')
      .select('id, concept')
      .ilike('concept', `%${concept}%`)
      .maybeSingle()

    if (error) throw new Error(`Failed to find knowledge node: ${error.message}`)
    return data ? { id: data.id as string, concept: data.concept as string } : null
  }
}

export const knowledgeGraphRepository = new KnowledgeGraphRepository()
