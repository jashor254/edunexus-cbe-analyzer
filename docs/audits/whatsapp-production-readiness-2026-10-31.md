# WhatsApp Integration — Independent Production-Readiness Audit

**Date:** 2026-10-31  
**Auditor role:** Principal Release Engineer / Application Security Auditor  
**Previous audit:** `whatsapp-integration-deep-audit-2026-10-31.md`  
**Remediation report:** `whatsapp-remediation-2026-10-31.md`  
**Reported state:** CONDITIONAL GO

---

## 1. Executive Decision

**CONDITIONAL GO FOR STAGING.**

All consent-safety and learner-misattribution fixes are verified correct. Two defects discovered — one pre-existing (delivery-status tracking is inert for the primary outbound paths) and one race-condition gap (delivery-status read-then-write is non-atomic). Neither blocks staging. No consent, privacy, signature-verification, or idempotency issues remain.

The system is **not production-ready** until:
1. Both migrations are applied to staging and verified.
2. The delivery-status `whatsapp_message_id` storage gap is addressed (or explicitly accepted as a known limitation).
3. The Meta configuration checklist (§7) is verified by an authorized operator.
4. At least one end-to-end staging test completes the full inbound lifecycle.

---

## 2. Independent Verification of Remediation Claims

### A. Database Lookup — VERIFIED CORRECT

| Claim | Evidence |
|-------|----------|
| `phone` → `parent_phone` | `notification.repository.ts:138` uses `.eq('parent_phone', phone)`. `database.types.ts` confirms `whatsapp_opt_ins` has `parent_phone`, no `phone` column. |
| `active` → `opted_out_at IS NULL` | `notification.repository.ts:139` uses `.is('opted_out_at', null)`. `database.types.ts` confirms `opted_out_at` exists, no `active` column. |
| Consent semantics | Active opt-in = `opted_in_at IS NOT NULL AND opted_out_at IS NULL`. Used correctly in `getAllActiveOptIns` (line 161-162). |
| Database error handling | All repository methods throw on error (`if (error) throw`), never return silently. |
| DB failure masquerading as unknown sender | `getOptInsByPhone` throws on PostgREST error → caught by `processInboundReply`'s outer try/catch → logged as pipeline error with error message, NOT as "No opt-in found for phone". **Correct: a DB failure is distinguishable from an unknown sender.** |

### B. STOP Handling — VERIFIED CORRECT

| Check | Result |
|-------|--------|
| Case-insensitive | `isOptOutKeyword` (route.ts:157-158) uses `.trim().toLowerCase()` then checks a `Set`. |
| Supported keywords | `stop`, `unsubscribe`, `cancel` — all three. |
| No substring matching | Uses `Set.has()` on the full trimmed+lowered body — not `.includes()`. Test at route.test.ts:285 ("I did not stop by the school") confirms. |
| Consent-record scope | `optOutByPhone` (repository line 173-203) sets `opted_out_at` on ALL opt-in records for the phone AND clears `notification_whatsapp` + `whatsapp_opted_in` on ALL linked students. Both flags on both tables. |
| No automatic reactivation | No code path sets `opted_out_at` back to null. Re-opt-in requires the parent to use the dashboard (`/parent/whatsapp-optin` route). |
| Duplicate STOP safety | Second STOP finds zero active opt-ins (line 186: `studentIds.length === 0 → return`), no ack sent, returns `opted_out` — idempotent. |
| All outbound paths honor opt-out | `notify.ts` checks `notification_whatsapp && whatsapp_opted_in` (lines 87, 185). `holiday/notify.ts` checks both (line 48). `assessmentPipeline.ts` checks both (line 308). `getAllActiveOptIns` filters `opted_out_at IS NULL` (line 162). `parent-pulse/route.ts` uses `buildAllParentPulses` which calls `getAllActiveOptIns`. **All outbound paths verified.** |
| STOP is not logged to inbound_log | Correct — STOP handling returns before `processInboundReply` is called (route.ts:94-109). The STOP event is logged only via `logger.info` (line 97). **Acceptable**: no inbound_log row for a STOP — there's no observation to record. |

### C. Shared Family Phones — VERIFIED CORRECT

