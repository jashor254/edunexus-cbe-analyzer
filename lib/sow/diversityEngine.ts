// lib/sow/diversityEngine.ts
// Controls diversity at five levels across a generated scheme of work.
// Works alongside VerbRotationEngine (verb-level) to eliminate repetition
// at outcome structure, experience framework, inquiry question, assessment,
// and values levels.

import type { GeneratedLesson } from './types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OutcomePattern {
  l1: string     // Level 1 verb (knowledge / recall)
  l2: string     // Level 2 verb (application / analysis)
  l3: string     // Level 3 verb (values / synthesis)
  structure: string  // Sentence structure label (A–H)
}

export interface ExperienceFramework {
  label: string   // A–L
  name: string
  template: string
}

export interface QuestionFrame {
  name: string
  starters: [string, string, string]
}

export interface DiversitySeed {
  outcomePattern:    OutcomePattern
  framework:         ExperienceFramework
  questionFrame:     QuestionFrame
  assessmentMethods: [string, string, string]
  values:            string
  coreCompetencies:  string
  contextBlock:      string   // pre-formatted string injected into prompt
}

// ─── Outcome Patterns ─────────────────────────────────────────────────────────
// 20 distinct L1→L2→L3 verb trios × 8 sentence structures = wide variety.
// Structures rotate independently so the same verb trio never repeats
// the same sentence shape.

const OUTCOME_PATTERNS: Omit<OutcomePattern, 'structure'>[] = [
  { l1: 'observe',    l2: 'investigate', l3: 'advocate for'        },
  { l1: 'label',      l2: 'compare',     l3: 'design'              },
  { l1: 'classify',   l2: 'analyze',     l3: 'evaluate'            },
  { l1: 'collect',    l2: 'demonstrate', l3: 'reflect on'          },
  { l1: 'recall',     l2: 'differentiate',l3: 'appreciate'         },
  { l1: 'describe',   l2: 'construct',   l3: 'create'              },
  { l1: 'locate',     l2: 'predict',     l3: 'recommend'           },
  { l1: 'name',       l2: 'explain',     l3: 'justify'             },
  { l1: 'list',       l2: 'formulate',   l3: 'synthesize'          },
  { l1: 'detect',     l2: 'test',        l3: 'develop awareness of'},
  { l1: 'draw',       l2: 'calculate',   l3: 'value'               },
  { l1: 'record',     l2: 'estimate',    l3: 'promote'             },
  { l1: 'measure',    l2: 'relate',      l3: 'support'             },
  { l1: 'read',       l2: 'interpret',   l3: 'critique'            },
  { l1: 'trace',      l2: 'model',       l3: 'implement'           },
  { l1: 'sketch',     l2: 'deduce',      l3: 'generate'            },
  { l1: 'note',       l2: 'hypothesize', l3: 'commit to'           },
  { l1: 'examine',    l2: 'apply',       l3: 'defend'              },
  { l1: 'sort',       l2: 'verify',      l3: 'propose'             },
  { l1: 'select',     l2: 'solve',       l3: 'develop interest in' },
]

// Eight sentence structures — rotate independently from verb patterns
const OUTCOME_STRUCTURES: Record<string, string> = {
  A: '[verb] the [concept] using [local Kenyan context or material]',
  B: '[verb] how [process] affects [outcome] in [context]',
  C: '[verb] the difference between [X] and [Y] in [context]',
  D: '[verb] [concept] in order to [purpose in local context]',
  E: '[verb] [process] when [condition applies in Kenyan situation]',
  F: '[verb] [concept] to [audience or purpose, e.g. the class, the community]',
  G: '[verb] [concept] according to [standard, guideline, or local practice]',
  H: '[verb] the importance of [concept] in [specific Kenyan context]',
}

const STRUCTURE_KEYS = Object.keys(OUTCOME_STRUCTURES)

// ─── Experience Frameworks ────────────────────────────────────────────────────
// 15 distinct activity structures (A–L from spec + 3 additions).

