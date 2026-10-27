# Compass privacy release — readiness report (2026-10-21, second pass)

Continues `compass-privacy-reaudit-2026-10-21.md`; findings there were re-verified, not
assumed. Local file, deliberately **not** for commit: the repo is public, and sibling audit
docs contain personal contact details.

## 1. Executive verdict — **READY FOR COMMIT REVIEW**

**Why it's ready for review:** the privacy change is complete for what it claims. It was
tested **in isolation** (HEAD plus only the privacy files, Blueprint work absent) through:
- tsc
- eslint
- the architecture, route-auth and manifest gates
- the full standard suite: 1702/0
- `next build`
- the repo's own pre-commit secret scanner

**Why it isn't "ready for deployment approval":**
- Nothing is committed yet.
- The database-backed and HTTP suites have not run.
- Two decisions affect what *should* ship to learners: the Gemini under-18 term and the
  DeepSeek fallback.

**Production is unchanged.** It still sends learners' first names. Compass has been idle
in production since 11 Aug 2026.

## 2. Current repository state

| Item | Observed | Evidence | Confidence |
|------|----------|----------|------------|
| Branch / HEAD / origin | `main` @ `372bb56`, 0/0 vs `origin/main` | `git rev-list` after `git fetch` | High |
| Staged | nothing | `git diff --cached` | High |
| Privacy changes | uncommitted; unchanged since report 1 except today's additions (§8) | mtimes + diffs | High |
| Blueprint work | untouched, uncommitted | `git status` (88 entries) | High |
| Shared files | only `scripts/standard-tests.json` (7 privacy + 4 Blueprint entries). `implementation-log.md` diff is privacy-only | hunk review | High |
| Production revision | `372bb56`, deployment created 2026-10-19 18:48 UTC, Ready, aliased to www/apex | `vercel inspect`, GitHub Deployments API | High |
| Privacy fixes on remote | none | `origin/main` content | High |
| Manuscript patches | both still `git apply --check` clean | book repo | High |
| Deploy trigger | Vercel Git integration on push to `main`; CI does not gate it | `ci.yml`, Vercel project | Medium-high |
| Preview environment | shares prod `NEXT_PUBLIC_SUPABASE_URL`; no AI keys → not an isolated test env | `vercel env ls preview` (names only) | High |

## 3. Verified data flow (after the change)

```
learner message, client history ─┐
students.name ──► identity        │
student_learning_context ─────────┼─► buildCompassProviderPayload ──► streamDeepSeek
compass_sessions.one_line_summary ┤     (name parts removed from every     │
client lockedSubject/Substrand ───┘      learner-derived field; prompt      ├─► Gemini (primary, real SDK)
                                         instructions untouched)            └─► DeepSeek api.deepseek.com
                                                                                 (fallback + 1 retry,
                                                                                  same payload)
reply stream ◄── makeNameRestorer (token → real first name, split-safe) ◄────────┘
compass_messages / compass_sessions ◄── stored with real name (learner record, EU DB)
```

**Sent to the provider:**
- grade
- CBC level and its provenance
- pathway (senior learners)
- subject and topic
- the last-session summary
- the holiday focus, goal, root cause and action steps
- the capability/trajectory/risk block
- the pedagogy state
- KICD topics
- the learner's message and up to 20 history turns

**Removed by this change:** the learner's stored first, middle and surnames from all of
those.

## 4. Privacy findings

