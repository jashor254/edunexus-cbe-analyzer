/**
 * Safeguard for scripts/growth/send-cold-emails.ts.
 *
 * Resend's Acceptable Use Policy prohibits unsolicited messages, including cold
 * outreach, and requires recipients to have opted in. A suspension would also stop
 * the transactional email that shares this Resend account and From domain (report
 * emails, invites). A real `--send` is therefore refused unless the operator sets the
 * explicit acknowledgement below — an opt-in that cannot happen by accident. A dry
 * run (no `--send`) is unaffected, and nothing else (lib/email, lib/resend-client) is
 * touched. Reversible: set the variable, or revert this file's call in the script.
 */
export const COLD_SEND_OVERRIDE_ENV = 'EDUNEXUS_ALLOW_COLD_EMAIL_SEND'
export const COLD_SEND_OVERRIDE_VALUE = 'I_HAVE_CLEARED_THE_RESEND_AUP_AND_CONSENT_GATES'

export function coldSendBlockedReason(opts: { send: boolean }, env: Record<string, string | undefined> = process.env): string | null {
  if (!opts.send) return null
  if (env[COLD_SEND_OVERRIDE_ENV] === COLD_SEND_OVERRIDE_VALUE) return null
  return (
    'Refusing --send: cold outreach through Resend is blocked by default (Resend Acceptable Use Policy: no unsolicited ' +
    'messages, recipients must have opted in; a suspension would also stop transactional email). Dry run is still ' +
    `available. To override deliberately, set ${COLD_SEND_OVERRIDE_ENV}=${COLD_SEND_OVERRIDE_VALUE} only after the ` +
    'outreach compliance gates are cleared.'
  )
}
