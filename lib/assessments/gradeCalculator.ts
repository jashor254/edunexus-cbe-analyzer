export type CurriculumType = 'cbc' | '844'

export type MeanGrade =
  | 'EE' | 'ME' | 'AE' | 'BE'
  | 'A' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D+' | 'D' | 'D-' | 'E'

export const GRADE_META: Record<string, { cls: string; fullLabel: string }> = {
  EE:  { cls: 'bg-purple-100 text-purple-700', fullLabel: 'Exceeds Expectation'    },
  ME:  { cls: 'bg-green-100 text-green-700',   fullLabel: 'Meets Expectation'      },
  AE:  { cls: 'bg-amber-100 text-amber-700',   fullLabel: 'Approaches Expectation' },
  BE:  { cls: 'bg-red-100 text-red-700',       fullLabel: 'Below Expectation'      },
  A:   { cls: 'bg-purple-100 text-purple-700', fullLabel: 'Excellent'              },
  'B+':{ cls: 'bg-indigo-100 text-indigo-700', fullLabel: 'Very Good'              },
  B:   { cls: 'bg-green-100 text-green-700',   fullLabel: 'Good'                   },
  'B-':{ cls: 'bg-teal-100 text-teal-700',     fullLabel: 'Fairly Good'            },
  'C+':{ cls: 'bg-cyan-100 text-cyan-700',     fullLabel: 'Above Average'          },
  C:   { cls: 'bg-amber-100 text-amber-700',   fullLabel: 'Average'                },
  'C-':{ cls: 'bg-orange-100 text-orange-700', fullLabel: 'Pass'                   },
  'D+':{ cls: 'bg-rose-100 text-rose-600',     fullLabel: 'Below Average'          },
  D:   { cls: 'bg-red-100 text-red-700',       fullLabel: 'Poor'                   },
  'D-':{ cls: 'bg-red-200 text-red-800',       fullLabel: 'Very Poor'              },
  E:   { cls: 'bg-gray-100 text-gray-700',     fullLabel: 'Fail'                   },
}

export type GradeBand = {
  label:    string
  minPct:   number
  maxPct:   number
  colorCls: string
}

export type GradeScale = {
  id:             string
  name:           string
  curriculumHint: CurriculumType | 'custom'
  bands:          GradeBand[]
  isDefault?:     boolean
}

// CBC — 0-30 BE · 31-50 AE · 51-75 ME · 76-100 EE
export const BUILTIN_CBC_SCALE: Omit<GradeScale, 'id'> = {
  name:           'CBC (Standard)',
  curriculumHint: 'cbc',
  bands: [
    { label: 'EE', minPct: 76, maxPct: 100, colorCls: 'bg-purple-100 text-purple-700' },
    { label: 'ME', minPct: 51, maxPct: 75,  colorCls: 'bg-green-100 text-green-700'   },
    { label: 'AE', minPct: 31, maxPct: 50,  colorCls: 'bg-amber-100 text-amber-700'   },
    { label: 'BE', minPct: 0,  maxPct: 30,  colorCls: 'bg-red-100 text-red-700'       },
  ],
}

// 8-4-4 — full KNEC grading scale
export const BUILTIN_844_SCALE: Omit<GradeScale, 'id'> = {
  name:           '8-4-4 (KNEC)',
  curriculumHint: '844',
  bands: [
    { label: 'A',   minPct: 80, maxPct: 100, colorCls: 'bg-purple-100 text-purple-700' },
    { label: 'B+',  minPct: 75, maxPct: 79,  colorCls: 'bg-indigo-100 text-indigo-700' },
    { label: 'B',   minPct: 70, maxPct: 74,  colorCls: 'bg-green-100 text-green-700'   },
    { label: 'B-',  minPct: 65, maxPct: 69,  colorCls: 'bg-teal-100 text-teal-700'     },
    { label: 'C+',  minPct: 60, maxPct: 64,  colorCls: 'bg-cyan-100 text-cyan-700'     },
    { label: 'C',   minPct: 55, maxPct: 59,  colorCls: 'bg-amber-100 text-amber-700'   },
    { label: 'C-',  minPct: 50, maxPct: 54,  colorCls: 'bg-orange-100 text-orange-700' },
    { label: 'D+',  minPct: 45, maxPct: 49,  colorCls: 'bg-rose-100 text-rose-600'     },
    { label: 'D',   minPct: 40, maxPct: 44,  colorCls: 'bg-red-100 text-red-700'       },
    { label: 'D-',  minPct: 35, maxPct: 39,  colorCls: 'bg-red-200 text-red-800'       },
    { label: 'E',   minPct: 0,  maxPct: 34,  colorCls: 'bg-gray-100 text-gray-700'     },
  ],
}

export function getBuiltinScale(curriculum: CurriculumType): Omit<GradeScale, 'id'> {
  return curriculum === '844' ? BUILTIN_844_SCALE : BUILTIN_CBC_SCALE
}

