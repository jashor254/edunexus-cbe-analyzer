/**
 * Sprint PE-8 Part 6/7 — link builders for "Send." These never transmit
 * anything themselves; they open the founder's own WhatsApp/mail/phone app
 * with the draft pre-filled, so the founder still presses Send there. That
 * is the entire mechanism by which "no automatic sending" is enforced —
 * there is no server-side call to any messaging provider anywhere in PE-8.
 */

/** Kenyan numbers are stored as +2547.../07.../2547... — normalizes all three to the bare 2547... digits wa.me/tel: require. */
export function normalizeKenyanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('254')) return digits
  if (digits.startsWith('0')) return `254${digits.slice(1)}`
  return digits
}

export function buildWhatsAppLink(phone: string, message: string): string {
  return `https://wa.me/${normalizeKenyanPhone(phone)}?text=${encodeURIComponent(message)}`
}

export function buildSmsLink(phone: string, message: string): string {
  return `sms:+${normalizeKenyanPhone(phone)}?body=${encodeURIComponent(message)}`
}

export function buildTelLink(phone: string): string {
  return `tel:+${normalizeKenyanPhone(phone)}`
}

export function buildMailtoLink(email: string, subject: string | null, body: string): string {
  const params = new URLSearchParams()
  if (subject) params.set('subject', subject)
  params.set('body', body)
  return `mailto:${email}?${params.toString()}`
}