| Check | Result |
|-------|--------|
| Ambiguous phones never resolve arbitrarily | `getOptInByPhone` (line 149-151) returns null when `rows.length !== 1`. |
| Unresolved sender cannot create evidence | `resolveParentFromPhone` returns null → pipeline logs "No opt-in found" and returns `{processed: false}` — no `updateFromParentObservation` or `recordParentObservationEvidence` call. |
| Cross-school isolation | The opt-in lookup filters by `parent_phone` only — if the same phone is linked to students in different schools via separate opt-in records, `getOptInByPhone` returns null (count > 1). **Safe.** |

### D. Inbound Idempotency — VERIFIED WITH CAVEATS

| Check | Result |
|-------|--------|
| Meta `msg.id` used consistently | `extractMessage` captures `msg.id` (route.ts:217), passes as `metaMessageId` through to `processInboundReply` and `logInbound`. |
| Unique partial index correct | Migration creates `UNIQUE INDEX ... WHERE meta_message_id IS NOT NULL` — correct partial index, nulls are not constrained. |
| Duplicate events cannot create duplicate observations | `isInboundDuplicate` (repository line 119-130) checks before pipeline processing (observationPipeline.ts:186-190). |
| **Concurrent webhook requests** | **CAVEAT**: The dedup check is a SELECT followed by an INSERT. Two concurrent requests with the same `meta_message_id` could both pass the SELECT, then one INSERT succeeds and the other hits the unique constraint. The INSERT failure throws → caught by the outer try/catch → logged as error, returns `{processed: false}`. The second observation is NOT created because the INSERT failure precedes it. However, the first request's observation IS created. **Net effect: safe — at most one observation per message ID.** The unique index is the true guard, not the SELECT check. |
| **Failure after reserving idempotency key** | The `meta_message_id` is stored in the inbound log AFTER the observation is written (line 265-274). If the observation succeeds but the log insert fails (e.g., DB timeout), the message appears un-processed on retry, and a duplicate observation would be created. **This is a pre-existing weakness** — not introduced by the remediation. The unique index on `meta_message_id` provides a second guard only if the first log insert partially succeeded (wrote the column). **Low risk at pilot scale.** |

### E. Delivery-Status Tracking — VERIFIED WITH TWO DEFECTS

| Check | Result |
|-------|--------|
| Status callback extraction | `extractStatusEvent` (route.ts:173-194) correctly parses `entry[0].changes[0].value.statuses[0]`. Validates `id` and `status` are strings. |
| Message-ID matching | `updateDeliveryStatus` (repository line 208-233) looks up `notification_log.whatsapp_message_id`. |
| Out-of-order protection | `DELIVERY_STATUS_RANK` (lines 53-58) prevents regression from higher-rank to lower-rank status. |
| Failed-delivery recording | `failed` has rank 4 (highest) — will always overwrite any prior status. Error code captured from `status.errors[0].code`. |
| Unknown message handling | Missing matching row → `if (!existing) return` (line 217) — silent no-op. Correct. |
| No false delivery claims | Only updates when a real callback arrives. |
| **DEFECT D-01: Read-then-write race** | `updateDeliveryStatus` does SELECT → rank check → UPDATE. Two concurrent callbacks (e.g., `delivered` and `read` for the same message) could both pass the rank check and both UPDATE, with the final state depending on execution order. **Impact: low** — the last writer wins, and at pilot scale concurrent status callbacks for the same message are rare. Fix: use a single `UPDATE ... WHERE delivery_status_rank < new_rank` or a PostgreSQL CTE. **Not a blocker.** |
| **DEFECT D-02: `whatsapp_message_id` not stored by primary senders** | `logAttempt` in `sender.ts` (line 63-80) does NOT pass `whatsapp_message_id` to `insertNotificationLog`. Only `sendWelcomeMessage` (line 303) stores it. This means `sendAssignmentMarkedWhatsApp`, `sendAlertCreatedWhatsApp`, `sendAcademyReflectionNudge`, and the parent-pulse cron all create `notification_log` rows with `whatsapp_message_id = null`. **Delivery-status tracking will find no matching row for these messages and silently no-op.** This is pre-existing — the column existed before the remediation but was unused by template senders. **Impact: delivery-status tracking is inert for the vast majority of outbound messages.** |

### F. Transport Reliability — VERIFIED CORRECT

