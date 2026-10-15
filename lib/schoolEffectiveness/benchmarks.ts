// lib/schoolEffectiveness/benchmarks.ts
//
// The eight CBC-adapted Gatsby benchmarks. Source framework: the UK Gatsby
// Benchmarks of Good Career Guidance (Sir John Holman, statutory in England
// since 2018), adapted to Kenya's CBC/CBE Grade 7–12 context. Each benchmark
// carries a 0–4 maturity rubric and the real EduNexus programme(s) that close
// a gap on it. Benchmarks 5 and 6 (employer encounters, workplace experiences)
// are the market-wide blind spot — EduNexus has no programme for them yet, so
// they are marked `horizon: true` with no programmes, and the diagnostic
// reports them as honestly unaddressed rather than mapping a fake product.

import type { ProgrammeRef, SchoolEffectivenessBenchmark } from './types'

// Real EduNexus programme surfaces (keys are stable; labels are user-facing).
const P = {
  career_intelligence: { key: 'career_intelligence', label: 'Career Intelligence', status: 'available' },
  blueprint:           { key: 'blueprint',           label: 'Learner Blueprint',   status: 'available' },
  adaptive:            { key: 'adaptive',            label: 'Adaptive Learning',   status: 'available' },
  gradebook:           { key: 'gradebook',           label: 'Gradebook / Evidence Record', status: 'available' },
  sow:                 { key: 'sow',                 label: 'Scheme of Work',      status: 'available' },
  lesson_plan:         { key: 'lesson_plan',         label: 'Lesson Plans',        status: 'available' },
  compass:             { key: 'compass',             label: 'Compass',             status: 'available' },
} as const satisfies Record<string, ProgrammeRef>

// A reusable 0–4 maturity shape; each benchmark supplies its own descriptors.
function rubric(
  absent: string,
  emerging: string,
  developing: string,
  established: string,
  embedded: string,
): readonly { level: 0 | 1 | 2 | 3 | 4; descriptor: string }[] {
  return [
    { level: 0, descriptor: absent },
    { level: 1, descriptor: emerging },
    { level: 2, descriptor: developing },
    { level: 3, descriptor: established },
    { level: 4, descriptor: embedded },
  ]
}

