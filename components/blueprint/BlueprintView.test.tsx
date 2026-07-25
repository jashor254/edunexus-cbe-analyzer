import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import BlueprintView from './BlueprintView'
import type { LearnerBlueprint } from '@/lib/learnerBlueprint/types'

function section<T>(data: T) {
  return { status: 'available' as const, owner: 'test', freshness: 'live' as const, data }
}

function unavailable<T>(reason: string) {
  return { status: 'unavailable' as const, owner: 'test', freshness: 'live' as const, data: null, unavailableReason: reason }
}

function createBlueprint(overrides: Partial<LearnerBlueprint> = {}): LearnerBlueprint {
  return {
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
    academicRecord: section({
      overallTrend: 'improving',
      bySubject: [
        { subject: 'English', latestLevel: 3, trend: 'improving' },
        { subject: 'Mathematics', latestLevel: 2, trend: 'declining' },
      ],
      competencies: [],
      confidence: 70,
      lastComputed: '2026-07-23T10:00:00.000Z',
    }),
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
    attendance: section({ presentCount: 18, absentCount: 0, lateCount: 1, excusedCount: 0, totalSessions: 19, attendancePercentage: 95, notes: [] }),
    learningCompass: section({
      currentLearningFocus: { subject: 'Mathematics', subtopic: 'Fractions' },
      nextRecommendedAction: 'Practice ratio and fraction fluency three times each week.',
      holidayProgrammeAvailable: true,
      learningReadiness: null,
      notes: [],
    }),
    career: section({
      careerCluster: 'STEM and design exploration',
      strengthProfile: 'Pattern recognition and persistence are the strongest recurring signals.',
      futureDirection: 'Sustained strength in Mathematics could widen future STEM options.',
      aiOutlook: null,
      confidence: 'Medium',
      notes: [],
    }),
    portfolio: section({
      publishedCount: 1,
      latestItem: { title: 'Fractions Poster', category: 'Creative Work', publishedAt: '2026-06-02T10:00:00.000Z' },
      featuredItem: { title: 'Fractions Poster', category: 'Creative Work', publishedAt: '2026-06-02T10:00:00.000Z' },
      portfolioUrl: '/student/portfolio/learner-1',
    }),
    achievement: section({
      achievementCount: 1,
      latestVerifiedAchievement: { title: 'Math Challenge Certificate', category: 'Award', achievementType: 'Certificate', publishedAt: '2026-05-02T10:00:00.000Z' },
      highestLevelAchievement: { title: 'Math Challenge Certificate', category: 'Award', achievementType: 'Certificate', publishedAt: '2026-05-02T10:00:00.000Z' },
      profileUrl: '/student/achievements/learner-1',
    }),
    projects: section({
      projectCount: 1,
      latestPublishedProject: { title: 'Water Filter Model', category: 'Science', publishedAt: '2026-05-12T10:00:00.000Z' },
      currentActiveProject: { title: 'Water Filter Model', category: 'Science' },
      featuredProject: { title: 'Water Filter Model', category: 'Science', publishedAt: '2026-05-12T10:00:00.000Z' },
      projectsUrl: '/student/projects/learner-1',
    }),
    competitions: section({
      totalCompetitions: 1,
      verifiedCompetitions: 1,
      latestCompetition: { name: 'Junior Math Contest', level: 'School', category: 'Mathematics', publishedAt: '2026-06-12T10:00:00.000Z' },
      currentParticipation: null,
      competitionsUrl: '/student/competitions/learner-1',
    }),
    leadership: section({
      currentRole: null,
      completedRoleCount: 1,
      latestCompletedRole: { title: 'Class Librarian', scope: 'Class', publishedAt: '2026-04-12T10:00:00.000Z' },
      leadershipUrl: '/student/leadership/learner-1',
    }),
    innovations: section({
      currentStage: null,
      iterationCount: 1,
      latestMilestone: 'Prototype completed',
      latestImplementationDate: null,
      innovationsUrl: '/student/innovations/learner-1',
    }),
    teacherReflection: section({
      strengths: 'Brian stays with difficult work when he has enough structure.',
      growthArea: 'He still needs stronger consistency in Mathematics.',
      learningHabits: 'He responds well to short, regular practice.',
      recommendedSupport: 'Keep Mathematics support short, regular, and closely monitored.',
      holidayFocus: 'Use the holiday programme to keep Mathematics practice steady.',
      teacherSignature: 'Teacher Njeri',
      writtenAt: '2026-07-20T10:00:00.000Z',
      publishedAt: '2026-07-21T10:00:00.000Z',
      version: 1,
    }),
    parentSummary: section({
      headline: 'Brian Matthias is showing improving progress this term.',
      detail: 'Attendance this term is at 95%.',
      action: 'Practice ratio and fraction fluency three times each week.',
    }),
    educationalIdentity: unavailable('Educational identity is not yet available for this learner.'),
    recommendedNextSteps: section({
      actions: [
        {
          title: 'Continue Holiday Learning',
          description: 'Practice ratio and fraction fluency three times each week.',
          actionType: 'continue_holiday_learning',
          priority: 'important',
          sourceDomain: 'Learning Compass',
          destination: '/child/learner-1/full',
          available: true,
          reasonUnavailable: null,
          generatedAt: '2026-07-23T10:00:00.000Z',
        },
        {
          title: 'Explore Career Journey',
          description: 'Your child is showing interest in STEM and design exploration — explore this together.',
          actionType: 'explore_career_journey',
          priority: 'suggested',
          sourceDomain: 'Career Intelligence',
          destination: '/career-intelligence',
          available: true,
          reasonUnavailable: null,
          generatedAt: '2026-07-23T10:00:00.000Z',
        },
      ],
    }),
    ...overrides,
  }
}