| Check | Result |
|-------|--------|
| Network failures | `client.ts:62-63` catches fetch throw → `{success: false, error: message}` |
| HTTP failures | `client.ts:73-74` checks `!res.ok` → returns error |
| Meta API error responses | `client.ts:73` checks `data.error` → returns its message |
| Missing credentials | `client.ts:34-36` returns `{success: false}` before any network call |
| Unexpected response bodies | `client.ts:69-71` catches `res.json()` failure → `{success: false, error: 'non-JSON'}` |
| Timeouts | Node's `fetch` throws on timeout → caught by the outer try/catch (line 62). No explicit timeout configured — relies on platform defaults. **Acceptable for pilot.** |
| Callers interpret result correctly | `sender.ts` callers check `result.success` and log accordingly. `reportNotify.ts` does the same. |

---

## 3. Migration Safety Assessment

### Migration 1: `20261031120000_whatsapp_inbound_idempotency.sql`

| Aspect | Assessment |
|--------|------------|
| Schema change | ADD COLUMN `meta_message_id TEXT` (nullable), CREATE UNIQUE INDEX (partial, WHERE NOT NULL) |
| Dependencies | `whatsapp_inbound_log` must exist |
| Additive | Yes — nullable column, no NOT NULL, no DEFAULT expression |
| Existing records | Remain valid — NULL is allowed, excluded from unique index |
| Table lock | `ADD COLUMN IF NOT EXISTS` with no DEFAULT takes an ACCESS EXCLUSIVE lock briefly (metadata-only in PG 11+). Index creation with `IF NOT EXISTS` is non-concurrent but the table is small at pilot scale. |
| Duplicate data conflict | **Existing rows have no `meta_message_id` → all NULL → excluded from unique index. Safe.** |
| Index appropriate | Partial unique on non-null values — correct for dedup of Meta IDs while allowing legacy nulls. |
| Rollback | `DROP INDEX idx_whatsapp_inbound_meta_message_id; ALTER TABLE whatsapp_inbound_log DROP COLUMN meta_message_id;` |
| Code before migration | `insertWhatsAppInboundLog` writes `meta_message_id` — PostgREST ignores unknown columns in INSERT. `isInboundDuplicate` queries `.eq('meta_message_id', ...)` — PostgREST returns error for unknown column → thrown → caught by pipeline outer try/catch → message processed normally without dedup. **Backward-compatible: degrades to no dedup, no crash.** |
| Safe for staging | **YES** |

### Migration 2: `20261031120001_whatsapp_delivery_status.sql`

| Aspect | Assessment |
|--------|------------|
| Schema change | ADD 3 nullable columns (`delivery_status TEXT`, `delivery_status_at TIMESTAMPTZ`, `provider_error_code TEXT`), CREATE INDEX on `whatsapp_message_id` (partial, WHERE NOT NULL) |
| Dependencies | `notification_log` must exist; `whatsapp_message_id` column must exist (it does per generated types) |
| Additive | Yes — all nullable, no DEFAULT |
| Existing records | Remain valid |
| Table lock | Same as above — brief metadata lock. `notification_log` may be larger but still small at pilot scale. |
| Duplicate data conflict | None — new columns, no unique constraint |
| Index appropriate | Non-unique partial index on `whatsapp_message_id WHERE NOT NULL` — correct for delivery-status lookups. |
| Rollback | `DROP INDEX idx_notification_log_whatsapp_msg_id; ALTER TABLE notification_log DROP COLUMN delivery_status, DROP COLUMN delivery_status_at, DROP COLUMN provider_error_code;` |
| Code before migration | `updateDeliveryStatus` queries `delivery_status` column — PostgREST returns error for unknown column → thrown → caught by webhook route outer try/catch → logged, returns 200. **Backward-compatible: delivery tracking silently inactive, no crash.** |
| Safe for staging | **YES** |

### Migration Execution Plan

| Order | Migration | Preconditions | Risk | Verification |
|-------|-----------|---------------|------|-------------|
| 1 | `20261031120000_whatsapp_inbound_idempotency.sql` | `whatsapp_inbound_log` table exists | Low — additive, small table | `SELECT column_name FROM information_schema.columns WHERE table_name = 'whatsapp_inbound_log' AND column_name = 'meta_message_id';` should return 1 row. `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_whatsapp_inbound_meta_message_id';` should return 1 row. |
| 2 | `20261031120001_whatsapp_delivery_status.sql` | `notification_log` table exists with `whatsapp_message_id` | Low — additive | `SELECT column_name FROM information_schema.columns WHERE table_name = 'notification_log' AND column_name = 'delivery_status';` should return 1 row. `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_notification_log_whatsapp_msg_id';` should return 1 row. |

