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
