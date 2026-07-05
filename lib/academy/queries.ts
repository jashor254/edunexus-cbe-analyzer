import { repos } from '@/lib/repositories'
import type {
  ModuleWithProgress,
  ModuleWithLessons,
  LessonWithCompletion,
  LessonStub,
  AcademyStats,
  PhaseStats,
} from './types'

export async function getModulesWithProgress(teacherId: string): Promise<ModuleWithProgress[]> {
  const modules = await repos.academy.findPublishedModules()
  const moduleIds = modules.map(m => m.id)

  const [lessonStubs, progress] = await Promise.all([
    repos.academy.findLessonStubsByModuleIds(moduleIds),
    repos.academy.findProgressByTeacher(teacherId),
  ])

  const completedIds = new Set(progress.map(p => p.lesson_id))

  return modules.map(m => {
    const lessons: LessonStub[] = lessonStubs.filter(l => l.module_id === m.id)
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
  const academyModule = await repos.academy.findModuleBySlug(slug)
  if (!academyModule) return null

  const rawLessons = await repos.academy.findLessonsByModule(academyModule.id)
  const lessonIds = rawLessons.map(l => l.id)

  const progress = await repos.academy.findProgressForLessons(teacherId, lessonIds)

  const progressMap = new Map(
    progress.map(p => [p.lesson_id, p.completed_at])
  )

  const lessons: LessonWithCompletion[] = rawLessons.map(l => ({
    ...l,
    practice_link: l.practice_link ?? null,
    completed: progressMap.has(l.id),
    completed_at: progressMap.get(l.id) ?? null,
  }))

  const completedCount = lessons.filter(l => l.completed).length

  return { ...academyModule, lessons, completedCount }
}

export async function getAdjacentModules(currentOrder: number, phase: number): Promise<{
  prev: { slug: string; title: string } | null
  next: { slug: string; title: string } | null
}> {
  return repos.academy.findAdjacentModules(currentOrder, phase)
}

export async function getAcademyStats(teacherId: string): Promise<AcademyStats> {
  const phase1ModuleIds = await repos.academy.findModuleIdsByPhase(1)

  if (!phase1ModuleIds.length) {
    return { totalLessons: 0, completedLessons: 0, allComplete: false }
  }

  const phase1Lessons = await repos.academy.findLessonStubsByModuleIds(phase1ModuleIds)
  const phase1LessonIds = phase1Lessons.map(l => l.id)
  const totalLessons = phase1LessonIds.length

  const completedLessons = await repos.academy.countCompletedLessons(teacherId, phase1LessonIds)

  return {
    totalLessons,
    completedLessons,
    allComplete: totalLessons > 0 && completedLessons >= totalLessons,
  }
}

export async function markLessonComplete(teacherId: string, lessonId: string): Promise<void> {
  await repos.academy.upsertLessonProgress(teacherId, lessonId)
}