const EXPERIENCE_FRAMEWORKS: ExperienceFramework[] = [
  {
    label: 'A', name: 'Demonstration then Practice',
    template: `The teacher demonstrates [skill or process related to the topic].
Learners then practice the same skill in pairs, noting their observations.
Each pair shares one finding with the class.`,
  },
  {
    label: 'B', name: 'Problem Solving',
    template: `Learners are presented with a real problem: [scenario relevant to Kenyan context].
In groups, they discuss possible solutions, select the best approach, and explain their reasoning.
Groups present solutions; class selects the most practical one.`,
  },
  {
    label: 'C', name: 'Fieldwork or Practical',
    template: `Learners go to [location: school garden, lab, compound, or nearby area] to collect [data, samples, or observations].
They record findings systematically in their notebooks.
Class compiles all findings and identifies patterns.`,
  },
  {
    label: 'D', name: 'Case Study',
    template: `Learners read or listen to a case study about [specific Kenyan farming, community, or real-life context].
They identify the key issue, analyze what went well or poorly, and propose practical solutions.
Case findings are shared in a class discussion.`,
  },
  {
    label: 'E', name: 'Guided Experiment',
    template: `Learners set up a simple experiment to test [hypothesis related to topic].
They record observations at set intervals, then draw conclusions.
Groups compare results and explain any differences.`,
  },
  {
    label: 'F', name: 'Gallery Walk',
    template: `Charts, samples, or diagrams about [topic] are placed at four stations around the room.
Learners rotate in groups of three, spending 5 minutes per station to observe, discuss, and note.
Whole-class debrief: each group contributes one key point per station.`,
  },
  {
    label: 'G', name: 'Structured Debate',
    template: `Class is divided into two groups to argue opposing positions on [topic or issue].
Each side prepares arguments using textbook evidence (5 minutes).
Groups present; class evaluates the evidence and reaches a reasoned conclusion.`,
  },
  {
    label: 'H', name: 'Jigsaw',
    template: `Each group becomes expert on one aspect of [topic] using provided resources.
Groups then reformat with one expert from each to teach their peers.
Teacher confirms understanding with whole-class oral questions.`,
  },
  {
    label: 'I', name: 'Role Play',
    template: `Learners role-play as [farmer, consumer, extension officer, scientist, etc.] in a [scenario].
They act out the scenario and make decisions from their assigned perspective.
Class debriefs: What decisions were made? What factors influenced them? What would real outcomes be?`,
  },
  {
    label: 'J', name: 'Research then Present',
    template: `Learners research [specific aspect of topic] using the textbook and available charts (10 minutes).
Each group prepares a 2-minute summary and presents to the class.
Teacher builds a class concept map from all presentations.`,
  },
  {
    label: 'K', name: 'Sorting and Classifying',
    template: `Learners receive cards or samples of [items related to topic].
They sort them by [criteria], justify their groupings, and compare with another group.
Class agrees on the most logical classification system.`,
  },
  {
    label: 'L', name: 'Think-Pair-Share',
    template: `Learners individually consider: "How does [topic] work in everyday Kenyan life?" (3 minutes).
Pairs share and refine their thinking (4 minutes).
Selected pairs present; teacher builds a concept summary from class responses.`,
  },
  {
    label: 'M', name: 'Guided Discovery',
    template: `Teacher provides clues, examples, or data about [topic] without stating the rule directly.
Learners work in pairs to discover the underlying concept or pattern.
Pairs share discoveries; teacher confirms or corrects the key concept.`,
  },
  {
    label: 'N', name: 'Question Generation',
    template: `Learners read the textbook passage on [topic] for 5 minutes.
Each learner generates 3 questions — one factual, one analytical, one evaluative.
Pairs swap questions and attempt answers; best questions shared and answered collaboratively.`,
  },
  {
    label: 'O', name: 'Create and Review',
    template: `Learners individually create a diagram, annotated model, or poster of [topic].
Each learner's work is peer-reviewed using a simple checklist (accuracy, labels, completeness).
Teacher leads a class review of three selected samples, highlighting strengths.`,
  },
]

