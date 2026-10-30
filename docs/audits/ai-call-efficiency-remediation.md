# EduNexus: AI Call Efficiency Remediation Report

**Date:** 2026-10-30
**Source audit:** [`ai-call-efficiency-deep-audit.md`](./ai-call-efficiency-deep-audit.md). It is left unchanged as the historical record.
**Branch / base:** `feat/growth-reply-loop` @ `00f5dd8`.

**State of the changes:**
- Uncommitted, not pushed, not deployed.
- No migration applied to any database. The new migration was validated against the local Postgres inside a transaction that was rolled back.

**Scope rule:** every finding was re-verified against current source before it was changed. Where the audit and the code disagreed, the code won (§B, "Discrepancies").

**Evidence labels:**
- **[TESTED]**: covered by a test that ran and passed in this session.
- **[TYPED]**: type-checks and lints, but its test was not run (DEEP tier, no test database).
- **[UNVERIFIED]**: needs production data or provider billing to confirm.

---

## A. Executive summary

**What is fixed**

1. **Daily AI caps now count.** Each capped operation reserves a quota row before its AI work and releases it on failure.
   - All 14 capped AI entry points reserve under their own feature key. Three of them (class reports, insha, quick check) had a configured limit that was never checked at all.
   - Concurrent requests cannot over-admit. **[TESTED]**
2. **Request multiplication is bounded.**
   - The router's worst case drops from 6 provider requests to 3. A variant tier drops from 24 to 12.
   - SOW and lesson-plan loops stop on a provider failure instead of replaying the whole fallback chain 5× or 3×.
   - Gemini timeouts now abort the real HTTP request, and every Gemini path has a timeout.
   - DeepSeek 429/5xx now fall back to Gemini. **[TESTED]**
3. **Compass sends no learner name to either provider.**
   - The prompt builder has no name parameter.
   - The learner's message, stored history and last summary are pseudonymised.
   - The reply is restored locally, including when the placeholder is split across stream chunks.
   - History now comes from the server, not the browser. **[TESTED]**, including the primary and fallback HTTP bodies.
4. **Unsupported root-cause diagnoses stopped.** Ambiguous counters now give `UNKNOWN`; the Gemini guess is gone. **[TESTED]**
5. **Three AI calls removed outright:** the TIE root-cause fallback, the TIE weekly note, and lesson reflection suggestions. All three are deterministic now. **[TESTED]**
6. **Class reports no longer overwrite** knowledge-graph-derived `session_goal` / `guided_topics`. A failed AI briefing is reported as an error, not `ok`, and is not charged. **[TESTED]**
7. **Lesson-plan weeks skip already-planned lessons before any AI call.** One failed lesson no longer discards the rest, and partial success is shown in the UI. **[TESTED]**
8. **Career Intelligence narratives are reused** while their inputs are unchanged: no model call, no charge, no daily-cap unit on re-open. **[TESTED]** This needs one new table, so its migration must be applied (§I).
9. **SOW no longer asks the model to echo official KICD fields.** All five official fields are now set server-side, which also fixes competencies, values and PCIs previously keeping model paraphrases. **[TESTED]**
10. **Per-request usage telemetry**, covering every DeepSeek and Gemini request in production code:
    - feature, call site, logical-call id and attempt number;
    - provider and model;
    - outcome and error kind;
    - prompt/completion/total tokens with `usage_source: provider | unavailable`.
    It never records prompts, completions or identifiers. **[TESTED]**

**What remains:** see §J. The main items are:
- Paper Intelligence has no daily cap; adding one needs a product decision.
- Per-turn Compass spend inside a session is still bounded only by token deduction.
- The class-report LLM step is retained, not replaced.
- The CI schema-fingerprint pin must be recomputed for the new migration before CI will pass.

---

## B. Findings disposition

| Audit ID | Finding | Disposition |
|---|---|---|
| F-01 | Daily caps inert for 10/11 features | **Fixed.** Reservation model; 14 entry points; 3 previously unchecked caps now enforced |
| F-02 / PR-1 | Compass sends first name to providers | **Fixed** for the stored first name, in every provider-bound channel. Limitation: other names typed by the learner (§G) |
| F-03 / D-1 | Class-report LLM overwrites graph targets; failure counted `ok` | **Partially fixed.** Overwrite and honesty fixed; the LLM step is retained (see Discrepancies) |
| F-04 | Router nested fallback, ≤6 requests | **Fixed.** ≤3; health recorded once per real provider |
| F-05 / AI-16 | Ungrounded root-cause AI | **Fixed.** Deterministic, `UNKNOWN` when evidence can't tell |
| F-06 | generate-week pays then discards; `Promise.all` loses siblings | **Fixed** |
| F-07 / AI-07 | Reflection suggestions | **Fixed.** Deterministic templates; AI call removed |
| F-08 | No per-feature telemetry | **Fixed** (structured logs; see §J for persistence) |
| F-09 / AI-17 | TIE weekly note | **Fixed.** Deterministic template |
| F-10 | Career report regenerated and re-charged per view | **Fixed in code.** Effective once the migration is applied (§I) |
| F-11 | Remedial/holiday JSON-only default system prompt | **Fixed.** Explicit plain-text system prompts |
| F-12 | Timeouts, aborts, 429/5xx fallback | **Fixed** for all Gemini paths (incl. Paper Intelligence) and DeepSeek |
| F-13 / PR-6 | Client-supplied Compass history | **Fixed.** Server-side, ownership-checked, bounded |
| F-14 | SOW echoes KICD fields | **Fixed**, extended to competencies/values/PCIs |
| F-15 | Paper Intelligence ungated | **Not fixed.** Blocked on a product decision (no `TokenFeature` / limit exists; inventing a quota is out of scope). Timeouts and telemetry were added |
| F-16 | Friday cron pre-generates for all active SOWs | **Not fixed.** Product decision |
| F-17 | generate-all `ALL_TIERS = 3` vs 4 tiers | **Fixed** |
| F-18 | Double-submit of background jobs | **Partially fixed.** Repeats now consume cap units; no in-flight job guard |
| F-19 | Study-group model-authored answer key | **Not fixed.** Feature is unscheduled (dormant); attribution and timeout added |
| F-20 | Unused AI SDK deps | **Not fixed.** Lockfile change deferred |
| F-21 | Misc hygiene | **Partially fixed.** Names removed from holiday/class-report logs; raw insha output no longer logged; `streamDeepSeek` documented as Gemini-primary (not renamed) |
| PR-3 | Images carry handwritten names | **Not fixed.** Capture-time guidance needed |

### Discrepancies between the audit and the code, resolved by re-verification

- **Stage 1.4, "lesson plans account for zero tokens": not applicable.** `TOKEN_COSTS.lesson_plan_generate = 0` is intentional Planning-Bundle pricing; the bundle is charged once at SOW generation (`lib/payments/config.ts`). It is not a usage-accounting defect. The real defect was that zero-token lesson plans had no working cap (F-01), and that is fixed.
- **Class-report LLM step: retained, not removed.** The audit proposed replacing it with the deterministic bridge. But that bridge (`lib/academicClinic/careerEngine.ts` `buildCompassBridge`) has a different data contract: `parentMessage` vs `parentWhatsAppMessage`, no `firstConcept`, a different `subjectPriorities` shape. The clinic UI and Compass read the LLM shape. Replacing it would change that interface, so only the overwrite and honesty defects were fixed. Expected calls per class run are unchanged.
- **New issue found while fixing F-13.** The browser's `conversationHistory` already ended with the current message, which the route also sent separately, so the model saw every learner message twice. Server-side history removes the duplicate.
- **New issue found while fixing F-14.** For KICD-grounded lessons, the model's echo of `core_competencies` / `values` / `pci_links` was stored as returned. Only outcomes and inquiry questions were overwritten. All five fields are now server-set.

---

## C. Files changed

### AI wrappers, telemetry and caps

| File | Reason |
|---|---|
| `lib/ai/rateLimit.ts` | `reserveDailyCall` / `reserveDailyCallOrThrow` / `DailyLimitExceededError` replace the read-only `checkDailyCallLimit` |
| `lib/repositories/analytics.repository.ts` | Quota count / insert / release on `ai_call_logs` (`model = 'quota'`) |
| `lib/ai/usageTelemetry.ts` *(new)* | Per-provider-request telemetry; logical-call ids; usage `provider`/`unavailable` |
| `lib/ai/deepseek.ts` | Single-provider functions for the router; 429/5xx fallback; Gemini abort; telemetry; DeepSeek stream usage capture |
| `lib/ai/gemini.ts` | Real timeouts, feature attribution, native JSON mode, `generateGeminiWithTimeout` |
| `lib/ai-orchestration/router.ts`, `types.ts` | One provider per chain entry (≤3 requests); real usage; `call_site`, `usage_source`, `provider_requests` |

### Compass

| File | Reason |
|---|---|
| `lib/ai/learnerPseudonym.ts` | `pseudonymiseLearnerName`, `createLearnerNameStreamRestorer` |
| `lib/compass/prompt.ts` | No name parameter; placeholder only |
| `lib/compass/providerPayload.ts` *(new)* | One function pseudonymises all provider-bound learner text |
| `lib/compass/session.ts`, `lib/repositories/compass.repository.ts` | Server-side, bounded session history |
| `app/api/learn/route.ts` | Zod body; server history; pseudonymised payload; stream restore; cap per conversation start |

