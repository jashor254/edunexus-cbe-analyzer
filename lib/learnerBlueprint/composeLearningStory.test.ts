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
