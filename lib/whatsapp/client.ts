// lib/whatsapp/client.ts
// Thin wrapper around the Meta WhatsApp Cloud API.
// Sends template messages only — required for outbound (business-initiated) conversations.

const BASE_URL = 'https://graph.facebook.com/v25.0'

type TemplateParam = { type: 'text'; text: string }

type TemplateComponent =
  | { type: 'header'; parameters: TemplateParam[] }
  | { type: 'body'; parameters: TemplateParam[] }
  | { type: 'button'; sub_type: 'url'; index: string; parameters: TemplateParam[] }

type SendTemplateOptions = {
  to: string               // E.164 format, e.g. "254712345678" (no leading +)
  templateName: string
  languageCode?: string    // defaults to "en_US" — Meta registers templates under this code, not "en"
  components?: TemplateComponent[]
}

type MetaApiResponse = {
  messages?: Array<{ id: string }>
  error?: { message: string; code: number }
}

export type WhatsAppResult = { success: boolean; messageId?: string; error?: string }

export async function sendWhatsAppTemplate(
  opts: SendTemplateOptions
): Promise<WhatsAppResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken   = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) {
    return { success: false, error: 'WhatsApp env vars not configured' }
  }

  // Normalise number — strip leading + if present
  const to = opts.to.replace(/^\+/, '')

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: opts.templateName,
      language: { code: opts.languageCode ?? 'en_US' },
      ...(opts.components ? { components: opts.components } : {}),
    },
  }

  const res = await fetch(`${BASE_URL}/${phoneNumberId}/messages`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = (await res.json()) as MetaApiResponse

  if (!res.ok || data.error) {
    return { success: false, error: data.error?.message ?? `HTTP ${res.status}` }
  }

  return { success: true, messageId: data.messages?.[0]?.id }
}
