import type { GrowthSchool } from '@/lib/growth/types'
import type { SchoolTargetingContext } from './types'

const ROLE_LABEL: Record<string, string> = {
  principal: 'the principal',
  deputy: 'the deputy',
  dos: 'the DOS',
  ict_teacher: 'the ICT teacher',
}

function contactPerson(context: SchoolTargetingContext): string {
  if (context.contactName) return context.contactName
  if (context.contactRole && ROLE_LABEL[context.contactRole]) return ROLE_LABEL[context.contactRole]
  return 'the school'
}

/**
 * Sprint PE-6 — one concrete, human-readable next step per school. Never a
 * vague "follow up" when a specific overdue task or a specific channel is
 * known; falls back to "research contact info" only when genuinely no
 * channel exists, rather than suggesting an action that can't be taken.
 */
export function deriveNextAction(school: GrowthSchool, context: SchoolTargetingContext): string {
  if (context.followUpOverdue && context.followUpTask) {
    return `Complete the overdue follow-up: ${context.followUpTask}.`
  }

  const pilotStage = ['pilot_offered', 'pilot_running', 'pilot_won'].includes(school.pipeline_stage)
  if (pilotStage) return 'Follow up on pilot interest — keep momentum going.'

  if (school.pipeline_stage === 'demo_scheduled') return 'Confirm details ahead of the scheduled demo.'
  if (school.pipeline_stage === 'demo_completed') return 'Follow up after the demo — ask for a decision.'
  if (school.pipeline_stage === 'discovery') return 'Continue the discovery conversation.'

  const hasWhatsapp = !!school.whatsapp_number?.trim()
  const hasPhone = !!school.phone?.trim()
  const hasEmail = !!school.email?.trim()

  if (!context.hasAnyActivity) {
    if (hasWhatsapp) return `WhatsApp ${contactPerson(context)} today.`
    if (hasPhone) return 'Call today.'
    if (hasEmail) return 'Send an introductory email.'
    return 'Research contact info before reaching out.'
  }

  if (hasWhatsapp) return `Follow up with ${contactPerson(context)} on WhatsApp.`
  if (hasPhone) return 'Call to check in.'
  if (hasEmail) return 'Send a follow-up email.'
  return 'Research contact info before reaching out.'
}
