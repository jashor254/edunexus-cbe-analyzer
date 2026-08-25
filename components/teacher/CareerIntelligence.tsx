'use client'

import { useEffect, useState } from 'react'
import { Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import type { ConfidenceLevel, Insight } from '@/lib/learnerIntelligence/insight'
import type {
  CareerFamilyInsight,
  CareerMatchInsight,
} from '@/lib/learnerIntelligence/careerIntelligence'
import type {
  CareerIntelligence as CareerIntelligenceData,
} from '@/lib/learnerIntelligence/careerIntelligenceOrchestration'

const CONFIDENCE_STYLE: Record<ConfidenceLevel, string> = {
  High:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Low:    'bg-gray-50 text-gray-500 border-gray-200',
}

const TIER_STYLE: Record<CareerMatchInsight['tier'], string> = {
  primary:         'bg-emerald-50 text-emerald-700',
  stretch:         'bg-blue-50 text-blue-700',
  alternative:     'bg-amber-50 text-amber-700',
  entrepreneurial: 'bg-purple-50 text-purple-700',
}

const TIER_LABEL: Record<CareerMatchInsight['tier'], string> = {
  primary:         'Strong Match',
  stretch:         'Stretch Goal',
  alternative:     'Alternative Path',
  entrepreneurial: 'Entrepreneurial Opportunity',
}

function ExpandableCard({
  title, badge, badgeCls, insight,
}: {
  title: string
  badge: string
  badgeCls: string
  insight: Insight
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">{title}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeCls}`}>{badge}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${CONFIDENCE_STYLE[insight.confidence]}`}>
            {insight.confidence} confidence
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-50 pt-3">
          <p className="text-sm text-gray-800">{insight.observation}</p>
          {insight.evidence.length > 0 && (
            <ul className="text-xs text-gray-500 list-disc list-inside space-y-0.5">
              {insight.evidence.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          )}
          <p className="text-sm text-gray-700 pt-1 border-t border-gray-50">
            <span className="font-medium text-gray-900">Explore this by: </span>{insight.action}
          </p>
        </div>
      )}
    </div>
  )
}

function JuniorView({ families }: { families: CareerFamilyInsight[] }) {
  if (families.length === 0) {
    return <p className="text-sm text-gray-500">Not enough assessment data yet to explore career families.</p>
  }
  return (
    <div className="space-y-3">
      {families.map(f => (
        <ExpandableCard
          key={f.category}
          title={f.categoryLabel}
          badge="Career Family"
          badgeCls="bg-indigo-50 text-indigo-700"
          insight={f.insight}
        />
      ))}
    </div>
  )
}

function SeniorView({ matches }: { matches: CareerMatchInsight[] }) {
  if (matches.length === 0) {
    return <p className="text-sm text-gray-500">Not enough assessment data yet to compute career matches.</p>
  }
  return (
    <div className="space-y-3">
      {matches.map(m => (
        <ExpandableCard
          key={m.careerSlug}
          title={`${m.careerTitle} · ${m.alignmentPct}%`}
          badge={TIER_LABEL[m.tier]}
          badgeCls={TIER_STYLE[m.tier]}
          insight={m.insight}
        />
      ))}
    </div>
  )
}

export default function CareerIntelligence({ studentId }: { studentId: string }) {
  const [data, setData]       = useState<CareerIntelligenceData | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/learner-intelligence/career?studentId=${studentId}`)
      .then(async r => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error ?? 'Failed to load Career Intelligence')
        setData(json.careerIntelligence)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load Career Intelligence'))
      .finally(() => setLoading(false))
  }, [studentId])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 p-6">
        <AlertCircle className="w-4 h-4" /> {error ?? 'Could not load Career Intelligence for this learner.'}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">{data.studentName}&apos;s Career Intelligence</h1>
        <p className="text-sm text-gray-500">
          Grade {data.grade} · {data.mode === 'exploration' ? 'Exploring broad career families' : 'Planning specific pathways'}
        </p>
        <p className="text-xs text-gray-400 mt-2 italic">{data.disclaimer}</p>
      </header>

      {data.notice && (
        <div className="text-sm text-gray-500 border border-gray-100 rounded-xl p-4 bg-white">
          {data.notice.observation}
        </div>
      )}

      {data.families && <JuniorView families={data.families} />}
      {data.matches && <SeniorView matches={data.matches} />}
    </div>
  )
}
