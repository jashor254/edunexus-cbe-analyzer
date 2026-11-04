'use client'

import { Analytics } from '@vercel/analytics/react'

// /shared/<token> URLs are bearer credentials — never send them to analytics.
const SHARE_PATH = /\/shared\/[^/?#]+/

export function redactShareToken(url: string): string {
  return url.replace(SHARE_PATH, '/shared/[token]')
}

export function RedactedAnalytics() {
  return <Analytics beforeSend={(event) => ({ ...event, url: redactShareToken(event.url) })} />
}
