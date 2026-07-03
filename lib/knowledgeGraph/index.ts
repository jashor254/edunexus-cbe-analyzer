// lib/knowledgeGraph/index.ts
// Public API for the CBC Knowledge Dependency Graph.
// All callers import from here — never directly from traversal.ts or queries.ts.

export type {
  KnowledgeNode,
  KnowledgeEdge,
  StudentNodeData,
  RootCause,
  RootCauseResult,
  ImportanceLevel,
  DependencyType,
  CauseType,
} from './types'

export {
  findRootCauses,
  findAllRootCauses,
} from './traversal'

export {
  buildStudentNodeData,
  getNodesForSubjectGrade,
  getNodeById,
  getNodesByIds,
} from './queries'

export {
  buildCareerReadinessChains,
  buildCapabilityReadinessChains,
} from './careerReadiness'
export type { CareerReadinessChain, CareerReadinessReport } from './careerReadiness'

// ── High-level helper used by Academic Clinic ──────────────────────────────────
// Takes a student's grade + strand_assessments and returns root causes for every
// weak subject topic in one call. This is the function the clinic calls.

import { buildStudentNodeData } from './queries'
import { findAllRootCauses }    from './traversal'
import type { RootCauseResult } from './types'

// Analyses ALL subjects for the given grade — strand_assessments covers every subject
export async function analyseStudentRootCauses(
  studentId: string,
  grade:     number
): Promise<RootCauseResult[]> {
  // Build the student's performance map from strand_assessments (all subjects at this grade)
  const studentData = await buildStudentNodeData(studentId, grade)

  if (Object.keys(studentData).length === 0) return []

  // Find all nodes where student is below threshold (rating < 3)
  const weakNodeIds = Object.entries(studentData)
    .filter(([, rating]) => rating < 3)
    .map(([nodeId]) => nodeId)

  if (weakNodeIds.length === 0) return []

  return findAllRootCauses(weakNodeIds, studentData)
}
