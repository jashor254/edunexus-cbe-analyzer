// lib/learnerBlueprint/progressReport.test.ts
//
// The Learner Progress Report's four-question builder — pure, synthetic
// fixtures only (lib/testing/progressReportFixture.ts). Lettered tests map to
// the implementation brief's acceptance scenarios.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildProgressReport, questionHeading, PROGRESS_REPORT_SECTIONS, type ProgressReport } from './progressReport'
import {
  available,
  unavailable,
  noEvidenceBlueprint,
  planStep,
  subject,
  syntheticBlueprint,
} from '@/lib/testing/progressReportFixture'

function allText(report: ProgressReport): string {
  return JSON.stringify(report)
}

// ── A · no relevant evidence ────────────────────────────────────────────────

test('A. no assessment recorded: says so plainly, invents no strengths, weaknesses, progress or concern', () => {
  const report = buildProgressReport(noEvidenceBlueprint(), 'parent')

  assert.equal(report.evidence.state, 'none')
  assert.deepEqual(report.whereNow.subjects, [])
  assert.deepEqual(report.goingWell.goingWell, [])
  assert.deepEqual(report.goingWell.needsHelp, [])
  assert.match(report.whereNow.paragraphs.join(' '), /isn’t yet enough recorded evidence/)
  assert.match(report.whereNow.paragraphs.join(' '), /not a judgement about how the learner is doing/)
  assert.match(report.goingWell.paragraphs.join(' '), /no assessment has been recorded/)

  const text = allText(report)
  assert.doesNotMatch(text, /progressing well/i)
  assert.doesNotMatch(text, /No current concern pattern/)
  assert.doesNotMatch(text, /real strength/)
})

// ── F · missing risk data ───────────────────────────────────────────────────

test('F. risk data missing while assessments exist: never reads as "no concern"', () => {
  const report = buildProgressReport(syntheticBlueprint({ risk: unavailable('There is not yet enough scored evidence to describe current risk exposure.') }), 'parent')
  assert.match(report.goingWell.watching.headline, /too early to say/)
  assert.match(report.goingWell.watching.details.join(' '), /not the same as confirmation that all is well/)
  assert.doesNotMatch(allText(report), /No current concern pattern/)
})

test('F. no assessments at all: "what we’re watching" says it cannot be judged, not that nothing is wrong', () => {
  const report = buildProgressReport(noEvidenceBlueprint(), 'teacher')
  assert.match(report.goingWell.watching.headline, /can’t be judged yet/)
  assert.match(report.goingWell.watching.details.join(' '), /says nothing either way/)
})

test('F. risk computed from real evidence with no flags: a calm, qualified "no concern pattern" is allowed', () => {
  const report = buildProgressReport(syntheticBlueprint(), 'parent')
  assert.equal(report.goingWell.watching.headline, 'No current concern pattern is visible in this first snapshot.')
})

// ── B · one valid assessment ────────────────────────────────────────────────

test('B. one assessment is used: real levels in curriculum words, no "no evidence", no trend claimed', () => {
  const report = buildProgressReport(syntheticBlueprint(), 'student')

  assert.equal(report.evidence.state, 'first-snapshot')
  assert.equal(report.evidence.assessmentCount, 1)
  assert.deepEqual(report.whereNow.subjects.map(s => `${s.label}: ${s.levelLabel}`), ['Mathematics: Approaching Expectations', 'English: Exceeding Expectations'])
  assert.match(report.whereNow.paragraphs.join(' '), /early snapshot, based on one assessment/)
  assert.match(report.whereNow.latestEvidenceLine ?? '', /Most recent assessment on record: 25 Sept 2026|Most recent assessment on record: 25 Sep 2026/)
  assert.match(report.goingWell.paragraphs.join(' '), /No reliable trend can be described yet/)
  assert.match(report.goingWell.listCaveat ?? '', /one assessment.*not a fixed judgement/)

  const text = allText(report)
  assert.doesNotMatch(text, /no evidence|insufficient data|no data/i)
  assert.doesNotMatch(text, /steady improvement|consistently|settled pattern/i)
})