// ─── Inquiry Question Frames ──────────────────────────────────────────────────
// 12 distinct frame types — never use the same type in consecutive lessons.

const QUESTION_FRAMES: QuestionFrame[] = [
  {
    name: 'Causal',
    starters: [
      'What causes [process] to occur in [context]?',
      'Why does [phenomenon] happen in this way?',
      'What factors lead to [outcome]?',
    ],
  },
  {
    name: 'Consequence',
    starters: [
      'What happens when [condition changes]?',
      'What would change if [key factor] were removed?',
      'How does [action] affect [outcome] in [local context]?',
    ],
  },
  {
    name: 'Comparative',
    starters: [
      'In what ways does [X] differ from [Y]?',
      'What similarities and differences exist between [A] and [B]?',
      'Which approach is more effective — [option 1] or [option 2] — and why?',
    ],
  },
  {
    name: 'Evaluative',
    starters: [
      'How effective is [method] in addressing [problem] in Kenya?',
      'To what extent does [factor] influence [outcome]?',
      'Is [approach] the best way to [achieve goal]? Justify your view.',
    ],
  },
  {
    name: 'Personal Connection',
    starters: [
      'Where have you seen [concept] in your local community?',
      'How does [topic] affect your daily life as a student in Kenya?',
      'Can you give an example from your own experience where [concept] mattered?',
    ],
  },
  {
    name: 'Process',
    starters: [
      'What steps are involved in [process]?',
      'How does [system] work from start to finish?',
      'In what sequence do the stages of [cycle] occur?',
    ],
  },
  {
    name: 'Hypothetical',
    starters: [
      'What would happen if [key condition] were absent?',
      'How might [outcome] change if [variable] doubled?',
      'If [problem] were solved, how would life be different for Kenyans?',
    ],
  },
  {
    name: 'Investigative',
    starters: [
      'How would you find out whether [claim] is true?',
      'What evidence would you need to confirm [hypothesis]?',
      'How could learners in your school investigate [question]?',
    ],
  },
  {
    name: 'Critical',
    starters: [
      'What are the risks of [practice] in [Kenyan context]?',
      'Should [action or policy] be encouraged or discouraged? Why?',
      'What responsibility do we have towards [issue] as Kenyan citizens?',
    ],
  },
  {
    name: 'Connective',
    starters: [
      'How does [current topic] connect to what we studied about [previous topic]?',
      'In what ways does [topic A] depend on or influence [topic B]?',
      'How do the ideas in this lesson relate to [real Kenyan situation]?',
    ],
  },
  {
    name: 'Application',
    starters: [
      'How can [concept] be applied to improve [aspect of Kenyan life]?',
      'Where in real life have you seen [concept] being used?',
      'How might a [farmer / student / community leader] in your area use [knowledge]?',
    ],
  },
  {
    name: 'Open Challenge',
    starters: [
      'What do you think is the most important aspect of [topic]? Why?',
      'Can you think of a situation where [usual rule or practice] would not apply?',
      'What is one question about [topic] that you still want answered?',
    ],
  },
]

// ─── Assessment Method Pool ───────────────────────────────────────────────────
// 12 distinct types — 3 per lesson, cycling so no two consecutive lessons share all 3.

const ASSESSMENT_TYPES: string[] = [
  'Observation checklist for [specific skill being demonstrated]',
  'Oral questioning using higher-order thinking prompts',
  'Written exercise: [specific task — diagram, list, paragraph, matching]',
  'Practical demonstration assessed against a skill rubric',
  'Peer assessment: learners evaluate each other\'s work using given criteria',
  'Self-assessment: learners rate their own understanding on a 1–4 scale',
  'Exit ticket: one targeted question answered individually before leaving',
  'Assessment of learner product: [poster, chart, annotated model, written report]',
  'Portfolio entry: learner adds evidence of learning to their portfolio',
  'Short quiz (3–5 questions) on key concepts from the lesson',
  'Written reflection: what I learned and one question I still have',
  'Assessment of debate or discussion: participation, reasoning, use of evidence',
]

