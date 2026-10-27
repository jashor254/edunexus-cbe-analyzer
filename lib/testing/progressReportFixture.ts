// lib/testing/progressReportFixture.ts
//
// Synthetic LearnerBlueprint fixtures for the Learner Progress Report tests
// (progressReport.test.ts, ParentBlueprintView.test.tsx, the parent report
// page test). Every name, school and value here is invented — never a real
// learner (see the synthetic-data rule for shareable/test artifacts). Pure
// data, no imports beyond types: safe for the STANDARD test suite.

import type {
  ApprovedPlanStep,
  BlueprintSection,
  LearnerBlueprint,
  SubjectRecord,
} from '@/lib/learnerBlueprint/types'
import { getGradeBand } from '@/lib/learnerBlueprint/gradeBand'

export function available<T>(data: T): BlueprintSection<T> {
  return { status: 'available', owner: 'test', freshness: 'live', data }
}

export function unavailable<T>(reason: string): BlueprintSection<T> {
  return { status: 'unavailable', owner: 'test', freshness: 'live', data: null, unavailableReason: reason }
}

export const SYNTHETIC_GENERATED_AT = '2026-10-10T09:00:00.000Z'

export function subject(slug: string, level: 1 | 2 | 3 | 4, evidenceCount = 1, trend: SubjectRecord['trend'] = 'insufficient_data'): SubjectRecord {
  return { subject: slug, latestLevel: level, trend, evidenceCount, latestEvidenceAt: '2026-09-25T09:00:00.000Z' }
}

export function planStep(overrides: Partial<ApprovedPlanStep> = {}): ApprovedPlanStep {
  return {
    id: 'step-1',
    title: 'Fractions recovery plan',
    context: 'current_term',
    reviewDate: '2026-11-15',
    successIndicator: 'Scores at Meeting Expectations on the next fractions check',
    learnerView: { nextGoal: 'Add fractions with different denominators', assignedActivity: 'Complete two fractions practice sets each week', whyItMatters: 'Fractions underpin most of the term’s Mathematics' },
    parentView: { observation: 'Fractions are the area holding Mathematics back right now', whatTheSchoolWillDo: 'Short small-group fractions sessions twice a week', homeSupport: 'Ask to see the fractions practice set each weekend' },
    ...overrides,
  }
}

/**
 * One synthetic Grade 8 learner with a single recorded assessment across two
 * subjects — the "first valid evidence" case. Every optional domain is empty
 * unless a test adds it, so each test states exactly what evidence it relies on.
 */
export function syntheticBlueprint(overrides: Partial<LearnerBlueprint> = {}, className = 'Grade 8 East'): LearnerBlueprint {
  const base: LearnerBlueprint = {
    metadata: {
      blueprintVersion: 'test',
      generatedAt: SYNTHETIC_GENERATED_AT,
      snapshotState: 'current',
      freshness: 'partial',
      evidenceWindow: { start: null, end: SYNTHETIC_GENERATED_AT },
      ownerVersions: {},
      gradeBand: 'unknown',
    },
    identity: available({
      learnerName: 'Amani Synthetic',
      admissionNumber: 'SYN-001',
      schoolName: 'Synthetic Hills School',
      schoolLogoUrl: null,
      currentClassName: className,
      academicYearLabel: '2026',
      termLabel: 'Term 3',
      guardians: [{ fullName: 'Guardian Synthetic', relationship: 'mother' }],
    }),
    academicRecord: available({
      overallTrend: 'insufficient_data',
      bySubject: [subject('mathematics', 2), subject('english', 4)],
      competencies: [],
      confidence: 100,
      lastComputed: SYNTHETIC_GENERATED_AT,
    }),
    attendance: unavailable('Only school admins may read attendance in this sprint.'),
    learningCompass: unavailable('No Compass sessions yet.'),
    career: unavailable('More learning evidence is needed before Career Intelligence can provide reliable guidance.'),
    pathwayReadiness: unavailable('test fixture'),
    portfolio: available({ publishedCount: 0, latestItem: null, featuredItem: null, portfolioUrl: null }),
    achievement: available({ achievementCount: 0, latestVerifiedAchievement: null, highestLevelAchievement: null, profileUrl: null }),
    teacherReflection: unavailable("This learner's teacher has not yet published a reflection."),
    parentSummary: available({ headline: 'Amani Synthetic is still building a fuller evidence picture this term.', detail: '2 subjects currently tracked.', action: null }),
    growthTimeline: unavailable('Growth direction remains provisional until at least two scored evidence points are available.'),
    risk: available({
      overallRiskLevel: 'normal',
      flags: [],
      supportingEvidenceIds: ['synthetic-evidence-1'],
      confidence: 100,
      coverage: { evidenceCount: 2, evidenceDiversity: 1, latestEvidenceAt: '2026-09-25T09:00:00.000Z', oldestEvidenceAt: '2026-09-25T09:00:00.000Z', freshnessDays: 15 },
      lastComputed: SYNTHETIC_GENERATED_AT,
    }),
    learningStory: unavailable('not rendered by the report'),
    recommendedNextSteps: available({ actions: [], plan: [] }),
    ...overrides,
  }

  return {
    ...base,
    metadata: { ...base.metadata, gradeBand: getGradeBand(base.identity.data?.currentClassName ?? null) },
  }
}

/** The same learner with nothing assessed at all — the "no relevant evidence" case. */
export function noEvidenceBlueprint(overrides: Partial<LearnerBlueprint> = {}): LearnerBlueprint {
  return syntheticBlueprint({
    academicRecord: unavailable('There is not yet enough scored evidence to build an academic record.'),
    risk: unavailable('There is not yet enough scored evidence to describe current risk exposure.'),
    parentSummary: unavailable('No source section (Academic Record, Attendance) was available to summarize.'),
    ...overrides,
  })
}