test('B. one low score is described as where things stand in that assessment, never as a permanent label', () => {
  const report = buildProgressReport(syntheticBlueprint(), 'parent')
  assert.deepEqual(report.goingWell.needsHelp, [{ levelLabel: 'Approaching Expectations', subjects: ['Mathematics'] }])
  assert.deepEqual(report.goingWell.goingWell, [{ levelLabel: 'Exceeding Expectations', subjects: ['English'] }])
  assert.doesNotMatch(allText(report), /\bweak\b|struggles with|poor at|cannot do/i)
})

// ── C · question-level evidence ─────────────────────────────────────────────

test('C. with only subject-level scores, no misconception, strand or topic weakness is invented', () => {
  // The composed Blueprint carries no question-level responses — so the
  // report must not manufacture any finer-grained diagnosis than a level.
  const text = allText(buildProgressReport(syntheticBlueprint(), 'teacher'))
  assert.doesNotMatch(text, /misconception/i)
  assert.doesNotMatch(text, /\bstrand\b/i)
  assert.doesNotMatch(text, /\btopic\b/i)
})

// ── D · multiple assessments ────────────────────────────────────────────────

test('D. several rounds with a Projection-computed trend: the supported pattern is described', () => {
  const report = buildProgressReport(syntheticBlueprint({
    academicRecord: available({
      overallTrend: 'improving',
      bySubject: [subject('mathematics', 3, 3, 'improving'), subject('english', 4, 3, 'stable')],
      competencies: [], confidence: 90, lastComputed: '2026-10-10T09:00:00.000Z',
    }),
  }), 'parent')
  assert.equal(report.evidence.state, 'well-supported')
  assert.match(report.goingWell.paragraphs.join(' '), /steady improvement/)
})

test('D. two rounds but no computed trend: variation is described without inventing a direction', () => {
  const report = buildProgressReport(syntheticBlueprint({
    academicRecord: available({
      overallTrend: 'insufficient_data',
      bySubject: [subject('mathematics', 2, 2), subject('english', 4, 2)],
      competencies: [], confidence: 90, lastComputed: '2026-10-10T09:00:00.000Z',
    }),
  }), 'parent')
  assert.match(report.goingWell.paragraphs.join(' '), /without yet enough rounds of evidence to call it a settled direction/)
  assert.doesNotMatch(report.goingWell.paragraphs.join(' '), /steady improvement|closer attention/)
})

test('D/E. a mixed trend is named as mixed, never averaged into one direction', () => {
  const report = buildProgressReport(syntheticBlueprint({
    academicRecord: available({
      overallTrend: 'mixed',
      bySubject: [subject('mathematics', 2, 3, 'declining'), subject('english', 4, 3, 'improving')],
      competencies: [], confidence: 90, lastComputed: '2026-10-10T09:00:00.000Z',
    }),
  }), 'parent')
  assert.match(report.goingWell.paragraphs.join(' '), /current pattern is mixed/)
})

// ── G · missing teacher actions ─────────────────────────────────────────────

test('G. no plan, no reflection, no Compass: no commitment is invented — every role shows an honest unset state', () => {
  const report = buildProgressReport(syntheticBlueprint(), 'parent')
  assert.equal(report.nextSteps.priority, null)
  assert.match(report.nextSteps.priorityEmpty, /No specific next step has been set yet/)
  for (const role of report.nextSteps.roles) {
    assert.equal(role.text, null, `${role.role} must not be filled without a source`)
    assert.ok(role.emptyText.length > 0)
  }
  assert.equal(report.agreement.proposedLearnerStep, null)
  assert.equal(report.agreement.proposedTeacherSupport, null)
  assert.equal(report.agreement.proposedHomeSupport, null)
})

// ── H · teacher-approved action outranks Compass ────────────────────────────

const WITH_COMPASS = available({
  currentLearningFocus: { subject: 'english', subtopic: null },
  nextRecommendedAction: 'Continue with english',
  holidayProgrammeAvailable: false,
  learningReadiness: null,
  notes: [],
})