export const CBC_GATSBY_BENCHMARKS: readonly SchoolEffectivenessBenchmark[] = [
  {
    id: 'stable_programme',
    gatsbyNumber: 1,
    name: 'A stable, structured guidance programme',
    definition:
      'The school runs a written, resourced, ongoing career-guidance programme across Grades 7–12 — known to learners, parents and teachers — rather than ad-hoc talks at selection time.',
    signal:
      'Is there a named programme with an owner and a termly rhythm, or does guidance only happen in a rush around KJSEA and Grade 10 selection?',
    rubric: rubric(
      'No structured guidance programme; guidance is occasional and reactive.',
      'Some one-off activities, but no written plan or owner.',
      'A plan exists on paper but runs unevenly and is not well known.',
      'A known, owned programme runs each term for most grades.',
      'A stable programme is embedded across Grades 7–12, reviewed and resourced yearly.',
    ),
    addressed_by: [P.career_intelligence],
    horizon: false,
  },
  {
    id: 'pathway_labour_market_info',
    gatsbyNumber: 2,
    name: 'CBC pathway & labour-market information',
    definition:
      'Learners and parents use good, current information on CBC senior-school pathways, subject combinations and where they lead in the Kenyan (and wider) labour market.',
    signal:
      'When a family asks "where does this pathway lead?", is there grounded, current information to hand, or guesswork?',
    rubric: rubric(
      'No reliable pathway or labour-market information is used.',
      'Teachers rely on memory and rumour; information is dated or generic.',
      'Some materials exist but are not consistently current or CBC-specific.',
      'Current CBC pathway and labour-market information is routinely used in guidance.',
      'Rich, current, CBC-specific information is embedded in every guidance conversation.',
    ),
    addressed_by: [P.career_intelligence],
    horizon: false,
  },
  {
    id: 'each_learners_needs',
    gatsbyNumber: 3,
    name: "Addressing each learner's needs",
    definition:
      "Guidance is tailored to the individual learner from a real, longitudinal record of their demonstrated work — not a one-off quiz or the class average. This is EduNexus's core strength.",
    signal:
      "Can a teacher see what this learner has actually demonstrated over time, or only the latest mark — or nothing at all?",
    rubric: rubric(
      'No individual record; guidance treats learners as a single group.',
      'Only the latest marks are available; no history or capability view.',
      'Some per-learner history exists but is scattered and under-used.',
      "A longitudinal record informs guidance for most learners.",
      "Every learner's demonstrated-evidence record drives tailored, continuous guidance.",
    ),
    addressed_by: [P.blueprint, P.gradebook, P.adaptive],
    horizon: false,
  },
  {
    id: 'curriculum_career_linkage',
    gatsbyNumber: 4,
    name: 'Linking curriculum learning to careers',
    definition:
      'Teachers connect what is taught in each subject to where those competencies lead — so learning is framed as a pathway, not isolated content.',
    signal:
      'Do subject lessons routinely make the "this is where this leads" link, or is curriculum taught in isolation from pathways?',
    rubric: rubric(
      'No link is made between subjects and careers or pathways.',
      'Occasional, incidental mentions by individual teachers.',
      'Some subjects link to pathways, inconsistently across the school.',
      'Most subjects routinely link learning to CBC pathways and careers.',
      'Curriculum–career linkage is embedded in planning across all subjects.',
    ),
    addressed_by: [P.sow, P.lesson_plan, P.career_intelligence],
    horizon: false,
  },
  {
    id: 'employer_encounters',
    gatsbyNumber: 5,
    name: 'Encounters with employers and people in work',
    definition:
      'Learners meet and learn from people in real jobs — the single intervention most strongly associated with better adult employment outcomes (OECD). This is the market-wide blind spot in Kenya.',
    signal:
      'How many times a year does a learner actually talk to someone about their real job?',
    rubric: rubric(
      'Learners have no contact with people in work.',
      'Rare, one-off visitors, not planned.',
      'Some encounters for some grades, inconsistently.',
      'Regular, planned employer encounters for most learners.',
      'Multiple meaningful encounters per learner per year, embedded in the programme.',
    ),
    addressed_by: [],
    horizon: true,
  },
  {
    id: 'workplace_experiences',
    gatsbyNumber: 6,
    name: 'Experiences of workplaces',
    definition:
      'Learners experience real workplaces first-hand (visits, job shadowing, attachments) to understand how work works. Also largely unaddressed across the Kenyan market.',
    signal:
      'Has this learner ever set foot in a workplace relevant to a pathway they are considering?',
    rubric: rubric(
      'No workplace experiences at all.',
      'Rare, unstructured visits.',
      'Some visits for some learners, not linked to guidance.',
      'Planned workplace experiences for most learners.',
      'Structured, pathway-linked workplace experiences embedded for all learners.',
    ),
    addressed_by: [],
    horizon: true,
  },
  {
    id: 'transition_guidance',
    gatsbyNumber: 7,
    name: 'Senior-school, TVET & higher-education transition guidance',
    definition:
      'Learners get grounded guidance for the Grade 9→10 pathway choice and later transitions to TVET, college and university — continuous across the junior→senior boundary, not a one-off at selection.',
    signal:
      'At Grade 9 selection and beyond, is guidance continuous and evidence-grounded, or a cold, last-minute pick?',
    rubric: rubric(
      'No structured transition guidance; choices are made blind.',
      'Last-minute, generic help at selection time only.',
      'Some transition support, not grounded in the learner record.',
      'Grounded transition guidance for most learners at key points.',
      'Continuous, evidence-grounded transition guidance from Grade 7 through senior school.',
    ),
    addressed_by: [P.career_intelligence],
    horizon: false,
  },
  {
    id: 'personal_guidance',
    gatsbyNumber: 8,
    name: 'Personal guidance',
    definition:
      'Each learner has access to one-to-one guidance with someone who knows them, grounded in their record — not generic advice to a crowd.',
    signal:
      'Can each learner sit with someone who actually knows their journey, at the point they need it?',
    rubric: rubric(
      'No one-to-one guidance is available.',
      'Occasional ad-hoc conversations, not grounded in any record.',
      'Some one-to-one guidance, limited reach or depth.',
      'Most learners get grounded one-to-one guidance at key points.',
      'Every learner has timely, record-grounded personal guidance.',
    ),
    addressed_by: [P.compass, P.blueprint],
    horizon: false,
  },
]
