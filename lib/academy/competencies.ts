import { repos } from '@/lib/repositories'

export type TeacherCompetency = {
  id: string
  label: string
  description: string
  category: 'ai_skills' | 'pedagogy' | 'values' | 'leadership'
  color: string
  totalModules: number
  completedModules: number
  score: number  // 0–5, 1 decimal place
}

export async function getTeacherCompetencyScores(teacherId: string): Promise<TeacherCompetency[]> {
  const [competencies, mappings, progress, publishedModules] = await Promise.all([
    repos.academy.findCompetencies(),
    repos.academy.findModuleCompetencyMappings(),
    repos.academy.findProgressByTeacher(teacherId),
    repos.academy.findPublishedModules(),
  ])

  const allModuleIds = publishedModules.map(m => m.id)
  const allLessons = await repos.academy.findLessonIdsByModuleIds(allModuleIds)

  const doneIds    = new Set(progress.map(r => r.lesson_id))

  // Per-module: how many lessons total vs completed
  const moduleCounts = new Map<string, { total: number; done: number }>()
  for (const lesson of allLessons) {
    const entry = moduleCounts.get(lesson.module_id) ?? { total: 0, done: 0 }
    entry.total += 1
    if (doneIds.has(lesson.id)) entry.done += 1
    moduleCounts.set(lesson.module_id, entry)
  }

  // Set of fully-completed module IDs
  const completedModules = new Set<string>()
  for (const [mid, counts] of moduleCounts) {
    if (counts.total > 0 && counts.done === counts.total) completedModules.add(mid)
  }

  // Per-competency: which module IDs are mapped to it
  const compToModules = new Map<string, Set<string>>()
  for (const m of mappings) {
    if (!compToModules.has(m.competency_id)) compToModules.set(m.competency_id, new Set())
    compToModules.get(m.competency_id)!.add(m.module_id)
  }

  return competencies.map(c => {
    const moduleIds       = compToModules.get(c.id) ?? new Set<string>()
    const totalMods       = moduleIds.size
    const completedMods   = [...moduleIds].filter(id => completedModules.has(id)).length
    const score           = totalMods > 0 ? Math.round((completedMods / totalMods) * 50) / 10 : 0

    return {
      id:               c.id,
      label:            c.label,
      description:      c.description,
      category:         c.category as TeacherCompetency['category'],
      color:            c.color,
      totalModules:     totalMods,
      completedModules: completedMods,
      score,
    }
  })
}