function render(blueprint: LearnerBlueprint, exportMode: 'screen' | 'pdf' = 'screen') {
  return renderToStaticMarkup(
    <BlueprintView
      blueprint={blueprint}
      validation={{ valid: true, errors: [] }}
      learnerId="learner-1"
      exportMode={exportMode}
    />
  )
}

test('BlueprintView exposes exactly the five approved page questions and maps evidence into the new educational argument', () => {
  const html = render(createBlueprint())

  for (const question of [
    'Who is this learner becoming?',
    'Why do we believe this?',
    'What must the school respond to now?',
    'What should the school do next?',
    'What future does this make possible?',
  ]) {
    assert.equal((html.match(new RegExp(question.replace(/[?]/g, '\\?'), 'g')) ?? []).length, 1, `${question} should appear exactly once`)
  }

  assert.match(html, /Learner Direction/)
  assert.match(html, /Current evidence suggests Brian Matthias is developing through a mixed but improving pattern\./)
  assert.match(html, /Learner context/)
  assert.ok(html.indexOf('Current educational judgment') < html.indexOf('Learner context'), 'Learning Story should govern Page 1 ahead of identity context')

  assert.match(html, /Academic evidence/)
  assert.match(html, /Evidence of movement/)
  assert.match(html, /Current evidence suggests a moderate-confidence picture\./)
  assert.match(html, /Evidence is still missing across more subjects or independent sources\./)

  assert.match(html, /Conditions Requiring Response/)
  assert.match(html, /Current severity/)
  assert.match(html, /Approaching Expectation in Mathematics but declining from prior evidence/)

  assert.match(html, /Coordinated Action Plan/)
  assert.match(html, /School \/ Teacher/)
  assert.match(html, /Learner/)
  assert.match(html, /Parent \/ Guardian/)

  assert.match(html, /Future Opened/)
  assert.match(html, /STEM and design exploration/)
  assert.match(html, /Supporting evidence of future direction/)
})

test('BlueprintView keeps normal risk calm rather than alarming', () => {
  const html = render(createBlueprint({
    risk: section({
      overallRiskLevel: 'normal',
      flags: [],
      supportingEvidenceIds: [],
      confidence: 62,
      coverage: { evidenceCount: 1, evidenceDiversity: 1, latestEvidenceAt: '2026-07-10T00:00:00.000Z', oldestEvidenceAt: '2026-07-10T00:00:00.000Z', freshnessDays: 13 },
      lastComputed: '2026-07-23T10:00:00.000Z',
    }),
    learningStory: section({
      narrative: 'Current evidence suggests Brian Matthias is stable and still building a fuller picture.',
      evidence: 'The current evidence is limited but does not indicate a significant concern.',
      interpretation: 'The learner appears stable while more evidence accumulates.',
      opportunity: 'Continue broad learning exposure while watching for stronger patterns.',
      trajectory: 'There is not yet enough growth evidence to state a stronger directional claim.',
      nextConcern: 'No active supported concern is currently visible.',
      uncertainty: 'This conclusion remains provisional because evidence is still limited.',
      confidenceStatement: 'Current evidence suggests a low-to-moderate confidence picture.',
      missingEvidence: 'More subject coverage would make the picture stronger.',
    }),
  }))

  assert.match(html, /stable/)
  assert.match(html, /No active supported concern is currently being flagged across the available scored evidence\./)
  assert.doesNotMatch(html, /urgent support/)
})

