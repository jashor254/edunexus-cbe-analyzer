import type { GrowthSchool, GrowthContact } from '@/lib/growth/types'
import type { ChannelStrategy } from './types'

/**
 * Sprint PE-8 Part 1 — Communication Strategy Engine. Fixed priority
 * WhatsApp > Call > Email > Visit (the spec's exact order), decided only
 * from real stored contact data — never a guess. Every branch states the
 * specific fact that drove the decision, so "Preferred: WhatsApp / Reason:
 * ..." is always concrete, not a generic label.
 */
export function determineChannelStrategy(school: GrowthSchool, contacts: GrowthContact[]): ChannelStrategy {
  if (school.whatsapp_number) {
    return { channel: 'whatsapp', reason: 'Verified WhatsApp number on file for the school.' }
  }

  const whatsappPreferringContact = contacts.find((c) => c.preferred_contact === 'whatsapp' && c.phone)
  if (whatsappPreferringContact) {
    return {
      channel: 'whatsapp',
      reason: `${whatsappPreferringContact.full_name} has recorded WhatsApp as their preferred contact method.`,
    }
  }

  const phoneContact = contacts.find((c) => c.phone)
  if (school.phone || phoneContact) {
    const who = phoneContact ? phoneContact.full_name : school.name
    return { channel: 'call', reason: `Phone number on file for ${who}, no confirmed WhatsApp number.` }
  }

  const emailContact = contacts.find((c) => c.email)
  if (school.email || emailContact) {
    const who = emailContact ? emailContact.full_name : school.name
    return { channel: 'email', reason: `Email on file for ${who}, no phone or WhatsApp number recorded.` }
  }

  return { channel: 'visit', reason: 'No phone, WhatsApp, or email on file for this school — an in-person visit is the only path. Add a contact to unlock messaging.' }
}
