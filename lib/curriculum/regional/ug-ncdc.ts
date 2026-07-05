// lib/curriculum/regional/ug-ncdc.ts
// Uganda NCDC curriculum adapter.

import type {
  CurriculumAdapter, GradeRange, GradingDescriptor,
  TermCalendar, SubjectMap, AssessmentConfig,
} from './types'

const GRADE_RANGES: GradeRange[] = [
  { min: 1, max: 7,  label: 'Primary' },
  { min: 1, max: 4,  label: 'O-Level (Senior 1-4)' },   // S1–S4
  { min: 5, max: 6,  label: 'A-Level (Senior 5-6)' },   // S5–S6
]

const GRADING_SCALE: GradingDescriptor[] = [
  { code: 'D1', label: 'Distinction 1', minPct: 80, maxPct: 100, cbcLevel: 4 },
  { code: 'D2', label: 'Distinction 2', minPct: 70, maxPct: 79,  cbcLevel: 4 },
  { code: 'C3', label: 'Credit 3',      minPct: 65, maxPct: 69,  cbcLevel: 3 },
  { code: 'C4', label: 'Credit 4',      minPct: 60, maxPct: 64,  cbcLevel: 3 },
  { code: 'C5', label: 'Credit 5',      minPct: 55, maxPct: 59,  cbcLevel: 3 },
  { code: 'C6', label: 'Credit 6',      minPct: 50, maxPct: 54,  cbcLevel: 3 },
  { code: 'P7', label: 'Pass 7',        minPct: 40, maxPct: 49,  cbcLevel: 2 },
  { code: 'P8', label: 'Pass 8',        minPct: 30, maxPct: 39,  cbcLevel: 2 },
  { code: 'F9', label: 'Fail 9',        minPct: 0,  maxPct: 29,  cbcLevel: 1 },
]

const TERM_CALENDAR: TermCalendar[] = [
  { term: 1, startMonth: 2,  endMonth: 5,  name: 'First Term' },
  { term: 2, startMonth: 6,  endMonth: 8,  name: 'Second Term' },
  { term: 3, startMonth: 9,  endMonth: 12, name: 'Third Term' },
]

const ASSESSMENT_CONFIG: AssessmentConfig = {
  maxMarks:        100,
  passThreshold:   40,
  formativeWeight: 0.3,
  summativeWeight: 0.7,
}

const SUBJECTS: SubjectMap[] = [
  { canonicalId: 'mathematics',       localName: 'Mathematics' },
  { canonicalId: 'english',           localName: 'English Language' },
  { canonicalId: 'integrated_science',localName: 'Science' },
  { canonicalId: 'social_studies',    localName: 'Social Studies' },
  { canonicalId: 'creative_arts',     localName: 'Creative Arts' },
  { canonicalId: 'kiswahili',         localName: 'Kiswahili' },
  { canonicalId: 'religious_education',localName:'Religious Education' },
  { canonicalId: 'physics',           localName: 'Physics' },
  { canonicalId: 'chemistry',         localName: 'Chemistry' },
  { canonicalId: 'biology',           localName: 'Biology' },
  { canonicalId: 'geography',         localName: 'Geography' },
  { canonicalId: 'history',           localName: 'History & Political Education' },
  { canonicalId: 'computer_science',  localName: 'Computer Studies' },
  { canonicalId: 'agriculture',       localName: 'Agriculture' },
  { canonicalId: 'home_science',      localName: 'Home Economics' },
]

function markToGrade(pct: number): GradingDescriptor {
  for (const grade of GRADING_SCALE) {
    if (pct >= grade.minPct && pct <= grade.maxPct) return grade
  }
  return GRADING_SCALE[GRADING_SCALE.length - 1]
}

function normalizeToCBCLevel(pct: number): 1 | 2 | 3 | 4 {
  return markToGrade(pct).cbcLevel ?? 1
}

function resolveSubject(localName: string): string | null {
  const lower = localName.toLowerCase().trim()
  return SUBJECTS.find(s =>
    s.localName.toLowerCase() === lower || s.canonicalId === lower
  )?.canonicalId ?? null
}

function getCurrentTerm(date: Date = new Date()): number {
  const month = date.getMonth() + 1
  for (const t of TERM_CALENDAR) {
    if (month >= t.startMonth && month <= t.endMonth) return t.term
  }
  return 1
}

export const UG_NCDC: CurriculumAdapter = {
  countryCode:      'UG',
  curriculumId:     'NCDC',
  displayName:      'Uganda NCDC',
  gradeRanges:      GRADE_RANGES,
  gradingScale:     GRADING_SCALE,
  termCalendar:     TERM_CALENDAR,
  assessmentConfig: ASSESSMENT_CONFIG,
  subjects:         SUBJECTS,
  markToGrade,
  normalizeToCBCLevel,
  resolveSubject,
  getCurrentTerm,
}
