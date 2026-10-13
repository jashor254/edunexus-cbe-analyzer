// app/pitch/layout.tsx
//
// An isolated shell for /pitch — the Google Africa pitch deck.
//
// Reuses the presentation shell /demo already established rather than
// introducing a second one: `data-demo-shell` is the attribute the
// `body:has(...)` rules in app/globals.css key off to suppress the site
// footer and the WhatsApp widget, and `.demo-shell` is where the
// presentation colour tokens live. One design system, two routes.
//
// Nothing about the marketing layout, auth, or global navigation is modified.

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { demoHeading as heading, demoBody as body } from '@/app/fonts/fonts'

// Same faces as /demo and the marketing route group (self-hosted,
// app/fonts/fonts.ts). The variable names match the ones .demo-shell's
// descendants already reference.

export const metadata: Metadata = {
  // Resets the root layout's '%s | EduNexus Kenya' template so the tab reads
  // exactly what a reviewer expects to find.
  title: { absolute: 'EduNexus — Educational Intelligence for Schools' },
  description:
    'EduNexus is an Educational Intelligence platform for schools in Kenya: classroom evidence becomes an accumulating understanding of each learner, and one next action a teacher approves.',
  // Not indexed. This is an application document with a stable link, not a
  // public marketing page. app/robots.ts disallows the path as well.
  robots: { index: false, follow: false, nocache: true },
  openGraph: {
    title: 'EduNexus — Educational Intelligence for Schools',
    description:
      'Classroom evidence becomes an accumulating understanding of each learner, and one next action a teacher approves.',
    siteName: 'EduNexus Kenya',
    locale: 'en_KE',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EduNexus — Educational Intelligence for Schools',
    description:
      'Classroom evidence becomes an accumulating understanding of each learner, and one next action a teacher approves.',
  },
}

export default function PitchLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-demo-shell="true"
      data-pitch-shell="true"
      className={`${heading.variable} ${body.variable} demo-shell font-[var(--font-demo-body)]`}
    >
      {children}
    </div>
  )
}
