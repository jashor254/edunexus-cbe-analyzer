# Legacy Data Recovery Plan

**Status**: Plan only. Sprint C0 Task 3. **No production data has been modified by this document or in producing it** — every number below was obtained by read-only `SELECT` queries against the live database, re-verified during this pass. This is explicitly a separate migration program from Sprint C0's Tasks 1–2, per the mission's own instruction, and requires its own approval before any step below executes.

**Scope**: the two live data defects confirmed at the individual-row level by [Release Gate 1](release-gate-1-pilot-readiness-certification.md) and originally sized by [Sprint 13](sprint13-pilot-readiness-validation.md):

1. **579 of 580** `learner_guardians` rows have `user_id IS NULL` and have never had an invite fired to them (`core_guardian_invites` has 1 row, from a test claim, not a real admission).
2. **15 learners** have inconsistent enrollment state from promotions/graduations that ran before Sprint 12's fix: 14 `graduated` rows still show an active enrollment in the old class; 1 `promoted` row has `to_class_id IS NULL` with a stale active enrollment.

---

## 1. Recovery Strategy

### 1a. Guardian invite backfill

**Mechanism**: `createGuardianInvite()` (`lib/core/guardianInvites.ts`) is already the correct, idempotent function — it is what fires automatically for every *new* admission going forward. The backfill is simply: call it once for every existing `learner_guardians` row with `user_id IS NULL` that has no already-pending invite.

**Why this is safe to describe as low-risk**: the function is already proven — it is the exact code path exercised on every admission since its Sprint 12 deployment, and this plan does not propose writing a new one. The backfill's only job is to call an existing, tested function 579 times instead of relying on it firing at admission-time (which, for these rows, already happened in the past, before the function existed).

**What the backfill does NOT do**: it does not create, guess, or infer a `user_id`. It only creates an invite record + fires the WhatsApp/notification channel already used for new admissions. The actual linking (`user_id` getting set) only happens when the real guardian claims it — this backfill cannot itself "fix" the 579 rows, it can only give each one the chance to be fixed by its own guardian.

**Batching**: process in batches of 50, not all 579 at once — bounds the blast radius of any single run, makes a partial failure easy to reason about (which batch, which rows), and avoids a WhatsApp-sending burst that could look like spam to the messaging provider.

### 1b. Promotion/enrollment repair

**Mechanism**: this is NOT the same shape of problem as 1a — it cannot be safely scripted, because the correct destination for each of the 15 learners requires a human decision, not a formula:

- For the 14 `graduated` rows with a dangling active enrollment: the fix is `withdrawActiveEnrollments(learnerId, 'withdrawn')` — the exact function `runAnnualPromotion` already calls for every new graduation. This part IS mechanical and safe to script, because "graduated" already unambiguously means "no longer enrolled anywhere" — there is no destination to guess.
- For the 1 `promoted` row with `to_class_id IS NULL`: this is NOT mechanical. The learner has no recorded destination class at all. A script cannot know whether that learner was actually meant to move to a specific class (data entry never completed) or whether the promotion itself was a mistake that should be reversed instead. **This one row requires a human — most likely the school's admin at the time, or whoever ran that promotion cycle — to state the correct destination class before anything is written.**

**Sequencing**: the 14 mechanical graduated-row withdrawals should run first and separately from the 1 promoted-row repair, precisely because they have different risk profiles and different approval requirements (see §5).

### 1c. What this plan explicitly does not attempt

