-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 11 — EDUCATION INTELLIGENCE RESEARCH (EIR) FOUNDATION
--
-- EIR is the scientific layer above EILS.  It does not replace EILS —
-- it studies every interaction EILS observes, discovers evidence-based
-- patterns, and feeds validated findings back to improve EILS decisions.
--
-- 10 tables, one per research pillar:
--   1.  eir_misconceptions           — Misconception Library
--   2.  eir_learning_trajectories    — Learning Trajectory Models
--   3.  eir_intervention_effectiveness — Intervention Effectiveness Database
--   4.  eir_personalization_models   — Personalization Models (per learner)
--   5.  eir_career_development       — Career Development Snapshots
--   6.  eir_kg_discoveries           — Knowledge Graph Evolution Insights
--   7.  eir_risk_predictions         — Early Risk Prediction Records
--   8.  eir_recommendation_outcomes  — Explainability + Validation Records
--   9.  eir_hypotheses               — Research Knowledge Base (hypotheses)
--  10.  eir_findings                 — Validated Research Findings
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. eir_misconceptions ────────────────────────────────────────────────────
-- Pillar 1: Misconception Discovery
-- One row per observed misconception instance.
-- Aggregated across students to build the Misconception Library.

CREATE TABLE IF NOT EXISTS eir_misconceptions (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id                uuid NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  school_id                 uuid REFERENCES schools(id) ON DELETE SET NULL,
  grade                     int  NOT NULL CHECK (grade BETWEEN 1 AND 12),
  subject                   text NOT NULL,
  substrand                 text NOT NULL,
  misconception_type        text NOT NULL,
  -- e.g. 'procedural_error', 'conceptual_confusion', 'prerequisite_gap',
  --      'overgeneralisation', 'incomplete_schema', 'notation_error'
  description               text NOT NULL,
  frequency_count           int  NOT NULL DEFAULT 1,
  first_seen_at             timestamptz NOT NULL,
  last_seen_at              timestamptz NOT NULL,
  resolved_at               timestamptz,
  root_cause                text,
  correction_strategy       text,
  correction_effectiveness  text CHECK (correction_effectiveness IN ('effective','partial','ineffective','untried')),
  evidence                  jsonb NOT NULL DEFAULT '{}',
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eir_misconceptions_student
  ON eir_misconceptions (student_id);
CREATE INDEX IF NOT EXISTS idx_eir_misconceptions_school_subject
  ON eir_misconceptions (school_id, subject, substrand);
CREATE INDEX IF NOT EXISTS idx_eir_misconceptions_grade_subject
  ON eir_misconceptions (grade, subject, substrand);
CREATE INDEX IF NOT EXISTS idx_eir_misconceptions_unresolved
  ON eir_misconceptions (student_id, resolved_at)
  WHERE resolved_at IS NULL;

ALTER TABLE eir_misconceptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY eir_misconceptions_service ON eir_misconceptions
  USING (auth.role() = 'service_role');

-- ── 2. eir_learning_trajectories ─────────────────────────────────────────────
-- Pillar 2: Learning Trajectory Models
-- One row per learner × subject × substrand, refreshed each analysis cycle.

CREATE TABLE IF NOT EXISTS eir_learning_trajectories (
  id                                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id                        uuid NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  subject                           text NOT NULL,
  substrand                         text NOT NULL,
  mastery_velocity                  float,   -- mastery levels gained per week (can be negative)
  plateau_detected_at               timestamptz,
  plateau_weeks                     int,
  breakthrough_at                   timestamptz,
  forgetting_curve_rate             float,   -- 0–1: how fast mastery fades without practice
  days_since_last_assessment        int,
  days_to_recover_after_intervention int,
  retention_score                   float CHECK (retention_score BETWEEN 0 AND 1),
  current_mastery_level             float,   -- 1.0–4.0
  peak_mastery_level                float,
  assessment_count                  int NOT NULL DEFAULT 0,
  compass_session_count             int NOT NULL DEFAULT 0,
  trajectory_class                  text CHECK (trajectory_class IN (
    'accelerating','improving','stable','plateau','declining','recovering','insufficient_data'
  )),
  snapshot_at                       timestamptz NOT NULL,
  created_at                        timestamptz NOT NULL DEFAULT now(),
  updated_at                        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, subject, substrand)
);

