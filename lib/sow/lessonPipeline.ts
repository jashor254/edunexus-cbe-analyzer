// lib/sow/lessonPipeline.ts
// Adapted from jashor-app lessonPipeline.js
// Removes aiClient — uses generateValidatedLesson directly (DeepSeek).
// Adds curriculumMode support for CBC and 8-4-4.

import { allocateLessons } from './lessonAllocator'
import { generateValidatedLesson } from './aiLessonGenerator'
import { VerbRotationEngine } from './verbRotationEngine'
import { DiversityEngine, auditDiversity } from './diversityEngine'
import type {
  SOWContext,
  SelectedSubstrand,
  TimelineSlot,
  GeneratedLesson,
  SOWGenerationResult,
} from './types'

export interface PipelineInput {
  timeline: TimelineSlot[]
  selectedSubstrands: SelectedSubstrand[]
  context: SOWContext
}

function detectSubjectType(name: string, curriculumMode: string): string {
  const s = name.toLowerCase()
  const isKcse = curriculumMode.startsWith('844')
  const isCbcSenior = curriculumMode === 'cbc_senior'

  if (s.includes('math'))
    return isKcse ? 'kcse_mathematics'
         : isCbcSenior ? 'cbc_senior_mathematics'
         : 'mathematics'

  if (s.includes('english'))
    return isKcse ? 'kcse_english'
         : isCbcSenior ? 'cbc_senior_english'
         : 'default'

  if (s.includes('kiswahili') || s.includes('fasihi'))
    return isKcse ? 'kcse_kiswahili'
         : isCbcSenior ? 'cbc_senior_kiswahili'
         : 'kiswahili'

  if (s.includes('biology'))
    return isKcse ? 'kcse_biology'
         : isCbcSenior ? 'cbc_senior_biology'
         : 'science'

  if (s.includes('chemistry'))
    return isKcse ? 'kcse_chemistry'
         : isCbcSenior ? 'cbc_senior_chemistry'
         : 'science'

  if (s.includes('physics'))
    return isKcse ? 'kcse_physics'
         : isCbcSenior ? 'cbc_senior_physics'
         : 'science'

  if (s.includes('history') || s.includes('government'))
    return isKcse ? 'kcse_history'
         : isCbcSenior ? 'cbc_senior_history'
         : 'default'

  if (s.includes('geography'))
    return isKcse ? 'kcse_geography'
         : isCbcSenior ? 'cbc_senior_geography'
         : 'default'

  if (s.includes('business'))
    return isKcse ? 'kcse_business'
         : isCbcSenior ? 'cbc_senior_business'
         : 'default'

  if (s.includes('agriculture') || s.includes('nutrition'))
    return isKcse ? 'kcse_agriculture' : 'default'

  if (s.includes('computer') || s.includes('ict'))
    return isCbcSenior ? 'cbc_senior_computer' : 'default'

  if (s.includes('cre') || s.includes('ire') || s.includes('religion') ||
      s.includes('islamic') || s.includes('christian'))
    return isKcse ? 'kcse_religion' : 'default'

  if (s.includes('home science'))
    return isKcse ? 'kcse_home_science' : 'default'

  if (s.includes('science') || s.includes('integrated'))
    return isKcse ? 'kcse_biology' : 'science'

  return 'default'
}

/**
 * Distributes totalSlots evenly across substrands.
 * First `remainder` substrands get base+1, rest get base. Guarantees sum === totalSlots.
 * Never throws — returns [] when no slots available.
 */
function distributeSlots(
  totalSlots: number,
  substrands: SelectedSubstrand[]
): SelectedSubstrand[] {
  if (substrands.length === 0 || totalSlots <= 0) return []

  const base      = Math.floor(totalSlots / substrands.length)
  const remainder = totalSlots % substrands.length

  return substrands.map((sub, i) => ({
    ...sub,
    lessonsRequired: Math.max(1, base + (i < remainder ? 1 : 0)),
  }))
}

