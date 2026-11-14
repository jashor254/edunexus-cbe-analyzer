import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { run } from '../core/runner.mjs'
import { toMarkdown } from '../core/report.mjs'
import { categorise, countByCategory, CATEGORIES } from '../core/categories.mjs'
import { verifyDigest } from '../core/finding.mjs'
import { ADAPTERS } from '../adapters/registry.mjs'
import { makeRepo, writeConfig, FAKE, FAKE_TAILS } from './helpers.mjs'

const REGISTER_PATH = 'docs/security/accepted-risks.json'
const TODAY = new Date('2026-11-13T09:30:00Z')

const register = (over = {}) => JSON.stringify({
  description: 'synthetic',
  database: [
    { lint: 'old_lint', entities: ['f'], reason: 'r', accepted: '2026-06-01', expires: '2026-10-26' },
    { lint: 'soon_lint', entities: ['g'], reason: 'r', accepted: '2026-06-01', expires: '2026-12-13' },
    { lint: 'later_lint', entities: ['h'], reason: 'r', accepted: '2026-06-01', expires: '2026-12-14' },
  ],
  advisories: [
    { id: 'GHSA-aaaa-bbbb-cccc', package: 'pkg', severity: 'high', via: 'x', reason: 'r', accepted: '2026-09-30', expires: '2026-11-12' },
    { id: 'GHSA-dddd-eeee-ffff', package: 'pkg2', severity: 'high', via: 'x', reason: 'r', accepted: '2026-09-30', expires: '2026-11-13' },
  ],
  ...over,
})

async function runOn(files, now = TODAY) {
  const dir = makeRepo({ 'package.json': '{"engines":{"node":"24.x"}}\n', ...files })
  return { dir, r: await run({ adapters: ADAPTERS, configPath: writeConfig(dir), targetId: 'fixture', now }) }
}
const ar = (r) => r.findings.filter((f) => f.checkId === 'accepted-risks')
const byKey = (r, re) => ar(r).filter((f) => re.test(f.title))

test('expired acceptances are identified, with the register severity, and valid-through-expiry semantics', async () => {
  const { r } = await runOn({ [REGISTER_PATH]: register() })
  assert.deepEqual(r.checkErrors, [])
  const expired = ar(r).filter((f) => f.kind === 'expired-acceptance')
  assert.equal(expired.length, 2, 'old_lint (10-26) and GHSA-aaaa (11-12); GHSA-dddd expires TODAY and is still valid')
  assert.ok(expired.some((f) => /GHSA-aaaa/.test(f.evidence[0].location) && f.severity === 'high' && /1 day ago/.test(f.title)))
  assert.ok(expired.some((f) => /old_lint/.test(f.evidence[0].location) && f.severity === 'medium' && /18 days ago/.test(f.title)))
  assert.ok(!expired.some((f) => /GHSA-dddd/.test(f.evidence[0].location)), 'valid through its expires date, matching the CI gate')
  for (const f of expired) assert.equal(categorise(f), 'expired-acceptance')
})

test('entries expiring within 30 days warn; the 30-day boundary is inclusive and day 31 is not a warning', async () => {
  const { r } = await runOn({ [REGISTER_PATH]: register() })
  const warn = ar(r).filter((f) => f.kind === 'accepted-risk' && f.severity === 'low')
  assert.equal(warn.length, 2)
  assert.ok(warn.some((f) => f.evidence[0].location.includes('GHSA-dddd-eeee-ffff')), 'expires today: 0 days left, still valid, warned')
  assert.ok(warn.some((f) => f.evidence[0].location.includes('soon_lint')))
  assert.ok(warn.find((f) => /soon_lint/.test(f.evidence[0].location)).title.includes('30 days'))
  const valid = ar(r).filter((f) => f.kind === 'accepted-risk' && f.severity === 'info')
  assert.equal(valid.length, 1)
  assert.match(valid[0].evidence[0].location, /later_lint/)
  assert.equal(categorise(valid[0]), 'accepted-risk')
})

test('missing owner and review date are reported once, aggregated, as register-design gaps', async () => {
  const { r } = await runOn({ [REGISTER_PATH]: register() })
  const owner = byKey(r, /no recorded owner/)
  const review = byKey(r, /no structured review date/)
  assert.equal(owner.length, 1)
  assert.equal(review.length, 1)
  assert.match(owner[0].title, /^5 /)
  assert.match(owner[0].rationale, /no owner field at all/)
  assert.equal(categorise(owner[0]), 'failed-security-control')
  // Entries that DO carry owner/reviewedAt stop being reported.
  const full = JSON.parse(register())
  for (const e of [...full.database, ...full.advisories]) { e.owner = 'founder'; e.reviewedAt = '2026-11-01' }
  const { r: r2 } = await runOn({ [REGISTER_PATH]: JSON.stringify(full) })
  assert.equal(byKey(r2, /no recorded owner/).length, 0)
  assert.equal(byKey(r2, /no structured review date/).length, 0)
})

test('missing, malformed and impossible dates are control failures, never crashes', async () => {
  const bad = register({ advisories: [
    { id: 'A', accepted: '2026-01-01' },
    { id: 'B', accepted: '2026-01-01', expires: '2026-02-31' },
    { id: 'C', accepted: '2026-01-01', expires: 'next year' },
    { id: 'D', accepted: '2026-05-01', expires: '2026-04-01' },
    null, 7, 'str',
  ] })
  const { r } = await runOn({ [REGISTER_PATH]: bad })
  assert.deepEqual(r.checkErrors, [])
  assert.equal(byKey(r, /no valid expiry/).length, 3)
  assert.equal(byKey(r, /expires on or before/).length, 1)
  assert.ok(ar(r).every((f) => f.kind))
})