### Teaching intelligence and lesson plans

| File | Reason |
|---|---|
| `lib/teachingIntelligence/rootCauseClassifier.ts` | Deterministic; `UNKNOWN` when ambiguous |
| `lib/teachingIntelligence/weeklyGenerator.ts` | Deterministic `buildTeacherNote` |
| `app/api/cron/friday-generation/route.ts` | Synchronous classifier call |
| `lib/lessonPlan/generator.ts` | Reflection suggestions deterministic; provider failure ends attempts |
| `lib/lessonPlan/weeklyGenerator.ts`, `types.ts` | Skip planned lessons; `allSettled`; partial-success fields; quota hook |
| `app/api/lesson-plans/generate/route.ts`, `generate-week/route.ts` | Hook-based reservation (no unit consumed for a no-op week) |
| `app/teacher/documents/page.tsx`, `app/teacher/lesson-plans/page.tsx` | Show partial success honestly |

### Career

| File | Reason |
|---|---|
| `lib/career/autoReportGenerator.ts` | `reportOwnedTargets`; failed briefing = error; no learner name in log |
| `lib/career/careerIntelligenceEngine.ts`, `types.ts`, `lib/repositories/career.repository.ts` | Narrative reuse (fingerprint, store, `allowGeneration`, `beforeGenerate`); `narrative_source` |
| `app/api/career/intelligence-report/route.ts` | Reuse first; cap + charge only on fresh generation; no-token re-open of an unchanged report |
| `lib/career/knowledgeRequests.ts` | Reservation model (release on failure) |
| `lib/career/careerEngine.ts` | Feature attribution |

### SOW

| File | Reason |
|---|---|
| `lib/sow/aiLessonGenerator.ts` | `kicdOfficialFields`; template omits official fields; provider failure ends attempts |

### Other capped routes

| File | Reason |
|---|---|
| `app/api/sow/generate`, `slides/generate`, `remedial/generate`, `holiday/generate` | Reservation with release on failure |
| `app/api/teacher/assignments/[id]/…/variants/generate`, `regenerate`, `variants/generate-all` | Reservation per question; generate-all stops at the cap; `ALL_TIERS` from `BAND_TO_TIER` |
| `app/api/teacher/classes/[classId]/generate-reports`, `kiswahili/insha-feedback`, `teaching-intelligence/quick-check` | Previously unchecked caps now enforced |

### Remedial, holiday and other feature tags

| File | Reason |
|---|---|
| `lib/remedial/planner.ts` | Explicit plain-text system prompt; feature `remedial_planner` / `enrich` |
| `lib/holiday/planner.ts` | Explicit plain-text system prompt; feature tag; no learner name in log |
| `lib/assignments/variantGeneration.ts` | Feature `adaptive_variant_generate`, call sites `generate` / `verify` |
| `lib/academy/aiJudge.ts`, `lib/slides/aiSlideGenerator.ts`, `lib/kiswahili/inshaEvaluator.ts`, `lib/teachingIntelligence/quickCheckGenerator.ts`, `lib/studyGroups/challengeGenerator.ts`, `scripts/backfill-career-doors.ts` | Feature attribution. Insha: raw output no longer logged |
| `lib/paperIntelligence/vision.ts`, `schemeExtraction.ts`, `scriptMarking.ts` | Timeouts (45s / 45s / 50s per attempt) and telemetry |
| `lib/payments/config.ts` | Comment reference |

### Database

| File | Reason |
|---|---|
| `supabase/migrations/20261030120000_career_intelligence_narratives.sql` *(new)* | Narrative reuse store, RLS service-role only. **Not applied** |

### Tests

| File | Reason |
|---|---|
| `lib/ai/rateLimit.test.ts`, `requestBudget.test.ts`, `aiCallGovernance.architecture.test.ts`; `lib/compass/compassPrivacy.test.ts`; `lib/teachingIntelligence/deterministicIntelligence.test.ts`; `lib/lessonPlan/weekGeneration.test.ts`; `lib/sow/aiGenerationRemediation.test.ts`; `lib/career/aiReuseAndTargets.test.ts`; `lib/career/classReportHonesty.test.ts` *(all new)* | Regression matrix (§E) |
| `scripts/standard-tests.json` | Registers the 9 new files |
| `lib/career/knowledgeRequests.test.ts`, `careerProvenance.test.ts`, `lib/remedial/plannerRouterMigration.test.ts`, `lib/compass/prompt.test.ts` | Updated for the new APIs |
| `lib/compass/aiGroundingContract.integration.test.ts`, `learnerContext.integration.test.ts`, `lib/testing/maryFullCircuit.integration.test.ts`, `lib/assignments/variantGeneration.integration.test.ts` | Updated for no-name prompts and `call_site` (DEEP tier, **[TYPED]** only) |

`lib/growth/messaging/replyTo.ts` carries a pre-existing uncommitted change that is **not part of this work** and was left untouched.

---

## D. Behavioural changes

### Teachers

- Hitting a daily cap now returns HTTP 429 with the limit and reset time on:
  - SOW, lesson plans, slides, remedial, holiday plans, variants, class reports, insha and quick checks.
- Re-requesting an already-planned week returns `already_generated` and costs no quota.
- A partially failed week saves its good plans and says how many failed.
- Reflection starters appear instantly and are always the subject-specific templates.

### Learners (Compass)

- Starting a conversation counts toward the 30/day cap. Turns inside a conversation do not.
- Message length is limited to 4000 characters.
- Replies still use the learner's first name; it is restored locally.
- Context is the last 20 stored messages of the session.

### Parents

- Re-opening a Career Intelligence report whose evidence hasn't changed shows the same narrative, without a charge.
  - It works even with zero tokens.
  - `narrative_source` says `reused` or `generated`.
- New evidence produces a fresh narrative, which counts against the cap and is charged.

### TIE

- Ambiguous sub-strands show "Needs revisiting" instead of a guessed cause.
- Weekly notes follow the documented thresholds exactly.

### Operations

- Every provider request emits one `AI provider request` log line.
- `AI call completed` is kept, now with `feature` and `provider_requests`.

**Daily window:** UTC midnight. Unchanged; note that this is 03:00 EAT.

---

## E. Tests: commands actually executed

| Command | Result |
|---|---|
| `npm test` (baseline, before any change) | **1698 pass / 0 fail** |
| `npm test` (final) | **1770 pass / 0 fail** (+72 new tests) |
| `npx tsc --noEmit -p tsconfig.json` | exit 0 |
| `npx eslint <all changed .ts/.tsx>` | exit 0 |
| `node scripts/check-architecture.mjs` | passed |
| `node scripts/check-route-auth.mjs` | passed (304 routes) |
| `node scripts/check-standard-manifest.mjs` | OK, 208 files |
| `npx next build` (after every change, including Paper Intelligence timeouts) | exit 0. 2 pre-existing Turbopack warnings (dynamic filesystem tracing in unrelated files) |
| `tsx --env-file=.env.local … lib/remedial/plannerRouterMigration.test.ts` (excluded-tests file; needs env only for client construction, no network) | 4 pass |
| Migration in a rolled-back transaction on the local Postgres | Applied cleanly. RLS on, unique key and policy present. Table absent afterwards |

**New test files:**

| File | Tests | Covers |
|---|---|---|
| `rateLimit.test.ts` | 11 | Attribution and caps: boundary, release, idempotent release, per-feature isolation, concurrency never over-admits, fail-open logged |
| `requestBudget.test.ts` | 14 | Router ≤3; 503/429/500/401 handling; real Gemini abort at 20s; variant bound; telemetry attribution, no content, unavailable usage |
| `compassPrivacy.test.ts` | 7 | No name in prompt; payload pseudonymised; **primary and fallback HTTP bodies contain no name**; restore across every chunk split |
| `deterministicIntelligence.test.ts` | 8 | Root cause never yields an unsupported diagnosis; note thresholds; reflections; all with provider mocks that throw |
| `weekGeneration.test.ts` | 7 | Pre-check, partial, all-fail, concurrent duplicate, quota-hook ordering |
| `aiGenerationRemediation.test.ts` | 7 | Provider-failure bounds; official KICD fields authoritative |
| `aiReuseAndTargets.test.ts` | 9 | Reuse, staleness, per-learner isolation, reuse-only mode, graph targets kept |
| `classReportHonesty.test.ts` | 3 | Failed briefing = error, context untouched |
| `aiCallGovernance.architecture.test.ts` | 5 | Every capped route reserves; no removed API; every wrapper call names a feature; no name parameter; no client history |

**Not run:**
- `npm run test:deep` refuses without a `TEST_SUPABASE_*` target, and none is configured.
- I did not point it at the dev DB. The 4 DEEP integration tests that were edited are **[TYPED]** only.
- No paid provider was called by any test.


---

## F. AI-call reduction (expected calls per workflow, from control flow)

There is no production usage data, so these are per-workflow bounds, not measured savings.

