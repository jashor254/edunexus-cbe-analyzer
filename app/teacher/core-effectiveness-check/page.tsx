'use client'

// School Effectiveness Check — the CBC-Gatsby diagnostic (ADR-0034).
// Staff rate the school against the 11 benchmarks (self-report); the page
// posts them and renders the scored profile: overall maturity, prioritised
// gaps, the EduNexus programmes that close them, and the honestly-unaddressed
// gaps. UI only — all logic is in lib/schoolEffectiveness + the API route.

import { useState, useEffect, useCallback } from 'react'
import { CBC_GATSBY_BENCHMARKS } from '@/lib/schoolEffectiveness/benchmarks'
import type { SchoolEffectivenessProfile } from '@/lib/schoolEffectiveness/types'

type Membership = { schoolId: string; schoolName: string } | null

type CheckRow = {
  id: string
  created_at: string
  profile: SchoolEffectivenessProfile
}

const LEVELS = [0, 1, 2, 3, 4] as const
type Level = (typeof LEVELS)[number]

const STAGE_LABEL: Record<string, string> = {
  absent: 'Absent',
  emerging: 'Emerging',
  developing: 'Developing',
  established: 'Established',
  embedded: 'Embedded',
}

export default function EffectivenessCheckPage() {
  const [membership, setMembership] = useState<Membership | undefined>(undefined)
  const [ratings, setRatings] = useState<Record<string, Level>>({})
  const [profile, setProfile] = useState<SchoolEffectivenessProfile | null>(null)
  const [latest, setLatest] = useState<CheckRow | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/core/my-membership', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setMembership(d.membership ?? null))
      .catch(() => setMembership(null))
  }, [])

  const schoolId = membership?.schoolId
  useEffect(() => {
    if (!schoolId) return
    fetch(`/api/school/effectiveness-check?schoolId=${schoolId}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { data: null }))
      .then((d) => setLatest(d.data ?? null))
      .catch(() => {})
  }, [schoolId])

  const submit = useCallback(async () => {
    if (!schoolId) return
    setSubmitting(true)
    setError('')
    const selfReport = Object.entries(ratings).map(([benchmarkId, level]) => ({ benchmarkId, level }))
    try {
      const res = await fetch('/api/school/effectiveness-check', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, selfReport }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(typeof body.error === 'string' ? body.error : 'Could not save the Check.')
        return
      }
      setProfile(body.data.profile as SchoolEffectivenessProfile)
      setLatest(body.data as CheckRow)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [schoolId, ratings])

  if (membership === undefined) return <main className="p-6 text-white/60">Loading…</main>
  if (membership === null)
    return <main className="p-6 text-white/80">You need an active school membership to run the Effectiveness Check.</main>

  const core = CBC_GATSBY_BENCHMARKS.filter((b) => b.framework === 'gatsby_core')
  const beyond = CBC_GATSBY_BENCHMARKS.filter((b) => b.framework === 'edunexus_beyond')
  const rated = Object.keys(ratings).length

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6 text-white">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">School Effectiveness Check</h1>
        <p className="text-white/60 text-sm">
          {membership.schoolName} · Rate your school honestly against each benchmark (0 = absent, 4 = fully embedded).
        </p>
      </header>

      {profile && <ProfileView profile={profile} />}

      <section className="space-y-6">
        <BenchmarkGroup title="Good career guidance (Gatsby)" items={core} ratings={ratings} setRatings={setRatings} />
        <BenchmarkGroup title="Beyond traditional guidance (EduNexus)" items={beyond} ratings={ratings} setRatings={setRatings} />
      </section>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={submitting || rated === 0}
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 font-semibold disabled:opacity-50"
        >
          {submitting ? 'Scoring…' : `Run the Check (${rated}/${CBC_GATSBY_BENCHMARKS.length} rated)`}
        </button>
        {latest && !profile && (
          <button
            onClick={() => setProfile(latest.profile)}
            className="text-sm text-violet-400 hover:text-violet-300"
          >
            View last result
          </button>
        )}
      </div>
    </main>
  )
}

function BenchmarkGroup({
  title,
  items,
  ratings,
  setRatings,
}: {
  title: string
  items: typeof CBC_GATSBY_BENCHMARKS
  ratings: Record<string, Level>
  setRatings: (fn: (prev: Record<string, Level>) => Record<string, Level>) => void
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs uppercase tracking-wide text-white/40 font-semibold">{title}</h2>
      {items.map((b) => {
        const current = ratings[b.id]
        return (
          <div key={b.id} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-sm">{b.name}</p>
                <p className="text-white/50 text-xs mt-0.5">{b.signal}</p>
              </div>
              {b.horizon && (
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-amber-300/80 border border-amber-500/30 rounded-full px-2 py-0.5">
                  not yet addressed
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setRatings((prev) => ({ ...prev, [b.id]: lvl }))}
                  className={`w-9 h-9 rounded-lg text-sm font-semibold border ${
                    current === lvl
                      ? 'bg-violet-600 border-violet-400'
                      : 'bg-transparent border-white/15 text-white/60 hover:border-white/40'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
            {current !== undefined && (
              <p className="text-white/50 text-xs italic">{b.rubric[current].descriptor}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ProfileView({ profile }: { profile: SchoolEffectivenessProfile }) {
  return (
    <section className="bg-white/5 border border-violet-500/20 rounded-2xl p-5 space-y-4">
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold">{profile.overall_percent}%</span>
        <span className="text-white/60 text-sm">
          {STAGE_LABEL[profile.overall_stage] ?? profile.overall_stage} · {profile.benchmarks_rated}/{profile.benchmarks_total} rated
        </span>
      </div>
      <p className="text-white/70 text-sm leading-relaxed">{profile.summary}</p>

      {profile.prioritised_gaps.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-white/40 font-semibold">Priority gaps</p>
          {profile.prioritised_gaps.map((g) => (
            <div key={g.benchmarkId} className="flex items-start justify-between gap-3 border-b border-white/5 pb-2">
              <div>
                <p className="text-sm">{g.name}</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {g.recommended.map((p) => (
                    <span key={p.key} className="text-[11px] bg-violet-500/15 border border-violet-500/25 rounded-full px-2 py-0.5 text-violet-200">
                      {p.label}
                    </span>
                  ))}
                  {g.unaddressed && (
                    <span className="text-[11px] text-amber-300/80 border border-amber-500/25 rounded-full px-2 py-0.5">
                      no programme yet
                    </span>
                  )}
                </div>
              </div>
              <span className="shrink-0 text-xs text-white/40 capitalize">{g.priority}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
