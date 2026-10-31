# WhatsApp Integration — Staging Release Report

**Date:** 2026-10-31  
**Previous audit:** `whatsapp-production-readiness-2026-10-31.md`  
**Remediation:** `whatsapp-remediation-2026-10-31.md`

---

## 1. Final Release Recommendation

**GO FOR CONTROLLED STAGING TEST.**

D-02 is fixed and verified. All consent, idempotency, and safety fixes remain intact. The complete data chain — consent → notification → Meta message ID → notification log → delivery callback → correct record — is now connected for every template-based send pathway.

---

## 2. Initial Repository State

- **Branch:** `main`
- **HEAD:** `a9df2be` (Merge pull request #11)
- **Working tree:** Modified files from previous remediation (uncommitted). No conflicts with this work.
- **Baseline tests:** 1,814 passing, 0 failures

---

## 3. D-02 Root Cause

`logAttempt()` in `lib/whatsapp/sender.ts` accepted no `whatsappMessageId` parameter. Every template-based sender (`sendAssignmentMarkedWhatsApp`, `sendAlertCreatedWhatsApp`, `sendAcademyReflectionNudge`) called `logAttempt` after receiving a `WhatsAppResult` containing `messageId` from Meta, but discarded it. The `notification_log` rows were written with `whatsapp_message_id = NULL`.

Three additional pathways (`reportNotify.ts`, `parent-pulse/route.ts`, `holiday/notify.ts`) used direct `insertNotificationLog` / raw Supabase inserts without including the message ID at all, compounding the same gap.

The delivery-status webhook handler (`updateDeliveryStatus`) looks up `notification_log` rows by `whatsapp_message_id`. With every row NULL, every delivery callback was a no-op.

---

## 4. Files Changed

| File | Change |
|------|--------|
| `lib/whatsapp/sender.ts` | Added `whatsappMessageId?: string` to `logAttempt` params. Updated all 3 sender call sites to pass `result.messageId`. |
| `lib/whatsapp/reportNotify.ts` | Added `whatsapp_message_id: result.messageId ?? null` to `insertNotificationLog` call. |
| `app/api/cron/parent-pulse/route.ts` | Captured `sendWhatsApp` return value, passed `waResult.messageId ?? null` to raw insert. |
| `lib/holiday/notify.ts` | Captured `sendWhatsApp` return value, passed `waResult.messageId ?? null` to raw insert. |
| `lib/whatsapp/senderMessageId.test.ts` | **New file** — 5 regression tests for D-02. |
| `scripts/standard-tests.json` | Registered new test file. |

No other files modified. No changes to consent, opt-out, signature verification, idempotency, or migration logic.

---

## 5. Exact Implementation

### `logAttempt` (sender.ts)

```diff
 async function logAttempt(params: {
   userId:      string | null
   type:        string
   referenceId: string
   phoneNumber: string
   success:     boolean
   errorMessage?: string
+  whatsappMessageId?: string
 }): Promise<void> {
   await repos.notifications.insertNotificationLog({
     user_id:             params.userId,
     type:                params.type,
     reference_id:        params.referenceId,
     channel:             'whatsapp',
     phone_number:        params.phoneNumber,
+    whatsapp_message_id: params.whatsappMessageId ?? null,
     success:             params.success,
     error_message:       params.errorMessage ?? null,
   })
 }
```

Each caller adds `whatsappMessageId: result.messageId` on the success path. Failure paths (catch blocks) omit it — the field defaults to `null` via `?? null`, never fabricating an ID.

### Direct-insert pathways

`reportNotify.ts`, `parent-pulse/route.ts`, and `holiday/notify.ts` each capture the `WhatsAppResult` return value and pass `result.messageId ?? null` / `waResult.messageId ?? null` into their `notification_log` insert.

---

## 6. Regression Tests

| Test | Assertion |
|------|-----------|
| `sendAssignmentMarkedWhatsApp persists Meta message ID on success` | `whatsapp_message_id === 'wamid.ASSIGN_OK'` |
| `sendAlertCreatedWhatsApp persists Meta message ID on success` | `whatsapp_message_id === 'wamid.ALERT_OK'` |
| `sendAcademyReflectionNudge persists Meta message ID on success` | `whatsapp_message_id === 'wamid.ACADEMY_OK'` |
| `a failed send does not fabricate a message ID` | `whatsapp_message_id === null`, `success === false` |
| `a success with no messageId in response stores null, not undefined` | `whatsapp_message_id === null` (not `undefined`) |

Tests mock `sendWhatsAppTemplate` (no network) and `repos.notifications.insertNotificationLog` (captures params). The complete data path from Meta result → `logAttempt` → `insertNotificationLog` → stored `whatsapp_message_id` is verified.

---

## 7. Test Results

| Check | Result | Baseline |
|-------|--------|----------|
| `npm test` | **1,819 pass, 0 fail** | 1,814 |
| `npx tsc --noEmit` | Clean | Clean |
| `npx eslint` (changed files) | Clean | Clean |
| `npx next build` | Succeeds | Succeeds |

Delta: +5 tests (D-02 regression suite). No tests removed or weakened.

---

## 8. Migration Review (Reconfirmed)

Both migrations remain unchanged from the audit. With D-02 fixed:

- **Migration 1** (`20261031120000`): `meta_message_id` column + unique partial index on `whatsapp_inbound_log`. Additive, nullable, no conflicts. Safe.
- **Migration 2** (`20261031120001`): `delivery_status`, `delivery_status_at`, `provider_error_code` columns + index on `whatsapp_message_id` in `notification_log`. Additive, nullable. **The index is now meaningful** — `whatsapp_message_id` will be populated by all template senders post-D-02.

Both are safe for staging. Neither destroys data, locks tables beyond brief metadata operations, or conflicts with existing records.

---

## 9. Staging Deployment Prerequisites

| Prerequisite | Status |
|-------------|--------|
| Code deployed to staging | Pending |
| Migration 1 applied to staging DB | Pending |
| Migration 2 applied to staging DB | Pending |
| `WHATSAPP_PHONE_NUMBER_ID` configured (staging) | Requires operator |
| `WHATSAPP_ACCESS_TOKEN` configured (staging) | Requires operator |
| `WHATSAPP_APP_SECRET` configured (staging) | Requires operator |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` configured (staging) | Requires operator |
| Meta webhook URL pointed to staging | Requires operator |
| Meta delivery-status subscription active | Requires operator |
| Test phone number whitelisted | Requires operator |
| All 5 templates approved in Meta BM | Requires operator verification |

---

## 10. Staging Verification Matrix

| # | Scenario | Action | Expected | Pass criteria |
|---|----------|--------|----------|---------------|
| 1 | Template notification | Mark assignment for test student with opted-in parent | WhatsApp received, `notification_log.whatsapp_message_id` populated | Message ID is a valid `wamid.*` string |
| 2 | Message ID persistence | Query `notification_log` for the send | `whatsapp_message_id IS NOT NULL` | Field populated |
| 3 | Delivery callback | Wait for Meta `delivered` status | `notification_log.delivery_status = 'delivered'` | Status updated |
| 4 | Failed delivery | Send to invalid number | `delivery_status = 'failed'`, `provider_error_code` set | Both fields populated |
| 5 | Duplicate inbound | Replay same webhook payload (same `msg.id`) | Second request returns early, no duplicate observation | Single observation in learner model |
| 6 | Concurrent duplicates | Fire two identical webhooks simultaneously | At most one observation created | Unique index prevents double-insert |
| 7 | STOP keyword | Send "STOP" from test phone | `whatsapp_opt_ins.opted_out_at` set, both student flags false | DB records updated |
| 8 | Opt-out persistence | Query both tables after STOP | Consistent state across `whatsapp_opt_ins` and `students` | Both sources agree |
| 9 | Post-STOP outbound blocked | Trigger notification for opted-out student | No WhatsApp sent | No `notification_log` row with `channel='whatsapp'` |
| 10 | Shared family phone | Two students on one phone, send "1" | `{processed: false}`, no observation | Neither student gets an observation |
| 11 | Invalid signature | POST with wrong HMAC | 401 response | No inbound log row |
| 12 | Transport failure | Misconfigure access token, trigger send | `{success: false}`, error logged, no crash | `notification_log` row with `success=false` |

---

## 11. D-01 Risk Assessment

**Defect:** `updateDeliveryStatus` performs a SELECT then UPDATE. Two concurrent status callbacks for the same `whatsapp_message_id` could both pass the rank check and both UPDATE, with the final state determined by execution order.

**Why not fixed now:**
- PostgREST does not support arbitrary WHERE expressions (e.g., `WHERE delivery_status_rank < $1`) in UPDATE calls. A safe atomic fix would require a PostgreSQL RPC function, which adds migration complexity and a new dependency for a negligible pilot-scale risk.
- At pilot scale (~50 teachers, ~1000 conversations/month), concurrent delivery-status callbacks for the same message within the same request cycle are extraordinarily rare.
- The worst case is a `delivered` → `read` race landing on `delivered` instead of `read` — an observability imprecision, not a consent or data-integrity issue.

**Accepted risk conditions:**
- Revisit if message volume exceeds 10,000/month OR if delivery-status data is used for automated decisions (currently observability-only).
- At that scale, replace the read-then-write with an RPC: `SELECT update_delivery_status($message_id, $status, $timestamp, $error_code)` containing a single `UPDATE ... WHERE` with rank comparison.

---

## 12. Remaining Blockers

**None for staging.**

For production (after staging verification):
1. All staging tests (§10) must pass.
2. Meta configuration (§9) must be verified by authorized operator.
3. Production data inspection (per production-readiness audit §9) must be run.

---

## 13. Rollback Procedure

### Code rollback
Revert deployment. Old code writes `whatsapp_message_id = NULL` — the column remains, rows are valid, delivery-status tracking becomes inert again (same as before D-02 fix).

### Migration rollback
```sql
-- Reverse migration 2
DROP INDEX IF EXISTS idx_notification_log_whatsapp_msg_id;
ALTER TABLE notification_log
  DROP COLUMN IF EXISTS delivery_status,
  DROP COLUMN IF EXISTS delivery_status_at,
  DROP COLUMN IF EXISTS provider_error_code;

-- Reverse migration 1
DROP INDEX IF EXISTS idx_whatsapp_inbound_meta_message_id;
ALTER TABLE whatsapp_inbound_log
  DROP COLUMN IF EXISTS meta_message_id;
```

No data loss beyond the new observability columns themselves.

---

## Summary

| Item | Status |
|------|--------|
| D-02 fixed | Yes — all 6 outbound pathways now persist `whatsapp_message_id` |
| D-01 addressed | Accepted risk, documented, revisit criteria set |
| Tests | 1,819 pass (+5), 0 fail |
| TypeScript | Clean |
| ESLint | Clean |
| Build | Succeeds |
| Migrations | Reviewed safe, unchanged |
| Consent integrity | Unmodified, verified by prior audit |
| Unrelated changes | None |

**Decision: GO FOR CONTROLLED STAGING TEST.**

**Exact next action:** An authorized operator deploys to staging, applies both migrations, verifies Meta configuration, and runs the 12-scenario verification matrix with a test phone number.
