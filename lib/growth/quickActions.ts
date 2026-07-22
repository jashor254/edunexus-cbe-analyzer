import type { GrowthActivityType, GrowthPipelineStage } from '@/lib/growth/types'
import { GROWTH_PIPELINE_STAGES } from '@/lib/growth/types'

/**
 * Sprint PE-7 (Pilot Campaign Launch) Part 5 — one-click activity logging.
 * Every button here maps to an existing growth_activities `type` (no schema
 * change) plus a default note carrying the button's exact label — "Pilot
 * Accepted"/"Pilot Declined"/"Discovery Complete" aren't literal activity
 * types, but the note text preserves the real meaning losslessly, fully
 * auditable in the Contact Workspace's activity history. No required
 * typing: `notes` on the API is optional and only appends to the default.
 */

export type QuickActionKey =
  | 'called' | 'whatsapp_sent' | 'email_sent' | 'visited' | 'meeting'
  | 'discovery_complete' | 'demo_scheduled' | 'demo_completed' | 'pilot_accepted' | 'pilot_declined'

export type QuickActionDef = {
  key: QuickActionKey
  label: string
  activityType: GrowthActivityType
  defaultNote: string
  /** Pipeline stage this action implies, if any — only ever moves forward (or, for a decline, forces `lost` unconditionally). */
  advanceStage?: GrowthPipelineStage
  forceStage?: boolean
}

export const QUICK_ACTIONS: QuickActionDef[] = [
  { key: 'called', label: 'Called', activityType: 'called', defaultNote: '', advanceStage: 'contacted' },
  { key: 'whatsapp_sent', label: 'WhatsApp Sent', activityType: 'whatsapp', defaultNote: '', advanceStage: 'contacted' },
  { key: 'email_sent', label: 'Email Sent', activityType: 'email', defaultNote: '', advanceStage: 'contacted' },
  { key: 'visited', label: 'Visited', activityType: 'visited', defaultNote: '', advanceStage: 'contacted' },
  { key: 'meeting', label: 'Meeting', activityType: 'meeting', defaultNote: '', advanceStage: 'discovery' },
  { key: 'discovery_complete', label: 'Discovery Complete', activityType: 'meeting', defaultNote: 'Discovery complete', advanceStage: 'discovery' },
  { key: 'demo_scheduled', label: 'Demo Scheduled', activityType: 'demo', defaultNote: 'Demo scheduled', advanceStage: 'demo_scheduled' },
  { key: 'demo_completed', label: 'Demo Completed', activityType: 'demo', defaultNote: 'Demo completed', advanceStage: 'demo_completed' },
  { key: 'pilot_accepted', label: 'Pilot Accepted', activityType: 'meeting', defaultNote: 'Pilot accepted', advanceStage: 'pilot_running' },
  { key: 'pilot_declined', label: 'Pilot Declined', activityType: 'meeting', defaultNote: 'Pilot declined', advanceStage: 'lost', forceStage: true },
]

export function findQuickAction(key: string): QuickActionDef | undefined {
  return QUICK_ACTIONS.find((a) => a.key === key)
}

/** Never regresses a school's pipeline stage — only advances it, or (a decline) forces the terminal `lost` stage unconditionally. */
export function shouldAdvanceStage(currentStage: GrowthPipelineStage, action: QuickActionDef): boolean {
  if (!action.advanceStage) return false
  if (action.forceStage) return currentStage !== action.advanceStage
  const currentIdx = GROWTH_PIPELINE_STAGES.indexOf(currentStage)
  const targetIdx = GROWTH_PIPELINE_STAGES.indexOf(action.advanceStage)
  return targetIdx > currentIdx
}
