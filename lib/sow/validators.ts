// lib/sow/validators.ts

import { scoreOutcome } from './verbLibrary'
import { VERB_ORDERS, SKILL_SYNONYMS, MULTI_WORD_L3, getMergedVerbOrder, getVerbLevel } from './verbHierarchy'

// ================= VALIDATORS =================
function validateLearningOutcomes(
  outcomes: string[] = [],
  verbOrder: string[][],
  subjectType = 'default',
): { valid: boolean; reason?: string } {
  if (!Array.isArray(outcomes) || outcomes.length < 3) {
    return { valid: false, reason: 'At least 3 learning outcomes required' }
  }

  const mergedOrder = getMergedVerbOrder(subjectType)
  const verbLevels = outcomes.map(o => getVerbLevel(o, mergedOrder))

  const resolvedLevels = verbLevels.map((lvl, i) => {
    if (lvl !== -1) return lvl
    const score = scoreOutcome(outcomes[i])
    if (score >= 7) return i === 0 ? 0 : i === 1 ? 1 : 2
    return -1
  })

  if (resolvedLevels.includes(-1)) {
    return { valid: false, reason: 'One or more outcomes use unrecognized verbs' }
  }

  for (let i = 1; i < resolvedLevels.length; i++) {
    if (resolvedLevels[i] < resolvedLevels[i - 1]) {
      return {
        valid: false,
        reason: 'Learning outcomes must progress from lower to higher cognitive order',
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

function validateSubstrandAlignment(
  lesson: Record<string, unknown>,
  substrandTitle = ''
): { valid: boolean; reason?: string } {
  if (!substrandTitle ||
      substrandTitle === 'ai-generated' ||
      substrandTitle.includes('Full Syllabus')) {
    return { valid: true }
  }

  const combined = [
    ...((lesson.learning_outcomes as string[]) || []),
    ...((lesson.learning_experiences as string[]) || []),
    ...((lesson.key_inquiry_questions as string[]) || []),
  ].join(' ').toLowerCase()

  const stopWords = new Set([
    'and', 'or', 'the', 'of', 'in', 'a', 'an', 'to', 'for',
    'with', 'on', 'at', 'from', 'by', 'its', 'their', 'use',
    'using', 'used', 'through', 'skills', 'ability', 'main',
  ])

  const titleWords = substrandTitle
    .toLowerCase()
    .split(/[\s\-:,/()]+/)
    .filter(w => w.length >= 3 && !stopWords.has(w))

  const partWords = substrandTitle
    .split(' - ')
    .join(' ')
    .toLowerCase()
    .split(/[\s\-:,/()]+/)
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
  lesson: Record<string, unknown>,
  substrandTitle = '',
  subjectType = 'default'
): { isValid: boolean; issues: string[] } {
  const verbOrder = VERB_ORDERS[subjectType] ?? VERB_ORDERS.default
  const checks = [
    validateLearningOutcomes(lesson.learning_outcomes as string[], verbOrder, subjectType),
    validateLearningExperiences(lesson.learning_experiences as string[]),
    validateInquiryQuestions(lesson.key_inquiry_questions as string[]),
    validateAssessmentMethods(lesson.assessment_methods as string[]),
    validateLearningResources(lesson.learning_resources as string[]),
    validateSubstrandAlignment(lesson, substrandTitle),
  ]

  const failed = checks.filter(c => !c.valid)

  return {
    isValid: failed.length === 0,
    issues:  failed.map(f => f.reason || 'Unknown validation error'),
  }
}

// Re-export for any consumer that imports verb data from this module
export { MULTI_WORD_L3 }
