import { createServiceClient } from '@/utils/supabase/service'
import type { RemedialCard, SubstrandHealthRow, QuickCheckContent } from './types'

type RemActionRow = {
  id: string
  substrand_health_id: string | null
  suggested_activity: string
  questions: string[]
  generated_at: string
}

type WIRow = {
  sow_id: string
  remedial_bank_items: SubstrandHealthRow[]
}

// Returns remedial cards for the teacher's most recent weekly intelligence.
// teachersId: teachers.id (UUID stored in weekly_intelligence by the cron)
// authUserId: auth user id (UUID stored in remedial_actions and substrand_health)
// sowId: optional filter to a specific scheme
export async function getRemedialBankForTeacher(
  teachersId: string,
  authUserId: string,
  sowId?: string
): Promise<RemedialCard[]> {
  const db = createServiceClient()

  // Fetch most recent weekly_intelligence rows for this teacher (up to 3 SOWs)
  let wiQuery = db
    .from('weekly_intelligence')
    .select('sow_id, remedial_bank_items')
    .eq('teacher_id', teachersId)
    .order('created_at', { ascending: false })
    .limit(sowId ? 1 : 3)

  if (sowId) {
    wiQuery = wiQuery.eq('sow_id', sowId) as typeof wiQuery
  }

  const { data: wiRows } = await wiQuery
  if (!wiRows?.length) return []

  // Flatten remedial_bank_items across all returned rows, deduplicating by sub_strand+sow_id
  const allItems: (SubstrandHealthRow & { sow_id: string })[] = []
  const seen = new Set<string>()

  for (const wi of wiRows as WIRow[]) {
    const items = (wi.remedial_bank_items ?? []) as SubstrandHealthRow[]
    for (const item of items) {
      const key = `${wi.sow_id}:${item.sub_strand}`
      if (!seen.has(key)) {
        seen.add(key)
        allItems.push({ ...item, sow_id: wi.sow_id })
      }
    }
  }

  if (!allItems.length) return []

  // Batch-fetch existing quick checks for all health row IDs in one query
  const healthIds = allItems.map(i => i.id).filter(Boolean)
  const { data: existingChecks } = await db
    .from('remedial_actions')
    .select('id, substrand_health_id, suggested_activity, questions, generated_at')
    .eq('teacher_id', authUserId)
    .in('substrand_health_id', healthIds)

  const checksByHealthId = new Map<string, RemActionRow>()
  for (const check of (existingChecks ?? []) as RemActionRow[]) {
    if (check.substrand_health_id) {
      checksByHealthId.set(check.substrand_health_id, check)
    }
  }

  return allItems.map(item => {
    const existing = checksByHealthId.get(item.id)
    const quick_check: QuickCheckContent | null = existing
      ? {
          id: existing.id,
          suggested_activity: existing.suggested_activity,
          questions: Array.isArray(existing.questions) ? existing.questions : [],
          generated_at: existing.generated_at,
        }
      : null

    return {
      substrand_health_id: item.id,
      sow_id: item.sow_id,
      strand: item.strand,
      sub_strand: item.sub_strand,
      struggle_count: item.struggle_count,
      root_cause: item.root_cause as RemedialCard['root_cause'],
      quick_check,
    }
  })
}
