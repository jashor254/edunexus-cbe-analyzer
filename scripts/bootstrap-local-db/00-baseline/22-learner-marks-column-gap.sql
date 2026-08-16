-- Discovered by H1D-3B D1 expansion Wave A (lib/core/academicBridge.test.ts)
-- via PostgREST's schema cache. Live in production, absent from every
-- tracked migration / loose file that creates learner_marks locally.

ALTER TABLE learner_marks ADD COLUMN IF NOT EXISTS student_id uuid;
ALTER TABLE learner_marks ADD CONSTRAINT learner_marks_assessment_student_unique UNIQUE (assessment_id, student_name);