// ─── Values Rotation (10 sets) ────────────────────────────────────────────────

const VALUES_SETS: string[] = [
  'Respect, Responsibility, Unity',
  'Integrity, Diligence, Patriotism',
  'Creativity, Curiosity, Perseverance',
  'Empathy, Cooperation, Honesty',
  'Environmental care, Sustainability, Stewardship',
  'Tolerance, Inclusion, Social justice',
  'Self-reliance, Initiative, Resilience',
  'Critical thinking, Objectivity, Open-mindedness',
  'Community service, Citizenship, National pride',
  'Innovation, Excellence, Continuous improvement',
]

// ─── Core Competencies Rotation (8 sets) ─────────────────────────────────────

const COMPETENCY_SETS: string[] = [
  'Communication, Critical thinking, Collaboration',
  'Creativity, Self-efficacy, Learning to learn',
  'Digital literacy, Problem solving, Citizenship',
  'Numeracy, Communication, Self-management',
  'Critical thinking, Creativity, Citizenship',
  'Problem solving, Communication, Learning to learn',
  'Self-efficacy, Digital literacy, Numeracy',
  'Collaboration, Critical thinking, Creativity',
]

// ─── DiversityEngine ──────────────────────────────────────────────────────────

export class DiversityEngine {
  private count = 0  // absolute lesson counter across the whole scheme

  // Generate a fully-formed diversity seed for the next lesson.
  // Uses the lesson counter to cycle deterministically through all pools,
  // ensuring adjacent lessons always differ on every dimension.
  next(isCBC: boolean): DiversitySeed {
    const i = this.count
    this.count++

    const patternBase  = OUTCOME_PATTERNS[i % OUTCOME_PATTERNS.length]
    const structureKey = STRUCTURE_KEYS[i % STRUCTURE_KEYS.length]
    const framework    = EXPERIENCE_FRAMEWORKS[i % EXPERIENCE_FRAMEWORKS.length]
    const qFrame       = QUESTION_FRAMES[i % QUESTION_FRAMES.length]
    const values       = VALUES_SETS[i % VALUES_SETS.length]
    const competencies = isCBC
      ? COMPETENCY_SETS[i % COMPETENCY_SETS.length]
      : 'Problem solving, Critical thinking'

    // Pick 3 assessments from non-overlapping positions in the pool
    const a1 = ASSESSMENT_TYPES[i % ASSESSMENT_TYPES.length]
    const a2 = ASSESSMENT_TYPES[(i + 4) % ASSESSMENT_TYPES.length]
    const a3 = ASSESSMENT_TYPES[(i + 8) % ASSESSMENT_TYPES.length]

    const outcomePattern: OutcomePattern = {
      ...patternBase,
      structure: structureKey,
    }

    const contextBlock = buildContextBlock(outcomePattern, framework, qFrame, [a1, a2, a3])

    return {
      outcomePattern,
      framework,
      questionFrame: qFrame,
      assessmentMethods: [a1, a2, a3],
      values,
      coreCompetencies: competencies,
      contextBlock,
    }
  }

  reset(): void {
    this.count = 0
  }
}

// ─── Context block builder ────────────────────────────────────────────────────
// Builds the per-lesson diversity instruction injected into the user prompt.

