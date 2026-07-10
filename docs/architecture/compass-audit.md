# Compass Audit Report

**Status:** Understanding only — no redesign proposed. Compass will be redesigned in a later phase; this document describes the system exactly as it exists today.

**Scope:** Session lifecycle, API routes, prompt design, conversation flow, state management, persistence, evidence generation, Projection integration, adaptive learning, subject selection, mastery progression, behaviour signals, teacher/learner interaction points, dashboard integration, data dependencies, legacy dependencies, Projection Engine usage, and learner-first architectural assumptions.

**Method:** Full read of `lib/compass/*`, `app/api/learn/*`, `app/api/compass/*`, `app/api/teacher/**/compass*`, `app/api/parent/compass-activity`, `components/compass/*`, `components/dashboard/learning-compass-ui.tsx`, `app/dashboard/learning-compass/page.tsx`, `app/dashboard/page.tsx`, `app/student/page.tsx`, `app/teacher/alerts/page.tsx`, the Compass tab in `app/teacher/classes/[classId]/page.tsx`, `lib/adaptiveLearning.ts`, `lib/learnerModel/updater.ts`, `lib/projection/*`, `lib/intelligence/*`, and `lib/database.types.ts` for every table Compass touches.

---

## 0. System Map (for orientation)

**Tables:** `compass_sessions` (session row, keyed by `learner_id` + `subject`, no declared FK), `compass_messages` (per-turn transcript), `compass_outcomes` (teacher/AI mastery goals, unused by the files in scope), `compass_progress` (aggregated velocity, unused by the files in scope), `student_learning_context` (per-student "brain": tiers, bridge, rest windows, root causes), `students`, `class_students`, `learner_profiles` (legacy learner-model store), `learner_evidence` (new Evidence store).

**Entry surfaces:** `/learn` (live student subject-picker + chat, backed by `app/api/learn/*`), `/chat` (a second, separately-reached Compass entry point linked from teacher alerts and the parent-dashboard splash), `/dashboard` (parent activity feed), the per-class **Compass tab** and **Compass Topic Picker** (teacher-facing, in `app/teacher/classes/[classId]/page.tsx`).

**Core files:** `lib/compass/session.ts` (session state machine), `lib/compass/prompt.ts` (system prompt assembly), `lib/compass/evidence.ts` (Evidence-side write), `lib/compass/topics.ts` / `lib/compass/topicSelector.ts` (two separate curriculum-topic query paths — see §10), `app/api/learn/route.ts` (the turn-processing route; the biggest single file in this system).

---

## 1. Session Lifecycle

**What it does.** A session is a row in `compass_sessions` with `status ∈ {active, completed, abandoned}`. `getOrCreateSession()` (`lib/compass/session.ts:58-111`) first tries to resume: school-mode sessions are resumable within a 3-hour window and only if created "today"; holiday-mode sessions within 30 minutes (`SCHOOL_RESUME_MS` / `SESSION_TTL_MS`, lines 53-54). If nothing resumable is found, any orphaned `active` row for that student+subject is force-abandoned (`findStaleActiveSessions` → `abandonSession`) before a fresh row is inserted. Ending a session (`endSession()`, lines 212-238, called from `app/api/learn/end/route.ts:116`) sets `status`/`completed_at`/`duration_seconds` and fires a `student.session.completed` event via `publishEvent`, idempotency-keyed on the session id.

**Why it was designed that way.** The dual resume windows (3h vs 30min) read as a deliberate accommodation for two different real-world usage patterns: a school-day session that a student might step away from and return to within the same day, versus a holiday self-study session with a tighter "still the same sitting" definition. The lazy-cleanup-on-next-start pattern (rather than a cron sweep) avoids needing a scheduled job just to close abandoned sessions.

**Fit with Evidence → Projection.** Loosely compatible — `endSession` is already the trigger point that fires an event and (separately) calls the Evidence writer, so the *hook* for evidence generation is in the right place. But the mechanism has no relationship to Projection confidence/trust-tier concepts; it's purely a UX/state-machine concern.

**Findings / rot:**
- `isSessionExpired()` (session.ts:206-208) is exported but not called anywhere in the reviewed code — appears vestigial.
- A stale active session is only cleaned up the *next* time the same student starts a session for the *same subject* — an abandoned tab can sit as `status='active'` indefinitely otherwise.
- `CompassRepository.findRecentSessionsByStudent` (`lib/repositories/compass.repository.ts:318-337`) queries `compass_sessions` by `student_id` and selects a `topic` column — **neither exists** on the real schema (`learner_id`/`subject` per `lib/database.types.ts:2197-2256`). This method is actively called from `lib/parentPulse/builder.ts:39` and will throw on every call — direct evidence the table was renamed in some call sites but not all.

**Verdict: Modify.** The state machine itself is sound; it carries a live bug (`findRecentSessionsByStudent`) and dead code (`isSessionExpired`) that need cleanup independent of any redesign.

---

## 2. API Routes

Four routes carry Compass: `app/api/learn/route.ts` (POST, the chat turn), `app/api/learn/progress/route.ts` (GET), `app/api/learn/end/route.ts` (POST), `app/api/learn/student/route.ts` (GET). Plus `app/api/compass/topics/route.ts` (GET, orphaned client — see §10).

