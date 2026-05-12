// lib/sow/validators.ts

// ================= VERB HIERARCHY (CBC) =================
// Subject-aware verb orders. 'solve'/'calculate' are L1 for Maths; L2 for default.
const VERB_ORDERS: Record<string, string[][]> = {
  default: [
    // Level 1 — Knowledge & Recall
    [
      'state', 'identify', 'describe', 'outline',
      'define', 'list', 'name', 'label', 'match',
      'recall', 'recognize', 'select', 'locate',
      'collect', 'count', 'draw', 'find', 'give',
      'make', 'note', 'observe', 'read', 'record',
      'show', 'tell', 'trace', 'use', 'write',
    ],
    // Level 2 — Understanding & Application
    [
      'explain', 'discuss', 'analyze', 'examine',
      'compare', 'contrast', 'classify', 'interpret',
      'summarize', 'distinguish', 'illustrate',
      'connect', 'convert', 'determine', 'differentiate',
      'express', 'formulate', 'infer', 'justify',
      'predict', 'relate', 'research', 'review',
      'sequence', 'solve', 'apply', 'calculate',
      'demonstrate', 'investigate', 'measure',
      'construct', 'develop', 'design', 'use',
    ],
    // Level 3 — Values & Attitudes
    [
      'appreciate', 'value', 'acknowledge',
      'advocate', 'champion', 'commit', 'compose',
      'communicate', 'create', 'critique', 'edit',
      'evaluate', 'generate', 'implement', 'integrate',
      'model', 'organize', 'plan', 'present',
      'produce', 'propose', 'reflect', 'revise',
      'show', 'synthesize', 'support', 'promote',
    ],
  ],

  mathematics: [
    // Level 1 — Knowledge + primary Maths action verbs (solve/find are L1 here)
    [
      'identify', 'state', 'define', 'describe',
      'list', 'name', 'recognize', 'recall',
      'write', 'count', 'draw', 'find', 'solve',
      'read', 'label', 'match', 'select', 'locate',
      'give', 'show', 'record',
    ],
    // Level 2 — Computation & Application
    [
      'explain', 'calculate', 'apply', 'compute',
      'determine', 'evaluate', 'analyze', 'compare',
      'differentiate', 'justify', 'verify', 'prove',
      'simplify', 'expand', 'factorize', 'plot',
      'construct', 'measure', 'investigate', 'convert',
      'formulate', 'deduce', 'derive', 'demonstrate',
    ],
    // Level 3 — Values & Real-life connections
    [
      'appreciate', 'value', 'develop', 'create',
      'model', 'design', 'generalize', 'promote',
      'reflect', 'advocate', 'synthesize', 'evaluate',
    ],
  ],

  science: [
    // Level 1 — Observation & Knowledge
    [
      'identify', 'state', 'define', 'describe',
      'list', 'name', 'observe', 'classify',
      'record', 'collect', 'label', 'draw',
      'recognize', 'recall', 'select', 'locate',
      'note', 'give', 'show',
    ],
    // Level 2 — Investigation & Application
    [
      'explain', 'analyze', 'compare', 'examine',
      'investigate', 'predict', 'hypothesize',
      'experiment', 'measure', 'calculate', 'test',
      'determine', 'differentiate', 'interpret',
      'construct', 'design', 'apply', 'solve',
      'formulate', 'demonstrate',
    ],
    // Level 3 — Values & Real-world connections
    [
      'appreciate', 'value', 'evaluate', 'create',
      'develop', 'model', 'advocate', 'promote',
      'reflect', 'synthesize', 'generalize',
    ],
  ],
}

