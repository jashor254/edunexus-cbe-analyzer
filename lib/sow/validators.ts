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

// English content is the default; a Kiswahili learning area (subjectType
// starting 'kiswahili', or the senior/KCSE variants) switches to a parallel
// Swahili keyword set instead of stacking languages — correctly-written
// Swahili content contains none of the English words and was always failing
// this check.
function isKiswahiliSubjectType(subjectType: string): boolean {
  return subjectType.startsWith('kiswahili')
}

function validateLearningExperiences(
  experiences: string[] = [],
  subjectType = 'default',
): { valid: boolean; reason?: string } {
  if (!Array.isArray(experiences) || experiences.length === 0) {
    return { valid: false, reason: 'Learning experiences missing' }
  }

  const learnerKeywords = isKiswahiliSubjectType(subjectType)
    ? ['mwanafunzi', 'wanafunzi', 'kundi', 'jadili', 'jadiliana', 'fanya', 'shirikiana', 'onyesha', 'soma', 'andika', 'sikiliza', 'imba', 'cheza']
    : ['learner', 'student', 'group', 'discuss', 'perform', 'participate', 'work']

  const combined = experiences.join(' ').toLowerCase()

  if (!learnerKeywords.some(k => combined.includes(k))) {
    return { valid: false, reason: 'Learning experiences must be learner-centered' }
  }

  return { valid: true }
}

function validateInquiryQuestions(
  questions: string[] = [],
  subjectType = 'default',
): { valid: boolean; reason?: string } {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { valid: false, reason: 'Inquiry questions missing' }
  }

  const combined = questions.join(' ').toLowerCase()

  // Universal across languages: a question is a question if it's punctuated
  // as one.
  if (!combined.includes('?')) {
    return { valid: false, reason: 'Inquiry questions must be in question form' }
  }

  const higherOrderStarters = isKiswahiliSubjectType(subjectType)
    ? ['vipi', 'kwa nini', 'kwa njia gani', 'kwa kiwango gani', 'ni nini', 'ni kwa nini', 'eleza', 'je', 'nini', 'gani', 'kina nani']
    : ['how', 'why', 'in what ways', 'to what extent']

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

function validatePresent(items: unknown, what: string): { valid: boolean; reason?: string } {
  return Array.isArray(items) && items.length > 0
    ? { valid: true }
    : { valid: false, reason: `${what} missing` }
}

// Content copied verbatim from the KICD curriculum design is not held to the
// generator's style heuristics: KICD outcomes are written in the infinitive
// ("kueleza…", "kutambua…") that the verb-level pools do not list, and many
// KICD inquiry questions ("Mawaidha hushirikisha kina nani?") use none of
// the "higher-order starters". Failing them would make the generator retry
// until it rewrote the official wording — exactly what grounding prevents.
export type ValidateLessonOptions = {
  outcomesFromKicd?: boolean
  inquiryFromKicd?: boolean
  // Language lessons (Kiswahili, English) never need to name an ethnic
  // community — the KICD language designs name none — so a generated one
  // that does is rejected and retried. Names that appear in `allowedText`
  // (strand / sub-strand titles, KICD slice) are permitted.
  rejectEthnicReferences?: boolean
  allowedText?: string
}

// People-forms of Kenyan community names, plus "jamii ya / kabila la"
// constructions. People-forms only, so place names (Kisii town, Meru,
// Embu, Turkana county) in a neutral context are not flagged.
const ETHNIC_TERMS = [
  'kikuyu', 'wakikuyu', 'agikuyu', 'gikuyu', 'luo', 'waluo', 'luhya', 'waluhya', 'abaluhya',
  'kalenjin', 'wakalenjin', 'kamba', 'wakamba', 'akamba', 'wakisii', 'abagusii', 'gusii',
  'wameru', 'ameru', 'maasai', 'wamaasai', 'masai', 'mijikenda', 'wamijikenda', 'wasomali',
  'waturkana', 'waembu', 'wataita', 'wapokot', 'wasamburu', 'wateso', 'wakuria', 'wanandi', 'wakipsigis',
]
const COMMUNITY_CONSTRUCTION = /\b(?:jamii\s+ya|kabila\s+la|makabila\s+ya|harusi\s+za|wazee\s+wa)\s+(?:wa)?([A-Z][a-z]+)/g

export function findEthnicReferences(texts: string[], allowedText = ''): string[] {
  const allowed = allowedText.toLowerCase()
  const found = new Set<string>()
  for (const text of texts) {
    const lower = text.toLowerCase()
    for (const term of ETHNIC_TERMS) {
      if (new RegExp(`\\b${term}\\b`).test(lower) && !allowed.includes(term)) found.add(term)
    }
    for (const m of text.matchAll(COMMUNITY_CONSTRUCTION)) {
      const name = m[1].toLowerCase()
      // "jamii ya Kenya" / "jamii ya Kikenya" is the nation, not a community.
      if (!/^(ki)?kenya/.test(name) && !allowed.includes(name)) found.add(name)
    }
  }
  return [...found]
}

function validateNoEthnicReferences(lesson: Record<string, unknown>, allowedText: string): { valid: boolean; reason?: string } {
  const texts = [
    ...((lesson.learning_outcomes as string[]) || []),
    ...((lesson.learning_experiences as string[]) || []),
    ...((lesson.key_inquiry_questions as string[]) || []),
    ...((lesson.assessment_methods as string[]) || []),
  ].filter((t): t is string => typeof t === 'string')
  const found = findEthnicReferences(texts, allowedText)
  return found.length
    ? { valid: false, reason: `Names an ethnic community (${found.join(', ')})` }
    : { valid: true }
}

// ================= MAIN EXPORT =================
export function validateLesson(
  lesson: Record<string, unknown>,
  substrandTitle = '',
  subjectType = 'default',
  options: ValidateLessonOptions = {},
): { isValid: boolean; issues: string[] } {
  const verbOrder = VERB_ORDERS[subjectType] ?? VERB_ORDERS.default
  const checks = [
    options.outcomesFromKicd
      ? validatePresent(lesson.learning_outcomes, 'Learning outcomes')
      : validateLearningOutcomes(lesson.learning_outcomes as string[], verbOrder, subjectType),
    validateLearningExperiences(lesson.learning_experiences as string[], subjectType),
    options.inquiryFromKicd
      ? validatePresent(lesson.key_inquiry_questions, 'Inquiry questions')
      : validateInquiryQuestions(lesson.key_inquiry_questions as string[], subjectType),
    validateAssessmentMethods(lesson.assessment_methods as string[]),
    validateLearningResources(lesson.learning_resources as string[]),
    validateSubstrandAlignment(lesson, substrandTitle),
    ...(options.rejectEthnicReferences
      ? [validateNoEthnicReferences(lesson, `${substrandTitle} ${options.allowedText ?? ''}`)]
      : []),
  ]

  const failed = checks.filter(c => !c.valid)

  return {
    isValid: failed.length === 0,
    issues:  failed.map(f => f.reason || 'Unknown validation error'),
  }
}

// Re-export for any consumer that imports verb data from this module
export { MULTI_WORD_L3 }
