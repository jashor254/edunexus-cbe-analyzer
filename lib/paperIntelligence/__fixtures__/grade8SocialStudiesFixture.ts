// lib/paperIntelligence/__fixtures__/grade8SocialStudiesFixture.ts
//
// Golden test fixture — Prototype 01 spec §17. Entirely synthetic: no real
// learner data, no real photographs. Mirrors the real Grade 8 Green /
// Social Studies / "Early Civilisation — The Swahili Civilisation" topic
// used elsewhere this session, but every rubric/answer here is invented for
// testing, not sourced from a real class.

import type { RubricForMarking, RecognizedQuestionAnswer } from '../types'

export const FIXTURE_SUB_STRAND_ID = '142124e8-9c0c-4485-9fd3-f3e4860fe8b5'

export const FIXTURE_RUBRICS: RubricForMarking[] = [
  {
    rubricId: 'fixture-q1',
    questionNumber: 1,
    questionText: 'Explain two effects of soil erosion on agricultural land.',
    expectedAnswerSummary: 'Two of: loss of topsoil/fertility, reduced crop yield, siltation of rivers/dams, exposure of infertile subsoil — each with a brief explanation.',
    markingCriteria: [
      { criterion: 'Identifies a first valid effect', points: 1 },
      { criterion: 'Explains the first effect', points: 1 },
      { criterion: 'Identifies a second valid effect', points: 1 },
      { criterion: 'Explains the second effect', points: 1 },
    ],
    maxMarks: 4,
  },
  {
    rubricId: 'fixture-q2',
    questionNumber: 2,
    questionText: 'State one factor that led to the growth of Swahili civilisation along the East African coast.',
    expectedAnswerSummary: 'Monsoon winds enabling Indian Ocean trade with Arabia, Persia and India.',
    markingCriteria: [{ criterion: 'States a valid factor', points: 2 }],
    maxMarks: 2,
  },
  {
    rubricId: 'fixture-q3',
    questionNumber: 3,
    questionText: 'Give two reasons why community service learning projects are important to a school.',
    expectedAnswerSummary: 'Two of: builds civic responsibility, addresses a real community problem, develops leadership/teamwork skills.',
    markingCriteria: [
      { criterion: 'First valid reason', points: 1 },
      { criterion: 'Second valid reason', points: 1 },
    ],
    maxMarks: 2,
  },
  {
    rubricId: 'fixture-q4',
    questionNumber: 4,
    questionText: 'Describe one effect of the Trans-Saharan trade on Africa.',
    expectedAnswerSummary: 'One of: spread of Islam, growth of trans-Saharan trading towns, introduction of new goods/currency, social disruption from the slave trade.',
    markingCriteria: [
      { criterion: 'Identifies a valid effect', points: 1 },
      { criterion: 'Describes it with some detail', points: 2 },
    ],
    maxMarks: 3,
  },
  {
    rubricId: 'fixture-q5',
    questionNumber: 5,
    questionText: 'Explain why self-esteem contributes to holistic development.',
    expectedAnswerSummary: 'Confidence supports social interaction, academic effort, and resilience — contributing across social/emotional/academic domains.',
    markingCriteria: [
      { criterion: 'Names a domain self-esteem affects', points: 1 },
      { criterion: 'Explains the link to holistic development', points: 2 },
    ],
    maxMarks: 3,
  },
]

/** A plausible, fully-valid model response over the fixture above — used as a "happy path" test input. */
export const FIXTURE_VALID_ANSWERS: RecognizedQuestionAnswer[] = [
  {
    rubricId: 'fixture-q1', questionNumber: 1,
    recognizedAnswer: 'Loss of topsoil reduces fertility. Silting of rivers affects water supply.',
    recognitionConfidence: 0.82, recognitionNotes: null, uncertain: false,
    proposedMark: 3, maxMark: 4, gradingConfidence: 0.7,
    rationale: 'Two effects identified, second explanation is thin.',
  },
  {
    rubricId: 'fixture-q2', questionNumber: 2,
    recognizedAnswer: 'Monsoon winds allowed trade with Arabia and India.',
    recognitionConfidence: 0.91, recognitionNotes: null, uncertain: false,
    proposedMark: 2, maxMark: 2, gradingConfidence: 0.88,
    rationale: 'Correct, matches expected answer directly.',
  },
]