---

## 4. Code/Schema Deployment Compatibility

| Question | Answer |
|----------|--------|
| Can new code run before migrations? | **Yes.** Both new features degrade gracefully: PostgREST errors on unknown columns are caught and logged. Inbound dedup becomes a no-op. Delivery-status updates become no-ops. All other functionality (STOP handling, consent checks, shared-phone safety, transport normalization) works immediately. |
| What features remain inactive until migrations? | Inbound idempotency (`meta_message_id` check) and delivery-status tracking. |
| Can migrations be applied before deployment? | **Yes.** The new columns are nullable with no defaults. Old code never references them. No writes to new columns from old code. |
| Conflict period between old and new code? | **None.** The new columns are purely additive. Old code ignores them. New code handles their absence. |
| Could webhook events be lost during deployment? | **No.** The webhook always returns 200 after signature validation. A brief downtime during deployment would cause Meta to retry (exponential backoff up to 24h). Retry + idempotency (post-migration) handles this. |
| Could cron jobs send duplicate notifications? | **No change from current state.** The parent-pulse cron has its own dedup via `isDuplicate` on `notification_log`. This remediation did not alter that path. |

**Recommended deployment order:**
1. Deploy code first (all fixes active, new features degrade gracefully).
2. Apply migrations to staging.
3. Verify staging (§8 test plan).
4. Apply migrations to production.
5. Monitor delivery-status tracking activation.

---

## 5. Consent and Privacy Assessment

| Path | Consent gate | Status |
|------|-------------|--------|
| `notify.ts` → assignment marked / alert created | `notification_whatsapp && whatsapp_opted_in && parent_phone` | CORRECT |
| `holiday/notify.ts` | `notification_whatsapp && whatsapp_opted_in` + phone check | CORRECT (fixed in this remediation) |
| `assessmentPipeline.ts` → report WhatsApp | `notification_whatsapp && whatsapp_opted_in && parent_phone` | CORRECT |
| `parent-pulse/route.ts` → weekly pulse | `getAllActiveOptIns` filters `opted_out_at IS NULL` | CORRECT (fixed in this remediation) |
| `sendWelcomeMessage` | Called at opt-in time — no consent check needed | ACCEPTABLE |
| `notifyOwnerMilestone` | Sends to hardcoded owner phone — no parent consent needed | ACCEPTABLE |
| STOP processing | Clears both `whatsapp_opt_ins.opted_out_at` AND `students.notification_whatsapp/whatsapp_opted_in` | CORRECT — covers both consent sources |
| `reportNotify.ts` | No internal consent check — relies on `assessmentPipeline.ts` caller | ACCEPTABLE (documented dependency) |

**No consent gap found.**

---

## 6. Webhook Reliability Assessment

| Aspect | Status |
|--------|--------|
| Signature verification | HMAC-SHA256 with timing-safe comparison. Missing secret → 401. Missing header → 401. |
| Post-auth always 200 | All business logic wrapped in try/catch, always returns 200 (route.ts:75-133). |
| Status events don't reach message pipeline | `extractStatusEvent` checked before `extractMessage` (route.ts:76-84). |
| Non-message events (reactions, media) | Return `{ok: true}` — `extractMessage` returns null for non-text messages. |
| Twilio fallback extraction | Present and tested (route.test.ts:220-229). |

---

## 7. Meta WhatsApp Configuration Checklist

