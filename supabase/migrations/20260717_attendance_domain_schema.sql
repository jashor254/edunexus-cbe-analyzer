-- ─────────────────────────────────────────────────────────────────────────────
-- ATTENDANCE DOMAIN — canonical schema foundation
-- Sprint 11B, per ADR-0003 (docs/architecture/adr-0003-attendance-domain.md).
--
-- Schema only. No repository, service, route, UI, or business logic in this
-- migration. Two tables:
--   attendance_sessions — one row per class, per school day: "was attendance
--                         taken, by whom." Ownership only, no derived data.
--   attendance_records  — one row per learner, per session: the atomic fact.
--                         Append-only in spirit (Sprint 11D's service layer
--                         enforces supersede-not-edit; no DB trigger for that
--                         is added here — see doc's "known future extension
--                         points" for why that's deferred, not skipped).
--
-- No Attendance Summary table — per ADR-0003 §4, summaries are always
-- computed on read (mirrors fetchClassTermStatuses()'s existing pattern),
-- never a second stored truth. Nothing here is wired to Evidence, Report
-- Cards, Compass, Intelligence, Notifications, Analytics, or Parent Portal.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ATTENDANCE_SESSIONS
--    One session per class, per school day, per session_type. Existence of a
--    session alone answers "was attendance taken for this class today."
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id            uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id     uuid        NOT NULL REFERENCES academic_years(id),
  term_id              uuid        NOT NULL REFERENCES terms(id),
  class_id             uuid        NOT NULL REFERENCES classes(id),
  attendance_date      date        NOT NULL,
  -- Single canonical value today (one attendance-taking event per class per
  -- day). Reserved for future period-level granularity (e.g. 'morning',
  -- 'afternoon') per ADR-0003 §6's rejected-alternative note — extending the
  -- CHECK list requires its own migration, same convention as every other
  -- fixed-list column in this schema (school_users.role, learners.status).
  session_type         text        NOT NULL DEFAULT 'daily'
                         CHECK (session_type IN ('daily')),
  -- Provenance only — who opened/marked this session. Never used for access
  -- control (per ADR-0003 §5/§8: read/write authorization is always "does
  -- this teacher currently teach this class," never "did this teacher mark
  -- this row"). References school_users, not teachers — Attendance is a Core
  -- domain, and Core already uses school_users(id) as its own teacher-in-
  -- school identity for this exact kind of reference (classes.class_teacher_id,
  -- class_subjects.teacher_id) rather than the separate `teachers` table ADR-
  -- 0002 discusses for the Assessment domain. Nullable + ON DELETE SET NULL
  -- (not CASCADE) so a session's attendance history survives even if the
  -- marking teacher's school_users row is later hard-deleted — matches the
  -- existing SET NULL precedent for provenance-only teacher references
  -- elsewhere (e.g. 20260702_eir_foundation.sql:111, 20260706_sync_pipeline.sql).
  marked_by_teacher_id uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  -- Prevents duplicate sessions for the same class/date/session combination.
  UNIQUE (class_id, attendance_date, session_type)
);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_school_id ON attendance_sessions (school_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_class_id  ON attendance_sessions (class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_term_id   ON attendance_sessions (term_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date      ON attendance_sessions (school_id, attendance_date);

ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;

-- School-isolation only, matching school_report_cards_staff's existing
-- convention: any active school_users member of this school may read/write.
-- Finer-grained authorization ("only the teacher currently assigned to this
-- class may mark it") is a business rule, enforced by Sprint 11D's service
-- layer via lib/core/permissions.ts, not by RLS — the same division already
-- used for school_report_cards (RLS = tenant boundary, service layer =
-- business permission). No parent-read policy is added here: parent
-- visibility (ADR-0003 §8) is a future, separately-gated Report Card/
-- Parent-Portal integration (Sprint 11G/11I), not this sprint's scope.
CREATE POLICY "attendance_sessions_school_staff"
  ON attendance_sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = attendance_sessions.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ATTENDANCE_RECORDS
--    One row per learner, per session — the atomic fact. No totals, no
--    percentages, no summaries: those are always computed on read (ADR-0003 §4).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS attendance_records (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_session_id uuid        NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  learner_id            uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  status                text        NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  arrival_time          time,
  departure_time        time,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  -- One learner cannot appear twice in one attendance session.
  UNIQUE (attendance_session_id, learner_id)
);

-- attendance_session_id lookups are already served by the UNIQUE constraint
-- above (session_id is its leading column) — no separate index added, per
-- "avoid speculative indexes."
CREATE INDEX IF NOT EXISTS idx_attendance_records_learner_id ON attendance_records (learner_id);

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_records_school_staff"
  ON attendance_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM attendance_sessions ats
      JOIN school_users su ON su.school_id = ats.school_id
      WHERE ats.id = attendance_records.attendance_session_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. UPDATED_AT TRIGGERS
--    Reuses update_updated_at_column(), already defined in
--    20260629_core_foundation.sql — not redefined here.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_attendance_sessions_updated_at ON attendance_sessions;
CREATE TRIGGER trg_attendance_sessions_updated_at
  BEFORE UPDATE ON attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_attendance_records_updated_at ON attendance_records;
CREATE TRIGGER trg_attendance_records_updated_at
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