| ID | Sev. | Location | Evidence | Mitigation (local) | Tests | Residual |
|----|------|----------|----------|--------------------|-------|----------|
| F1 | Critical (prod) | `app/api/learn/route.ts` @ `372bb56` | Deployed source + deployment metadata | This release | §7 | Until deployed. Historical: 52 sessions / 10 learner accounts (29 May–11 Aug) sent first names |
| F2 | High | summary loop-back | Prompt template + route | `providerPayload.ts` scrubs learner-derived fields | payload test D (mutation-checked) | — |
| F3 | High | ASCII `\b` | Synthetic probe | Unicode-bounded, accent-insensitive matcher | 10 tests (mutation-checked) | Unseen scripts untested |
| F3b | Medium (**new today**) | apostrophe names | Probe: stored `Ng'ang'a` vs typed `Ng’ang’a` / `Nganga` missed | Apostrophes optional and interchangeable | +2 tests | — |
| F4 | High (prod, pre-existing) | `history.slice(-20)` | Gemini SDK `validateChatHistory`; reproduced with the real SDK | `trimHistoryForProvider` | routing test, real SDK (mutation-checked) | — |
| F5 | Medium | first name only | Code | surname/middle → `[name]` | tests | — |
| F6 | Medium (residual) | scope | Design | none — **by design this is name removal / pseudonymisation, not anonymisation** | — | Classmates', teachers' and school names, places, phone numbers, unique details, indirect combinations |
| F12 | Low (**new today**) | `console.error(parseErr)` for eval block | V8 quotes about 10 chars of input (shown with a synthetic marker) | Log error type + length only | architecture test (mutation-checked) | `[learn] FATAL` may still echo about 10 chars of a malformed *client* body (normally `{"message"`) |
| F13 | **High (contractual)** | provider choice | Gemini API Terms §Age Requirements, quoted in §13 | none in code | — | Needs a decision and counsel |
| F8 | Medium | live privacy policy | §13 | draft updated | — | publish after deploy |

**Narrowest recommended next minimisation steps (not in this release):**
1. Send the current message once. Today it is duplicated: once inside history and once
   separately.
2. Optionally redact phone-number and email patterns in learner text. This needs an
   educational-impact check first, because maths answers can contain digit strings.
3. Review whether the risk-factor and summary text is needed each turn.

## 5. Provider and fallback review

- **Gemini:** the primary provider for every Compass turn. It is reached through
  `@google/generative-ai` and its SDK validates role order. Failure modes are a 15 s
  time-to-first-byte timeout and SDK/HTTP errors.
- **DeepSeek:** the fallback on any Gemini error. It calls `api.deepseek.com/v1` (no
  override set in prod) and retries once on network error or abort. It gets the
  **identical scrubbed payload**, which tests prove for the fallback, the retry and the
  error path.
- **Is the fallback silent?** It is logged (`warn: Gemini stream failed — falling back to
  DeepSeek`) but invisible to users, and nothing alerts on it.
- **Where data is processed:** I have not inferred this from hostnames. It comes from the
  providers' own documents (§13).

**Fallback options:**

| Option | Privacy | Operations | Recommendation |
|--------|---------|------------|----------------|
| Retain direct DeepSeek | Minors' tutoring text goes to a PRC provider whose API terms are silent on retention/training and governed by PRC law | Best availability | Not recommended for learner data |
| Disable temporarily | No PRC transfer | Compass errors whenever Gemini fails | Acceptable now: Compass is idle |
| **Require explicit configuration** (fallback only when an approved host is set, e.g. an EU DeepSeek host via `DEEPSEEK_BASE_URL`, otherwise fail with a clear learner-facing message) | Transfers only to a reviewed host | Small code change, reversible, no behaviour change once configured | **Recommended**, as a separate small follow-up change after you decide |
| Replace with a reviewed alternative | Depends on the contract | Most work | Longer-term, tied to F13 |

## 6. Logging and persistence

