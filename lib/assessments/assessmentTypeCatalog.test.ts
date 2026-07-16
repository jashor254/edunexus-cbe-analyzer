// lib/assessments/assessmentTypeCatalog.test.ts
//
// Sprint 5I (docs/engineering/sprint-5i-assessment-type-consolidation.md):
// unit tests for the new canonical Assessment Type mapping module — pure
// functions, no DB, no fixtures, no cleanup needed.
//
// Run: npx tsx --test lib/assessments/assessmentTypeCatalog.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  KNOWN_ASSESSMENT_TYPES,
  isKnownAssessmentType,
  getAssessmentTypeMeta,
  getTitleLabel,
  getBadgeLabel,
  getBadgeClass,
  getDefaultPurposeCode,
  buildAssessmentTitle,
} from './assessmentTypeCatalog'

const EXPECTED = {
  opener:     { titleLabel: 'Opener',     badgeLabel: 'Opener',     purposeCode: 'diagnostic' },
  cat:        { titleLabel: 'CAT',        badgeLabel: 'CAT',        purposeCode: 'formative'  },
  midterm:    { titleLabel: 'Mid-Term',   badgeLabel: 'Midterm',    purposeCode: 'summative'  },
  endterm:    { titleLabel: 'End-Term',   badgeLabel: 'End Term',   purposeCode: 'summative'  },
  exam:       { titleLabel: 'Exam',       badgeLabel: 'Exam',       purposeCode: 'summative'  },
  assignment: { titleLabel: 'Assignment', badgeLabel: 'Assignment', purposeCode: 'practice'   },
} as const

test('every teacher label resolves to its exact expected title/badge label and purpose code', () => {
  for (const [type, expected] of Object.entries(EXPECTED)) {
    assert.equal(getTitleLabel(type), expected.titleLabel, `${type} titleLabel`)
    assert.equal(getBadgeLabel(type), expected.badgeLabel, `${type} badgeLabel`)
    assert.equal(getDefaultPurposeCode(type), expected.purposeCode, `${type} purposeCode`)
  }
})

test('KNOWN_ASSESSMENT_TYPES contains exactly the 6 platform-seeded labels, in the original dictionary order', () => {
  assert.deepEqual(KNOWN_ASSESSMENT_TYPES, ['opener', 'cat', 'midterm', 'endterm', 'exam', 'assignment'])
})

test('every canonical purpose code appears at least once (diagnostic, formative, summative, practice)', () => {
  const purposeCodes = new Set(KNOWN_ASSESSMENT_TYPES.map(t => getDefaultPurposeCode(t)))
  assert.ok(purposeCodes.has('diagnostic'))
  assert.ok(purposeCodes.has('formative'))
  assert.ok(purposeCodes.has('summative'))
  assert.ok(purposeCodes.has('practice'))
})

test('invalid/custom labels: isKnownAssessmentType returns false, meta is null', () => {
  assert.equal(isKnownAssessmentType('quiz'), false)
  assert.equal(isKnownAssessmentType(''), false)
  assert.equal(isKnownAssessmentType('CAT'), false, 'case-sensitive — matches resolveOrCreateAssessmentType\'s own case-sensitive exact-match behavior')
  assert.equal(getAssessmentTypeMeta('quiz'), null)
})

test('case handling: labels are case-sensitive, matching the exact-match semantics resolveOrCreateAssessmentType already relies on', () => {
  assert.equal(isKnownAssessmentType('Cat'), false)
  assert.equal(isKnownAssessmentType('cat'), true)
})

test('unknown/custom label fallbacks match each prior call site\'s exact original behavior', () => {
  // getTitleLabel / getBadgeLabel fall back to the raw input (matches the
  // prior `TYPE_LABEL[x] ?? x` / `typeLabel[x] || x` behavior in
  // assessment.repository.ts and pdfRenderer.ts respectively).
  assert.equal(getTitleLabel('a-custom-teacher-type'), 'a-custom-teacher-type')
  assert.equal(getBadgeLabel('a-custom-teacher-type'), 'a-custom-teacher-type')
  // getBadgeClass returns undefined for an unknown type (no prior dictionary
  // ever had a defined fallback color for this case).
  assert.equal(getBadgeClass('a-custom-teacher-type'), undefined)
  // getDefaultPurposeCode returns null — never guessed (matches
  // ASSESSMENT_TYPE_DEFAULT_PURPOSE_CODE's prior `?? null` exactly).
  assert.equal(getDefaultPurposeCode('a-custom-teacher-type'), null)
})

test('metadata lookup: getAssessmentTypeMeta returns the full, correct object for every known type', () => {
  for (const type of KNOWN_ASSESSMENT_TYPES) {
    const meta = getAssessmentTypeMeta(type)
    assert.ok(meta)
    assert.equal(meta!.titleLabel, EXPECTED[type].titleLabel)
    assert.equal(meta!.badgeLabel, EXPECTED[type].badgeLabel)
    assert.equal(meta!.purposeCode, EXPECTED[type].purposeCode)
    assert.equal(typeof meta!.badgeClass, 'string')
    assert.ok(meta!.badgeClass.length > 0)
  }
})

test('purpose lookup: round-trip — every known type\'s purpose code is stable and deterministic across repeated calls', () => {
  for (const type of KNOWN_ASSESSMENT_TYPES) {
    const first = getDefaultPurposeCode(type)
    const second = getDefaultPurposeCode(type)
    assert.equal(first, second)
  }
})

test('duplicate prevention: KNOWN_ASSESSMENT_TYPES has no repeated entries', () => {
  assert.equal(new Set(KNOWN_ASSESSMENT_TYPES).size, KNOWN_ASSESSMENT_TYPES.length)
})

test('buildAssessmentTitle matches the exact "Term {term} {titleLabel} {year}" format both prior implementations produced', () => {
  assert.equal(buildAssessmentTitle('cat', '2', 2026), 'Term 2 CAT 2026')
  assert.equal(buildAssessmentTitle('midterm', '1', 2025), 'Term 1 Mid-Term 2025')
  assert.equal(buildAssessmentTitle('endterm', '3', 2026), 'Term 3 End-Term 2026')
  // Unknown type: falls back to the raw string, exactly as
  // assessment.repository.ts's prior `TYPE_LABEL[x] ?? x` did.
  assert.equal(buildAssessmentTitle('custom-name', '1', 2026), 'Term 1 custom-name 2026')
})

test('regression: badge label spelling ("Midterm"/"End Term") is distinct from title label spelling ("Mid-Term"/"End-Term") — the two prior dictionaries never agreed, and this module must preserve both, not unify them', () => {
  assert.notEqual(getTitleLabel('midterm'), getBadgeLabel('midterm'))
  assert.notEqual(getTitleLabel('endterm'), getBadgeLabel('endterm'))
  assert.equal(getTitleLabel('midterm'), 'Mid-Term')
  assert.equal(getBadgeLabel('midterm'), 'Midterm')
  assert.equal(getTitleLabel('endterm'), 'End-Term')
  assert.equal(getBadgeLabel('endterm'), 'End Term')
})
