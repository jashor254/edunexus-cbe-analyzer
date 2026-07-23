import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import BlueprintView from './BlueprintView'
import type { LearnerBlueprint } from '@/lib/learnerBlueprint/types'

function section<T>(data: T) {
  return { status: 'available' as const, owner: 'test', freshness: 'live' as const, data }
}

const blueprint: LearnerBlueprint = {
  metadata: {
    blueprintVersion: 'test',
    generatedAt: '2026-07-23T10:00:00.000Z',
    snapshotState: 'current',
    freshness: 'partial',
    evidenceWindow: { start: null, end: '2026-07-23T10:00:00.000Z' },
    ownerVersions: {},
  },
  identity: section({
    learnerName: 'Brian Matthias',
    admissionNumber: 'ADM-1',
    schoolName: 'Test School',
    currentClassName: 'Grade 7',
    academicYearLabel: '2026',
    termLabel: 'Term 2',
    guardians: [],
  }),
  learningStory: section({
    narrative: 'Current evidence suggests Brian Matthias is developing through a mixed but improving pattern.',
    evidence: 'Across the available evidence, current capability is stronger in English and less secure in Mathematics.',
    interpretation: 'Current evidence suggests uneven development rather than a fixed label.',
    opportunity: 'The greatest current opportunity is to strengthen Mathematics.',
    trajectory: 'Current evidence suggests upward movement across the available scored evidence.',
    nextConcern: 'The main concern that deserves attention now is approaching expectation in mathematics but declining from prior evidence.',
    uncertainty: 'This conclusion remains provisional because the current risk picture only reflects the evidence recorded so far.',
    confidenceStatement: 'Current evidence suggests a moderate-confidence picture.',
    missingEvidence: 'Evidence is still missing across more subjects or independent sources.',
  }),
  academicRecord: section({ overallTrend: 'improving', bySubject: [], competencies: [], confidence: 70, lastComputed: '2026-07-23T10:00:00.000Z' }),
  growthTimeline: section([{
    windowStart: '2026-01-10T00:00:00.000Z',
    windowEnd: '2026-07-10T00:00:00.000Z',
    direction: 'improving',
    earliestScore: 0.35,
    latestScore: 0.7,
    delta: 0.35,
    trajectory: 'Current evidence suggests upward movement across the available scored evidence.',
    supportingEvidenceIds: ['e1', 'e2'],
    confidence: 81,
    coverage: { evidenceCount: 2, evidenceDiversity: 2, latestEvidenceAt: '2026-07-10T00:00:00.000Z', oldestEvidenceAt: '2026-01-10T00:00:00.000Z', freshnessDays: 13 },
  }]),
  risk: section({
    overallRiskLevel: 'watch',
    flags: [{ subject: 'Mathematics', reason: 'Approaching Expectation in Mathematics but declining from prior evidence', severity: 'watch', evidenceIds: ['e1', 'e2'] }],
    supportingEvidenceIds: ['e1', 'e2'],
    confidence: 75,
    coverage: { evidenceCount: 2, evidenceDiversity: 2, latestEvidenceAt: '2026-07-10T00:00:00.000Z', oldestEvidenceAt: '2026-01-10T00:00:00.000Z', freshnessDays: 13 },
    lastComputed: '2026-07-23T10:00:00.000Z',
  }),
  attendance: section({ presentCount: 1, absentCount: 0, lateCount: 0, excusedCount: 0, totalSessions: 1, attendancePercentage: 100, notes: [] }),
  learningCompass: section({ currentLearningFocus: null, nextRecommendedAction: null, holidayProgrammeAvailable: false, learningReadiness: null, notes: [] }),
  career: section({ careerCluster: null, strengthProfile: null, futureDirection: null, aiOutlook: null, confidence: null, notes: [] }),
  portfolio: section({ publishedCount: 0, latestItem: null, featuredItem: null, portfolioUrl: null }),
  achievement: section({ achievementCount: 0, latestVerifiedAchievement: null, highestLevelAchievement: null, profileUrl: null }),
  projects: section({ projectCount: 0, latestPublishedProject: null, currentActiveProject: null, featuredProject: null, projectsUrl: null }),
  competitions: section({ totalCompetitions: 0, verifiedCompetitions: 0, latestCompetition: null, currentParticipation: null, competitionsUrl: null }),
  leadership: section({ currentRole: null, completedRoleCount: 0, latestCompletedRole: null, leadershipUrl: null }),
  innovations: section({ currentStage: null, iterationCount: 0, latestMilestone: null, latestImplementationDate: null, innovationsUrl: null }),
  teacherReflection: { status: 'unavailable', owner: 'test', freshness: 'live', data: null, unavailableReason: 'none' },
  parentSummary: section({ headline: null, detail: null, action: null }),
  educationalIdentity: { status: 'not_implemented', owner: 'test', freshness: 'live', data: null, unavailableReason: 'n/a' },
  recommendedNextSteps: section({ actions: [] }),
}

test('BlueprintView surfaces Learning Story, Growth Timeline, and Risk Exposure in the canonical student UI', () => {
  const html = renderToStaticMarkup(
    <BlueprintView
      blueprint={blueprint}
      validation={{ valid: true, errors: [] }}
      learnerId="learner-1"
    />
  )

  assert.match(html, /Learning Story/)
  assert.match(html, /Growth Timeline/)
  assert.match(html, /Risk Exposure/)
  assert.match(html, /Current evidence suggests Brian Matthias is developing/)
})
