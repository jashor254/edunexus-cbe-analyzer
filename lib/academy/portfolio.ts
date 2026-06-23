import { createServiceClient } from '@/utils/supabase/service'
import { getModulesWithProgress, getPhaseStats } from './queries'
import { getReflectionStats } from './reflections'
import { getEvidenceStats } from './evidence'
import { getTotalXp } from './missions'
import { getTeacherCompetencyScores } from './competencies'
import { PHASE_META } from './types'
import type { PhaseStats } from './types'
import type { TeacherCompetency } from './competencies'

export type Badge = {
  id: string
  label: string
  description: string
  color: string
  earned: boolean
}

export type PortfolioData = {
  teacher: {
    id: string
    full_name: string | null
    school: string | null
    created_at: string
  }
  phaseStats: PhaseStats[]
  lessonStats: { completed: number; total: number }
  missionStats: { completed: number; avgAiScore: number | null }
  reflectionStats: { total: number; avgScore: number | null; latestAt: string | null }
  evidenceStats: { total: number; byType: Record<string, number> }
  totalXp: number
  toolUsage: {
    lessonPlans: number
    schemesOfWork: number
    recordsOfWork: number
  }
  badges: Badge[]
  competencies: TeacherCompetency[]
}

async function getMissionStats(teacherId: string): Promise<{ completed: number; avgAiScore: number | null }> {
  const db = createServiceClient()
  const { data } = await db
    .from('academy_mission_completions')
    .select('ai_score')
    .eq('teacher_id', teacherId)

  const rows = data ?? []
  const scored = rows.filter(r => r.ai_score !== null)
  const avgAiScore =
    scored.length > 0
      ? Math.round((scored.reduce((s, r) => s + (r.ai_score ?? 0), 0) / scored.length) * 10) / 10
      : null

  return { completed: rows.length, avgAiScore }
}

async function getToolUsage(teacherId: string): Promise<PortfolioData['toolUsage']> {
  const db = createServiceClient()

  const [lpRes, sowRes, rowRes] = await Promise.all([
    db.from('lesson_plans').select('id', { count: 'exact', head: true }).eq('teacher_id', teacherId),
    db.from('schemes_of_work').select('id', { count: 'exact', head: true }).eq('teacher_id', teacherId),
    db.from('records_of_work').select('id', { count: 'exact', head: true }).eq('teacher_id', teacherId),
  ])

  return {
    lessonPlans:   lpRes.count  ?? 0,
    schemesOfWork: sowRes.count ?? 0,
    recordsOfWork: rowRes.count ?? 0,
  }
}

function buildBadges(
  phaseStats: PhaseStats[],
  missionStats: { completed: number; avgAiScore: number | null },
  reflectionStats: { total: number; avgScore: number | null },
  evidenceStats: { total: number },
  toolUsage: PortfolioData['toolUsage']
): Badge[] {
  const badges: Badge[] = []

  // Phase badges — one per phase completed
  for (const ps of phaseStats) {
    const meta = PHASE_META.find(m => m.phase === ps.phase)
    if (!meta) continue
    badges.push({
      id:          `phase-${ps.phase}`,
      label:       meta.badge,
      description: `Completed Phase ${ps.phase}: ${meta.title}`,
      color:       meta.color,
      earned:      ps.allComplete,
    })
  }

  // Activity badges
  badges.push({
    id:          'first-reflection',
    label:       'First Reflection',
    description: 'Submitted your first classroom reflection',
    color:       '#7c3aed',
    earned:      reflectionStats.total >= 1,
  })
  badges.push({
    id:          'deep-thinker',
    label:       'Deep Thinker',
    description: 'Average reflection quality score of 4 or higher',
    color:       '#1d4ed8',
    earned:      (reflectionStats.avgScore ?? 0) >= 4,
  })
  badges.push({
    id:          'evidence-champion',
    label:       'Evidence Champion',
    description: 'Submitted 5 or more pieces of classroom evidence',
    color:       '#059669',
    earned:      evidenceStats.total >= 5,
  })
  badges.push({
    id:          'mission-starter',
    label:       'Mission Starter',
    description: 'Completed your first Academy mission',
    color:       '#d97706',
    earned:      missionStats.completed >= 1,
  })
  badges.push({
    id:          'cbc-judge',
    label:       'CBC Judge',
    description: 'Achieved an AI mission score of 4 or higher',
    color:       '#0891b2',
    earned:      (missionStats.avgAiScore ?? 0) >= 4,
  })
  badges.push({
    id:          'platform-pioneer',
    label:       'Platform Pioneer',
    description: 'Generated 10 or more lesson plans in EduNexus',
    color:       '#14b8a6',
    earned:      toolUsage.lessonPlans >= 10,
  })
  badges.push({
    id:          'sow-builder',
    label:       'SOW Builder',
    description: 'Created 3 or more Schemes of Work in EduNexus',
    color:       '#f97316',
    earned:      toolUsage.schemesOfWork >= 3,
  })

  return badges
}

export async function getPortfolioData(teacherId: string): Promise<PortfolioData> {
  const db = createServiceClient()

  const { data: teacher } = await db
    .from('teachers')
    .select('id, full_name, school, created_at')
    .eq('id', teacherId)
    .single()

  if (!teacher) throw new Error('Teacher not found')

  // All data fetched in parallel — no waterfalls
  const [
    modules,
    reflectionStats,
    evidenceStats,
    totalXp,
    missionStats,
    toolUsage,
    competencies,
  ] = await Promise.all([
    getModulesWithProgress(teacherId),
    getReflectionStats(teacherId),
    getEvidenceStats(teacherId),
    getTotalXp(teacherId),
    getMissionStats(teacherId),
    getToolUsage(teacherId),
    getTeacherCompetencyScores(teacherId),
  ])

  const phaseStats = await getPhaseStats(modules)

  const lessonStats = {
    completed: modules.reduce((s, m) => s + m.completedCount, 0),
    total:     modules.reduce((s, m) => s + m.lessons.length, 0),
  }

  const badges = buildBadges(phaseStats, missionStats, reflectionStats, evidenceStats, toolUsage)

  return {
    teacher: {
      id:         teacher.id,
      full_name:  teacher.full_name,
      school:     teacher.school,
      created_at: teacher.created_at,
    },
    phaseStats,
    lessonStats,
    missionStats,
    reflectionStats,
    evidenceStats,
    totalXp,
    toolUsage,
    badges,
    competencies,
  }
}
