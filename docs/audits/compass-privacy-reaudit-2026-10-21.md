# Compass privacy re-audit + Engineering AI Tutors publication readiness — 2026-10-21

Scope: Compass (`/api/learn`) learner-data flow to external AI providers, its logging,
the uncommitted Stage B privacy work, and the *Engineering AI Tutors* manuscript's claims.
Method: code tracing on the working tree and on `origin/main`; deployment metadata
(GitHub Deployments API, `vercel inspect`, `vercel env ls` names only); one aggregate,
content-free production query; official provider documentation; synthetic-data tests only.
No real learner data was read, printed, or sent anywhere.

## 1. Executive verdict — **READY FOR LOCAL COMMIT REVIEW**

The uncommitted privacy work was **not correct as found**. It had two bypasses:
- a session summary saved with the real name was fed back into the next prompt
- names ending in letters such as *ũ* or *ĩ* were never matched

Both are fixed locally. A third, pre-existing defect is also fixed: after roughly 10
learner messages, Compass silently fell back from Gemini to DeepSeek's own API (hosted in
the PRC). The fix is covered by tests that inspect the actual provider-bound request
bodies, including the real Gemini SDK's wire body. Each fix was mutation-checked. The full
suite passes, and tsc, lint, the architecture checks and `next build` are all clean.

**Production is unchanged and still has the defect.** Production (`372bb56`, verified)
sends the learner's first name to Gemini, or to DeepSeek on fallback. This is not
"privacy fixed". Nothing is fixed in production until Dennis approves the commit and
deploy, and the post-deploy checks (§11 Stage C) pass.

## 2. Repository baseline (verified)

| Item | Value |
|------|-------|
| Branch / HEAD | `main` @ `372bb56` = `origin/main` (0 ahead / 0 behind) |
| Staged | none |
| Working tree | 61 modified + 42 untracked at start — **two unrelated streams**: Stage B privacy (below) and a Blueprint/parent-report redesign (`components/blueprint/*`, `components/parent/*`, `lib/learnerBlueprint/*`, `lib/parentExperience/*`, marketing pages, i18n) |
| Overlap | Only `scripts/standard-tests.json` and `docs/engineering/implementation-log.md` hold hunks from both streams → stage with `git add -p` |
| Pre-existing stash | `stash@{0}` (cccbb49) — untouched |
| Production deployment | `www.edunexus.co.ke` → Vercel project `edunexus-cbe-analyzer`, production deployment created 2026-10-19 18:48 UTC, status Ready (`vercel inspect`); GitHub Deployments API records `372bb56` → "Production – edunexus-cbe-analyzer" at 18:49 UTC, state success. **Production = `372bb56`; it contains none of the Stage B code.** |
| Functions region | `iad1` (Washington DC, USA) |
| Prod env (names only) | `GOOGLE_GEMINI_API_KEY`, `DEEPSEEK_AI_API_KEY` present; `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`, `AI_LOG_CONTENT` **absent** |

Stage B files: `app/api/learn/route.ts`, `lib/ai/{deepseek,logger}.ts`, `lib/ai/logPolicy.ts`,
`lib/config/api.ts` (+ `api.deepseekProvider.test.ts`), `lib/kiswahili/inshaEvaluator.ts`,
`lib/repositories/analytics.repository.ts` (+ `analytics.aiCallLog.privacy.test.ts`),
`lib/paperIntelligence/{scriptPages,imageMetadata}.ts` (+ test), `lib/compass/namePseudonym.ts`
(+ test). Status: **present, uncommitted, partially correct** (see F2–F5).

## 3. Data-flow map (Compass)

