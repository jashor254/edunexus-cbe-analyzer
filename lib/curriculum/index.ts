import { CBC_CONFIG } from './cbc.config'
import { IGCSE_CONFIG } from './igcse.config'
import type { CurriculumConfig, CurriculumType } from './types'

export const CURRICULUM_CONFIGS:
  Record<CurriculumType, CurriculumConfig> = {
  cbc: CBC_CONFIG,
  igcse: IGCSE_CONFIG,
  ib: CBC_CONFIG,    // placeholder — future
  other: CBC_CONFIG, // placeholder — future
}

export function getCurriculumConfig(
  type: CurriculumType
): CurriculumConfig {
  return CURRICULUM_CONFIGS[type] || CBC_CONFIG
}

export function getCurriculumPhase(
  type: CurriculumType,
  gradeOrYear: number
): 'junior' | 'senior' {
  if (type === 'cbc') {
    return gradeOrYear <= 9 ? 'junior' : 'senior'
  }
  if (type === 'igcse') {
    return gradeOrYear <= 9 ? 'junior' : 'senior'
  }
  return gradeOrYear <= 9 ? 'junior' : 'senior'
}

export function getSubjectsForPhase(
  type: CurriculumType,
  phase: 'junior' | 'senior'
) {
  const config = getCurriculumConfig(type)
  return config.phases.find(p =>
    p.phaseType === phase
  )?.subjects || []
}

export function getGradeLabel(
  type: CurriculumType,
  value: string | number
): string {
  const config = getCurriculumConfig(type)
  return config.gradeLabels.find(
    g => g.value == value
  )?.label || String(value)
}

export function getGradeColor(
  type: CurriculumType,
  value: string | number
): string {
  const config = getCurriculumConfig(type)
  return config.gradeLabels.find(
    g => g.value == value
  )?.color || '#6b7280'
}

export function getNumericScore(
  type: CurriculumType,
  value: string | number
): number {
  const config = getCurriculumConfig(type)
  return config.gradeLabels.find(
    g => g.value == value
  )?.numericEquivalent || 0
}

// Export everything
export { CBC_CONFIG, IGCSE_CONFIG }
export type { CurriculumConfig, CurriculumType }
