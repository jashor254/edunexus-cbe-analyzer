// lib/sow/validators.ts
// TypeScript conversion of jashor-app validators.js
// All logic preserved exactly.

// ================= VERB HIERARCHY (CBC) =================
const OUTCOME_VERB_ORDER: string[][] = [
  ['state', 'identify', 'describe', 'outline'],
  ['explain', 'discuss', 'analyze', 'examine'],
  ['apply', 'demonstrate', 'appreciate', 'value'],
]

// Flattened list for quick lookup
const ALL_VERBS: string[] = OUTCOME_VERB_ORDER.flat()

// ================= HELPERS =================
function extractVerb(sentence = ''): string | null {
  if (!sentence) return null

  const words = sentence
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(' ')

  return words.find(word => ALL_VERBS.includes(word)) || null
}

// ================= VALIDATORS =================
function validateLearningOutcomes(outcomes: string[] = []): { valid: boolean; reason?: string } {
  if (!Array.isArray(outcomes) || outcomes.length < 3) {
    return { valid: false, reason: 'At least 3 learning outcomes required' }
  }

  const verbLevels = outcomes.map(outcome => {
    const verb = extractVerb(outcome)
    if (!verb) return -1
    return OUTCOME_VERB_ORDER.findIndex(level => level.includes(verb))
  })

  if (verbLevels.includes(-1)) {
    return { valid: false, reason: 'One or more outcomes use invalid CBC verbs' }
  }

  // Ensure progressive cognitive order
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
    'learner',
    'student',
    'group',
    'discuss',
    'perform',
    'participate',
    'work',
  ]

  const combined = experiences.join(' ').toLowerCase()

  if (!learnerKeywords.some(k => combined.includes(k))) {
    return {
      valid: false,
      reason: 'Learning experiences must be learner-centered',
    }
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
    return {
      valid: false,
      reason: 'Inquiry questions lack higher-order thinking',
    }
  }

  return { valid: true }
}

function validateAssessmentMethods(methods: string[] = []): { valid: boolean; reason?: string } {
  if (!Array.isArray(methods) || methods.length === 0) {
    return { valid: false, reason: 'Assessment methods missing' }
  }

  const forbidden = ['exam', 'test', 'cat', 'marks']

  const combined = methods.join(' ').toLowerCase()

  if (forbidden.some(word => combined.includes(word))) {
    return {
      valid: false,
      reason: 'Summative assessment not allowed in lesson SOW',
    }
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
    return {
      valid: false,
      reason: 'Unrealistic learning resources detected',
    }
  }

  return { valid: true }
}

// Prevent hallucination drift
function validateSubstrandAlignment(
  lesson: Record<string, any>,
  substrandTitle = ''
): { valid: boolean; reason?: string } {
  if (!substrandTitle) return { valid: true }

  const combined = [
    ...(lesson.learning_outcomes || []),
    ...(lesson.learning_experiences || []),
    ...(lesson.key_inquiry_questions || []),
  ]
    .join(' ')
    .toLowerCase()

  if (!combined.includes(substrandTitle.toLowerCase())) {
    return {
      valid: false,
      reason: 'Lesson content not aligned to substrand focus',
    }
  }

  return { valid: true }
}

// ================= MAIN EXPORT =================
export function validateLesson(
  lesson: Record<string, any>,
  substrandTitle = ''
): { isValid: boolean; issues: string[] } {
  const checks = [
    validateLearningOutcomes(lesson.learning_outcomes),
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
