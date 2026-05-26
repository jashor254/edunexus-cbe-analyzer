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