export async function generateSchemePipeline(
  input: PipelineInput
): Promise<SOWGenerationResult> {
  const { timeline, selectedSubstrands, context } = input

  if (!timeline || !selectedSubstrands?.length) {
    throw new Error('Timeline and substrands are required')
  }

  // STEP 1: Scale substrands to fill every teaching slot
  const teachingSlots = timeline.filter(s => !s.isBreak).length

  if (teachingSlots <= 0) {
    return {
      status: 'failed',
      summary: { totalSlots: 0, generated: 0, failed: 0 },
      lessons: [],
      failures: [],
    }
  }

  const scaledSubstrands = distributeSlots(teachingSlots, selectedSubstrands)
  const subjectType = detectSubjectType(context.learningAreaName, context.curriculumMode)

  const allocatedLessons = allocateLessons({
    timeline,
    selectedSubstrands: scaledSubstrands,
  })

  const lessons: GeneratedLesson[] = []
  const failures: SOWGenerationResult['failures'] = []
  const verbEngine      = new VerbRotationEngine(15)
  const diversityEngine = new DiversityEngine()
  const isCBC           = context.curriculumMode.startsWith('cbc')

  const BATCH_SIZE = 5  // smaller batches so diversity seeds differ within each batch

  // STEP 2: Generate lessons in parallel batches
  for (let i = 0; i < allocatedLessons.length; i += BATCH_SIZE) {
    const batch = allocatedLessons.slice(i, i + BATCH_SIZE)
    // Snapshot verb avoid-list before batch (shared across batch)
    const previousVerbs = verbEngine.getRecentVerbs()

    const batchResults = await Promise.all(
      batch.map((slot, batchIdx) => {
        const totalLessonsForSubstrand =
          scaledSubstrands.find(s => s.substrandTitle === slot.substrand)
            ?.lessonsRequired || 1

        // Each lesson in the batch gets a UNIQUE diversity seed
        // so parallel lessons don't all produce the same structure
        const diversitySeed = diversityEngine.next(isCBC)

        return generateValidatedLesson({
          learningArea:   context.learningAreaName,
          grade:          context.gradeName,
          strand:         slot.strand,
          substrand:      slot.substrand,
          lessonNumber:   slot.lessonInSubstrand,
          totalLessons:   totalLessonsForSubstrand,
          curriculumMode: context.curriculumMode,
          subjectType,
          previousVerbs,
          diversitySeed,
          textbook:       context.textbook ?? 'Class textbook',
          kicdContext:    context.kicdContext,
        }).then(result => ({ slot, result }))
      })
    )

    for (const { slot, result } of batchResults) {
      const { week, lesson, strand, substrand } = slot
      if (result._validated) {
        const outcomes = result.learning_outcomes || []
        // Feed outcomes to the engine — it extracts verbs and updates its window
        verbEngine.recordUsed(outcomes)
        lessons.push({
          week,
          lesson,
          strand,
          substrand,
          learningOutcomes: outcomes,
          learningExperiences: result.learning_experiences || [],
          keyInquiryQuestions: result.key_inquiry_questions || [],
          learningResources: result.learning_resources || [],
          assessmentMethods: result.assessment_methods || [],
          coreCompetencies: result.core_competencies || '',
          values: result.values || '',
          pciLinks: result.pci_links || '',
          reflection: '',
          _validated: true,
          _confidence: result._confidence,
        })
      } else {
        failures.push({
          week,
          lesson,
          strand,
          substrand,
          error: result.details || 'Generation failed',
        })
      }
    }
  }

  // STEP 3: Diversity audit (non-blocking — logs issues but does not fail)
  if (lessons.length > 1) {
    const audit = auditDiversity(lessons)
    if (!audit.passed) {
      console.warn('[SOW diversity audit] issues found:')
      audit.issues.forEach(issue => console.warn('  •', issue))
    }
  }

  // STEP 4: Return preview-safe structure
  return {
    status:
      failures.length === 0
        ? 'complete'
        : lessons.length === 0
        ? 'failed'
        : 'partial',
    summary: {
      totalSlots: teachingSlots,
      generated: lessons.length,
      failed: failures.length,
    },
    lessons,
    failures,
  }
}
