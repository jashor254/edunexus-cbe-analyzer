// lib/curriculum/regional/tz-necta.ts
// Tanzania NECTA curriculum adapter.

import type {
  CurriculumAdapter, GradeRange, GradingDescriptor,
  TermCalendar, SubjectMap, AssessmentConfig,
} from './types'

const GRADE_RANGES: GradeRange[] = [
  { min: 1,  max: 7,  label: 'Primary (Standard 1-7)' },
  { min: 8,  max: 11, label: 'Ordinary Level (Form 1-4)' },
  { min: 12, max: 13, label: 'Advanced Level (Form 5-6)' },
]

const GRADING_SCALE: GradingDescriptor[] = [
  { code: 'A',  label: 'Excellent', minPct: 75, maxPct: 100, cbcLevel: 4 },
  { code: 'B',  label: 'Very Good', minPct: 65, maxPct: 74,  cbcLevel: 4 },
  { code: 'C',  label: 'Good',      minPct: 50, maxPct: 64,  cbcLevel: 3 },
  { code: 'D',  label: 'Satisfactory',minPct:40, maxPct: 49, cbcLevel: 2 },
  { code: 'E',  label: 'Adequate',  minPct: 30, maxPct: 39,  cbcLevel: 2 },
  { code: 'S',  label: 'Subsidiary',minPct: 25, maxPct: 29,  cbcLevel: 1 },
  { code: 'F',  label: 'Fail',      minPct: 0,  maxPct: 24,  cbcLevel: 1 },
]

const TERM_CALENDAR: TermCalendar[] = [
  { term: 1, startMonth: 1, endMonth: 3,  name: 'First Term' },
  { term: 2, startMonth: 5, endMonth: 7,  name: 'Second Term' },
  { term: 3, startMonth: 9, endMonth: 11, name: 'Third Term' },
]

const ASSESSMENT_CONFIG: AssessmentConfig = {
  maxMarks:        100,
  passThreshold:   40,
  formativeWeight: 0.3,
  summativeWeight: 0.7,
}

const SUBJECTS: SubjectMap[] = [
  { canonicalId: 'mathematics',       localName: 'Mathematics' },
  { canonicalId: 'english',           localName: 'English' },
  { canonicalId: 'kiswahili',         localName: 'Kiswahili' },
  { canonicalId: 'integrated_science',localName: 'Science' },
  { canonicalId: 'social_studies',    localName: 'Social Studies' },
  { canonicalId: 'geography',         localName: 'Geography' },
  { canonicalId: 'history',           localName: 'History' },
  { canonicalId: 'civics',            localName: 'Civics' },
  { canonicalId: 'biology',           localName: 'Biology' },
  { canonicalId: 'chemistry',         localName: 'Chemistry' },
  { canonicalId: 'physics',           localName: 'Physics' },
  { canonicalId: 'agriculture',       localName: 'Agriculture' },
  { canonicalId: 'computer_science',  localName: 'Computer Studies' },
  { canonicalId: 'home_science',      localName: 'Home Economics' },
  { canonicalId: 'commerce',          localName: 'Commerce' },
  { canonicalId: 'bookkeeping',       localName: 'Book Keeping' },
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

export const TZ_NECTA: CurriculumAdapter = {
  countryCode:      'TZ',
  curriculumId:     'NECTA',
  displayName:      'Tanzania NECTA',
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