CREATE INDEX IF NOT EXISTS idx_eir_trajectories_student
  ON eir_learning_trajectories (student_id);
CREATE INDEX IF NOT EXISTS idx_eir_trajectories_class
  ON eir_learning_trajectories (trajectory_class, subject);
CREATE INDEX IF NOT EXISTS idx_eir_trajectories_velocity
  ON eir_learning_trajectories (mastery_velocity DESC NULLS LAST);

ALTER TABLE eir_learning_trajectories ENABLE ROW LEVEL SECURITY;
CREATE POLICY eir_trajectories_service ON eir_learning_trajectories
  USING (auth.role() = 'service_role');

-- ── 3. eir_intervention_effectiveness ────────────────────────────────────────
-- Pillar 3: Intervention Effectiveness Database
-- One row per completed intervention.

CREATE TABLE IF NOT EXISTS eir_intervention_effectiveness (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            uuid NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  teacher_id            uuid REFERENCES teachers(id) ON DELETE SET NULL,
  school_id             uuid REFERENCES schools(id) ON DELETE SET NULL,
  grade                 int  NOT NULL CHECK (grade BETWEEN 1 AND 12),
  subject               text NOT NULL,
  substrand             text,
  intervention_type     text NOT NULL,
  -- 'teacher_explanation','ai_explanation','worked_example','practice_questions',
  -- 'video_lesson','peer_discussion','revision','hands_on_activity',
  -- 'remedial_plan','compass_assignment','parent_home_activity','peer_pairing'
  learner_risk_level    text NOT NULL,   -- risk level at intervention start
  learner_profile_type  text,
  -- e.g. 'missing_prerequisite','low_confidence','disengaged','language_barrier'
  pre_mastery_level     float CHECK (pre_mastery_level BETWEEN 0 AND 4),
  post_mastery_level    float CHECK (post_mastery_level BETWEEN 0 AND 4),
  mastery_delta         float GENERATED ALWAYS AS (post_mastery_level - pre_mastery_level) STORED,
  started_at            timestamptz NOT NULL,
  completed_at          timestamptz,
  days_to_resolution    int,
  outcome               text CHECK (outcome IN ('effective','partial','ineffective','unknown')),
  was_effective         boolean GENERATED ALWAYS AS (outcome IN ('effective','partial')) STORED,
  evidence              jsonb NOT NULL DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eir_intervention_student
  ON eir_intervention_effectiveness (student_id);
CREATE INDEX IF NOT EXISTS idx_eir_intervention_type_outcome
  ON eir_intervention_effectiveness (intervention_type, outcome);
CREATE INDEX IF NOT EXISTS idx_eir_intervention_subject_grade
  ON eir_intervention_effectiveness (subject, grade, intervention_type);
CREATE INDEX IF NOT EXISTS idx_eir_intervention_school
  ON eir_intervention_effectiveness (school_id);

ALTER TABLE eir_intervention_effectiveness ENABLE ROW LEVEL SECURITY;
CREATE POLICY eir_intervention_effectiveness_service ON eir_intervention_effectiveness
  USING (auth.role() = 'service_role');

-- ── 4. eir_personalization_models ────────────────────────────────────────────
-- Pillar 4: Personalization Models
-- One row per learner, upserted after sufficient evidence accumulates.

CREATE TABLE IF NOT EXISTS eir_personalization_models (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id                      uuid NOT NULL REFERENCES learners(id) ON DELETE CASCADE UNIQUE,
  optimal_challenge_level         float CHECK (optimal_challenge_level BETWEEN 1 AND 4),
  optimal_session_mins            int,
  optimal_revision_interval_days  int,
  optimal_assessment_frequency_weeks int,
  preferred_explanation_style     text CHECK (preferred_explanation_style IN (
    'structured','example_first','question_first','visual','analogy_based'
  )),
  optimal_time_preference         text CHECK (optimal_time_preference IN (
    'morning','afternoon','evening','weekend','no_preference'
  )),
  engagement_pattern              text CHECK (engagement_pattern IN (
    'consistent','bursty','weekend_heavy','irregular','teacher_dependent'
  )),
  response_to_challenge           text CHECK (response_to_challenge IN (
    'thrives','persists','withdraws','needs_scaffolding'
  )),
  response_to_feedback            text CHECK (response_to_feedback IN (
    'acts_immediately','delayed_response','ignores'
  )),
  evidence_count                  int NOT NULL DEFAULT 0,
  model_confidence                float CHECK (model_confidence BETWEEN 0 AND 1),
  last_updated_at                 timestamptz NOT NULL,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eir_personalization_student
  ON eir_personalization_models (student_id);

ALTER TABLE eir_personalization_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY eir_personalization_service ON eir_personalization_models
  USING (auth.role() = 'service_role');

-- ── 5. eir_career_development ────────────────────────────────────────────────
-- Pillar 5: Career Development Snapshots
-- One row per snapshot — time-series of career evolution per learner.

CREATE TABLE IF NOT EXISTS eir_career_development (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            uuid NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  snapshot_at           timestamptz NOT NULL,
  top_career_slug       text,
  previous_career_slug  text,
  career_readiness_score float CHECK (career_readiness_score BETWEEN 0 AND 100),
  interest_stability    float CHECK (interest_stability BETWEEN 0 AND 1),
  -- 1.0 = completely stable interest, 0.0 = entirely new career direction
  competency_growth_rate float,   -- capability score delta per week
  pathway               text,    -- 'stem','social_sciences','arts_sports','technical_tvet'
  confidence_score      float CHECK (confidence_score BETWEEN 0 AND 1),
  career_confidence     float CHECK (career_confidence BETWEEN 0 AND 1),
  career_changed        boolean NOT NULL DEFAULT false,
  pathway_changed       boolean NOT NULL DEFAULT false,
  readiness_trend       text CHECK (readiness_trend IN ('improving','stable','declining')),
  evidence              jsonb NOT NULL DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eir_career_dev_student
  ON eir_career_development (student_id, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_eir_career_dev_pathway
  ON eir_career_development (pathway, snapshot_at DESC);

ALTER TABLE eir_career_development ENABLE ROW LEVEL SECURITY;
CREATE POLICY eir_career_development_service ON eir_career_development
  USING (auth.role() = 'service_role');

-- ── 6. eir_kg_discoveries ────────────────────────────────────────────────────
-- Pillar 6: Knowledge Graph Evolution Insights
-- Research-level discoveries about the EKG structure.

CREATE TABLE IF NOT EXISTS eir_kg_discoveries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discovery_type    text NOT NULL CHECK (discovery_type IN (
    'missing_prerequisite_link',
    'alternative_learning_path',
    'difficulty_calibration',
    'learning_bottleneck',
    'concept_cluster',
    'common_confusion_pair'
  )),
  subject           text NOT NULL,
  substrand         text NOT NULL,
  related_substrand text,
  description       text NOT NULL,
  evidence_count    int NOT NULL DEFAULT 1,
  supporting_student_count int NOT NULL DEFAULT 1,
  confidence        float CHECK (confidence BETWEEN 0 AND 1),
  status            text NOT NULL DEFAULT 'hypothesis' CHECK (status IN (
    'hypothesis','validating','validated','rejected'
  )),
  validated_at      timestamptz,
  rejected_at       timestamptz,
  rejection_reason  text,
  proposed_change   text,   -- what change to the KG this discovery recommends
  applied_at        timestamptz,
  evidence          jsonb NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eir_kg_discoveries_subject
  ON eir_kg_discoveries (subject, substrand);
CREATE INDEX IF NOT EXISTS idx_eir_kg_discoveries_status
  ON eir_kg_discoveries (status, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_eir_kg_discoveries_type
  ON eir_kg_discoveries (discovery_type, status);

ALTER TABLE eir_kg_discoveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY eir_kg_discoveries_service ON eir_kg_discoveries
  USING (auth.role() = 'service_role');

-- ── 7. eir_risk_predictions ──────────────────────────────────────────────────
-- Pillar 7: Early Risk Prediction Records
-- One row per prediction event — tracked against actual outcomes.

CREATE TABLE IF NOT EXISTS eir_risk_predictions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id               uuid NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  predicted_at             timestamptz NOT NULL,
  prediction_horizon_days  int NOT NULL,   -- e.g. 14 = predict 2 weeks out
  risk_type                text NOT NULL CHECK (risk_type IN (
    'disengagement','burnout','learning_regression',
    'exam_failure','dropout_risk','confidence_collapse'
  )),
  predicted_risk_level     text NOT NULL CHECK (predicted_risk_level IN (
    'low','medium','high','critical'
  )),
  actual_risk_level        text CHECK (actual_risk_level IN (
    'low','medium','high','critical'
  )),
  prediction_features      jsonb NOT NULL DEFAULT '{}',
  -- the learner model features that drove this prediction
  confidence               float CHECK (confidence BETWEEN 0 AND 1),
  evaluate_at              timestamptz NOT NULL,   -- when to check accuracy
  evaluated_at             timestamptz,
  was_accurate             boolean,
  model_version            text NOT NULL DEFAULT 'v1',
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eir_risk_pred_student
  ON eir_risk_predictions (student_id, predicted_at DESC);
CREATE INDEX IF NOT EXISTS idx_eir_risk_pred_evaluate
  ON eir_risk_predictions (evaluate_at)
  WHERE evaluated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_eir_risk_pred_accuracy
  ON eir_risk_predictions (risk_type, was_accurate)
  WHERE was_accurate IS NOT NULL;

ALTER TABLE eir_risk_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY eir_risk_predictions_service ON eir_risk_predictions
  USING (auth.role() = 'service_role');

-- ── 8. eir_recommendation_outcomes ───────────────────────────────────────────
-- Pillar 8 + 9: Explainability and Continuous Validation
-- One row per EILS recommendation, recording the full why + what happened.

CREATE TABLE IF NOT EXISTS eir_recommendation_outcomes (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id       uuid NOT NULL,
  -- FK to eils_recommendations — not a hard FK to avoid dep on EILS schema
  student_id              uuid NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  recommendation_type     text NOT NULL,
  subject                 text,
  substrand               text,
  -- Explainability fields (Pillar 8)
  explanation             text NOT NULL,   -- plain English: why this recommendation
  evidence_summary        jsonb NOT NULL DEFAULT '{}',
  alternative_actions     jsonb NOT NULL DEFAULT '[]',
  educational_theory      text,
  -- 'spaced_repetition','scaffolding','constructivism','zone_of_proximal_development',
  -- 'retrieval_practice','interleaving','elaborative_interrogation','growth_mindset'
  confidence              float CHECK (confidence BETWEEN 0 AND 1),
  -- Validation fields (Pillar 9)
  status                  text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','accepted','dismissed','expired'
  )),
  actioned_at             timestamptz,
  outcome                 text CHECK (outcome IN ('improved','same','declined','unknown')),
  outcome_recorded_at     timestamptz,
  pre_mastery_level       float,
  post_mastery_level      float,
  improvement_delta       float GENERATED ALWAYS AS (post_mastery_level - pre_mastery_level) STORED,
  teacher_feedback        text,
  learner_feedback        text,
  parent_feedback         text,
  feedback_recorded_at    timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eir_rec_outcomes_recommendation
  ON eir_recommendation_outcomes (recommendation_id);
CREATE INDEX IF NOT EXISTS idx_eir_rec_outcomes_student
  ON eir_recommendation_outcomes (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eir_rec_outcomes_pending
  ON eir_recommendation_outcomes (student_id, status)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_eir_rec_outcomes_type
  ON eir_recommendation_outcomes (recommendation_type, outcome);

ALTER TABLE eir_recommendation_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY eir_rec_outcomes_service ON eir_recommendation_outcomes
  USING (auth.role() = 'service_role');

-- ── 9. eir_hypotheses ────────────────────────────────────────────────────────
-- Pillar 10: Educational Knowledge Base — Hypotheses

CREATE TABLE IF NOT EXISTS eir_hypotheses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar           text NOT NULL CHECK (pillar IN (
    'misconception','trajectory','intervention','personalization',
    'career','kg_evolution','risk','explainability','validation','general'
  )),
  title            text NOT NULL,
  description      text NOT NULL,
  status           text NOT NULL DEFAULT 'proposed' CHECK (status IN (
    'proposed','testing','validated','rejected'
  )),
  evidence_count   int NOT NULL DEFAULT 0,
  proposed_by      text NOT NULL DEFAULT 'system' CHECK (proposed_by IN (
    'system','teacher','admin','researcher'
  )),
  proposed_at      timestamptz NOT NULL DEFAULT now(),
  testing_since    timestamptz,
  validated_at     timestamptz,
  rejected_at      timestamptz,
  rejection_reason text,
  supporting_evidence jsonb NOT NULL DEFAULT '[]',
  counter_evidence    jsonb NOT NULL DEFAULT '[]',
  tags             text[] NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eir_hypotheses_pillar_status
  ON eir_hypotheses (pillar, status);
CREATE INDEX IF NOT EXISTS idx_eir_hypotheses_status
  ON eir_hypotheses (status, proposed_at DESC);

ALTER TABLE eir_hypotheses ENABLE ROW LEVEL SECURITY;
CREATE POLICY eir_hypotheses_service ON eir_hypotheses
  USING (auth.role() = 'service_role');

-- ── 10. eir_findings ─────────────────────────────────────────────────────────
-- Pillar 10: Educational Knowledge Base — Validated Findings

CREATE TABLE IF NOT EXISTS eir_findings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hypothesis_id         uuid REFERENCES eir_hypotheses(id) ON DELETE SET NULL,
  pillar                text NOT NULL CHECK (pillar IN (
    'misconception','trajectory','intervention','personalization',
    'career','kg_evolution','risk','explainability','validation','general'
  )),
  title                 text NOT NULL,
  summary               text NOT NULL,
  detail                text,
  confidence            float CHECK (confidence BETWEEN 0 AND 1),
  evidence_strength     text NOT NULL CHECK (evidence_strength IN (
    'weak','moderate','strong','very_strong'
  )),
  sample_size           int,   -- number of students/interactions supporting this
  applies_to_subjects   text[] NOT NULL DEFAULT '{}',
  applies_to_grades     int[]  NOT NULL DEFAULT '{}',
  applies_to_curricula  text[] NOT NULL DEFAULT '{}',   -- 'cbc','844','igcse'
  finding_data          jsonb  NOT NULL DEFAULT '{}',
  action_recommendation text,  -- what EILS should do differently given this finding
  published_at          timestamptz NOT NULL DEFAULT now(),
  last_verified_at      timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eir_findings_pillar
  ON eir_findings (pillar, evidence_strength);
CREATE INDEX IF NOT EXISTS idx_eir_findings_subjects
  ON eir_findings USING GIN (applies_to_subjects);
CREATE INDEX IF NOT EXISTS idx_eir_findings_grades
  ON eir_findings USING GIN (applies_to_grades);
CREATE INDEX IF NOT EXISTS idx_eir_findings_confidence
  ON eir_findings (confidence DESC);

ALTER TABLE eir_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY eir_findings_service ON eir_findings
  USING (auth.role() = 'service_role');
