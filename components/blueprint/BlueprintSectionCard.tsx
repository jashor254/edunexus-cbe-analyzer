'use client'

// components/blueprint/BlueprintSectionCard.tsx
//
// The one generic wrapper every Blueprint section renders through — per
// ADR-0009 §4 (single scrolling document, expand/collapse, no tabs) and
// this sprint's explicit rendering rules: every section displays Owner,
// Freshness, Availability, Last Updated, and an Expand/Collapse control,
// with fixed Unavailable/Coming-Soon states. This component owns no
// Blueprint data — it only renders whatever `section` (a BlueprintSection
// from lib/learnerBlueprint) already says, never fabricating a value for
// a field the section doesn't have.

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { BlueprintSection, SectionFreshness, BlueprintSectionStatus } from '@/lib/learnerBlueprint/types'

const FRESHNESS_LABEL: Record<SectionFreshness, string> = {
  live: 'Live',
  snapshot: 'Snapshot',
  historical: 'Historical',
}

const FRESHNESS_STYLE: Record<SectionFreshness, string> = {
  live: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  snapshot: 'bg-amber-50 text-amber-700 border-amber-100',
  historical: 'bg-slate-100 text-slate-600 border-slate-200',
}

const STATUS_LABEL: Record<BlueprintSectionStatus, string> = {
  available: 'Available',
  unavailable: 'Unavailable',
  not_implemented: 'Coming Soon',
}

const STATUS_STYLE: Record<BlueprintSectionStatus, string> = {
  available: 'bg-teal-50 text-teal-700 border-teal-100',
  unavailable: 'bg-gray-100 text-gray-500 border-gray-200',
  not_implemented: 'bg-violet-50 text-violet-600 border-violet-100',
}

type Props<T> = {
  title: string
  sectionNumber: number
  section: BlueprintSection<T>
  /** As-of timestamp for this composition (metadata.generatedAt) — no per-section timestamp exists in the data, so every section's "Last Updated" is honestly "as of this Blueprint composition," never a fabricated per-section value. */
  generatedAt: string
  defaultOpen?: boolean
  children: (data: T) => React.ReactNode
}

export default function BlueprintSectionCard<T>({
  title,
  sectionNumber,
  section,
  generatedAt,
  defaultOpen = false,
  children,
}: Props<T>) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(prev => !prev)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none transition-colors"
      >
        <span className="text-[11px] text-gray-400 font-semibold shrink-0">{sectionNumber}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-gray-900 text-sm">{title}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${STATUS_STYLE[section.status]}`}>
              {STATUS_LABEL[section.status]}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${FRESHNESS_STYLE[section.freshness]}`}>
              {FRESHNESS_LABEL[section.freshness]}
            </span>
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5 truncate">
            Owner: {section.owner}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-50 pt-4">
          {section.status === 'unavailable' && (
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <p className="text-sm font-bold text-gray-600">Unavailable.</p>
              {section.unavailableReason && (
                <p className="text-xs text-gray-400 mt-1">{section.unavailableReason}</p>
              )}
            </div>
          )}

          {section.status === 'not_implemented' && (
            <div className="rounded-xl bg-violet-50/50 border border-violet-100 p-4">
              <p className="text-sm font-bold text-violet-600">Coming Soon.</p>
            </div>
          )}

          {section.status === 'available' && section.data !== null && children(section.data)}

          <p className="text-[11px] text-gray-300 mt-3">
            Last updated: {new Date(generatedAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
      )}
    </div>
  )
}