test('an unreadable register is a failed control, with no file content echoed', async () => {
  const { r } = await runOn({ [REGISTER_PATH]: `{ "oops": "${FAKE.aws}" ` })
  const f = byKey(r, /not valid JSON/)[0]
  assert.ok(f)
  assert.equal(categorise(f), 'failed-security-control')
  assert.ok(!JSON.stringify(r).includes(FAKE.aws))
})

test('no register present: the module is silent', async () => {
  const { r } = await runOn({})
  assert.equal(ar(r).length, 0)
})

test('it never modifies the register (bytes and mtime unchanged) and never suppresses unrelated findings', async () => {
  const files = {
    [REGISTER_PATH]: register(),
    '.github/workflows/ci.yml': 'jobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n',
    'src/leak.ts': `export const k = "${FAKE.aws}"\n`,
  }
  const { dir, r: withReg } = await runOn(files)
  const p = join(dir, REGISTER_PATH)
  const before = { bytes: readFileSync(p, 'utf8'), mtime: statSync(p).mtimeMs }
  const again = await run({ adapters: ADAPTERS, configPath: writeConfig(dir), targetId: 'fixture', now: TODAY })
  assert.equal(readFileSync(p, 'utf8'), before.bytes)
  assert.equal(statSync(p).mtimeMs, before.mtime)
  // Same repo without the register: every non-register finding is byte-identical, even ones that mention "accepted" things.
  const { r: noReg } = await runOn({ ...files, [REGISTER_PATH]: '{}' })
  const strip = (x) => JSON.stringify(x.findings.filter((f) => f.checkId !== 'accepted-risks'))
  assert.equal(strip(withReg), strip(noReg))
  assert.equal(strip(again), strip(withReg))
  assert.ok(withReg.findings.some((f) => f.checkId === 'secret-patterns' && f.severity === 'high'), 'the AWS-shaped secret is still reported')
})

test('reports distinguish all six categories and stay redacted and reproducible', async () => {
  const files = {
    [REGISTER_PATH]: register(),
    '.github/workflows/ci.yml': 'jobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n',
    '.env.production': 'X=1\n',
    'src/leak.ts': `export const k = "${FAKE.aws}"\n`,
    'package-lock.json': JSON.stringify({ lockfileVersion: 3, packages: { '': {}, 'node_modules/z': { version: '1.0.0', resolved: 'https://registry.npmjs.org/z/-/z-1.0.0.tgz', integrity: 'sha512-x' } } }),
  }
  const { dir, r } = await runOn(files)
  const counts = countByCategory(r.findings)
  for (const c of CATEGORIES) assert.ok(counts[c] > 0 || c === 'unverified-finding' || c === 'confirmed-vulnerability' || c === 'suspected-vulnerability', c)
  assert.ok(counts['expired-acceptance'] >= 1 && counts['accepted-risk'] >= 1 && counts['failed-security-control'] >= 1)
  assert.ok(counts['confirmed-vulnerability'] >= 1, '.env file is a confirmed vulnerability')
  assert.ok(counts['suspected-vulnerability'] >= 1, 'secret-shaped string is suspected')
  assert.ok(counts['unverified-finding'] >= 1, 'platform runtime gap is unverified')
  assert.deepEqual(r.summary.categories, counts)

  const md = toMarkdown(r)
  for (const h of ['## Expired risk acceptance', '## Failed security control', '## Confirmed vulnerability', '## Suspected vulnerability', '## Unverified finding', '## Accepted risk']) assert.ok(md.includes(h), h)
  assert.ok(md.indexOf('## Expired risk acceptance') < md.indexOf('## Confirmed vulnerability'), 'expired acceptances are listed first')
  assert.ok(!md.includes(FAKE.aws) && !JSON.stringify(r).includes(FAKE.aws))
  for (const t of FAKE_TAILS) assert.ok(!md.includes(t))

  assert.ok(verifyDigest(r))
  const r2 = await run({ adapters: ADAPTERS, configPath: writeConfig(dir), targetId: 'fixture', now: TODAY })
  assert.equal(r2.evidenceDigest, r.evidenceDigest)
  assert.equal(toMarkdown(r2), md)
  // The clock is an input: a different "today" is a different report, by design.
  const later = await run({ adapters: ADAPTERS, configPath: writeConfig(dir), targetId: 'fixture', now: new Date('2027-02-01') })
  assert.notEqual(later.evidenceDigest, r.evidenceDigest)
})

test('real register shape: the committed EduNexus register parses and yields only register-hygiene findings', async () => {
  const text = readFileSync(new URL('../../docs/security/accepted-risks.json', import.meta.url), 'utf8')
  const { r } = await runOn({ [REGISTER_PATH]: text })
  assert.deepEqual(r.checkErrors, [])
  assert.equal(ar(r).filter((f) => f.kind === 'expired-acceptance').length, 1, 'auth_leaked_password_protection expired 2026-10-26')
  assert.ok(ar(r).filter((f) => f.kind === 'accepted-risk').length >= 5)
})
