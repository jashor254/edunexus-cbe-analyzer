-- Records of Work migration
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS records_of_work (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id      UUID NOT NULL,
  scheme_id       UUID REFERENCES schemes_of_work(id) ON DELETE SET NULL,
  school          TEXT NOT NULL DEFAULT '',
  grade           TEXT NOT NULL DEFAULT '',
  learning_area   TEXT NOT NULL DEFAULT '',
  term            TEXT NOT NULL DEFAULT '1',
  year            INT  NOT NULL DEFAULT 2025,
  curriculum_mode TEXT,
  teacher_name    TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS row_entries (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  row_id      UUID NOT NULL REFERENCES records_of_work(id) ON DELETE CASCADE,
  week        INT  NOT NULL,
  lesson      INT  NOT NULL DEFAULT 1,
  date_taught DATE,
  strand      TEXT DEFAULT '',
  substrand   TEXT DEFAULT '',
  reflection  TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS row_entries_row_id_idx         ON row_entries(row_id);
CREATE INDEX IF NOT EXISTS records_of_work_teacher_id_idx ON records_of_work(teacher_id);

ALTER TABLE records_of_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE row_entries     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all_row"     ON records_of_work FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_entries" ON row_entries     FOR ALL TO service_role USING (true) WITH CHECK (true);