// Synonym map for skill-based substrands — DeepSeek uses academic equivalents
const SKILL_SYNONYMS: Record<string, string[]> = {
  'previewing': ['preview', 'pre-read', 'prereading', 'survey', 'surveying', 'overview', 'before reading', 'prior'],
  'predicting': ['predict', 'prediction', 'anticipat', 'forecast', 'expect', 'prior knowledge'],
  'skimming': ['skim', 'rapid read', 'quick read', 'overview', 'gist', 'general idea', 'fast read'],
  'scanning': ['scan', 'locate', 'search', 'find specific', 'look for', 'specific information'],
  'vocabulary': ['vocab', 'word', 'lexis', 'lexical', 'terminology', 'terms', 'meaning', 'dictionary', 'glossary'],
  'selecting': ['select', 'choose', 'pick', 'identify', 'determine', 'decide'],
  'distractions': ['distract', 'focus', 'concentrat', 'attention', 'relevant', 'irrelevant'],
  'inferring': ['infer', 'inference', 'implied', 'implicit', 'deduce', 'conclude', 'read between'],
  'collocations': ['collocat', 'word pair', 'word combination', 'phrases', 'go together'],
  'cohesion': ['cohes', 'linking', 'connect', 'transition', 'flow', 'coherent'],
  'fluency': ['fluent', 'smooth', 'natural', 'flow', 'pace', 'rhythm'],
  'acronyms': ['acronym', 'abbreviat', 'short form', 'initials', 'letters'],
  'affixes': ['affix', 'prefix', 'suffix', 'root word', 'word formation', 'morphology'],
  // Maths / Science
  'indices': ['index', 'power', 'exponent', 'base'],
  'quadratic': ['equation', 'factor', 'quadrat', 'polynomial'],
  'trigonometry': ['trig', 'sine', 'cosine', 'tangent', 'angle'],
  'similarity': ['similar', 'scale', 'enlarge', 'proportion'],
  'statistics': ['data', 'mean', 'median', 'mode', 'frequency'],
  'probability': ['chance', 'likelihood', 'outcome', 'event'],
  'algebra': ['equation', 'expression', 'variable', 'formula'],
  'geometry': ['angle', 'shape', 'triangle', 'circle', 'polygon'],
  'vectors': ['vector', 'scalar', 'magnitude', 'direction'],
  'logarithm': ['log', 'logarithm', 'antilog', 'index'],
  'fraction': ['numerator', 'denominator', 'rational', 'divide'],
}

// Multi-word Level 3 phrases — checked BEFORE single-word scan so their
// component words ('recognize', 'develop') don't map to a lower level.
const MULTI_WORD_L3 = [
  'recognize the importance',
  'develop interest',
  'develop awareness',
  'develop confidence',
]

// ================= HELPERS =================

// Returns 0 (Level 1) / 1 (Level 2) / 2 (Level 3) or -1 if no verb found.
// Scans L1 → L2 → L3 so shared verbs resolve to their LOWEST level.
function getVerbLevel(sentence = '', verbOrder: string[][]): number {
  if (!sentence) return -1
  const lower = sentence.toLowerCase()

  // Multi-word phrases override single-word extraction
  if (MULTI_WORD_L3.some(phrase => lower.includes(phrase))) return 2

  const words = lower.replace(/[^a-z\s]/g, '').split(' ')

  for (let i = 0; i < verbOrder.length; i++) {
    if (words.some(w => verbOrder[i].includes(w))) return i
  }
  return -1
}

// ================= VALIDATORS =================
function validateLearningOutcomes(outcomes: string[] = [], verbOrder: string[][]): { valid: boolean; reason?: string } {
  if (!Array.isArray(outcomes) || outcomes.length < 3) {
    return { valid: false, reason: 'At least 3 learning outcomes required' }
  }

  const verbLevels = outcomes.map(o => getVerbLevel(o, verbOrder))

  if (verbLevels.includes(-1)) {
    return { valid: false, reason: 'One or more outcomes use invalid CBC verbs' }
  }

  // TSC requirement: outcomes must progress from lower to higher cognitive order
  for (let i = 1; i < verbLevels.length; i++) {
    if (verbLevels[i] < verbLevels[i - 1]) {
      return {
        valid: false,
        reason: 'Learning outcomes must progress from lower to higher order',
      }
    }
  }

  return { valid: true }
}

function validateLearningExperiences(experiences: string[] = []): { valid: boolean; reason?: string } {
  if (!Array.isArray(experiences) || experiences.length === 0) {
    return { valid: false, reason: 'Learning experiences missing' }
  }

  const learnerKeywords = [
    'learner', 'student', 'group', 'discuss', 'perform', 'participate', 'work',
  ]

  const combined = experiences.join(' ').toLowerCase()

  if (!learnerKeywords.some(k => combined.includes(k))) {
    return { valid: false, reason: 'Learning experiences must be learner-centered' }
  }

  return { valid: true }
}

function validateInquiryQuestions(questions: string[] = []): { valid: boolean; reason?: string } {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { valid: false, reason: 'Inquiry questions missing' }
  }

  const combined = questions.join(' ').toLowerCase()

  if (!combined.includes('?')) {
    return { valid: false, reason: 'Inquiry questions must be in question form' }
  }

  const higherOrderStarters = ['how', 'why', 'in what ways', 'to what extent']

  if (!higherOrderStarters.some(q => combined.includes(q))) {
    return { valid: false, reason: 'Inquiry questions lack higher-order thinking' }
  }

  return { valid: true }
}