| Workflow | Before | After |
|---|---|---|
| Router logical call (remedial, variants), worst case | 6 provider requests | **3** |
| Variant tier, worst case | 24 | **12**; a provider outage stops at **3** |
| SOW lesson, provider outage | up to 15 | **3** |
| Lesson plan, provider outage | up to 9 | **3** |
| DeepSeek 429/5xx (`callDeepSeek`) | 1, then the feature fails | **2** (falls back to Gemini) |
| TIE root cause per ambiguous row | 1 Gemini call | **0** |
| TIE weekly note per SOW-week | 1 Gemini call | **0** |
| Reflection suggestions per "mark as taught" form opening | 1 DeepSeek call | **0** |
| generate-week for an already-planned week | ≈5 calls, then discarded | **0** |
| Career report re-open, unchanged evidence | 1 call + 3 tokens | **0 calls, 0 tokens** (after migration) |
| SOW grounded lesson | 1 call (with echoed fields) | 1 call (shorter required output; reduction unmeasured) |
| Compass turn | ≤3 | ≤3 (unchanged); input no longer contains the message twice |
| Class report run | N | N (unchanged; correctness fixes only) |

Whether aborted requests are billed is **[UNVERIFIED]**. Aborting stops waiting; it cannot un-send a request.

---

## G. Privacy improvements

**Verified payload changes:**
- The Compass system prompt cannot contain a name.
- Message, history and last summary are pseudonymised before *either* provider sees them.
- The fallback receives the identical pseudonymised payload. Tested at the HTTP-body level for Gemini → DeepSeek.
- Names were removed from two error logs. Raw insha feedback is no longer logged.
- Telemetry carries no prompts, completions or identifiers. Tested.
- Career narratives are stored in placeholder form.

**Limitations (honest):**
- Only the learner's stored first name is replaced.
  - A surname, nickname or classmate's name typed by the learner still passes through.
  - A first name that is also a common word (e.g. "Joy") is replaced in its ordinary sense too.
- Learner free text, grades, levels and topics still go to providers; that is the tutoring content itself.
- Paper Intelligence images can contain handwritten names (PR-3).

These are code-level data-minimisation changes. They are not a claim of compliance with any law.

---

## H. Usage controls: how limits and attribution work now

**Unit of account:** one logical operation per feature. Retries and fallbacks are never counted. Per feature:

| Feature | One unit = |
|---|---|
| SOW | one scheme |
| Lesson plans | one week actually generated |
| Holiday | one generation request (a class run counts once) |
| Variants | one question |
| Compass | one conversation start |
| Career report | one fresh generation |
| Insha | one essay |
| Class reports | one run |
| Slides / remedial / quick check / career knowledge | one request |

**Mechanism** (`lib/ai/rateLimit.ts`):
1. Pre-count; refuse at the limit without writing.
2. Insert a quota row (`ai_call_logs`, `model = 'quota'`, no content).
3. Re-count. On overshoot, release your own row and refuse.
4. `release()` on failure marks the row `success = false`.

Concurrent racers for the last slot may all be refused, but can never all be admitted.

**Failure mode:** fails open with an `error` log if the quota store itself errors.

**Attribution:** `feature` / `callSite` / `correlationId` on every wrapper. A static test fails the build if a production call omits `feature`.

**Note:** quota rows use the existing `ai_call_logs` table, so no migration is needed for caps. Historical `career_knowledge_request` rows (logged as `deepseek-chat`) no longer count; that only matters on the deploy day.

---

## I. Database requirements (review and apply separately; nothing was applied)

1. **`supabase/migrations/20261030120000_career_intelligence_narratives.sql`**
   - Additive: a new table, a trigger function, RLS, and a service-role policy.
   - Rollback statements are in its header.
   - The code treats a missing table as "nothing cached", so deploy order does not matter. Until it is applied, F-10's savings do not happen.
2. **CI schema-fingerprint pin must be recomputed** for this migration (`.github/workflows/ci.yml`, "Verify canonical schema fingerprint").
   - Use the throwaway-stack method: never `DROP SCHEMA` the dev DB.
   - CI's architecture job will fail until the pin is updated. **Not done in this session.**
3. **Confirm `lesson_plans_sow_week_lesson_key` exists in production** (migration `20260807160000`).
   - The pre-check prevents wasted generation either way.
   - Concurrency safety for simultaneous requests for the same week relies on that constraint.

---

## J. Remaining risks

- **Compass per-turn spend** inside a conversation is not capped. The cap counts conversation starts, and a learner can continue an owned older session. For token users each turn costs a token; for subscribers it is unbounded. This needs a product decision on a turn limit.
- **Paper Intelligence** (multimodal, the costliest per call) has no daily cap, pending a decision on its limit (F-15).
- **The class-report LLM still chooses `firstConcept`** from subject-level averages when graph data exists. Its goal and topics are no longer written in that case, but Compass's sub-topic can still come from the briefing.
- **Telemetry is structured stdout only.** It is analysable only if production logs are retained or drained; nothing persists per-request rows to the database. Wire a log drain or a metrics table before relying on it for cost decisions.
- **Quota fails open** on a quota-store outage, by design and logged. A prolonged outage removes the caps.
- **Concurrent career-report generation** for the same learner can still produce two calls; the last write wins.
- **Friday-cron speculative generation** (F-16) and background-job double-submit guards (F-18) are unchanged.
- **Gemini SDK history validation:** a stored history that starts with a model turn makes Gemini refuse and fall through to DeepSeek. Stored pairs make this unlikely.
- The DEEP integration tests that were edited have not been run.

---

## K. Deployment checklist

1. Review the diff, excluding `lib/growth/messaging/replyTo.ts` (unrelated pre-existing change). Commit in small logical commits (§L).
2. Recompute the CI schema-fingerprint pin for the new migration.
3. Run `npm run test:deep` against a configured non-production `TEST_SUPABASE_*` target.
4. Run `npx next build`, then all CI gates (`check-architecture`, `check-route-auth`, `check-standard-manifest`).
5. Apply the narratives migration to staging, then production (separately, reviewed).
6. Confirm `lesson_plans_sow_week_lesson_key` exists in production.
7. After deploy, confirm the following in logs:
   - `AI provider request` lines appear with feature names;
   - no `feature: 'unattributed'` lines from production paths;
   - `ai_call_logs` gains `model = 'quota'` rows.
8. Decide caps for Paper Intelligence and Compass turns (§J).
9. Tell teachers that daily caps are now enforced. Some may meet a 429 for the first time.

---

## L. Rollback guidance

Each logical change is independent. Revert by file group; no data migration is involved except item 1.

1. **Narrative reuse:** revert the engine, route, repository and types changes. The table can stay (unused) or be dropped with the statement in the migration header. Stored narratives contain no names.
2. **Caps:** revert `rateLimit.ts`, the analytics repository and the route edits. Quota rows (`model = 'quota'`) are inert, so leave them or delete them by `model`.
3. **Router / wrappers:** revert `deepseek.ts`, `gemini.ts`, `router.ts`, `types.ts` and `usageTelemetry.ts` together; callers' extra `feature` options would then need removing too.
4. **Compass privacy:** revert `prompt.ts`, `providerPayload.ts`, `learnerPseudonym.ts`, the session/repository additions and `app/api/learn/route.ts` together.
5. **Deterministic replacements:** revert each file individually (root cause, weekly note, reflections). Stored `UNKNOWN` causes stay valid values.
6. **Lesson-plan week generation, class-report fixes, SOW KICD fields:** each reverts independently.

Never use `git reset --hard` or `git clean` on this branch: it carries unrelated uncommitted and untracked user work.

---

## Final acceptance gate

| Item | Status |
|---|---|
| Implemented findings independently re-verified | ✅ (discrepancies in §B) |
| Existing uncommitted work preserved | ✅ `replyTo.ts` diff unchanged; untracked files untouched |
| Compass protections cover primary and fallback providers | ✅ tested at the HTTP-body level |
| Root-cause classification no longer invents certainty | ✅ |
| Applicable AI limits enforced | ✅ 14 entry points. ⚠ Paper Intelligence and Compass turns undecided |
| Feature-level usage attribution | ✅ logs. ⚠ persistence depends on log retention |
| Retry and fallback paths bounded | ✅ |
| Verified deterministic operations make no model calls | ✅ 3 calls removed |
| Class reports preserve stronger evidence | ✅ (LLM step retained) |
| Lesson-plan generation avoids verified waste | ✅ |
| Career reports safely reused | ✅ code. ⚠ needs migration + CI pin |
| SOW and other redundant generation assessed | ✅ SOW fixed; quick-check reuse deferred |
| Tests verify the important behaviour | ✅ 72 new standard tests. ⚠ DEEP not run |
| No unverified production claims | ✅ |
| Diff contains only justified changes | ✅ |
| Unresolved issues documented | ✅ §J, §K |

---

# Final verification and pre-push readiness (2026-10-30, phase 2)

Everything above this line is the phase-1 implementation record and is unchanged. This section records what was completed afterwards and what was verified.