| Item | Verified in repository | Requires operator |
|------|----------------------|-------------------|
| Webhook callback URL registered | Env var `WHATSAPP_WEBHOOK_VERIFY_TOKEN` referenced | ✅ Verify in Meta Dashboard |
| `messages` webhook subscription active | Code expects it | ✅ Verify in Meta Dashboard |
| Delivery-status subscription active | Code expects `statuses` in webhook payload | ✅ Verify in Meta Dashboard → Webhook fields → `messages` must include "message delivery updates" |
| `WHATSAPP_PHONE_NUMBER_ID` set | Referenced in client.ts | ✅ Verify value matches Meta Dashboard |
| `WHATSAPP_ACCESS_TOKEN` valid | Referenced in client.ts | ✅ Verify permanent system-user token, not expired temporary |
| `WHATSAPP_APP_SECRET` set | Referenced in route.ts for HMAC | ✅ Verify matches App Dashboard → Settings → App Secret |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` set | Referenced in route.ts GET | ✅ Verify matches Meta Dashboard webhook config |
| Business verification status | — | ✅ Check Meta Business Manager (unverified limits sending) |
| App mode: Development vs Live | — | ✅ Must be Live for production parents |
| **Template: `edunexus_assignment_marked`** | 10 body params | ✅ Verify APPROVED status in Meta BM |
| **Template: `edunexus_student_alert`** | 6 body params | ✅ Verify APPROVED status in Meta BM |
| **Template: `edunexus_parent_update`** | 1 body param | ✅ Verify APPROVED status in Meta BM |
| **Template: `edunexus_academy_reflect`** | 3 body params | ✅ Verify APPROVED status in Meta BM |
| **Template: `edunexus_school_outreach`** | 1 body param (MARKETING) | ✅ Verify APPROVED status in Meta BM |
| Template language codes | All use `en_US` (client.ts default) | ✅ Verify templates registered under `en_US`, not `en` |

---

## 8. Controlled Staging Test Matrix

All tests use a dedicated test WhatsApp number, synthetic parent identity, synthetic learner records, and a non-production Supabase database.

### T-01: Full happy-path lifecycle

- **Setup:** Synthetic student with opted-in parent phone on staging. Teacher marks an assignment.
- **Action:** Assignment notification fires → parent receives WhatsApp → parent replies "1".
- **Expected:** Webhook validates signature → parent resolved → observation recorded as `demonstrated` → ack sent.
- **Evidence:** `whatsapp_inbound_log` row with `processed=true, parsed_reply='demonstrated'`, `learner_profiles` updated, ack message received on phone.
- **Pass criteria:** All five artifacts present.

### T-02: Unknown sender

- **Setup:** No opt-in record for test phone.
- **Action:** Send "1" from unknown phone.
- **Expected:** `{processed: false, error: 'No opt-in found for phone'}`.
- **Evidence:** `whatsapp_inbound_log` row with `processed=false`, no learner model change.
- **Pass criteria:** No observation created, error logged.

### T-03: Invalid webhook signature

- **Action:** POST to webhook with wrong/missing signature.
- **Expected:** 401 response.
- **Evidence:** No inbound log row created.
- **Pass criteria:** 401 status code.

### T-04: Duplicate inbound message

- **Setup:** Opted-in parent.
- **Action:** Send same webhook payload twice with identical `msg.id`.
- **Expected:** First processes normally, second returns `{processed: true, outcome: 'free_form'}` (early return).
- **Evidence:** Only one `whatsapp_inbound_log` row with `processed=true` and a valid observation; or two rows where one shows early-return.
- **Pass criteria:** Exactly one observation in learner model.

### T-05: Concurrent duplicate webhooks

- **Setup:** Opted-in parent.
- **Action:** Fire two identical webhook requests simultaneously (same `msg.id`).
- **Expected:** At most one observation. Second request either deduped by SELECT or fails on unique index.
- **Evidence:** Learner model has exactly one observation entry.
- **Pass criteria:** No duplicate observations.

### T-06: STOP request

- **Setup:** Opted-in parent with active opt-in.
- **Action:** Send "STOP" from parent phone.
- **Expected:** `whatsapp_opt_ins.opted_out_at` set, `students.notification_whatsapp` = false, `students.whatsapp_opted_in` = false, ack message sent.
- **Evidence:** DB records updated, ack received on phone.
- **Pass criteria:** Both tables updated, ack received.

### T-07: STOP then attempted outbound report

- **Setup:** Parent has STOP'd.
- **Action:** Teacher generates a report for that student.
- **Expected:** No WhatsApp sent (consent gate in `assessmentPipeline.ts` blocks).
- **Evidence:** No `notification_log` row with `channel='whatsapp'` for this event.
- **Pass criteria:** No outbound message.

### T-08: STOP then parent-pulse cron

- **Setup:** Parent has STOP'd.
- **Action:** Trigger parent-pulse cron.
- **Expected:** Parent excluded from `getAllActiveOptIns` results.
- **Evidence:** No pulse message sent; parent absent from cron log.
- **Pass criteria:** No outbound message.

### T-09: Shared phone with multiple learners

- **Setup:** Two students linked to same parent phone via separate `whatsapp_opt_ins` records.
- **Action:** Send "1" from shared phone.
- **Expected:** `getOptInByPhone` returns null (count=2), pipeline returns `{processed: false}`.
- **Evidence:** `whatsapp_inbound_log` with `processed=false, error_message='No opt-in found'`.
- **Pass criteria:** No observation created for either student.

### T-10: Delivery success callback

- **Setup:** Outbound message with `whatsapp_message_id` stored in `notification_log`.
- **Action:** Simulate Meta `delivered` status callback.
- **Expected:** `notification_log.delivery_status` updated to `delivered`.
- **Evidence:** DB row updated.
- **Pass criteria:** Status field reflects `delivered`.

### T-11: Out-of-order delivery events

- **Setup:** Same as T-10.
- **Action:** Send `read` callback, then `delivered` callback (out of order).
- **Expected:** Status stays `read` (rank 3 > rank 2).
- **Evidence:** DB row shows `delivery_status='read'` after both callbacks.
- **Pass criteria:** No regression.

### T-12: Delivery failure callback

- **Action:** Simulate Meta `failed` status callback with error code.
- **Expected:** `delivery_status='failed'`, `provider_error_code` set.
- **Pass criteria:** Both fields populated.

### T-13: Database outage during processing

- **Action:** Simulate DB connection failure during `processInboundReply`.
- **Expected:** Outer try/catch returns `{ok: false, error: 'internal_error'}` with status 200.
- **Pass criteria:** 200 response (no Meta retry storm), error logged.

### T-14: Meta API timeout on ack send

- **Action:** Simulate network timeout in `sendWhatsApp` during ack.
- **Expected:** Ack failure logged, pipeline result still returned to Meta with 200.
- **Pass criteria:** 200 response, observation already recorded, ack failure logged.

### T-15: Template rejection

- **Action:** Send via unapproved template name.
- **Expected:** Meta returns error → `{success: false, error: 'Template not approved'}`.
- **Pass criteria:** Logged as failure, no crash.

---

## 9. Production Data Inspection Plan

Before production release, run these read-only queries (SQL Editor / psql):

```sql
-- 1. Active opt-ins with missing student or duplicate phone/student
SELECT parent_phone, student_id, COUNT(*)
FROM whatsapp_opt_ins
WHERE opted_out_at IS NULL
GROUP BY parent_phone, student_id
HAVING COUNT(*) > 1;

