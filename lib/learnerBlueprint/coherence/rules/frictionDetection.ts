// lib/learnerBlueprint/coherence/rules/frictionDetection.ts
//
// Cross-cutting Educational Friction checks that don't belong to exactly
// one of the six named rules — contradictions and duplication *within* one
// action set, plus a narrow, honest check for known boilerplate strings.
//
// Explicitly out of scope here (see docs/architecture/blueprint-
// intelligence-coherence-engine.md §Residual Risks): "generic explanations
// repeated across learners" in the general sense requires comparing
// against a corpus of other learners' Blueprints, which a single-Blueprint
// validator cannot see. What IS checked here is the narrower, still-real
// case the Phase 4 audit found reproducible within a single Blueprint:
// known, hardcoded boilerplate strings this codebase's own composers can
// emit verbatim regardless of the learner's actual evidence.

import type { LearnerBlueprint } from '@/lib/learnerBlueprint/types'
import type { BlueprintActionItem } from '@/lib/learnerBlueprint/actionPlan/types'
import type { CoherenceFinding } from '../types'
import { textMentionsSubject, textAssertsDeficiency, textAssertsStrength } from './textSignals'

// lib/parentExperience/actions.ts's own NO_ACTION_COPY constant, matched by
// value rather than imported — that module doesn't export the constant
// (it's an internal literal), and importing a private string across a
// domain boundary just to compare it would be a stranger coupling than
// matching the one, stable, user-facing sentence it renders.
const NO_ACTION_BOILERPLATE = 'Your learner is progressing well. There are no recommended actions at this time.'

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function checkFrictionDetection(
  blueprint: LearnerBlueprint,
  actionItems: BlueprintActionItem[]
): CoherenceFinding[] {
  const findings: CoherenceFinding[] = []

  // Contradictory recommendations — two approved actions naming the same
  // subject, one asserting deficiency and another asserting strength.
  for (let i = 0; i < actionItems.length; i++) {
    for (let j = i + 1; j < actionItems.length; j++) {
      const a = actionItems[i]
      const b = actionItems[j]
      const aText = `${a.title} ${a.rationale}`
      const bText = `${b.title} ${b.rationale}`
      const aDeficient = textAssertsDeficiency(aText)
      const bStrong = textAssertsStrength(bText)
      const aStrong = textAssertsStrength(aText)
      const bDeficient = textAssertsDeficiency(bText)

      const subjectsInBoth = (blueprint.academicRecord.status === 'available' ? blueprint.academicRecord.data?.bySubject ?? [] : [])
        .map(s => s.subject)
        .filter(subject => textMentionsSubject(aText, subject) && textMentionsSubject(bText, subject))

      for (const subject of subjectsInBoth) {
        if ((aDeficient && bStrong) || (aStrong && bDeficient)) {
          findings.push({
            rule: 'friction_detection',
            severity: 'warning',
            section: `actionItem:${a.id},actionItem:${b.id}`,
            explanation: `Actions "${a.title}" and "${b.title}" both concern ${subject} but read as contradictory — one describes it as a strength, the other as a deficiency.`,
            evidenceReference: null,
            suggestedCorrection: 'Reconcile the two actions against the learner\'s current evidence for this subject, or clarify (e.g. by term/date) why both are simultaneously valid.',
          })
        }
      }
    }
  }

  // Duplicated recommendations — two approved actions with effectively
  // identical rationale text (the field composeRecommendedNextSteps.ts
  // passes straight through as a Parent Action's description).
  for (let i = 0; i < actionItems.length; i++) {
    for (let j = i + 1; j < actionItems.length; j++) {
      const a = actionItems[i]
      const b = actionItems[j]
      if (normalize(a.rationale) === normalize(b.rationale) && a.rationale.trim().length > 0) {
        findings.push({
          rule: 'friction_detection',
          severity: 'warning',
          section: `actionItem:${a.id},actionItem:${b.id}`,
          explanation: `Actions "${a.title}" and "${b.title}" have identical rationale text — likely a duplicate proposal rather than two distinct recommendations.`,
          evidenceReference: null,
          suggestedCorrection: 'Confirm both actions are intentionally distinct; reject or supersede the duplicate if not.',
        })
      }
    }
  }

  // Known boilerplate — a real, verified-reproducible case (see the
  // module header) rather than a proxy for the general cross-learner
  // genericness problem.
  if (blueprint.recommendedNextSteps.status === 'available' && blueprint.recommendedNextSteps.data) {
    for (const action of blueprint.recommendedNextSteps.data.actions) {
      if (action.description === NO_ACTION_BOILERPLATE) {
        findings.push({
          rule: 'friction_detection',
          severity: 'warning',
          section: 'recommendedNextSteps',
          explanation: 'The "no recommended actions" message is a fixed sentence that renders identically regardless of the learner\'s actual evidence depth — it does not distinguish "checked and genuinely fine" from "not enough evidence to say."',
          evidenceReference: null,
          suggestedCorrection: 'Consider distinguishing an evidence-backed "no action needed" from a thin-evidence "nothing to recommend yet" state.',
        })
      }
    }
  }

  return findings
}