| Layer | Verified (application-controlled) | Not verified |
|-------|-----------------------------------|--------------|
| App logs (Vercel) | Every log line on the Gemini, fallback, retry and error paths contains no name and no learner text (test K). The eval-parse log was fixed. Dev console content is gated by `AI_LOG_CONTENT` (unset in prod) | Actual Vercel log contents/retention, and whether Vercel's runtime adds request metadata |
| DB persistence | `ai_call_logs`: Compass never writes it, other features get NULL content by default, the table has **0 rows** (count only). `compass_messages`/`compass_sessions` hold the learner's words and name **by design** (learner record, EU DB) | Retention period for the transcript (policy question); backups (Supabase-managed) |
| Provider retention | — | Gemini abuse logs ("limited period", unstated). DeepSeek API retention not stated anywhere |
| Provider training | — | Gemini paid tier excludes training *if* the key is on billing (not verified today). DeepSeek unknown for the API |
| Analytics | `@vercel/analytics` on all pages; `/learn?student=<uuid>` | Whether query strings are collected (pseudonymous UUID only, no names) |
| CI output | Tests use synthetic names only; the scanner passes | — |

## 7. Test results (all actually executed today)

| Command | Tree | Result |
|---------|------|--------|
| `npm test` | privacy-only isolated worktree | **1702 pass / 0 fail** |
| `npx tsc --noEmit` | isolated | exit 0 |
| `npx eslint <changed files>` | isolated | 0 problems |
| `check-architecture` / `check-route-auth` / `check-standard-manifest` | isolated | pass / pass / 198 files OK |
| `npx next build` | isolated (own `npm ci`; the first attempt failed only because Turbopack rejects a symlinked `node_modules`) | exit 0 |
| `bash scripts/hooks/pre-commit` (real secret scanner on the exact 20 staged files) | isolated | **first run BLOCKED** on long dummy key strings in a test; fixed to `'test-key'`; second run passed |
| `npm test` + `tsc` | main working tree (privacy + Blueprint) | 1747 pass / 0 fail; tsc exit 0 |
| Privacy files only (`--experimental-test-module-mocks`) | main | 40/40 |
| Mutation checks (trim, summary scrub, Unicode, surname, route wiring, eval-log) | main | each caught; originals restored byte-identical |
| **Skipped:** DEEP and HTTP suites | — | They need an isolated Supabase. The running local stack can't be confirmed free of real learner data, and production must not be a substitute. **CI runs both on a PR to `main`**, so use that (§10) |

## 8. Change summary

**Privacy release, 20 files.**

Modified:
- `app/api/learn/route.ts`
- `lib/ai/deepseek.ts`
- `lib/ai/logger.ts`
- `lib/config/api.ts`
- `lib/kiswahili/inshaEvaluator.ts`
- `lib/paperIntelligence/scriptPages.ts`
- `lib/repositories/analytics.repository.ts`
- `docs/engineering/implementation-log.md`
- `scripts/standard-tests.json` (privacy entries only)

New:
- `lib/ai/logPolicy.ts`
- `lib/ai/streamDeepSeek.privacy.test.ts`
- `lib/compass/namePseudonym.ts` + test
- `lib/compass/providerPayload.ts` + test
- `lib/compass/compassProviderBoundary.architecture.test.ts`
- `lib/config/api.deepseekProvider.test.ts`
- `lib/paperIntelligence/imageMetadata.ts` + test
- `lib/repositories/analytics.aiCallLog.privacy.test.ts`

Added today:
- apostrophe-tolerant matching
- the eval-log fix and its guard test
- the secret-scanner-safe test key
- the 21 Oct implementation-log entry

**Excluded deliberately:**
- all Blueprint/parent-report/marketing/i18n work
- the 4 Blueprint manifest entries
- `docs/audits/*` and `docs/security/*` (public repo; two of these contain personal contact
  details and detailed vulnerability write-ups)
- `reports/`, `research_notes/`, `Untitled-1.json`

## 9. Commit review — **no commit has been created**

**Exact staging (reproduces the tested tree byte-for-byte):**
```sh
git apply --cached docs/audits/compass-privacy-release.patch   # sha256 29091d56f3565113…
git diff --cached --stat        # expect 20 files, +1353/-34 approx.
```
After this, your working tree still holds the Blueprint changes, including the 4 Blueprint
manifest entries, as unstaged. They're untouched.

