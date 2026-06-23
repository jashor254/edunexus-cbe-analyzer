import { createServiceClient } from '@/utils/supabase/service'
import type { AcademyReflection, ReflectionInput, ReflectionFeedback } from './types'

export async function upsertReflection(
  teacherId: string,
  input: ReflectionInput,
  feedback: ReflectionFeedback
): Promise<AcademyReflection> {
  const db = createServiceClient()

  const wordCount =
    [input.tried, input.worked, input.failed, input.surprised, input.next_action]
      .join(' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length

  const { data, error } = await db
    .from('academy_reflections')
    .upsert(
      {
        teacher_id:   teacherId,
        lesson_id:    input.lesson_id,
        module_id:    input.module_id,
        tried:        input.tried,
        worked:       input.worked,
        failed:       input.failed,
        surprised:    input.surprised,
        next_action:  input.next_action,
        ai_feedback:  feedback.feedback_text,
        quality_score: feedback.quality_score,
        word_count:   wordCount,
        updated_at:   new Date().toISOString(),
      },
      { onConflict: 'teacher_id,lesson_id' }
    )
    .select('id, teacher_id, lesson_id, module_id, tried, worked, failed, surprised, next_action, ai_feedback, quality_score, word_count, created_at, updated_at')
    .single()

  if (error) throw new Error(`Failed to save reflection: ${error.message}`)
  return data
}

export async function getReflectionsForModule(
  teacherId: string,
  moduleId: string
): Promise<AcademyReflection[]> {
  const db = createServiceClient()

  const { data, error } = await db
    .from('academy_reflections')
    .select('id, teacher_id, lesson_id, module_id, tried, worked, failed, surprised, next_action, ai_feedback, quality_score, word_count, created_at, updated_at')
    .eq('teacher_id', teacherId)
    .eq('module_id', moduleId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch reflections: ${error.message}`)
  return data ?? []
}

export async function getReflectionForLesson(
  teacherId: string,
  lessonId: string
): Promise<AcademyReflection | null> {
  const db = createServiceClient()

  const { data } = await db
    .from('academy_reflections')
    .select('id, teacher_id, lesson_id, module_id, tried, worked, failed, surprised, next_action, ai_feedback, quality_score, word_count, created_at, updated_at')
    .eq('teacher_id', teacherId)
    .eq('lesson_id', lessonId)
    .maybeSingle()

  return data ?? null
}

export async function getReflectionStats(teacherId: string): Promise<{
  total: number
  avgScore: number | null
  latestAt: string | null
}> {
  const db = createServiceClient()

  const { data, error } = await db
    .from('academy_reflections')
    .select('quality_score, created_at')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch reflection stats: ${error.message}`)

  const rows = data ?? []
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
