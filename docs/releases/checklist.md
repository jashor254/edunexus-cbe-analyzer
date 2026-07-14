# Release Checklist

This is the process every change to `main` goes through before it's considered
deployable. It exists because `main` was previously broken for roughly a week
(2026-06-28 → 2026-07-03) without anyone noticing — there was no CI running
against it at all, so a missing module, several type errors, and a dead lint
config all landed and stayed there until a routine task (adding a Facebook
domain-verification meta tag) tried to deploy and failed. This checklist,
plus the CI gates in `.github/workflows/ci.yml`, is the answer to "make sure
that can't happen again."

Everything in **Automated (CI gate)** below runs on every PR via
`.github/workflows/ci.yml` and is a required status check on `main` — GitHub
will not allow a merge until all of them are green. Everything in **Manual**
is not (yet) automatable and is on the person merging the PR.

---

## 1. TypeScript

- [ ] **Automated (CI gate):** `npx tsc --noEmit` — zero errors.
- No `@ts-ignore` / `@ts-expect-error` added to silence a real type error
  (a legitimate use — e.g. a third-party type definition gap — should have a
  comment explaining why the error is wrong, not just a suppression).

## 2. Build

- [ ] **Automated (CI gate):** `npm run build` — completes with `✓ Compiled
      successfully`, no route fails static/dynamic generation.
- [ ] **Automated (CI gate):** All App Router routes compile. `next build`'s
      route table (printed at the end of the build log) should list every
      route you expect — a route silently missing from that list usually
      means it errored during page-data collection.

## 3. Lint

- [ ] **Automated (CI gate):** `npm run lint` (`eslint .`) — zero errors.
      Warnings don't block, but don't add new ones carelessly — they exist
      today only because specific React Compiler rules
      (`react-hooks/set-state-in-effect`, `react-hooks/purity`) were
      deliberately downgraded for patterns judged idiomatic, not because the
      bar is loose.

## 4. Architecture checks

- [ ] **Automated (CI gate):** `node scripts/check-architecture.mjs` — no
      *new* violations beyond `scripts/architecture-baseline.json`. Covers:
  - Direct `@supabase/supabase-js` / `@supabase/ssr` client construction
    outside `utils/supabase/{client,server,service,middleware}.ts` and
    `proxy.ts` (hard block, baseline 0).
  - `.catch()` chained directly onto a Postgrest builder — it's thenable, not
    a real `Promise`, so this silently fails to catch anything (hard block,
    baseline 0; this exact bug reached `main` three separate times before
    PHASE 12.0 fixed it).
  - `console.log(...)` in production code — outside `scripts/`, which is
    exempt because CLI tooling is expected to print (hard block against new
    ones; baseline currently 17 pre-existing, tracked as debt, not to be
    added to).
  - `select('*')` — same treatment (baseline currently 9).
  - `createServiceClient()` used outside `lib/repositories/` — **warn-only**,
    reported but never blocks. CLAUDE.md's actual current rule is "always use
    `createServiceClient()` in `lib/` functions," and the repository-pattern
    layer is only 2 files deep on `main` so far — this is a signal for a
    future migration, not something to enforce as broken today.
  - If you fixed some pre-existing violations, re-run with
    `--update-baseline` to lower the recorded count. Never raise it to make a
    new violation pass.

## 5. Tests

- [ ] Run `npm run test:report` (or the relevant test script) for any area
      touched by the change. *(Note: this repo does not yet have a
      comprehensive automated test suite wired into CI — this line is
      intentionally manual until that exists. Don't claim test coverage the
      repo doesn't have.)*
- [ ] For AI-touching changes: sanity-check at least one real prompt/response
      round-trip manually — `lib/ai/` errors don't always surface as type or
      lint errors.

## 6. Environment validation

- [ ] **Automated (CI gate, main only):** `npx tsx scripts/check-env.ts`
      against the real production secrets (via the `production` GitHub
      Environment). Fails if a required key
      (`NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
      `DEEPSEEK_API_KEY`) is missing or malformed.
- [ ] If this PR adds a new required env var, add it to
      `scripts/check-env.ts`'s `RULES` list *and* to the GitHub Environment
      secrets *and* to Vercel's project env vars — all three, or the
      checklist above will silently stop meaning anything for that variable.

## 7. OpenAPI generation

- [ ] **Not yet applicable on `main`.** The developer-platform / public API
      surface (`lib/organizations`, `lib/events`, the devportal API-key and
      billing subsystems) hasn't landed on `main` yet — it exists on
      `feature/edunexus-platform` along with a `scripts/generate-openapi.ts`
      generator. When that work merges, this item becomes: "run
      `npx tsx scripts/generate-openapi.ts` and commit the regenerated spec
      if any route's request/response shape changed."

## 8. Database migration verification

- [ ] Every schema change has a migration file in `supabase/migrations/`
      *before* it touches production — no dashboard SQL editor, no ad-hoc
      `apply_migration` calls without a matching committed file. Production's
      migration history already has entries with no corresponding file in
      this repo, all from skipping this step in the past — don't add to it.
- [ ] New tables have `id` (uuid), `created_at`, `updated_at` (default
      `now()`), RLS enabled with explicit policies, and indexes on any
      `teacher_id` / `student_id` / `sow_id` / `week_number` / FK column
      (per CLAUDE.md's Database Rules).
- [ ] Run `mcp__supabase__get_advisors` (security *and* performance) after
      any migration and read the diff against the last known state — new
      `rls_policy_always_true` or `unindexed_foreign_keys` warnings should be
      justified, not accidental.

## 9. Security checks

- [ ] Every new API route calls `auth.getUser()` first and returns 401 if
      there's no user; `user.id` is checked against any resource owner ID
      from the request, never trusted from the body.
- [ ] Webhook endpoints verify the provider signature before processing
      anything.
- [ ] Service-role client (`createServiceClient()`) is only used server-side,
      never exposed to a client component, and its usage here is for a cron
      job, webhook, or a legitimate service-role read/write — not a shortcut
      around RLS for a user-facing route.
- [ ] No secret, key, or credential is logged, returned in an API response,
      or committed in a migration file, test fixture, or `.env.local.backup`
      -style artifact.

---

## Who signs off

Whoever merges the PR is responsible for confirming every **Manual** item
above — CI cannot see prompt quality, migration intent, or whether a security
review actually happened. The **Automated** items are enforced by
`.github/workflows/ci.yml` and GitHub branch protection on `main`; if a
required check is red, GitHub blocks the merge button — there's no bypass
for that part except an org owner explicitly overriding branch protection,
which should itself require a documented reason.