**What each does / how thin it is:**
- **`learn/route.ts`** — by far the least thin. Auth via `checkFeatureAccess` (a sanctioned paywall+auth helper, not the generic `requireAuth`), plus a second independent `checkDailyCallLimit` gate. Inline business logic includes: Kenya CBC term-calendar mode detection (`detectMode()`, lines 17-41), a third copy of `tierToLevel()` (lines 46-51, also defined in `session.ts` and in `learn/student/route.ts`), keyword-based subtopic-compatibility matching, pathway normalization, the entire SSE transform stream and hidden-eval-block parser (lines 396-533), and multiple raw `db.from(...)` calls that bypass `repos.compass` entirely.
- **`learn/progress/route.ts`** — genuinely thin: auth, one ownership check, delegates to `lib/learn/progress.ts`, returns via `apiSuccess`/`apiError`. Matches CLAUDE.md's "thin route" convention.
- **`learn/end/route.ts`** — Zod-validated body (the only one of the four that is), but still carries inline `calcXp()`, week-boundary math, weekly/total session bookkeeping, and a group-bonus-points side effect with its own anti-farming check — none of it in `lib/`.
- **`learn/student/route.ts`** — the only route using `createClient()` + `auth.getUser()` directly rather than `checkFeatureAccess` (no token gate needed here, but an inconsistent pattern versus its siblings). Contains a fourth-ish shaping layer (`shapeAndReturn()`) and an explicit `TODO` acknowledging its multi-student "picker" branch is a stopgap. **The explicit-`studentId` query-param branch performs no ownership check at all** — any authenticated user supplying an arbitrary `studentId` gets that student's full learning context back.

**Why it was designed that way.** `learn/route.ts` reads as a file that grew turn-by-turn — new derivations (mode, level, subtopic, pathway) were added inline as new requirements arrived, rather than being extracted, because each addition was small in isolation.

**Fit with Evidence → Projection.** Neutral — these are transport-layer concerns, not evidence-model concerns. But the inline business logic makes it harder to see where an evidence-relevant fact (e.g. "which level was this turn evaluated at") is actually computed versus just passed through.

