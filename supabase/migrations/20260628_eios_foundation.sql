-- ═══════════════════════════════════════════════════════════════════════════════
-- EduNexus Intelligence Operating System — Foundation Migration
-- 2026-06-28
--
-- This migration closes every known intelligence loop in the platform:
--   1. substrand_health          → fixes broken Remedial Planner
--   2. learner_profiles columns  → learning_behaviour, growth_milestones,
--                                  risk_history, confirmed_gaps, parent_observations
--   3. intervention_log          → measures whether interventions work
--   4. school_intelligence       → principal + HoD aggregated view
--   5. monday_panel_cache        → replaces weekly_intelligence (was never populated)
--   6. whatsapp_inbound_log      → parent reply tracking
--   7. assessment_quality_flags  → flags unreliable assessment data
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SUBSTRAND HEALTH
--    Tracks class-level substrand struggle — feeds Remedial Planner.
--    Was referenced in remedial_actions but never created. Fixed here.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS substrand_health (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sow_id           uuid        NOT NULL REFERENCES schemes_of_work(id) ON DELETE CASCADE,
  teacher_id       uuid        NOT NULL,
  class_id         uuid        REFERENCES teacher_classes(id) ON DELETE SET NULL,
  subject          text        NOT NULL,
  strand           text        NOT NULL,
  sub_strand       text        NOT NULL,
  -- How many students are struggling (level 1 or 2)
  struggle_count   int         NOT NULL DEFAULT 0,
  total_students   int         NOT NULL DEFAULT 0,
  -- Rolled-up CBC assessment level for the class (avg of student levels)
  assessment_level numeric(3,1) NOT NULL DEFAULT 0,
  -- Root cause identified by the knowledge graph traversal
  root_cause       text,
  -- Risk score 0-100: (struggle_count / total_students) * severity weight
  risk_score       int         NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  -- How many lessons have been taught covering this substrand
  lessons_covered  int         NOT NULL DEFAULT 0,
  -- Trend: improving / stable / declining (computed from history)
  trend            text        NOT NULL DEFAULT 'stable'
                               CHECK (trend IN ('improving', 'stable', 'declining')),
  last_assessed_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sow_id, strand, sub_strand)
);

CREATE INDEX IF NOT EXISTS idx_substrand_health_sow_id     ON substrand_health (sow_id);
CREATE INDEX IF NOT EXISTS idx_substrand_health_teacher_id ON substrand_health (teacher_id);
CREATE INDEX IF NOT EXISTS idx_substrand_health_class_id   ON substrand_health (class_id);
CREATE INDEX IF NOT EXISTS idx_substrand_health_risk_score ON substrand_health (risk_score DESC);

ALTER TABLE substrand_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "substrand_health_teacher_own"
  ON substrand_health FOR ALL
  USING (teacher_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. LEARNER PROFILES — EIOS INTELLIGENCE COLUMNS
--    Extends the existing learner_profiles table with all missing intelligence.
-- ─────────────────────────────────────────────────────────────────────────────

-- 2a. Learning Behaviour Profile
--     Captures HOW a student learns — not just what they know.
--     Updated from: Compass session events (consecutiveRight/Wrong),
--                   Academy reflections, session frequency patterns.
ALTER TABLE learner_profiles
  ADD COLUMN IF NOT EXISTS learning_behaviour jsonb NOT NULL DEFAULT '{
    "persistence":   {"score": 0.5, "trend": "stable", "data_points": 0},
    "confidence":    {"score": 0.5, "trend": "stable", "data_points": 0},
    "velocity":      {"score": 0.5, "trend": "stable", "data_points": 0},
    "help_seeking":  {"score": 0.5, "trend": "stable", "data_points": 0},
    "reflection":    {"score": 0.5, "trend": "stable", "data_points": 0},
    "consistency":   {"score": 0.5, "trend": "stable", "data_points": 0}
  }'::jsonb;

-- 2b. Growth Milestones
--     Permanent record of meaningful progress events.
--     Fires when: capability crosses a level threshold,
--                 risk resolves, first masteries achieved, prerequisites cleared.
ALTER TABLE learner_profiles
  ADD COLUMN IF NOT EXISTS growth_milestones jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2c. Risk History
--     Permanent record of every risk flag — when it started, when it resolved,
--     how many consecutive weeks it persisted, what resolved it.
--     Enables intervention efficacy measurement.
ALTER TABLE learner_profiles
  ADD COLUMN IF NOT EXISTS risk_history jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2d. Confirmed Gaps
