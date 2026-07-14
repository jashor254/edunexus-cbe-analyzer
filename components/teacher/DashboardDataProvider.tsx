'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { AttentionItem } from '@/lib/attentionFeed/types'
import type { SchemeWithProgress } from '@/app/api/sow/list/route'

// `null` means "still loading" — distinct from an empty array, which means
// "loaded, nothing there". Every dashboard section reads from here instead
// of fetching on its own, so /api/teacher/attention-feed and /api/sow/list
// are each called exactly once per dashboard load (Sprint 5.5 — Performance).
interface DashboardData {
  attentionItems: AttentionItem[] | null
  schemes:        SchemeWithProgress[] | null
}

const DashboardDataContext = createContext<DashboardData | null>(null)

export function DashboardDataProvider({
  activeClasses,
  children,
}: {
  activeClasses: number
  children:      React.ReactNode
}) {
  const [attentionItems, setAttentionItems] = useState<AttentionItem[] | null>(null)
  const [schemes, setSchemes]               = useState<SchemeWithProgress[] | null>(null)

  useEffect(() => {
    if (activeClasses === 0) return

    fetch('/api/teacher/attention-feed')
      .then(r => r.json())
      .then(data => { if (data.success) setAttentionItems(data.data.items) })

    fetch('/api/sow/list', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.success) setSchemes(d.data.schemes ?? []) })
      .catch(() => setSchemes([]))
  }, [activeClasses])

  return (
    <DashboardDataContext.Provider value={{ attentionItems, schemes }}>
      {children}
    </DashboardDataContext.Provider>
  )
}

export function useDashboardData(): DashboardData {
  const ctx = useContext(DashboardDataContext)
  if (!ctx) throw new Error('useDashboardData must be used within a DashboardDataProvider')
  return ctx
}
