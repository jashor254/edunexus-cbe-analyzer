import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { coldSendBlockedReason, COLD_SEND_OVERRIDE_ENV, COLD_SEND_OVERRIDE_VALUE } from './coldSendGuard'

test('a real send is blocked by default', () => {
  assert.match(coldSendBlockedReason({ send: true }, {}) ?? '', /Refusing --send/)
})
test('a dry run is never blocked', () => {
  assert.equal(coldSendBlockedReason({ send: false }, {}), null)
})
test('only the exact acknowledgement lifts the block (reversible, deliberate)', () => {
  assert.equal(coldSendBlockedReason({ send: true }, { [COLD_SEND_OVERRIDE_ENV]: COLD_SEND_OVERRIDE_VALUE }), null)
  for (const wrong of ['1', 'true', 'yes', '', COLD_SEND_OVERRIDE_VALUE.toLowerCase()]) {
    assert.ok(coldSendBlockedReason({ send: true }, { [COLD_SEND_OVERRIDE_ENV]: wrong }))
  }
})
test('the script itself exits non-zero on --send before touching the list, the key or the network', () => {
  const env = { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', RESEND_API_KEY: 're_synthetic_not_real', NODE_ENV: 'test' as const }
  const r = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/growth/send-cold-emails.ts', '--list=/nonexistent/does-not-exist.csv', '--send'], { env, encoding: 'utf8' })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /Refusing --send/)
  assert.doesNotMatch(r.stderr + r.stdout, /ENOENT|\[sent\]|\[fail\]/)
})
