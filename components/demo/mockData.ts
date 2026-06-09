export type Trend = 'improving' | 'stable' | 'declining'
export type Level = 1 | 2 | 3 | 4

export type SubjectData = {
  name: string
  emoji: string
  level: Level
  trend: Trend
  clinicalNote: string
}

export const LEVEL_LABEL: Record<Level, string> = {
  1: 'Emerging',
  2: 'Developing',
  3: 'Proficient',
  4: 'Exemplary',
}

export const LEVEL_LONG: Record<Level, string> = {
  1: 'Emerging',
  2: 'Developing',
  3: 'Proficient',
  4: 'Exemplary',
}

export const LEVEL_BADGE_CLASS: Record<Level, string> = {
  1: 'bg-red-100 text-red-700 border border-red-200',
  2: 'bg-amber-100 text-amber-700 border border-amber-200',
  3: 'bg-green-100 text-green-700 border border-green-200',
  4: 'bg-teal-100 text-teal-700 border border-teal-200',
}

export const LEVEL_BAR_CLASS: Record<Level, string> = {
  1: 'bg-red-400',
  2: 'bg-amber-400',
  3: 'bg-green-500',
  4: 'bg-teal-500',
}

export const LEVEL_PCT: Record<Level, number> = {
  1: 25,
  2: 50,
  3: 75,
  4: 100,
}

export const SUBJECTS: SubjectData[] = [
  {
    name: 'Mathematics',
    emoji: '🔢',
    level: 3,
    trend: 'improving',
    clinicalNote:
      'Moved from Developing to Proficient this term — algebra and number patterns now solid. Consolidate linear equations and data handling before KCSE transition to Core Mathematics.',
  },
  {
    name: 'English',
    emoji: '📖',
    level: 3,
    trend: 'stable',
    clinicalNote:
      'Proficient across comprehension, grammar, and composition. Essay structure meets Grade 9 CBC benchmarks. Strong foundation for humanities and professional pathways.',
  },
  {
    name: 'Kiswahili',
    emoji: '🗣️',
    level: 4,
    trend: 'stable',
    clinicalNote:
      'Exemplary national language competency. Lugha na Fasihi both at outstanding standard. Significant career asset for law, diplomacy, public service, and any community-facing pathway in Kenya.',
  },
  {
    name: 'Integrated Science',
    emoji: '🔬',
    level: 3,
    trend: 'stable',
    clinicalNote:
      'Solid scientific reasoning across ecology, matter, and Newton\'s Laws units. Practical investigation skills developing well — on track for the Biology, Chemistry, Physics split at Grade 10.',
  },
  {
    name: 'Social Studies',
    emoji: '🌍',
    level: 4,
    trend: 'improving',
    clinicalNote:
      'Exemplary civic and geographical understanding. Outstanding performance in Kenya\'s devolution structure, East Africa economic community units, and map interpretation — genuine Social Sciences pathway aptitude.',
  },
  {
    name: 'Pre-Technical Studies',
    emoji: '🔧',
    level: 2,
    trend: 'stable',
    clinicalNote:
      'Developing technical competency. Design and draw exercises and materials classification need consolidation. Structured hands-on workshop practice this holiday is clinically recommended before Grade 10.',
  },
  {
    name: 'Creative Arts & Sports',
    emoji: '🎨',
    level: 3,
    trend: 'stable',
    clinicalNote:
      'Consistent creative and physical engagement across Visual Arts and Athletics. Well-rounded practical expression is a notable co-curricular strength worth developing further.',
  },
  {
    name: 'Agriculture & Nutrition',
    emoji: '🌱',
    level: 3,
    trend: 'improving',
    clinicalNote:
      'Improved from Developing last term — soil science, crop production, and food groups now at Proficient level. Real-world farm context is clearly supporting retention. Maintain momentum.',
  },
  {
    name: 'CRE',
    emoji: '✝️',
    level: 3,
    trend: 'stable',
    clinicalNote:
      'Consistent applied ethics and values competency within the CBC religious education framework. Strong reflective reasoning aligned with Social Sciences pathway character profile.',
  },
]

export const STUDENT = {
  name: 'Brian Otieno',
  grade: 9,
  school: 'Nairobi Academy',
  term: 1,
  year: 2026,
  reportId: 'EC-2026-BT9K2M',
  generatedDate: '19 May 2026',
  overallLevel: 3.2,
  overallLabel: 'Proficient',
  trajectory: 'IMPROVING',
  trajectoryNote: 'Mathematics recovering well',
  pathwayRecommendation: 'Social Sciences',
  pathwayConfidence: 'HIGH CONFIDENCE',
}

export const PAGE_TITLES = [
  'Cover',
  'Clinical Overview',
  'Subject Matrix',
  'Pathway Analysis',
  'Holiday Plan',
  'Learning Compass',
  'Teacher Collaboration',
] as const
