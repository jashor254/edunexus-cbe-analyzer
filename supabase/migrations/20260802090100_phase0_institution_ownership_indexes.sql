-- Phase 0 — indexes for the new school_id columns, kept in their own file
-- deliberately: CREATE INDEX CONCURRENTLY cannot execute inside a
-- transaction block, and some migration runners wrap an entire file in an
-- implicit BEGIN/COMMIT. Isolating these two statements in a file with no
-- other DDL means that whichever way this project's migration tooling
-- applies files, it cannot silently downgrade this to a blocking, non-
-- concurrent build against teacher_classes/students — both are hot, live
-- tables read by dozens of files serving the 50 pioneer beta teachers today.
--
-- If the runner used to apply this still errors with "CREATE INDEX
-- CONCURRENTLY cannot run inside a transaction block", it must be applied
-- as a standalone statement (e.g. `psql -c "..."` outside any migration
-- transaction) rather than "fixed" by removing CONCURRENTLY — see Step 1's
-- explicit instruction not to pretend a blocking build is concurrent.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teacher_classes_school_id ON teacher_classes (school_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_school_id        ON students (school_id);