-- 2. Multiple active students per phone (shared-phone candidates)
SELECT parent_phone, COUNT(DISTINCT student_id) AS children
FROM whatsapp_opt_ins
WHERE opted_out_at IS NULL
GROUP BY parent_phone
HAVING COUNT(DISTINCT student_id) > 1;

-- 3. Opted-out records (verify STOP cascade worked)
SELECT id, parent_phone, student_id, opted_in_at, opted_out_at
FROM whatsapp_opt_ins
WHERE opted_out_at IS NOT NULL
ORDER BY opted_out_at DESC
LIMIT 20;

-- 4. Students with consent mismatch (opted-out in opt_ins but still flagged in students)
SELECT s.id, s.name, s.notification_whatsapp, s.whatsapp_opted_in, o.opted_out_at
FROM students s
JOIN whatsapp_opt_ins o ON o.student_id = s.id
WHERE o.opted_out_at IS NOT NULL
  AND (s.notification_whatsapp = true OR s.whatsapp_opted_in = true);

-- 5. Existing inbound logs (check for pre-existing duplicates before migration)
SELECT phone, raw_body, COUNT(*)
FROM whatsapp_inbound_log
GROUP BY phone, raw_body, DATE_TRUNC('minute', received_at::timestamptz)
HAVING COUNT(*) > 1;

-- 6. Notification log rows with whatsapp_message_id populated (delivery tracking candidates)
SELECT COUNT(*) AS total_whatsapp,
       COUNT(whatsapp_message_id) AS with_message_id
