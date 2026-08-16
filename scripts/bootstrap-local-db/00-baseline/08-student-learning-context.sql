-- Recovered from production migration 20260528050732_create_student_learning_context.
-- No repo file exists for this migration (H1M-FIX-2 finding). Exact statement
-- text via supabase_migrations.schema_migrations.
CREATE TABLE IF NOT EXISTS student_learning_context (
  student_id UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  overall_tier TEXT,
  subject_tiers JSONB DEFAULT '{}',
  subject_action_steps JSONB DEFAULT '{}',
  subject_velocities JSONB DEFAULT '{}',
  recommended_pathway TEXT,
  pathway_confidence TEXT,
  pathway_scores JSONB DEFAULT '{}',
  top_careers JSONB DEFAULT '[]',
  career_gaps JSONB DEFAULT '[]',
  first_subject TEXT,
  session_goal TEXT,
  guided_topics JSONB DEFAULT '[]',
  overall_level INTEGER,
  curriculum_type TEXT DEFAULT 'cbc',
  grade INTEGER,
  last_assessment_id UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE student_learning_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own student learning context"
  ON student_learning_context FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can upsert own student learning context"
  ON student_learning_context FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own student learning context"
  ON student_learning_context FOR UPDATE
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_student_learning_context_user_id
  ON student_learning_context(user_id);
