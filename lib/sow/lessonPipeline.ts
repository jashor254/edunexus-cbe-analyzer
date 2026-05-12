// lib/sow/lessonPipeline.ts
// Adapted from jashor-app lessonPipeline.js
// Removes aiClient — uses generateValidatedLesson directly (DeepSeek).
// Adds curriculumMode support for CBC and 8-4-4.

import { allocateLessons } from './lessonAllocator'
import { generateValidatedLesson } from './aiLessonGenerator'
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

function detectSubjectType(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('math')) return 'mathematics'
  if (n.includes('biology') || n.includes('chemistry') || n.includes('physics') || n.includes('science'))
    return 'science'
  return 'default'
}

/**
 * Distributes totalSlots evenly across substrands.
 * All substrands are treated as equal weight (lessonsRequired coming in are all 1).
 * First `remainder` substrands get base+1, rest get base. Guarantees sum === totalSlots.
 */
function distributeSlots(
  totalSlots: number,
  substrands: SelectedSubstrand[]
): SelectedSubstrand[] {
  if (substrands.length === 0) return []
  if (totalSlots <= 0) throw new Error('No teaching slots available')

  const base = Math.floor(totalSlots / substrands.length)
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
  const scaledSubstrands = distributeSlots(teachingSlots, selectedSubstrands)
  const subjectType = detectSubjectType(context.learningAreaName)

  const allocatedLessons = allocateLessons({
    timeline,
    selectedSubstrands: scaledSubstrands,
  })

  const lessons: GeneratedLesson[] = []
  const failures: SOWGenerationResult['failures'] = []

  const BATCH_SIZE = 10

  // STEP 2: Generate lessons in parallel batches
  for (let i = 0; i < allocatedLessons.length; i += BATCH_SIZE) {
    const batch = allocatedLessons.slice(i, i + BATCH_SIZE)

    const batchResults = await Promise.all(
      batch.map(slot => {
        const totalLessonsForSubstrand =
          scaledSubstrands.find(s => s.substrandTitle === slot.substrand)
            ?.lessonsRequired || 1

        return generateValidatedLesson({
          learningArea: context.learningAreaName,
          grade: context.gradeName,
          strand: slot.strand,
          substrand: slot.substrand,
          lessonNumber: slot.lessonInSubstrand,
          totalLessons: totalLessonsForSubstrand,
          curriculumMode: context.curriculumMode,
          subjectType,
          kicdContext: context.kicdContext,
        }).then(result => ({ slot, result }))
      })
    )

    for (const { slot, result } of batchResults) {
      const { week, lesson, strand, substrand } = slot
      if (result._validated) {
        lessons.push({
          week,
          lesson,
          strand,
          substrand,
          learningOutcomes: result.learning_outcomes || [],
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

  // STEP 3: Return preview-safe structure
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