function validateAssessmentMethods(methods: string[] = []): { valid: boolean; reason?: string } {
  if (!Array.isArray(methods) || methods.length === 0) {
    return { valid: false, reason: 'Assessment methods missing' }
  }

  // 'test' alone is valid (written test = CBC formative); only full summative phrases forbidden
  const forbidden = [
    'end of term exam',
    'final examination',
    'kcse exam',
    'marks out of',
    'grade out of',
    'summative exam',
    'terminal exam',
  ]

  const combined = methods.join(' ').toLowerCase()

  if (forbidden.some(phrase => combined.includes(phrase))) {
    return { valid: false, reason: 'Summative assessment not allowed in lesson SOW' }
  }

  return { valid: true }
}

function validateLearningResources(resources: string[] = []): { valid: boolean; reason?: string } {
  if (!Array.isArray(resources) || resources.length === 0) {
    return { valid: false, reason: 'Learning resources missing' }
  }

  const forbidden = ['hologram', 'vr lab', 'ai lab']

  const combined = resources.join(' ').toLowerCase()

  if (forbidden.some(word => combined.includes(word))) {
    return { valid: false, reason: 'Unrealistic learning resources detected' }
  }

  return { valid: true }
}

// Prevent hallucination drift
function validateSubstrandAlignment(
  lesson: Record<string, any>,
  substrandTitle = ''
): { valid: boolean; reason?: string } {
  if (!substrandTitle ||
      substrandTitle === 'ai-generated' ||
      substrandTitle.includes('Full Syllabus')) {
    return { valid: true }
  }

  const combined = [
    ...(lesson.learning_outcomes || []),
    ...(lesson.learning_experiences || []),
    ...(lesson.key_inquiry_questions || []),
  ].join(' ').toLowerCase()

  const stopWords = new Set([
    'and', 'or', 'the', 'of', 'in', 'a', 'an', 'to', 'for',
    'with', 'on', 'at', 'from', 'by', 'its', 'their', 'use',
    'using', 'used', 'through', 'skills', 'ability', 'main',
  ])

  // Extract words from the substrand title itself
  const titleWords = substrandTitle
    .toLowerCase()
    .split(/[\s\-:,\/()]+/)
    .filter(w => w.length >= 3 && !stopWords.has(w))

  // Also flatten any " - " separated parts (e.g. "Reading - Fluency - Scanning and Skimming")
  const partWords = substrandTitle
    .split(' - ')
    .join(' ')
    .toLowerCase()
    .split(/[\s\-:,\/()]+/)
    .filter(w => w.length >= 3 && !stopWords.has(w))

  const keywords = [...new Set([...titleWords, ...partWords])]

  if (keywords.length === 0) return { valid: true }

  const expandedKeywords: string[] = []
  for (const kw of keywords) {
    expandedKeywords.push(kw)
    for (const [skill, synonyms] of Object.entries(SKILL_SYNONYMS)) {
      if (skill.includes(kw) || kw.includes(skill)) {
        expandedKeywords.push(...synonyms)
      }
    }
  }

  const anyMatch = expandedKeywords.some(kw => combined.includes(kw.toLowerCase()))

  if (!anyMatch) {
    return { valid: false, reason: 'Lesson content not aligned to substrand focus' }
  }

  return { valid: true }
}

// ================= MAIN EXPORT =================
export function validateLesson(
  lesson: Record<string, any>,
  substrandTitle = '',
  subjectType = 'default'
): { isValid: boolean; issues: string[] } {
  const verbOrder = VERB_ORDERS[subjectType] ?? VERB_ORDERS.default
  const checks = [
    validateLearningOutcomes(lesson.learning_outcomes, verbOrder),
    validateLearningExperiences(lesson.learning_experiences),
    validateInquiryQuestions(lesson.key_inquiry_questions),
    validateAssessmentMethods(lesson.assessment_methods),
    validateLearningResources(lesson.learning_resources),
    validateSubstrandAlignment(lesson, substrandTitle),
  ]

  const failed = checks.filter(c => !c.valid)

  return {
    isValid: failed.length === 0,
    issues: failed.map(f => f.reason || 'Unknown validation error'),
  }
}
