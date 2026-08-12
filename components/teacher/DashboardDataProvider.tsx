'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { AttentionItem } from '@/lib/attentionFeed/types'
import type { SchemeWithProgress } from '@/app/api/sow/list/route'
import { logger } from '@/lib/observability/logger'

// `null` means "still loading" — distinct from an empty array, which means
// "loaded, nothing there". Every dashboard section reads from here instead
// of fetching on its own, so /api/teacher/attention-feed and /api/sow/list
// are each called exactly once per dashboard load (Sprint 5.5 — Performance).
// `attentionError` is a fourth, explicit state: a fetch/parse failure that
// left `attentionItems` at `null` forever — without it, a failed request was
// indistinguishable from "still loading" and the UI spun forever.
interface DashboardData {
  attentionItems:      AttentionItem[] | null
  attentionError:      string | null
  retryAttentionFeed:  () => void
  schemes:             SchemeWithProgress[] | null
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
  const [attentionError, setAttentionError] = useState<string | null>(null)
  const [schemes, setSchemes]               = useState<SchemeWithProgress[] | null>(null)
  const [retryToken, setRetryToken]         = useState(0)

  const retryAttentionFeed = useCallback(() => setRetryToken(t => t + 1), [])

  useEffect(() => {
    let cancelled = false

    // Phase 1 — the attention feed is genuinely class-derived
    // (lib/attentionFeed reads teacher_classes), so it stays gated. Nothing
    // else does.
    if (activeClasses > 0) {
      fetch('/api/teacher/attention-feed')
        .then(r => r.json())
        .then(data => {
          if (cancelled) return
          if (data.success) {
            setAttentionItems(data.data.items)
            setAttentionError(null)
          } else {
            setAttentionError(data.error ?? 'Failed to load attention feed')
          }
        })
        .catch(err => {
          if (cancelled) return
          logger.error('Attention feed fetch failed', { operation: 'dashboard.attentionFeed' }, err)
          setAttentionError('Failed to load attention feed')
        })
    } else {
      // Loaded, nothing there — distinct from `null` ("still loading"), which
      // would otherwise leave class-derived panels spinning forever.
      setAttentionItems([])
    }

    // Schemes are NEVER class-gated. Before Phase 1 the whole effect returned
    // early when activeClasses === 0, so an independent teacher's schemes were
    // never fetched at all: `schemes` stayed null forever and Continue Working
    // and Weekly Teaching Progress rendered nothing, no matter how much
    // teaching work they had done. That was the root cause of the first-run
    // problem, not just the CTA wording.
    fetch('/api/sow/list', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (!cancelled && d.success) setSchemes(d.data.schemes ?? []) })
      .catch(err => {
        if (cancelled) return
        logger.error('Scheme list fetch failed', { operation: 'dashboard.schemeList' }, err)
        setSchemes([])
      })

    return () => { cancelled = true }
  }, [activeClasses, retryToken])

  return (
    <DashboardDataContext.Provider value={{ attentionItems, attentionError, retryAttentionFeed, schemes }}>
      {children}
    </DashboardDataContext.Provider>
  )
}

export function useDashboardData(): DashboardData {
  const ctx = useContext(DashboardDataContext)
  if (!ctx) throw new Error('useDashboardData must be used within a DashboardDataProvider')
  return ctx
}
