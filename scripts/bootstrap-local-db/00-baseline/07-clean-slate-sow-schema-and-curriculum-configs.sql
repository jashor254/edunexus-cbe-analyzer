-- Schema-only portion of production migration 20260404173712_clean_slate_sow_tables
-- (H1M/H1M-R2) — the TRUNCATE statements from that migration are deliberately
-- excluded (data-only historical event, not needed on a fresh database).
CREATE TABLE IF NOT EXISTS sow_learning_outcomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  substrand_id UUID,
  outcome TEXT NOT NULL,
  outcome_type TEXT DEFAULT 'knowledge'
    CHECK (outcome_type IN ('knowledge','skill','attitude')),
  order_index INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sow_learning_outcomes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sow_learning_outcomes' AND policyname = 'sow_lo: public read'
  ) THEN
    CREATE POLICY "sow_lo: public read" ON sow_learning_outcomes FOR SELECT USING (TRUE);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sow_learning_outcomes' AND policyname = 'sow_lo: service insert'
  ) THEN
    CREATE POLICY "sow_lo: service insert" ON sow_learning_outcomes FOR INSERT WITH CHECK (TRUE);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS sow_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  curriculum_type TEXT,
  grade TEXT,
  subject TEXT,
  template_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sow_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sow_templates' AND policyname = 'sow_templates: public read'
  ) THEN
    CREATE POLICY "sow_templates: public read" ON sow_templates FOR SELECT USING (TRUE);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sow_templates' AND policyname = 'sow_templates: service insert'
  ) THEN
    CREATE POLICY "sow_templates: service insert" ON sow_templates FOR INSERT WITH CHECK (TRUE);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS sow_set_books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  learning_area_id UUID,
  book_title TEXT NOT NULL,
  book_author TEXT,
  grade TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sow_set_books ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sow_set_books' AND policyname = 'sow_set_books: public read'
  ) THEN
    CREATE POLICY "sow_set_books: public read" ON sow_set_books FOR SELECT USING (TRUE);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sow_set_books' AND policyname = 'sow_set_books: service insert'
  ) THEN
    CREATE POLICY "sow_set_books: service insert" ON sow_set_books FOR INSERT WITH CHECK (TRUE);
  END IF;
END $$;

ALTER TABLE sow_substrands ADD COLUMN IF NOT EXISTS content JSONB DEFAULT NULL;
ALTER TABLE sow_substrands ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'kicd';
ALTER TABLE sow_strands ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'kicd';

-- curriculum_configs: another pre-history table (no CREATE TABLE anywhere in
-- repo or production migration history), reconstructed from live structure.
CREATE TABLE IF NOT EXISTS public.curriculum_configs (
  id             text PRIMARY KEY,
  name           text NOT NULL,
  full_name      text NOT NULL,
  grading_system text NOT NULL,
  grade_labels   jsonb NOT NULL,
  phases         jsonb NOT NULL,
  is_active      boolean DEFAULT true,
  created_at     timestamptz DEFAULT now()
);
