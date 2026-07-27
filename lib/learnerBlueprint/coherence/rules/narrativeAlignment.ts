// lib/learnerBlueprint/coherence/rules/narrativeAlignment.ts
//
// Rule 2 — Narrative Alignment. Verifies the Learning Story's prose agrees
// with the structured Projection-derived sections composed alongside it
// (Risk, Academic Record) — both are built from the same underlying
// Projection, independently rendered, and nothing today cross-checks that
// they still agree once rendered into separate strings. Text matching here
// is intentionally narrow and tied to this codebase's current, real
// composer wording (see docs/architecture/blueprint-intelligence-
// coherence-engine.md §Residual Risks) — a deliberate deterministic
// trade-off per this phase's own rule ("do not call an LLM merely to
// discover simple contradictions").

import type { LearnerBlueprint } from '@/lib/learnerBlueprint/types'
import type { CoherenceFinding } from '../types'
import { textAssertsDeficiency, textMentionsSubject } from './textSignals'

const NO_RISK_PHRASE = 'no current risk flag is active'
const LEAST_SECURE_PHRASE = 'least secure'

export function checkNarrativeAlignment(blueprint: LearnerBlueprint): CoherenceFinding[] {
  const findings: CoherenceFinding[] = []

  // NA-overall-decline and NA-parent-summary below check academicRecord,
  // risk, and parentSummary against each other — none of them read the
  // Learning Story, so they must run even when learningStory itself is
  // unavailable (unlike NA1/NA2/NA2b/NA3 below, which do need `story` and
  // return early via the `if (!story)` guard placed after them).

  // NA-overall-decline (Phase 4B.1) — an overall "declining" trend must
  // trace to at least one real, comparable-context (subject) decline.
  // growthProjector.ts's comparable-context aggregation should make this
  // structurally impossible going forward, but the compiler does not trust
  // that invariant blindly — same "re-check, don't assume" posture as
  // evidence_sufficiency's own trend-point-count guard.
  if (
    blueprint.academicRecord.status === 'available' &&
    blueprint.academicRecord.data?.overallTrend === 'declining'
  ) {
    const hasDecliningSubject = blueprint.academicRecord.data.bySubject.some(s => s.trend === 'declining')
    if (!hasDecliningSubject) {
      findings.push({
        rule: 'narrative_alignment',
        severity: 'critical',
        section: 'academicRecord',
        explanation: `Academic Record reports an overall "declining" trend, but no individual subject has a "declining" trend of its own — an overall decline claim must be traceable to at least one real subject-level decline, never inferred by comparing scores across different subjects.`,
        evidenceReference: 'academicRecord.overallTrend',
        suggestedCorrection: 'Re-verify growthProjector.ts\'s per-subject aggregation — this should be unreachable; if it fires, the comparable-context invariant has regressed.',
      })
    }
  }

  // NA-parent-summary (Phase 4B.1) — the Parent Summary headline is a
  // separate composer (composeParentSummary.ts) reading the same
  // Academic Record; nothing previously cross-checked that the two still
  // agree once independently rendered, mirroring exactly why NA1 exists
  // for Risk vs. Learning Story.
  if (
    blueprint.parentSummary.status === 'available' &&
    blueprint.parentSummary.data?.headline &&
    blueprint.academicRecord.status === 'available' &&
    blueprint.academicRecord.data?.overallTrend
  ) {
    const headlineAssertsDecline = textAssertsDeficiency(blueprint.parentSummary.data.headline)
    const trend = blueprint.academicRecord.data.overallTrend
    if (headlineAssertsDecline && trend !== 'declining' && trend !== 'mixed') {
      findings.push({
        rule: 'narrative_alignment',
        severity: 'critical',
        section: 'parentSummary',
        explanation: `Parent Summary headline ("${blueprint.parentSummary.data.headline}") reads as describing a decline or concern, but Academic Record's overall trend is "${trend}", not declining or mixed. The parent-facing headline and the academic record it should be describing disagree.`,
        evidenceReference: 'academicRecord.overallTrend',
        suggestedCorrection: 'Re-derive the Parent Summary headline from the current academicRecord.overallTrend rather than a stale or independently-computed statement.',
      })
    }
  }

  const story = blueprint.learningStory.status === 'available' ? blueprint.learningStory.data : null
  if (!story) return findings

  // NA1 — Learning Story claims no risk is active while Risk itself
  // reports active flags. Defensive: composeLearningStory currently can't
  // produce this by construction (it reads risk.data.flags directly), but
  // the compiler must not assume that stays true forever.
  if (
    blueprint.risk.status === 'available' &&
    blueprint.risk.data &&
    blueprint.risk.data.flags.length > 0 &&
    story.nextConcern.toLowerCase().includes(NO_RISK_PHRASE)
  ) {
    findings.push({
      rule: 'narrative_alignment',
      severity: 'critical',
      section: 'learningStory',
      explanation: `Learning Story states "${story.nextConcern}" but Risk reports ${blueprint.risk.data.flags.length} active flag(s) (top: "${blueprint.risk.data.flags[0].reason}"). The narrative and the Projection it should be describing directly disagree.`,
      evidenceReference: blueprint.risk.data.supportingEvidenceIds.join(',') || null,
      suggestedCorrection: 'Re-derive nextConcern from the current risk.data.flags rather than a stale or independently-computed statement.',
    })
  }

  // NA2 — the "weakest subject" selector degenerates when a learner has
  // exactly one subject of evidence: it names that subject "least secure"
  // even when it is the learner's only, and possibly strongest, recorded
  // subject. Verified as a real, reproducible bug during the Phase 4
  // Educational Intelligence audit.
  if (
    blueprint.academicRecord.status === 'available' &&
    blueprint.academicRecord.data &&
    blueprint.academicRecord.data.bySubject.length === 1 &&
    story.opportunity.toLowerCase().includes(LEAST_SECURE_PHRASE)
  ) {
    const only = blueprint.academicRecord.data.bySubject[0]
    const isMaxLevel = only.latestLevel === 4
    findings.push({
      rule: 'narrative_alignment',
      severity: isMaxLevel ? 'critical' : 'warning',
      section: 'learningStory',
      explanation: isMaxLevel
        ? `Learning Story names "${only.subject}" as the subject where evidence is "least secure," but it is the learner's only recorded subject and is already at the maximum CBC level (4). A "weakest subject" claim is meaningless — and, at the maximum level, actively false — when there is only one subject to compare.`
        : `Learning Story names "${only.subject}" as "least secure," but it is the learner's only recorded subject — the weakest-subject comparison this sentence implies did not actually happen.`,
      evidenceReference: `academicRecord.bySubject.${only.subject}`,
      suggestedCorrection: 'Guard the weakest/strongest-subject selector for a single-subject evidence set — describe coverage breadth ("evidence is currently limited to one subject") instead of a comparative claim.',
    })
  }

  // NA2b (Phase 4B.1) — the 2+-subject counterpart to NA2 above. NA2 only
  // ever covered the degenerate single-subject case; a learner with two or
  // more subjects could still have their opportunity text call a subject
  // "least secure"/"insecure"/"needing attention" purely because it scored
  // relatively lower than an even-stronger sibling subject — a real,
  // reproduced bug (Victor Gitau: Mathematics improving to Level 4,
  // Kiswahili already at Level 4, zero risk flags on either — yet the
  // opportunity text called Kiswahili "least secure"). A subject actually
  // at the maximum CBC level with no active Risk flag is not insecure by
  // any reasonable reading of the learner's own evidence, regardless of
  // what a *different* subject's even-higher score makes it look like by
  // comparison.
  if (
    blueprint.academicRecord.status === 'available' &&
    blueprint.academicRecord.data &&
    blueprint.academicRecord.data.bySubject.length >= 2 &&
    textAssertsDeficiency(story.opportunity)
  ) {
    const riskFlags = blueprint.risk.status === 'available' ? blueprint.risk.data?.flags ?? [] : []
    for (const subject of blueprint.academicRecord.data.bySubject) {
      if (subject.latestLevel !== 4) continue
      if (!textMentionsSubject(story.opportunity, subject.subject)) continue
      const flagsForSubject = riskFlags.filter(f => f.subject === subject.subject).length
      if (flagsForSubject > 0) continue
      findings.push({
        rule: 'narrative_alignment',
        severity: 'critical',
        section: 'learningStory',
        explanation: `Learning Story's opportunity text ("${story.opportunity}") reads as calling "${subject.subject}" a weakness, but Academic Record shows ${subject.subject} at CBC level 4 (the maximum) with zero active Risk flags for that subject. A subject that scores relatively lower than an even-stronger sibling subject is not the same as a genuine weakness.`,
        evidenceReference: `academicRecord.bySubject.${subject.subject}`,
        suggestedCorrection: 'Guard the multi-subject capability selector against calling a max-level, risk-free subject "least secure" — use enrichment or balanced-strength language when the relatively lower subject is itself still strong.',
      })
    }
  }

  // NA3 — a declining overall trend that the narrative never mentions.
  // Softer than NA1/NA2: phrasing can legitimately vary, so this is a
  // warning, not a hard contradiction.
  const overallTrend = blueprint.academicRecord.status === 'available' ? blueprint.academicRecord.data?.overallTrend : null
  const mentionsDecline = `${story.trajectory} ${story.nextConcern}`.toLowerCase().includes('declin')
  if (overallTrend === 'declining' && !mentionsDecline) {
    findings.push({
      rule: 'narrative_alignment',
      severity: 'warning',
      section: 'learningStory',
      explanation: `Academic Record reports an overall declining trend, but neither the Learning Story's trajectory nor its next-concern text mentions a decline.`,
      evidenceReference: 'academicRecord.overallTrend',
      suggestedCorrection: 'Ensure the Learning Story\'s trajectory/risk description reflects a declining overallTrend when one is present.',
    })
  }

  return findings
}