| # | Path | Destination | Data sent / stored | Name handling — production (`372bb56`) | Name handling — local fix |
|---|------|-------------|--------------------|-----------------------------------------|---------------------------|
| 1 | Turn → `streamDeepSeek` → Gemini (primary) | `generativelanguage.googleapis.com` via `@google/generative-ai`, model `GEMINI_PRIMARY` | System prompt: grade, CBC level + provenance, pathway (senior), subject/topic, last-session summary, holiday focus/goal, root cause, action steps, capability/trajectory/risk factors, pedagogy state, KICD topics. Plus learner message and ≤20 history turns (client also repeats the current message inside history) | **Real first name** in the prompt header and opener; summary/goal fields may carry it; learner text verbatim | Token `{{LEARNER}}` in prompt; first name → token and other name parts → `[name]` in message, history and every learner-derived field (`lib/compass/providerPayload.ts`) |
| 2 | Gemini error/timeout (15 s TTFB) **or** history >20 turns → DeepSeek fallback, 1 retry on network error | `https://api.deepseek.com/v1/chat/completions` (no override in prod) | Same as #1 | Same as #1 | Same scrubbed payload (tested, incl. retry); long-session fallback bug fixed |
| 3 | `ai_call_logs` (Supabase) | EduNexus DB | Compass: **never written**. Other features (academy judge, insha, teaching-intel, career knowledge requests): prompt/response ≤500 chars | Content written by deployed code; **table currently has 0 rows** (aggregate query 2026-10-21) | NULL by default (`AI_LOG_CONTENT` gate) |
| 4 | `compass_messages`, `compass_sessions.one_line_summary` | EduNexus DB | Raw learner message, restored reply, summary with real name | By design (learner record) | Unchanged — the record keeps the real name; it is no longer re-sent to providers |
| 5 | Vercel function logs | Vercel (US region) | Structured logs; `console.error` of error objects in the route | Metadata + error messages; provider error bodies on failure | Same; tests show the provider-error and fallback paths log no names or learner text (mocked providers) |
| 6 | Model reply → client | Learner's browser | Stream with token restored split-safely | n/a (name sent in clear) | Restorer verified by existing tests |

Out of Compass scope, sharing the same boundary (from the 10-17 audit, not re-verified here
except where noted): insha essays → DeepSeek raw (stdout dump removed locally); Paper
Intelligence script images → Gemini (EXIF stripped locally); holiday planner / career
engine / auto-report already use the token.

## 4. Findings

| ID | Severity | Where | Evidence | Impact | Action | Tests | Remaining uncertainty |
|----|----------|-------|----------|--------|--------|-------|-----------------------|
| F1 | **Critical (prod)** | `app/api/learn/route.ts` @ `372bb56` (`firstName` into `CompassPromptParams`; `lib/compass/prompt.ts:228,341,345`) | §2 deployment evidence; deployed source | Every Compass turn sends the learner's first name (plus anything they type) to Google; to DeepSeek/PRC on fallback | Commit + deploy the local fix after review (§11) | §6 | Whether learners use Compass in production now (not queried) |
| F2 | **High (local fix bypass)** | route persisted `restoreLearnerName(one_line_summary)` → next turn `Last session: …` unscrubbed | Prompt template asks for `{{LEARNER}} [summary]`; route restores before saving | Name sent every session after the first even with the fix; pre-fix rows contain names | **Fixed**: all learner-derived prompt fields scrubbed in `providerPayload.ts` | `providerPayload.test.ts` D; mutation-checked | — |
| F3 | **High (local fix bypass)** | `namePseudonym.ts` used `\b` (ASCII-only) | Synthetic probe: "Wanjirũ" unchanged | Names ending ũ/ĩ (common in Kikuyu) never scrubbed | **Fixed**: Unicode letter/mark boundaries, accent-insensitive, NFD→NFC | 10 new scrubber tests; mutation-checked | Other scripts/transliterations untested |
| F4 | **High (prod, pre-existing)** | `lib/ai/deepseek.ts` `history.slice(-20)` | Gemini SDK `validateChatHistory` throws if first role ≠ user; Compass history is odd-length so the slice starts with assistant once >20 | After ~10 learner messages every turn goes to DeepSeek's own API (PRC per DeepSeek policy) instead of Gemini | **Fixed**: `trimHistoryForProvider` | routing test, real SDK; mutation-checked | Frequency in prod unknown (no per-provider metrics read) |
| F5 | Medium | `scrubLearnerName` first name only | Code | Surnames/middle names typed by learners were sent | **Fixed**: `scrubLearnerIdentity` → `[name]` | tests | — |
| F6 | Medium (residual, by nature) | Pseudonymisation scope | Design | Other people's names, school, location, phone numbers and free text still go to the provider; grade + level + gaps + school context can still identify a learner indirectly | Do **not** call it anonymised. Next: minimisation review of prompt fields; consider phone/email redaction; DPIA | — | Re-identification risk not quantified |
| F7 | Medium | Name/ordinary-word collisions | Test N | Names like "Hope"/"Will" replace those words in the learner's text (our instructions are never touched) | Accepted, documented, tested | test N | Small effect on tutoring quality |
| F8 | Medium (transparency) | Deployed privacy policy | §7 | Policy names "DeepSeek via Together AI", "anonymised data, United States", Frankfurt; omits Gemini, the PRC and Vercel US functions | Publish corrected policy (draft: `docs/audits/privacy-policy-revision-draft.md`) | — | Legal review |
| F9 | Low | Client sends the current message in history **and** as `message` | `app/learn/page.tsx:623` | Duplicate learner text to provider; tokens | Follow-up (client change) | — | — |
| F10 | Low (reliability; book claim) | Streaming path has no body timeout | `fetchDeepSeekStream` clears timer after headers; Gemini 15 s TTFB only | Stalled stream can hang; Ch5 claim overstated | Follow-up; Ch5 wording in both patches | — | — |
| F11 | Info | Logging | `ai_call_logs` 0 rows; `AI_LOG_CONTENT` unset in prod; dev console content gated | No AI content at rest in that table now | None | `analytics.aiCallLog.privacy.test.ts`, test K | Vercel log retention/content not inspected; provider-side logs out of reach |