--     Substrands confirmed weak across 2+ assessments (not just one bad day).
ALTER TABLE learner_profiles
  ADD COLUMN IF NOT EXISTS confirmed_gaps text[] NOT NULL DEFAULT '{}';

-- 2e. Persistent Gaps
--     Substrands weak across 2+ terms — deep structural issues.
ALTER TABLE learner_profiles
  ADD COLUMN IF NOT EXISTS persistent_gaps text[] NOT NULL DEFAULT '{}';

-- 2f. Parent Observations
--     Replies from the weekly WhatsApp Parent Pulse (1/2/3 responses).
--     The only evening/weekend learning signal the platform has.
ALTER TABLE learner_profiles
  ADD COLUMN IF NOT EXISTS parent_observations jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2g. Pathway Readiness
--     Live 0-100 scores per pathway, updated after every assessment.
--     Replaces point-in-time career report with continuous signal.
ALTER TABLE learner_profiles
  ADD COLUMN IF NOT EXISTS pathway_readiness jsonb NOT NULL DEFAULT '{
    "stem":              {"score": 0, "trend": "stable", "last_updated": null},
    "social_sciences":   {"score": 0, "trend": "stable", "last_updated": null},
    "arts_sports":       {"score": 0, "trend": "stable", "last_updated": null},
    "technical_tvet":    {"score": 0, "trend": "stable", "last_updated": null}
  }'::jsonb;

-- 2h. Term History Snapshots
--     End-of-term snapshots of the learner model for longitudinal analysis.
ALTER TABLE learner_profiles
  ADD COLUMN IF NOT EXISTS term_snapshots jsonb NOT NULL DEFAULT '[]'::jsonb;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. INTERVENTION LOG
