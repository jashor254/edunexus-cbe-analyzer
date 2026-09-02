import { createServiceClient } from '@/utils/supabase/service'
import {
  getEilsItems,
  getWeeklyIntelligenceItems,
  getStudentAlertItems,
  getLivePrerequisiteAlerts,
  fetchMondayPanelRows,
  mapMondayStudentRisk,
  mapInterventionCheckins,
  mapCareerMoments,
  mapTeachingPatterns,
} from './sources'
import { getDismissedKeys } from './dismissals'
import { getTeacherAttentionTier } from './tier'
import type { AttentionItem, AttentionSeverity, AttentionSource } from './types'

const SEVERITY_RANK: Record<AttentionSeverity, number> = {
  critical: 4,
  at_risk:  3,
  watch:    2,
  info:     1,
}

// When two sources surface the same underlying issue (same itemKey), prefer
// the freshest, most actionable summary. Live knowledge-graph computation
// outranks the batched Monday-panel cache, which can be up to 24h stale.
const SOURCE_PRIORITY: Record<AttentionSource, number> = {
  knowledge_graph:     5,
  monday_panel:        4,
  eils:                3,
  student_alert:       2,
  weekly_intelligence: 1,
}

function dedupeAndRank(items: AttentionItem[]): AttentionItem[] {
  const byKey = new Map<string, AttentionItem>()

  for (const item of items) {
    const existing = byKey.get(item.itemKey)
    if (!existing) {
      byKey.set(item.itemKey, item)
      continue
    }
    const itemRank     = SEVERITY_RANK[item.severity]
    const existingRank  = SEVERITY_RANK[existing.severity]
    if (
      itemRank > existingRank ||
      (itemRank === existingRank && SOURCE_PRIORITY[item.source] > SOURCE_PRIORITY[existing.source])
    ) {
      byKey.set(item.itemKey, item)
    }
  }

  return [...byKey.values()].sort((a, b) => {
    if (a.flagship !== b.flagship) return a.flagship ? -1 : 1
    const rankDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
    if (rankDiff !== 0) return rankDiff
    return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
  })
}

export async function buildAttentionFeed(teacherId: string): Promise<AttentionItem[]> {
  const tier = await getTeacherAttentionTier(teacherId)

  // Tier 0 — no assessment data yet: only basic operational alerts, if any.
  if (tier === 0) {
    const alertItems = await getStudentAlertItems(teacherId)
    return dedupeAndRank(alertItems)
  }

  const db = createServiceClient()
  const { data: classes, error } = await db
    .from('teacher_classes')
    .select('id')
    .eq('teacher_id', teacherId)
    // Archived classes must not keep generating attention-feed alerts —
    // same gap as classListProjection.ts (status had no reader anywhere).
    .eq('status', 'active')

  if (error) throw new Error(`Failed to fetch teacher classes: ${error.message}`)
  const classIds = (classes ?? []).map((c) => c.id as string)

  const [prereqItems, alertItems, dismissedKeys] = await Promise.all([
    getLivePrerequisiteAlerts(classIds),
    getStudentAlertItems(teacherId),
    getDismissedKeys(teacherId),
  ])

  // Tier 1 — the flagship prerequisite-chain insight, computed live so it
  // never depends on someone having opened the Monday-panel screen first.
  let all: AttentionItem[] = [...prereqItems, ...alertItems]

  if (tier >= 2) {
    const [eilsItems, weeklyItems, mondayRows] = await Promise.all([
      getEilsItems(teacherId, classIds),
      getWeeklyIntelligenceItems(teacherId),
      fetchMondayPanelRows(teacherId),
    ])
    all = [
      ...all,
      ...eilsItems,
      ...weeklyItems,
      ...mapMondayStudentRisk(mondayRows),
      ...mapInterventionCheckins(mondayRows),
    ]

    if (tier >= 3) {
      all = [...all, ...mapCareerMoments(mondayRows), ...mapTeachingPatterns(mondayRows)]
    }
  }

  const filtered = all.filter((item) => !dismissedKeys.has(item.itemKey))
  return dedupeAndRank(filtered)
}
