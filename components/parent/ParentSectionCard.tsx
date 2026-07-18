'use client'

// components/parent/ParentSectionCard.tsx
//
// The Parent-facing equivalent of components/blueprint/BlueprintSectionCard
// (Sprint 12Q, ADR-0010 Part 6). Deliberately a separate, lighter shell —
// never the Owner string, never a raw status/freshness enum value (uses
// lib/parentExperience/terminology.ts's frozen labels instead). The actual
// section *content* renderers (IdentitySection, AttendanceSection, etc.)
// are reused unchanged from components/blueprint/sections.tsx — only the
// outer chrome differs, so there is exactly one place educational content
// renders, never a second copy for Parent Portal.

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { BlueprintSection } from '@/lib/learnerBlueprint/types'
import { PARENT_STATUS_LABEL } from '@/lib/parentExperience/terminology'

type Props<T> = {
  title: string
  section: BlueprintSection<T>
  defaultOpen?: boolean
  children: (data: T) => React.ReactNode
}

export default function ParentSectionCard<T>({ title, section, defaultOpen = false, children }: Props<T>) {
  const [open, setOpen] = useState(defaultOpen)
  const ready = section.status === 'available'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(prev => !prev)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-gray-900 text-sm">{title}</span>
            {!ready && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border font-bold bg-gray-100 text-gray-500 border-gray-200">
                {PARENT_STATUS_LABEL[section.status]}
              </span>
            )}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-50 pt-4">
          {!ready && (
            <div role="status" className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <p className="text-sm text-gray-500">
                {section.status === 'not_implemented'
                  ? "This part of the picture isn't available yet."
                  : (section.unavailableReason && !/error|exception|failed:/i.test(section.unavailableReason)
                      ? section.unavailableReason
                      : "Not enough information yet — check back soon.")}
              </p>
            </div>
          )}
          {ready && section.data !== null && children(section.data)}
        </div>
      )}
    </div>
  )
}
