'use client'

// components/core/OperationalBreadcrumb.tsx
//
// Sprint 10F Phase 6 — "School Office > Current Screen" on every
// operational page, replacing each page's own ad hoc "← Back to X" link
// with one shared component so the trail is consistent everywhere. Not a
// routing change: every operational route is exactly where it already
// was; this only standardizes the piece of UI that points back to the
// workspace root (app/teacher/core-office, renamed from core-readiness
// in Sprint 10G — see app/teacher/core-readiness/page.tsx for the redirect).
//
// Sprint 10H — optional `parent` link added so a page nested one level
// deeper (Academic Office pages, under School Office) can render a
// three-part trail: "School Office > Academic Office > Current Screen".
// Still no routing change — every route stays exactly where it was.
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export function OperationalBreadcrumb({ current, parent }: { current?: string; parent?: { label: string; href: string } }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-slate-400">
      <Link href="/teacher/core-office" className="hover:text-slate-700 transition-colors font-medium">
        School Office
      </Link>
      {parent && (
        <>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          <Link href={parent.href} className="hover:text-slate-700 transition-colors font-medium">
            {parent.label}
          </Link>
        </>
      )}
      {current && (
        <>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          <span className="text-slate-600 font-medium">{current}</span>
        </>
      )}
    </nav>
  )
}