## 5. Implementation changes (all **uncommitted**)

| File | Change | Why |
|------|--------|-----|
| `lib/compass/namePseudonym.ts` | Unicode-aware, accent-insensitive matcher; `scrubLearnerIdentity` (other name parts → `[name]`); ≥2-letter guard | F3, F5 |
| `lib/compass/providerPayload.ts` (new) | Single builder of the provider-bound payload; scrubs an explicit list of free-text fields before `buildCompassPrompt`, never the instruction text | F2; one testable boundary; keeps the route thin |
| `app/api/learn/route.ts` | Uses `buildCompassProviderPayload`; `promptParams` typed without `firstName` | F2, boundary |
| `lib/ai/deepseek.ts` | `trimHistoryForProvider` (history starts with a user turn) | F4 |
| `lib/compass/providerPayload.test.ts` (new) | 11 tests on the final payload (cases A–H, M, N) | — |
| `lib/ai/streamDeepSeek.privacy.test.ts` (new) | 7 tests: real Gemini SDK wire body, DeepSeek fallback, retry, HTTP error, logs, long-session routing, trim | I, J, K |
| `lib/compass/compassProviderBoundary.architecture.test.ts` (new) | Route must call the provider only with `providerPayload.*` | Route wiring |
| `lib/compass/namePseudonym.test.ts` | +10 tests | — |
| `scripts/standard-tests.json` | +3 manifest entries | Runner only runs listed files |

The earlier 10-17 Stage B changes were reviewed and kept as they were: log gate, insha
stdout fix, EXIF strip, env-driven DeepSeek host, split-safe restorer.

## 6. Test results (executed)

| Command | Result |
|---------|--------|
| `npm test` (full STANDARD manifest) | **1744 pass, 0 fail** (1724 before additions) |
| `node --experimental-test-module-mocks --import tsx --test` on the 3 new/changed privacy files | 17/17 + scrubber tests pass |
| Mutation checks (revert trim / summary scrub / Unicode matcher / surname scrub / route wiring) | Each caught by ≥1 failing test; files restored byte-identical (`cmp`) |
| `npx tsc --noEmit` | exit 0 |
| `npx eslint` on changed files | 0 problems |
| `npm run lint` | 0 errors, 38 pre-existing warnings (none in changed files) |
| `node scripts/check-architecture.mjs` / `check-route-auth.mjs` / `check-standard-manifest.mjs` | pass / pass / 202 files OK |
| `npx next build` | exit 0; 2 pre-existing Turbopack warnings (`lib/growth/services/csvImport.ts`) |
| DEEP / HTTP CI suites (need local Supabase) | **Not run** |

Not covered by tests: the live Gemini/DeepSeek services (no real calls), Vercel log
content, the client page.

## 7. Provider and cross-border review

