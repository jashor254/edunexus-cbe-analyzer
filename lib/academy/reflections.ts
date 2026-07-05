import { repos } from '@/lib/repositories'
import type { AcademyReflection, ReflectionInput, ReflectionFeedback } from './types'

export async function upsertReflection(
  teacherId: string,
  input: ReflectionInput,
  feedback: ReflectionFeedback
): Promise<AcademyReflection> {
  const wordCount =
    [input.tried, input.worked, input.failed, input.surprised, input.next_action]
      .join(' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length

  return repos.academy.upsertReflection(teacherId, input, feedback, wordCount)
}

export async function getReflectionsForModule(
  teacherId: string,
  moduleId: string
): Promise<AcademyReflection[]> {
  return repos.academy.findReflectionsByModule(teacherId, moduleId)
}

export async function getReflectionForLesson(
  teacherId: string,
  lessonId: string
): Promise<AcademyReflection | null> {
  return repos.academy.findReflectionForLesson(teacherId, lessonId)
}

export async function getReflectionStats(teacherId: string): Promise<{
  total: number
  avgScore: number | null
  latestAt: string | null
}> {
  const rows = await repos.academy.findReflectionScores(teacherId)

  const scored = rows.filter(r => r.quality_score !== null)
  const avgScore =
    scored.length > 0
      ? Math.round((scored.reduce((s, r) => s + (r.quality_score ?? 0), 0) / scored.length) * 10) / 10
      : null

  return {
    total: rows.length,
    avgScore,
    latestAt: rows[0]?.created_at ?? null,
  }
}
