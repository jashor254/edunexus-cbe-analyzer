import { test } from 'node:test'
import assert from 'node:assert/strict'
import { redactLine, shannon } from '../core/redactor.mjs'
import { run } from '../core/runner.mjs'
import { toMarkdown } from '../core/report.mjs'
import { edunexus } from '../adapters/edunexus/index.mjs'
import { makeRepo, writeConfig, FAKE, assign } from './helpers.mjs'

const verdict = (line, file = 'src/a.ts') => redactLine(line, { file }).hits.map((h) => h.triage.verdict)

test('generic assignment: env indirection and low entropy are likely false positives', () => {
  assert.deepEqual(verdict(assign('API_TOKEN', 'env(SUPABASE_AUTH_EXTERNAL_TOKEN)')), ['likely-false-positive'])
  assert.deepEqual(verdict(assign('MY_SECRET', 'a'.repeat(24))), ['likely-false-positive'])
  assert.deepEqual(verdict(assign('MY_PASSWORD', 'mock-password-value-here')), ['likely-false-positive'])
})

test('generic assignment with a high-entropy value stays needs-review', () => {
  assert.deepEqual(verdict(assign('STRIPE_API_KEY', FAKE.generic)), ['needs-review'])
  assert.ok(shannon(FAKE.generic) >= 3)
})

test('test-path and docs-path are reasons only; they never decide alone', () => {
  const r = redactLine(assign('STRIPE_API_KEY', FAKE.generic), { file: 'lib/x/y.test.ts' })
  assert.equal(r.hits[0].triage.verdict, 'needs-review')
  assert.ok(r.hits[0].triage.reasons.includes('test-path'))
  assert.ok(redactLine(assign('STRIPE_API_KEY', FAKE.generic), { file: 'docs/a.md' }).hits[0].triage.reasons.includes('docs-path'))
})

test('specific-prefix secrets are NEVER triaged as false positives, even in tests with placeholder-ish context', () => {
  for (const key of ['aws', 'github', 'paystack', 'paystackTest', 'supabase', 'jwt', 'privateKey']) {
    for (const file of ['src/a.ts', 'lib/a.test.ts', 'docs/a.md', 'test/fixtures/a.json']) {
      const hits = redactLine(`mock fake dummy test ${FAKE[key]} 0000000`, { file }).hits
      assert.ok(hits.length >= 1, `${key} should match`)
      assert.ok(hits.every((h) => h.triage.verdict === 'needs-review'), `${key} in ${file}`)
    }
  }
})

test('triage output contains only a verdict and reason ids, never the raw value', () => {
  const r = redactLine(assign('API_TOKEN', `env(${FAKE.generic})`), { file: 'a.ts' })
  assert.ok(!JSON.stringify(r).includes(FAKE.generic))
})

test('end to end: likely false positives are demoted to info, kept, and listed separately', async () => {
  const dir = makeRepo({
    'supabase/config.toml': assign('API_TOKEN', 'env(SUPABASE_AUTH_EXTERNAL_TOKEN)') + '\n',
    'src/real.ts': 'const ' + assign('STRIPE_API_KEY', FAKE.generic) + '\n',
    'src/aws.test.ts': `const k = "${FAKE.aws}"\n`,
  })
  const r = await run({ adapters: { edunexus }, configPath: writeConfig(dir), targetId: 'fixture', now: new Date('2026-11-13') })
  const fp = r.findings.filter((f) => f.triage?.verdict === 'likely-false-positive')
  assert.equal(fp.length, 1)
  assert.equal(fp[0].severity, 'info')
  assert.equal(fp[0].classification, 'unverified')
  assert.match(fp[0].title, /likely false positive/)
  const keep = r.findings.filter((f) => f.checkId === 'secret-patterns' && f.triage?.verdict === 'needs-review')
  assert.equal(keep.length, 2, 'high-entropy assignment and the AWS key in a test file both still need review')
  assert.ok(keep.some((f) => f.severity === 'high'), 'AWS key in a test file keeps its original severity')
  const md = toMarkdown(r)
  assert.match(md, /## Likely false positives \(1\) — demoted, not suppressed/)
  assert.ok(!md.includes(FAKE.aws) && !md.includes(FAKE.generic))
})
