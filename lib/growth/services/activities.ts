import { growthRepos } from '@/lib/growth/repositories'
import type { GrowthActivity, NewGrowthActivity, GrowthPipelineStage, GrowthActivityType } from '@/lib/growth/types'
import type { MessageChannel } from '@/lib/growth/messaging/types'
import { GROWTH_PIPELINE_STAGES } from '@/lib/growth/types'
import { findQuickAction, shouldAdvanceStage } from '@/lib/growth/quickActions'
import { changeStage } from '@/lib/growth/services/schools'

/** The exact tag `logQuickAction` appends to notes when the founder flags a reply — Part 6/7's "Today's Replies"/"Responses" read this back from real activity notes, no new column. */
export const REPLY_TAG = '[replied]'

/**
 * Sprint PE-8 Part 9 — no new columns for "channel sent" / "template used" /
 * "edited?": the existing `growth_activities.type` carries the channel
 * where it already has a matching value, and these tags in `notes` carry
 * the rest, the same convention REPLY_TAG established. `whatsapp` is the
 * closest existing `type` for `sms` (both are short written texts, unlike a
 * call or a visit) — the [channel:sms] tag preserves the exact truth.
 */
const CHANNEL_TO_ACTIVITY_TYPE: Record<MessageChannel, GrowthActivityType> = {
  whatsapp: 'whatsapp',
  sms: 'whatsapp',
  email: 'email',
  call: 'called',
  visit: 'visited',
}

export async function listActivitiesForSchool(schoolId: string): Promise<GrowthActivity[]> {
  return growthRepos.activities.listBySchool(schoolId)
}

/**
 * Logging an activity is also the only thing that moves `last_contact_at`
 * forward — a school is never "contacted" without a real Activity row behind
 * it, so the Founder Dashboard's "At Risk" read (days since last contact,
 * lib/growth/services/dashboard.ts) can trust this field completely.
 */
export async function logActivity(input: NewGrowthActivity, createdBy: string): Promise<GrowthActivity> {
  const occurredAt = input.occurredAt ?? new Date().toISOString()
  const activity = await growthRepos.activities.insert({
    school_id: input.schoolId,
    contact_id: input.contactId ?? null,
    type: input.type,
    notes: input.notes ?? null,
    occurred_at: occurredAt,
    created_by: createdBy,
  })
  await growthRepos.schools.update(input.schoolId, { last_contact_at: occurredAt })
  return activity
}

/**
 * Sprint PE-7 Part 5 — the one-click logging path: no dropdown, no typing
 * required. Resolves a QuickActionKey to its activity type + default note,
 * optionally appends the founder's own note and a reply tag, and advances
 * the pipeline stage only when the action implies real forward progress
 * (never regresses it — see shouldAdvanceStage()).
 */
export async function logQuickAction(
  input: { schoolId: string; actionKey: string; extraNotes?: string | null; gotReply?: boolean; currentStage: GrowthPipelineStage },
  createdBy: string,
): Promise<{ activity: GrowthActivity; newStage: GrowthPipelineStage | null }> {
  const action = findQuickAction(input.actionKey)
  if (!action) throw new Error(`Unknown quick action: ${input.actionKey}`)

  const noteParts = [action.defaultNote, input.extraNotes?.trim()].filter((p): p is string => !!p)
  if (input.gotReply) noteParts.push(REPLY_TAG)
  const notes = noteParts.length > 0 ? noteParts.join(' — ') : null

  const activity = await logActivity({ schoolId: input.schoolId, type: action.activityType, notes }, createdBy)

  let newStage: GrowthPipelineStage | null = null
  if (shouldAdvanceStage(input.currentStage, action)) {
    await changeStage(input.schoolId, action.advanceStage!)
    newStage = action.advanceStage!
  }

  return { activity, newStage }
}

/**
 * Sprint PE-8 Part 5/9 — "Mark sent" in the Communication Workspace. Logs
 * the prepared message as a real activity (channel, template, whether the
 * founder edited it, and the founder's own outcome note if any), and
 * advances a fresh school straight past `research` into `contacted` — the
 * same "only ever moves forward" rule quick actions follow. This function
 * never sends anything; it only records that the founder did, after the
 * fact, via wa.me/mailto/tel links opened client-side.
 */
export async function logMessageSent(
  input: {
    schoolId: string
    contactId?: string | null
    channel: MessageChannel
    templateId: string
    edited: boolean
    outcomeNote?: string | null
    currentStage: GrowthPipelineStage
  },
  createdBy: string,
): Promise<{ activity: GrowthActivity; newStage: GrowthPipelineStage | null }> {
  const tags = [`[channel:${input.channel}]`, `[template:${input.templateId}]`, input.edited ? '[edited]' : null].filter(
    (t): t is string => !!t,
  )
  const notes = [tags.join(''), input.outcomeNote?.trim()].filter((p): p is string => !!p).join(' — ')

  const activity = await logActivity(
    { schoolId: input.schoolId, contactId: input.contactId ?? null, type: CHANNEL_TO_ACTIVITY_TYPE[input.channel], notes: notes || null },
    createdBy,
  )

  let newStage: GrowthPipelineStage | null = null
  const currentIdx = GROWTH_PIPELINE_STAGES.indexOf(input.currentStage)
  const contactedIdx = GROWTH_PIPELINE_STAGES.indexOf('contacted')
  if (currentIdx < contactedIdx) {
    await changeStage(input.schoolId, 'contacted')
    newStage = 'contacted'
  }

  return { activity, newStage }
}
