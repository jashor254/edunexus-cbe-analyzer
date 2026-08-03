import { test } from 'node:test'
import assert from 'node:assert/strict'
import { composeLearningStory } from './composeLearningStory'
import type { BlueprintSection, LearningStoryInputs, AcademicRecordData, CareerData, GrowthTimelineEntry, IdentityData, LearningCompassData, RiskData } from './types'

function available<T>(data: T): BlueprintSection<T> {
  return { status: 'available', owner: 'test', freshness: 'live', data }
}

function unavailable<T>(reason = 'missing'): BlueprintSection<T> {
  return { status: 'unavailable', owner: 'test', freshness: 'live', data: null, unavailableReason: reason }
}

function baseInputs(): LearningStoryInputs {
  return {
    identity: available<IdentityData>({
      learnerName: 'Brian Matthias',
      admissionNumber: 'ADM-1',
      schoolName: 'Test School',
      schoolLogoUrl: null,
      currentClassName: 'Grade 7',
      academicYearLabel: '2026',
      termLabel: 'Term 2',
      guardians: [],
    }),
    academicRecord: available<AcademicRecordData>({
      overallTrend: 'improving',
      bySubject: [
        { subject: 'Mathematics', latestLevel: 2, trend: 'declining', evidenceCount: 1, latestEvidenceAt: '2026-06-15T00:00:00Z' },
        { subject: 'English', latestLevel: 4, trend: 'improving', evidenceCount: 3, latestEvidenceAt: '2026-07-01T00:00:00Z' },
      ],
      competencies: [],
      confidence: 76,
      lastComputed: '2026-07-23T10:00:00.000Z',
    }),
    learningCompass: available<LearningCompassData>({
      currentLearningFocus: { subject: 'Mathematics', subtopic: 'Fractions' },
      nextRecommendedAction: 'Revisit fractions through guided practice this week.',
      holidayProgrammeAvailable: false,
      learningReadiness: null,
      notes: [],
    }),
    career: unavailable<CareerData>('not needed'),
    growthTimeline: available<GrowthTimelineEntry[]>([{
      windowStart: '2026-01-10T00:00:00.000Z',
      windowEnd: '2026-07-10T00:00:00.000Z',
      direction: 'improving',
      earliestScore: 0.35,
      latestScore: 0.7,
      delta: 0.35,
      trajectory: 'Current evidence suggests upward movement across the available scored evidence. The visible window moves from 35% to 70% (+35 points).',
      supportingEvidenceIds: ['e1', 'e2', 'e3'],
      confidence: 81,
      coverage: {
        evidenceCount: 3,
        evidenceDiversity: 2,
        latestEvidenceAt: '2026-07-10T00:00:00.000Z',
        oldestEvidenceAt: '2026-01-10T00:00:00.000Z',
        freshnessDays: 13,
      },
    }]),
    risk: available<RiskData>({
      overallRiskLevel: 'watch',
      flags: [{
        subject: 'Mathematics',
        reason: 'Approaching Expectation in Mathematics but declining from prior evidence',
        severity: 'watch',
        evidenceIds: ['e1', 'e2'],
      }],
      supportingEvidenceIds: ['e1', 'e2'],
      confidence: 74,
      coverage: {
        evidenceCount: 2,
        evidenceDiversity: 2,
        latestEvidenceAt: '2026-07-10T00:00:00.000Z',
        oldestEvidenceAt: '2026-06-01T00:00:00.000Z',
        freshnessDays: 13,
      },
      lastComputed: '2026-07-23T10:00:00.000Z',
    }),
    capability: {
      value: {
        overallLevel: 'capable',
        overallScore: 0.56,
        bySubject: {
          Mathematics: { level: 'developing', score: 0.33 },
          English: { level: 'strong', score: 0.83 },
        },
      },
      confidence: 79,
      coverage: {
        evidenceCount: 2,
        evidenceDiversity: 2,
        latestEvidenceAt: '2026-07-10T00:00:00.000Z',
        oldestEvidenceAt: '2026-06-01T00:00:00.000Z',
        freshnessDays: 13,
      },
    },
    completeness: {
      value: {
        subjectsCovered: ['Mathematics', 'English', 'Science', 'Kiswahili', 'Social Studies'],
        totalEvidenceCount: 8,
        sourceDiversity: 2,
        completenessScore: 78,
      },
      confidence: 82,
      coverage: {
        evidenceCount: 8,
        evidenceDiversity: 2,
        latestEvidenceAt: '2026-07-10T00:00:00.000Z',
        oldestEvidenceAt: '2026-01-10T00:00:00.000Z',
        freshnessDays: 13,
      },
    },
  }
}

