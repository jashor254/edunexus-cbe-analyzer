// Run: npx tsx --test lib/growth/messaging/replyTo.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveOutreachReplyTo, GROWTH_OUTREACH_REPLY_TO_ENV } from './replyTo'

test('returns the configured address when a valid single email is set', () => {
  assert.equal(
    resolveOutreachReplyTo({ [GROWTH_OUTREACH_REPLY_TO_ENV]: 'dennis@edunexus.co.ke' }),
    'dennis@edunexus.co.ke',
  )
})

test('trims surrounding whitespace', () => {
  assert.equal(
    resolveOutreachReplyTo({ [GROWTH_OUTREACH_REPLY_TO_ENV]: '  dennis@edunexus.co.ke  ' }),
    'dennis@edunexus.co.ke',
  )
})

test('fails closed when the env var is unset', () => {
  assert.throws(() => resolveOutreachReplyTo({}), /is not set/)
})

test('fails closed when the env var is blank', () => {
  assert.throws(() => resolveOutreachReplyTo({ [GROWTH_OUTREACH_REPLY_TO_ENV]: '   ' }), /is not set/)
})

test('rejects a malformed address', () => {
  assert.throws(
    () => resolveOutreachReplyTo({ [GROWTH_OUTREACH_REPLY_TO_ENV]: 'not-an-email' }),
    /not a single valid email/,
  )
})

test('rejects a comma-separated list (one monitored inbox only)', () => {
  assert.throws(
    () => resolveOutreachReplyTo({ [GROWTH_OUTREACH_REPLY_TO_ENV]: 'a@x.com,b@y.com' }),
    /not a single valid email/,
  )
})
