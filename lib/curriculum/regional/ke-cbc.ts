// lib/curriculum/regional/ke-cbc.ts
// Kenya CBC curriculum adapter — the canonical reference implementation.
// All other adapters normalise to CBC's 1–4 level scale for cross-comparison.

import type {
  CurriculumAdapter, GradeRange, GradingDescriptor,
  TermCalendar, SubjectMap, AssessmentConfig,
} from './types'

const GRADE_RANGES: GradeRange[] = [
  { min: 1,  max: 3,  label: 'Lower Primary' },
  { min: 4,  max: 6,  label: 'Upper Primary' },
  { min: 7,  max: 9,  label: 'Junior Secondary' },
  { min: 10, max: 12, label: 'Senior Secondary' },
]

const GRADING_SCALE: GradingDescriptor[] = [
  { code: 'EE', label: 'Exceeding Expectations',   minPct: 75, maxPct: 100, cbcLevel: 4 },
  { code: 'ME', label: 'Meeting Expectations',     minPct: 50, maxPct: 74,  cbcLevel: 3 },
  { code: 'AE', label: 'Approaching Expectations', minPct: 25, maxPct: 49,  cbcLevel: 2 },
  { code: 'BE', label: 'Below Expectations',       minPct: 0,  maxPct: 24,  cbcLevel: 1 },
]

const TERM_CALENDAR: TermCalendar[] = [
  { term: 1, startMonth: 1, endMonth: 3,  name: 'Term 1' },
  { term: 2, startMonth: 5, endMonth: 7,  name: 'Term 2' },
  { term: 3, startMonth: 9, endMonth: 11, name: 'Term 3' },
]

const ASSESSMENT_CONFIG: AssessmentConfig = {
  maxMarks:        100,
  passThreshold:   50,
  formativeWeight: 0.4,
  summativeWeight: 0.6,
}

const SUBJECTS: SubjectMap[] = [
  { canonicalId: 'mathematics',       localName: 'Mathematics',            code: 'CBC-MATH' },
  { canonicalId: 'english',           localName: 'English',                code: 'CBC-ENG' },
  { canonicalId: 'kiswahili',         localName: 'Kiswahili',              code: 'CBC-KIS' },
  { canonicalId: 'integrated_science',localName: 'Integrated Science',     code: 'CBC-SCI' },
  { canonicalId: 'social_studies',    localName: 'Social Studies',         code: 'CBC-SST' },
  { canonicalId: 'creative_arts',     localName: 'Creative Arts & Sports', code: 'CBC-CAS' },
  { canonicalId: 'pre_technical',     localName: 'Pre-Technical Studies',  code: 'CBC-PTS' },
  { canonicalId: 'religious_education',localName:'Religious Education',    code: 'CBC-RE' },
  // Senior Secondary electives
  { canonicalId: 'physics',           localName: 'Physics',                code: 'CBC-PHY' },
  { canonicalId: 'chemistry',         localName: 'Chemistry',              code: 'CBC-CHEM' },
  { canonicalId: 'biology',           localName: 'Biology',                code: 'CBC-BIO' },
  { canonicalId: 'geography',         localName: 'Geography',              code: 'CBC-GEO' },
  { canonicalId: 'history',           localName: 'History & Government',   code: 'CBC-HIS' },
  { canonicalId: 'computer_science',  localName: 'Computer Science',       code: 'CBC-CS' },
  { canonicalId: 'business_studies',  localName: 'Business Studies',       code: 'CBC-BUS' },
  { canonicalId: 'agriculture',       localName: 'Agriculture',            code: 'CBC-AGR' },
  { canonicalId: 'home_science',      localName: 'Home Science',           code: 'CBC-HS' },
  { canonicalId: 'art_design',        localName: 'Art & Design',           code: 'CBC-ART' },
  { canonicalId: 'music',             localName: 'Music',                  code: 'CBC-MUS' },
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
    s.localName.toLowerCase() === lower ||
    s.canonicalId === lower
  )?.canonicalId ?? null
}

function getCurrentTerm(date: Date = new Date()): number {
  const month = date.getMonth() + 1  // 1-indexed
  for (const t of TERM_CALENDAR) {
    if (month >= t.startMonth && month <= t.endMonth) return t.term
  }
  // In school break — return the upcoming term
  if (month < TERM_CALENDAR[0].startMonth) return 1
  if (month < TERM_CALENDAR[1].startMonth) return 2
  if (month < TERM_CALENDAR[2].startMonth) return 3
  return 1  // December break → Term 1 starts in January
}

export const KE_CBC: CurriculumAdapter = {
  countryCode:      'KE',
  curriculumId:     'CBC',
  displayName:      'Kenya CBC (Competency Based Curriculum)',
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