test('composeLearningStory builds a connected, evidence-bound story when evidence is strong', () => {
  const section = composeLearningStory(baseInputs())
  assert.equal(section.status, 'available')
  assert.match(section.data?.narrative ?? '', /Across the available evidence/)
  assert.match(section.data?.opportunity ?? '', /Mathematics/)
  assert.match(section.data?.trajectory ?? '', /upward movement/)
})

test('composeLearningStory marks low confidence when completeness is thin', () => {
  const inputs = baseInputs()
  inputs.completeness = {
    value: {
      subjectsCovered: ['Mathematics'],
      totalEvidenceCount: 1,
      sourceDiversity: 1,
      completenessScore: 18,
    },
    confidence: 24,
    coverage: {
      evidenceCount: 1,
      evidenceDiversity: 1,
      latestEvidenceAt: '2026-07-20T00:00:00.000Z',
      oldestEvidenceAt: '2026-07-20T00:00:00.000Z',
      freshnessDays: 3,
    },
  }

  const section = composeLearningStory(inputs)
  assert.equal(section.status, 'available')
  assert.match(section.data?.confidenceStatement ?? '', /low-confidence/i)
})

test('composeLearningStory handles missing risk without inventing one', () => {
  const inputs = baseInputs()
  inputs.risk = unavailable<RiskData>('no risk evidence')
  const section = composeLearningStory(inputs)
  assert.equal(section.status, 'available')
  assert.match(section.data?.nextConcern ?? '', /No supported risk exposure/i)
})

test('composeLearningStory states insufficient growth evidence explicitly', () => {
  const inputs = baseInputs()
  inputs.growthTimeline = unavailable<GrowthTimelineEntry[]>('not enough scored evidence')
  const section = composeLearningStory(inputs)
  assert.equal(section.status, 'available')
  assert.match(section.data?.trajectory ?? '', /not yet enough evidence/i)
})

test('composeLearningStory identifies mixed capability evidence without destiny language', () => {
  const section = composeLearningStory(baseInputs())
  assert.equal(section.status, 'available')
  assert.match(section.data?.interpretation ?? '', /developing unevenly/)
  assert.doesNotMatch(section.data?.narrative ?? '', /\b(destined|always|will become)\b/i)
})

// ── Phase 4B.1 — comparable-context / weakest-subject-language regressions ──

test('two strong subjects (both "strong"/"exceptional") with a real gap do not produce a "least secure" weakness claim', () => {
  const inputs = baseInputs()
  inputs.capability!.value = {
    overallLevel: 'exceptional',
    overallScore: 0.9,
    bySubject: {
      Mathematics: { level: 'strong', score: 0.70 },
      English: { level: 'exceptional', score: 0.98 }, // spread 0.28 -> a real, "meaningful" gap by this file's own threshold
    },
  }
  const section = composeLearningStory(inputs)
  assert.doesNotMatch(section.data?.opportunity ?? '', /least secure/i)
  assert.match(section.data?.opportunity ?? '', /enrichment|continued challenge/i)
})

test('a genuinely lower, below-threshold subject can still be named a priority ("least secure" remains legitimate when true)', () => {
  const section = composeLearningStory(baseInputs()) // Mathematics: developing/0.33 vs English: strong/0.83
  assert.match(section.data?.opportunity ?? '', /least secure/i)
  assert.match(section.data?.opportunity ?? '', /Mathematics/)
})

test('no meaningful gap between subjects does not single out either as an opportunity to strengthen', () => {
  const inputs = baseInputs()
  inputs.capability!.value = {
    overallLevel: 'capable',
    overallScore: 0.6,
    bySubject: {
      Mathematics: { level: 'capable', score: 0.6 },
      English: { level: 'capable', score: 0.62 }, // spread well under the 0.25 "meaningful gap" threshold
    },
  }
  const section = composeLearningStory(inputs)
  assert.doesNotMatch(section.data?.opportunity ?? '', /least secure/i)
  assert.doesNotMatch(section.data?.opportunity ?? '', /Mathematics|English/)
})

test('enrichment language remains possible for a relatively-lower-but-still-strong subject', () => {
  const inputs = baseInputs()
  inputs.capability!.value = {
    overallLevel: 'strong',
    overallScore: 0.85,
    bySubject: {
      Mathematics: { level: 'capable', score: 0.55 }, // still "capable", not below-threshold, but a real 0.4 spread
      English: { level: 'exceptional', score: 0.95 },
    },
  }
  const section = composeLearningStory(inputs)
  assert.doesNotMatch(section.data?.opportunity ?? '', /least secure/i)
  assert.match(section.data?.opportunity ?? '', /enrichment|continued challenge/i)
})

