import { sendWhatsAppTemplate } from '@/lib/whatsapp/client'
import { normalizeKenyanPhone } from './links'

/**
 * Meta requires a pre-approved template for any business-initiated WhatsApp
 * message to a number with no open 24h conversation window — true for every
 * cold-outreach send here, since the school has never messaged us first.
 * One body variable holds the entire already-personalized draft text, same
 * pattern as lib/whatsapp/sender.ts's edunexus_parent_update — so approval
 * is a one-time step, not a per-template-variant one. See docs/whatsapp-setup.md.
 */
const GROWTH_OUTREACH_TEMPLATE = 'edunexus_school_outreach'

export async function sendWhatsAppDraft(phone: string, body: string): Promise<{ success: boolean; error?: string }> {
  const result = await sendWhatsAppTemplate({
    to: normalizeKenyanPhone(phone),
    templateName: GROWTH_OUTREACH_TEMPLATE,
    components: [{ type: 'body', parameters: [{ type: 'text', text: body.slice(0, 1024) }] }],
  })
  return result.success ? { success: true } : { success: false, error: result.error }
}