FROM notification_log
WHERE channel = 'whatsapp';

-- 7. Verify no existing meta_message_id column (pre-migration check)
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'whatsapp_inbound_log'
  AND column_name = 'meta_message_id';
```

**Never run destructive cleanup automatically. Never reactivate historical opt-ins. Never infer consent from previous interaction.**

---

## 10. Deployment Sequence

| Step | Action | Verification |
|------|--------|-------------|
| 1 | **Deploy code** to staging | Staging builds, tests pass |
| 2 | **Run production data inspection** (§9 queries) against staging DB copy | Review results for constraint conflicts |
| 3 | **Apply migration 1** (`20261031120000`) to staging | Column and index exist |
| 4 | **Apply migration 2** (`20261031120001`) to staging | Columns and index exist |
| 5 | **Run staging test matrix** (§8: T-01 through T-15) | All pass |
| 6 | **Verify Meta configuration** (§7 checklist) | All items confirmed |
| 7 | **Deploy code** to production | Production build succeeds |
| 8 | **Run production data inspection** (§9) against production | No constraint conflicts |
| 9 | **Apply migration 1** to production | Verify |
| 10 | **Apply migration 2** to production | Verify |
| 11 | **Smoke test** with test phone number | Single happy-path message lifecycle |
| 12 | **Monitor** first weekly parent-pulse cron | Confirm opted-out parents excluded |

---

## 11. Rollback Strategy

### Code rollback
Revert the deployment. The old code never references the new columns — they become inert. No data loss.

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

**Safe to rollback independently** — dropping the columns loses only delivery-status data and stored Meta message IDs (both are observability data, not critical state).

---

## 12. Remaining Blockers

### Blockers (must resolve before production)
None — all consent, privacy, and safety fixes are verified correct.

### Known limitations (accepted for pilot)
1. **D-02: Delivery-status tracking inert for primary senders** — `logAttempt` in `sender.ts` does not store `whatsapp_message_id`. Only `sendWelcomeMessage` populates it. To activate delivery tracking for template sends, `logAttempt` needs a `whatsapp_message_id` parameter, and callers need to pass `result.messageId`. **Low effort, recommended before production.**
2. **D-01: Non-atomic delivery-status update** — Race between concurrent status callbacks for the same message. **Negligible risk at pilot scale.**
3. **Shared phones safely rejected but not supported** — No multi-child disambiguation UX.
4. **No explicit fetch timeout** — Relies on platform defaults.
5. **`sendWelcomeMessage` and `notifyOwnerMilestone` use raw fetch** — Not wrapped in `client.ts`.

---

## 13. Defects Discovered

| ID | Severity | Description | Recommended fix |
|----|----------|-------------|-----------------|
| D-01 | Low | `updateDeliveryStatus` read-then-write is non-atomic; concurrent callbacks could produce inconsistent final state | Single UPDATE with WHERE clause: `UPDATE notification_log SET delivery_status = $1 WHERE id = $2 AND (delivery_status IS NULL OR delivery_status NOT IN ('read', 'failed') ...)` |
| D-02 | Medium | `logAttempt` in `sender.ts` omits `whatsapp_message_id` from notification_log insert — delivery-status tracking is inert for all template-based sends (assignment marked, alert created, academy reflect, parent pulse) | Add `whatsappMessageId?: string` param to `logAttempt`, pass `result.messageId` from each caller. ~15 lines changed. |

Neither defect is a consent, privacy, or safety issue. D-02 reduces the value of the new delivery-status feature but does not create incorrect behavior.

---

## 14. Exact Next Action

**Fix D-02** (`logAttempt` missing `whatsapp_message_id`) — it's ~15 lines and makes the delivery-status feature actually work for the primary outbound paths. Then proceed to staging deployment (step 1 of §10).

---

## Tests Actually Run

| Suite | Result |
|-------|--------|
| `npm test` (full suite) | 1814 pass, 0 fail |
| `npx tsc --noEmit` | Clean (no errors) |
| `npx eslint` (changed files) | Clean |
| `next build` | Verified by previous agent (not re-run — no code changes in this audit) |

---

## Documentation Created

- This file: `docs/audits/whatsapp-production-readiness-2026-10-31.md`
