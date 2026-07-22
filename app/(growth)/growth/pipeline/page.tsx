'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { GrowthSchool, GrowthPipelineStage } from '@/lib/growth/types'
import { GROWTH_PIPELINE_STAGES } from '@/lib/growth/types'
import type { ApiResponse } from '@/lib/api/response'

const STAGE_LABELS: Record<string, string> = {
  research: 'Research', contacted: 'Contacted', discovery: 'Discovery',
  demo_scheduled: 'Demo Scheduled', demo_completed: 'Demo Completed',
  pilot_offered: 'Pilot Offered', pilot_running: 'Pilot Running',
  pilot_won: 'Pilot Won', deferred: 'Deferred', lost: 'Lost',
}

export default function PipelinePage() {
  const [schools, setSchools] = useState<GrowthSchool[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    fetch('/api/growth/schools')
      .then((res) => res.json() as Promise<ApiResponse<{ schools: GrowthSchool[] }>>)
      .then((json) => {
        if (!json.success || !json.data) throw new Error(json.error ?? 'Failed to load pipeline')
        setSchools(json.data.schools)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load pipeline'))
  }

  useEffect(load, [])

  // Single-writer stage change (Blueprint §4.2) — this and the School Detail
  // page's stage selector both call the same PATCH .../stage route, never a
  // direct field write.
  async function moveSchool(schoolId: string, stage: GrowthPipelineStage) {
    await fetch(`/api/growth/schools/${schoolId}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    })
    load()
  }

  if (error) return <p className="text-red-600">{error}</p>

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-neutral-900">Pipeline</h1>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {GROWTH_PIPELINE_STAGES.map((stage) => {
          const inStage = schools.filter((s) => s.pipeline_stage === stage)
          return (
            <div key={stage} className="w-56 flex-shrink-0 rounded-md border border-neutral-200 bg-white">
              <div className="border-b border-neutral-200 px-3 py-2">
                <h2 className="text-xs font-semibold uppercase text-neutral-500">{STAGE_LABELS[stage]}</h2>
                <span className="text-xs text-neutral-400">{inStage.length}</span>
              </div>
              <div className="space-y-2 p-2">
                {inStage.map((school) => (
                  <div key={school.id} className="rounded-md border border-neutral-200 p-2 text-sm">
                    <Link href={`/growth/schools/${school.id}`} className="font-medium text-neutral-900 hover:underline">
                      {school.name}
                    </Link>
                    <select
                      value={school.pipeline_stage}
                      onChange={(e) => moveSchool(school.id, e.target.value as GrowthPipelineStage)}
                      className="mt-1 w-full rounded border border-neutral-300 px-1 py-0.5 text-xs"
                    >
                      {GROWTH_PIPELINE_STAGES.map((s) => (
                        <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