| Category | Item |
|----------|------|
| **Verified implementation facts** | Gemini is primary for Compass and DeepSeek is the fallback (`streamDeepSeek`). The DeepSeek endpoint in prod is `api.deepseek.com/v1` (no override set). Functions run in Vercel `iad1` (US). The DB is Supabase (owner-confirmed eu-north-1 on 2026-10-17; not re-verified here). Production sends the first name; the local fix sends a token. |
| **Verified provider documentation** (fetched 2026-10-21) | DeepSeek privacy policy (updated 2026-02-10): personal data is "collect[ed], process[ed] and store[d] … in People's Republic of China"; training on user input with an opt-out right. **Its scope excludes data from downstream apps built on the open platform**, so API use falls under the open-platform terms (not fetched). Gemini API terms (updated 2026-04-28): Paid Services — Google "doesn't use your prompts or responses to improve our products". Prompts and responses are logged "for a limited period of time" for abuse detection, period unspecified. "You must be 18 years of age or older to use the APIs." |
| **Configuration-dependent** | Whether the Gemini key is on a paid billing account (owner said yes on 2026-10-17; not verified here). DeepSeek → EU host needs `DEEPSEEK_BASE_URL`/`DEEPSEEK_MODEL` plus a contract. Vercel function region. |
| **Contractual questions** | DeepSeek open-platform terms: retention, training, location for API traffic. Google DPA / data-processing terms for the Gemini API and the abuse-log retention period. Vercel DPA. Processor agreements generally. |
| **Legal questions (qualified review)** | Kenya DPA 2019: lawful basis and parental consent for processing children's data (s.33); transfers outside Kenya (ss.48–50) to the US/PRC; the transparency duty (s.29) given the policy mismatch (F8); data-minimisation (s.25); ODPC registration and a DPIA. Whether a Gemini API "18+" term is satisfied when the developer is an adult processing minors' data. **No compliance conclusion is drawn here.** |

## 8. Production verification

- **Verified:** the deployed revision (`372bb56`), that it lacks Stage B, the prod env
  variable names, and that `ai_call_logs` is empty.
- **Unverified:**
  - actual provider traffic
  - whether Compass is in active use
  - Vercel log contents
  - provider-side retention
  - the Gemini billing tier
- **Missing evidence needed for Path A:**
  - a post-deploy synthetic Compass session
  - proof that the deployed provider request carries the token, e.g. a temporary
    staging-only payload probe, or confirming through the Stage C steps below

## 9. Book claims audit (*Engineering AI Tutors*, repo HEAD `6f99cb6`)

| Claim | Location | Code | Tests | Production | Verdict | Action |
|-------|----------|------|-------|------------|---------|--------|
| "Compass runs exactly such a gate"; strict schema → no state on malformed input; impossible "passed" downgraded; mastery withheld while a re-check is open | Ch4 §"A gate in code" | `lib/compass/pedagogy.ts` (`safeParse`, downgrade at l.109, `shouldBlockMasteryForPedagogy`); route l.627 | `pedagogy.test.ts` (13) | Present in `372bb56` | VERIFIED IN CODE · TESTED LOCALLY · VERIFIED IN DEPLOYED PRODUCTION (code revision) | Keep |
| A privacy layer strips the learner's name before text reaches the provider | Ch1 "What runs in production" | Local only | Local | **Not deployed** | CONTRADICTED BY EVIDENCE (prod); TESTED LOCALLY | Path A: deploy + verify; Path B: patch |
| Compass strips the first name from every outgoing message; split-safe restore | Ch7 bullet 2 | Local only (now broader) | Local | Not deployed | CONTRADICTED (prod); TESTED LOCALLY | Both patches reword |
| Raw AI content logging defaults off; only metadata recorded | Ch7 bullet 3 | Gate local only; Compass never logs to `ai_call_logs`; transcript stored by design | Local | Gate not deployed; table empty | NOT VERIFIED (prod) / misleading about the transcript | Both patches add the record-vs-log distinction |
| "Where a pattern is described as running in production, it is" | Front matter | — | — | — | True only after Path A **or** Path B is applied | — |
| "Used in a Kenyan school pilot" | Front matter, Ch1 | — | — | No evidence gathered | NOT VERIFIED | Removed in both patches |
| Wrapper arms an abort timer around the entire request-and-parse sequence (attributed to Compass) | Ch5 | True for `callOnce` (non-streaming) only | — | — | CONTRADICTED for Compass streaming | Reworded in both patches |
| `deepseek.ts` fronts more than one provider | Ch5 | Gemini + DeepSeek | — | Yes | VERIFIED IN CODE | Keep |
| History bounded to a recent window | Ch5 | `MAX_HISTORY = 20` | new tests | Yes | VERIFIED | Keep |
| Parent may view but not drive a session | Ch6 | `resolveCompassMutationAccess` | integration tests exist (not run here) | In `372bb56` | VERIFIED IN CODE | Keep |
| README / landing page | — | Claim only the tested reference code; pseudonymisation is labelled "described, not implemented here" | — | — | Consistent | Author name now "Dennis Kariuki" (uncommitted) |

