// lib/knowledgeGraph/queries.ts
// All DB access for the knowledge graph — delegated to the repository layer.

import { repos } from '@/lib/repositories'
import type { KnowledgeNode, KnowledgeEdge, StudentNodeData } from './types'

// Returns all prerequisite edges for a given dependent node
export async function getPrerequisiteEdges(
  dependentNodeId: string
): Promise<KnowledgeEdge[]> {
  return repos.knowledgeGraph.getPrerequisiteEdges(dependentNodeId)
}

// Returns a single node by its node_id
export async function getNodeById(
  nodeId: string
): Promise<KnowledgeNode | null> {
  return repos.knowledgeGraph.getNodeById(nodeId)
}

// Returns multiple nodes by their node_ids in one query
export async function getNodesByIds(
  nodeIds: string[]
): Promise<KnowledgeNode[]> {
  return repos.knowledgeGraph.getNodesByIds(nodeIds)
}

// Builds a StudentNodeData map from strand_assessments for a given student + grade.
// The grade must be passed in because strand_assessments has no grade column.
export async function buildStudentNodeData(
  studentId: string,
  grade: number
): Promise<StudentNodeData> {
  return repos.knowledgeGraph.buildStudentNodeData(studentId, grade)
}

// Returns all nodes for a given subject + grade (useful for building the full graph view)
export async function getNodesForSubjectGrade(
  subject: string,
  grade: number
): Promise<KnowledgeNode[]> {
  return repos.knowledgeGraph.getNodesForSubjectGrade(subject, grade)
}

// Returns every edge whose prerequisite lives in this subject + grade — the
// full forward-traversable edge set, fetched once for in-memory traversal.
export async function getEdgesForSubjectGrade(
  subject: string,
  grade: number
): Promise<KnowledgeEdge[]> {
  return repos.knowledgeGraph.getEdgesForSubjectGrade(subject, grade)
}
