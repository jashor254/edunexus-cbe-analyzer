// lib/config/features.ts
// Simple in-process feature flags.
// When scaling beyond pioneer cohort: replace PIONEER_TEACHER_IDS with a DB query
// against a `feature_flags` table so flags can be toggled without a deploy.

export type Feature =
  | 'learning-compass'
  | 'academic-clinic'
  | 'teacher-compass'
  | 'igcse-beta'

// Auth user IDs (auth.users.id) for pioneer beta teachers who get all features.
export const PIONEER_TEACHER_IDS = new Set<string>([
  // 'uuid-1',
  // 'uuid-2',
])

export function isFeatureEnabled(
  userId: string | undefined,
  feature: Feature
): boolean {
  if (!userId) {
    return feature === 'learning-compass' // public demo only
  }

  if (PIONEER_TEACHER_IDS.has(userId)) {
    return true // pioneers get everything
  }

  switch (feature) {
    case 'learning-compass':  return true
    case 'academic-clinic':   return true
    case 'teacher-compass':   return false
    case 'igcse-beta':        return false
  }
}