## 10. Publication recommendation

**Path A (ship the fix) is preferred, but it is not yet achieved, so the book is not
publishable today.**

**If you take Path A:**
1. Approve, commit and deploy the fix.
2. Pass Stage C.
3. Apply `LAUNCH-PRIVATE/09-path-a-manuscript.patch` in the book repo.
4. Rebuild and recheck the PDF.

**If you take Path B:**
1. Apply `LAUNCH-PRIVATE/08-path-b-manuscript.patch` instead. It states plainly that the
   privacy layer is built and tested but not deployed, and records the two defects as the
   lesson.
2. Rebuild the PDF.

Both patches remove the pilot claim and fix the Ch5 timeout wording, and both pass
`git apply --check`. The PDF is rebuilt with the same pipeline that produced
`exports/Engineering-AI-Tutors-Review-Copy.pdf`. Check the page count and the changed
paragraphs (pdf-render-audit procedure in `docs/reviews/pdf-render-audit.md`).

## 11. Release checklist (in order)

**Stage A — pre-release:**
1. Review the full Stage B diff, including this pass.
2. Stage only the privacy files, plus the privacy hunks of `standard-tests.json` and the
   log, with `git add -p`.
3. Rerun `npm test`, `tsc`, lint, the architecture checks and `next build`.
4. No migration is needed (the `ai_call_logs` columns are already nullable).
5. Approver: Dennis.

**Stage B — deploy:**
1. Push to `main` (Vercel deploys automatically), only after explicit approval.
2. Confirm with `vercel inspect` that `www.edunexus.co.ke` points at the new deployment.

**Stage C — verify, with a synthetic account only:**
1. Run one Compass session for a synthetic learner whose name ends in "ũ".
2. Exceed 10 messages in that session.
3. Confirm the replies greet the learner by name. This shows restoration works.
4. Confirm the session summary was saved.
5. Confirm no errors appear in the Vercel logs for `/api/learn`.
6. Check whether a "falling back to DeepSeek" warning appears. It shouldn't, unless
   Gemini is actually unavailable.
7. Confirm `ai_call_logs` content is still null with an aggregate query.

To confirm the outbound request itself, run the same synthetic session on a preview
deployment pointed at a request-capturing test endpoint. Never inspect provider logs.

**Stage D — rollback:**
- **Triggers:** Compass 5xx, missing or garbled names in replies, or failure to stream.
- **How:** use Vercel instant rollback to the previous deployment.
- **Warning:** a rollback restores the name-sending code (F1). Prefer a forward fix.
  If you must roll back, consider pausing Compass instead of serving the old code.

**After that:**
1. Publish the corrected privacy policy.
2. Get legal review of the §7 questions.
3. Choose and apply the manuscript path.

## 12. Decisions for Dennis

1. Approve committing the Stage B changes, including this pass. Nothing has been
   committed.
2. Approve the production deploy and the Stage C synthetic verification.
3. Choose manuscript Path A or Path B.
4. Publish the corrected privacy policy, and arrange legal review (§7). This covers:
   - children's data, consent and cross-border transfer
   - the Gemini 18+ term
5. Keep DeepSeek (PRC) as the fallback, move it to an EU host (env plus contract), or
   remove the fallback.

## 13. Final diff summary

**EduNexus — changes this pass, all uncommitted:**
- 5 files modified (route, `deepseek.ts`, `namePseudonym.ts`, `namePseudonym.test.ts`,
  `standard-tests.json`)
- 4 files created (`providerPayload.ts` + test, `streamDeepSeek.privacy.test.ts`, the
  boundary test)
- this report

**Book repo — changes this pass, all uncommitted:**
- `README.md`, `site/index.html`, `site/og-image.html` and `site/og-image.png` (author name)
- `LAUNCH-PRIVATE/` (gitignored): two manuscript patches, the sales-path licensing
  caveat, and the profile-name change

No manuscript file was changed.

**Nothing was committed, pushed, deployed, published or made public/private, and no
production data was modified.** External transmission was limited to:
- read-only GitHub and Vercel metadata calls
- one aggregate read-only SQL query that returned no rows
- fetches of two public provider documentation pages
