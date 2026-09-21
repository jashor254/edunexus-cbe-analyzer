// lib/remedial/planner.test.ts
// Pure unit tests for resolveRemedialGroupType — no DB. Covers the Sprint 6A
// (ADR-0028) migration: classification now delegates entirely to
// classifyGroup() (lib/adaptiveLearning/recommend.ts), with only the
// insufficient_data fallback remaining as remedial-planning-specific logic.
//
// Run with: npx tsx --env-file=.env.local --test lib/remedial/planner.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveRemedialGroupType } from './planner'
import type { LearnerIntelligenceProjection, AcademicValue, RiskValue } from '@/lib/projection/types'

const SUBJECT = 'mathematics'

function projection(overrides: {
  level?: 1 | 2 | 3 | 4 | null
  riskSeverity?: 'watch' | 'at_risk' | 'critical' | null
  riskSubject?: string
  overallRiskLevel?: 'normal' | 'watch' | 'at_risk' | 'critical'
}): LearnerIntelligenceProjection {
  const level = overrides.level === undefined ? 3 : overrides.level
  const academic = level === null ? null : {
    value: {
      bySubject: {
        [SUBJECT]: { subject: SUBJECT, latestLevel: level, trend: 'stable', history: [] },
      },
      bySubStrand: {},
    } as AcademicValue,
    supportingEvidenceIds: ['ev-1'],
    confidence: 80,
    coverage: { evidenceCount: 2, evidenceDiversity: 1, latestEvidenceAt: null, oldestEvidenceAt: null, freshnessDays: 1 },
    lastComputed: new Date().toISOString(),
    projectionVersion: 'academic-v1',
  }

  const risk = {
    value: {
      flags: overrides.riskSeverity == null ? [] : [{
        subject: overrides.riskSubject ?? SUBJECT, reason: 'test', severity: overrides.riskSeverity, evidenceIds: ['ev-1'],
      }],
      overallRiskLevel: overrides.overallRiskLevel ?? 'normal',
    } as RiskValue,
    supportingEvidenceIds: ['ev-1'],
    confidence: 80,
    coverage: { evidenceCount: 1, evidenceDiversity: 1, latestEvidenceAt: null, oldestEvidenceAt: null, freshnessDays: 1 },
    lastComputed: new Date().toISOString(),
    projectionVersion: 'risk-v1',
  }

  return {
    learnerId: 'learner-1', academic, capability: null, knowledge: null,
    behaviour: null, growth: null, risk, completeness: null,
  }
}

// ── Delegation to classifyGroup — the canonical path ──────────────────────────

test('resolveRemedialGroupType: level 1 → BE (same as classifyGroup), regardless of risk', () => {
  const p = projection({ level: 1, riskSeverity: 'critical' })
  assert.equal(resolveRemedialGroupType(p, SUBJECT), 'BE')
})

test('resolveRemedialGroupType: level 2 → AE', () => {
  const p = projection({ level: 2 })
  assert.equal(resolveRemedialGroupType(p, SUBJECT), 'AE')
})

test('resolveRemedialGroupType: level 3 → ME', () => {
  const p = projection({ level: 3 })
  assert.equal(resolveRemedialGroupType(p, SUBJECT), 'ME')
})

test('resolveRemedialGroupType: level 4 → EE', () => {
  const p = projection({ level: 4 })
  assert.equal(resolveRemedialGroupType(p, SUBJECT), 'EE')
})

// ── Bug fix confirmed: cross-subject risk no longer leaks into this subject's
// classification (the pre-Sprint-6A code used the platform-wide
// overallRiskLevel, not the subject-specific flag classifyGroup checks) ──────

test('resolveRemedialGroupType: a critical risk flag for a DIFFERENT subject does not affect this subject\'s classification', () => {
  const p = projection({ level: 1, riskSeverity: 'critical', riskSubject: 'english' })
  assert.equal(resolveRemedialGroupType(p, SUBJECT), 'BE')
})

test('resolveRemedialGroupType: overallRiskLevel critical (from an unrelated subject) does not override a healthy level-4 classification', () => {
  const p = projection({ level: 4, overallRiskLevel: 'critical' })
  assert.equal(resolveRemedialGroupType(p, SUBJECT), 'EE')
})

// ── insufficient_data fallback — the one piece of logic that belongs to this
// module, not to classifyGroup (a remedial plan must never drop a student) ───

test('resolveRemedialGroupType: no projection at all → falls back to AE, never dropped', () => {
  assert.equal(resolveRemedialGroupType(undefined, SUBJECT), 'AE')
})

test('resolveRemedialGroupType: no academic evidence for this subject, platform-wide risk critical → BE', () => {
  const p = projection({ level: null, overallRiskLevel: 'critical' })
  assert.equal(resolveRemedialGroupType(p, SUBJECT), 'BE')
})

test('resolveRemedialGroupType: no academic evidence for this subject, risk not critical → AE (conservative default, never ME/EE)', () => {
  const p = projection({ level: null, overallRiskLevel: 'watch' })
  assert.equal(resolveRemedialGroupType(p, SUBJECT), 'AE')
})
