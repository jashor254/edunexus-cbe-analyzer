// lib/assessments/reportCardProvenance.test.ts
//
// SEC-02A regression tests — pure, no database, no network.
//
// Proves the application-layer rule: a stored `assessments.source` value is
// descriptive metadata, never proof of authority. Whatever a client writes
// there — 'teacher', nothing, a typo — a report-card row can only become an
// unverified, reported claim (`parent_observation`, tier 1, pending_review).
//
// What this file does NOT prove: it cannot show that a browser cannot write
// the label directly into the database (RLS has no column rule). That limitation
// is asserted at runtime as a KNOWN GAP in reportCardEvidence.integration.test.ts
// (test G) and is reserved for database-level enforcement.
//
// Run: npm test  (STANDARD manifest)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  classifyClaimedSource,
  resolveReportCardProvenance,
  type ClaimedAssessmentSource,
} from './reportCardProvenance'
import { CreateAssessmentSchema, CREATED_ASSESSMENT_SOURCE } from './createAssessmentRequest'
import { computeConfidence, resolveReviewStatus, AUTO_CONFIRM_THRESHOLD } from '@/lib/intelligence/confidence'
import { EVIDENCE_SOURCE_TRUST_TIER } from '@/lib/intelligence/evidence'

const root = process.cwd()

// Every kind of value a client or legacy writer could leave in the column.
const STORED_VALUES: Array<[string, unknown, ClaimedAssessmentSource]> = [
  ['parent', 'parent', 'parent'],
  ['teacher', 'teacher', 'teacher'],
  ['NULL', null, 'unlabelled'],
  ['undefined', undefined, 'unlabelled'],
  ['empty string', '', 'unlabelled'],
  ['whitespace', '   ', 'unlabelled'],
  ['wrong casing', 'Teacher', 'unrecognised'],
  ['trailing space', 'teacher ', 'teacher'], // trimmed for the audit label only
  ['an evidence-source name', 'teacher_upload', 'unrecognised'],
  ['a misspelling', 'techer', 'unrecognised'],
  ['an unrelated word', 'admin', 'unrecognised'],
  ['a number', 1, 'unrecognised'],
  ['an object', { source: 'teacher' }, 'unrecognised'],
  ['a boolean', true, 'unrecognised'],
]

test('classifyClaimedSource normalises every stored value to a closed audit vocabulary', () => {
  for (const [name, value, expected] of STORED_VALUES) {
    assert.equal(classifyClaimedSource(value), expected, name)
  }
})

test('A/B/C/D: no stored value — "teacher", missing, unknown or malformed — produces anything other than the unverified parent_observation source', () => {
  for (const [name, value] of STORED_VALUES) {
    const provenance = resolveReportCardProvenance(value)
    assert.equal(provenance.evidenceSource, 'parent_observation', `${name} must not grant any other source`)
    assert.notEqual(provenance.evidenceSource as string, 'teacher_upload', `${name} must never yield teacher evidence`)
    assert.equal(provenance.claimTrusted, false, `${name}: a stored label is never accepted as proof of authority`)
  }
})

test('the claimed label is preserved for audit only, as a closed-vocabulary marker (never the raw client string)', () => {
  const forged = resolveReportCardProvenance('teacher; DROP TABLE assessments --')
  assert.deepEqual(forged.issues, ['assessment_source_claim_unverified:unrecognised'])
  for (const [name, value] of STORED_VALUES) {
    const { issues, claimedSource } = resolveReportCardProvenance(value)
    assert.deepEqual(issues, [`assessment_source_claim_unverified:${claimedSource}`], name)
    assert.ok(/^assessment_source_claim_unverified:(parent|teacher|unlabelled|unrecognised)$/.test(issues[0]), name)
  }
})