**Proposed message:**
```
security: keep learner names out of Compass AI requests; fix long-session provider fallback 🔒

- Single provider-bound payload builder (lib/compass/providerPayload.ts): removes the
  learner's stored name parts from the message, history and every learner-derived prompt
  field before the prompt is built; the model sees a token, the name is restored locally.
- Name matching: Unicode letter boundaries, accent-insensitive, apostrophe-tolerant;
  surname/middle names removed too. Name removal / pseudonymisation — not anonymisation.
- Long sessions no longer silently fall back from Gemini to DeepSeek (history now starts
  on a user turn).
- AI call logs keep metadata only unless AI_LOG_CONTENT=true; insha and Compass eval
  parse errors no longer log model/learner text; Paper Intelligence strips image
  metadata; DeepSeek host is env-configurable.
- Tests inspect the real outbound request bodies (Gemini SDK, DeepSeek fallback, retry).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

**Limitations to accept:**
- other people's names and other identifying text still reach the provider
- names that are ordinary words ("Hope") get scrubbed in learner text
- the streaming body still has no timeout

**Rollback note:** rolling back restores name-sending. Fix forward instead. Compass has no
runtime off-switch.

## 10. Deployment plan — **no deployment has occurred**

**A. Pre-deploy** (Dennis approves each step):
1. Stage with the patch above, then commit.
2. Push to a branch (`fix/compass-privacy`) and open a PR to `main`. CI runs typecheck,
   lint, the gates, STANDARD, and the **DEEP and HTTP suites on an ephemeral Supabase**,
   closing the §7 gap.
3. Vercel will build a preview. It can't run Compass (no AI keys), so ignore it for
   verification.
4. No migration. No environment change needed.
5. Decide F13 and the fallback option before merging, if either should change what ships.

**B. Deploy:**
1. Merge the PR into `main`; Vercel deploys production.
2. Confirm the deployed SHA with `vercel inspect https://www.edunexus.co.ke` and the GitHub
   Deployments API.

**C. Post-deploy verification** (needs explicit approval, because it creates synthetic rows
in the production DB and sends synthetic text to Gemini):
1. Use a dedicated synthetic learner named `SYNTHETIC_LEARNER_WANJIRU_TEST`, with a display
   first name ending in "ũ".
2. Run one Compass session past 12 messages. The replies should greet by name, which shows
   the token round-trip works.
3. `vercel logs` for `/api/learn` should show **no** "falling back to DeepSeek" warning
   and no errors.
4. The session summary should be saved.
5. An aggregate query should still show `ai_call_logs` content as null.

**What this cannot prove:** the actual bytes sent to Google in production. The evidence
will be:
- deployed SHA = tested SHA
- CI on that SHA
- the behavioural signals above

The book's Path A wording must not claim more than that.

**D. Stop or rollback triggers:**
- 5xx errors on `/api/learn`
- names missing or garbled in replies
- streams failing

Fix forward. If a rollback is unavoidable, accept that it re-exposes names, or ship a
one-line change that disables Compass instead.

## 11. Production status

**Known:**
- the deployed revision (`372bb56`) and the fact that it lacks this fix
- the env variable names
- `ai_call_logs` is empty
- Compass usage: 52 sessions, 10 accounts, last on 11 Aug

**Unknown:**
- whether those 10 accounts are real learners or test accounts (not inspected, by design)
- provider-side retention of those historical requests
- the Gemini billing tier
- Vercel log contents

## 12. Book claims audit

Unchanged from report 1 §9. Today's checks:
- Both patches still apply cleanly.
- No Compass session since 11 Aug, which further undercuts the school-pilot wording. Both
  patches remove it.
- The Chapter 5 timeout correction is still supported by the code: the whole-call timer
  exists only in non-streaming `callOnce`.
