// Sprint PE-8 (Founder Communication Engine) — shared messaging domain
// types. Every variable a template can use maps to a real, already-stored
// column (growth_schools / growth_contacts / growth_users) or a value the
// founder types in for that one draft (meeting_date/meeting_time). Nothing
// here is invented or AI-guessed — see lib/growth/messaging/variables.ts.

export type MessageChannel = 'whatsapp' | 'sms' | 'email' | 'call' | 'visit'

export type MessageTemplateCategory =
  | 'cold_intro'
  | 'warm_referral'
  | 'follow_up_1'
  | 'follow_up_2'
  | 'discovery_meeting_confirmation'
  | 'demo_reminder'
  | 'thank_you_after_demo'
  | 'pilot_invitation'
  | 'pilot_accepted'
  | 'one_week_checkin'
  | 'referral_request'

/** Which growth_schools.category this cold-intro variant is written for. `null` = works for any school type. */
export type SchoolTypeVariant = 'public_secondary' | 'private' | 'junior_secondary' | 'mixed' | null

export type MessageTemplate = {
  id: string
  name: string
  category: MessageTemplateCategory
  schoolType: SchoolTypeVariant
  purpose: string
  whenToUse: string
  defaultChannel: MessageChannel
  expectedOutcome: string
  /** {{token}} names this template actually uses — drives which variables the UI asks for. */
  variables: string[]
  tone: string
  length: 'short' | 'medium'
  whatsappBody: string
  smsBody?: string
  emailSubject?: string
  emailBody?: string
  callOpeningScript?: string
}

export type ChannelStrategy = {
  channel: MessageChannel
  reason: string
}

export type GeneratedDraft = {
  channel: MessageChannel
  templateId: string
  templateName: string
  subject: string | null
  body: string
  /** {{tokens}} the template needed that had no real value to substitute — surfaced so the founder edits them before sending, never silently blanked. */
  unresolvedVariables: string[]
}

export type FollowUpSuggestion = {
  task: string
  dueDate: string
  priority: 'low' | 'normal' | 'high'
  templateId: string | null
  reason: string
}