function buildContextBlock(
  pattern:     OutcomePattern,
  framework:   ExperienceFramework,
  qFrame:      QuestionFrame,
  assessments: string[],
): string {
  const structureDesc = OUTCOME_STRUCTURES[pattern.structure]
  return `
DIVERSITY INSTRUCTIONS FOR THIS LESSON:

OUTCOMES — Use these specific verbs and sentence structure:
  Level 1 verb: "${pattern.l1}"
  Level 2 verb: "${pattern.l2}"
  Level 3 verb: "${pattern.l3}"
  Sentence structure: Structure ${pattern.structure} → "${structureDesc}"

LEARNING EXPERIENCE — Use Framework ${framework.label} (${framework.name}):
${framework.template}

INQUIRY QUESTIONS — Use the "${qFrame.name}" frame with these starters:
  Q1: ${qFrame.starters[0]}
  Q2: ${qFrame.starters[1]}
  Q3: ${qFrame.starters[2]}

ASSESSMENT — Use exactly these three methods (do not substitute):
  1. ${assessments[0]}
  2. ${assessments[1]}
  3. ${assessments[2]}
`.trim()
}

// ─── Diversity audit ──────────────────────────────────────────────────────────
// Run after all lessons are generated to surface remaining repetition.

export interface DiversityAuditResult {
  passed: boolean
  issues: string[]
}

function extractOpeningVerb(outcome: string): string {
  return outcome
    .toLowerCase()
    .replace(/^(by the end[^,]+,\s*)/i, '')
    .replace(/^(learners?\s+(will\s+)?(be able to\s+)?)/i, '')
    .trim()
    .split(/[\s,;.(]+/)[0] ?? ''
}

export function auditDiversity(lessons: GeneratedLesson[]): DiversityAuditResult {
  const issues: string[] = []

  for (let i = 1; i < lessons.length; i++) {
    const prev = lessons[i - 1]
    const curr = lessons[i]

    // Check verb overlap between adjacent lessons
    const prevVerbs = prev.learningOutcomes.map(extractOpeningVerb).filter(Boolean)
    const currVerbs = curr.learningOutcomes.map(extractOpeningVerb).filter(Boolean)
    const overlap   = prevVerbs.filter(v => currVerbs.includes(v))
    if (overlap.length >= 2) {
      issues.push(`Wk${curr.week} Lsn${curr.lesson}: shares ≥2 opening verbs with previous lesson (${overlap.join(', ')})`)
    }

    // Check experience framework repetition (first sentence)
    const prevExp = (prev.learningExperiences[0] ?? '').toLowerCase().slice(0, 60)
    const currExp = (curr.learningExperiences[0] ?? '').toLowerCase().slice(0, 60)
    if (prevExp && currExp && prevExp === currExp) {
      issues.push(`Wk${curr.week} Lsn${curr.lesson}: identical experience opening to previous lesson`)
    }

    // Check overused "groups to observe" pattern
    if (/learners work in groups to observe/.test(currExp)) {
      if (i >= 2) {
        const twoBack = (lessons[i - 2].learningExperiences[0] ?? '').toLowerCase()
        if (/learners work in groups to observe/.test(twoBack)) {
          issues.push(`Wk${curr.week} Lsn${curr.lesson}: "groups to observe" used 2 lessons ago — rotate framework`)
        }
      }
    }

    // Check identical assessment combination
    const prevA = [...prev.assessmentMethods].sort().join('|')
    const currA = [...curr.assessmentMethods].sort().join('|')
    if (prevA === currA) {
      issues.push(`Wk${curr.week} Lsn${curr.lesson}: identical assessment combination as previous lesson`)
    }

    // Check inquiry question starters
    const prevQStarters = prev.keyInquiryQuestions.map(q => q.split(/\s+/).slice(0, 3).join(' ').toLowerCase())
    const currQStarters = curr.keyInquiryQuestions.map(q => q.split(/\s+/).slice(0, 3).join(' ').toLowerCase())
    const qOverlap = prevQStarters.filter(s => currQStarters.includes(s))
    if (qOverlap.length >= 2) {
      issues.push(`Wk${curr.week} Lsn${curr.lesson}: ≥2 inquiry question starters repeated from previous lesson`)
    }
  }

  return { passed: issues.length === 0, issues }
}
