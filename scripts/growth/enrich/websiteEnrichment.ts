import { extractAll } from './contactExtraction'
import type { PageExtraction } from './types'

const FETCH_TIMEOUT_MS = 8000
const CANDIDATE_PATHS = ['', '/contact', '/contact-us', '/about', '/about-us']

/** Pure — the set of URLs Step 1 says to inspect (homepage + likely contact/about pages). Testable without any network call. */
export function candidateContactUrls(baseUrl: string): string[] {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (!trimmed) return []
  return CANDIDATE_PATHS.map((path) => `${trimmed}${path}`)
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
 * Step 1 — visits the homepage and every likely contact/about page,
 * best-effort (a 404 or timeout on one candidate page is not a failure of
 * the whole crawl, matching the same tolerance PE-2/PE-4's bestEffortEmail
 * already used). Returns one PageExtraction per URL that actually
 * responded, so every extracted value keeps its exact source page.
 */
export async function crawlWebsite(baseUrl: string): Promise<PageExtraction[]> {
  const urls = candidateContactUrls(baseUrl)
  const results: PageExtraction[] = []
  for (const url of urls) {
    const html = await fetchWithTimeout(url)
    if (!html) continue
    const extracted = extractAll(html)
    results.push({ url, ...extracted })
  }
  return results
}
