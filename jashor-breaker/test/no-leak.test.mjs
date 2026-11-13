import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeRepo, writeConfig, FAKE, FAKE_TAILS } from './helpers.mjs'
import { containsSecret } from '../core/redactor.mjs'

const CLI = new URL('../cli.mjs', import.meta.url).pathname

function seededRepo(extra = {}) {
  const all = Object.values(FAKE).join(' ')
  return makeRepo({
    'src/all.ts': `const everything = "${all}"\n`,
    'src/one-per-line.ts': Object.values(FAKE).map((v) => `const x = "${v}"`).join('\n'),
    'lib/x.test.ts': `const k = "${FAKE.paystackTest}"\n`,
    'docs/readme.md': `Example: ${FAKE.jwt}\n`,
    '.env.local': `UNIQUE_ENV_MARKER_9F3A=1\nSUPABASE_KEY=${FAKE.supabase}\n`,
    'package.json': `{ broken ${FAKE.github}`,
    'package-lock.json': `garbage ${FAKE.aws}`,
    ...extra,
  })
}

/** Run via the real CLI and collect every byte it emits: stdout, stderr and all --out files. */
function collect(dir, extraArgs = []) {
  const cfg = writeConfig(dir)
  const out = mkdtempSync(join(tmpdir(), 'jb-leak-'))
  const res = spawnSync(process.execPath, [CLI, 'run', '--config', cfg, '--target', 'fixture', '--out', out, ...extraArgs], { encoding: 'utf8' })
  const files = readdirSync(out).map((f) => readFileSync(join(out, f), 'utf8'))
  return { status: res.status, text: [res.stdout, res.stderr, ...files].join('\n') }
}

test('no raw secret, partial secret or .env content appears in any CLI output or report file', () => {
  const { text, status } = collect(seededRepo())
  assert.ok([0, 2].includes(status), `unexpected exit ${status}`)
  for (const secret of Object.values(FAKE)) assert.ok(!text.includes(secret), `raw secret leaked: ${secret.slice(0, 6)}…`)
  for (const tail of FAKE_TAILS) assert.ok(!text.includes(tail), 'partial secret leaked')
  assert.ok(!text.includes('UNIQUE_ENV_MARKER_9F3A'), '.env content must never be reproduced')
  assert.ok(!containsSecret(text), 'defence-in-depth scan of the output found a secret pattern')
  assert.match(text, /\[REDACTED:/, 'sanity: redaction tokens are present, so the scan did find the secrets')
})

test('the same holds in --json mode', () => {
  const { text } = collect(seededRepo(), ['--json'])
  for (const secret of Object.values(FAKE)) assert.ok(!text.includes(secret))
})

test('a secret embedded in a tracked file NAME fails closed instead of leaking', () => {
  const { text } = collect(seededRepo({ [`config-${FAKE.aws}.txt`]: 'x' }))
  for (const secret of Object.values(FAKE)) assert.ok(!text.includes(secret), 'secret in a path leaked')
})

test('redaction tokens carry only a short fingerprint, which is not the secret', () => {
  const { text } = collect(seededRepo())
  const tokens = text.match(/\[REDACTED:[a-z-]+:[0-9a-f]+\]/g) ?? []
  assert.ok(tokens.length > 5)
  assert.ok(tokens.every((t) => /:[0-9a-f]{8}\]$/.test(t)))
})