test('BlueprintView dedupes repeated recommendations and degrades missing audience-specific actions honestly', () => {
  const html = render(createBlueprint({
    teacherReflection: unavailable('No published teacher reflection yet.'),
    learningCompass: unavailable('No current learning focus yet.'),
    parentSummary: section({
      headline: null,
      detail: null,
      action: 'Practice ratio and fraction fluency three times each week.',
    }),
    recommendedNextSteps: section({
      actions: [{
        title: 'Continue Holiday Learning',
        description: 'Practice ratio and fraction fluency three times each week.',
        actionType: 'continue_holiday_learning',
        priority: 'important',
        sourceDomain: 'Learning Compass',
        destination: '/child/learner-1/full',
        available: true,
        reasonUnavailable: null,
        generatedAt: '2026-07-23T10:00:00.000Z',
      }],
    }),
  }))

  assert.equal((html.match(/Practice ratio and fraction fluency three times each week\./g) ?? []).length, 1)
  assert.match(html, /No teacher-specific action is currently supported clearly enough to state separately in this Blueprint\./)
  assert.match(html, /No learner-specific action is currently supported clearly enough to state separately in this Blueprint\./)
  assert.match(html, /No leadership-specific enablement is supported distinctly by the current Blueprint\./)
})

test('BlueprintView changes future framing by grade band and stays honest when future evidence is thin', () => {
  const grade78 = render(createBlueprint({
    identity: section({
      learnerName: 'Brian Matthias',
      admissionNumber: 'ADM-1',
      schoolName: 'Test School',
      currentClassName: 'Grade 8',
      academicYearLabel: '2026',
      termLabel: 'Term 2',
      guardians: [],
    }),
  }))
  assert.match(grade78, /widen exploration, notice emerging strengths, and resist narrowing the future too early/)

  const grade9 = render(createBlueprint({
    identity: section({
      learnerName: 'Brian Matthias',
      admissionNumber: 'ADM-1',
      schoolName: 'Test School',
      currentClassName: 'Grade 9',
      academicYearLabel: '2026',
      termLabel: 'Term 2',
      guardians: [],
    }),
  }))
  assert.match(grade9, /test pathway readiness, show what evidence is strengthening, and clarify what still needs to grow/)

  const senior = render(createBlueprint({
    identity: section({
      learnerName: 'Brian Matthias',
      admissionNumber: 'ADM-1',
      schoolName: 'Test School',
      currentClassName: 'Grade 11',
      academicYearLabel: '2026',
      termLabel: 'Term 2',
      guardians: [],
    }),
    career: section({
      careerCluster: null,
      strengthProfile: null,
      futureDirection: null,
      aiOutlook: null,
      confidence: null,
      notes: [],
    }),
    portfolio: section({ publishedCount: 0, latestItem: null, featuredItem: null, portfolioUrl: null }),
    achievement: section({ achievementCount: 0, latestVerifiedAchievement: null, highestLevelAchievement: null, profileUrl: null }),
    projects: section({ projectCount: 0, latestPublishedProject: null, currentActiveProject: null, featuredProject: null, projectsUrl: null }),
    competitions: section({ totalCompetitions: 0, verifiedCompetitions: 0, latestCompetition: null, currentParticipation: null, competitionsUrl: null }),
    leadership: section({ currentRole: null, completedRoleCount: 0, latestCompletedRole: null, leadershipUrl: null }),
    innovations: section({ currentStage: null, iterationCount: 0, latestMilestone: null, latestImplementationDate: null, innovationsUrl: null }),
  }))
  assert.match(senior, /further education, TVET, entrepreneurship, or work-related opportunities/)
  assert.match(senior, /The current career signal is still too thin for a more specific future interpretation\./)
  assert.match(senior, /Future evidence is still limited, so this page should guide exploration more than it suggests any firm direction\./)
  assert.doesNotMatch(senior, /Emerging direction:/)
})

test('BlueprintView preserves honest unavailable states without inventing substitute content', () => {
  const html = render(createBlueprint({
    academicRecord: unavailable('Academic evidence is unavailable without a bridged learner record.'),
    growthTimeline: unavailable('Growth evidence is unavailable until more scored evidence exists.'),
    career: unavailable('Career Intelligence is currently unavailable for this learner.'),
  }))

  assert.match(html, /Academic evidence is unavailable without a bridged learner record\./)
  assert.match(html, /Growth evidence is unavailable until more scored evidence exists\./)
  assert.match(html, /Career Intelligence is currently unavailable for this learner\./)
})

test('BlueprintView print export mode keeps the five acts but drops interactive navigation chrome', () => {
  const html = render(createBlueprint(), 'pdf')

  for (const heading of [
    'Learner Direction',
    'Evidence for the Judgment',
    'Conditions Requiring Response',
    'Coordinated Action Plan',
    'Future Opened',
  ]) {
    assert.match(html, new RegExp(heading))
  }

  assert.match(html, /data-blueprint-ready="true"/)
  assert.match(html, /data-blueprint-print-break="before"/)
  assert.doesNotMatch(html, /data-blueprint-nav="true"/)
  assert.doesNotMatch(html, /View History →/)
})
