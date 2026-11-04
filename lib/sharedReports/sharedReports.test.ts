import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateShareToken, isWellFormedShareToken, SHARE_TOKEN_BYTES, SHARE_TOKEN_LENGTH } from './token'
import { SHARE_GENERATION_ENABLED } from './generationGate'
import { reportOriginCopy } from './presentation'
import { ShareGenerateSchema, SharedReportContentSchema, SHARE_MAX_BODY_BYTES, SHARE_MAX_TTL_DAYS, SHARE_TTL_DAYS } from './reportSchema'
import { getSharedReportByToken, revokeSharedReport } from './read'
import type { SharedReportRpcRow } from '@/lib/repositories/sharedReport.repository'

const ROOT = join(__dirname, '../..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')
const VALID = 'VALIDtokenVALIDtokenVALIDtoken_1'

const okRow = (over: Partial<SharedReportRpcRow> = {}): SharedReportRpcRow => ({
  status: 'ok',
  student_name: 'Synthetic Learner',
  grade: '8',
  report_data: { strengths: ['a'], priorityAreas: ['b'], actionPlan: ['c'], subjectScores: { english: 3 }, overallLevel: 3, overallLabel: 'Proficient' },
  created_at: '2026-11-01T00:00:00Z',
  expires_at: '2026-12-01T00:00:00Z',
  provenance: 'client_supplied',
  ...over,
})

test('generated tokens: 32 chars, base64url alphabet, unique, no padding, accepted by the strict pattern', () => {
  const tokens = new Set(Array.from({ length: 2000 }, generateShareToken))
  assert.equal(tokens.size, 2000)
  for (const t of tokens) {
    assert.equal(t.length, SHARE_TOKEN_LENGTH)
    assert.match(t, /^[A-Za-z0-9_-]{32}$/)
    assert.ok(isWellFormedShareToken(t))
  }
})

test('token entropy is 192 bits: 24 CSPRNG bytes round-trip, uniform per position, ~6 bits/char (base64url, not hex)', () => {
  assert.equal(SHARE_TOKEN_BYTES * 8, 192)
  assert.equal(SHARE_TOKEN_LENGTH * 6, 192, '32 base64url chars carry exactly 192 bits; 32 HEX chars would be only 128')
  const N = 20_000
  const counts: number[][] = Array.from({ length: SHARE_TOKEN_LENGTH }, () => new Array(64).fill(0))
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  const bitOnes = new Array(192).fill(0)
  for (let i = 0; i < N; i++) {
    const t = generateShareToken()
    const bytes = Buffer.from(t, 'base64url')
    assert.equal(bytes.length, 24, 'decodes to exactly 24 bytes (no truncation, no padding)')
    assert.equal(bytes.toString('base64url'), t, 'canonical encoding: every bit is payload')
    for (let c = 0; c < SHARE_TOKEN_LENGTH; c++) counts[c][ALPHABET.indexOf(t[c])]++
    for (let bit = 0; bit < 192; bit++) if ((bytes[bit >> 3] >> (7 - (bit & 7))) & 1) bitOnes[bit]++
  }
  // Per-position chi-square against uniform over 64 symbols (df = 63). The 99.99th
  // percentile is ~103; a biased generator (e.g. hex-only, or truncated) lands far above it.
  const expected = N / 64
  for (let c = 0; c < SHARE_TOKEN_LENGTH; c++) {
    assert.ok(counts[c].every(x => x > 0), `position ${c} never produced some symbol`)
    const chi = counts[c].reduce((acc, o) => acc + (o - expected) ** 2 / expected, 0)
    assert.ok(chi < 110, `position ${c} non-uniform: chi-square ${chi.toFixed(1)}`)
  }
  // Shannon entropy over all positions pooled: must be ≈ 6 bits/char.
  const pooled = new Array(64).fill(0)
  counts.forEach(row => row.forEach((x, k) => { pooled[k] += x }))
  const total = N * SHARE_TOKEN_LENGTH
  const H = -pooled.reduce((acc, x) => acc + (x / total) * Math.log2(x / total), 0)
  assert.ok(H > 5.99, `entropy ${H.toFixed(4)} bits/char`)
  // Every one of the 192 bits is balanced (±5σ of a fair coin).
  const sigma = Math.sqrt(N * 0.25)
  assert.ok(bitOnes.every(x => Math.abs(x - N / 2) < 5 * sigma), 'a token bit is biased')
})