test('the source this rule yields is structurally incapable of auto-confirmation or tier-3 standing', () => {
  const { evidenceSource } = resolveReportCardProvenance('teacher')
  assert.equal(EVIDENCE_SOURCE_TRUST_TIER[evidenceSource], 1, 'tier 1')
  const confidence = computeConfidence({ identityConfidence: 100, identityMatchType: 'external_id', fieldIssueCount: 0, source: evidenceSource })
  assert.ok(confidence < AUTO_CONFIRM_THRESHOLD, 'confidence ceiling sits below the auto-confirm threshold')
  assert.equal(resolveReviewStatus(confidence), 'pending_review')
})

// ── The deprecated create route's request contract (A/B at the API boundary) ─────

const validBody = (extra: Record<string, unknown> = {}) => ({
  student_id: '11111111-1111-4111-8111-111111111111',
  term: 2,
  year: 2026,
  subject_scores: { mathematics: 3, english: 3, kiswahili: 2, integrated_science: 3, social_studies: 4 },
  ...extra,
})

test('A/B: a client that submits source "teacher" is rejected, not stored and not silently downgraded', () => {
  const result = CreateAssessmentSchema.safeParse(validBody({ source: 'teacher' }))
  assert.equal(result.success, false)
})

test('C: a request with no source is accepted — and provenance is assigned by the server, not the request', () => {
  const result = CreateAssessmentSchema.safeParse(validBody())
  assert.equal(result.success, true)
  assert.equal(CREATED_ASSESSMENT_SOURCE, 'parent')
})

test('D: unknown or malformed source values in the request are rejected', () => {
  for (const bad of ['bogus', 'Teacher', 'teacher_upload', '', null, 1, {}, ['teacher']]) {
    assert.equal(CreateAssessmentSchema.safeParse(validBody({ source: bad })).success, false, JSON.stringify(bad))
  }
})

test('E: an ordinary parent-reported request (source "parent") still validates', () => {
  assert.equal(CreateAssessmentSchema.safeParse(validBody({ source: 'parent' })).success, true)
})

// ── Static tripwires (source-text patterns — NOT proof of absence of runtime bypass) ──

const stripComments = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => !line.trim().startsWith('//'))
    .join('\n')
    .replace(/\s\/\/.*$/gm, '')

const read = (rel: string): string => stripComments(readFileSync(join(root, rel), 'utf8'))

test('static: the report-card producer never reads the stored label as a trust decision and never names the teacher source', () => {
  const code = read('lib/assessments/reportCardEvidence.ts')
  assert.ok(!code.includes('teacher_upload'), 'this producer must not mint teacher_upload evidence')
  assert.ok(!/\.source\s*(===|!==|==|!=)/.test(code), 'no comparison on a stored source label')
  assert.ok(!/resolveEvidenceSource/.test(code), 'the label-based resolver is gone')
  assert.ok(code.includes('resolveReportCardProvenance'), 'provenance comes from the policy module')
})

test('static: the create route assigns provenance server-side and never destructures or compares a request source', () => {
  const code = read('app/api/assessments/create/route.ts')
  assert.ok(code.includes('CREATED_ASSESSMENT_SOURCE'))
  assert.ok(!/source\s*===\s*['"]teacher['"]/.test(code), 'no request-driven teacher provenance')
  assert.ok(!/^\s+source,\s*$/m.test(code), 'source is not destructured from the request')
})

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue
    const rel = `${dir}/${name}`
    const st = statSync(join(root, rel))
    if (st.isDirectory()) walk(rel, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(rel)
  }
  return out
}

test('static tripwire: the only remaining readers that branch on a stored assessments.source === "teacher" are presentation-only (reviewed list)', () => {
  // Known, reviewed reader: the Clinic PDF "teacher-wins" merge (presentation of
  // the owner's own levels; not evidence). A new file appearing here must be
  // reviewed for trust impact before it is added.
  const readers = [...walk('app'), ...walk('lib')].filter(rel => {
    const code = stripComments(readFileSync(join(root, rel), 'utf8'))
    return /\.source\s*===\s*['"]teacher['"]/.test(code)
  })
  assert.deepEqual(readers.sort(), ['lib/academicClinic/clinicPdfHandler.ts'])
})
