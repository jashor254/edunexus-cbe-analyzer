// lib/knowledgeGraph/queries.ts
// All DB access for the knowledge graph — service client only.

import { createServiceClient } from '@/utils/supabase/service'
import type { KnowledgeNode, KnowledgeEdge, StudentNodeData } from './types'

type DB = ReturnType<typeof createServiceClient>

// Returns all prerequisite edges for a given dependent node
export async function getPrerequisiteEdges(
  db: DB,
  dependentNodeId: string
): Promise<KnowledgeEdge[]> {
  const { data, error } = await db
    .from('knowledge_edges')
    .select('id, prerequisite_node_id, dependent_node_id, dependency_type, weight, cross_grade, notes')
    .eq('dependent_node_id', dependentNodeId)
    .order('weight', { ascending: false })

  if (error) throw new Error(`knowledge_edges query failed: ${error.message}`)
  return (data ?? []) as KnowledgeEdge[]
}

// Returns a single node by its node_id
export async function getNodeById(
  db: DB,
  nodeId: string
): Promise<KnowledgeNode | null> {
  const { data, error } = await db
    .from('knowledge_nodes')
    .select('id, node_id, node_type, subject, grade, level, strand, name, core_concepts, importance, misconceptions, weak_mastery_signs, remediation, career_relevance, parent_node_id')
    .eq('node_id', nodeId)
    .single()

  if (error) return null
  return data as KnowledgeNode
}

// Returns multiple nodes by their node_ids in one query
export async function getNodesByIds(
  db: DB,
  nodeIds: string[]
): Promise<KnowledgeNode[]> {
  if (nodeIds.length === 0) return []

  const { data, error } = await db
    .from('knowledge_nodes')
    .select('id, node_id, node_type, subject, grade, level, strand, name, core_concepts, importance, misconceptions, weak_mastery_signs, remediation, career_relevance, parent_node_id')
    .in('node_id', nodeIds)

  if (error) throw new Error(`knowledge_nodes batch query failed: ${error.message}`)
  return (data ?? []) as KnowledgeNode[]
}

// Builds a StudentNodeData map from strand_assessments for a given student + grade.
// The grade must be passed in because strand_assessments has no grade column.
export async function buildStudentNodeData(
  db: DB,
  studentId: string,
  grade: number
): Promise<StudentNodeData> {
  // Get all strand assessments for this student
  const { data: assessments, error: saError } = await db
    .from('strand_assessments')
    .select('subject, strand, topic, rating')
    .eq('student_id', studentId)

  if (saError) throw new Error(`strand_assessments query failed: ${saError.message}`)
  if (!assessments || assessments.length === 0) return {}

  // Get the node_id mapping for this subject + grade combination
  const { data: mappings, error: mapError } = await db
    .from('node_assessment_map')
    .select('subject, strand, topic, node_id')
    .eq('grade', grade)

  if (mapError) throw new Error(`node_assessment_map query failed: ${mapError.message}`)
  if (!mappings || mappings.length === 0) return {}

  // Build a lookup keyed by "subject|strand|topic"
  const mapLookup = new Map<string, string>()
  for (const m of mappings) {
    mapLookup.set(`${m.subject}|${m.strand}|${m.topic}`, m.node_id)
  }

  // Map each assessment rating to its node_id
  const nodeData: StudentNodeData = {}
  for (const a of assessments) {
    const key = `${a.subject}|${a.strand}|${a.topic}`
    const nodeId = mapLookup.get(key)
    if (nodeId) {
      // If the student has multiple assessments for the same topic, take the latest (highest id)
      // For now use rating directly — last write wins
      nodeData[nodeId] = a.rating
    }
  }

  return nodeData
}

// Returns all nodes for a given subject + grade (useful for building the full graph view)
export async function getNodesForSubjectGrade(
  db: DB,
  subject: string,
  grade: number
): Promise<KnowledgeNode[]> {
  const { data, error } = await db
    .from('knowledge_nodes')
    .select('id, node_id, node_type, subject, grade, level, strand, name, core_concepts, importance, misconceptions, weak_mastery_signs, remediation, career_relevance, parent_node_id')
    .eq('subject', subject)
    .eq('grade', grade)
    .order('strand')
    .order('node_id')

  if (error) throw new Error(`knowledge_nodes query failed: ${error.message}`)
  return (data ?? []) as KnowledgeNode[]
}
