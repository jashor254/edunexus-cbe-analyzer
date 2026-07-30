import chromium from '@sparticuz/chromium'
import { chromium as playwrightChromium } from 'playwright-core'
import type { Browser, BrowserContext, Page } from 'playwright-core'

export const BLUEPRINT_EXPORT_QUERY_KEY = 'export'
export const BLUEPRINT_EXPORT_QUERY_VALUE = 'pdf'
export const BLUEPRINT_PDF_READY_SELECTOR = '[data-blueprint-ready="true"]'
export const BLUEPRINT_PDF_HEADINGS = [
  'Where We Stand Today',
  'What the Evidence Suggests',
  'How We Help Next',
  'What May Be Emerging',
] as const

type PdfBrowserContext = Pick<BrowserContext, 'addCookies' | 'close'> & {
  newPage(): Promise<PdfBrowserPage>
}

type PdfBrowser = Pick<Browser, 'close'> & {
  newContext(): Promise<PdfBrowserContext>
}

type PdfBrowserPage = Pick<Page, 'emulateMedia' | 'evaluate' | 'close'> & {
  goto(
    url: string,
    options: { waitUntil: 'networkidle'; timeout: number },
  ): Promise<{ ok(): boolean; status(): number } | null>
  waitForSelector(
    selector: string,
    options: { state: 'visible'; timeout: number },
  ): Promise<unknown>
  getByRole(
    role: 'heading',
    options: { name: string },
  ): { waitFor(options: { state: 'visible'; timeout: number }): Promise<unknown> }
  pdf(options: {
    format: 'A4'
    printBackground: boolean
    preferCSSPageSize: boolean
    margin: { top: string; right: string; bottom: string; left: string }
  }): Promise<Uint8Array>
}

type RenderPdfDeps = {
  launchBrowser?: () => Promise<PdfBrowser>
}

const BLUEPRINT_PDF_TIMEOUT_MS = 30_000

export function isBlueprintPdfExportMode(value: string | string[] | null | undefined): boolean {
  return typeof value === 'string' && value === BLUEPRINT_EXPORT_QUERY_VALUE
}

export function buildBlueprintPdfUrl(origin: string, learnerId: string): string {
  const url = new URL(`/student/blueprint/${learnerId}`, origin)
  url.searchParams.set(BLUEPRINT_EXPORT_QUERY_KEY, BLUEPRINT_EXPORT_QUERY_VALUE)
  return url.toString()
}

export function cookiesForOrigin(cookieHeader: string, origin: string): Array<{ name: string; value: string; url: string }> {
  return cookieHeader
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const separator = part.indexOf('=')
      if (separator <= 0) return null
      return {
        name: part.slice(0, separator).trim(),
        value: part.slice(separator + 1).trim(),
        url: origin,
      }
    })
    .filter((cookie): cookie is { name: string; value: string; url: string } => !!cookie && cookie.name.length > 0)
}

export async function launchBlueprintPdfBrowser(): Promise<Browser> {
  return playwrightChromium.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  })
}

export async function renderBlueprintPdf(
  params: {
    origin: string
    learnerId: string
    cookieHeader: string
  },
  deps: RenderPdfDeps = {},
): Promise<Uint8Array> {
  const launchBrowser = deps.launchBrowser ?? launchBlueprintPdfBrowser
  const browser = await launchBrowser()
  let context: PdfBrowserContext | null = null
  let page: PdfBrowserPage | null = null

  try {
    context = await browser.newContext()
    const cookies = cookiesForOrigin(params.cookieHeader, params.origin)
    if (cookies.length === 0) {
      throw new Error('No session cookies were available for Blueprint PDF export.')
    }
    await context.addCookies(cookies)

    page = await context.newPage()
    await page.emulateMedia({ media: 'print' })

    const response = await page.goto(buildBlueprintPdfUrl(params.origin, params.learnerId), {
      waitUntil: 'networkidle',
      timeout: BLUEPRINT_PDF_TIMEOUT_MS,
    })

    if (!response || !response.ok()) {
      throw new Error(`Blueprint route render failed: ${response?.status() ?? 'no-response'}`)
    }

    await page.waitForSelector(BLUEPRINT_PDF_READY_SELECTOR, {
      state: 'visible',
      timeout: BLUEPRINT_PDF_TIMEOUT_MS,
    })
    await page.evaluate(async () => {
      await document.fonts.ready
    })

    for (const heading of BLUEPRINT_PDF_HEADINGS) {
      await page.getByRole('heading', { name: heading }).waitFor({
        state: 'visible',
        timeout: BLUEPRINT_PDF_TIMEOUT_MS,
      })
    }

    // Must await here, not just return the promise — `finally` below runs
    // as soon as `try` hands back a value, not once that value's promise
    // settles. Returning the bare promise closed page/context/browser while
    // page.pdf() was still in flight, so every call failed with "Target
    // page, context or browser has been closed."
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '12mm',
        right: '10mm',
        bottom: '12mm',
        left: '10mm',
      },
    })
  } finally {
    // browserContext.close() already closes every page that belongs to it
    // (Playwright docs: "All the pages that belong to the browser context
    // will be closed") — an explicit page.close() first is redundant, and
    // if it throws (e.g. the page already crashed), context.close() and
    // browser.close() below it never run, leaking the whole browser
    // process. Each close is isolated so one failure can't skip the rest.
    await context?.close().catch(() => {})
    await browser.close()
  }
}