test('token generator uses a CSPRNG only — no Math.random or time-based material', () => {
  const src = read('lib/sharedReports/token.ts').split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
  assert.match(src, /randomBytes\(/)
  assert.doesNotMatch(src, /Math\.random|Date\.now|randomUUID/)
})

test('legacy 12-character tokens are REJECTED by the strict pattern (negative test)', () => {
  assert.equal(isWellFormedShareToken('ABCDEF123456'), false)
  for (const legacy of ['0123456789AB', 'abcdef123456', 'A1B2C3D4E5F6']) assert.equal(isWellFormedShareToken(legacy), false)
})

test('token pattern rejects wrong lengths and malformed input', () => {
  for (const bad of ['', 'short', 'a'.repeat(31), 'a'.repeat(33), 'a'.repeat(64), 'has space 12345678901234567890123', "x' OR '1'='1xxxxxxxxxxxxxxxxxxxxxxx", 'a'.repeat(31) + '%', '../../etc/passwd', 'a'.repeat(31) + '\n']) {
    assert.equal(isWellFormedShareToken(bad), false, JSON.stringify(bad))
  }
})

test('legacy tokens never reach the database', async () => {
  let called = false
  const res = await getSharedReportByToken('ABCDEF123456', async () => { called = true; return null })
  assert.deepEqual(res, { status: 'not_found' })
  assert.equal(called, false)
})

test('malformed tokens never reach the database', async () => {
  let called = false
  const res = await getSharedReportByToken('nope', async () => { called = true; return null })
  assert.deepEqual(res, { status: 'not_found' })
  assert.equal(called, false)
})

test('unknown, revoked and malformed rows are all indistinguishable not_found', async () => {
  assert.deepEqual(await getSharedReportByToken(VALID, async () => null), { status: 'not_found' })
  assert.deepEqual(await getSharedReportByToken(VALID, async () => okRow({ status: 'weird' })), { status: 'not_found' })
  assert.deepEqual(await getSharedReportByToken(VALID, async () => okRow({ student_name: null })), { status: 'not_found' })
})

test('expired returns status only — no learner data in the result', async () => {
  const res = await getSharedReportByToken(VALID, async () => ({
    status: 'expired', student_name: null, grade: null, report_data: null, created_at: null, expires_at: null, provenance: null,
  }))
  assert.deepEqual(res, { status: 'expired' })
})

test('ok result is an explicit DTO: no ids, tokens or unlisted report fields', async () => {
  const res = await getSharedReportByToken(VALID, async () => okRow({
    report_data: { strengths: ['a', 7], subjectScores: { english: 3, bad: 'x' }, overallLevel: 'high', internal_note: 'leak', parent_phone: '0700' },
    // extra columns a careless RPC change might return must not be forwarded
    ...({ id: 'row-id', token: VALID, user_id: 'u', student_id: 's' } as object),
  }))
  assert.equal(res.status, 'ok')
  if (res.status !== 'ok') return
  assert.deepEqual(Object.keys(res).sort(), ['createdAt', 'expiresAt', 'grade', 'provenance', 'reportData', 'status', 'studentName'])
  assert.deepEqual(Object.keys(res.reportData).sort(),
    ['actionPlan', 'overallLabel', 'overallLevel', 'priorityAreas', 'strengths', 'subjectScores'])
  assert.deepEqual(res.reportData.strengths, ['a'])
  assert.deepEqual(res.reportData.subjectScores, { english: 3 })
  assert.equal(res.reportData.overallLevel, 0)
  assert.doesNotMatch(JSON.stringify(res), /leak|0700|row-id|"u"|"s"/)
})

test('repository failures surface as errors, not as "not found"', async () => {
  await assert.rejects(getSharedReportByToken(VALID, async () => { throw new Error('db down') }), /db down/)
})

test('revoke rejects malformed tokens without a write and forwards owner id', async () => {
  let calls = 0
  assert.equal(await revokeSharedReport('bad', 'u1', async () => { calls++; return true }), false)
  assert.equal(calls, 0)
  const seen: string[] = []
  assert.equal(await revokeSharedReport(VALID, 'u1', async (t, o) => { seen.push(t, o); return true }), true)
  assert.deepEqual(seen, [VALID, 'u1'])
  assert.equal(await revokeSharedReport(VALID, 'u2', async () => false), false)
})

test('repository revoke is owner-scoped and only touches live rows', () => {
  const src = read('lib/repositories/sharedReport.repository.ts')
  assert.match(src, /\.eq\('user_id', ownerId\)/)
  assert.match(src, /\.is\('revoked_at', null\)/)
})

test('the share page reads only through the token boundary, never the table', () => {
  const page = read('app/shared/[token]/page.tsx')
  assert.doesNotMatch(page, /from\(['"]shared_reports['"]\)/)
  assert.doesNotMatch(page, /utils\/supabase/)
  assert.match(page, /getSharedReportByToken/)
})

test('generate route uses the secure generator, not a truncated UUID', () => {
  const route = read('app/api/share/generate/route.ts')
  assert.match(route, /generateShareToken\(\)/)
  assert.doesNotMatch(route, /randomUUID\(\)/)
})

test('revoke route authenticates first and validates input with Zod', () => {
  const route = read('app/api/share/revoke/route.ts')
  assert.ok(route.indexOf('auth.getUser()') < route.indexOf('revokeSharedReport('))
  assert.match(route, /z\.object/)
})

// ── Migration safety (static; the role-based proof is scripts/security/) ────
const MIG = read('supabase/migrations/20261104120000_shared_reports_token_boundary.sql')
const MIG_CODE = MIG.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')

test('migration drops the open policy and never recreates a permissive read', () => {
  assert.match(MIG_CODE, /DROP POLICY IF EXISTS "Anyone can read shared reports"/)
  assert.doesNotMatch(MIG_CODE, /CREATE POLICY[^;]*FOR SELECT[^;]*USING\s*\(\s*true\s*\)/i)
  assert.doesNotMatch(MIG_CODE, /GRANT[^;]*ON\s+public\.shared_reports\s+TO\s+(anon|PUBLIC)/i)
})

test('migration pins the lookup function: definer, empty search_path, service-role-only, no dynamic SQL', () => {
  assert.match(MIG_CODE, /SECURITY DEFINER/)
  assert.match(MIG_CODE, /SET search_path = ''/)
  assert.match(MIG_CODE, /REVOKE ALL ON FUNCTION public\.get_shared_report_by_token\(text\) FROM anon/)
  assert.match(MIG_CODE, /GRANT EXECUTE ON FUNCTION public\.get_shared_report_by_token\(text\) TO service_role/)
  assert.doesNotMatch(MIG_CODE, /\bEXECUTE\s+format|\bEXECUTE\s+'/i)
  assert.doesNotMatch(MIG_CODE, /GRANT EXECUTE[^;]*TO\s+(anon|authenticated|PUBLIC)/i)
})

test('migration accepts ONLY the 32-char format and enforces creation caps at the database', () => {
  assert.match(MIG_CODE, /p_token ~ '\^\[A-Za-z0-9_-\]\{32\}\$'/)
  assert.doesNotMatch(MIG_CODE, /\{12,64\}|\{12,/)
  assert.match(MIG_CODE, /shared_reports_token_format[\s\S]*\{32\}/)
  assert.match(MIG_CODE, /shared_reports_expiry_cap[\s\S]*interval '90 days'/)
  assert.match(MIG_CODE, /shared_reports_report_size[\s\S]*16384/)
  assert.match(MIG_CODE, /length\(token\) <> 32/)
})

test('route and database TTL ceilings agree', () => {
  assert.equal(SHARE_MAX_TTL_DAYS, 90)
  assert.ok(SHARE_TTL_DAYS <= SHARE_MAX_TTL_DAYS)
})

test('migration is non-destructive to data', () => {
  assert.doesNotMatch(MIG_CODE, /DROP\s+TABLE|DROP\s+COLUMN|TRUNCATE|DELETE\s+FROM/i)
  // the only data change is revoking retired legacy tokens
  assert.equal((MIG_CODE.match(/\bUPDATE\s+public\./gi) ?? []).length, 1)
})

// ── Report-creation schema ───────────────────────────────────────────────────
const GOOD = { strengths: ['Fractions'], priorityAreas: ['Algebra'], actionPlan: ['Practise'], subjectScores: { english: 3 }, overallLevel: 3, overallLabel: 'Proficient' }

test('report schema accepts a well-formed report and defaults empty lists', () => {
  assert.equal(SharedReportContentSchema.safeParse(GOOD).success, true)
  const minimal = SharedReportContentSchema.parse({ overallLevel: 2 })
  assert.deepEqual(minimal.strengths, [])
  assert.deepEqual(minimal.subjectScores, {})
})

test('report schema rejects unknown keys, wrong types, out-of-range levels and oversize fields', () => {
  const bad: unknown[] = [
    { ...GOOD, internal_note: 'x' },
    { ...GOOD, overallLevel: 0 }, { ...GOOD, overallLevel: 5 }, { ...GOOD, overallLevel: 2.5 }, { ...GOOD, overallLevel: '3' },
    { ...GOOD, strengths: ['x'.repeat(501)] }, { ...GOOD, strengths: Array.from({ length: 11 }, () => 'a') }, { ...GOOD, strengths: [''] }, { ...GOOD, strengths: [7] },
    { ...GOOD, subjectScores: { 'Bad Key!': 3 } }, { ...GOOD, subjectScores: { english: 9 } },
    { ...GOOD, overallLabel: 'x'.repeat(41) },
    { strengths: ['a'] },
  ]
  for (const b of bad) assert.equal(SharedReportContentSchema.safeParse(b).success, false, JSON.stringify(b).slice(0, 80))
})

test('generate input requires a uuid studentId and rejects extra top-level keys (no client-chosen owner/expiry/token)', () => {
  const id = '11111111-1111-4111-8111-111111111111'
  assert.equal(ShareGenerateSchema.safeParse({ studentId: id, reportData: GOOD }).success, true)
  for (const extra of [{ userId: id }, { expiresAt: '2030-01-01' }, { token: 'a'.repeat(32) }, { provenance: 'server_generated' }]) {
    assert.equal(ShareGenerateSchema.safeParse({ studentId: id, reportData: GOOD, ...extra }).success, false)
  }
  assert.equal(ShareGenerateSchema.safeParse({ studentId: 'nope', reportData: GOOD }).success, false)
  assert.ok(SHARE_MAX_BODY_BYTES >= 16 * 1024)
})

test('generate route bounds the body before parsing and records provenance', () => {
  const route = read('app/api/share/generate/route.ts')
  assert.ok(route.indexOf('SHARE_MAX_BODY_BYTES') < route.indexOf('JSON.parse'))
  assert.match(route, /provenance:\s*'client_supplied'/)
  assert.match(route, /\.eq\('user_id', user\.id\)/)
})

// ── Fail-closed generation gate ──────────────────────────────────────────────
test('generation is DISABLED in code — flipping it is a reviewed change that must update this test', () => {
  assert.equal(SHARE_GENERATION_ENABLED, false)
  const gate = read('lib/sharedReports/generationGate.ts').split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
  assert.match(gate, /SHARE_GENERATION_ENABLED:\s*boolean\s*=\s*false/)
  assert.doesNotMatch(gate, /process\.env/, 'the kill switch must not be env-controllable')
})

test('generate route: auth first, then the gate, before any body read, validation or database work', () => {
  const route = read('app/api/share/generate/route.ts')
  const at = (needle: string) => route.indexOf(needle)
  const gateAt = at('if (!SHARE_GENERATION_ENABLED)')
  assert.ok(gateAt > 0 && at('auth.getUser()') < gateAt, 'auth must precede the gate (401 for anonymous callers)')
  for (const later of ['req.text()', 'JSON.parse', 'ShareGenerateSchema.safeParse', 'createServiceClient()', '.insert(']) {
    assert.ok(gateAt < at(later), `gate must come before ${later}`)
  }
  assert.match(route, /apiError\(SHARE_GENERATION_DISABLED_MESSAGE, 410\)/)
})

test('the reader and revoke are NOT gated — existing links still resolve and can be revoked', () => {
  for (const f of ['lib/sharedReports/read.ts', 'app/api/share/revoke/route.ts', 'app/shared/[token]/page.tsx']) {
    assert.doesNotMatch(read(f), /SHARE_GENERATION_ENABLED/, f)
  }
})

// ── Report origin language ───────────────────────────────────────────────────
test('client-supplied content is never presented as EduNexus-generated, parent-reviewed, or "actual scores"', () => {
  const c = reportOriginCopy('client_supplied', '1 November 2026')
  const all = Object.values(c).join(' | ')
  assert.doesNotMatch(all, /generated by EduNexus|EduNexus AI|reviewed by parent|actual assessment|learner evidence/i)
  assert.match(all, /not verified by EduNexus|has not independently verified/i)
  assert.match(c.byline, /1 November 2026/, 'shows the report date, not today')
})

test('server-generated reports keep the EduNexus authorship language, without claiming a parent review', () => {
  const c = reportOriginCopy('server_generated', '1 November 2026')
  assert.match(c.byline, /Generated by EduNexus/)
  assert.match(c.reportLabel, /Learner Intelligence Report/)
  assert.doesNotMatch(Object.values(c).join(' '), /reviewed by parent/i)
})

test('unknown provenance is treated as the least authoritative origin', async () => {
  const unknown = await getSharedReportByToken(VALID, async () => okRow({ provenance: 'official' }))
  const missing = await getSharedReportByToken(VALID, async () => okRow({ provenance: null }))
  const generated = await getSharedReportByToken(VALID, async () => okRow({ provenance: 'server_generated' }))
  assert.equal(unknown.status === 'ok' && unknown.provenance, 'client_supplied')
  assert.equal(missing.status === 'ok' && missing.provenance, 'client_supplied')
  assert.equal(generated.status === 'ok' && generated.provenance, 'server_generated')
})

test('the share page renders origin copy from the helper, not hard-coded authority claims', () => {
  const page = read('app/shared/[token]/page.tsx')
  assert.match(page, /reportOriginCopy\(/)
  assert.doesNotMatch(page, /Generated by EduNexus AI|Reviewed by parent|actual assessment scores|Ask the parent to generate/)
  assert.doesNotMatch(page, /new Date\(\)\.toLocaleDateString/, 'the date shown must be the report date, not today')
})
