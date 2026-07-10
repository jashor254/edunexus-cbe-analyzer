'use client'

import { useEffect, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import type { Insight, ConfidenceLevel } from '@/lib/learnerIntelligence/insight'
import type { LearnerBlueprint as LearnerBlueprintData } from '@/lib/learnerIntelligence/types'

const CONFIDENCE_STYLE: Record<ConfidenceLevel, string> = {
  High:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Low:    'bg-gray-50 text-gray-500 border-gray-200',
}

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm space-y-2">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-gray-900">{insight.observation}</p>
        <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${CONFIDENCE_STYLE[insight.confidence]}`}>
          {insight.confidence}
        </span>
      </div>
      {insight.evidence.length > 0 && (
        <ul className="text-xs text-gray-500 list-disc list-inside space-y-0.5">
          {insight.evidence.map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      )}
      <p className="text-sm text-gray-700 pt-1 border-t border-gray-50">
        <span className="font-medium text-gray-900">Recommended: </span>{insight.action}
      </p>
    </div>
  )
}

export default function LearnerBlueprint({ studentId }: { studentId: string }) {
  const [data, setData]       = useState<LearnerBlueprintData | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/learner-intelligence/blueprint?studentId=${studentId}`)
      .then(async r => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error ?? 'Failed to load Learner Blueprint')
        setData(json.blueprint)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load Learner Blueprint'))
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
        <AlertCircle className="w-4 h-4" /> {error ?? 'Could not load this learner\'s Blueprint.'}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 p-6">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">{data.studentName}&apos;s Learner Blueprint</h1>
        <p className="text-sm text-gray-500">
          Grade {data.grade}{data.school ? ` · ${data.school}` : ''}{data.term ? ` · Term ${data.term}, ${data.year}` : ''}
        </p>
        <p className="text-xs text-gray-400 mt-2 italic">{data.disclaimer}</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Who is this learner becoming?</h2>
        {data.becoming.insights.length === 0
          ? <p className="text-sm text-gray-500">Insufficient assessment data yet to speak to this.</p>
          : data.becoming.insights.map((insight, i) => <InsightCard key={i} insight={insight} />)}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Greatest opportunity</h2>
        <InsightCard insight={data.opportunity.insight} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">What should happen next?</h2>
        <div className="grid gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1">FOR PARENTS</p>
            <InsightCard insight={data.actions.parent} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1">FOR TEACHERS</p>
            <InsightCard insight={data.actions.teacher} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1">FOR THE LEARNER</p>
            <InsightCard insight={data.actions.learner} />
          </div>
        </div>
      </section>
    </div>
  )
}
