-- Discovered by H1D-2 DEEP smoke (evidenceDomain.integration.test.ts) via
-- PostgREST's schema cache. Live in production, absent from every tracked
-- migration / loose file that creates learner_evidence locally.

ALTER TABLE learner_evidence
  ADD COLUMN IF NOT EXISTS strand text,
  ADD COLUMN IF NOT EXISTS sub_strand text,
  ADD COLUMN IF NOT EXISTS knowledge_node_id uuid;
