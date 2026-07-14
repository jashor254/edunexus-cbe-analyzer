'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertOctagon, AlertTriangle, Eye, Sparkles, X, Loader2 } from 'lucide-react'
import type { AttentionItem, AttentionSeverity } from '@/lib/attentionFeed/types'
import { topPriorityItems } from '@/lib/attentionFeed/prioritize'
import { useDashboardData } from '@/components/teacher/DashboardDataProvider'

const MISSION_PRIORITY_COUNT = 3

const SEVERITY_META: Record<AttentionSeverity, { label: string; icon: typeof AlertOctagon; cls: string; iconCls: string }> = {
  critical: { label: 'Critical', icon: AlertOctagon,  cls: 'bg-red-50 border-red-100',    iconCls: 'bg-red-500 text-white' },
  at_risk:  { label: 'At risk',  icon: AlertTriangle, cls: 'bg-amber-50 border-amber-100', iconCls: 'bg-amber-500 text-white' },
  watch:    { label: 'Watch',    icon: Eye,           cls: 'bg-blue-50 border-blue-100',   iconCls: 'bg-blue-500 text-white' },
  info:     { label: 'Good news', icon: Sparkles,     cls: 'bg-emerald-50 border-emerald-100', iconCls: 'bg-emerald-500 text-white' },
}

export default function AttentionFeed() {
  const { attentionItems } = useDashboardData()
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set())
  const [dismissing, setDismissing]       = useState<string | null>(null)

  const loading = attentionItems === null

  // Today's Mission already surfaces the top priorities up front — don't
  // repeat them here (no duplicate recommendations across the dashboard).
  const alreadySurfaced = new Set(
    topPriorityItems(attentionItems ?? [], MISSION_PRIORITY_COUNT).map((i) => i.itemKey)
  )
  const items = (attentionItems ?? []).filter(
    (i) => !alreadySurfaced.has(i.itemKey) && !dismissedKeys.has(i.itemKey)
  )

  async function dismiss(itemKey: string) {
    setDismissing(itemKey)
    setDismissedKeys((prev) => new Set(prev).add(itemKey))
    try {
      await fetch('/api/teacher/attention-feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemKey }),
      })
    } finally {
      setDismissing(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 text-center">
        <p className="text-gray-500 text-sm font-bold">Everything looks good today.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="font-black text-gray-900 text-sm">Needs your attention</h2>
        <p className="text-gray-400 text-xs mt-0.5">{items.length} item{items.length !== 1 ? 's' : ''} across your classes</p>
      </div>
      <div className="divide-y divide-gray-50">
        {items.map((item: AttentionItem) => {
          const meta = SEVERITY_META[item.severity]
          const Icon = meta.icon
          return (
            <div key={item.itemKey} className={`flex items-start gap-3 px-5 py-4 ${meta.cls}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.iconCls}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <Link href={item.actionLink} className="font-bold text-gray-900 text-sm hover:underline">
                  {item.title}
                </Link>
                <p className="text-gray-600 text-xs mt-0.5">{item.detail}</p>
                {item.suggestedAction && (
                  <p className="text-gray-500 text-xs mt-1 italic">{item.suggestedAction}</p>
                )}
              </div>
              <button
                onClick={() => dismiss(item.itemKey)}
                disabled={dismissing === item.itemKey}
                className="text-gray-300 hover:text-gray-600 transition shrink-0"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
