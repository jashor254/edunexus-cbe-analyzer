import { growthRepos } from '@/lib/growth/repositories'
import type { GrowthActivity, GrowthPipelineStage, GrowthSchool } from '@/lib/growth/types'
import type { ChannelStrategy, GeneratedDraft, MessageChannel, MessageTemplate, FollowUpSuggestion } from '@/lib/growth/messaging/types'
import { determineChannelStrategy } from '@/lib/growth/messaging/strategy'
import { MESSAGE_TEMPLATES, coldIntroTemplateForCategory } from '@/lib/growth/messaging/templates'
import { generateMessage } from '@/lib/growth/messaging/generate'
import { suggestFollowUp } from '@/lib/growth/messaging/followUpSuggestion'
import { sendWhatsAppDraft } from '@/lib/growth/messaging/send'
import { logMessageSent } from '@/lib/growth/services/activities'

export type CommunicationWorkspaceData = {
  strategy: ChannelStrategy
  suggestedTemplate: MessageTemplate
  templates: MessageTemplate[]
  draft: GeneratedDraft
  followUpSuggestion: FollowUpSuggestion | null
}

/**
 * Sprint PE-8 — composes the Communication Workspace for a single school:
 * which channel to use and why (Part 1), the template the pipeline stage
 * suggests (Part 2), a ready-to-edit draft in that channel (Part 4), and
 * whether a follow-up is due (Part 8). One school at a time, exactly the
 * spec's "everything prepared" workflow — never a bulk operation.
 */
export async function getCommunicationWorkspace(
  schoolId: string,
  founderId: string,
  overrides?: { templateId?: string; channel?: MessageChannel; meetingDate?: string; meetingTime?: string },
): Promise<CommunicationWorkspaceData> {
  const [school, contacts, founder, allSchools] = await Promise.all([
    growthRepos.schools.findById(schoolId),
    growthRepos.contacts.listBySchool(schoolId),
    growthRepos.users.findById(founderId),
    growthRepos.schools.list(),
  ])
  if (!school) throw new Error(`School ${schoolId} not found`)

  const strategy = determineChannelStrategy(school, contacts)
  const suggestedTemplate = suggestTemplateForStage(school)
  const templateId = overrides?.templateId ?? suggestedTemplate.id
  const channel = overrides?.channel ?? strategy.channel
  const pilotSchoolsCount = allSchools.filter((s) => s.pipeline_stage === 'pilot_running' || s.pipeline_stage === 'pilot_won').length

  const draft = generateMessage({
    school,
    contact: contacts[0] ?? null,
    founderName: founder?.full_name ?? 'The EduNexus team',
    pilotSchoolsCount,
    templateId,
    channel,
    meetingDate: overrides?.meetingDate,
    meetingTime: overrides?.meetingTime,
  })

  return {
    strategy,
    suggestedTemplate,
    templates: MESSAGE_TEMPLATES,
    draft,
    followUpSuggestion: suggestFollowUp(school.last_contact_at),
  }
}

/**
 * Founder-approved automated send: the founder has already reviewed and
 * possibly edited the draft in the Communication Workspace and clicked
 * "Approve & Send" — this is the one server-side path that actually calls
 * the WhatsApp Cloud API, and it only ever fires for that one explicit click,
 * never on a schedule or in response to a school being discovered/imported.
 * WhatsApp-only: Meta's Cloud API can't deliver a business-initiated message
 * over any other channel this way, and every other channel here still goes
 * out through the founder's own app via lib/growth/messaging/links.ts.
 */
export async function sendApprovedMessage(
  schoolId: string,
  founderId: string,
  input: { contactId?: string | null; templateId: string; body: string; edited: boolean },
): Promise<{ activity: GrowthActivity; newStage: GrowthPipelineStage | null }> {
  const [school, contacts] = await Promise.all([
    growthRepos.schools.findById(schoolId),
    growthRepos.contacts.listBySchool(schoolId),
  ])
  if (!school) throw new Error(`School ${schoolId} not found`)

  const contact = input.contactId ? contacts.find((c) => c.id === input.contactId) ?? null : null
  const phone = contact?.phone ?? school.whatsapp_number ?? school.phone
  if (!phone) throw new Error('No phone or WhatsApp number on file for this school — nothing to send to.')

  const sendResult = await sendWhatsAppDraft(phone, input.body)
  if (!sendResult.success) throw new Error(sendResult.error ?? 'WhatsApp send failed')

  return logMessageSent(
    {
      schoolId,
      contactId: contact?.id ?? null,
      channel: 'whatsapp',
      templateId: input.templateId,
      edited: input.edited,
      currentStage: school.pipeline_stage,
    },
    founderId,
  )
}

/**
 * Which template the pipeline stage points to — a direct, explainable
 * mapping (never a model's guess). Falls back to the cold-intro variant for
 * any stage not explicitly listed (e.g. `deferred`/`lost`), since re-opening
 * a stalled school is, in effect, a fresh introduction.
 */
function suggestTemplateForStage(school: GrowthSchool): MessageTemplate {
  switch (school.pipeline_stage) {
    case 'research':
      return school.contact_source?.toLowerCase().includes('referr')
        ? MESSAGE_TEMPLATES.find((t) => t.id === 'warm_referral')!
        : coldIntroTemplateForCategory(school.category)
    case 'contacted':
      return MESSAGE_TEMPLATES.find((t) => t.id === 'follow_up_1')!
    case 'discovery':
      return MESSAGE_TEMPLATES.find((t) => t.id === 'discovery_meeting_confirmation')!
    case 'demo_scheduled':
      return MESSAGE_TEMPLATES.find((t) => t.id === 'demo_reminder')!
    case 'demo_completed':
      return MESSAGE_TEMPLATES.find((t) => t.id === 'thank_you_after_demo')!
    case 'pilot_offered':
      return MESSAGE_TEMPLATES.find((t) => t.id === 'pilot_invitation')!
    case 'pilot_running':
      return MESSAGE_TEMPLATES.find((t) => t.id === 'one_week_checkin')!
    case 'pilot_won':
      return MESSAGE_TEMPLATES.find((t) => t.id === 'referral_request')!
    default:
      return coldIntroTemplateForCategory(school.category)
  }
}
