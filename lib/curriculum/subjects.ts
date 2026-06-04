// ─── Senior School (Grade 10–12) — KICD-aligned ──────────────────────────────

export const SENIOR_PATHWAYS = [
  'STEM',
  'Social Sciences',
  'Arts & Sports Science',
] as const

export type SeniorPathway = typeof SENIOR_PATHWAYS[number]

export const SENIOR_COMPULSORY_COUNT = 4
export const SENIOR_ELECTIVE_COUNT   = 3

export function getSeniorCompulsorySubjects(pathway: SeniorPathway): string[] {
  const math = pathway === 'STEM' ? 'Core Mathematics' : 'Essential Mathematics'
  return [
    math,
    'English',
    'Kiswahili / Kenya Sign Language',
    'Community Service Learning',
  ]
}

export const SENIOR_PATHWAY_ELECTIVES: Record<SeniorPathway, string[]> = {
  'STEM': [
    'Advanced Mathematics',
    'Biology',
    'Chemistry',
    'Physics',
    'General Science',
    'Agriculture',
    'Home Science',
    'Computer Studies',
    'Business Studies',
    'Geography',
    'Aviation',
    'Building Construction',
    'Electricity',
    'Marine & Fisheries',
    'Media Technology',
    'Metal Work',
    'Power Mechanics',
    'Wood Work',
  ],
  'Social Sciences': [
    'History & Citizenship',
    'Geography',
    'CRE/IRE/HRE',
    'Business Studies',
    'Computer Studies',
    'General Science',
    'Advanced Mathematics',
    'Literature in English',
    'Fasihi ya Kiswahili',
    'Arabic',
    'French',
    'German',
    'Mandarin',
    'Chinese',
    'Sign Language',
    'Indigenous Language',
  ],
  'Arts & Sports Science': [
    'Fine Arts',
    'Music & Dance',
    'Theatre & Film',
    'Sports & Recreation',
    'Biology',
    'General Science',
    'Business Studies',
    'Computer Studies',
    'CRE/IRE/HRE',
    'Fasihi ya Kiswahili',
    'French',
    'Geography',
    'German',
    'History & Citizenship',
    'Literature in English',
    'Mandarin',
    'Advanced Mathematics',
    'Arabic',
    'Media Technology',
  ],
}

export function getSeniorSubjectsForStudent(
  pathway: SeniorPathway,
  electives: string[]
): string[] {
  return [...getSeniorCompulsorySubjects(pathway), ...electives]
}

export function validateSeniorSubjects(
  pathway: SeniorPathway,
  electives: string[]
): { valid: boolean; error?: string } {
  if (electives.length !== SENIOR_ELECTIVE_COUNT) {
    return {
      valid: false,
      error: `Select exactly ${SENIOR_ELECTIVE_COUNT} elective subjects (${electives.length} selected)`,
    }
  }
  const pool = SENIOR_PATHWAY_ELECTIVES[pathway]
  const invalid = electives.filter(e => !pool.includes(e))
  if (invalid.length > 0) {
    return {
      valid: false,
      error: `Invalid subjects for ${pathway}: ${invalid.join(', ')}`,
    }
  }
  return { valid: true }
}

// ─── Legacy senior pathway type (kept for backward compatibility) ─────────────

export type CbcSeniorPathway =
  | 'arts_sports'
  | 'social_sciences'
  | 'stem'
  | 'applied_sciences'
  | 'business_studies'

export const CBC_SENIOR_PATHWAY_META: Record<CbcSeniorPathway, { label: string; subjects: string[] }> = {
  arts_sports: {
    label: 'Arts & Sports Science',
    subjects: ['Fine Art', 'Music', 'Theatre Arts & Film', 'Physical Education'],
  },
  social_sciences: {
    label: 'Social Sciences',
    subjects: ['History & Citizenship', 'Geography', 'CRE', 'IRE'],
  },
  stem: {
    label: 'STEM',
    subjects: ['Biology', 'Physics', 'Chemistry', 'Computer Science'],
  },
  applied_sciences: {
    label: 'Applied Sciences',
    subjects: ['Agriculture', 'Home Science', 'Aviation Technology', 'Marine Fisheries'],
  },
  business_studies: {
    label: 'Business Studies',
    subjects: ['Business Studies', 'Economics'],
  },
}

export const CBC_JUNIOR_CORE: string[] = [
  'Mathematics',
  'English',
  'Kiswahili',
  'Integrated Science',
  'Social Studies',
  'Pre-Technical Studies',
  'Agriculture and Nutrition',
  'Creative Arts & Sports',
]

export const CBC_JUNIOR_RELIGION: string[] = ['CRE', 'IRE']

export const CBC_SENIOR_CORE: string[] = ['Mathematics', 'English', 'Kiswahili']

export const F844_SUBJECTS: string[] = [
  'Mathematics',
  'English',
  'Kiswahili',
  'Biology',
  'Chemistry',
  'Physics',
  'History & Government',
  'Geography',
  'CRE',
  'IRE',
  'HRE',
  'Business Studies',
  'Agriculture',
  'Home Science',
  'Computer Studies',
  'Art & Design',
  'Music',
  'French',
  'German',
  'Arabic',
]

export function getSubjectsForClass(
  grade: number,
  curriculum: 'cbc' | '844',
  pathway?: CbcSeniorPathway
): string[] {
  if (curriculum === '844') return [...F844_SUBJECTS]
  if (grade >= 7 && grade <= 9) {
    return [...CBC_JUNIOR_CORE, ...CBC_JUNIOR_RELIGION]
  }
  const subjects = [...CBC_SENIOR_CORE]
  if (pathway) subjects.push(...(CBC_SENIOR_PATHWAY_META[pathway]?.subjects ?? []))
  return subjects
}
