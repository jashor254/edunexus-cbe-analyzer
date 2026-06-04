// lib/sow/types.ts
// Shared TypeScript interfaces for the Scheme of Work generator

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
  kicdContext?: {
    subjectData: Record<string, any>
    strandData: Array<{ title: string; kicd_data: any[] }>
    subtopicMap?: Record<string, string[]>
  }
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
  lessonInSubstrand: number
}

export interface GeneratedLesson {
  week: number
  lesson: number
  strand: string
  substrand: string
  learningOutcomes: string[]
  learningExperiences: string[]
  keyInquiryQuestions: string[]
  learningResources: string[]
  assessmentMethods: string[]
  coreCompetencies: string
  values: string
  pciLinks: string
  reflection: string
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
  }
  lessons: GeneratedLesson[]
  failures: Array<{
    week: number
    lesson: number
    strand: string
    substrand: string
    error: string
  }>
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
