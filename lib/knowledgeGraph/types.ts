// lib/knowledgeGraph/types.ts

// Shared prerequisite-alert thresholds — used identically by
// lib/knowledgeGraph/prerequisiteAlerts.ts (one specific upcoming lesson)
// and lib/attentionFeed/prerequisiteGaps.ts (a whole-class scan). Different
// questions, same threshold values — previously two independently
// maintained copies of the same two numbers.
export const PREREQUISITE_MISSING_LEVEL_THRESHOLD = 2      // level <= 2 (BE or AE) counts as missing
export const PREREQUISITE_PCT_ALERT_THRESHOLD      = 0.20  // only surface once >= 20% of the class is affected

export type NodeType       = 'topic' | 'concept'
export type ImportanceLevel = 'Critical' | 'Important' | 'Supporting'
export type DependencyType  = 'hard' | 'soft' | 'cross_subject'
export type CauseType       = 'root' | 'surface' | 'unassessed'

export type KnowledgeNode = {
  id:                string
  node_id:           string
  node_type:         NodeType
  subject:           string
  grade:             number
  level:             'Junior' | 'Senior'
  strand:            string
  name:              string
  core_concepts:     string[]
  importance:        ImportanceLevel
  misconceptions:    string[]
  weak_mastery_signs: string[]
  remediation:       string[]
  career_relevance:  string[]
  parent_node_id:    string | null
}

export type KnowledgeEdge = {
  id:                   string
  prerequisite_node_id: string
  dependent_node_id:    string
  dependency_type:      DependencyType
  weight:               number
  cross_grade:          boolean
  notes:                string | null
}

// The student's current performance on each node (1–4 CBC levels)
export type StudentNodeData = Record<string, number> // node_id → rating

// One identified root cause returned by the traversal engine
export type RootCause = {
  node_id:     string
  name:        string
  strand:      string
  importance:  ImportanceLevel
  performance: number | null   // null when unassessed
  gap:         number          // 3 - performance (0 when mastered or surface)
  depth:       number          // hops back from the failing topic
  cause_type:  CauseType
  edge_weight: number
  // What the teacher/Compass should do about this
  top_misconception:    string | null
  top_remediation:      string | null
  weak_mastery_signs:   string[]
}

// Full output of findRootCauses
export type RootCauseResult = {
  failing_topic:      string   // node_id
  failing_topic_name: string
  subject:            string   // e.g. 'mathematics', 'integrated_science', 'biology'
  performance:        number
  root_causes:        RootCause[]
  intervention_chains: string[]  // human-readable chains, e.g. "Fractions → Proportional Reasoning → Trigonometry"
}
