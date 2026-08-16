-- Discovered by H1D-2 HTTP smoke (studentBlueprintSelfAccess.http.integration.test.ts)
-- via the app's own auth/getRole role-lookup query silently failing and
-- causing an auth-middleware redirect instead of a real allow/deny result.
-- Live in production, absent from every tracked migration / loose file.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS secondary_role text;