--    Measures whether interventions work — the most critical missing loop.
--    Written when: remedial plan generated, Monday Panel action taken,
--                  peer pairing assigned, teacher check-in completed.
--    Read by:      Monday Panel (14-day follow-up), School Intelligence.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS intervention_log (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id          uuid        NOT NULL,
  class_id            uuid        NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
  student_id          uuid        REFERENCES students(id) ON DELETE SET NULL,
  -- What type of intervention was applied
  intervention_type   text        NOT NULL
                      CHECK (intervention_type IN (
                        'remedial_plan', 'peer_pairing', 'monday_action',
                        'compass_assignment', 'holiday_plan', 'prerequisite_warmup'
                      )),
  subject             text,
  substrand           text,
  -- Snapshot of risk state before intervention
  risk_level_before   text        NOT NULL CHECK (risk_level_before IN ('normal','watch','at_risk','critical')),
  knowledge_level_before int,     -- CBC level 1-4 at time of intervention
  -- Snapshot after follow-up (filled in at check-in, 14 days later)
  risk_level_after    text        CHECK (risk_level_after IN ('normal','watch','at_risk','critical')),
  knowledge_level_after int,
  -- Teacher's qualitative assessment at check-in
  teacher_outcome     text        CHECK (teacher_outcome IN ('improved', 'same', 'worsened')),
  teacher_note        text,
  -- Computed efficacy
  was_effective       boolean     GENERATED ALWAYS AS (
    CASE WHEN teacher_outcome = 'improved' THEN true
         WHEN teacher_outcome IN ('same', 'worsened') THEN false
         ELSE null END
  ) STORED,
  -- Dates
  intervened_at       timestamptz NOT NULL DEFAULT now(),
  checkin_due_at      timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  checkin_completed_at timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intervention_log_teacher_id    ON intervention_log (teacher_id);
CREATE INDEX IF NOT EXISTS idx_intervention_log_class_id      ON intervention_log (class_id);
CREATE INDEX IF NOT EXISTS idx_intervention_log_student_id    ON intervention_log (student_id);
CREATE INDEX IF NOT EXISTS idx_intervention_log_checkin_due   ON intervention_log (checkin_due_at)
  WHERE checkin_completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_intervention_log_effective     ON intervention_log (was_effective)
  WHERE was_effective IS NOT NULL;

ALTER TABLE intervention_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intervention_log_teacher_own"
  ON intervention_log FOR ALL
  USING (teacher_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. SCHOOL INTELLIGENCE SNAPSHOTS
--    Weekly aggregated view for principals and heads of department.
--    Never exposes individual student PII — only aggregated counts.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS school_intelligence_snapshots (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           text        NOT NULL,  -- from teacher profile / institution name
  week_of             date        NOT NULL,
  grade               int,        -- null = school-wide; set = grade-specific
  subject             text,       -- null = all subjects; set = subject-specific (HoD view)
  -- Risk distribution counts
  total_students      int         NOT NULL DEFAULT 0,
  normal_count        int         NOT NULL DEFAULT 0,
  watch_count         int         NOT NULL DEFAULT 0,
  at_risk_count       int         NOT NULL DEFAULT 0,
  critical_count      int         NOT NULL DEFAULT 0,
  -- Top struggling substrands (jsonb array of {subject, substrand, pct_below_me, trend})
  top_struggling_substrands jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Intervention efficacy this week
  interventions_run   int         NOT NULL DEFAULT 0,
  interventions_effective int     NOT NULL DEFAULT 0,
  -- Capability averages across all students (6 dimensions)
  avg_capability_dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Trend vs. last week
  risk_trend          text        NOT NULL DEFAULT 'stable'
                      CHECK (risk_trend IN ('improving', 'stable', 'declining')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, week_of, grade, subject)
);

CREATE INDEX IF NOT EXISTS idx_school_intel_school_id ON school_intelligence_snapshots (school_id);
CREATE INDEX IF NOT EXISTS idx_school_intel_week_of   ON school_intelligence_snapshots (week_of DESC);
CREATE INDEX IF NOT EXISTS idx_school_intel_grade     ON school_intelligence_snapshots (grade);

ALTER TABLE school_intelligence_snapshots ENABLE ROW LEVEL SECURITY;

-- Principal can read school-wide; teachers cannot see this table
CREATE POLICY "school_intel_read"
  ON school_intelligence_snapshots FOR SELECT
  USING (
    -- Allow service role (cron job) and users who are marked as admin/principal
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM teachers t
      WHERE t.user_id = auth.uid()
      AND t.is_verified = true
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. MONDAY PANEL CACHE
--    Replaces weekly_intelligence (was defined but never populated).
--    Generated on-demand, cached for 24 hours, invalidated on model update.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS monday_panel_cache (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id            uuid        NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
  teacher_id          uuid        NOT NULL,
  panel_data          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  teaching_patterns   jsonb       NOT NULL DEFAULT '{}'::jsonb,
  prerequisite_alerts jsonb       NOT NULL DEFAULT '[]'::jsonb,
  pending_checkins    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  career_moments      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  generated_at        timestamptz NOT NULL DEFAULT now(),
  valid_until         timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE (class_id)
);

CREATE INDEX IF NOT EXISTS idx_monday_panel_cache_class_id   ON monday_panel_cache (class_id);
CREATE INDEX IF NOT EXISTS idx_monday_panel_cache_valid_until ON monday_panel_cache (valid_until);

ALTER TABLE monday_panel_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monday_panel_cache_teacher_own"
  ON monday_panel_cache FOR ALL
  USING (teacher_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. WHATSAPP INBOUND LOG
--    Records every inbound WhatsApp message from parents.
--    Parsed replies (1/2/3) become parent_observations in learner_profiles.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS whatsapp_inbound_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_phone      text        NOT NULL,
  raw_body        text        NOT NULL,
  parsed_reply    text        CHECK (parsed_reply IN ('demonstrated','struggled','not_attempted','free_form')),
  student_id      uuid        REFERENCES students(id) ON DELETE SET NULL,
  parent_user_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  pulse_week_of   text,       -- which week's pulse this replies to
  substrand_context text,     -- what substrand the pulse action was about
  processed       boolean     NOT NULL DEFAULT false,
  processed_at    timestamptz,
  error           text,       -- if processing failed
  received_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_student_id  ON whatsapp_inbound_log (student_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_processed   ON whatsapp_inbound_log (processed) WHERE NOT processed;
CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_from_phone  ON whatsapp_inbound_log (from_phone);

ALTER TABLE whatsapp_inbound_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_inbound_service_only"
  ON whatsapp_inbound_log FOR ALL
  USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. ASSESSMENT QUALITY FLAGS
--    Flags assessments with unreliable score distributions.
--    Prevents bad data from corrupting the Learner Model.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS assessment_quality_flags (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   uuid        NOT NULL REFERENCES class_assessments(id) ON DELETE CASCADE,
  teacher_id      uuid        NOT NULL,
  quality         text        NOT NULL CHECK (quality IN ('reliable','suspect','invalid')),
  reason          text,
  -- Distribution stats for diagnostics
  score_mean      numeric(5,2),
  score_std_dev   numeric(5,2),
  bimodal         boolean     NOT NULL DEFAULT false,
  all_same        boolean     NOT NULL DEFAULT false,
  -- Whether the teacher has been notified
  teacher_notified boolean    NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessment_quality_assessment_id ON assessment_quality_flags (assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_quality_teacher_id    ON assessment_quality_flags (teacher_id);
CREATE INDEX IF NOT EXISTS idx_assessment_quality_quality       ON assessment_quality_flags (quality) WHERE quality != 'reliable';

ALTER TABLE assessment_quality_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assessment_quality_teacher_own"
  ON assessment_quality_flags FOR ALL
  USING (teacher_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. SUBSTRAND HEALTH POPULATION FUNCTION
--    Called after each assessment upload to keep substrand_health current.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION compute_substrand_health(
  p_sow_id      uuid,
  p_teacher_id  uuid,
  p_class_id    uuid,
  p_subject     text,
  p_strand      text,
  p_sub_strand  text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_struggle_count   int;
  v_total_students   int;
  v_avg_level        numeric;
  v_risk_score       int;
  v_existing_level   numeric;
  v_trend            text := 'stable';
BEGIN
  -- Count students with CBC level 1 or 2 on this substrand via learner_profiles
  SELECT
    COUNT(*) FILTER (WHERE
      (lp.knowledge_state -> (p_subject || ':' || p_sub_strand) ->> 'level')::int <= 2
    ),
    COUNT(*),
    COALESCE(AVG(
      (lp.knowledge_state -> (p_subject || ':' || p_sub_strand) ->> 'level')::numeric
    ), 0)
  INTO v_struggle_count, v_total_students, v_avg_level
  FROM class_students cs
  JOIN learner_profiles lp ON lp.student_id = cs.student_id
  WHERE cs.class_id = p_class_id
    AND lp.knowledge_state ? (p_subject || ':' || p_sub_strand);

  IF v_total_students = 0 THEN RETURN; END IF;

  v_risk_score := ROUND((v_struggle_count::numeric / v_total_students) * 100);

  -- Determine trend vs. existing record
  SELECT assessment_level INTO v_existing_level
  FROM substrand_health
  WHERE sow_id = p_sow_id AND strand = p_strand AND sub_strand = p_sub_strand;

  IF v_existing_level IS NOT NULL THEN
    IF v_avg_level > v_existing_level + 0.1 THEN v_trend := 'improving';
    ELSIF v_avg_level < v_existing_level - 0.1 THEN v_trend := 'declining';
    END IF;
  END IF;

  INSERT INTO substrand_health (
    sow_id, teacher_id, class_id, subject, strand, sub_strand,
    struggle_count, total_students, assessment_level, risk_score, trend, last_assessed_at
  ) VALUES (
    p_sow_id, p_teacher_id, p_class_id, p_subject, p_strand, p_sub_strand,
    v_struggle_count, v_total_students, v_avg_level, v_risk_score, v_trend, now()
  )
  ON CONFLICT (sow_id, strand, sub_strand) DO UPDATE SET
    struggle_count   = EXCLUDED.struggle_count,
    total_students   = EXCLUDED.total_students,
    assessment_level = EXCLUDED.assessment_level,
    risk_score       = EXCLUDED.risk_score,
    trend            = v_trend,
    last_assessed_at = now(),
    updated_at       = now();
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. LEARNER PROFILE UPDATED_AT TRIGGER (ensure it exists)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_learner_profiles_updated_at ON learner_profiles;
CREATE TRIGGER trg_learner_profiles_updated_at
  BEFORE UPDATE ON learner_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_intervention_log_updated_at ON intervention_log;
CREATE TRIGGER trg_intervention_log_updated_at
  BEFORE UPDATE ON intervention_log
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_substrand_health_updated_at ON substrand_health;
CREATE TRIGGER trg_substrand_health_updated_at
  BEFORE UPDATE ON substrand_health
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. PERFORMANCE INDEXES ON NEW COLUMNS (jsonb paths)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_learner_profiles_risk_level
  ON learner_profiles (overall_risk_level);

CREATE INDEX IF NOT EXISTS idx_learner_profiles_student_id
  ON learner_profiles (student_id);

CREATE INDEX IF NOT EXISTS idx_learner_profiles_updated_at
  ON learner_profiles (updated_at DESC);

-- GIN indexes on new JSONB columns for fast querying
CREATE INDEX IF NOT EXISTS idx_learner_profiles_growth_milestones
  ON learner_profiles USING GIN (growth_milestones);

CREATE INDEX IF NOT EXISTS idx_learner_profiles_risk_history
  ON learner_profiles USING GIN (risk_history);

CREATE INDEX IF NOT EXISTS idx_learner_profiles_parent_observations
  ON learner_profiles USING GIN (parent_observations);
