export type KcseTrend = 'improving' | 'stable' | 'declining'
export type KcseGrade = 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D+' | 'D' | 'D-' | 'E'
export type KcseStatus = 'strong' | 'developing' | 'critical'

export type KcseSubjectData = {
  name: string
  grade: KcseGrade
  pct: number
  trend: KcseTrend
  status: KcseStatus
  paperFocus: string
  clinicalNote: string
}

export const GRADE_BADGE_CLASS: Record<KcseStatus, string> = {
  strong: 'bg-green-100 text-green-700 border border-green-200',
  developing: 'bg-amber-100 text-amber-700 border border-amber-200',
  critical: 'bg-red-100 text-red-700 border border-red-200',
}

export const GRADE_BAR_CLASS: Record<KcseStatus, string> = {
  strong: 'bg-green-500',
  developing: 'bg-amber-400',
  critical: 'bg-red-500',
}

export const KCSE_STUDENT = {
  name: 'James Kamau',
  form: 3,
  school: 'Alliance High School',
  term: 1,
  year: 2026,
  reportId: 'KR-2026-JK3F8M',
  generatedDate: '25 May 2026',
  meanGrade: 'C+' as KcseGrade,
  targetGrade: 'B' as KcseGrade,
  monthsToMock: 8,
  trajectory: 'NEEDS ATTENTION',
  trajectoryNote: 'Chemistry declining',
  pathwayRecommendation: 'Humanities',
  pathwayConfidence: 'MEDIUM-HIGH CONFIDENCE',
}

export const KCSE_SUBJECTS: KcseSubjectData[] = [
  {
    name: 'Mathematics',
    grade: 'C+',
    pct: 55,
    trend: 'stable',
    status: 'developing',
    paperFocus: 'Paper 2 (calculus, statistics)',
    clinicalNote:
      'Paper 1 performance adequate. Paper 2 (calculus, statistics, vectors) needs structured practice before KCSE.',
  },
  {
    name: 'English',
    grade: 'B-',
    pct: 62,
    trend: 'improving',
    status: 'strong',
    paperFocus: 'Paper 3 (set texts)',
    clinicalNote:
      'Strong Paper 1 comprehension. Paper 3 set texts require dedicated revision — Blossoms of the Savannah analysis weak.',
  },
  {
    name: 'Kiswahili',
    grade: 'B',
    pct: 65,
    trend: 'stable',
    status: 'strong',
    paperFocus: 'Paper 2 (Fasihi)',
    clinicalNote:
      'Lugha (Paper 1) solid. Fasihi (Paper 2) set book analysis needs deeper engagement.',
  },
  {
    name: 'Biology',
    grade: 'C',
    pct: 52,
    trend: 'declining',
    status: 'developing',
    paperFocus: 'Paper 3 (practicals, genetics)',
    clinicalNote:
      '⚠️ DECLINING — was C+ last term. Paper 3 practical skills and genetics require immediate attention.',
  },
  {
    name: 'Chemistry',
    grade: 'D+',
    pct: 42,
    trend: 'declining',
    status: 'critical',
    paperFocus: 'Paper 2 (organic, moles)',
    clinicalNote:
      '🚨 CRITICAL — highest risk subject. Mole calculations and organic chemistry fundamentals must be addressed urgently. Pulling mean grade down.',
  },
  {
    name: 'Physics',
    grade: 'C+',
    pct: 56,
    trend: 'stable',
    status: 'developing',
    paperFocus: 'Paper 2 (electricity)',
    clinicalNote:
      'Paper 2 electricity and magnetism topics need revision. Practical skills (Paper 3) are adequate.',
  },
  {
    name: 'History & Govt',
    grade: 'B',
    pct: 66,
    trend: 'improving',
    status: 'strong',
    paperFocus: 'Paper 2 (World history)',
    clinicalNote:
      'Paper 1 Kenya history strong. Paper 2 World history showing improvement. Maintain current revision momentum.',
  },
  {
    name: 'Geography',
    grade: 'C+',
    pct: 57,
    trend: 'stable',
    status: 'developing',
    paperFocus: 'Paper 1 (map reading)',
    clinicalNote:
      'Map reading (Paper 1 compulsory question) needs practice — easy marks available. Human geography (Paper 2) is adequate.',
  },
  {
    name: 'CRE',
    grade: 'B-',
    pct: 61,
    trend: 'stable',
    status: 'strong',
    paperFocus: 'Applied ethics technique',
    clinicalNote:
      'Consistent performance. Applied ethics questions need more structured answer technique.',
  },
]

export const KCSE_PATHWAYS = [
  {
    name: 'SCIENCES / STEM',
    sub: 'Mathematics & Sciences pathway',
    pct: 34,
    recommended: false,
    barColor: 'bg-blue-400',
    note: 'Chemistry D+ is a barrier — requires significant improvement',
  },
  {
    name: 'HUMANITIES',
    sub: 'Languages, History, Social Sciences',
    pct: 71,
    recommended: true,
    barColor: 'bg-amber-400',
    note: 'Strong English, Kiswahili, History align well with this pathway',
  },
  {
    name: 'TECHNICAL / VOCATIONAL',
    sub: 'Technical subjects pathway',
    pct: 48,
    recommended: false,
    barColor: 'bg-amber-400',
    note: '',
  },
]

export const KCSE_PAGE_TITLES = [
  'Cover',
  'KCSE Readiness Overview',
  'Subject Performance',
  'University Pathway',
  '8-Week Study Plan',
  'Learning Compass',
  'Teacher Reference',
] as const