- **The PDF was not regenerated.** The original build script is gone (it lived in an
  earlier session's scratch folder) and WeasyPrint isn't installed. A new pipeline would
  change the layout, so it isn't the "correct tools and inputs".
- **The review PDF copies on the Desktop and in `exports/` contain the false claims. Do
  not distribute them.**

## 13. Privacy policy and legal review

Proposed wording is in `docs/audits/privacy-policy-revision-draft.md`, section "2026-10-21
UPDATE". It is draft only, with deploy-dependent paragraphs marked ⏳.

**Verified provider terms (fetched today):**
- **Gemini API Terms** (updated 2026-04-28), §Age Requirements: "You must be 18 years of age
  or older to use the APIs. You also will not use the Services as part of a website,
  application, or other service that is directed towards or is likely to be accessed by
  individuals under the age of 18." Paid data "may be stored transiently or cached in any
  country in which Google or its agents maintain facilities"; Google "logs prompts and
  responses for a limited period of time" for abuse detection.
- **DeepSeek Privacy Policy** (2026-02-10): processes and stores personal data in the PRC.
  Its scope excludes developers' downstream apps.
- **DeepSeek Open Platform Terms** (effective 2026-04-29): governed by PRC law. Silent on
  API data retention, training and location.

**Questions for qualified Kenyan counsel:**
1. The Gemini under-18 term as it applies to Compass. This is the most serious.
2. Lawful basis and parental consent for children's data (DPA 2019 s.33).
3. Transfer safeguards for the US/PRC (ss.48–50).
4. The transparency duty (s.29), given the published policy's inaccuracies.
5. Whether the historical sending of 52 sessions' first names requires any notification.
6. ODPC registration and a DPIA.
7. Transcript retention period.

**No compliance conclusion is drawn here.**

## 14. Publication readiness — **Path B now**

**Path A can replace Path B only when all of these are true:**
- §10 B and C are complete
- the deployed SHA matches
- the synthetic verification passes
- the Path A wording describes "deployed and tested" rather than "observed in production
  traffic"

**Checklist:**
- **Technical blockers:**
  - the commit
  - DEEP/HTTP tests (in CI)
  - the deploy
  - Stage C
  - the PDF pipeline rebuilt and the PDF inspected
- **Privacy-policy blocker:** publish corrected wording that matches the deployed code.
- **Legal:** §13 items 1–7.
- **Author decisions:** Path A or B; the sales model (licensing note: a paid PDF of a CC
  BY-NC-ND text is not exclusive).
- **Commercial:** platform, price, and Kenyan payout. None is set, and no purchase link
  exists.
- **Optional:** the minimisation follow-ups (§4), a streaming body timeout, and a Compass
  runtime kill switch.

## 15. Approvals required from Dennis

1. Stage and commit using §9.
2. Push a branch and open the PR (this publishes the diff in the public repo).
3. Merge, which deploys to production.
4. Run the Stage C synthetic production session, which writes synthetic rows and sends
   synthetic text to Gemini.
5. The DeepSeek fallback option (§5).
6. How to handle the Gemini under-18 term (F13), with counsel.
7. Book Path A or B, and publishing the privacy policy.

## 16. Safety declaration

| Action | Performed? |
|--------|-----------|
| Committed | **No** (in the main repo; a throwaway worktree index was staged and then removed) |
| Pushed | **No** |
| Deployed | **No** |
| Published (book, site, policy) | **No** |
| Repo visibility changed | **No** |
| Production data/config changed | **No** |
| Sent to an AI provider | **No.** All provider calls were intercepted by a local fake `fetch` |
| External requests made | Read-only: `git fetch`; `npm ci` in the throwaway worktree (package cache/registry); the GitHub Deployments API; `vercel inspect`/`env ls` (names only); 2 aggregate count queries on prod (`ai_call_logs`, `compass_sessions`), no content returned; 3 public provider-terms pages |
| Real learner data viewed | **No** (only counts) |
