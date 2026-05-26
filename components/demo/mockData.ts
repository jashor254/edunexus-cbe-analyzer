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
  1: 'Below Expectations',
  2: 'Approaching',
  3: 'Meeting',
  4: 'Exceeding',
}

export const LEVEL_LONG: Record<Level, string> = {
  1: 'Below Expectations',
  2: 'Approaching Expectations',
  3: 'Meeting Expectations',
  4: 'Exceeding Expectations',
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
    level: 2,
    trend: 'stable',
    clinicalNote:
      'Procedural gaps in algebraic reasoning. Structured daily practice targeting fractions and equations is clinically recommended.',
  },
  {
    name: 'English',
    emoji: '📖',
    level: 3,
    trend: 'improving',
    clinicalNote:
      'Demonstrates proficient language competency. Strong foundation for humanities and communication pathways.',
  },
  {
    name: 'Kiswahili',
    emoji: '🗣️',
    level: 3,
    trend: 'stable',
    clinicalNote:
      'Solid national language proficiency. Consistent performance supports Social Sciences pathway alignment.',
  },
  {
    name: 'Integrated Science',
    emoji: '🔬',
    level: 2,
    trend: 'declining',
    clinicalNote:
      '⚠️ DECLINING from Level 3. Conceptual gaps emerging in scientific reasoning. Immediate structured intervention recommended.',
  },
  {
    name: 'Social Studies',
    emoji: '🌍',
    level: 3,
    trend: 'improving',
    clinicalNote:
      'Authentic engagement with civic and social content. Performance aligns strongly with Social Sciences pathway recommendation.',
  },
  {
    name: 'Pre-Technical Studies',
    emoji: '🔧',
    level: 2,
    trend: 'stable',
    clinicalNote:
      'Developing foundational technical competency. Requires hands-on practice to consolidate design and construction skills.',
  },
  {
    name: 'Creative Arts & Sports',
    emoji: '🎨',
    level: 3,
    trend: 'stable',
    clinicalNote:
      'Consistent creative performance and physical engagement. Balanced expression across both arts and athletics observed.',
  },
  {
    name: 'Agriculture & Nutrition',
    emoji: '🌱',
    level: 2,
    trend: 'declining',
    clinicalNote:
      '⚠️ DECLINING. Practical application skills require reinforcement. Structured field engagement and nutritional case studies recommended.',
  },
  {
    name: 'CRE',
    emoji: '✝️',
    level: 3,
    trend: 'stable',
    clinicalNote:
      'Solid ethical and religious competency. Consistent performance supports well-rounded humanities profile.',
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
  overallLevel: 2.4,
  overallLabel: 'Approaching Expectations',
  trajectory: 'NEEDS ATTENTION',
  trajectoryNote: 'Integrated Science declining',
  pathwayRecommendation: 'Social Sciences',
  pathwayConfidence: 'MEDIUM CONFIDENCE',
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
