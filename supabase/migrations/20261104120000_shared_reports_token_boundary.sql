-- 20261104120000_shared_reports_token_boundary.sql
--
-- DSA-01 (docs/security/deep-audit-2026-11-04.md): public.shared_reports had a
-- PUBLIC SELECT policy "Anyone can read shared reports" USING (true), so any
-- anonymous Data API caller could list every row — token, student_id, user_id,
-- student_name, grade and the full report_data — without presenting a token.
-- Production was verified to carry the identical policy (0 rows at the time).
--
-- New boundary:
--   * No table-level read for anon. Owners (authenticated) may read only their
--     own rows. Nothing else can SELECT.
--   * Bearer-token reads go through public.get_shared_report_by_token(text),
--     SECURITY DEFINER, search_path = '', EXECUTE granted to service_role ONLY.
--     The Next.js reader calls it server-side (lib/sharedReports); the Data API
--     therefore exposes no token-lookup oracle to browsers.
--   * The function returns an explicit DTO only: student_name, grade,
--     created_at, expires_at and a whitelisted projection of report_data. It
--     never returns id, token, student_id, user_id or teacher_class_id.
--   * Expired -> status 'expired' with NO personal data. Revoked, unknown and
--     malformed tokens are indistinguishable (zero rows).
--   * Revocation: new nullable column revoked_at (additive). Owners can still
--     hard-delete their own rows.
--   * Direct INSERT by authenticated is removed (the only inserter,
--     /api/share/generate, uses the service role and derives ownership itself).
--
-- Legacy tokens: the 12-hex-character (48-bit) format is RETIRED. The lookup
-- accepts only the 32-character base64url format (192-bit, crypto.randomBytes(24));
-- any pre-existing row with another token length is revoked here (production had
-- 0 rows when verified) and a table CHECK stops any writer — including the
-- service role — from minting a weak token again.
--
-- Report-creation controls enforced by the database as well as the route:
-- expires_at at most 90 days after creation, report_data at most 16 KiB, and a
-- provenance column recording that content is client-supplied.
--
-- Data change: a single UPDATE revoking non-32-char tokens (no-op when none).
-- Otherwise additive, plus one DROP POLICY (the vulnerable one), one DROP POLICY
-- (direct insert) and REVOKEs. Idempotent. Ends with a self-check that aborts
-- the whole transaction if the open policy or anon access survives.
--
-- Deploy order (see docs/security/dsa-01-deployment-plan.md): this migration
-- and the application release must ship together — the old reader breaks the
-- moment the open policy is dropped, and the new reader needs the function.
--
-- Rollback (INSECURE — reintroduces DSA-01; only for an emergency app revert):
--   CREATE POLICY "Anyone can read shared reports"
--     ON public.shared_reports FOR SELECT USING (true);
--   GRANT SELECT ON public.shared_reports TO anon;
--   -- the columns, CHECKs and function are harmless to keep; to remove them:
--   ALTER TABLE public.shared_reports
--     DROP CONSTRAINT IF EXISTS shared_reports_token_format,
--     DROP CONSTRAINT IF EXISTS shared_reports_expiry_cap,
--     DROP CONSTRAINT IF EXISTS shared_reports_report_size,
--     DROP CONSTRAINT IF EXISTS shared_reports_provenance_check;
--   DROP FUNCTION IF EXISTS public.get_shared_report_by_token(text);
--   ALTER TABLE public.shared_reports DROP COLUMN IF EXISTS revoked_at, DROP COLUMN IF EXISTS provenance;
--   (revoked legacy tokens are not restored automatically.)

BEGIN;

ALTER TABLE public.shared_reports
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS provenance text NOT NULL DEFAULT 'client_supplied';

-- Retire legacy (non-32-char) tokens before the format CHECK is added.
UPDATE public.shared_reports
SET revoked_at = now()
WHERE length(token) <> 32 AND revoked_at IS NULL;

