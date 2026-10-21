// lib/sow/types.ts
// Shared TypeScript interfaces for the Scheme of Work generator

import type { AICostContext } from '@/lib/ai/deepseek'

export type CurriculumMode =
  | 'cbc_junior'
  | 'cbc_senior'
  | '844_form3'
  | '844_form4'

export interface SOWContext {
  school: string
  teacherName?: string
  tscNumber?: string
  grade: string
  gradeName: string
  learningArea: string
  learningAreaName: string
  term: 1 | 2 | 3
  year: number
  curriculumMode: CurriculumMode
  textbook?: string
  // KICD grounding is NOT part of the context: it is loaded server-side from
  // the selected strand ids (lib/sow/kicdGrounding.ts). A client-supplied
  // `kicdContext` used to be trusted here as "official KICD content".
  // Optional — when the caller resolved an organization for this teacher,
  // every AI call in the pipeline records its real token cost against it.
  // Omitted entirely for teachers with no resolvable organization (no
  // behavior change, per lib/ai/deepseek.ts's costContext contract).
  costContext?: AICostContext
}

export interface LessonStructure {
  lessonsPerWeek: number
  firstWeek: number
  firstLesson: number
  lastWeek: number
  lastLesson: number
  doubleLessonOption: 'single' | 'double'
  doubleLessonCombination?: string
}

export interface BreakItem {
  id: string
  title: string
  startWeek: number
  startLesson: number
  endWeek: number
  endLesson: number
}

export interface SelectedSubstrand {
  strandId: string
  strandTitle: string
  substrandId: string
  substrandTitle: string
  lessonsRequired: number
  orderIndex: number
  subtopics?: string[]
}

export interface TimelineSlot {
  slotIndex: number
  week: number
  lesson: number
  isBreak: boolean
}

export interface AllocatedLesson {
  slotIndex: number
  week: number
  lesson: number
  strand: string
  substrand: string
  // Curriculum Identity Preservation Contract (H5A-1/H5A-2) — the real
  // sow_substrands.id the teacher selected upstream, carried around the AI
  // generation call rather than through it. Null only if the upstream
  // SelectedSubstrand somehow lacked one (no such path exists today, but
  // this mirrors every other producer's null-safe contract rather than
  // assuming it can never happen).
  substrandId: string | null
  // The selected strand's id, carried the same way — the key KICD grounding
  // is looked up by (lib/sow/kicdGrounding.ts).
  strandId: string | null
  lessonInSubstrand: number
}

export interface GeneratedLesson {
  week: number
  lesson: number
  strand: string
  substrand: string
  // Curriculum Identity Preservation Contract (H5A-1/H5A-2) — see
  // AllocatedLesson.substrandId. AI generation never sees or touches this
  // field; it is reattached from the allocation slot after generation, so
  // generated prose cannot alter curriculum identity (CUR-SOW-003).
  substrandId: string | null
  learningOutcomes: string[]
  learningExperiences: string[]
  keyInquiryQuestions: string[]
  learningResources: string[]
  assessmentMethods: string[]
  coreCompetencies: string
  values: string
  pciLinks: string
  reflection: string
  // The KICD sub-strand this lesson's outcomes were taken from, e.g.
  // "11.4.1 Mnyambuliko wa Vitenzi" — absent on ungrounded lessons and on
  // schemes saved before grounding existed.
  kicdEntryTitle?: string
  _validated: boolean
  _confidence: number
  isBreak?:      boolean
  breakName?:    string
  breakDetails?: string
}

export interface SOWGenerationResult {
  status: 'complete' | 'partial' | 'failed'
  summary: {
    totalSlots: number
    generated: number
    failed: number
    // Generated lessons whose outcomes came from a matched KICD sub-strand.
    grounded: number
  }
  lessons: GeneratedLesson[]
  failures: Array<{
    week: number
    lesson: number
    strand: string
    substrand: string
    error: string
  }>
  // True only when EVERY generated lesson was grounded in a matched KICD
  // sub-strand (summary.grounded === summary.generated > 0). It used to be
  // true whenever strand rows existed — including every subject whose
  // kicd_data is an empty array. CBC/CBE trust audit requirement: grounding
  // gaps are surfaced to the teacher, never presented as KICD-aligned.
  // See app/teacher/scheme-of-work/new/page.tsx.
  groundedInKicd: boolean
}

export interface SOWPreviewData {
  meta: {
    school: string
    teacherName?: string
    tscNumber?: string
    grade: string
    learningArea: string
    term: string
    year: number
    textbook: string
    totalLessons: number
    totalWeeks: number
    lessonsPerWeek?: number
    generatedDate: string
    curriculumMode: CurriculumMode
    averageConfidence: number
  }
  lessons: GeneratedLesson[]
  breaks: BreakItem[]
}
