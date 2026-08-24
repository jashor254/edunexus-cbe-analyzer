# Parent Portal Phase P3.5 — HTTP Regression Harness + P3 Proof Closure

**Scope lock:** branch `main`, started at HEAD `4937bac` (P3's own closeout commit),
pre-existing ~207-file dirty working tree left completely untouched (confirmed via
`git status` before/after — every file this phase staged/committed is listed in §20,
nothing else). Builds on `docs/architecture/parent-portal-super-audit-p0.md` (P0),
`docs/architecture/parent-portal-p1-entry-convergence.md` (P1),
`docs/architecture/parent-portal-p2-compass-actor-boundary.md` (P2), and
`docs/architecture/parent-portal-p3-home-child-context-convergence.md` (P3).

This is **test infrastructure + proof closure**, not a product-feature phase. The one
allowed product-code change (P3's named copy-fix candidate, §15 below) was evaluated
and deliberately **not made** — see §15 and §23 for why.

---

## 1. Verdict

**P3.5 COMPLETE WITH NAMED LIMITATIONS.**

The harness is real, reusable, and proven — not aspirational. One command
(`npm run test:parent-http`) boots local Docker Supabase (if not already running),
verifies it is not production, builds an isolated `next dev --webpack` copy of the
working tree, runs the full parent HTTP manifest against it, and tears everything
down — leaving the real working tree, the real `.env.local`, and any pre-existing
`next dev` process for this repo directory completely untouched. Proven against
both historical baselines (P1's 20/20, the pre-existing suite's 19/19) with **zero
assertions changed to force a pass** — a real bug in the harness itself (a missing
`SUPABASE_SERVICE_ROLE_KEY` env var on the test-runner process) was found and fixed
during this phase, not papered over.

P2's and P3's own named "HTTP-layer regression not executed" gaps are both closed
with real, passing HTTP fixtures. What is **not** done: the optional copy fix (P3
§8's learner-framed banner copy) and a full rendered-DOM proof of `/learn`'s
disabled subject cards — both require testing a large stateful client component
this repo has no jsdom/testing-library to exercise with effects running, and adding
one solely for this was judged exactly the "heavy new component-testing framework"
the mission instructed against. Named, not hidden — see §23.

---

## 2. Previous Harness Problem

Reproduced with real evidence, not restated from the docs:

- **STANDARD (`npm test`) deliberately excludes DB-backed HTTP suites.** Confirmed
  by reading `scripts/run-standard-tests.mjs` — it always runs only
  `scripts/standard-tests.json`'s fixed manifest, ignores any path argument, and
  never loads `.env.local`.
- **`.env.local` points at production.** Confirmed: `NEXT_PUBLIC_SUPABASE_URL` in
  the real `.env.local` resolves to `KNOWN_PRODUCTION_PROJECT_REF` (`lpxrfbmzncaztpmyqzkc`,
  `utils/supabase/productionRef.ts`).
- **A second `next dev` cannot run against this repo's own directory.** Reproduced
  directly: `.next/dev/lock`-style refusal is a documented Next 16.3 behavior
  P1/P2/P3 all independently hit; this phase avoided it entirely by never starting
  a second server in the real directory — the isolated rsync copy sidesteps the
  problem rather than fighting it.
- **`next dev --webpack` + a symlinked `node_modules` actually works.** Proven
  empirically this phase (§6): rsync-copy the tree (excluding `node_modules`/`.next`/
  `.git`, 140MB, ~0.5s), symlink `node_modules` back to the real one, boot
  `next dev --webpack -p <port>` — healthy in ~4s. Only Turbopack rejects an
  out-of-project symlink; this harness never uses Turbopack, so the cheaper
  symlink strategy (not a full `node_modules` copy) is safe and fast.
- **Existing scaffolding was substantial but incomplete.** `utils/supabase/
  test-service.ts` (`resolveTestTarget`/`createTestServiceClient`), `scripts/
  check-test-target.ts`, `scripts/check-http-target-equality.sh` (SAFE-009),
  `scripts/check-http-auth-sentinel.ts`, `scripts/check-http-base-url-consistency.mjs`,
  and `scripts/run-http-main.mjs`/`run-http-pr.mjs` all existed — but every one of
  them **assumes** "the caller has already bootstrapped the DB, built+started the
  local Next server" (verbatim comment, `run-http-main.mjs`). Nothing in the repo
  actually did that bootstrapping automatically. That is the one missing piece this
  phase built.

---

## 3. Harness Architecture

```
npm run test:parent-http
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│ scripts/parent-http/run-parent-http-harness.mjs                     │
│                                                                       │
│  1. supabase status -o json  ──────► already running? no → start it │
│  2. derive TEST_SUPABASE_URL / SERVICE_ROLE_KEY / ANON_KEY from      │
│     that status output — NEVER from .env.local                      │
│  3. scripts/check-test-target.ts  ──► production-shape? REFUSE       │
│  4. rsync repo → /tmp/edunexus-parent-http-XXXXXX                   │
│     (excludes node_modules/.next/.git)                              │
│  5. symlink node_modules back to the REAL one (webpack-safe)         │
│  6. write an ISOLATED .env.local inside the copy only                │
│  7. spawn `next dev --webpack -p <free port>` in the copy,          │
│     detached (own process group) — never touches any other server   │
│  8. poll GET {baseUrl}/api/health until <500, up to 60s              │
│  9. run the requested *.http.integration.test.ts manifest,          │
│     tsx --experimental-test-module-mocks --test <files>,            │
│     env: TEST_SUPABASE_*, NEXT_PUBLIC_SUPABASE_*,                    │
│          SUPABASE_SERVICE_ROLE_KEY, TEST_BASE_URL                    │
│ 10. on ANY exit path (pass, fail, SIGINT/SIGTERM): kill the spawned  │
│     server's process group, rm -rf the isolated copy                │
│ 11. on test FAILURE: print the isolated server's log tail            │
│     (never a secret — only next dev's own stdout/stderr)             │
└─────────────────────────────────────────────────────────────────────┘
        │
        ▼
  real repo tree — UNTOUCHED           local Docker Supabase — shared,
  real .env.local — UNTOUCHED          never mutated by this script
  any pre-existing `next dev` for      (started via `supabase start` only
  this directory — UNTOUCHED            if not already running)
```

---

## 4. Production-Safety Gate (exact checks)

Every check fails **before** any fixture is seeded, not after:

1. `TEST_SUPABASE_URL`/`SERVICE_ROLE_KEY`/`ANON_KEY` are **derived from `supabase
   status -o json`**, the local CLI's own live source of truth — the script never
   reads `.env.local` at any point, so a developer's real production credentials
   can never leak into the test process by accident.
2. The derived URL/ref is run through the **existing** `resolveTestTarget()` gate
   (`utils/supabase/test-service.ts`, via `scripts/check-test-target.ts`, shelled
   out to rather than reimplemented) — rejects: missing URL/key/ref, a URL that
   doesn't match the local-Docker or hosted-Supabase shape, a URL that resolves to
   `KNOWN_PRODUCTION_PROJECT_REF`, or a ref that doesn't match `'local-docker'`.
3. `TEST_SUPABASE_PROJECT_REF` is hardcoded to the literal string `'local-docker'`
   inside the harness — never read from an env var a caller could mistype, so a
   copy-pasted hosted ref can never accidentally match.
4. The isolated Next server's own env is built **explicitly**, key by key
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`) from the verified local values — it does not
   inherit the calling shell's `.env.local`-sourced production values (the isolated
   copy's own `.env.local` is written by the harness itself, and only points at
   the verified local target).
5. Never logs a key value — only the URL and project ref (matching the existing
   `check-test-target.ts` convention).

A real bug was found and fixed here during this phase, not shipped silently: the
first working version of the harness set the server process's env correctly but
forgot `SUPABASE_SERVICE_ROLE_KEY` on the **test-runner** process's env block —
`createServiceClient()` (the ordinary, non-test client some `lib/repositories`
modules construct eagerly at import time) threw `Missing NEXT_PUBLIC_SUPABASE_URL
or SUPABASE_SERVICE_ROLE_KEY` for any HTTP test file that transitively imports
`lib/core/permissions`. Confirmed with a standalone `spawnSync` repro before
patching (see the fix commit `191b8b1`'s description) — this was a straightforward
env-plumbing bug, not a security gap (the missing var made the client construction
fail closed, not silently wrong).

---

## 5. Local Supabase Strategy

`supabase status -o json` is called first. If the CLI reports it isn't running,
the harness runs `supabase start` (the repo's own existing convention — same
command a developer runs manually) and re-queries. It never starts a **second**
Supabase instance, never touches `supabase/config.toml`, and never stops a running
instance on exit — a shared local Docker Supabase this phase found already running
throughout (`supabase_db_edunexus`, `supabase_kong_edunexus`, etc.) was reused for
every run in this phase without incident.

---

## 6. Isolated Next Strategy

`rsync -a --exclude node_modules --exclude .next --exclude .git <repo>/ <tmp>/`
(measured: 140MB, ~0.5s) then `ln -s <repo>/node_modules <tmp>/node_modules`.
Proven empirically this phase (not assumed from P1's doc) that `next dev --webpack`
boots cleanly against a symlinked `node_modules` that points **outside** the
isolated tree's own directory — only Turbopack has the specific "Symlink points out
of the filesystem root" refusal P1 hit, and this harness never invokes Turbopack.
This is materially cheaper than a full `node_modules` copy (939MB) while being
exactly as safe, since the real `node_modules` is never written to by the isolated
server (it only reads dependency code).

The isolated copy gets its own `.env.local` (written fresh each run, never derived
from the real one) and boots on the first free port starting at `3100` — the
existing repo's own canonical HTTP-suite default
(`scripts/check-http-base-url-consistency.mjs`) — falling forward to the next free
port if occupied, rather than hard-failing or colliding with a concurrent run.

---

## 7. Command

```
npm run test:parent-http
```

Runs the harness with the default manifest, `scripts/parent-http/
parent-http-tests.json` (5 files, 70 tests total). Variants:

```
npm run test:parent-http -- --file lib/testing/parentCompassActorBoundary.http.integration.test.ts
npm run test:parent-http -- --manifest path/to/other-manifest.json
npm run test:parent-http -- --keep-tree   # debugging escape hatch — leaves the isolated copy for inspection
```

---

## 8. Cleanup

On every exit path — normal completion, a failing test, or `SIGINT`/`SIGTERM` — the
harness: (1) sends `SIGTERM` to the **negative** pid of the spawned server (its own
process group, since it was spawned `detached: true`), which reaches the `next dev`
process and its webpack child workers without ever touching any other process on
the machine; (2) `rm -rf`s the isolated tmp copy. The real working tree, the real
`.env.local`, and the pre-existing root-owned `next-server` process this phase found
already running (pid 3211, unrelated, never touched) were all confirmed untouched
after every run in this phase (`ps aux` / `curl` checks before and after).

Fixture-level cleanup (deleting the synthetic rows each test file creates) is each
test file's own `after()` hook, following the existing repo pattern — see §23 for
one genuine, pre-existing limitation this phase's own fixtures ran into.

---

## 9. P1 HTTP Result

**20/20 passing**, run through the new harness against
`lib/testing/parentPortalP1Convergence.http.integration.test.ts` — exact match to
P1's own documented result. This is the harness's baseline reproduction proof: a
suite P1 ran manually, by hand, in a throwaway environment, now reproduces
identically through one reusable command.

---

## 10. Existing Parent HTTP Result

**19/19 passing**, `lib/testing/parentExperienceConvergence.http.integration.test.ts`,
run through the new harness, file itself completely unmodified by this phase.
Matches P1's own re-run of this suite.

---

## 11. P2 HTTP Result

**13/13 passing** — new file `lib/testing/parentCompassActorBoundary.http.integration.test.ts`,
closing P2's own named gap ("the actual HTTP routes were not exercised end-to-end
with a live `next dev` server," P2 §23/§26). Proves, through real routes:

- `POST /api/learn` — institutional-only guardian 403, legacy guardian 403,
  unrelated parent 403.
- `POST /api/learn/end` — institutional-only guardian 403, legacy guardian 403,
  **learner-self 200** (the mutation still works for the actor it's for).
- `GET /api/learn/progress` — institutional-only guardian 200, legacy guardian 200
  (the P2 fix's whole point — both guardian shapes get identical read access),
  unrelated parent 403.
- `GET /api/holiday/mine` — same pattern, plus an unauthenticated request is 401,
  not a silent 200.

---

## 12. P3 Child-Context Result

**Included in the 14-test file** `lib/testing/parentChildContextConvergence.http.integration.test.ts`
(§13 below has the split). Across all 6 wired subpages (assignments, gradebook,
progress, holiday, journey, history): the linked parent gets 200 with the child's
real rendered name in the HTML (`ChildContextHeader`'s "Viewing {name}" line,
proven via the real DB-backed name, not a stub); an unrelated parent's response
never contains that child's name, first or last, in either name field — proven as
body-content assertions rather than status-code assertions because of a
**pre-existing, already-documented** framework quirk (§17).

---

## 13. P3 Multi-Child Result

Two dedicated tests inside the same file: a parent with Child A + Child B viewing
Child A's Gradebook gets a response containing Child A's name, the literal
"Switch child" affordance, a link to `/child/{Child B's id}`, and Child B's name —
but never Child C's name or id (Child C belongs to a different, unrelated parent in
the fixture). A second test proves the reverse: that same parent hitting Child C's
Gradebook URL never receives Child C's identity in the response.

**14 tests total** in this file (6 pages × 2 assertions + 2 multi-child tests).

---

## 14. Compass ViewerRole Result

**4/4 passing** — new file `lib/testing/parentLearnViewerRole.http.integration.test.ts`.
Confirms the real route `/learn` actually depends on: `GET /api/learn/student`
(`app/api/learn/student/route.ts`'s `shapeAndReturn`, added in P3) returns
`viewerRole: 'parent'|'learner'|'teacher'` correctly for each actor, on both the
explicit-`studentId` branch and the single-student auto-select branch.

The client-rendered half of this contract (disabled subject cards, the parent
banner copy) is **not** provable this way — see §17.

---

## 15. Optional Copy Fix

**NOT DONE.** P3 named a real gap: the pre-existing "Your teacher has a session for
you... tap it below to start" and pending-assignments banners on `/learn` still use
learner-framed copy even when `viewerRole === 'parent'`. The mission authorized
fixing this **only if** a clean, real assertion path existed for it this phase.

It does not: `app/learn/page.tsx` is a single large `'use client'` component whose
`viewerRole`-dependent JSX only exists in the DOM after a client-side `fetch` to
`/api/learn/student` and a React re-render — neither of which a raw HTTP `fetch()`
of `/learn` ever triggers, and neither of which `react-dom/server`'s
`renderToStaticMarkup` (this repo's only existing component-test pattern, see
`components/blueprint/BlueprintView.test.tsx`) can trigger either, since SSR static
rendering never executes `useEffect`. Proving the banner copy would require either
(a) refactoring the component to accept injectable initial state — a real
product-code change well beyond a "narrowly-justified copy fix," or (b) adding
jsdom + a DOM-testing library to this repo solely to exercise one page's client
effects — exactly the "heavy new component-testing framework" the mission
instructed against building just for this. Per the mission's own instruction
("If you can't cleanly test it this phase, report it as a named limitation instead
of guessing at a fix"), this was reported, not guessed at. See §23.

---

## 16. Dedicated New Tests [exact files/counts]

| File | Tests | Suite |
|---|---|---|
| `scripts/parent-http/run-parent-http-harness.mjs` | — (harness script, not a test file) | — |
| `scripts/parent-http/parent-http-tests.json` | — (manifest) | — |
| `lib/testing/parentCompassActorBoundary.http.integration.test.ts` | 13 | parent-http |
| `lib/testing/parentChildContextConvergence.http.integration.test.ts` | 14 | parent-http |
| `lib/testing/parentLearnViewerRole.http.integration.test.ts` | 4 | parent-http |
| `components/parent/ChildContextHeader.test.ts` | 6 | STANDARD |
| **New tests total** | **37** | |

Plus 2 pre-existing suites reproduced unmodified through the new harness (P1: 20,
existing parent: 19) = **70 tests** in one `npm run test:parent-http` run.

---

## 17. STANDARD Separation [confirm preserved]

**Preserved.** `scripts/standard-tests.json` gained exactly one line
(`components/parent/ChildContextHeader.test.ts`) — verified secret-free by an
actual run with `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/
`TEST_SUPABASE_*`/`DEEPSEEK_AI_API_KEY`/`PAYSTACK_SECRET_KEY` all explicitly
unset (6/6 passing), and it mocks `@/utils/supabase/server`, `@/lib/core/identity`,
and `@/lib/repositories` via `mock.module` before ever importing the component
under test — the same pattern `lib/academy/aiJudge.test.ts` and `lib/career/
knowledgeRequests.test.ts` already use, not a new convention. `scripts/
check-standard-manifest.mjs`'s manifest-rot guard passes against it (confirmed by
running the guard, not just asserting it would). The four new `*.http.integration.test.ts`
files are **not** on `scripts/standard-tests.json` or `scripts/deep-tests.json` —
they live only on the new `scripts/parent-http/parent-http-tests.json`, run only
through the new dedicated harness, exactly the "stay scoped to parent HTTP
integration support" instruction.

One pre-existing, well-documented quirk this phase's new HTTP tests had to work
around, not introduce: `next/navigation`'s `notFound()` does not reliably surface
as a raw HTTP 404 to a non-JS `fetch()` client in this Next.js version — the
response is a 200 whose streamed RSC payload carries the not-found marker a real
browser's React runtime would act on. P1's own HTTP suite documented this first
(`parentPortalP1Convergence.http.integration.test.ts`'s §7/§9 comments); this
phase's new child-context tests hit the identical behavior and adopted the same
resolution P1 already established: assert on **body content** (the child's
identity is never present) rather than the transport-level status code, and assert
`status !== 500` as the sanity floor.

---

## 18. CI Readiness

**NEEDS DOCKER-SUPABASE-SERVICE.**

Concrete reasoning: the harness's only two external dependencies are (1) the
`supabase` CLI being installed and (2) Docker being available for it to manage
local Postgres/Auth/Kong containers. Given both, `npm run test:parent-http` needs
no other CI-specific configuration — it self-starts Supabase if not already
running, self-derives its target, self-verifies production-safety, self-builds the
isolated Next server, and self-tears-down. It is explicitly **not** LOCAL-ONLY:
nothing in the harness assumes a developer's own machine, a pre-existing running
dev server, or manual steps. A CI runner with Docker-in-Docker (or a
docker-socket-mounted runner) and the Supabase CLI preinstalled should be able to
run this command exactly as documented in §7, with no further wiring — this phase
did not configure CI itself, per the mission's own instruction not to.

---

## 19. Tests [exact totals]

- **New parent HTTP harness, full manifest** (`npm run test:parent-http`):
  `tests 70 / pass 70 / fail 0`.
- **P1 HTTP suite** (via the harness): `20/20`.
- **Pre-existing parent HTTP suite** (via the harness): `19/19`.
- **New P2 actor-boundary HTTP suite**: `13/13`.
- **New P3 child-context HTTP suite**: `14/14`.
- **New Compass viewerRole HTTP suite**: `4/4`.
- **Existing Compass/identity integration tests** (non-HTTP, re-run against local
  Docker to confirm zero regression — `compassActorBoundary.integration.test.ts`,
  `compassAccess.integration.test.ts`, `lib/core/identity.test.ts`, `lib/core/
  permissions.selforparent.test.ts`, `lib/core/permissions.student-parent.test.ts`):
  `tests 42 / pass 42 / fail 0`, unmodified.
- **STANDARD suite** (`npm test`): `tests 1069 / pass 1069 / fail 0` (1063
  pre-existing + 6 new `ChildContextHeader` tests).
- **`tsc --noEmit`:** clean, zero errors.
- **ESLint** on every file this phase touched: clean, zero warnings.
- **`next build`:** `✓ Compiled successfully`, full route manifest generated, exit
  code 0.

All assertion failures found during development (a fixture name-collision bug in
an early draft of the child-context test, and the `SUPABASE_SERVICE_ROLE_KEY`
harness env bug, §4) were **fixed**, not loosened or skipped, before these final
numbers were recorded.

---

## 20. Files Changed

New (6):
- `scripts/parent-http/run-parent-http-harness.mjs` — the harness.
- `scripts/parent-http/parent-http-tests.json` — the parent HTTP manifest (5 files).
- `lib/testing/parentCompassActorBoundary.http.integration.test.ts` — P2 HTTP proof, 13 tests.
- `lib/testing/parentChildContextConvergence.http.integration.test.ts` — P3 HTTP proof, 14 tests.
- `lib/testing/parentLearnViewerRole.http.integration.test.ts` — Compass viewerRole HTTP proof, 4 tests.
- `components/parent/ChildContextHeader.test.ts` — STANDARD unit coverage, 6 tests.

Edited (2):
- `package.json` — adds the `test:parent-http` script (one line).
- `scripts/standard-tests.json` — adds `components/parent/ChildContextHeader.test.ts` (one line).

**8 files changed total, 0 deletions of existing functionality.** No pre-existing
dirty file from the ~207-file working tree at session start was touched, staged, or
committed — verified by `git status` before every commit in this phase.

---

## 21. Database Changes [expected NONE]

**None.** No migration was written, applied, or found necessary. Every new test
composes existing tables (`schools`, `learners`, `learner_guardians`, `students`,
`teachers`, `compass_sessions`, `token_balances`) through existing `lib/`/`repos`
functions or the existing test-service client only.

---

## 22. Product Behavior Changes [expected NONE except the justified copy-only fix]

**None.** The optional copy fix (§15) was evaluated and explicitly not made. Every
file this phase touched is a test script, test file, test manifest, or this
documentation file — zero lines of production `app/`, `lib/`, or `components/`
non-test code were changed.

---

## 23. Named Limitations

New, found this phase:

- **The optional P3 copy fix (§15) was not made** — no clean, real assertion path
  exists for it without adding a DOM-testing framework this repo doesn't have.
  Recommend: if this copy fix is wanted, it's a small, well-scoped follow-up once
  (if ever) this repo adopts jsdom/testing-library for a broader reason — not worth
  adopting one solely for this.
- **`/learn`'s disabled-subject-cards behavior for a parent viewer is unproven at
  the rendered-DOM level.** The server-side data contract it depends on
  (`viewerRole`) IS proven at the HTTP layer (§14). The client-side rendering that
  consumes it is not, for the same reason as §15.
- **A genuine, structural (not fixture-design) teardown limitation was found and is
  documented, not silently reproduced:** the `parentCompassActorBoundary` suite's
  learner-self mutation test (`POST /api/learn/end`, proving the actual completion
  path a real learner uses) causes the real product code to write a
  `learner_evidence` row via `recordCompassSessionEvidence`'s fire-and-forget path.
  `learner_evidence` rows are enforced immutable by a **database trigger**
  (CLAUDE.md's own standing rule — "never mutated after creation... enforced by a
  database trigger, not just convention"), and that trigger fires on the cascaded
  DELETE from `students` too, not just UPDATE — so this fixture's own `students`/
  `learner_evidence`/auth-user rows for that one test genuinely cannot be deleted
  by any means available to this phase, including the repo's own official
  `scripts/bootstrap-local-db/reap-synthetic-fixtures.sh --execute` reaper, which
  this phase ran and confirmed **also** fails on a separate, pre-existing,
  unrelated FK (`ingestion_runs_teacher_id_fkey`) before it would even reach this
  row. This is the exact class of "known recurring auth-user teardown failure from
  dangling FKs" P2's own closeout named (3 pre-existing unrelated teardown-hook
  failures) — confirmed at real scale this phase (`reap-synthetic-fixtures.sh`'s
  own dry-run: 268 stale `auth.users`, 109 stale `schools`, 87 stale `teachers`
  matching synthetic markers, almost none of it from this phase). Two residual
  synthetic `students` rows (clearly marked `SYNTHETIC_P35_COMPASS_ACTOR_HTTP`,
  harmless, discoverable, and reapable the moment the platform's evidence-trigger/
  ingestion_runs-FK teardown gap is fixed) are left behind by this phase's own
  fixture, from early debugging runs before the harness env bug (§4) was fixed —
  not fixed here, per the mission's explicit instruction not to fix the repo-wide
  teardown bug, only to avoid making it worse and to document it honestly.
- **Minor, accepted duplication:** `createUser`/`grantTokens` helper functions are
  repeated near-verbatim across the three new HTTP test files rather than factored
  into a shared fixture module. Judged not worth a shared-fixture framework for
  three call sites, per the mission's own "don't build a large fixture framework
  for its own sake" instruction — a fourth or fifth file needing the same pattern
  would change that judgment.
- **The pre-existing `notFound()`-under-`fetch()` quirk** (documented first by P1,
  §17 above) means this phase's new "unrelated parent" tests assert on response
  body content rather than HTTP status code — a real, if narrow, gap versus what a
  live browser's actual 404 experience would prove. Not a new limitation this phase
  introduced; adopted the same resolution P1 already established.
- **CI is not configured** (§18 answers readiness only, per the mission's explicit
  instruction not to configure CI in this phase).

Carried forward, unresolved (per P0/P1/P2/P3, unchanged by this phase — listed for
completeness, not re-litigated): four conflicting academic-result surfaces
(Gradebook/Report Card/Blueprint/Academic Clinic); no parent→teacher communication;
three career-report surfaces; Clinic reachable from the shared parent nav despite
being a legacy-space page; Report Card missing a nav entry; Steps 9–16 of P3's
original mission (Attention Model / Parent Action Model / Assignment Preview /
Learning Summary / Recent Change) still not implemented.

---

## 24. P3 Proof Status

**YES.** P3's headline claims — child context surviving navigation into every
`/child/[learnerId]/*` subpage, the multi-child switcher existing and never leaking
an unrelated child, and `/learn`'s server-side `viewerRole` contract resolving
correctly per actor — are now proven at the HTTP/integration layer through real
signed-in sessions against a real running server and a real local database, not
only at the `tsc`/ESLint/`next build`/unmodified-STANDARD-suite level P3 itself
shipped with. The one part of P3 NOT proven at any level beyond code-reading is the
client-rendered disabled-subject-cards behavior (§15/§23) — named honestly rather
than folded into a blanket "YES."

---

## 25. Recommended P4

**PARENT ATTENTION + ACTION MODEL** — P3's own deferred Steps 9–13 (a real "What
needs attention?" aggregation across overdue assignments/Projection risk/
attendance/returned work, and classifying every `ParentAction` into PARENT/
LEARNER/TEACHER/NAVIGATION-ONLY), exactly as P3's own §31 already recommended, now
with a proven HTTP regression harness available to verify it end-to-end as it's
built — rather than shipping another phase's worth of parent-portal behavior
change with only compile-level proof, as P3 itself had to.

Nothing this phase found rises to a more urgent correctness issue that should
displace this recommendation — the one structural finding (§23's evidence-trigger/
`ingestion_runs`-FK teardown gap) is a test-infrastructure hygiene issue, not a
learner-facing correctness bug; it affects nothing beyond dev/test Supabase
cleanliness.
