import type { FollowUpSuggestion } from './types'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

/**
 * Sprint PE-8 Part 8 — Follow-up Assistant. A suggestion only: it prefills
 * the existing "Add follow-up" form (growth_follow_ups, unchanged schema),
 * it never creates or sends anything itself. Cadence is the spec's own
 * fixed 3 / 7 / 14-day chain — no ML, no per-school tuning.
 */
export function suggestFollowUp(lastContactAtIso: string | null, now: Date = new Date()): FollowUpSuggestion | null {
  if (!lastContactAtIso) return null

  const daysSince = Math.floor((now.getTime() - new Date(lastContactAtIso).getTime()) / ONE_DAY_MS)

  if (daysSince >= 14) {
    return {
      task: 'No reply after 14 days — close for now (move to Deferred) unless you want one more try.',
      dueDate: now.toISOString().slice(0, 10),
      priority: 'low',
      templateId: null,
      reason: '14 days with no reply — the spec\'s cadence ends here; further chasing is a founder judgment call, not automatic.',
    }
  }

  if (daysSince >= 7) {
    return {
      task: 'Send Follow-up 2 (no reply after 7 days)',
      dueDate: now.toISOString().slice(0, 10),
      priority: 'normal',
      templateId: 'follow_up_2',
      reason: '7 days since last contact with no reply logged.',
    }
  }

  if (daysSince >= 3) {
    return {
      task: 'Send Follow-up 1 (no reply after 3 days)',
      dueDate: now.toISOString().slice(0, 10),
      priority: 'normal',
      templateId: 'follow_up_1',
      reason: '3 days since last contact with no reply logged.',
    }
  }

  return null
}
