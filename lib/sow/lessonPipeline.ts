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

export async function generateSchemePipeline(
  input: PipelineInput
): Promise<SOWGenerationResult> {
  const { timeline, selectedSubstrands, context } = input

  if (!timeline || !selectedSubstrands?.length) {
    throw new Error('Timeline and substrands are required')
  }

  // STEP 1: Allocate lessons to slots
  const allocatedLessons = allocateLessons({
    timeline,
    selectedSubstrands,
  })

  const lessons: GeneratedLesson[] = []
  const failures: SOWGenerationResult['failures'] = []

  // STEP 2: Generate lessons one by one (safe & traceable)
  for (const slot of allocatedLessons) {
    const { week, lesson, strand, substrand, lessonInSubstrand } = slot

    const totalLessonsForSubstrand =
      selectedSubstrands.find(s => s.substrandTitle === substrand)
        ?.lessonsRequired || 1

    const result = await generateValidatedLesson({
      learningArea: context.learningAreaName,
      grade: context.gradeName,
      strand,
      substrand,
      lessonNumber: lessonInSubstrand,
      totalLessons: totalLessonsForSubstrand,
      curriculumMode: context.curriculumMode,
    })

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

  // STEP 3: Return preview-safe structure
  return {
    status:
      failures.length === 0
        ? 'complete'
        : lessons.length === 0
        ? 'failed'
        : 'partial',
    summary: {
      totalSlots: allocatedLessons.length,
      generated: lessons.length,
      failed: failures.length,
    },
    lessons,
    failures,
  }
}
