// lib/projection/riskProjector.ts
// Deterministic, rule-based risk flags — evidence only, no AI, no
// dependency on other projectors' output (kept evidence-only so projectors
// stay independently composable, per the engine's design rule that each
// projector consumes Evidence and produces one projection — not each
// other's projections).

import type { EvidenceRow } from '@/lib/repositories/evidence.repository'
import type { Projection, RiskValue, RiskFlag } from './types'
import { computeCoverage, computeProjectionConfidence, sortEvidenceChronologically } from './coverage'

export const RISK_PROJECTION_VERSION = 'risk-v1'

const SEVERITY_ORDER: Record<RiskFlag['severity'], number> = { watch: 1, at_risk: 2, critical: 3 }

export function projectRisk(evidence: EvidenceRow[], now: Date = new Date()): Projection<RiskValue> | null {
  const scored = evidence.filter(e => e.cbc_level !== null)
  if (scored.length === 0) return null

  const bySubject = new Map<string, EvidenceRow[]>()
  for (const e of scored) {
    const group = bySubject.get(e.subject) ?? []
    group.push(e)
    bySubject.set(e.subject, group)
  }

  const flags: RiskFlag[] = []
  for (const [subject, rows] of bySubject) {
    const sorted = sortEvidenceChronologically(rows)
    const latest = sorted[sorted.length - 1]
    const earliest = sorted[0]
    const declining = sorted.length >= 2 && latest.cbc_level! < earliest.cbc_level!

    // Conflicting evidence (see lib/intelligence/evidenceLifecycle.ts's
    // flagContradictionIfAny) must surface as uncertainty a teacher can act
    // on, not just a quieter confidence number — this is the one risk flag
    // type that isn't about the learner's performance at all, only about
    // the evidence itself being unresolved.
    if (sorted.some(r => r.verification_state === 'contradicted')) {
      flags.push({
        subject, evidenceIds: sorted.filter(r => r.verification_state === 'contradicted').map(r => r.id),
        severity: 'watch',
        reason: `Conflicting evidence for ${subject} — two confirmed sources disagree; a teacher should review before relying on this.`,
      })
    }

    if (latest.cbc_level === 1) {
      flags.push({
        subject, evidenceIds: sorted.map(r => r.id),
        severity: declining ? 'critical' : 'at_risk',
        reason: declining
          ? `Below Expectation in ${subject} and declining from prior evidence`
          : `Below Expectation in ${subject} (latest confirmed evidence)`,
      })
    } else if (latest.cbc_level === 2 && declining) {
      flags.push({
        subject, evidenceIds: sorted.map(r => r.id),
        severity: 'watch',
        reason: `Approaching Expectation in ${subject} but declining from prior evidence`,
      })
    }
  }

  const overallRiskLevel = flags.length === 0
    ? 'normal'
    : (['critical', 'at_risk', 'watch'] as const).find(level => flags.some(f => f.severity === level)) ?? 'normal'

  return {
    value: { flags: flags.sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]), overallRiskLevel },
    supportingEvidenceIds: scored.map(e => e.id),
    confidence: computeProjectionConfidence(scored),
    coverage: computeCoverage(scored, now),
    lastComputed: now.toISOString(),
    projectionVersion: RISK_PROJECTION_VERSION,
  }
}