test('H. a valid teacher-approved step takes precedence over a different Compass suggestion, which is kept as a supplement', () => {
  const report = buildProgressReport(syntheticBlueprint({
    learningCompass: WITH_COMPASS,
    recommendedNextSteps: available({ actions: [], plan: [planStep()] }),
  }), 'parent')

  assert.equal(report.nextSteps.priority?.text, 'Fractions recovery plan')
  assert.match(report.nextSteps.priority?.sourceLabel ?? '', /plan approved by Amani's teacher/)
  assert.match(report.nextSteps.priority?.reviewNote ?? '', /To be reviewed by 15 Nov 2026/)
  assert.ok(report.nextSteps.followOns.some(f => /Learning Compass also suggests/.test(f.detail)))

  const roles = Object.fromEntries(report.nextSteps.roles.map(r => [r.role, r]))
  assert.equal(roles.teacher.text, 'Short small-group fractions sessions twice a week')
  assert.equal(roles.home.text, 'Ask to see the fractions practice set each weekend')
})

test('H. without an approved step, Compass leads and is labelled as a suggestion, not an agreement', () => {
  const report = buildProgressReport(syntheticBlueprint({ learningCompass: WITH_COMPASS }), 'parent')
  assert.match(report.nextSteps.priority?.text ?? '', /English learning focus/)
  assert.equal(report.nextSteps.priority?.sourceLabel, 'Suggested by Learning Compass')
})

test('H. a step past its review date is not presented as current: it ranks after a current step, and says it was due for review', () => {
  const overdue = planStep({ id: 'old', title: 'Old reading plan', reviewDate: '2026-08-01' })
  const current = planStep({ id: 'new', title: 'Fractions recovery plan', reviewDate: '2026-11-15' })
  const ranked = buildProgressReport(syntheticBlueprint({ recommendedNextSteps: available({ actions: [], plan: [overdue, current] }) }), 'teacher')
  assert.equal(ranked.nextSteps.priority?.text, 'Fractions recovery plan')

  const onlyOverdue = buildProgressReport(syntheticBlueprint({ recommendedNextSteps: available({ actions: [], plan: [overdue] }) }), 'teacher')
  assert.match(onlyOverdue.nextSteps.priority?.reviewNote ?? '', /was due for review on 1 Aug 2026/)
})

// ── P · audience boundaries ─────────────────────────────────────────────────

test('P. each audience sees only its own projection of a plan step', () => {
  const learnerOnly = planStep({ id: 'l', title: 'Learner-only step', parentView: null })
  const parentOnly = planStep({ id: 'p', title: 'Parent-only step', learnerView: null })
  const blueprint = syntheticBlueprint({ recommendedNextSteps: available({ actions: [], plan: [learnerOnly, parentOnly] }) })

  const learner = allText(buildProgressReport(blueprint, 'student'))
  assert.match(learner, /Learner-only step/)
  assert.doesNotMatch(learner, /Parent-only step/)
  assert.doesNotMatch(learner, /Ask to see the fractions practice set/, 'home support is a parent-visible field')
  assert.doesNotMatch(learner, /Short small-group fractions sessions/, 'teacher_action is a parent-visible field')

  // A learner whose only approved step is parent-visible sees no step at all.
  const parentOnlyPlan = syntheticBlueprint({ recommendedNextSteps: available({ actions: [], plan: [parentOnly] }) })
  const learnerWithParentOnly = buildProgressReport(parentOnlyPlan, 'student')
  assert.equal(learnerWithParentOnly.nextSteps.priority, null)
  assert.doesNotMatch(allText(learnerWithParentOnly), /Parent-only step|Fractions are the area holding/)

  // …and a parent whose only approved step is learner-visible sees none either.
  const learnerOnlyPlan = syntheticBlueprint({ recommendedNextSteps: available({ actions: [], plan: [learnerOnly] }) })
  assert.equal(buildProgressReport(learnerOnlyPlan, 'parent').nextSteps.priority, null)

  const parent = allText(buildProgressReport(blueprint, 'parent'))
  assert.match(parent, /Parent-only step/)
  assert.doesNotMatch(parent, /Learner-only step/)
  assert.doesNotMatch(parent, /Complete two fractions practice sets/, 'the assigned activity is a learner-visible field')
})

test('P. parent-addressed Parent Action Centre copy is shown to the parent only', () => {
  const blueprint = syntheticBlueprint({
    recommendedNextSteps: available({
      actions: [{
        title: 'Continue Holiday Learning',
        description: 'A holiday learning programme is available for your child — a good way to keep momentum between terms.',
        actionType: 'continue_holiday_learning', priority: 'important', sourceDomain: 'Learning Compass',
        destination: '/child/learner-1/full', available: true, reasonUnavailable: null, generatedAt: '2026-10-10T09:00:00.000Z',
      }],
      plan: [],
    }),
  })
  assert.match(allText(buildProgressReport(blueprint, 'parent')), /holiday learning programme is available for your child/)
  assert.doesNotMatch(allText(buildProgressReport(blueprint, 'student')), /for your child/)
  assert.doesNotMatch(allText(buildProgressReport(blueprint, 'teacher')), /for your child/)
})

// ── One coherent account across audiences ──────────────────────────────────

test('learner, parent and teacher get the same subjects, levels, strengths, needs and priority — only the voice differs', () => {
  const blueprint = syntheticBlueprint({ learningCompass: WITH_COMPASS, recommendedNextSteps: available({ actions: [], plan: [planStep()] }) })
  const [learner, parent, teacher] = (['student', 'parent', 'teacher'] as const).map(v => buildProgressReport(blueprint, v))

  for (const other of [parent, teacher]) {
    assert.deepEqual(other.whereNow.subjects, learner.whereNow.subjects)
    assert.deepEqual(other.goingWell.goingWell, learner.goingWell.goingWell)
    assert.deepEqual(other.goingWell.needsHelp, learner.goingWell.needsHelp)
    assert.equal(other.nextSteps.priority?.text, learner.nextSteps.priority?.text)
    assert.deepEqual(other.goingWell.watching, learner.goingWell.watching)
  }
  assert.notEqual(learner.whereNow.intro, parent.whereNow.intro)
  assert.match(learner.nextSteps.roles[0].label, /Your next step/)
})

// ── I · Junior School ───────────────────────────────────────────────────────

const JUNIOR_CAREER = available({
  careerCluster: 'Health Sciences',
  strengthProfile: 'Current evidence suggests an emerging alignment with Health Sciences.',
  futureDirection: 'Explore this field through clubs.',
  aiOutlook: null, confidence: 'Medium' as const, doorsPreview: null, aiChangeSummary: null,
  humanAdvantageSummary: null, explorationSuggestions: null, knowledge: null,
  notes: ['AI Outlook has no canonical cluster-level source yet — left null, not guessed.'],
})

for (const className of ['Grade 7', 'Grade 8 East', 'Grade 9 West']) {
  test(`I. ${className}: no career field is named anywhere, and Q4 stays useful (pathway-first)`, () => {
    const blueprint = syntheticBlueprint({
      career: JUNIOR_CAREER,
      recommendedNextSteps: available({
        actions: [{
          title: 'Explore Senior School Pathways', description: 'Look at the Senior School pathways together.',
          actionType: 'explore_career_journey', priority: 'suggested', sourceDomain: 'Career Intelligence',
          destination: '/career-intelligence', available: true, reasonUnavailable: null, generatedAt: '2026-10-10T09:00:00.000Z',
        }],
        plan: [],
      }),
    }, className)
    for (const viewer of ['student', 'parent', 'teacher'] as const) {
      const report = buildProgressReport(blueprint, viewer)
      assert.doesNotMatch(allText(report), /Health Sciences/, `${className}/${viewer}`)
      assert.equal(report.leading.doors.length, 0)
      assert.equal(report.leading.aiChange, null)
      assert.match(report.leading.direction.join(' '), /English/)
      assert.match(report.leading.direction.join(' '), /early signal, not a choice/)
      assert.ok(!report.nextSteps.followOns.some(f => f.title === 'Career exploration'))
    }
  })
}

test('I. an unknown grade is treated junior-safe: no career field, no invented pathway deadline', () => {
  const report = buildProgressReport(syntheticBlueprint({ career: JUNIOR_CAREER }, 'Stream B'), 'parent')
  assert.doesNotMatch(allText(report), /Health Sciences/)
  assert.doesNotMatch(report.leading.direction.join(' '), /chosen at the end/)
})

// ── J · Senior School ───────────────────────────────────────────────────────

test('J. a senior learner sees the existing, evidence-grounded direction — framed as a direction, not a decision', () => {
  const report = buildProgressReport(syntheticBlueprint({ career: { ...JUNIOR_CAREER, data: { ...JUNIOR_CAREER.data!, careerCluster: 'Engineering' } } }, 'Grade 11'), 'parent')
  assert.match(report.leading.direction.join(' '), /record points toward Engineering/)
  assert.match(report.leading.direction.join(' '), /rather than a decision that has been made for them/)
})

test('J. a senior learner with no career evidence gets an honest empty direction, nothing invented', () => {
  const report = buildProgressReport(syntheticBlueprint({}, 'Grade 11'), 'parent')
  assert.match(report.leading.direction.join(' '), /doesn’t yet point clearly in one direction/)
  assert.equal(report.leading.doors.length, 0)
})

// ── R · empty optional sections ─────────────────────────────────────────────

test('R. empty optional sections produce no placeholders, no fabricated content, no success message', () => {
  const report = buildProgressReport(noEvidenceBlueprint(), 'parent')
  assert.deepEqual(report.leading.futureEvidence, [])
  assert.deepEqual(report.goingWell.movement, [])
  assert.equal(report.goingWell.teacher, null)
  assert.match(report.nextSteps.followOnsEmpty, /Nothing further is suggested yet/)
  assert.doesNotMatch(allText(report), /\bN\/A\b|undefined|null,?\s*$/)
})

// ── M · historical payloads ─────────────────────────────────────────────────

test('M. a snapshot stored before `plan` and `pathwayReadiness` existed still builds, unchanged in meaning', () => {
  const old = syntheticBlueprint()
  const legacyPayload = {
    ...old,
    recommendedNextSteps: available({ actions: [] }),
    pathwayReadiness: undefined,
    metadata: { ...old.metadata, gradeBand: undefined },
  } as unknown as typeof old
  const report = buildProgressReport(legacyPayload, 'parent')
  assert.equal(report.nextSteps.priority, null)
  assert.equal(report.leading.pathwayReadiness, null)
  assert.equal(report.gradeBand, 'grade_7_8', 'band falls back to the stored class name')
})

test('M. "now" is the payload’s own generatedAt — an old snapshot is not re-judged against today', () => {
  const blueprint = syntheticBlueprint({ recommendedNextSteps: available({ actions: [], plan: [planStep({ reviewDate: '2026-11-15' })] }) })
  // Generated well before the review date — not overdue, whatever today is.
  const report = buildProgressReport({ ...blueprint, metadata: { ...blueprint.metadata, generatedAt: '2026-09-01T09:00:00.000Z' } }, 'teacher')
  assert.match(report.nextSteps.priority?.reviewNote ?? '', /To be reviewed by/)
})

// ── O · headings ────────────────────────────────────────────────────────────

test('O. every question has an English heading and the sw-KE working wording, and the PDF section ids are stable', () => {
  assert.deepEqual(questionHeading('where-now'), { en: 'Where are we now?', sw: 'Tuko wapi kwa sasa?' })
  assert.deepEqual(questionHeading('going-well'), { en: 'What\'s going well, and what needs help?', sw: 'Ni mambo gani yanaendelea vizuri, na ni yapi yanahitaji msaada?' })
  assert.deepEqual(questionHeading('next-steps'), { en: 'What do we do next?', sw: 'Hatua zinazofuata ni zipi?' })
  assert.deepEqual(questionHeading('leading'), { en: 'Where is this leading?', sw: 'Hii inaelekea wapi?' })
  assert.deepEqual([...PROGRESS_REPORT_SECTIONS], ['where-now', 'going-well', 'next-steps', 'leading', 'agreement'])
})