**Starting state, re-verified before any change:**
- Branch `feat/growth-reply-loop` @ `00f5dd8`.
- 62 modified and 19 untracked paths, exactly as phase 1 left them.
- `lib/growth/messaging/replyTo.ts` (unrelated user work) has sha256 `17cba83a…`. It is **identical at the end of this phase**.

## 1. Final state: what this phase changed

| Area | Change |
|---|---|
| Paper Intelligence | One whole-script marking pass per submission at a time (`lib/paperIntelligence/markingClaim.ts`). A concurrent duplicate gets HTTP 409 with **no AI call**. UI shows "already being marked" instead of "failed". No charge, quota or entitlement change |
| Compass | Whole-stream deadline (90s after the first byte) on **both** providers, so a stalled stream is aborted instead of holding the request open. No conversation-length limit |
| Friday lesson plans | Scheduled generation only for schemes a teacher is actually using (`lib/lessonPlan/scheduledGeneration.ts`); eligibility in §4. Partial success is recorded as `partial: N lesson(s) failed` |
| Migration / CI | Schema fingerprint recomputed on an isolated throwaway stack; CI pin updated `28ff24ca…` → `0b8f67ee…` |
| DEEP tests | Run against the isolated throwaway stack (§6). One stale fixture fixed (maryFullCircuit verifier contract) |
| Tests | 29 new standard tests, 3 new mark-script route tests, 5 new DEEP tests (§7) |

## 2. Paper Intelligence: the scanner model is preserved

**What the established model is, read from the code rather than assumed:**
- Paper Intelligence has **no purchase, charge, token cost, entitlement record or quota** anywhere: nothing in `lib/payments`, and no `TokenFeature`.
- Access is "an authenticated teacher who *currently teaches* this learner's class" (`lib/paperIntelligence/auth.ts`). Learners are never charged; it is a teacher tool.
- The 2026-10-28 product decision makes the bulk scanned-PDF path the trial priority. Photo marking is kept, under cost/effectiveness review.

So "one-time scanner, no per-paper charge" equals the current implementation, and it is left exactly as it is: **no charge, no daily quota, and no entitlement or pricing change was introduced**.

**Learner/teacher pricing vs EduNexus operating cost.** Because marking is free at the point of use, every script's multimodal Gemini call is EduNexus' own cost. The safeguards are therefore operational, not commercial:

| Safeguard | Status |
|---|---|
| Auth + "currently teaches this class" before any page load or AI call | Pre-existing, verified (route test) |
| Page size limit (`UPLOAD_LIMITS.maxFileSizeBytes`), image types, ≤12 pages/script, sharpness gate | Pre-existing, verified in code |
| Schema-constrained output, rubric-bounded validation, `pending_review` evidence, re-mark blocked once reviewed | Pre-existing |
| One parse retry max (`MAX_ATTEMPTS = 2`); abort at 50s/attempt (script), 45s (page, scheme) | Phase 1 |
| Per-request telemetry (`paper_intelligence_*` features) | Phase 1 |
| Durable failure log; failed scans return 502, write no evidence, release the claim | Pre-existing + this phase |
| **Concurrent duplicate pass** (double tap, reopened learner, re-run bulk batch) | **New this phase**, see below |

**The duplicate-pass gap was verified, not assumed.**
- Nothing stopped two concurrent `mark-script` calls for the same submission. Both paid for a vision call.
- The second pass's `replaceScriptMarks()` superseded only the evidence it had read *before* its own AI call. That left the first pass's `pending_review` evidence orphaned.

**The fix:**
- A `processing` claim row in the existing `jobs` table, using insert-then-check with the earliest claim winning. This is the same rule as the free-trial SOW guard (`isWinningFreeTrial`). No migration.
- Losers get 409 before any AI call.
- Claims are released on success and failure, and expire after 3 minutes, longer than the route's 120s `maxDuration`.
- Different submissions never block each other, so class batches still mark in parallel.
- The guard **fails open, logged**, if its own bookkeeping errors.

**Identical-input result reuse: investigated, deliberately not implemented.**
- A re-mark of an unchanged script is rare: re-marking exists for retaken pages, and the bulk path re-uploads pages as new files.
- A *safe* validity rule would need a persisted fingerprint of page content, rubric content, model and prompt version, plus reconstruction of the full proposal shape from stored rows. That means a new column and new code.
- Reusing on file-path similarity alone could serve marks against a changed marking scheme.
- No raw learner images are stored for caching.

**Tests:**

| File | Tests | Covers |
|---|---|---|
| `lib/paperIntelligence/markingClaim.test.ts` | 8 | Winner rule, tie-break, stale-claim expiry, a co-teacher can't start a parallel pass, release-then-re-mark, per-submission isolation, 5 concurrent → exactly 1, fail-open |
| `mark-script/route.test.ts` (+3) | 9 | 409 with no marking call; claim released on success and failure; an auth failure never takes a claim |
| All Paper Intelligence route tests | 58 | All pass |

## 3. Compass: bounded turns, no conversation-length limit

**No conversation-length or per-turn cap was introduced.** A static test asserts that the route has none and that the daily cap counts conversation *starts* only.

Each control below was traced through its real enforcement path:

| Control | Enforcement (verified) |
|---|---|
| Provider requests per turn | ≤3 (Gemini 1 + DeepSeek ≤2). Tested at the transport level |
| Output tokens | `max_tokens` / `maxOutputTokens` = 1000 on both providers. Tested on the HTTP bodies |
| Input | Message ≤4000 chars (Zod). Server history = last 20 stored messages × ≤4000 chars; the wrapper also trims any history to 20. Tested |
| Time | Gemini TTFB 15s abort. DeepSeek TTFB 25s abort with 1 transport retry. **New:** 90s whole-stream deadline after the first byte on both providers. Tested: a stalled stream is aborted and the learner keeps what arrived |
| Daily feature cap | 30 conversation starts/day per user, reserved before any session row is written and released if no stream starts (phase 1) |
| Duplicate submissions | Client: `isLoading` gates send, input and button (`app/learn/page.tsx`). Server: **no per-session in-flight guard** (see risks) |
| Session isolation | `resolveCompassMutationAccess` (parents cannot drive sessions) + `resolveSessionOwnership` on any supplied `sessionId`; history is read only for that verified session |
| Entitlement | `checkFeatureAccess('learning_compass')` + 1 token per turn for token users, deducted on first token. **Unchanged.** Subscribers are unchanged |
| Attribution | `feature: 'learning_compass'` on every provider request |