**Verdict: Modify.** `learn/progress` — Keep as-is. `learn/end` and `learn/student` — Modify (extract inline logic to `lib/`, per CLAUDE.md's own stated architecture rule). `learn/route.ts` — Modify (highest-priority cleanup target: triplicated `tierToLevel`, unguarded routes, inline business logic). The unguarded `studentId` branch in `learn/student/route.ts` is a live authorization gap, not just a style issue.

---

## 3. Prompt Design

**What it does.** `buildCompassPrompt()` (`lib/compass/prompt.ts:45-196`) assembles a fresh system prompt on every single turn (`app/api/learn/route.ts:373`). A static skeleton defines the "Compass" persona and pedagogy: a Teach/Probe/Remediate/Advance loop, a "MASTERY MODEL" section instructing the AI to use CBC bands BE/AE/ME/EE, a "KNOWLEDGE GRAPH BEHAVIOR" section, misconception-detection rules, language rules (English/Kiswahili code-switching), and a hardcoded Kiswahili-strand list (Kusikiliza na Kuongea / Kusoma / Kuandika / Sarufi na Msamiati / Fasihi). A dynamic portion injects the learner's name/grade/level/pathway, the session's subject/focus/mode, a KICD grade-topic list (from `lib/compass/topics.ts`), an optional "internal, never quote to learner" knowledge-graph block sourced from `student_learning_context`, one of three scripted openers, and closing instructions telling the model to emit a hidden `COMPASS_EVAL_START {...} COMPASS_EVAL_END` block.

**Why it was designed that way.** Per-turn reassembly (rather than a fixed prompt + separate context injection) keeps the model's instructions and the student's live state in one place, and the hidden eval block is a pragmatic way to get a structured signal out of a free-text chat model without a second API call.

**Fit with Evidence → Projection.** The hidden eval block *is* the connective tissue to Evidence (see §7) — but it is the model's own unverified self-report, which is a fundamentally different confidence category than the "Trust Tier" model the Evidence pipeline otherwise uses for teacher/assessment-sourced data.

**Findings / rot:**
- `KICD topics (Grade X)` and the Kiswahili strand list are unconditionally CBC-framed — there is no branch for 8-4-4 or IGCSE curricula even though `lib/curriculum/igcse.config.ts` exists elsewhere; Compass does not import `lib/curriculum/*` at all.
- Level defaults to `2` when nothing else is known, and `tierToLevel()` is copy-pasted (not imported) in three separate files.

**Verdict: Modify.** The pedagogical structure (Teach/Probe/Remediate/Advance, misconception detection) is a real, non-trivial design asset worth keeping. The curriculum-framing hardcoding and triplicated helper functions are legacy debt independent of any redesign decision.

---

## 4. Conversation Flow

**What it does.** Per turn: client posts message + session/lock state + client-held conversation history → server resolves subject (`resolveSubject()`: locked subject → saved session subject → client-supplied subject → **keyword regex match against the raw message text** → default `'mathematics'`) → builds the system prompt → calls `streamDeepSeek()` (the sole AI-call site) → streams the reply back after re-encoding SSE chunks → on stream `flush()`, parses out the hidden eval block, updates `exchange_count`/`session_state`/`student_learning_context`, writes two rows to `compass_messages`, deducts tokens.

**Why it was designed that way.** Streaming keeps perceived latency low for a chat UI; doing all the bookkeeping in the stream's `flush()` callback lets the route return a response immediately while still capturing the eval-derived side effects once the full text is available.

**Fit with Evidence → Projection.** Partial. The single point where "evidence of learning" could be captured is the AI's self-reported `genuine_progress` flag — there is no independent, server-verified check of correctness inside the turn itself. `lib/compass/evidence.ts`'s own header comment is explicit about this: Compass evidence is Trust Tier 1 ("AI-inferred... never equated with human-verified evidence"), capped at confidence 60.

**Findings / rot:**
- `streamDeepSeek()` actually tries **Gemini first** and only falls back to real DeepSeek if Gemini fails (`lib/ai/deepseek.ts:345-360`) — a naming/behavior mismatch.
- `max_tokens` for the streaming call is hardcoded to 1000 inside the AI-call layer, not parameterized from the caller — conflicts with CLAUDE.md's "always set max_tokens explicitly [per call]" in spirit, since Compass has no way to tune it per session type.
- The keyword-regex subject fallback (`'fraction'`→mathematics, etc.) is a coarse legacy mechanism, not curriculum-driven, and silently defaults to mathematics for anything unmatched.

**Verdict: Modify.** The turn-processing shape (resolve → prompt → stream → close-out) is workable, but the trust model for what counts as "evidence of learning" from a single free-text turn is the crux of whether this flow can ever feed Projection meaningfully — that question is explicitly out of scope for this audit, but the *current state* is: self-reported only, no independent verification.

---

## 5. State Management

**What it does.** State is split three ways: (1) `compass_sessions.session_state` (JSON) holds derived pedagogical state — locked subject/substrand/grade, `overallLevel`, `masteredConcepts` (capped at 20), `consecutiveRight`/`consecutiveWrong` — read via `readSession()` and written via `writeSession()`, which does a **full overwrite**, not a merge (an earlier select-then-merge pattern was deliberately removed as redundant, per an in-code comment). (2) The client holds and re-sends the full `conversationHistory` array every turn — the server does not reconstruct history from `session_state`. (3) `compass_messages` independently persists a parallel transcript, insert-only, for other consumers (e.g. the teacher-facing "latest insight" read).

**Why it was designed that way.** Splitting "chat transcript" (client-supplied + `compass_messages` log) from "derived pedagogical state" (`session_state`) keeps the state blob small and avoids re-deriving locked subject/level from a full message-history replay every turn.

**Fit with Evidence → Projection.** Neutral-to-compatible — none of this is Evidence-shaped data; it's session-scoped UX state, which is a reasonable thing to keep separate from a durable Evidence record.

**Findings / rot:**
- `consecutiveRight`/`consecutiveWrong` exist in the type and are round-tripped every turn but are **never actually incremented anywhere** in the reviewed code — always passed through as whatever was previously stored (effectively always 0).
- A leftover reference to `sessionState.currentSubject` exists in `learn/route.ts` even though the persisted `CompassSession` type has no such field (only `lockedSubject`) — unreachable, cast through a loose type to avoid a compile error.

**Verdict: Modify.** The three-way split is a reasonable pattern; the dead fields (`consecutiveRight/Wrong`, `currentSubject`) are cleanup items regardless of redesign direction.

---

## 6. Session Persistence

**What it does.** At start: an insert with `status:'active', exchange_count:0, session_state:{}`, plus a **fire-and-forget** `starting_level` update with no error handling. Per turn: `exchange_count` increment, conditional `one_line_summary`/`student_learning_context` updates (wrapped in try/catch that only logs on failure), full `session_state` overwrite, two `compass_messages` inserts, token deduction. At end: `status`/`completed_at`/`duration_seconds`, `xp_earned`, `student_learning_context` session counters, an optional study-group bonus-points write, a published event, and two further async writes — `updateFromCompass()` (legacy learner model) and `recordCompassSessionEvidence()` (new Evidence) — both `.catch()`-swallowed.

**Why it was designed that way.** Fire-and-forget writes for secondary bookkeeping (starting level, learner-model update, evidence write) keep the user-facing response fast and non-blocking; the tradeoff is that failures in those paths are invisible to both the caller and, in most cases, any operator.

**Fit with Evidence → Projection.** This is where the dual-write pattern lives explicitly and by design — `app/api/learn/end/route.ts` comments reference `docs/architecture/migration-ledger.md` directly, acknowledging both the legacy Learner Model write and the new Evidence write are intentionally active in parallel pending downstream migration.

**Findings / rot:** Because the AI-eval-block update and the two end-of-session downstream writes are all silently swallowed on error, a failure in any of them produces no visible symptom — the client still gets a 200 with XP/level numbers regardless of whether `learner_profiles` or `learner_evidence` was actually updated.

**Verdict: Modify.** The dual-write itself is a deliberate, documented migration strategy — appropriate for its stated purpose. The blanket error-swallowing on secondary writes is a separate, general reliability concern.

---

## 7. Evidence Generation

**What it does.** `recordCompassSessionEvidence()` (`lib/compass/evidence.ts:30-86`) fires on every `POST /api/learn/end` call (both completed and abandoned sessions) and builds one `LearnerEvidence` row: `evidenceSource: 'compass_session'`, `assessmentType: 'assignment'` ("closest fit" per an in-code comment — no real enum value exists for "completed a Compass session"), `score: null`, `cbcLevel: null` — i.e. **no score or CBC level is carried at all**. Confidence is computed at Trust Tier 1, capped at 60, which is below the 85 auto-confirm threshold, so `resolveReviewStatus()` **always** returns `pending_review`. This is written through the standard `persistEvidenceBatch()` pipeline into `learner_evidence`, with an ingestion run row for traceability.

**Why it was designed that way.** Tier-1/pending-review-always is a deliberate trust-modeling choice, documented in the file's own header comment: AI-inferred signal should never be silently treated as equivalent to teacher-verified or assessment-verified evidence.

**Fit with Evidence → Projection.** Mechanically correct as a *producer* — it uses the real Evidence pipeline, tagged with the real trust-tier system. But structurally thin: the Evidence shape captures only subject + abandoned-flag, none of the richer behavioural signal (consecutive right/wrong, session duration, mastered concepts, self-initiated-vs-teacher-assigned) that the legacy learner-model path computes for the same event (see §12).

**Verdict: Modify.** The mechanism (trust-tier tagging, pending-review default) is sound and consistent with the platform's evidence philosophy. The shape is incomplete relative to what's actually knowable about a Compass session, and — per §8 — the review status it's assigned means it can never currently do anything downstream anyway.

---

## 8. Projection Integration

**What it does — traced end to end.** `learn/end` → `recordCompassSessionEvidence` → `persistEvidenceBatch` → a `learner_evidence` row with `lifecycle_state: 'pending_review'`. The Projection outbox (`evidence_projection_events`) is only populated for rows where `lifecycle_state === 'auto_confirmed'`, or via `confirmReview()` when a human confirms pending evidence. **Grepping the full app tree found zero production callers of `confirmReview`/`getPendingReview`** — only the library file itself and integration tests reference them; there is no review/confirm route anywhere in `app/api/**`. Separately, `processProjectionEvents()` (the outbox consumer) is also called from nowhere in production. The real, live path into Projection is a **direct** recompute call (`recomputeLearnerProjection(s)`, called from `lib/school/intelligence.ts`, `lib/learnerIntelligence/blueprint.ts`, `careerIntelligence.ts`, `lib/attentionFeed/panel.ts`), which itself hard-filters source evidence to `lifecycle_state IN ('auto_confirmed', 'reviewed_confirmed')` — so Compass evidence, permanently stuck at `pending_review`, is excluded from every one of these call sites too.

**Why it was designed that way.** The intent (per `behaviourProjector.ts`'s own header comment and `docs/architecture/migration-ledger.md`) was to wire Compass as one of several behavioural evidence sources feeding a `behaviourProjector`, activating "once a source starts producing evidence." That framing is not quite accurate against what was found: a source *is* producing evidence — the promotion step that would let it count was simply never built.

**Fit with Evidence → Projection.** This is the single clearest gap found in the whole system. The wiring is architecturally correct in shape (evidence is tagged `compass_session`; `behaviourProjector.ts` explicitly filters for that source), but there is no path today by which any Compass evidence becomes `auto_confirmed` or `reviewed_confirmed`. In practice, **no Compass session data reaches any Projection or any `LearnerIntelligenceProjection` for any student today.**

**Verdict: Modify — this is an incomplete implementation, not a wrong design.** The evidence-producer side and the projector-consumer side both exist and agree on the contract; only the confirm/promote mechanism in between is missing.

---

## 9. Adaptive Learning Logic

**What it does.** `lib/adaptiveLearning.ts` (405 lines) is a pure, DB-free recommendation engine: CBC-score → tier mapping, canned per-subject/per-tier action-step text libraries, and a `calculateLearningVelocity()`/`analyzePerformance()` pair that computes trend classification from a caller-supplied `assessments` array.

**Why it was designed that way.** Appears built as a standalone, presentation-oriented helper for Academic Clinic reports — static content generation rather than model-derived insight.

**Fit with Evidence → Projection.** Not applicable directly — **Compass does not call this file at all** (confirmed by grep: no import under `lib/compass/` or `app/api/learn/`). Its only callers are `lib/academicClinic/careerEngine.ts`, `lib/academicClinic/assessmentPipeline.ts`, and a few one-off scripts. It operates on raw scores, not `EvidenceRow`/Projection data, and uses its own separate tier/trend vocabulary that doesn't match the Projection Engine's (`CapabilityLevel`, `Trend`).

**Verdict: Out of Compass's scope — flag for a separate Academic Clinic audit.** Relative to Compass specifically: no relationship exists to modify or remove. Relative to the platform as a whole: this is a second, parallel "derive a tier from scores" implementation alongside the Projection Engine, with no shared code between them.

---

## 10. Subject Selection

**What it does — two disconnected systems exist.**

**(A) The live path**, used by `/learn`: subject chosen from a fixed card grid per grade/curriculum-tier; `getNextSubject()` (`session.ts:129-193`) can auto-pick by teacher recommendation first, else weakest-tier-first ranking from `student_learning_context.subject_tiers`, filtered to pathway subjects for seniors via a hardcoded `PATHWAY_SUBJECTS` map, defaulting to `'mathematics'` if nothing qualifies. No strand/substrand picker is wired into this live page at all — the "subtopic" comes from a teacher recommendation or defaults to the subject name itself.

**(B) An orphaned, more curriculum-rigorous path**: `components/compass/TopicSelector.tsx` / `TopicChoice.tsx`, backed by `lib/compass/topicSelector.ts` and `app/api/compass/topics/route.ts`, implement a real strand→substrand picker sourced from `sow_grades → sow_learning_areas → sow_strands → sow_substrands` (commented as "single source of truth" in the code). **Neither component is imported anywhere in the live app** outside a stale worktree copy — confirmed by grep. `TopicChoice.tsx` also references a `LessonOutcome`/`milestones` shape with **no producer anywhere in the codebase** (`app/api/compass/outcome/generate/` is an empty directory).

A third, separate query path — `getGradeTopics()` (`lib/compass/topics.ts`) — is what actually feeds the live prompt's "KICD topics" line, via a Supabase RPC, distinct from and non-overlapping with the `sow_*` strand tree used by the orphaned components. Compass imports neither of these through `lib/curriculum/` (which holds the CBC/IGCSE config); it queries curriculum-adjacent tables directly, in two different ways, in two different files.

**Why it was designed that way.** The orphaned components read as a more deliberate, curriculum-correct design that was likely built as a follow-up improvement but never actually wired into `/learn`'s live flow — possibly superseded by the simpler card-grid + auto-pick approach before shipping.

**Fit with Evidence → Projection.** Neutral — this is a UX/curriculum-data concern, not an evidence concern, but the curriculum-data duplication (two query paths into presumably the same underlying tables) is a data-integrity risk independent of Projection.

**Verdict:** Live path (A) — **Modify** (keyword-fallback and duplicate curriculum-query paths are cleanup items). Orphaned path (B) — **Remove or Revive** is a real fork in the road: it's dead code today, but architecturally sounder than what's live; that choice is explicitly a redesign decision, flagged here rather than resolved.

---

## 11. Mastery Progression

**What it does.** No single mechanism — four loosely coupled ones coexist: (1) the prompt-declared BE/AE/ME/EE band, computed from `subject_tiers` via `tierToLevel()`; (2) the AI's self-reported `genuine_progress` flag at session close, which increments/resets `sessions_without_improvement` and can trigger a `subject_rest_until` cooldown; (3) a rolling, capped `masteredConcepts` array in session state, explicitly commented as "legacy" in the source; (4) the orphaned `TopicChoice.tsx` milestone/progress-bar UI (see §10), which has no data producer at all.

**Why it was designed that way.** Each mechanism appears to have been added to solve an immediate need (show a level badge; decide whether to suggest a break; remember what's been covered) without a unifying mastery model tying them together.

**Fit with Evidence → Projection.** Weak. None of these four mechanisms is the Projection Engine's own mastery/capability model; they are Compass-local, and the one piece with a real trust-tier annotation (the AI self-report → Evidence, §7) still can't reach Projection today (§8).

**Findings / rot:** `subject_rest_until` is explicitly a single scalar per student (not per-subject), with an in-code comment acknowledging this is a known simplification "for forward-compatibility... once that column exists" — i.e., code written ahead of a migration that hasn't happened.

**Verdict: Modify/Consolidate — flagged, not resolved.** Four parallel, non-integrated mastery signals is the clearest example in this audit of accumulated local fixes without a single owning model.

---

## 12. Behaviour Signals

**What it does — two systems, one functioning.**

**(A) Legacy learner-model path (active, rich, sole functioning path today):** `updateFromCompass()` (`lib/learnerModel/updater.ts:154-202`), called on every session end, computes and writes to `learner_profiles`: `persistence` (from consecutive-wrong/abandonment), `confidence` (from right-vs-wrong ratio), `velocity` (concepts mastered per minute), `help_seeking` (self-initiated vs teacher-assigned), plus session-frequency/recency counters and a rolling "topics explored" list, and triggers a legacy risk-flag recompute.

**(B) New Evidence path (thin, effectively inert):** as described in §7, the Evidence record captures only subject + abandoned-flag — none of persistence/confidence/velocity/help-seeking is captured in the Evidence shape at all. Even if this evidence were promoted past `pending_review`, `behaviourProjector.ts` only computes `{observationCount, distinctSources}` from confirmed evidence — the richer signal has no path into the Projection type today even in principle.

**Why it was designed that way.** Path (A) predates the Evidence architecture and was never retired because, per the migration ledger, several real downstream consumers (Holiday Planner, Parent Pulse, Remedial Planner, Monday Panel, Prerequisite Readiness) still read `learner_profiles` directly and haven't migrated to Projection-based reads.

**Fit with Evidence → Projection.** Path (A) — legacy, fully outside the new architecture by design (temporarily, per the migration ledger). Path (B) — nominally "new architecture" but currently non-functional both because of the confirm-gap (§8) and because the Evidence shape itself doesn't carry the same signals as the legacy path — there's no like-for-like migration target yet even at the data-shape level.

**Verdict: Modify.** Path (A) is a Keep-for-now (real consumers depend on it, per the documented migration plan). Path (B) needs its Evidence shape enriched before it could ever functionally replace (A), independent of the §8 confirm-gap.

---

## 13. Teacher Interaction Points

**What exists:**
- **Per-class Compass tab** (`app/teacher/classes/[classId]/page.tsx`, tab logic + `app/api/teacher/classes/[classId]/compass/route.ts`): a read-only, lazily-fetched-once-per-page-load view showing, per roster student, tier/confidence badges, strengths/challenges, mastered/struggling concepts, and the latest AI-generated "parent insight" — all derived entirely from the JSON blob of each student's single latest `compass_sessions` row. There is no separate "Compass profile" table; the tab re-derives everything from session state each time it's queried. This route authorizes via the class roster (`class_students`/`teacher_classes`).
- **Compass Topic Picker** (`CompassTopicPicker` component in the same file, backed by `PATCH /api/teacher/students/[studentId]/compass-topic`): lets a teacher assign a weak-subject topic to a student, sourced from the orphaned-elsewhere `sow_*` strand tree via `getTopicsForSubject`. This route authorizes via `students.teacher_id === teacher.id` directly — a **different ownership check** than the class-tab route above.
- **Alerts page "Open Compass"** (`app/teacher/alerts/page.tsx:187-192`): a plain link to `/chat` with no student ID or query param at all — it does not deep-link to the alerted student's own session.

**Why it was designed that way.** The class tab and topic picker appear to have been built at different times against different available data models (class roster vs. direct teacher-student link), which is plausible if `class_students` was introduced after `students.teacher_id` was already load-bearing elsewhere.

**Fit with Evidence → Projection.** All of this reads from `compass_sessions.session_state` directly, not from any Projection — teachers currently see Compass-derived insight that bypasses the Evidence/Projection system entirely (consistent with §8's finding that nothing from Compass reaches Projection anyway).

**Verdict:** Compass tab — **Keep** (functional, real teacher value). Topic Picker — **Keep**, but its ownership check should be reconciled with the class-tab route's differing model (flagged, not resolved). Alerts "Open Compass" link — **Modify** (should deep-link to the specific student; today it's a generic navigation with no context transfer).

---

## 14. Learner Interaction Points

**What exists.** The student dashboard (`app/student/page.tsx`) is the primary real surface: a "Start Learning"/"Open Compass" card and a "Recent Compass Sessions" list, all pointing to `/learn`. Separately, teacher alerts and the parent-dashboard splash page (`app/dashboard/learning-compass/page.tsx`, a 1.5-second animated redirect) both point to `/chat` instead — **two different URLs are used inconsistently across the app for what is conceptually the same action**, with no evidence found in the reviewed files that they converge on the same underlying experience.

**Demo pages are not live.** `components/demo/pages/CompassPage.tsx` and `KcseCompassPage.tsx` are hardcoded, prop-free marketing mockups (fictional student names, fake report IDs), reachable only from the public marketing landing page's "see a sample report" modal — confirmed via import trace, not connected to any real student, session, or auth path.

**Why it was designed that way.** The `/learn` vs `/chat` split likely reflects two different historical builds of "the Compass chat surface" that were never fully reconciled — one reachable from the student's own dashboard, one linked from teacher/parent-facing surfaces.

**Fit with Evidence → Projection.** Neutral — this is a routing/UX consistency question, not an evidence-model question.

**Verdict: Modify.** The dual `/learn`/`/chat` entry points should be reconciled into one canonical URL (flagged as an open question, not resolved here — it's unclear from the code alone whether `/chat` is a superset, a subset, or a fully separate implementation of `/learn`'s functionality).

---

## 15. Dashboard Integration

**What it does.** `app/dashboard/page.tsx` is the **parent** dashboard. Its Compass section (`fetchCompassActivity` → `GET /api/parent/compass-activity`) shows a weekly session-count summary, named active students, and up to 6 recent session cards. The backing route explicitly supports both ownership models — a student with their own login (`user_id`) and a parent-only account (`parent_user_id`) — via an `.or()` query, with an in-code comment naming this "both scenarios." `app/dashboard/learning-compass/page.tsx` is not a data page at all — it's a branded, client-only splash that redirects to `/chat` after 1.5 seconds, performing no data fetching of its own.

**Why it was designed that way.** The parent-activity feed is a reasonable "keep parents informed" surface; the splash page reads as a transitional/branding touch rather than a functional necessity.

**Fit with Evidence → Projection.** The parent feed reads directly from `compass_sessions`, not from any Projection — again consistent with §8.

**Verdict:** Parent activity feed — **Keep** (functional, dual-ownership-aware, real value). Splash redirect page — **Modify/Remove candidate** (currently vestigial; whether it should exist depends on whether `/learn` vs `/chat` gets reconciled, per §14).

---

## 16. Data Dependencies

**`students` table** (`lib/database.types.ts:7970-8089`): has `user_id` (student's own login, nullable), `parent_user_id` (nullable), `teacher_id` (FK to `teachers.id`, nullable), `school` (a **free-text string**, not an FK), `added_by`. **There is no `school_id` column** — school linkage is only via `teacher_id → teachers.id`, and `teachers.school` is itself a plain string, not an FK to the `schools` table. So the "school-scoped" model used elsewhere in the platform (e.g. the reference-school fixture) is only loosely present in the `students` row itself.

**`class_students`** is the real roster join table (`class_id`, `student_id`, optional `parent_id`) — notably, a roster entry can reference a linked parent independently of whether `students.parent_user_id` itself is set. This is what the class-scoped Compass tab uses to enumerate students, **not** `students.teacher_id`.

**`compass_sessions.learner_id`** has **no declared foreign key** in the schema (unlike `students`, which does declare its FKs elsewhere) — it's a bare UUID, conventionally `students.id`, enforced only by application-code query patterns, not the database. This does mean sessions are correctly modeled per-student-row (not per-login-user), which is at least compatible in principle with the multi-student-per-class model.

**Fit with Evidence → Projection.** Not directly relevant to Projection, but highly relevant to any future redesign: two different ownership models (`students.teacher_id` direct link vs. `class_students` roster membership) are used by sibling Compass endpoints inconsistently (see §13 and §19).

**Verdict: Modify — this is a foundational data-model question, flagged for the redesign phase rather than resolved here.**

---

## 17. Legacy Dependencies

Consolidated list of everything found that is legacy, dead, duplicated, or mid-migration:

| Item | Location | Status |
|---|---|---|
| `learner_profiles` dual-write via `updateFromCompass()` | `lib/learnerModel/updater.ts:154` | Active, documented, intentional (migration ledger) |
| `tierToLevel()` triplicated | `session.ts:40-45`, `learn/route.ts:46-51`, `learn/student/route.ts:8-13` | Duplicated, not imported from one source |
| `consecutiveRight`/`consecutiveWrong` fields | `CompassSession` type, `session.ts` | Dead — never incremented, always round-tripped as 0 |
| `sessionState.currentSubject` fallback reference | `learn/route.ts:215` | Dead — field doesn't exist on the persisted type |
| `findRecentSessionsByStudent` schema mismatch | `lib/repositories/compass.repository.ts:318-337` | **Live bug** — queries nonexistent `student_id`/`topic` columns, called from `lib/parentPulse/builder.ts:39`, will throw |
| `isSessionExpired()` | `session.ts:206-208` | Exported, unused |
| `TopicSelector.tsx` / `TopicChoice.tsx` + `topicSelector.ts` | `components/compass/*`, `lib/compass/topicSelector.ts` | Orphaned — not imported by any live route |
| `LessonOutcome`/milestones shape | `TopicChoice.tsx` | No producer anywhere (`app/api/compass/outcome/generate/` is empty) |
| Duplicate curriculum-topic query paths | `lib/compass/topics.ts` (RPC) vs `lib/compass/topicSelector.ts` (`sow_*` tables) | Two paths into presumably the same underlying curriculum data |
| `/dashboard/compass` dead link target | `components/dashboard/learning-compass-ui.tsx:56` | Points to a route that doesn't exist (real page is `/dashboard/learning-compass`) |
| Hardcoded Kiswahili strand list in universal prompt | `lib/compass/prompt.ts:145-151` | Not data-driven from `lib/curriculum/` |
| Keyword-regex subject fallback | `session.ts:296-307` (`resolveSubject`) | Coarse legacy mechanism, defaults to mathematics |
| `subject_rest_until` single-scalar-per-student | `session.ts:114-116` | Explicitly acknowledged in-code as pre-migration |
| Demo Compass pages | `components/demo/pages/CompassPage.tsx`, `KcseCompassPage.tsx` | Not legacy — marketing-only, never live |

**Verdict:** Individually assessed above; as a set, this is a normal accumulation for a fast-moving feature, not evidence of a single systemic problem — but several items (the schema-mismatch bug, the orphaned curriculum-rigorous components) are directly relevant inputs to a redesign decision.

---

## 18. Projection Engine Usage (system-wide, beyond Compass)

The Projection Engine (`lib/projection/*`) is genuinely live and used by real, shipped features — but entirely **independent of the event/outbox mechanism it was seemingly built around**. `recomputeLearnerProjection(s)` (`lib/projection/recompute.ts`) is called directly by:
- `lib/school/intelligence.ts:76`
- `lib/learnerIntelligence/blueprint.ts:228`
- `lib/learnerIntelligence/careerIntelligence.ts:146`
- `lib/attentionFeed/panel.ts:101`

Each of these does a fresh, synchronous recompute from confirmed evidence at read-time — none of them read from a pre-computed/cached Projection populated by the event pipeline. The event-driven path (`evidence_projection_events` outbox → `processProjectionEvents()`) exists in code but has **zero production callers** — it's only exercised by integration tests. This means the Projection Engine today functions as an on-demand, synchronous computation library, not an event-driven background system, regardless of Compass.

`behaviourProjector.ts` is the one projector explicitly built to consume `compass_session`-tagged evidence, and — per §8 — it is dormant in production for every student today because no evidence of that source ever reaches a confirmed state.

**Verdict:** The Projection Engine itself is a real, working, adopted system for four major features. Compass's specific link into it (via `behaviourProjector`) is the one projector-source pairing in the whole system that is currently non-functional end-to-end.

---

## 19. Places Where Compass Still Assumes a Learner-First Architecture

This is the clearest cross-cutting theme in the audit. Three separate ownership/identity models coexist across Compass's own endpoints, used inconsistently:

1. **`students.user_id` / `students.parent_user_id` gating** — used by `app/api/parent/compass-activity/route.ts` and the default branch of `app/api/learn/student/route.ts`. A student added directly by a teacher, with **no personal login and no linked parent account**, will never appear in either query — no session data, no dashboard entry, no student list — even though that same student is fully visible and actionable in the teacher's own class roster.
2. **`students.teacher_id` direct-match gating** — used by the Compass Topic Picker's PATCH route (`compass-topic/route.ts:50`).
3. **`class_students` roster-membership gating** — used by the class-wide Compass tab route.

**The concrete break this produces:** a teacher can view a "Learning Compass — Per-Learner Suggestions" entry for a student and even assign that student a Compass topic (model 2/3), but if that student was never given a personal login and never had a parent invited/linked, the student can never actually open `/learn` or `/chat` to generate a session themselves (model 1 blocks it), and no parent dashboard will ever show Compass activity for them either. Compass topic-assignment and Compass session-generation are gated by two structurally different ownership checks that don't agree on who "owns" the student.

**Other supporting evidence:**
- `app/api/learn/student/route.ts` carries an explicit `TODO` acknowledging its multi-student "picker" fallback (keyed off `user_id`/`parent_user_id`) is considered the primary/default path, with an explicit `?studentId=` param treated as a not-yet-fully-adopted shortcut.
- The explicit-`studentId` branch of that same route performs **no ownership check at all** — a direct consequence of the identity model not being settled, not merely a stylistic inconsistency.
- Both `app/dashboard/clinic/page.tsx` and `learn/student/route.ts` independently reduce "is this student school-linked" down to a bare `hasTeacher: Boolean(teacher_id)` flag — treating teacher-linkage and personal-login as two separate booleans tracked in parallel, rather than a single unified identity/ownership model.
- No `school_id` scoping exists anywhere in the Compass code paths read; the reference-school fixture's canonical school→class→teacher→student hierarchy is not joined through by any Compass endpoint — every Compass route bottoms out at either the personal-login chain (`user_id`/`parent_user_id`) or the teacher chain (`teacher_id`/`class_students`), never both, and never through a school entity.

**Verdict:** This is the single most significant structural finding in the audit. Compass's authorization model was built assuming a student (or their parent) is the primary account-holder, with teacher access as a secondary/bolted-on capability — the inverse of the school-scoped, teacher-rostered model the rest of the platform (Core, reference-school fixture, class rosters) has since adopted. Every other finding in this report is comparatively cosmetic next to this one.

---

## Summary Table

| # | Area | Verdict |
|---|---|---|
| 1 | Session Lifecycle | Modify |
| 2 | API Routes | Modify (progress route: Keep) |
| 3 | Prompt Design | Modify |
| 4 | Conversation Flow | Modify |
| 5 | State Management | Modify |
| 6 | Session Persistence | Modify |
| 7 | Evidence Generation | Modify |
| 8 | Projection Integration | Modify (missing piece, not wrong design) |
| 9 | Adaptive Learning Logic | Out of scope for Compass; separate audit candidate |
| 10 | Subject Selection | Modify (live) / Remove-or-Revive (orphaned) |
| 11 | Mastery Progression | Modify/Consolidate |
| 12 | Behaviour Signals | Modify (legacy path: Keep-for-now) |
| 13 | Teacher Interaction Points | Keep (tab, picker) / Modify (alerts link) |
| 14 | Learner Interaction Points | Modify (reconcile /learn vs /chat) |
| 15 | Dashboard Integration | Keep (parent feed) / Modify-or-Remove (splash page) |
| 16 | Data Dependencies | Modify — foundational, flagged for redesign |
| 17 | Legacy Dependencies | See itemized table above |
| 18 | Projection Engine Usage | Keep (engine itself); Compass's link: Modify |
| 19 | Learner-First Assumptions | **Central finding — flagged for redesign, not resolved here** |

No solutions are proposed in this document. The redesign phase should treat §19 (identity/ownership model) and §8 (the missing Evidence-confirmation mechanism) as the two questions that most other decisions in this system depend on.