export function calculateGradeFromScale(
  meanScore: number,
  maxScore: number,
  scale: Omit<GradeScale, 'id'>
): string {
  const pct = maxScore > 0 ? (meanScore / maxScore) * 100 : 0
  for (const band of scale.bands) {
    if (pct >= band.minPct) return band.label
  }
  return scale.bands[scale.bands.length - 1]?.label ?? 'BE'
}

export function gradeBandColorCls(
  label: string,
  scale?: Omit<GradeScale, 'id'>
): string {
  if (scale) {
    const band = scale.bands.find((b) => b.label === label)
    if (band) return band.colorCls
  }
  return GRADE_META[label]?.cls ?? 'bg-gray-100 text-gray-700'
}

export function calculateMeanGrade(
  meanScore: number,
  maxScore: number,
  curriculum: CurriculumType = 'cbc'
): MeanGrade {
  return calculateGradeFromScale(meanScore, maxScore, getBuiltinScale(curriculum)) as MeanGrade
}

export function calculateMeanScore(subjectScores: Record<string, number>): number {
  const values = Object.values(subjectScores).map(Number).filter((v) => !isNaN(v))
  if (!values.length) return 0
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
}

// ─── Marks → CBC Level ────────────────────────────────────────────────────────

// marksToLevel(74) → 3  Meeting ✓
// marksToLevel(75) → 4  Exceeding ✓
// marksToLevel(49) → 2  Approaching ✓
// marksToLevel(50) → 3  Meeting ✓
// marksToLevel(29) → 1  Below ✓
// marksToLevel(30) → 2  Approaching ✓

export const DEFAULT_MARKS_THRESHOLDS = {
  level4: 75,   // 75-100 → Exceeding Expectations
  level3: 50,   // 50-74  → Meeting Expectations
  level2: 30,   // 30-49  → Approaching Expectations
  level1: 0,    // 0-29   → Below Expectations
} as const

export type MarksThresholds = {
  level4: number
  level3: number
  level2: number
}

export type CBCLevel = 1 | 2 | 3 | 4

export function marksToLevel(
  marks:      number,
  thresholds: MarksThresholds = DEFAULT_MARKS_THRESHOLDS,
): CBCLevel {
  if (marks < 0 || marks > 100) {
    throw new Error(`Marks must be 0-100, got ${marks}`)
  }
  if (marks >= thresholds.level4) return 4
  if (marks >= thresholds.level3) return 3
  if (marks >= thresholds.level2) return 2
  return 1
}

export function levelToLabel(level: CBCLevel): string {
  const labels: Record<CBCLevel, string> = {
    4: 'Exceeding Expectations',
    3: 'Meeting Expectations',
    2: 'Approaching Expectations',
    1: 'Below Expectations',
  }
  return labels[level]
}

export function levelToShortLabel(level: CBCLevel): string {
  const labels: Record<CBCLevel, string> = {
    4: 'Exceeding',
    3: 'Meeting',
    2: 'Approaching',
    1: 'Below',
  }
  return labels[level]
}

export function levelToColor(level: CBCLevel): string {
  const colors: Record<CBCLevel, string> = {
    4: '#1D9E75',
    3: '#378ADD',
    2: '#EF9F27',
    1: '#E24B4A',
  }
  return colors[level]
}

// ─── Source of truth ──────────────────────────────────────────────────────────

export type AssessmentSource = 'teacher' | 'parent'

export function resolveLevel(
  teacherLevel: CBCLevel | null,
  parentLevel:  CBCLevel | null,
): { level: CBCLevel; source: AssessmentSource } | null {
  if (teacherLevel !== null) return { level: teacherLevel, source: 'teacher' }
  if (parentLevel  !== null) return { level: parentLevel,  source: 'parent'  }
  return null
}

// ─── School-level threshold config ───────────────────────────────────────────
// Stored in school settings (future feature).
// Default used when school has no custom config.

export interface SchoolGradeConfig {
  schoolId:   string
  thresholds: MarksThresholds
  updatedAt:  string
}

export function getSchoolThresholds(
  schoolConfig?: SchoolGradeConfig | null,
): MarksThresholds {
  return schoolConfig?.thresholds ?? DEFAULT_MARKS_THRESHOLDS
}

export function marksToLevelForSchool(
  marks:        number,
  schoolConfig?: SchoolGradeConfig | null,
): CBCLevel {
  return marksToLevel(marks, getSchoolThresholds(schoolConfig))
}

export function gradeBandKey(grade: string): 'EE' | 'ME' | 'AE' | 'BE' {
  if (grade === 'EE') return 'EE'
  if (grade === 'ME') return 'ME'
  if (grade === 'AE') return 'AE'
  if (grade === 'BE') return 'BE'
  // 8-4-4 → performance tier
  if (grade === 'A')                              return 'EE'
  if (grade === 'B+' || grade === 'B')            return 'ME'
  if (grade === 'B-' || grade === 'C+' || grade === 'C') return 'AE'
  return 'BE'
}
