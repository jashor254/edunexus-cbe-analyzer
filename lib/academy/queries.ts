import { createServiceClient } from '@/utils/supabase/service'
import type {
  ModuleWithProgress,
  ModuleWithLessons,
  LessonWithCompletion,
  LessonStub,
  AcademyStats,
  PhaseStats,
} from './types'

export async function getModulesWithProgress(teacherId: string): Promise<ModuleWithProgress[]> {
  const db = createServiceClient()

  const { data: modules, error: modErr } = await db
    .from('academy_modules')
    .select('id, title, slug, phase, order, description, estimated_mins, color, published, created_at')
    .eq('published', true)
    .order('phase')
    .order('order')

  if (modErr) throw new Error(`Failed to fetch academy modules: ${modErr.message}`)

  const moduleIds = (modules ?? []).map(m => m.id)

  const [lessonsRes, progressRes] = await Promise.all([
    db.from('academy_lessons')
      .select('id, module_id, title, order, created_at')
      .in('module_id', moduleIds)
      .order('order'),
    db.from('academy_progress')
      .select('lesson_id')
      .eq('teacher_id', teacherId),
  ])

  if (lessonsRes.error) throw new Error(`Failed to fetch lessons: ${lessonsRes.error.message}`)

  const completedIds = new Set((progressRes.data ?? []).map(p => p.lesson_id))

  return (modules ?? []).map(m => {
    const lessons: LessonStub[] = (lessonsRes.data ?? []).filter(l => l.module_id === m.id)
    const completedCount = lessons.filter(l => completedIds.has(l.id)).length
    return { ...m, lessons, completedCount }
  })
}

export async function getPhaseStats(modules: ModuleWithProgress[]): Promise<PhaseStats[]> {
  const phases = [...new Set(modules.map(m => m.phase))].sort()

  const statsByPhase = new Map<number, { total: number; completed: number }>()
  for (const m of modules) {
    const existing = statsByPhase.get(m.phase) ?? { total: 0, completed: 0 }
    statsByPhase.set(m.phase, {
      total: existing.total + m.lessons.length,
      completed: existing.completed + m.completedCount,
    })
  }

  return phases.map((phase, idx) => {
    const { total, completed } = statsByPhase.get(phase) ?? { total: 0, completed: 0 }
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0
    const allComplete = total > 0 && completed >= total

    let locked = false
    let earlyAccess = false

    if (idx === 0) {
      // Phase 1 always unlocked
    } else {
      const prevPhase = phases[idx - 1]
      const prev = statsByPhase.get(prevPhase) ?? { total: 0, completed: 0 }
      const prevPct = prev.total > 0 ? Math.round((prev.completed / prev.total) * 100) : 0
      if (prevPct < 50) {
        locked = true
      } else if (prevPct < 100) {
        earlyAccess = true
      }
    }

    return { phase, totalLessons: total, completedLessons: completed, pct, allComplete, earlyAccess, locked }
  })
}

export async function getModuleWithLessons(slug: string, teacherId: string): Promise<ModuleWithLessons | null> {
  const db = createServiceClient()

  const { data: module, error: modErr } = await db
    .from('academy_modules')
    .select('id, title, slug, phase, order, description, estimated_mins, color, published, created_at')
    .eq('slug', slug)
    .eq('published', true)
    .single()

  if (modErr || !module) return null

  const { data: rawLessons, error: lessonErr } = await db
    .from('academy_lessons')
    .select('id, module_id, title, order, content, practice_prompt, practice_link, created_at')
    .eq('module_id', module.id)
    .order('order')

  if (lessonErr) throw new Error(`Failed to fetch lessons: ${lessonErr.message}`)

  const lessonIds = (rawLessons ?? []).map(l => l.id)

  const { data: progress } = lessonIds.length
    ? await db
        .from('academy_progress')
        .select('lesson_id, completed_at')
        .eq('teacher_id', teacherId)
        .in('lesson_id', lessonIds)
    : { data: [] }

  const progressMap = new Map(
    (progress ?? []).map(p => [p.lesson_id, p.completed_at as string])
  )

  const lessons: LessonWithCompletion[] = (rawLessons ?? []).map(l => ({
    ...l,
    practice_link: l.practice_link ?? null,
    completed: progressMap.has(l.id),
    completed_at: progressMap.get(l.id) ?? null,
  }))

  const completedCount = lessons.filter(l => l.completed).length

  return { ...module, lessons, completedCount }
}

export async function getAdjacentModules(currentOrder: number, phase: number): Promise<{
  prev: { slug: string; title: string } | null
  next: { slug: string; title: string } | null
}> {
  const db = createServiceClient()

  const [prevRes, nextRes] = await Promise.all([
    db.from('academy_modules')
      .select('slug, title')
      .eq('phase', phase)
      .eq('published', true)
      .lt('order', currentOrder)
      .order('order', { ascending: false })
      .limit(1),
    db.from('academy_modules')
      .select('slug, title')
      .eq('phase', phase)
      .eq('published', true)
      .gt('order', currentOrder)
      .order('order', { ascending: true })
      .limit(1),
  ])

  return {
    prev: prevRes.data?.[0] ?? null,
    next: nextRes.data?.[0] ?? null,
  }
}

export async function getAcademyStats(teacherId: string): Promise<AcademyStats> {
  const db = createServiceClient()

  const { data: phase1Modules } = await db
    .from('academy_modules')
    .select('id')
    .eq('published', true)
    .eq('phase', 1)

  const phase1ModuleIds = (phase1Modules ?? []).map(m => m.id)

  if (!phase1ModuleIds.length) {
    return { totalLessons: 0, completedLessons: 0, allComplete: false }
  }

  const { data: phase1Lessons } = await db
    .from('academy_lessons')
    .select('id')
    .in('module_id', phase1ModuleIds)

  const phase1LessonIds = (phase1Lessons ?? []).map(l => l.id)
  const totalLessons = phase1LessonIds.length

  const { count: completedLessons } = phase1LessonIds.length
    ? await db
        .from('academy_progress')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', teacherId)
        .in('lesson_id', phase1LessonIds)
    : { count: 0 }

  return {
    totalLessons,
    completedLessons: completedLessons ?? 0,
    allComplete: totalLessons > 0 && (completedLessons ?? 0) >= totalLessons,
  }
}

export async function markLessonComplete(teacherId: string, lessonId: string): Promise<void> {
  const db = createServiceClient()

  const { error } = await db
    .from('academy_progress')
    .upsert({ teacher_id: teacherId, lesson_id: lessonId }, { onConflict: 'teacher_id,lesson_id' })

  if (error) throw new Error(`Failed to mark lesson complete: ${error.message}`)
}
