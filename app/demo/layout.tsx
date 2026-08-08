// app/demo/layout.tsx
//
// An isolated presentation shell for /demo.
//
// The root layout's site footer and WhatsApp widget are suppressed for this
// route by the `data-demo-shell` rules in app/globals.css — the same mechanism
// app/school-concepts/[schoolSlug]/layout.tsx already uses, extended rather
// than reinvented. Nothing about the marketing layout, auth, or global
// navigation is modified.

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Montserrat, Inter } from 'next/font/google'

// Same faces as the marketing route group, self-hosted at build time by
// next/font. Montserrat for headings, Inter for everything else.
const heading = Montserrat({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-demo-heading' })
const body    = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-demo-body' })

export const metadata: Metadata = {
  // Resets the root layout's '%s | EduNexus Kenya' template so the title is
  // exactly what a reviewer sees in the tab.
  title: { absolute: 'EduNexus — Educational Intelligence Demo' },
  description:
    'A short product walkthrough showing how EduNexus connects learner evidence, teacher action and personalised learning.',
  // Not indexed until explicitly approved.
  robots: { index: false, follow: false, nocache: true },
  openGraph: {
    title: 'EduNexus — Educational Intelligence Demo',
    description:
      'A short product walkthrough showing how EduNexus connects learner evidence, teacher action and personalised learning.',
    siteName: 'EduNexus Kenya',
    locale: 'en_KE',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EduNexus — Educational Intelligence Demo',
    description:
      'A short product walkthrough showing how EduNexus connects learner evidence, teacher action and personalised learning.',
  },
}

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-demo-shell="true"
      className={`${heading.variable} ${body.variable} demo-shell font-[var(--font-demo-body)]`}
    >
      {children}
    </div>
  )
}
