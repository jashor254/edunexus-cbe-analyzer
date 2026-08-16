-- Recovered from production migration 20260622193526_knowledge_graph_phase1_grade7_math
-- (data-seed migration not in repo). DDL portion only (knowledge_nodes,
-- knowledge_edges, node_assessment_map) -- seed INSERTs intentionally
-- omitted, out of scope for structural/security parity.

CREATE TABLE IF NOT EXISTS knowledge_nodes (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id            text        UNIQUE NOT NULL,
  node_type          text        NOT NULL CHECK (node_type IN ('topic','concept')),
  subject            text        NOT NULL,
  grade              integer     NOT NULL CHECK (grade BETWEEN 1 AND 12),
  level              text        NOT NULL CHECK (level IN ('Junior','Senior')),
  strand             text        NOT NULL,
  name               text        NOT NULL,
  core_concepts      text[]      NOT NULL DEFAULT '{}',
  importance         text        NOT NULL CHECK (importance IN ('Critical','Important','Supporting')),
  misconceptions     text[]      NOT NULL DEFAULT '{}',
  weak_mastery_signs text[]      NOT NULL DEFAULT '{}',
  remediation        text[]      NOT NULL DEFAULT '{}',
  career_relevance   text[]      NOT NULL DEFAULT '{}',
  parent_node_id     text        REFERENCES knowledge_nodes(node_id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_edges (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  prerequisite_node_id text        NOT NULL REFERENCES knowledge_nodes(node_id),
  dependent_node_id    text        NOT NULL REFERENCES knowledge_nodes(node_id),
  dependency_type      text        NOT NULL CHECK (dependency_type IN ('hard','soft','cross_subject')),
  weight               numeric(3,2) NOT NULL CHECK (weight >= 0 AND weight <= 1),
  cross_grade          boolean     NOT NULL DEFAULT false,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prerequisite_node_id, dependent_node_id)
);

CREATE TABLE IF NOT EXISTS node_assessment_map (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject    text        NOT NULL,
  grade      integer     NOT NULL,
  strand     text        NOT NULL,
  topic      text        NOT NULL,
  node_id    text        NOT NULL REFERENCES knowledge_nodes(node_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject, grade, strand, topic)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_node_id    ON knowledge_nodes(node_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_subject_grade ON knowledge_nodes(subject, grade);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_prereq      ON knowledge_edges(prerequisite_node_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_dependent   ON knowledge_edges(dependent_node_id);
CREATE INDEX IF NOT EXISTS idx_node_assessment_map_lookup  ON node_assessment_map(subject, grade, strand, topic);

ALTER TABLE knowledge_nodes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_edges      ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_assessment_map  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_knowledge_nodes"
  ON knowledge_nodes FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_read_knowledge_edges"
  ON knowledge_edges FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_read_node_assessment_map"
  ON node_assessment_map FOR SELECT TO authenticated USING (true);

CREATE POLICY "service_all_knowledge_nodes"
  ON knowledge_nodes FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_knowledge_edges"
  ON knowledge_edges FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_node_assessment_map"
  ON node_assessment_map FOR ALL TO service_role USING (true) WITH CHECK (true);
