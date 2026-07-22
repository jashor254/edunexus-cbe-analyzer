import type { GrowthSchool, GrowthContact } from '@/lib/growth/types'
import type { GeneratedDraft, MessageChannel, MessageTemplate } from './types'
import { findTemplate } from './templates'
import { buildTemplateVariables } from './variables'
import { renderTemplate } from './render'

export type GenerateMessageInput = {
  school: GrowthSchool
  contact: GrowthContact | null
  founderName: string
  pilotSchoolsCount: number
  templateId: string
  /** Defaults to the template's own defaultChannel; pass the Strategy Engine's chosen channel to override. */
  channel?: MessageChannel
  meetingDate?: string
  meetingTime?: string
}

/**
 * Sprint PE-8 Part 4 — Message Generator. Picks the channel-specific body
 * off the template (falling back to the WhatsApp body when a channel-
 * specific variant wasn't written — see templates.ts) and personalizes it.
 * Never fabricates a channel-specific variant that doesn't exist in the
 * library; falling back to the WhatsApp body is a content choice, not a
 * generation step, so there is nothing here an AI model authored per send.
 */
export function generateMessage(input: GenerateMessageInput): GeneratedDraft {
  const template = findTemplate(input.templateId)
  if (!template) throw new Error(`Unknown message template: ${input.templateId}`)

  const channel = input.channel ?? template.defaultChannel
  const variables = buildTemplateVariables({
    school: input.school,
    contact: input.contact,
    founderName: input.founderName,
    pilotSchoolsCount: input.pilotSchoolsCount,
    meetingDate: input.meetingDate,
    meetingTime: input.meetingTime,
  })

  const { subjectSource, bodySource } = pickChannelSource(template, channel)
  const renderedBody = renderTemplate(bodySource, variables)
  const renderedSubject = subjectSource ? renderTemplate(subjectSource, variables) : null

  const unresolved = Array.from(new Set([...(renderedSubject?.unresolved ?? []), ...renderedBody.unresolved]))

  return {
    channel,
    templateId: template.id,
    templateName: template.name,
    subject: renderedSubject?.text ?? null,
    body: renderedBody.text,
    unresolvedVariables: unresolved,
  }
}

function pickChannelSource(template: MessageTemplate, channel: MessageChannel): { subjectSource: string | null; bodySource: string } {
  switch (channel) {
    case 'email':
      return { subjectSource: template.emailSubject ?? null, bodySource: template.emailBody ?? template.whatsappBody }
    case 'sms':
      return { subjectSource: null, bodySource: template.smsBody ?? template.whatsappBody }
    case 'call':
      return { subjectSource: null, bodySource: template.callOpeningScript ?? template.whatsappBody }
    case 'visit':
      return { subjectSource: null, bodySource: template.whatsappBody }
    case 'whatsapp':
    default:
      return { subjectSource: null, bodySource: template.whatsappBody }
  }
}