- Does not retroactively determine why the `promoted` row has no destination (root-cause archaeology is out of scope; the Sprint 12 investigation already identified the code-level cause — a UI that didn't collect a destination before the fix).
- Does not touch any `learner_promotions` row's own data — only `learner_enrollments` and `learners.status` are corrected. The promotion audit trail itself is left exactly as it was recorded, since editing history would violate this codebase's own evidence-immutability posture (CLAUDE.md).
- Does not attempt to re-invite the same guardian twice — the backfill script must check `core_guardian_invites` for an existing unexpired, unused invite for that `learner_guardian_id` before creating a new one (matches `createGuardianInvite()`'s own existing idempotency, so this is enforcement of an existing guarantee, not new logic).

---

## 2. Risk Assessment

| Risk | Likelihood | Impact | Notes |
|---|---|---|---|
| Guardian backfill sends a WhatsApp message to a wrong/disconnected number | Medium (this is genuinely old data; phone numbers may be stale) | Low — a failed/misdirected message is a wasted send, not a data-integrity issue | Mitigate by logging every send attempt and its result; do not retry a failed send automatically within the same run |
| Guardian backfill floods the WhatsApp provider or trips a rate limit | Low, if batched (§1a) | Medium — could suspend the sending account temporarily | Batch size and inter-batch delay must respect the provider's documented rate limit, not just an arbitrary number |
| Withdrawing the 14 graduated learners' stale enrollments has a downstream side effect (e.g. a report card or gradebook view still reads "active" and now reads "withdrawn" mid-review) | Low | Low — graduated learners are not being actively taught; a status correction reflecting reality is the intended outcome, not a side effect to avoid | Confirm no currently-open UI session depends on that stale "active" read before running (see §3) |
| The 1 promoted-row repair gets a wrong destination class from a human who's misremembering | Low-medium (asking a person to recall a decision from days/weeks ago) | Medium — a real learner ends up in the wrong class | This is exactly why §5 requires an explicit human sign-off naming the destination, with the option to instead reverse the promotion if no one can confirm the correct answer |
| A backfill run is interrupted partway (network failure, process killed) | Medium | Low, if idempotent | Both scripts must be safely re-runnable — re-running should skip already-fixed rows, not error or double-apply (see §3, §4) |

---

## 3. Verification Workflow

Every step below is a check to run **before** claiming a batch complete, not just before starting.

**Before running anything**:
1. Re-run the exact counting queries from Release Gate 1 (`SELECT count(*) FROM learner_guardians WHERE user_id IS NULL`; the 15-row promotion query) to confirm the numbers haven't changed since this plan was written — if they have, stop and find out why before proceeding.
2. Confirm no other in-flight work touches `learner_guardians`, `core_guardian_invites`, `learner_enrollments`, or `learner_promotions` this week (check with whoever owns Sprint C0 Task 1/2 — the promotion uniqueness constraint from Task 1 is directly relevant here and should already be live before this program runs, so the mechanical graduated-row repair itself is protected by it).

**After each guardian-invite batch**:
- Query `core_guardian_invites` for the batch's `learner_guardian_id` set — every one must have exactly one row.
- Spot-check 3–5 real WhatsApp delivery confirmations (or provider-side delivery receipts) from that batch before running the next one.

**After the mechanical graduated-row repair**:
- Re-run: `SELECT count(*) FROM learner_promotions lp WHERE lp.promotion_type = 'graduated' AND EXISTS (SELECT 1 FROM learner_enrollments le WHERE le.learner_id = lp.learner_id AND le.status = 'active')` — must return 0.
- Confirm `learners.status = 'graduated'` was already correctly set for all 14 (it was, per the original finding — this repair only touches `learner_enrollments`, so this is a non-regression check, not a new fix).

**After the 1 promoted-row repair**:
- Confirm exactly one new active `learner_enrollments` row exists for that learner in the human-confirmed destination class, and the old stale one is withdrawn.
- Confirm `learner_promotions.to_class_id` for that row is updated to match (the only case in this whole plan where a `learner_promotions` row's own data changes — because it currently records a plain data-entry omission, not a past state that needs preserving as history).

**Final acceptance check for the whole program**: re-run every Release Gate 1 query one more time and confirm both headline numbers (579, 15) are now 0 — this is the same evidence bar Release Gate 1 itself used, applied to its own resolution.

---

## 4. Rollback Plan

**Guardian invite backfill**: fully reversible with zero data-loss risk — `DELETE FROM core_guardian_invites WHERE created_at >= <batch start time> AND used_at IS NULL` removes only the newly-created, not-yet-claimed invites from that run. Any invite a guardian has already claimed (`used_at` set, `learner_guardians.user_id` now populated) should NOT be rolled back — that would revoke a real parent's access that is now correctly working, which is a worse outcome than leaving the backfill's effect in place.

**Mechanical graduated-row enrollment repair**: reversible by re-setting the specific `learner_enrollments.status` rows this program changed back to `'active'` — but this rollback should essentially never be needed, since "graduated learners have no active enrollment" is the correct target state, not a risky change, so treat rollback here as a formality rather than an expected path.

**Promoted-row repair (the 1 human-confirmed row)**: reversible by reverting the specific enrollment and `learner_promotions.to_class_id` changes for that one learner — trivial given it's a single row, but this is exactly the row where getting it right the first time (via the human checkpoint in §5) matters more than rollback speed.

**General rule for this whole program**: every script must log the specific row IDs it touched and the before/after values, not just a count — so any rollback is "undo exactly these logged changes," never "guess what changed."

---

## 5. Human Review Checkpoints

1. **Before any run**: someone (not this process) explicitly approves running the guardian-invite backfill and separately approves running the mechanical graduated-row repair — these can be approved together since both are mechanical and low-risk.
2. **Before the 1 promoted-row repair specifically**: a named human must state the correct destination class for that learner, or explicitly decide to reverse the promotion instead (mark it as an error, restore the learner to their prior class) if no one can confirm the intended destination. **This step cannot be automated or skipped** — it is the one place in this whole plan where the correct answer is not derivable from any existing data.
3. **After the full program completes**: a human reviews the final acceptance check (§3) and signs off that both Release Gate 1 headline numbers are confirmed at 0 before this recovery is considered closed.

---

## 6. Estimated Execution Order

1. Confirm Sprint C0 Task 1 (the `learner_promotions` uniqueness constraint) is live — it already is, applied and verified during this same session.
2. Pre-run verification (§3, "before running anything").
3. Guardian-invite backfill, in batches of 50, with post-batch verification between each batch (~12 batches for 579 rows).
4. Mechanical graduated-row enrollment repair (14 rows) — a single batch, since these are strictly independent of each other and of the guardian backfill.
5. Human checkpoint for the 1 promoted-row repair (§5, item 2) — this step blocks on a person, not on any technical dependency, and can happen in parallel with steps 3–4 rather than after them.
6. Promoted-row repair, once the human checkpoint resolves.
7. Final acceptance check (§3) and sign-off (§5, item 3).

Steps 3 and 4 have no dependency on each other and can run in either order or concurrently; step 5 should be started as early as possible since it is the slowest step (waiting on a person, not a machine) and should not become the critical-path bottleneck at the end.
