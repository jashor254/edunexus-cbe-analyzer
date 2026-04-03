-- ============================================================
-- TEACHER PORTAL MIGRATION
-- Run this in Supabase SQL Editor
-- ============================================================

-- Teacher profiles
CREATE TABLE IF NOT EXISTS teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE
    REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  school TEXT NOT NULL,
  subject TEXT,
  grade_levels INTEGER[]
    DEFAULT '{7,8,9,10,11,12}',
  phone TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Teacher classes
CREATE TABLE IF NOT EXISTS teacher_classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL
    REFERENCES teachers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade INTEGER NOT NULL
    CHECK (grade BETWEEN 7 AND 12),
  subject TEXT NOT NULL,
  academic_year TEXT NOT NULL DEFAULT '2025',
  class_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Students linked to teacher classes
CREATE TABLE IF NOT EXISTS class_students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL
    REFERENCES teacher_classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL
    REFERENCES students(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(class_id, student_id)
);

-- Teacher assignments
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL
    REFERENCES teacher_classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL
    REFERENCES teachers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  instructions TEXT NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL DEFAULT 'practice'
    CHECK (type IN ('practice','graded','exam')),
  max_score INTEGER DEFAULT 100,
  is_compass_guided BOOLEAN DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft','active','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Assignment submissions
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL
    REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL
    REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL
    REFERENCES teacher_classes(id),
  compass_session_id UUID
    REFERENCES compass_sessions(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending','in_progress',
      'submitted','marked'
    )),
  score INTEGER,
  teacher_feedback TEXT,
  compass_summary TEXT,
  submitted_at TIMESTAMPTZ,
  marked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(assignment_id, student_id)
);

-- Early warning alerts
CREATE TABLE IF NOT EXISTS student_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL
    REFERENCES students(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL
    REFERENCES teachers(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL
    CHECK (alert_type IN (
      'inactive',
      'declining_scores',
      'assignment_overdue',
      'repeated_struggles',
      'holiday_inactive'
    )),
  message TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add teacher_class_id to shared_reports if not exists
ALTER TABLE shared_reports
  ADD COLUMN IF NOT EXISTS teacher_class_id UUID;

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_alerts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "teachers: own crud" ON teachers;
DROP POLICY IF EXISTS "classes: teacher crud" ON teacher_classes;
DROP POLICY IF EXISTS "class_students: read" ON class_students;
DROP POLICY IF EXISTS "class_students: insert" ON class_students;
DROP POLICY IF EXISTS "assignments: teacher manage" ON assignments;
DROP POLICY IF EXISTS "assignments: student read" ON assignments;
DROP POLICY IF EXISTS "submissions: own access" ON assignment_submissions;
DROP POLICY IF EXISTS "alerts: teacher read" ON student_alerts;

CREATE POLICY "teachers: own crud"
  ON teachers FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "classes: teacher crud"
  ON teacher_classes FOR ALL
  USING (
    teacher_id IN (
      SELECT id FROM teachers
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "class_students: read"
  ON class_students FOR SELECT
  USING (TRUE);

CREATE POLICY "class_students: insert"
  ON class_students FOR INSERT
  WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "assignments: teacher manage"
  ON assignments FOR ALL
  USING (
    teacher_id IN (
      SELECT id FROM teachers
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "assignments: student read"
  ON assignments FOR SELECT
  USING (
    class_id IN (
      SELECT class_id FROM class_students
      WHERE student_id IN (
        SELECT id FROM students
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "submissions: own access"
  ON assignment_submissions FOR ALL
  USING (
    student_id IN (
      SELECT id FROM students
      WHERE user_id = auth.uid()
    )
    OR
    assignment_id IN (
      SELECT id FROM assignments
      WHERE teacher_id IN (
        SELECT id FROM teachers
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "alerts: teacher read"
  ON student_alerts FOR ALL
  USING (
    teacher_id IN (
      SELECT id FROM teachers
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_teacher_classes_teacher
  ON teacher_classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_students_class
  ON class_students(class_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class
  ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment
  ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_alerts_teacher
  ON student_alerts(teacher_id);