**Server-side duplicate-turn guard: not added, and why.** Compass is the volume path (≈93% of calls in the audit's scenario model). The only no-migration mechanism, a `jobs` claim, would add a row and 3 round trips to every tutoring turn. A correct guard wants an atomic conditional update on a session column, which needs a migration and a product call. The client already prevents double sends, and each turn is individually bounded and charged.

**Tests:** `lib/compass/compassTurnBounds.test.ts` (7), plus phase-1 `compassPrivacy.test.ts` (7).

## 4. Friday lesson plans: eligibility

A scheme receives scheduled plans only if **all** of the following hold:

1. It is in the current year and term, with status `active` or `saved` (unchanged).
2. Its timeline has slots (unchanged).
3. Its `teachers.id` resolves to an auth user. This fails closed, as before, and is the authoritative teacher link: `schemes_of_work` has no class link.
4. **New:** the teacher used it within the last 21 days (`SCHEDULED_PLAN_LOOKBACK_DAYS`). Any one of these counts:
   - **a.** marked one of its lesson plans taught (`lesson_plans.taught_date`);
   - **b.** generated a week of it themselves (`generation_jobs` with `job_type IS NULL`; the cron always writes `'weekly_lp'`);
   - **c.** created the scheme (`schemes_of_work.created_at`), so a newly saved scheme still gets its first weeks.

Only teacher actions with reliable timestamps count. Neither `lesson_plans` nor `schemes_of_work` has an `updated_at` trigger; this was checked in the migrations and the local catalog. Their `updated_at` is therefore not a signal, and an `edited` plan has no edit timestamp. No new "active" flag was invented.

**Consequences:**
- An abandoned scheme stops receiving plans 21 days after its last use.
- Generating a week manually, or marking a lesson taught, brings it back.

**Unchanged:**
- Manual generation still works for any scheme the teacher owns.
- The upcoming week is still `latest planned week + 1`.
- Existing plans are skipped before any AI call (phase 1). Re-runs and concurrent runs are safe because duplicate saves become `already_generated`.
- TIE still runs for every current scheme; it makes no AI calls.

The signals are fetched in **two batched queries** for the whole set, never one per scheme.

**Tests:** `lib/lessonPlan/scheduledGeneration.test.ts` (12) covers all eight acceptance cases:

1. An active scheme is eligible.
2. An unused or lapsed scheme is excluded.
3. A scheme with no teacher identity is excluded, with no model call.
4. Existing plans produce a no-op, not a regeneration.
5. Teachers and schools stay isolated.
6. A re-run is safe.
7. Partial and failed schemes don't stop the batch.
8. No eligible schemes means no model call, no identity lookup and no job row.

## 5. Migration and schema fingerprint

| Item | Result |
|---|---|
| Migration `20261030120000_career_intelligence_narratives.sql` | Additive only. FK `students(id) ON DELETE CASCADE`; unique `(student_id, input_fingerprint)` (also covers the FK index); dedicated `updated_at` trigger function; RLS + service-role policy. Assumptions match the current schema (it applies cleanly in the full bootstrap) |
| Applied to production | **No** |
| Applied to the development DB | **No.** Verified: the dev DB has no `career_intelligence_narratives` table and still has 264 public tables |
| Fingerprint procedure | CI's own: empty Supabase stack → `scripts/bootstrap-local-db/run.sh` → `fingerprint.sql` |
| Isolation | Throwaway project `pifp` on shifted ports (5532x). A *copy* of `run.sh` retargeted to `supabase_db_pifp`; the repo copy is hard-wired to the dev container and was not run |
| Method validated | HEAD bootstrap on pifp reproduced the existing pin **`28ff24ca07243bcf18a41d69a21b42f9`** (`FAIL_COUNT=9 UNRECOVERED=0`, the known baseline) |
| New pin | With the new migration (public schema reset on pifp only): **`0b8f67ee08e04e3f3e485ba49ba9be38`**, `FAIL_COUNT=9 UNRECOVERED=0` (unchanged) |
| CI change | `.github/workflows/ci.yml`: `EXPECTED` updated, with a changelog comment in the file's existing style. The check itself is not weakened |
| Pre-migration behaviour | Code treats a missing table as "nothing cached": the report generates, never claims reuse, and reuse-only (no tokens) returns "not available" instead of crashing. Tested with the real PostgREST "table not in schema cache" error (2 tests) |
| Post-migration behaviour | DEEP test on the migrated pifp DB (§6): reuse, placeholder-only storage, uniqueness, staleness, RLS denial to anon, cascade on learner delete |

**Deployment order:** migration and code can ship in either order. Reuse becomes active only once the migration is applied.

## 6. DEEP tests

**Environment:**
- Isolated throwaway Supabase stack (`pifp`), bootstrapped exactly as CI does, plus the CI test-content seed.
- `TEST_SUPABASE_*` taken from pifp's own `supabase status`.
- Run under `env -i`, so nothing was inherited from `.env.local`. The preflight reported `project: local-docker`, `production: false`.
- The development DB was never used as a test target. The stack was stopped and its volumes discarded afterwards.

| Run | Result |
|---|---|
| **DEEP_PR manifest** (`node scripts/run-deep-pr.mjs`; CI expects 22 files / 168 tests) | **168 pass / 0 fail** |
| DEEP_PR cleanup gate (reaper dry-run, retargeted copy) | **0 residual rows** |
| `lib/compass/learnerContext.integration.test.ts` (edited) | 18 pass / 0 fail |
| `lib/compass/aiGroundingContract.integration.test.ts` (edited; in DEEP_PR) | Passed within DEEP_PR |
| `lib/testing/maryFullCircuit.integration.test.ts` (edited) | **34 pass / 0 fail**, after the fixture fix below |
| `lib/lessonPlan/teachingWorkflowReliability.integration.test.ts` | 7 pass / 0 fail |
| `lib/lessonPlan/lessonPlansSubStrandId.integration.test.ts` (in DEEP_PR) | Passed within DEEP_PR |
| `lib/career/careerIntelligenceEvidenceFirst.integration.test.ts` (engine changed; excluded-tests file) | 4 pass / 0 fail |
| `lib/career/careerNarrativeStore.integration.test.ts` (**new**, post-migration) | 5 pass / 0 fail |
| `lib/assignments/variantGeneration.integration.test.ts` (edited) | 6 pass / **2 fail: pre-existing** |
| `lib/learnerBlueprint/actionPlan/delivery/compass.integration.test.ts` | 18 pass / **1 fail: pre-existing** |

**Pre-existing failures, proven.** The same files at `00f5dd8` (a temporary git worktree, same pifp DB) failed identically:
- maryFullCircuit: 6.
- variantGeneration: 2.
- compass delivery: 1.

**Fixed (fixture, no assertion weakened).** maryFullCircuit's fake verifier returned the pre-P0-2 `{ valid, reason }` shape. The strict verdict parser rejects that as `verifier_output_invalid`, so no variant was ever created and AR2–AR7 cascaded. The fake now returns the current contract (still an always-clean verdict): 34/34.

**Not fixed (outside this remediation, documented):**
- **variantGeneration, "regeneration archives…":** expects a `foundation` variant, but the fixture's learners don't classify into the BE band since tiers became one per CBC level. The second failure is the file's cleanup (`deleteAuthUserOrThrow`, dangling FK) after that abort.
- **compass delivery:** its `after()` cleanup fails `deleteAuthUserOrThrow` on a dangling FK.

Both need fixture/cleanup work by the test owner. They also left 3 synthetic teacher rows on the throwaway DB, which was discarded.

**Not run:** the remaining ~170 files of the full DEEP pool (`npm run test:deep`), including `*.http.integration.test.ts`, which need a separately started Next server pointed at the test stack.

**New DEEP test placement:** added to `scripts/deep-tests.json`. Not added to `deep-main-tests.json`, which pins `expectedFiles: 104` behind a recorded 2× combined-run proof; promotion is a separate, deliberate step.

## 7. Full verification matrix (final working tree)

| Check | Command | Result |
|---|---|---|
| Unit (STANDARD) | `npm test` | **1799 pass / 0 fail** (phase-1 end: 1770; baseline: 1698) |
| Paper Intelligence route tests (outside the manifest because of the `[id]` path) | `tsx --experimental-test-module-mocks --test 'app/api/teacher/assignments/*/paper-intelligence/*/route.test.ts'` | 58 pass / 0 fail |
| DEEP_PR | `node scripts/run-deep-pr.mjs` (isolated pifp) | 168 / 168 |
| Other DEEP files | See §6 | 86 pass; 3 pre-existing failures |
| Type check | `npx tsc --noEmit -p tsconfig.json` | exit 0 |
| Lint | `npx eslint <83 changed .ts/.tsx>` | exit 0 |
| Production build | `npx next build` | exit 0. 2 pre-existing Turbopack warnings (dynamic filesystem tracing in unrelated files) |
| CI architecture | `node scripts/check-architecture.mjs` | passed |
| CI route auth | `node scripts/check-route-auth.mjs` | passed (304 routes) |
| CI test lists | `check-standard-manifest.mjs` / `check-tier-manifests.mjs` / `check-deep-pr-classification.mjs` | OK (211 files) / passed (144 files, 6 tiers) / exit 0 |
| CI schema fingerprint | CI procedure on an isolated stack (§5) | `0b8f67ee08e04e3f3e485ba49ba9be38`, pin updated |
| Secret / learner-data scan of the diff | grep for JWTs, `sk-`, `sb_secret_`, inline service keys | none found |
| Unrelated work | sha256 of `replyTo.ts` | unchanged |

## 8. Remaining risks

**Product and commercial:**
- No server-side duplicate-turn guard for Compass. Subscribers' per-turn spend is bounded per turn, not per day (by design: no conversation cap).
- Paper Intelligence has no daily ceiling on EduNexus' own vision spend. Teacher-gated, but a teacher with a large class set is unbounded by design.
- A 21-day lookback means a scheme resumed after a long break needs one manual action before Friday plans restart.

**Technical:**
- Telemetry is structured logs only; it needs log retention or a drain to be usable for cost decisions.
- Quotas and claims fail open, logged, if their store errors.
- Two pre-existing DEEP failures (§6). The rest of the DEEP pool, including the HTTP tier, is not run.

**Operational:**
- Production migration status of `lesson_plans_sow_week_lesson_key` is still unconfirmed.
- Whether DeepSeek or Gemini bill for aborted requests is unverified.

**Environment:** the local Supabase CLI is 2.109.0; CI uses 2.117.0. The pin was computed with 2.109.0 after it reproduced CI's existing pin exactly, but CI is the final arbiter.

## 9. Pre-push checklist

- [ ] Human review of the diff (70 modified + 19 new paths). Exclude `lib/growth/messaging/replyTo.ts` and the unrelated untracked docs, reports and research notes.
- [ ] Split into logical commits (§L), each with its tests. The CI pin change goes **with** the migration commit.
- [ ] Push to the branch and let CI confirm the new fingerprint and DEEP_PR on its own runner.
- [ ] Decide whether to promote `careerNarrativeStore.integration.test.ts` into DEEP_MAIN (needs the 2× combined-run proof).
- [ ] Owner fixes for the two pre-existing DEEP failures (§6).
- [ ] Apply the narratives migration: staging, then production (reviewed, separately).
- [ ] Confirm `lesson_plans_sow_week_lesson_key` in production.
- [ ] After deploy, check logs:
  - `AI provider request` lines carry feature names;
  - `model = 'quota'` rows appear;
  - `ai.paper_script.mark` claim rows turn `completed`/`failed`;
  - the Friday cron response shows `lp.not_in_use`.
- [ ] Product decisions in §8.

## 10. Changed files (this phase)

**Code:**

| File | Purpose |
|---|---|
| `lib/paperIntelligence/markingClaim.ts` *(new)* | One marking pass per submission; no-migration claim |
| `lib/repositories/job.repository.ts` | `insertProcessingClaim`, `listProcessingJobsForResource` |
| `app/api/teacher/assignments/[id]/paper-intelligence/mark-script/route.ts` | Claim before marking; 409 on a concurrent duplicate; release on both outcomes |
| `components/paperIntelligence/BulkScanUpload.tsx`, `app/teacher/assignments/[assignmentId]/paper-intelligence/page.tsx` | A 409 shown as "already being marked", not "failed" |
| `lib/ai/deepseek.ts` | 90s whole-stream deadline (Gemini and DeepSeek streams) |
| `lib/lessonPlan/scheduledGeneration.ts` *(new)* | Scheduled-plan eligibility + runner |
| `lib/repositories/curriculum.repository.ts` | `findTaughtPlansSince`, `findManualGenerationsSince` (batched) |
| `app/api/cron/friday-generation/route.ts` | Uses the eligibility runner; reports `not_in_use` |
| `.github/workflows/ci.yml` | Schema fingerprint pin `28ff24ca…` → `0b8f67ee…` with changelog |

**Tests and manifests:**

| File | Purpose |
|---|---|
| `lib/testing/maryFullCircuit.integration.test.ts` | Verifier fixture → current strict contract |
| `lib/career/aiReuseAndTargets.test.ts` | Pre-migration (table-missing) cases |
| `lib/career/careerNarrativeStore.integration.test.ts` *(new, DEEP)* | Post-migration narrative store |
| `lib/paperIntelligence/markingClaim.test.ts`, `lib/compass/compassTurnBounds.test.ts`, `lib/lessonPlan/scheduledGeneration.test.ts` *(new)* | §2–§4 |
| `app/api/teacher/assignments/[id]/paper-intelligence/mark-script/route.test.ts` | Claim behaviour |
| `scripts/standard-tests.json` | Registers the 3 new standard tests |
| `scripts/deep-tests.json` | Registers the new DEEP test |

**Rollback:** each item reverts independently.
- The claim leaves inert `ai.paper_script.mark` rows in `jobs`.
- Reverting the Friday change restores generation for every active/saved scheme.
- Reverting the pin must go together with the migration.

## 11. Final engineering verdict

**Ready for human review. Not yet ready to push without review. Not blocked.**

- Every gate that can be run locally passes on the final working tree: 1799 unit tests, type check, lint, build, all CI script gates, a correctly recomputed schema fingerprint, and the full DEEP_PR tier on an isolated database.
- The remaining DEEP failures are pre-existing (reproduced at `00f5dd8`) and unrelated to this work.
- Nothing has been committed, pushed, deployed or applied to any shared database.
- Local results are not production verification. CI on its own runner, the reviewed migration rollout and the post-deploy log checks (§9) are what establish that.

---

# Read-only pre-push review (2026-10-30, phase 3)

**Scope:**
- Review only. No application code, tests, fixtures, migrations or CI files were changed. This section is the only edit.
- Nothing was staged, committed, pushed, deployed or migrated.
- HEAD verified `00f5dd8`; staged changes: none.

**Verdict: READY FOR REVIEW.** Not ready to push until finding R-1 is decided, by a fix or by explicit acceptance, and the corrections below are acknowledged.

## Corrections to earlier sections of this report

- **§A item 3 / §G / phase-2 §3, "Compass sends no learner name to either provider": overstated.** True for the system-prompt identity line, the learner's message, stored history and the last-session summary. **Not** guaranteed for `student_learning_context.session_goal`. The class-report LLM bridge (`lib/career/autoReportGenerator.ts:261`, `restoreLearnerName`) can write the real first name into it, and Compass inserts it un-pseudonymised (`app/api/learn/route.ts:339-340` → `holidayFocus`; `:380` → knowledge block `Goal:`). See R-1.
- **"`replyTo.ts` byte-identical."** It is byte-identical to the user's own state (sha256 `17cba83a…`, mtime 2026-10-29 08:05 +0300, before this work). It is **not** identical to HEAD (`12a31c6b…`): it carries the user's pre-existing one-line uncommitted change (`NodeJS.ProcessEnv` → `Record<string, string | undefined>`). It is not part of this remediation.
- **"Three DEEP failures".** The 3 remaining failing tests are:
  - `variantGeneration` "regeneration…" (`TypeError` at `:192`);
  - `variantGeneration`'s `after` hook (`deleteAuthUserOrThrow`, dangling FK, `:146`);
  - compass-delivery's `after` hook (same error, `:227`).

  All three reproduced identically at `00f5dd8`. The separate maryFullCircuit AR2–AR7 failures (6, also present at HEAD) **are fixed** (34/34).

## Findings

| ID | Sev | Finding | Concrete failure mode | Recommendation |
|---|---|---|---|---|
| R-1 | **P1** | Residual learner-name channel into Compass via `session_goal` | The class-report model writes the `{{LEARNER}}` placeholder into `sessionGoal`, which its prompt allows. Restoration stores the real first name, and every later Compass turn in holiday mode or with knowledge-graph context sends it to Gemini/DeepSeek. Conditional and model-dependent; strictly narrower than before the remediation (name on every turn) | Before release: pseudonymise `holidayFocus`, `knowledgeContext.sessionGoal`, `guidedTopics` and `subjectActionSteps` in `lib/compass/providerPayload.ts`, or stop restoring names into `session_goal`. Add a test seeding a name-bearing `session_goal` |
| R-2 | P2 | A DeepSeek stream aborted at the 90s deadline (or erroring mid-body) skips the route's `flush` | The learner saw a partial reply that is never saved to `compass_messages`; `recordExchange` doesn't run; the token was already deducted at the first token. The Gemini path closes cleanly and does persist | Have the DeepSeek pass-through close gracefully on abort, as the Gemini path does |
| R-3 | P2 | Reflection starter templates assert unobserved outcomes ("Most learners achieved the intended outcomes") | A teacher submitting a starter unedited records an observation nobody made (same as the old fallback); the stored `reflection_source` still says `ai_suggestion` | Phrase starters as prompts or blanks; rename the source label |
| R-4 | P2 | Quota/claim enforcement is proven by reasoning and in-memory tests, not real-DB concurrency tests | Under READ COMMITTED the last inserter sees all prior commits, so insert-then-recount cannot over-admit; not exercised against Postgres | Add one DEEP test firing concurrent reservations at a real DB |
| R-5 | P2 | Friday signal edges | `/taught` accepts a client-supplied `taught_date`, so a future date keeps a scheme eligible. `/api/lesson-plans/generate` (no UI caller) writes no `generation_jobs` signal. Lookback is computed in UTC (≤3h edge vs EAT) | Clamp `taught_date ≤ today`; log manual generations there too |
| R-6 | P2 | Career report: if token deduction throws after a fresh generation, the route returns 500, but the narrative is already stored | The next view reuses it without charge | Deduct before storing, or treat the stored narrative as unpaid |
| R-7 | P2 | Compass client still sends `conversationHistory` (ignored server-side); double-send guard is React state | Wasted bandwidth. Multi-tab or scripted resends are not blocked server-side (each is bounded and charged per turn) | Drop the field in the client; idempotency per §D below |

**No P0 was found.** All verified controls:
- caps reserve before AI work and release on every failure exit (each route's exits inspected);
- router ≤3 requests;
- Gemini and DeepSeek aborts;
- Paper Intelligence claim (DB-backed via `jobs`, `processing` rows never claimed by the queue processor, 3-minute expiry);
- Friday eligibility signals are clean (the only `generation_jobs` writers are `generate-week` with NULL type and the cron with `weekly_lp`);
- graph-derived targets preserved;
- `UNKNOWN` root causes handled neutrally;
- the migration fails safe when absent.

## Product decisions (advisory)

1. **Paper Intelligence spend: monitor now, no cap.**
   - Use the telemetry that already exists (`feature: paper_intelligence_*`, real token counts) via a log drain or daily aggregate.
   - Alert on:
     - daily total vision tokens above a budget line;
     - one teacher above, say, 3× their class size in scripts per day;
     - repeated marking of the same `submission_id`.
   - Consider an emergency hard stop (a global kill switch for photo marking, scanner untouched, never per-paper billing) only on evidence:
     - sustained spend above the budget for 2+ days;
     - an anomalous account;
     - or a provider price change.
   - Per the 2026-10-28 decision, measure cost and accuracy per script for photo vs scanner first.
2. **Compass server-side idempotency: defer, with a defined trigger.**
   - **The risk of deferring:** duplicate or parallel turns from multi-tab, network retries or scripts double the AI cost, double-charge token users and interleave session state. Each turn stays bounded (≤3 requests, 1000 tokens).
   - **Minimum design:**
     - The client sends `clientTurnId` (UUID).
     - A migration adds `compass_messages.client_turn_id` with `UNIQUE (session_id, client_turn_id)`, plus `compass_sessions.turn_in_flight_until timestamptz`.
     - The route takes an atomic conditional update (`… WHERE turn_in_flight_until IS NULL OR < now()`) and returns 409/the stored reply on a duplicate.
   - **Evidence to decide:** the rate of same-session turns starting within 2s of each other, and of identical consecutive user messages (from `compass_messages` timestamps).
3. **Friday window: 21 days is a defensible provisional default.** It covers a 2-week lapse plus a buffer, and nothing in the repo derives it from usage data. Revisit after 4–6 weeks using:
   - share of generated plans later marked taught or edited;
   - share of eligible schemes with no activity in the following week;
   - re-activations via manual generation.

   Shorten it if more than ~30% of scheduled plans go unused; lengthen it if teachers report missing weeks after school breaks.

## Test matrix (this review)

| Check | Command | Environment | Result | Status |
|---|---|---|---|---|
| Unit | `npm test` | local, no secrets | 1799 / 1799 | **re-verified** |
| Type check | `npx tsc --noEmit -p tsconfig.json` | local | exit 0 | **re-verified** |
| CI gates | `check-architecture`, `check-route-auth`, `check-standard-manifest`, `check-tier-manifests`, `check-deep-pr-classification` | local | all pass (304 routes; 211 files; 144/6 tiers) | **re-verified** |
| Paper Intelligence route tests | `tsx --experimental-test-module-mocks --test 'app/api/teacher/assignments/*/paper-intelligence/*/route.test.ts'` | local | 58 / 58 | **re-verified** |
| Lint | `npx eslint <changed files>` | local | exit 0 | inherited (phase 2) |
| Build | `npx next build` | local | exit 0; no source file newer than that build | inherited, still applicable |
| DEEP_PR | `node scripts/run-deep-pr.mjs` | isolated pifp stack, `env -i` | 168 / 168, 0 residual | inherited (phase 2, saved logs) |
| Other DEEP | per-file `tsx --test` | isolated pifp | as phase-2 §6; 3 pre-existing failures, exact errors above | inherited (saved logs) |
| Fingerprint | CI bootstrap procedure | isolated pifp | `28ff24ca` reproduced, then `0b8f67ee`. Migration on disk is byte-identical (sha256 `abef3e20…`) to the fingerprinted copy; the fingerprinted set = HEAD's 129 migrations + this one | inherited; inputs **re-verified** |

## Proposed commit plan (not executed)

Stage **exact paths only**. Never stage `lib/growth/messaging/replyTo.ts`, the `docs/audits/` directory as a whole (it contains the user's `edunexus-end-to-end-integration-audit.md`), `Untitled-1.json`, `reports/`, `research_notes/`, `docs/manuscript/`, `docs/architecture/adaptive-engine-woven-audit-2026-10-28.md` or `docs/decisions/2026-10-05-evidence-store-write-target.md`.

1. **`feat: AI usage telemetry and bounded provider fallback ⚡`**
   - `lib/ai/usageTelemetry.ts`, `lib/ai/deepseek.ts`, `lib/ai/gemini.ts`
   - `lib/ai-orchestration/router.ts`, `lib/ai-orchestration/types.ts`
   - Feature tags: `lib/academy/aiJudge.ts`, `lib/slides/aiSlideGenerator.ts`, `lib/kiswahili/inshaEvaluator.ts`, `lib/teachingIntelligence/quickCheckGenerator.ts`, `lib/studyGroups/challengeGenerator.ts`, `lib/career/careerEngine.ts`, `scripts/backfill-career-doors.ts`
   - Remedial: `lib/remedial/planner.ts`, `lib/remedial/plannerRouterMigration.test.ts`
   - Variants: `lib/assignments/variantGeneration.ts`, `lib/assignments/variantGeneration.integration.test.ts`
   - Paper Intelligence timeouts: `lib/paperIntelligence/vision.ts`, `lib/paperIntelligence/schemeExtraction.ts`, `lib/paperIntelligence/scriptMarking.ts`
   - Tests: `lib/ai/requestBudget.test.ts`
2. **`fix: enforce daily AI caps with reservations 🔧`**
   - `lib/ai/rateLimit.ts`, `lib/repositories/analytics.repository.ts`, `lib/payments/config.ts`
   - `lib/career/knowledgeRequests.ts`, `lib/career/knowledgeRequests.test.ts`, `lib/career/careerProvenance.test.ts`
   - The 14 capped routes: `app/api/{sow/generate,slides/generate,remedial/generate,holiday/generate,teaching-intelligence/quick-check,kiswahili/insha-feedback}/route.ts`, `app/api/teacher/classes/[classId]/generate-reports/route.ts`, and the three variant routes
   - Tests: `lib/ai/rateLimit.test.ts`, `lib/ai/aiCallGovernance.architecture.test.ts`
   - *Depends on 1 for `feature` options.*
3. **`security: Compass learner-name minimisation and server-side history 🔒`**
   - `lib/ai/learnerPseudonym.ts`, `lib/compass/prompt.ts`, `lib/compass/providerPayload.ts`, `lib/compass/session.ts`, `lib/repositories/compass.repository.ts`, `app/api/learn/route.ts`
   - Tests: `lib/compass/prompt.test.ts`, `lib/compass/aiGroundingContract.integration.test.ts`, `lib/compass/learnerContext.integration.test.ts`, `lib/compass/compassPrivacy.test.ts`, `lib/compass/compassTurnBounds.test.ts`
   - *Ideally with the R-1 fix.*
4. **`refactor: deterministic root cause, weekly note and reflection starters ♻️`**
   - `lib/teachingIntelligence/rootCauseClassifier.ts`, `lib/teachingIntelligence/weeklyGenerator.ts`, `lib/lessonPlan/generator.ts`
   - Tests: `lib/teachingIntelligence/deterministicIntelligence.test.ts`
5. **`fix: lesson-plan week pre-check, partial success and Friday eligibility 🔧`**
   - `lib/lessonPlan/weeklyGenerator.ts`, `lib/lessonPlan/types.ts`, `lib/lessonPlan/scheduledGeneration.ts`, `lib/repositories/curriculum.repository.ts`
   - `app/api/lesson-plans/generate/route.ts`, `app/api/lesson-plans/generate-week/route.ts`, `app/api/cron/friday-generation/route.ts`
   - `app/teacher/documents/page.tsx`, `app/teacher/lesson-plans/page.tsx`
   - Tests: `lib/lessonPlan/weekGeneration.test.ts`, `lib/lessonPlan/scheduledGeneration.test.ts`
   - *The cron file also carries the root-cause call change from 4; commit 4 first.*
6. **`fix: class reports keep graph targets and report failed briefings 🔧`**
   - `lib/career/autoReportGenerator.ts`, `lib/holiday/planner.ts`
   - Tests: `lib/career/classReportHonesty.test.ts`
7. **`fix: SOW keeps official KICD fields server-side 🔧`**
   - `lib/sow/aiLessonGenerator.ts`
   - Tests: `lib/sow/aiGenerationRemediation.test.ts`
8. **`feat: Career Intelligence narrative reuse + migration + schema pin 🎯`**
   - `supabase/migrations/20261030120000_career_intelligence_narratives.sql` **with** `.github/workflows/ci.yml`
   - `lib/career/careerIntelligenceEngine.ts`, `lib/career/types.ts`, `lib/repositories/career.repository.ts`, `app/api/career/intelligence-report/route.ts`
   - Tests: `lib/career/aiReuseAndTargets.test.ts`, `lib/career/careerNarrativeStore.integration.test.ts`
9. **`fix: one Paper Intelligence marking pass per script 🔧`**
   - `lib/paperIntelligence/markingClaim.ts`, `lib/repositories/job.repository.ts`
   - `app/api/teacher/assignments/[id]/paper-intelligence/mark-script/route.ts` and its `route.test.ts`
   - `components/paperIntelligence/BulkScanUpload.tsx`, `app/teacher/assignments/[assignmentId]/paper-intelligence/page.tsx`
   - Tests: `lib/paperIntelligence/markingClaim.test.ts`
10. **`test: fix maryFullCircuit verifier fixture; register new tests 📋`**
    - `lib/testing/maryFullCircuit.integration.test.ts`, `scripts/standard-tests.json`, `scripts/deep-tests.json`
11. **`docs: AI-call efficiency audit and remediation record 📋`**
    - `docs/audits/ai-call-efficiency-deep-audit.md`, `docs/audits/ai-call-efficiency-remediation.md`

**Check before staging:** `lib/repositories/*.ts` and the cron route hold hunks from more than one group. Stage with `git add -p`, or merge the related groups. Run `npm test` + `npx tsc --noEmit` after each commit.

**Release order:**
1. Human review.
2. Commits as above.
3. Push the branch; CI confirms the `0b8f67ee` fingerprint, DEEP_PR and the architecture gates on its own runner.
4. Migrate staging.
5. Staging smoke tests:
   - Compass turn; career report generate then re-open (`narrative_source: reused`);
   - double-tap mark-script → 409;
   - a capped route at its limit → 429;
   - Friday cron dry run → `lp.not_in_use`.
6. Production migration (separately authorised).
7. Deploy.
8. Post-deploy log checks (phase-2 §9).

## Pre-push checklist

**Release blockers:**
- [ ] Decide R-1: fix (recommended, small) or explicitly accept and document the residual channel.
- [ ] Human review of the diff with the exclusions above.

**Prudent follow-ups (not blocking):**
- [ ] R-2 … R-7.
- [ ] Owner fixes for the 3 pre-existing DEEP failures.
- [ ] Decide on DEEP_MAIN promotion of `careerNarrativeStore.integration.test.ts`.
- [ ] Monitoring and alerts per decision 1.
- [ ] Confirm `lesson_plans_sow_week_lesson_key` exists in production.

## Explicit non-actions (this review)

- Nothing staged, committed, pushed, deployed or migrated.
- No database touched: the review used static inspection, local tests and saved logs; the pifp stack stays stopped.
- No application code, test, fixture or CI file modified.
- `replyTo.ts`: unchanged from the user's own state (sha256 `17cba83a…`). Differs from HEAD only by the user's pre-existing edit.

---

# Phase 4 — R-1 Learner Identity Leakage Correction (2026-10-30)

Fixes the single P1 from the phase-3 review. Scope limited to R-1 and its tests; no entitlement, pricing or limit changed. Nothing staged, committed, pushed, deployed or migrated.

## Root cause

`buildCompassPrompt` (`lib/compass/prompt.ts`) takes no learner-name parameter, so phase 1 treated the Compass system prompt as name-free. But the builder interpolates **persisted learner-state fields**, and the class-report path seeds some of them with the real name:

1. `lib/career/autoReportGenerator.ts` asks the model for a `compass_bridge` whose text fields use the `{{LEARNER}}` placeholder, then calls `restoreLearnerName(bridge, learnerFirstName(student.name))` — writing the **real first name** back into every string in the bridge (`sessionGoal`, `firstConcept`, `weeklyMilestones[].checkConcept`, …).
2. Those are persisted to `student_learning_context` (`session_goal`, `guided_topics`) and `compass_bridge`.
3. A later Compass turn (`app/api/learn/route.ts`) reads them back into prompt fields — `holidayFocus` (← `session_goal`), `knowledgeContext.{sessionGoal,guidedTopics,subjectActionSteps,rootCauseSummary}`, `teacherRecommendation` (← `compass_bridge.strandName`), `subtopic` (← `compass_bridge.firstConcept`).
4. `buildCompassPrompt` renders them (`Focus:`, `Goal:`, `Probe first:`, `Action:`, `Root cause:`, `Teacher instruction:`), and `streamDeepSeek` sends the prompt to Gemini (primary) and DeepSeek (fallback).

The learner's own message, history and last-session summary were already pseudonymised; these persisted-state fields were not.

## Affected data flow

`student.name` → `restoreLearnerName` (autoReportGenerator) → `student_learning_context.session_goal` / `guided_topics` / `subject_action_steps` / `compass_bridge.{firstConcept,strandName}` → Compass route reads → `holidayFocus` / `knowledgeContext.*` / `teacherRecommendation` / `subtopic` → `buildCompassPrompt` → `streamDeepSeek` → Gemini + DeepSeek.

The class-report prompt that produces the bridge **does not** itself send the name — it uses `${LEARNER_NAME_TOKEN}` (verified). The leak is only through persisted state re-entering a later prompt.

## Fields protected

Every interpolated field, because the fix pseudonymises the **assembled prompt string**, not individual fields: `holidayFocus`, `knowledgeContext.sessionGoal`, `guidedTopics`, `subjectActionSteps`, `rootCauseSummary`, `teacherRecommendation`, `subtopic`, `lastSessionSummary`, and any field added later. (`rootCauseTopic`/`failingTopic` are knowledge-graph topic labels, not learner text, but are covered anyway.)

## Where pseudonymisation occurs

`lib/compass/providerPayload.ts` — new `pseudonymiseCompassSystemPrompt(systemPrompt, firstName)`, a thin deterministic wrapper over `pseudonymiseLearnerName`. The route calls it on the finished `buildCompassPrompt(...)` output, after all construction and context enrichment, before `streamDeepSeek`:

```
const systemPrompt = pseudonymiseCompassSystemPrompt(buildCompassPrompt(promptParams), nameForProvider)
```

`nameForProvider = hasRealName ? firstName : null` (never the `'there'` display fallback). The prompt's own `{{LEARNER}}` placeholders are untouched; only the real name is replaced. The locally stored `student_learning_context` is **not** altered — only what leaves to the provider — so parent-facing reports keep the real name, and the learner still sees their name locally via the stream restorer.

## Gemini and DeepSeek coverage

`streamDeepSeek(systemPrompt, …)` passes the same `systemPrompt` to `streamGemini` (primary, `systemInstruction`) and `fetchDeepSeekStream` (fallback, `system` message), and both retry on the same body (verified in `lib/ai/deepseek.ts`). Pseudonymising the one assembled string therefore covers primary, fallback and retries — the guarantee does not depend on which provider answers.

## Regression tests

`lib/compass/compassNameLeak.test.ts` (new, 9 tests; registered in `scripts/standard-tests.json`). A `promptParams` fixture packs the real name into **every** affected field. Tests:

1. the raw assembled prompt really does leak the name through each line (the vulnerability is real, not hypothetical);
2. the boundary removes it from every field — first name, and a first name that appeared inside a full name;
3. case variations (`WANJIRU`/`wanjiru`/`Wanjiru`);
4. repeated occurrences all replaced;
5. ordinary words containing the name as a substring (`Canada`, `gradable`) are not corrupted, while a standalone occurrence is;
6 & 7. the **real** `streamDeepSeek` with a mocked `fetch`, Gemini 503 → DeepSeek fallback: neither provider's HTTP body contains the name, both contain `{{LEARNER}}`;
8. a learner with no stored name → null name, nothing replaced, no crash;
9. local display still restores the correct name (outbound-only fix);
   plus a scoping test: the prompt is scrubbed against **this** session's learner name only, and nothing introduces another learner's name.

Existing `compassPrivacy.test.ts` and `compassTurnBounds.test.ts` remain valid and pass (the builder still has no name parameter).

## Logging review

- `app/api/learn/route.ts`: the only logs are error objects and the `operation`/`sessionId` context — no prompt, message, history or name is logged (inspected lines 414, 440, 545, 609, 673, 746).
- `lib/ai/usageTelemetry.ts`: records no prompt/completion/content field (grep-confirmed).
- `lib/career/autoReportGenerator.ts`: failure logs carry the exception and `studentId`, never the bridge text or name.
- The eval-parse error logs operate on `accumulated`, which holds the model's `{{LEARNER}}`-token output, not the real name.

No logging leak was found from this data flow. No prompt/name logging was added.

## Remaining limitations

- Pseudonymisation is scoped to the learner's **stored first name**. A surname (when only the first name is held), a nickname, or a classmate's name typed by the learner is not removed. This is the documented, pre-existing limitation of `pseudonymiseLearnerName`, unchanged by this phase.
- A first name identical to an ordinary word (e.g. "Grace", "Joy") is replaced in its ordinary sense too — the accepted privacy-over-fidelity trade-off, consistent across the codebase.
- Learner academic content (grades, levels, topics) still goes to providers; that is the tutoring payload, out of scope for R-1.

## Verification (exact commands and results)

| Check | Command | Result |
|---|---|---|
| New R-1 tests | `tsx --experimental-test-module-mocks --test lib/compass/compassNameLeak.test.ts` | 9 / 9 |
| Compass + class-report suite | `tsx … --test lib/compass/{compassNameLeak,compassPrivacy,compassTurnBounds,prompt}.test.ts lib/ai/learnerPseudonym.test.ts lib/career/{classReportHonesty,aiReuseAndTargets}.test.ts` | 54 / 54 |
| Full unit suite | `npm test` | **1808 / 1808** (was 1799; +9) |
| Type check | `npx tsc --noEmit -p tsconfig.json` | exit 0 |
| Lint (changed) | `npx eslint app/api/learn/route.ts lib/compass/providerPayload.ts lib/compass/compassNameLeak.test.ts` | exit 0 |
| Architecture | `node scripts/check-architecture.mjs` | pass |
| Route auth | `node scripts/check-route-auth.mjs` | pass (304 routes) |
| Standard manifest | `node scripts/check-standard-manifest.mjs` | OK (212 files) |
| Tier manifests | `node scripts/check-tier-manifests.mjs` | pass (144 files / 6 tiers) |

Not rerun this phase: `next build` and the DEEP database suite (no source change affects the build graph beyond what phase-2/3 already built and ran; the change is provider-boundary string handling with full unit coverage). They remain as recorded in phase 2/3.

## Files changed

| File | Change |
|---|---|
| `lib/compass/providerPayload.ts` | New `pseudonymiseCompassSystemPrompt`; corrected the module comment that wrongly claimed the system prompt never carries a name |
| `app/api/learn/route.ts` | Pseudonymise the assembled system prompt at the provider boundary; `nameForProvider` const; import the new helper |
| `lib/compass/compassNameLeak.test.ts` | New R-1 regression suite (9 tests) |
| `scripts/standard-tests.json` | Register the new test |

`lib/growth/messaging/replyTo.ts` untouched (sha256 `17cba83a…`).

## R-1 status: FIXED

The learner's stored first name can no longer reach Gemini or DeepSeek through any persisted Compass prompt field, verified on the real provider request bodies for both the primary and fallback paths. The release blocker in the phase-3 checklist is cleared; a human diff review remains the only outstanding blocker.
