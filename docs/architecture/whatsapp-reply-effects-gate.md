# WhatsApp parent-reply effects gate

**Status:** implemented on `feat/whatsapp-reply-effects-gate` (commit `00cfc90`); not merged, not deployed.
**Switch:** `WHATSAPP_PARENT_REPLY_EFFECTS`
**Code:** `lib/config/whatsappReplyEffects.ts`, `processInboundReply` in `lib/parentPulse/observationPipeline.ts`
**Tests:** `lib/parentPulse/observationPipeline.gate.test.ts`, gate cases in `app/api/webhooks/whatsapp/route.test.ts`

## Purpose

A parent's WhatsApp reply to the weekly pulse can change learner state. Until the way a reply is tied to the question it answers, interpreted, and de-duplicated has been verified end to end, an inbound reply must not be able to alter a learner's record. The gate is a single, reversible, fail-closed switch that holds all of those effects while leaving the safety functions of the webhook running.

## Behaviour

### Default OFF, exact activation value
Reply effects are **off unless `WHATSAPP_PARENT_REPLY_EFFECTS` is exactly the string `enabled`**. The comparison is exact and case-sensitive. These all mean OFF: unset, empty, `true`, `1`, `on`, `yes`, `ENABLED`, `Enabled`, `enabled ` / ` enabled` (padding), `enabled\n`, `enable`, `disabled`. A malformed or misspelled value therefore fails closed. The variable is read on each inbound message, so a configuration change takes effect with the next deployment of that configuration.

### What is preserved regardless of the switch
- **Webhook signature verification.** The raw body is verified (HMAC-SHA256, constant-time comparison) before anything else; a missing secret or bad signature is rejected with 401. The gate sits behind this check, never in front of it.
- **STOP handling.** Exact keywords (`stop`, `unsubscribe`, `cancel`, case-insensitive, whole message) are handled in the route before the reply pipeline is reached, opt the number out, and send the unsubscribe confirmation. A STOP never reaches the pipeline, so the switch cannot affect it.
- **Delivery-status callbacks** are unaffected.

### What is blocked while OFF
`processInboundReply` returns immediately, before any other work. While OFF there is:
- no parsing of the reply;
- no phone-to-learner (opt-in) lookup;
- no read or write of the legacy learner profile (parent observations, knowledge state, risk flags);
- no parent evidence written to the Evidence Domain;
- no teacher alert;
- no `parent.observation.submitted` event (and therefore no downstream projection trigger);
- no educational acknowledgement to the parent — the function returns no outcome, so the route has nothing to acknowledge.

The webhook still answers 200 to the provider, as it does for every authenticated message.

### Metadata retained while OFF
One best-effort row in `whatsapp_inbound_log` containing only: the sender's phone number, the provider message id, the receipt time, `parsed_reply = 'free_form'` (the only value that satisfies the table's check constraint without classifying anything), `processed = false`, and the fixed reason `parent_reply_effects_disabled`. No learner or parent id is recorded, so nothing is attributed. `raw_body` is `NOT NULL` in the schema, so it holds the fixed marker `[withheld: parent reply effects disabled]`.

### Discarded content cannot be reconstructed
The parent's message text is **not stored anywhere** while the gate is OFF — not in the log row, not in application logs. A message received while OFF cannot be replayed or recovered from this system later; the parent would have to send it again. This is deliberate (data minimisation) and is the cost of holding the effects.

### Silent logging failure when the schema is missing
The metadata write is best-effort and never changes the webhook response. If `whatsapp_inbound_log.meta_message_id` does not exist (migration `20261031120000_whatsapp_inbound_idempotency.sql` not applied), the insert fails; the error is swallowed with a `warn`-level structured log and **no inbound record is kept at all**. Nothing educational happens in either case, so this is fail-closed, but while it persists a held reply cannot even be reconciled by phone number and message id. Applying the migration restores the metadata trail. Monitor for the warning `[observationPipeline] disabled-reply metadata not recorded`.

## Activation prerequisites

Setting the variable to `enabled` is an explicit, recorded authorization decision. It must not be done until each of the following has been implemented **and** verified with tests against an isolated database:

| Ref | Requirement |
|---|---|
| WA-01 | A reply is bound to the specific outbound activity it answers (learner, recipient, subject, topic, week, validity period). An unresolved context stays unclassified and changes nothing. |
| WA-02 | Reply interpretation does not reverse or invent meaning (negation, mixed language, unrelated text). Ambiguous replies are preserved for review rather than classified. |
| WA-03 | Inbound handling is idempotent: durable claim of the inbound message before any effect, atomic state transitions, retryable partial failures, distinct messages preserved. |
| WA-07 | Consent and recipient linkage are consistent: opt-in, opt-out and phone changes are single authoritative, idempotent transitions, and a superseded phone cannot resolve to a learner. |

Also required before activation: both pending WhatsApp schema migrations applied and verified, and the rollout order below followed.

## Rollout order
1. Deploy this change with the variable **unset**.
2. Confirm backups for the database, then apply the pending WhatsApp migrations.
3. Keep the variable unset. Do not set it in Preview or Development environments.
4. Only after the prerequisites above are met, and with explicit authorization, set `enabled`.

## Rollback
Unset the variable (the default is OFF) or revert the commit. No schema change is involved.
