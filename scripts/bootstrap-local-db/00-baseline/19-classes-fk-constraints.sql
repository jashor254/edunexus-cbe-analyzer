-- Discovered by H1D-2 DEEP smoke (teacherLifecycle.test.ts) via PostgREST's
-- embedded-relationship resolution ("Could not find a relationship between
-- 'classes' and 'grades'"). 00-baseline/06-second-prehistory-batch.sql's
-- recovered `classes` DDL captured the FK columns (grade_id, stream_id,
-- class_teacher_id, academic_year_id, school_id) but not the FK constraints
-- themselves -- never exercised by prior verification because all of it used
-- direct superuser SQL, which doesn't need FK metadata the way PostgREST's
-- relationship-embedding does. Recovered from live production
-- (pg_get_constraintdef) 2026-08-16.

ALTER TABLE classes
  ADD CONSTRAINT classes_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES academic_years(id),
  ADD CONSTRAINT classes_class_teacher_id_fkey FOREIGN KEY (class_teacher_id) REFERENCES school_users(id),
  ADD CONSTRAINT classes_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES grades(id),
  ADD CONSTRAINT classes_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  ADD CONSTRAINT classes_stream_id_fkey FOREIGN KEY (stream_id) REFERENCES streams(id);
