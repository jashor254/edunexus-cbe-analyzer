'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { GrowthSchool } from '@/lib/growth/types'
import type { ApiResponse } from '@/lib/api/response'

const STAGE_LABELS: Record<string, string> = {
  research: 'Research', contacted: 'Contacted', discovery: 'Discovery',
  demo_scheduled: 'Demo Scheduled', demo_completed: 'Demo Completed',
  pilot_offered: 'Pilot Offered', pilot_running: 'Pilot Running',
  pilot_won: 'Pilot Won', deferred: 'Deferred', lost: 'Lost',
}

export default function SchoolsPage() {
  const [schools, setSchools] = useState<GrowthSchool[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [county, setCounty] = useState('')
  const [category, setCategory] = useState('')
  // Sprint PO-1 (Pilot Acquisition Engine) §1, Research Workflow — captured
  // at the moment a school is added, since that's when the founder has the
  // research fresh; all optional, none block adding the school.
  const [selectionReason, setSelectionReason] = useState('')
  const [contactSource, setContactSource] = useState('')
  const [existingIctActivity, setExistingIctActivity] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    fetch('/api/growth/schools')
      .then((res) => res.json() as Promise<ApiResponse<{ schools: GrowthSchool[] }>>)
      .then((json) => {
        if (!json.success || !json.data) throw new Error(json.error ?? 'Failed to load schools')
        setSchools(json.data.schools)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load schools'))
  }

  useEffect(load, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/growth/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, county: county || null, category: category || null,
          selectionReason: selectionReason || null,
          contactSource: contactSource || null,
          existingIctActivity: existingIctActivity || null,
        }),
      })
      const json = (await res.json()) as ApiResponse<{ school: GrowthSchool }>
      if (!json.success) throw new Error(json.error ?? 'Failed to add school')
      setName('')
      setCounty('')
      setCategory('')
      setSelectionReason('')
      setContactSource('')
      setExistingIctActivity('')
      setShowAdd(false)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add school')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">Schools</h1>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
        >
          {showAdd ? 'Cancel' : '+ Add school'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {showAdd && (
        <form onSubmit={handleAdd} className="space-y-2 rounded-md border border-neutral-200 bg-white p-4">
          <input
            required
            placeholder="School name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <input
              placeholder="County"
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
            />
            <input
              placeholder="Category (e.g. Junior Secondary)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
            />
          </div>
          <input
            placeholder="Why this school? (optional)"
            value={selectionReason}
            onChange={(e) => setSelectionReason(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <input
              placeholder="Contact source (optional)"
              value={contactSource}
              onChange={(e) => setContactSource(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
            />
            <input
              placeholder="Existing ICT activity (optional)"
              value={existingIctActivity}
              onChange={(e) => setExistingIctActivity(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? 'Adding…' : 'Add'}
          </button>
        </form>
      )}

      <div className="divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white">
        {schools.length === 0 && <p className="p-4 text-sm text-neutral-400">No schools yet — add your first one.</p>}
        {schools.map((school) => (
          <Link
            key={school.id}
            href={`/growth/schools/${school.id}`}
            className="flex items-center justify-between px-4 py-3 text-sm hover:bg-neutral-50"
          >
            <div>
              <span className="font-medium text-neutral-900">{school.name}</span>
              {school.county && <span className="ml-2 text-neutral-500">{school.county}</span>}
            </div>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
              {STAGE_LABELS[school.pipeline_stage] ?? school.pipeline_stage}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
