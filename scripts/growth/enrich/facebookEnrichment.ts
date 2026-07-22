import { extractEmails, extractPhones, extractWhatsAppNumbers } from './contactExtraction'

const FETCH_TIMEOUT_MS = 8000

export type FacebookExtraction = {
  url: string
  emails: string[]
  phones: string[]
  whatsapp: string[]
  messengerAvailable: boolean
}

async function fetchWithTimeout(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Step 4 — public contact info only (phone/email/WhatsApp/Messenger
 * availability), never posts/followers/comments: this only ever runs a
 * plain unauthenticated fetch of the page's public HTML and the same three
 * regex extractors websiteEnrichment.ts uses — there is no post/comment/
 * follower scraping capability here at all, structurally, not just by
 * policy.
 *
 * In practice Facebook serves most unauthenticated requests a stripped
 * login-wall page with little to no contact info in the HTML — this is
 * expected to have a low hit rate; it is still implemented per the sprint's
 * Step 4, best-effort, same tolerance as every other fetch in this pipeline.
 */
export async function crawlFacebookPage(url: string): Promise<FacebookExtraction | null> {
  const html = await fetchWithTimeout(url)
  if (!html) return null
  return {
    url,
    emails: extractEmails(html),
    phones: extractPhones(html),
    whatsapp: extractWhatsAppNumbers(html),
    messengerAvailable: /m\.me\//.test(html),
  }
}
