# WhatsApp Integration Remediation Report — 2026-10-31

## Executive Summary

All findings from the [deep audit](whatsapp-integration-deep-audit-2026-10-31.md) have been
addressed. The WhatsApp integration is now **CONDITIONAL GO** for pilot use —
conditional on the two new migrations being applied to production before the
first live parent-pulse cycle.

**Verification results (local):**
- `tsc --noEmit` — clean
- `eslint` — clean
- `npm test` — 1814 pass, 0 fail
- `next build` — succeeds

---

## Findings Addressed

### Priority 1 — Consent Safety (P0)

| ID | Finding | Fix | File(s) |
|----|---------|-----|---------|
| WA-001 | `getOptInByPhone` queried nonexistent `active` column → PostgREST error → every inbound rejected | Changed to `.is('opted_out_at', null)` | `lib/repositories/notification.repository.ts` |
| WA-002 | Same query used `phone` instead of `parent_phone` | Changed to `.eq('parent_phone', phone)` | `lib/repositories/notification.repository.ts` |
| WA-010 | `getAllActiveOptIns` (weekly pulse cron) returned opted-out parents | Added `.is('opted_out_at', null)` filter | `lib/repositories/notification.repository.ts` |
| WA-003 | STOP keyword not handled — templates say "Reply STOP" but code ignored it | Added `isOptOutKeyword()` + `optOutByPhone()` — sets `opted_out_at` on all opt-in records for the phone, clears `notification_whatsapp` and `whatsapp_opted_in` on linked students, sends confirmation ack | `app/api/webhooks/whatsapp/route.ts`, `lib/repositories/notification.repository.ts` |
| — | `lib/holiday/notify.ts` checked phone existence but not consent columns | Added `notification_whatsapp` + `whatsapp_opted_in` to query and guard | `lib/holiday/notify.ts` |

### Priority 2 — Restore Inbound Processing

| ID | Finding | Fix | File(s) |
|----|---------|-----|---------|
| WA-009 | Shared family phones → arbitrary child selection | `getOptInByPhone` returns `null` for 0 or >1 matches; new `getOptInsByPhone` returns all | `lib/repositories/notification.repository.ts` |

### Priority 3 — Idempotency

| ID | Finding | Fix | File(s) |
|----|---------|-----|---------|
| WA-005 | No inbound dedup — Meta retries create duplicate observations | Extract `msg.id` as `metaMessageId`, check `isInboundDuplicate()` before pipeline, store in `whatsapp_inbound_log.meta_message_id` (unique partial index) | `app/api/webhooks/whatsapp/route.ts`, `lib/parentPulse/observationPipeline.ts`, `lib/repositories/notification.repository.ts` |

**Migration required:** `supabase/migrations/20261031120000_whatsapp_inbound_idempotency.sql`

### Priority 4 — Observability

| ID | Finding | Fix | File(s) |
|----|---------|-----|---------|
| WA-004 | No delivery-status tracking — only know "Meta accepted the API call" | Parse Meta status callbacks (`sent`/`delivered`/`read`/`failed`) via `extractStatusEvent()`, store in `notification_log.delivery_status` with out-of-order protection | `app/api/webhooks/whatsapp/route.ts`, `lib/repositories/notification.repository.ts` |

**Migration required:** `supabase/migrations/20261031120001_whatsapp_delivery_status.sql`

### Priority 5 — Outbound Reliability & Documentation

| ID | Finding | Fix | File(s) |
|----|---------|-----|---------|
| WA-006 | `sendWhatsAppTemplate` fetch errors propagated as unhandled exceptions | Wrapped `fetch()` + `res.json()` in try/catch — all callers now get consistent `{success: false, error}` | `lib/whatsapp/client.ts` |
| WA-007 | `edunexus_parent_update` and `edunexus_academy_reflect` templates undocumented | Added Template 4 + Template 5 sections to `docs/whatsapp-setup.md` | `docs/whatsapp-setup.md` |

---

## New Test Coverage

| Test file | New tests | Covers |
|-----------|-----------|--------|
| `app/api/webhooks/whatsapp/route.test.ts` | +4 | STOP handling (exact match + case-insensitive + no-substring), delivery-status callback routing, Meta message ID passthrough |
| `lib/whatsapp/client.test.ts` | +1 new, 1 updated | Network error → `{success: false}` (was `rejects`); non-JSON response body |

---

## Migrations — NOT APPLIED

Two migrations are staged but **not applied** to any database:

1. **`20261031120000_whatsapp_inbound_idempotency.sql`** — Adds `meta_message_id TEXT` column + unique partial index to `whatsapp_inbound_log`
2. **`20261031120001_whatsapp_delivery_status.sql`** — Adds `delivery_status`, `delivery_status_at`, `provider_error_code` columns + index on `whatsapp_message_id` to `notification_log`

### Operator migration instructions

Both are additive (new nullable columns + new indexes). They can be applied in order during a maintenance window:

```bash
# Against the production Supabase project (from a machine with direct DB access):
supabase db push --linked
# Or manually via psql / Supabase SQL Editor — paste each file in order.
```

**The code is backward-compatible without the migrations** — the idempotency check gracefully handles a missing column (PostgREST error → caught → skip dedup, log normally), and the delivery-status update silently fails (no matching `whatsapp_message_id` → no-op). However, the features only **work** once the migrations are applied.

---

## Production Verification Checklist

After migration + deploy:

- [ ] Send a test template message → confirm `notification_log` row has `whatsapp_message_id`
- [ ] Wait for delivery callback → confirm `delivery_status` updated to `delivered` or `read`
- [ ] Send "STOP" from a test phone → confirm `whatsapp_opt_ins.opted_out_at` set, `students.notification_whatsapp` = false
- [ ] Send "1" from the same phone after STOP → confirm pipeline logs `No opt-in found for phone`
- [ ] Re-opt-in via dashboard → send "1" → confirm pipeline processes normally
- [ ] Send duplicate webhook (same `msg.id`) → confirm second one returns early (check `whatsapp_inbound_log` has only 1 row for that `meta_message_id`)
- [ ] Check weekly pulse cron → confirm no opted-out parents receive messages
- [ ] Shared phone scenario: two students linked to one phone → confirm inbound returns `{processed: false, error: 'No opt-in found for phone'}` (safe ambiguity handling)

---

## GO / NO-GO Decision

**CONDITIONAL GO.**

- All P0 consent violations are fixed.
- STOP handling works end-to-end.
- Inbound processing will resume once WA-001/WA-002 column fixes reach production.
- Idempotency and delivery-status tracking require their migrations.
- Transport errors are now caught consistently.
- Template inventory is fully documented.

**Conditions for full GO:**
1. Apply both migrations to production
2. Deploy the code changes
3. Run the production verification checklist above
4. Confirm at least one real delivery-status callback is recorded

**Remaining known limitations (acceptable for pilot):**
- Shared family phones are safely rejected but not actively supported (no multi-child disambiguation UX)
- No automated retry on 429 rate-limit — acceptable at pilot scale (<<1000 conversations/month)
- Welcome message (`sendWelcomeMessage`) and milestone alert (`notifyOwnerMilestone`) use raw fetch without the `client.ts` wrapper — lower priority since they target individual opt-in events and the owner respectively, not the bulk parent pipeline