-- NOT VALID: enforced for every new/updated row, without scanning (or being
-- blocked by) any retired legacy rows that may exist in a non-production DB.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shared_reports_token_format') THEN
    ALTER TABLE public.shared_reports ADD CONSTRAINT shared_reports_token_format
      CHECK (token ~ '^[A-Za-z0-9_-]{32}$') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shared_reports_expiry_cap') THEN
    ALTER TABLE public.shared_reports ADD CONSTRAINT shared_reports_expiry_cap
      CHECK (expires_at <= created_at + interval '90 days') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shared_reports_report_size') THEN
    ALTER TABLE public.shared_reports ADD CONSTRAINT shared_reports_report_size
      CHECK (octet_length(report_data::text) <= 16384) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shared_reports_provenance_check') THEN
    ALTER TABLE public.shared_reports ADD CONSTRAINT shared_reports_provenance_check
      CHECK (provenance IN ('client_supplied', 'server_generated'));
  END IF;
END
$$;

ALTER TABLE public.shared_reports ENABLE ROW LEVEL SECURITY;

-- ── Policies ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read shared reports" ON public.shared_reports;
DROP POLICY IF EXISTS "Users can create their own shared reports" ON public.shared_reports;
DROP POLICY IF EXISTS "Owners can read their shared reports" ON public.shared_reports;

CREATE POLICY "Owners can read their shared reports"
  ON public.shared_reports FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- "Users can delete their own shared reports" (DELETE, auth.uid() = user_id)
-- is kept unchanged: it is the owner's hard-revoke.

-- ── Grants ──────────────────────────────────────────────────────────────────
REVOKE ALL ON public.shared_reports FROM PUBLIC;
REVOKE ALL ON public.shared_reports FROM anon;
REVOKE ALL ON public.shared_reports FROM authenticated;
GRANT SELECT, DELETE ON public.shared_reports TO authenticated;

-- ── Token lookup (service role only) ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_shared_report_by_token(p_token text)
RETURNS TABLE (
  status       text,
  student_name text,
  grade        text,
  report_data  jsonb,
  created_at   timestamptz,
  expires_at   timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    CASE WHEN r.expires_at <= now() THEN 'expired' ELSE 'ok' END,
    CASE WHEN r.expires_at <= now() THEN NULL ELSE r.student_name END,
    CASE WHEN r.expires_at <= now() THEN NULL ELSE r.grade END,
    CASE WHEN r.expires_at <= now() THEN NULL ELSE jsonb_build_object(
      'strengths',     r.report_data -> 'strengths',
      'priorityAreas', r.report_data -> 'priorityAreas',
      'actionPlan',    r.report_data -> 'actionPlan',
      'subjectScores', r.report_data -> 'subjectScores',
      'overallLevel',  r.report_data -> 'overallLevel',
      'overallLabel',  r.report_data -> 'overallLabel'
    ) END,
    CASE WHEN r.expires_at <= now() THEN NULL ELSE r.created_at END,
    CASE WHEN r.expires_at <= now() THEN NULL ELSE r.expires_at END
  FROM public.shared_reports r
  WHERE p_token ~ '^[A-Za-z0-9_-]{32}$'
    AND r.token = p_token
    AND r.revoked_at IS NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_shared_report_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_shared_report_by_token(text) FROM anon;
REVOKE ALL ON FUNCTION public.get_shared_report_by_token(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_report_by_token(text) TO service_role;

-- ── Self-check: abort the transaction if the boundary is not in place ───────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'shared_reports'
      AND cmd IN ('SELECT', 'ALL')
      AND (qual IS NULL OR btrim(qual) = 'true')
  ) THEN
    RAISE EXCEPTION 'shared_reports still has an unrestricted read policy';
  END IF;

  IF has_table_privilege('anon', 'public.shared_reports', 'SELECT')
     OR has_table_privilege('anon', 'public.shared_reports', 'INSERT')
     OR has_table_privilege('anon', 'public.shared_reports', 'UPDATE')
     OR has_table_privilege('anon', 'public.shared_reports', 'DELETE') THEN
    RAISE EXCEPTION 'anon still holds privileges on shared_reports';
  END IF;

  IF has_function_privilege('anon', 'public.get_shared_report_by_token(text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.get_shared_report_by_token(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'get_shared_report_by_token is executable by a browser role';
  END IF;
END
$$;

COMMIT;
