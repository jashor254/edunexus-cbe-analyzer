import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import BlueprintView from './BlueprintView'
import type { LearnerBlueprint } from '@/lib/learnerBlueprint/types'
import { getGradeBand } from '@/lib/learnerBlueprint/gradeBand'

function section<T>(data: T) {
  return { status: 'available' as const, owner: 'test', freshness: 'live' as const, data }
}

function unavailable<T>(reason: string) {
  return { status: 'unavailable' as const, owner: 'test', freshness: 'live' as const, data: null, unavailableReason: reason }
}

// Rich, multi-round fixture — the "well-supported" evidence case.
//
// `metadata.gradeBand` is derived from whichever identity ends up on the
// fixture, exactly as composeBlueprint() derives it from Identity's own class
// name. A test that overrides identity to change the learner's grade therefore
// gets the matching band for free, and can never accidentally assert
// senior-stage copy against a junior band.
function createBlueprint(overrides: Partial<LearnerBlueprint> = {}): LearnerBlueprint {
  const base: LearnerBlueprint = {
    metadata: {
      blueprintVersion: 'test',
      generatedAt: '2026-07-23T10:00:00.000Z',
      snapshotState: 'current',
      freshness: 'partial',
      evidenceWindow: { start: null, end: '2026-07-23T10:00:00.000Z' },
      ownerVersions: {},
      gradeBand: 'unknown',
    },
    identity: section({
      learnerName: 'Brian Matthias',
      admissionNumber: 'ADM-1',
      schoolName: 'Test School',
      schoolLogoUrl: null,
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
        { subject: 'English', latestLevel: 3, trend: 'improving', evidenceCount: 2, latestEvidenceAt: '2026-07-01T00:00:00Z' },
        { subject: 'Mathematics', latestLevel: 2, trend: 'declining', evidenceCount: 3, latestEvidenceAt: '2026-06-15T00:00:00Z' },
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
      doorsPreview: [
        { type: 'employment', summary: 'Work in engineering or design teams across manufacturing, construction, or product development.' },
        { type: 'self_employment', summary: 'Offer design or technical consulting services directly to small businesses.' },
        { type: 'entrepreneurship', summary: 'Build a product or workshop business around a specific technical niche.' },
        { type: 'ai_era', summary: 'Use AI-assisted design tools to prototype and iterate far faster than before.' },
      ],
      aiChangeSummary: 'Routine drafting and repetitive calculations are increasingly automated, but the bar for original design thinking has risen, not fallen.',
      humanAdvantageSummary: 'Judgement under real-world constraints, client trust and creative problem-solving remain valuable — the kind of judgment only a person can offer.',
      explorationSuggestions: ['Mathematics', 'Design And Technology'],
      knowledge: null,
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

  return {
    ...base,
    metadata: { ...base.metadata, gradeBand: getGradeBand(base.identity.data?.currentClassName ?? null) },
  }
}

// Kevin Otieno — a real composed Blueprint from a single Opener Term 3
// assessment (Mwatate Ridge Senior School reference school, seeded live
// during the redesign session). This is the primary thin-evidence test
// case the four-page redesign brief specified: one genuine assessment,
// trend "insufficient_data" on every subject, academicRecord.confidence
// and risk.confidence both 100, career.confidence "Low" — exactly the
// combination the interpretation-discipline rules exist to handle.
function createKevinBlueprint(overrides: Partial<LearnerBlueprint> = {}): LearnerBlueprint {
  return createBlueprint({
    identity: section({
      learnerName: 'Kevin Otieno',
      admissionNumber: 'MRSS-G10-1785317634545',
      schoolName: 'Mwatate Ridge Senior School',
      schoolLogoUrl: null,
      currentClassName: 'Grade 10 East',
      academicYearLabel: '2026',
      termLabel: 'Term 2 2026',
      guardians: [],
    }),
    academicRecord: section({
      overallTrend: 'insufficient_data',
      bySubject: [
        { subject: 'biology', latestLevel: 4, trend: 'insufficient_data', evidenceCount: 1, latestEvidenceAt: '2026-07-29T09:34:02.453Z' },
        { subject: 'chemistry', latestLevel: 3, trend: 'insufficient_data', evidenceCount: 1, latestEvidenceAt: '2026-07-29T09:34:02.453Z' },
        { subject: 'kiswahili_fasihi', latestLevel: 3, trend: 'insufficient_data', evidenceCount: 1, latestEvidenceAt: '2026-07-29T09:34:02.453Z' },
        { subject: 'kiswahili_lugha', latestLevel: 4, trend: 'insufficient_data', evidenceCount: 1, latestEvidenceAt: '2026-07-29T09:34:02.453Z' },
        { subject: 'mathematics', latestLevel: 3, trend: 'insufficient_data', evidenceCount: 1, latestEvidenceAt: '2026-07-29T09:34:02.453Z' },
        { subject: 'physics', latestLevel: 3, trend: 'insufficient_data', evidenceCount: 1, latestEvidenceAt: '2026-07-29T09:34:02.453Z' },
      ],
      competencies: [],
      confidence: 100,
      lastComputed: '2026-07-29T09:34:14.813Z',
    }),
    attendance: unavailable("Only school admins may read a learner's full attendance history in this sprint."),
    learningCompass: section({
      currentLearningFocus: { subject: 'mathematics', subtopic: null },
      nextRecommendedAction: 'Continue with mathematics',
      holidayProgrammeAvailable: false,
      learningReadiness: null,
      notes: [],
    }),
    career: section({
      careerCluster: 'Finance',
      strengthProfile: 'Current evidence suggests Accountant / Financial Analyst is within reach with focused development. The main gap is Communication.',
      futureDirection: 'Focus on communication — one more step of consistent progress will close this gap.',
      aiOutlook: null,
      confidence: 'Low',
      // Real doors/AI-impact data for the matched career (Accountant / Financial
      // Analyst), pulled during this feature's implementation — the door
      // summaries never mention that job title, only the generic activity.
      doorsPreview: [
        { type: 'employment', summary: 'Work in finance departments across industries — banking, manufacturing, NGOs, government, tech.' },
        { type: 'self_employment', summary: 'Provide bookkeeping, tax filing, audit, and financial advisory services to SMEs.' },
        { type: 'entrepreneurship', summary: 'Build a financial technology or advisory business.' },
        { type: 'ai_era', summary: 'Use AI tools to analyze financial data, build models faster, and provide strategic advisory that previously required a team.' },
      ],
      // Matches the real, live output of getCareerBlueprintSummary()'s
      // consolidated derivation (lib/learnerIntelligence/careerIntelligence.ts)
      // — built only from ai_impact.replacing/human_advantage, never
      // honest_summary verbatim, so it never contains "low-skill" or
      // "cannot replace" regardless of what that career's own free-text
      // honest_summary field says.
      aiChangeSummary: 'AI and similar tools are automating manual ledger bookkeeping and bank reconciliation by hand. The field is not disappearing, but the bar is rising: complex tax planning requiring judgment, audit work requiring professional skepticism and forensic accounting investigations continue to depend heavily on human judgement.',
      humanAdvantageSummary: null,
      explorationSuggestions: ['Mathematics', 'English', 'Business Studies', 'Economics'],
      knowledge: null,
      notes: [],
    }),
    portfolio: section({ publishedCount: 0, latestItem: null, featuredItem: null, portfolioUrl: null }),
    achievement: section({ achievementCount: 0, latestVerifiedAchievement: null, highestLevelAchievement: null, profileUrl: null }),
    teacherReflection: unavailable("This learner's teacher has not yet published a reflection."),
    parentSummary: section({ headline: 'Kevin Otieno is still building a fuller evidence picture this term.', detail: '6 subjects currently tracked.', action: null }),
    growthTimeline: unavailable('Growth direction remains provisional until at least two scored evidence points are available.'),
    risk: section({
      overallRiskLevel: 'normal',
      flags: [],
      supportingEvidenceIds: ['e181c261-5b19-4c29-9e27-3b0856c5998a'],
      confidence: 100,
      coverage: { evidenceCount: 6, evidenceDiversity: 1, latestEvidenceAt: '2026-07-29T09:34:02.453Z', oldestEvidenceAt: '2026-07-29T09:34:02.453Z', freshnessDays: 0 },
      lastComputed: '2026-07-29T09:34:14.813Z',
    }),
    recommendedNextSteps: section({
      actions: [{
        title: 'Explore Career Journey',
        description: 'Your child is showing interest in Finance — explore this together.',
        actionType: 'explore_career_journey',
        priority: 'suggested',
        sourceDomain: 'Career Intelligence',
        destination: '/career-intelligence',
        available: true,
        reasonUnavailable: null,
        generatedAt: '2026-07-29T09:34:16.767Z',
      }],
    }),
    ...overrides,
  })
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

const PAGE_TITLES = [
  'Where We Stand Today',
  'What the Evidence Suggests',
  'How We Help Next',
  'What May Be Emerging',
]

const BANNED_PHRASES = [
  /no data/i,
  /insufficient data/i,
  /\bunavailable\b/i,
  /\bN\/A\b/,
  /high.confidence/i,
  /\bowner:/i,
  /\bfreshness:/i,
  /\bADR-\d/,
  /\blib\//,
  /composeBlueprint/i,
]

test('BlueprintView renders exactly four report pages, in order', () => {
  const html = render(createBlueprint())

  const pageShellCount = (html.match(/data-blueprint-page-shell="true"/g) ?? []).length
  assert.equal(pageShellCount, 4)

  let cursor = -1
  for (const title of PAGE_TITLES) {
    const index = html.indexOf(title)
    assert.ok(index > cursor, `${title} should appear, in order, after the previous page`)
    cursor = index
  }

  assert.match(html, /Learner Blueprint/)
})

test('Kevin (one assessment, trend insufficient_data): never says no data / insufficient data / unavailable / high-confidence, anywhere in the document', () => {
  const html = render(createKevinBlueprint())

  for (const phrase of BANNED_PHRASES) {
    assert.doesNotMatch(html, phrase, `banned phrase ${phrase} should not appear anywhere in the rendered document`)
  }
})

test('Kevin: Page 1 opens with an honest, human snapshot — strengths named, single-assessment maturity stated in prose', () => {
  const html = render(createKevinBlueprint())

  assert.match(html, /real strength in Biology and Kiswahili Lugha/)
  assert.match(html, /Exceeding Expectations/)
  assert.match(html, /Meeting Expectations/)
  assert.match(html, /early snapshot, based on one assessment across 6 subjects/)
  assert.match(html, /Future assessments will show how this picture changes over time/)
  assert.match(html, /active learning focus is.*Mathematics/)
})

test('An all-caps legacy name ("TUCYLA NYAWIRA") is displayed and used in prose as proper case, never shouting — a real mixed-case name is left untouched', () => {
  const allCaps = render(createKevinBlueprint({
    identity: section({
      learnerName: 'TUCYLA NYAWIRA', admissionNumber: 'X', schoolName: 'Test School', schoolLogoUrl: null,
      currentClassName: 'Grade 9', academicYearLabel: '2026', termLabel: 'Term 2', guardians: [],
    }),
  }))
  assert.match(allCaps, />Tucyla Nyawira</, 'masthead should show proper case')
  assert.match(allCaps, /Tucyla.+current picture shows real strength/)
  assert.doesNotMatch(allCaps, /TUCYLA/)

  const mixedCase = render(createKevinBlueprint())
  assert.match(mixedCase, /Kevin.+current picture shows real strength/, 'a real mixed-case name must be left exactly as-is')
})

test('Irregular CBC subject labels render correctly — "CRE" stays an acronym, "Agriculture & Nutrition" keeps its conjunction, "Pre-Technical Studies" and "Creative Arts & Sports" match curriculum naming', () => {
  const html = render(createKevinBlueprint({
    academicRecord: section({
      overallTrend: 'insufficient_data',
      bySubject: [
        { subject: 'cre', latestLevel: 3, trend: 'insufficient_data', evidenceCount: 1, latestEvidenceAt: '2026-07-29T00:00:00Z' },
        { subject: 'agriculture_nutrition', latestLevel: 3, trend: 'insufficient_data', evidenceCount: 1, latestEvidenceAt: '2026-07-29T00:00:00Z' },
        { subject: 'pre_technical_studies', latestLevel: 3, trend: 'insufficient_data', evidenceCount: 1, latestEvidenceAt: '2026-07-29T00:00:00Z' },
        { subject: 'creative_arts_sports', latestLevel: 4, trend: 'insufficient_data', evidenceCount: 1, latestEvidenceAt: '2026-07-29T00:00:00Z' },
      ],
      competencies: [], confidence: 100, lastComputed: '2026-07-29T00:00:00Z',
    }),
  }))
  assert.match(html, />CRE</)
  assert.doesNotMatch(html, />Cre</)
  assert.match(html, /Agriculture &amp; Nutrition/)
  assert.match(html, /Pre-Technical Studies/)
  assert.match(html, /Creative Arts &amp; Sports/)
})

test('Kevin: Level 3 subjects are described as secure, never as a deficit relative to Level 4', () => {
  const html = render(createKevinBlueprint())
  assert.doesNotMatch(html, /weak/i)
  assert.doesNotMatch(html, /deficien/i)
  // The lower-reading subjects are framed as where effort pays off, not as a
  // shortfall. This used to assert the exact phrase "stay just as real and
  // capable", which sat in the same sentence as "never a gap to worry about" —
  // a reassurance the Blueprint cannot honestly give a Grade 9 facing a gated
  // placement. Assert the intent (no deficit framing, effort framed positively)
  // rather than one sentence's wording, so the copy can improve without the
  // guarantee weakening.
  assert.match(html, /where focused effort would show the clearest return/)
  assert.doesNotMatch(html, /never a gap to worry about/)
})

test('Kevin: Page 2 never claims a stable trend or "developing unevenly" from one assessment', () => {
  const html = render(createKevinBlueprint())
  assert.match(html, /first assessment shows some variation across subjects/)
  assert.doesNotMatch(html, /developing unevenly/)
  assert.match(html, /No reliable trend can be described yet/)
})

test('Kevin: risk is framed as "no current concern pattern", never exposes confidence, coverage, or evidence IDs', () => {
  const html = render(createKevinBlueprint())
  assert.match(html, /No current concern pattern is visible in this first snapshot\./)
  assert.doesNotMatch(html, /e181c261-5b19-4c29-9e27-3b0856c5998a/)
  assert.doesNotMatch(html, /100%/)
  assert.doesNotMatch(html, /coverage/i)
})

test('Kevin: as a placed senior learner, career is framed as a grounded direction in one compact sentence, never a settled recommendation — "within reach" and "main gap" language is not repeated verbatim', () => {
  const html = render(createKevinBlueprint())
  // Kevin is Grade 10 — already placed. Senior framing, not an "early signal".
  assert.match(html, /record points toward Finance/)
  assert.match(html, /grounded in the subjects and evidence already on file/)
  assert.doesNotMatch(html, /is within reach/)
  assert.doesNotMatch(html, /main gap/i)
})

test('Kevin: no specific occupation title ever appears on Page 4, even though the underlying career data contains one', () => {
  const html = render(createKevinBlueprint())
  assert.doesNotMatch(html, /Accountant/i)
  assert.doesNotMatch(html, /Financial Analyst/i)
  assert.doesNotMatch(html, /Finance Manager/i)
  assert.match(html, /\bFinance\b/, 'the cluster label itself must still appear — only the specific job title is hidden')
})

test('Kevin: the four real doors render as one generic-activity sentence each, under their plain labels, never the door’s own job-title-flavored heading', () => {
  const html = render(createKevinBlueprint())
  assert.match(html, /Four ways this could open after school/)
  assert.match(html, />Employment</)
  assert.match(html, />Self-employment</)
  assert.match(html, />Entrepreneurship</)
  assert.match(html, />AI-augmented work</)
  assert.match(html, /Work in finance departments across industries/)
  assert.doesNotMatch(html, /Accountant \/ Finance Manager/) // the door's own `title` field, never rendered
})

test('Kevin: AI-change is one consolidated paragraph, never raw level/replacing/creating/timeline data, never "low-skill" or "AI cannot replace" wording, and the human-advantage claim appears only once', () => {
  const html = render(createKevinBlueprint())
  assert.match(html, /How this field is changing/)
  assert.match(html, /bar is rising/)
  assert.match(html, /complex tax planning requiring judgment/)
  assert.doesNotMatch(html, /"level"|"replacing"|"creating"|"timeline"/)
  assert.doesNotMatch(html, /low-skill/i)
  assert.doesNotMatch(html, /AI cannot replace/i)
  assert.equal((html.match(/complex tax planning requiring judgment/g) ?? []).length, 1, 'the human-advantage claim must not be duplicated as a second paragraph')
})

test('Kevin: exploration suggestions come from the career’s real required subjects, and the deeper-journey link reuses the existing recommendedNextSteps destination', () => {
  const html = render(createKevinBlueprint())
  assert.match(html, /Worth exploring next: Mathematics, English, Business Studies and Economics\./)
  assert.match(html, /href="\/career-intelligence"/)
  // Public Document Identity audit (2026-08-03) — "Career Intelligence" is
  // internal architecture vocabulary; the reader-facing link text must
  // describe the destination instead.
  assert.match(html, /Explore career pathways and next steps/)
  assert.doesNotMatch(html, /Career Intelligence journey/i)
})

test('Junior/exploration-mode learner: doorsPreview is null by design — no four-door grid, no AI-change box, cluster-only framing, never a crash', () => {
  const html = render(createKevinBlueprint({
    identity: section({
      learnerName: 'Amina Wafula', admissionNumber: 'X', schoolName: 'Test School', schoolLogoUrl: null,
      currentClassName: 'Grade 8', academicYearLabel: '2026', termLabel: 'Term 2', guardians: [],
    }),
    career: section({
      careerCluster: 'Engineering & Technology',
      strengthProfile: 'Current evidence suggests an emerging capability alignment with Engineering & Technology.',
      futureDirection: 'Explore this field through subjects, clubs, or projects related to: Software Developer, Civil Engineer, Electrician.',
      aiOutlook: null,
      confidence: 'Medium',
      doorsPreview: null,
      aiChangeSummary: null,
      humanAdvantageSummary: null,
      explorationSuggestions: null,
      knowledge: null,
      notes: [],
    }),
  }))

  assert.match(html, /current record suggests Engineering &amp; Technology as one direction worth exploring/)
  assert.doesNotMatch(html, /Four ways this could open after school/)
  assert.doesNotMatch(html, /How this field is changing/)
  assert.doesNotMatch(html, /Worth exploring next/)
  assert.doesNotMatch(html, /Software Developer/) // the specific example titles inside futureDirection are never rendered on Page 4 either
})

test('No canonical career match at all: empty-state fallback sentence, never an empty four-door grid', () => {
  const html = render(createKevinBlueprint({
    career: unavailable('More learning evidence is needed before Career Intelligence can provide reliable guidance.'),
  }))

  assert.match(html, /doesn’t yet point clearly in one direction/)
  assert.doesNotMatch(html, /Four ways this could open after school/)
})

test('A career with a low AI-impact level and doors that differ from Finance renders generically — nothing hardcoded to Finance leaks through', () => {
  const html = render(createKevinBlueprint({
    career: section({
      careerCluster: 'Education',
      strengthProfile: 'x', futureDirection: 'x', aiOutlook: null, confidence: 'Medium',
      doorsPreview: [
        { type: 'employment', summary: 'Teach in public or private schools, from primary through university level.' },
        { type: 'self_employment', summary: 'Offer private tutoring or exam-preparation coaching directly to families.' },
        { type: 'entrepreneurship', summary: 'Build an education content business, tutoring centre, or online course.' },
        { type: 'ai_era', summary: 'Use AI tutoring tools to personalise learning for many students at once.' },
      ],
      aiChangeSummary: 'AI tutoring tools are automating basic drill and practice, but mentorship, motivation, and classroom management remain deeply human.',
      humanAdvantageSummary: 'Building trust with learners, reading the room, and adapting to a real classroom remain valuable — the kind of judgment only a person can offer.',
      explorationSuggestions: ['English', 'Education'],
      knowledge: null,
      notes: [],
    }),
  }))

  assert.match(html, /Teach in public or private schools/)
  assert.match(html, /mentorship, motivation, and classroom management remain deeply human/)
  assert.doesNotMatch(html, /Work in finance departments/)
  assert.doesNotMatch(html, /\bFinance\b/)
})

test('Kevin: the priority action is Mathematics learning support, not "Explore Career Journey" — career is present but demoted to a secondary, non-binding step', () => {
  const html = render(createKevinBlueprint())

  const priorityIndex = html.indexOf('The one thing that matters most right now')
  const mathIndex = html.indexOf('Mathematics learning focus with targeted practice and feedback')
  const careerIndex = html.indexOf('Career exploration')

  assert.ok(priorityIndex > -1 && mathIndex > -1 && careerIndex > -1)
  assert.ok(mathIndex > priorityIndex && mathIndex < careerIndex, 'Mathematics must be the priority action, appearing before the career follow-on')
  assert.match(html, /one early, non-binding signal among many/)
})

test('Kevin: empty future-evidence categories (Portfolio/Achievement/Projects/Competitions/Leadership/Innovation) render no empty cards — the closing line covers it once, in the page transition, not as a third paragraph', () => {
  const html = render(createKevinBlueprint())
  assert.match(html, /As Kevin builds a record in the subjects being taken now, what comes after school will come into sharper focus\./)
  assert.doesNotMatch(html, /Portfolio<\/p>/)
  // The closing idea belongs in the page transition and nowhere else. Kevin is
  // senior, so the phrase to count is his stage's closing line, not the junior
  // "will become clearer" wording.
  assert.equal((html.match(/come into sharper focus/g) ?? []).length, 1, 'the closing idea must appear exactly once, not duplicated as a third paragraph')
})

test('BlueprintView (rich fixture): with real future evidence present, Page 4 closes with the generic growth line, not the redundant "wider strengths" line', () => {
  const html = render(createBlueprint())
  assert.match(html, /This picture will keep growing — new evidence will sharpen and expand it over time\./)
  assert.doesNotMatch(html, /wider strengths behind it/)
})

test('BlueprintView (rich fixture) keeps normal risk calm rather than alarming', () => {
  const html = render(createBlueprint({
    risk: section({
      overallRiskLevel: 'normal',
      flags: [],
      supportingEvidenceIds: [],
      confidence: 62,
      coverage: { evidenceCount: 1, evidenceDiversity: 1, latestEvidenceAt: '2026-07-10T00:00:00.000Z', oldestEvidenceAt: '2026-07-10T00:00:00.000Z', freshnessDays: 13 },
      lastComputed: '2026-07-23T10:00:00.000Z',
    }),
  }))

  assert.match(html, /No current concern pattern is visible/)
  assert.doesNotMatch(html, /Needs Urgent Support/)
})

test('BlueprintView (rich fixture) names the watched subject when a risk flag is present, without exposing severity or evidence IDs', () => {
  const html = render(createBlueprint())
  assert.match(html, /Mathematics — Approaching Expectation in Mathematics but declining from prior evidence/)
  assert.doesNotMatch(html, /\bwatch\b/i)
  assert.doesNotMatch(html, /"e1"|'e1'|>e1</)
})

test('BlueprintView dedupes repeated recommendations across the action list', () => {
  const html = render(createBlueprint({
    learningCompass: unavailable('No current learning focus yet.'),
    recommendedNextSteps: section({
      actions: [{
        title: 'Continue Holiday Learning',
        description: 'Keep Mathematics support short, regular, and closely monitored.',
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

  assert.equal((html.match(/Keep Mathematics support short, regular, and closely monitored\./g) ?? []).length, 1)
})

test('BlueprintView changes future framing by grade band and stays honest when future evidence is thin', () => {
  const grade78 = render(createBlueprint({
    identity: section({
      learnerName: 'Brian Matthias', admissionNumber: 'ADM-1', schoolName: 'Test School', schoolLogoUrl: null,
      currentClassName: 'Grade 8', academicYearLabel: '2026', termLabel: 'Term 2', guardians: [],
    }),
  }))
  assert.match(grade78, /still early to narrow things down/)

  const grade9 = render(createBlueprint({
    identity: section({
      learnerName: 'Brian Matthias', admissionNumber: 'ADM-1', schoolName: 'Test School', schoolLogoUrl: null,
      currentClassName: 'Grade 9', academicYearLabel: '2026', termLabel: 'Term 2', guardians: [],
    }),
  }))
  assert.match(grade9, /the year the senior school decision is made/)

  const senior = render(createKevinBlueprint({
    identity: section({
      learnerName: 'Kevin Otieno', admissionNumber: 'MRSS-G10-1785317634545', schoolName: 'Mwatate Ridge Senior School', schoolLogoUrl: null,
      currentClassName: 'Grade 11', academicYearLabel: '2026', termLabel: 'Term 2', guardians: [],
    }),
  }))
  assert.match(senior, /further education, technical training, entrepreneurship or work/)
})

test('a junior learner’s Page 4 is about what may emerge; a senior learner’s is about where the record leads', () => {
  const junior = render(createBlueprint({
    identity: section({
      learnerName: 'Brian Matthias', admissionNumber: 'ADM-1', schoolName: 'Test School', schoolLogoUrl: null,
      currentClassName: 'Grade 8', academicYearLabel: '2026', termLabel: 'Term 2', guardians: [],
    }),
  }))
  assert.match(junior, /What May Be Emerging/)
  assert.match(junior, /An early direction/)
  assert.doesNotMatch(junior, /Where This Could Lead/)

  const senior = render(createKevinBlueprint({
    identity: section({
      learnerName: 'Kevin Otieno', admissionNumber: 'ADM-2', schoolName: 'Mwatate Ridge Senior School', schoolLogoUrl: null,
      currentClassName: 'Grade 11', academicYearLabel: '2026', termLabel: 'Term 2', guardians: [],
    }),
  }))
  assert.match(senior, /Where This Could Lead/)
  assert.match(senior, /Where the record points/)
  assert.doesNotMatch(senior, /What May Be Emerging/)
})

test('a senior learner is never told their direction is an early signal that may change', () => {
  // Their pathway is already settled by placement — "early signal" is both
  // untrue and unactionable once the subjects are largely fixed.
  const senior = render(createBlueprint({
    identity: section({
      learnerName: 'Kevin Otieno', admissionNumber: 'ADM-2', schoolName: 'Mwatate Ridge Senior School', schoolLogoUrl: null,
      currentClassName: 'Grade 11', academicYearLabel: '2026', termLabel: 'Term 2', guardians: [],
    }),
  }))
  assert.doesNotMatch(senior, /It is an early signal/)
  assert.match(senior, /a direction to test and build on rather than a decision that has been made for them/)

  // The junior learner keeps exactly that protection against being narrowed early.
  const junior = render(createBlueprint())
  assert.match(junior, /It is an early signal/)
})

test('an 8-4-4 Form 3 learner gets senior framing, not the neutral fallback', () => {
  const form3 = render(createBlueprint({
    identity: section({
      learnerName: 'Kevin Otieno', admissionNumber: 'ADM-3', schoolName: 'Mwatate Ridge Senior School', schoolLogoUrl: null,
      currentClassName: 'Form 3', academicYearLabel: '2026', termLabel: 'Term 2', guardians: [],
    }),
  }))
  assert.match(form3, /Where This Could Lead/)
})

test('Grade 7-8 tells the family that work at this stage already counts toward placement', () => {
  const grade7 = render(createBlueprint())
  assert.match(grade7, /already counts/)
})

test('BlueprintView preserves honest, interpretive handling when core sections are unavailable — never fabricates, never crashes', () => {
  const html = render(createBlueprint({
    academicRecord: unavailable('No legacy student identity bridged for this learner.'),
    growthTimeline: unavailable('Growth evidence is unavailable until more scored evidence exists.'),
    career: unavailable('Career Intelligence is currently unavailable for this learner.'),
  }))

  assert.match(html, /We don’t yet have enough set up to build/)
  assert.match(html, /interests and strengths are still coming into focus/)
})

test('BlueprintView PDF export mode keeps all four pages, the branded report header, but no interactive navigation', () => {
  const html = render(createBlueprint(), 'pdf')

  for (const title of PAGE_TITLES) {
    assert.match(html, new RegExp(title))
  }

  const pageShellCount = (html.match(/data-blueprint-page-shell="true"/g) ?? []).length
  assert.equal(pageShellCount, 4)

  assert.match(html, /data-blueprint-ready="true"/)
  assert.match(html, /data-blueprint-print-break="before"/)
  assert.match(html, /data-blueprint-report-header="true"/, 'the branded header band must still render in PDF mode')
  assert.doesNotMatch(html, /data-blueprint-nav="true"/)
  assert.doesNotMatch(html, /View History →/)
  assert.doesNotMatch(html, /data-blueprint-hide-in-pdf="true"/)
})