// ── Editorial Polish Sprint (2026-08-03) — anti-repetition regression guard ──

test('editorial: the narrative does not open more than one sentence with the same stock phrase', () => {
  const section = composeLearningStory(baseInputs())
  const narrative = section.data?.narrative ?? ''
  const sentences = narrative.split(/(?<=[.!?])\s+/)
  const openers = sentences.map(s => s.split(/\s+/).slice(0, 3).join(' ').toLowerCase())
  const counts = new Map<string, number>()
  for (const opener of openers) counts.set(opener, (counts.get(opener) ?? 0) + 1)
  for (const [opener, count] of counts) {
    assert.ok(count <= 1, `sentence opener "${opener}" repeats ${count} times in the narrative — expected each opener to be used at most once`)
  }
})

test('editorial: known robotic template phrases do not appear more than once each', () => {
  const section = composeLearningStory(baseInputs())
  const narrative = section.data?.narrative ?? ''
  const acrossCount = (narrative.match(/Across the available evidence/g) ?? []).length
  const currentEvidenceCount = (narrative.match(/Current evidence suggests/g) ?? []).length
  assert.ok(acrossCount <= 1, `"Across the available evidence" appears ${acrossCount} times`)
  assert.ok(currentEvidenceCount <= 1, `"Current evidence suggests" appears ${currentEvidenceCount} times`)
})

test('editorial: non-deficient branches never trip the Coherence Engine\'s deficiency-marker vocabulary', () => {
  // Mirrors lib/learnerBlueprint/coherence/rules/textSignals.ts's
  // DEFICIENCY_MARKERS list directly, so a future wording change that
  // accidentally reintroduces one of these words in a non-deficient branch
  // fails here, at the source, rather than surfacing later as a confusing
  // coherence FAIL on an unrelated Blueprint.
  const inputs = baseInputs()
  inputs.capability!.value = {
    overallLevel: 'strong',
    overallScore: 0.85,
    bySubject: {
      Mathematics: { level: 'capable', score: 0.55 },
      English: { level: 'exceptional', score: 0.95 },
    },
  }
  const section = composeLearningStory(inputs)
  const markers = ['below the level expected', 'below expectation', 'struggl', 'weak', 'needs improvement', 'needs support', 'behind', 'not meeting', 'underperform', 'gap in', 'comprehension gap', 'insecure', 'needing attention', 'needs attention']
  const opportunity = (section.data?.opportunity ?? '').toLowerCase()
  for (const marker of markers) {
    assert.ok(!opportunity.includes(marker), `opportunity text unexpectedly contains deficiency marker "${marker}": "${opportunity}"`)
  }
})

test('editorial: no second-person address ("you"/"your") leaks into the narrative — the learner\'s name carries the voice instead, so the same text reads correctly for a principal, teacher, or parent', () => {
  const section = composeLearningStory(baseInputs())
  const narrative = section.data?.narrative ?? ''
  assert.doesNotMatch(narrative, /\byour\b|\byou\b/i)
})

test('editorial: opportunity ends with proper sentence punctuation even when nextRecommendedAction has none of its own', () => {
  const inputs = baseInputs()
  inputs.learningCompass.data = {
    ...inputs.learningCompass.data!,
    nextRecommendedAction: 'Continue with mathematics', // no trailing period, matches real production data
  }
  const section = composeLearningStory(inputs)
  const opportunity = section.data?.opportunity ?? ''
  assert.match(opportunity, /[.!?]$/, `opportunity should end with sentence punctuation, got: "${opportunity}"`)
  assert.doesNotMatch(opportunity, /mathematics\.\./i, 'should never produce a double period when the source text already ends in one')
})

test('composeLearningStory is unavailable when there is no canonical evidence to synthesize', () => {
  const inputs = baseInputs()
  inputs.academicRecord = unavailable<AcademicRecordData>('no academic evidence')
  inputs.growthTimeline = unavailable<GrowthTimelineEntry[]>('no growth evidence')
  inputs.risk = unavailable<RiskData>('no risk evidence')
  inputs.capability = null
  inputs.completeness = null

  const section = composeLearningStory(inputs)
  assert.equal(section.status, 'unavailable')
  assert.match(section.unavailableReason ?? '', /canonical evidence/i)
})
