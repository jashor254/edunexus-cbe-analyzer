// Run: NEXT_PUBLIC_SUPABASE_URL=x SUPABASE_SERVICE_ROLE_KEY=x npx tsx --test lib/growth/services/csvImport.test.ts
// (dummy env vars needed only because this module also exports runImport(),
// which pulls in growthRepos — computeImportReadiness() itself is pure)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeImportReadiness, type ImportRow } from './csvImport'

function row(overrides: Partial<ImportRow>): ImportRow {
  return { name: 'Test School', phone: '', email: '', ready_for_import: 'FALSE', flag_reason: '', ...overrides }
}

test('computeImportReadiness: counts total, ready, and held back', () => {
  const rows = [row({ ready_for_import: 'TRUE' }), row({ ready_for_import: 'FALSE' }), row({ ready_for_import: 'FALSE' })]
  const stats = computeImportReadiness(rows)
  assert.equal(stats.totalReviewed, 3)
  assert.equal(stats.readyForImport, 1)
  assert.equal(stats.heldBack, 2)
})

test('computeImportReadiness: counts missing phone/email', () => {
  const rows = [row({ phone: '+254700000001', email: 'a@b.ac.ke' }), row({ phone: '', email: '' })]
  const stats = computeImportReadiness(rows)
  assert.equal(stats.missingPhone, 1)
  assert.equal(stats.missingEmail, 1)
})

test('computeImportReadiness: needs-manual-verification from flag_reason', () => {
  const rows = [
    row({ flag_reason: 'suspected website mismatch (school name not found in website domain)' }),
    row({ flag_reason: 'shares website with: Other School (verify: real duplicate vs legitimate multi-branch chain)' }),
    row({ flag_reason: '' }),
  ]
  const stats = computeImportReadiness(rows)
  assert.equal(stats.needsManualVerification, 2)
})

test('computeImportReadiness: out-of-scope from flag_reason', () => {
  const rows = [
    row({ flag_reason: 'out of scope: primary school' }),
    row({ flag_reason: 'junk/non-school Places entry' }),
    row({ flag_reason: 'address/name references Murang County, not Kirinyaga' }),
    row({ flag_reason: '' }),
  ]
  const stats = computeImportReadiness(rows)
  assert.equal(stats.outOfScope, 3)
})

test('computeImportReadiness: an empty CSV is all zeros, not an error', () => {
  const stats = computeImportReadiness([])
  assert.deepEqual(stats, { totalReviewed: 0, readyForImport: 0, heldBack: 0, missingPhone: 0, missingEmail: 0, needsManualVerification: 0, outOfScope: 0 })
})
