// lib/config/whatsappReplyEffects.ts
// Master switch for the educational side effects of inbound parent WhatsApp
// replies (learner-profile update, parent evidence, teacher alert, projection
// event, acknowledgement).
//
// Fail-closed by construction: the ONLY value that enables effects is the
// exact string below. Unset, empty, misspelled, differently cased or
// whitespace-padded values all mean OFF. Enabling requires an explicit,
// authorized deployment configuration change — see the 2026-11-05 entry in
// docs/engineering/implementation-log.md.
//
// STOP / opt-out handling and webhook signature verification do not consult
// this switch; they are safety functions, not educational effects.

export const PARENT_REPLY_EFFECTS_ENV = 'WHATSAPP_PARENT_REPLY_EFFECTS'
export const PARENT_REPLY_EFFECTS_ENABLED_VALUE = 'enabled'

type EnvSource = Record<string, string | undefined>

export function isParentReplyEffectsEnabled(env: EnvSource = process.env): boolean {
  return env[PARENT_REPLY_EFFECTS_ENV] === PARENT_REPLY_EFFECTS_ENABLED_VALUE
}
