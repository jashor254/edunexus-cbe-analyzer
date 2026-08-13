'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { MissionControlData, PipelineHealth } from '@/lib/growth/types'
import type { TargetedSchool, RouteStep, PriorityBucket } from '@/lib/growth/targeting/types'
import type { ApiResponse } from '@/lib/api/response'

type DailyCounters = {
  todaysContacts: number
  todaysReplies: number
  discoveryMeetings: number
  demos: number
  pilots: number
  weeklyContactGoal: number
  monthlyPilotGoal: number
}

type EndOfDayReview = {
  schoolsContacted: string[]
  responses: string[]
  noResponses: string[]
  followUpsDueTomorrow: { schoolName: string; task: string }[]
  discoveryMeetingsBooked: string[]
  demoSchedule: string[]
  pilotOpportunities: string[]
}

// Sprint PO-5 (Founder Mission Control), refined by Sprint PE-3 into the
// founder's daily operating cockpit, and by Sprint PE-6 into a targeting
// engine: Mission Today no longer lists raw tasks (overdue follow-up, demo
// reminder, …) — it recommends SCHOOLS, ranked by a fully-explained Founder
// Priority Score (lib/growth/targeting/score.ts), with a concrete next
// action per school and zero hidden scoring. Sections 2 and 3-8 below are
// unchanged from PE-3/PE-2.5 — this sprint's mandate is Mission Today +
// Today's Route + filters + manual starring, nothing else.

const BUCKET_STYLE: Record<PriorityBucket, string> = {
  '🔥 Contact Today': 'border-red-300 bg-red-50',
  '📅 Schedule This Week': 'border-amber-300 bg-amber-50',
  '⏳ Waiting': 'border-neutral-200 bg-white',
  '🚫 Low Priority': 'border-neutral-100 bg-neutral-50',
}

type FilterDef = { key: string; label: string; predicate: (s: TargetedSchool) => boolean }

const FILTERS: FilterDef[] = [
  { key: 'public', label: 'Public', predicate: (s) => (s.category ?? '').toLowerCase().includes('public') },
  { key: 'private', label: 'Private', predicate: (s) => (s.category ?? '').toLowerCase().includes('private') },
  { key: 'junior', label: 'Junior Secondary', predicate: (s) => (s.category ?? '').toLowerCase().includes('junior') },
  { key: 'secondary', label: 'Secondary', predicate: (s) => (s.category ?? '').toLowerCase().includes('secondary') && !(s.category ?? '').toLowerCase().includes('junior') },
  { key: 'whatsapp', label: 'Has WhatsApp', predicate: (s) => s.hasWhatsapp },
  { key: 'phone', label: 'Has Phone', predicate: (s) => s.hasPhone },
  { key: 'needs_visit', label: 'Needs Visit', predicate: (s) => !s.hasWhatsapp && !s.hasPhone && !s.hasEmail },
  { key: 'research_complete', label: 'Research Complete', predicate: (s) => s.factors.some((f) => f.label.startsWith('Research complete') && f.satisfied) },
  { key: 'contacted', label: 'Contacted', predicate: (s) => s.pipelineStage === 'contacted' },
  { key: 'discovery', label: 'Discovery', predicate: (s) => s.pipelineStage === 'discovery' },
  { key: 'demo', label: 'Demo', predicate: (s) => s.pipelineStage === 'demo_scheduled' || s.pipelineStage === 'demo_completed' },
  { key: 'pilot', label: 'Pilot', predicate: (s) => ['pilot_offered', 'pilot_running', 'pilot_won'].includes(s.pipelineStage) },
]

const WIN_LABEL: Record<string, string> = {
  demo_completed: 'Demo completed',
  pilot_accepted: 'Pilot accepted',
  testimonial: 'Testimonial received',
  referral: 'Referral received',
  new_school: 'New school added',
}

const PIPELINE_STAGE_ORDER: { key: keyof PipelineHealth; label: string }[] = [
  { key: 'research', label: 'Research' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'discovery', label: 'Discovery' },
  { key: 'demo', label: 'Demo' },
  { key: 'pilot', label: 'Pilot' },
]

type PlatformStats = {
  users: number
  students: number
  assessments: number
  compassSessions: number
  payments: number
  totalRevenue: number
  activeSubscriptions: number
}

type RecentUser = {
  id: string
  email: string
  created_at: string
  plan: string
  balance: number
}

const PLAN_COLOR: Record<string, string> = {
  free: 'bg-neutral-100 text-neutral-600',
  starter: 'bg-blue-50 text-blue-700',
  term: 'bg-violet-50 text-violet-700',
  premium: 'bg-amber-50 text-amber-700',
}

export default function GrowthDashboardPage() {
  const [data, setData] = useState<MissionControlData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [targetedSchools, setTargetedSchools] = useState<TargetedSchool[] | null>(null)
  const [route, setRoute] = useState<RouteStep[]>([])
  const [readyToContact, setReadyToContact] = useState<TargetedSchool[]>([])
  const [targetingError, setTargetingError] = useState<string | null>(null)
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())

  const [dailyCounters, setDailyCounters] = useState<DailyCounters | null>(null)
  const [eodReview, setEodReview] = useState<EndOfDayReview | null>(null)

  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([])
  const [grantEmail, setGrantEmail] = useState('')
  const [grantStatus, setGrantStatus] = useState<string | null>(null)
  const [grantLoading, setGrantLoading] = useState(false)

  function loadTargeting() {
    fetch('/api/growth/targeting')
      .then((res) => res.json() as Promise<ApiResponse<{ targeting: { schools: TargetedSchool[]; route: RouteStep[]; readyToContact: TargetedSchool[] } }>>)
      .then((json) => {
        if (!json.success || !json.data) throw new Error(json.error ?? 'Failed to load the Pilot Targeting Engine')
        setTargetedSchools(json.data.targeting.schools)
        setRoute(json.data.targeting.route)
        setReadyToContact(json.data.targeting.readyToContact)
      })
      .catch((err) => setTargetingError(err instanceof Error ? err.message : 'Failed to load the Pilot Targeting Engine'))
  }

  useEffect(() => {
    fetch('/api/growth/dashboard')
      .then((res) => res.json() as Promise<ApiResponse<{ dashboard: MissionControlData }>>)
      .then((json) => {
        if (!json.success || !json.data) throw new Error(json.error ?? 'Failed to load Mission Control')
        setData(json.data.dashboard)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load Mission Control'))

    loadTargeting()

    fetch('/api/growth/daily-counters')
      .then((res) => res.json() as Promise<ApiResponse<{ counters: DailyCounters }>>)
      .then((json) => json.success && json.data && setDailyCounters(json.data.counters))

    fetch('/api/growth/end-of-day-review')
      .then((res) => res.json() as Promise<ApiResponse<{ review: EndOfDayReview }>>)
      .then((json) => json.success && json.data && setEodReview(json.data.review))

    fetch('/api/admin/stats')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setStats(json.data.stats)
      })
    fetch('/api/admin/recent-users')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setRecentUsers(json.data.users)
      })
  }, [])

  async function toggleStar(school: TargetedSchool) {
    // Optimistic update so starring feels instant; loadTargeting() re-syncs
    // the real ranking (a starred school jumps to the top) right after.
    setTargetedSchools((prev) => prev?.map((s) => (s.schoolId === school.schoolId ? { ...s, starred: !s.starred } : s)) ?? prev)
    await fetch(`/api/growth/schools/${school.schoolId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ starred: !school.starred }),
    })
    loadTargeting()
  }

  function toggleFilter(key: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const filteredSchools = useMemo(() => {
    if (!targetedSchools) return []
    if (activeFilters.size === 0) return targetedSchools
    return targetedSchools.filter((s) => Array.from(activeFilters).every((key) => FILTERS.find((f) => f.key === key)!.predicate(s)))
  }, [targetedSchools, activeFilters])

  const missionTodaySchools = useMemo(
    () => filteredSchools.filter((s) => s.bucket === '🔥 Contact Today' || s.bucket === '📅 Schedule This Week').slice(0, 6),
    [filteredSchools],
  )

  async function handleGrantAccess() {
    if (!grantEmail.trim()) return
    setGrantLoading(true)
    setGrantStatus(null)
    const res = await fetch('/api/admin/grant-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: grantEmail.trim(), days: 90 }),
    })
    const json = await res.json()
    setGrantStatus(
      json.success
        ? `Access granted to ${grantEmail} — expires ${new Date(json.data.expiresAt).toLocaleDateString()}`
        : `${json.error}`,
    )
    setGrantLoading(false)
    if (json.success) setGrantEmail('')
  }

  function handleExportCSV() {
    if (!recentUsers.length) return
    const header = 'id,email,created_at,plan,tokens'
    const rows = recentUsers.map((u) => `${u.id},${u.email},${u.created_at},${u.plan},${u.balance}`)
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `edunexus-users-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (error) return <p className="text-red-600">{error}</p>
  if (!data) return <p className="text-neutral-500">Loading…</p>

  const { pilotAcquisition, pipelineHealth, atRisk, recentWins, thisWeek } = data
  const maxStageValue = Math.max(1, ...PIPELINE_STAGE_ORDER.map((s) => pipelineHealth[s.key]))

  return (
    <div className="space-y-5">
      {/* Sprint PE-7 Part 6 — Daily Success Counter: simple numbers, no charts */}
      {dailyCounters && (
        <section className="grid grid-cols-3 gap-2 sm:grid-cols-7">
          <HeaderStat label="Today's Contacts" value={dailyCounters.todaysContacts} />
          <HeaderStat label="Today's Replies" value={dailyCounters.todaysReplies} />
          <HeaderStat label="Discovery Meetings" value={dailyCounters.discoveryMeetings} />
          <HeaderStat label="Demos" value={dailyCounters.demos} />
          <HeaderStat label="Pilots" value={dailyCounters.pilots} />
          <HeaderStat label="Weekly Goal" value={`${thisWeek.schoolsContacted}/${dailyCounters.weeklyContactGoal}`} />
          <HeaderStat label="Monthly Goal" value={`${dailyCounters.pilots}/${dailyCounters.monthlyPilotGoal}`} />
        </section>
      )}

      {/* Section 1 — Mission Today: the Pilot Targeting Engine's top recommendations, the dominant element on the page */}
      <section>
        <h1 className="mb-2 text-base font-bold uppercase tracking-wide text-neutral-800">Mission Today</h1>
        {targetingError && <p className="text-sm text-red-600">{targetingError}</p>}
        {!targetingError && targetedSchools === null && <p className="text-sm text-neutral-400">Loading…</p>}
        {targetedSchools !== null && missionTodaySchools.length === 0 && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            ✅ Nothing requires attention today.
          </p>
        )}
        {missionTodaySchools.length > 0 && (
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {missionTodaySchools.map((school) => (
              <SchoolRecommendationCard key={school.schoolId} school={school} onToggleStar={() => toggleStar(school)} />
            ))}
          </div>
        )}
      </section>

      {/* Sprint PE-7 Part 3 — First Contact Queue: auto-populates after any import, research complete + never contacted */}
      {readyToContact.length > 0 && (
        <section className="rounded-lg border border-red-200 bg-white p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700">🔥 Ready to Contact</h2>
          <ul className="space-y-1">
            {readyToContact.map((school) => (
              <li key={school.schoolId}>
                <Link href={`/growth/schools/${school.schoolId}`} className="flex items-center justify-between rounded-md px-1.5 py-1 text-sm hover:bg-neutral-50">
                  <span className="font-medium text-neutral-900">{school.schoolName}</span>
                  <span className="text-neutral-500">Score {school.score} · {school.nextAction}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Today's Route — sequencing only, not navigation */}
      {route.length > 0 && (
        <section className="rounded-lg border border-neutral-200 bg-white p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Today&apos;s Route</h2>
          <ol className="space-y-1">
            {route.map((step) => (
              <li key={step.schoolId} className="flex items-center justify-between rounded-md px-1.5 py-1 text-sm hover:bg-neutral-50">
                <span>
                  <span className="mr-2 font-mono text-neutral-400">{step.order}.</span>
                  <Link href={`/growth/schools/${step.schoolId}`} className="font-medium text-neutral-900 hover:underline">{step.schoolName}</Link>
                </span>
                <span className="text-neutral-500">{step.actionType} · {step.estimatedMinutes} min</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Quick filters + full ranked list — "never hide a school" means every school is inspectable, not just the top picks */}
      {targetedSchools !== null && targetedSchools.length > 0 && (
        <section className="rounded-lg border border-neutral-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">All Schools ({filteredSchools.length})</h2>
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => toggleFilter(f.key)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  activeFilters.has(f.key) ? 'border-violet-500 bg-violet-600 text-white' : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <ul className="divide-y divide-neutral-100">
            {filteredSchools.map((school) => (
              <li key={school.schoolId}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-1.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          toggleStar(school)
                        }}
                        className={school.starred ? 'text-amber-500' : 'text-neutral-300 hover:text-amber-400'}
                        aria-label="Toggle high interest"
                      >
                        ⭐
                      </button>
                      <Link href={`/growth/schools/${school.schoolId}`} className="truncate font-medium text-neutral-900 hover:underline">{school.schoolName}</Link>
                      <span className="shrink-0 text-xs text-neutral-400">{school.bucket}</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-neutral-700">{school.score}</span>
                  </summary>
                  <div className="ml-2 border-l border-neutral-100 py-1.5 pl-4 text-xs">
                    <p className="mb-1 font-medium text-neutral-700">Next action: {school.nextAction}</p>
                    <p className="mb-1 text-neutral-400">Why:</p>
                    <ul className="space-y-0.5">
                      {school.factors.filter((f) => f.satisfied).map((f) => (
                        <li key={f.label} className="text-emerald-700">✓ {f.label} (+{f.points})</li>
                      ))}
                      {school.factors.every((f) => !f.satisfied) && <li className="text-neutral-400">No positive signals found yet.</li>}
                    </ul>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Section 2 — Mission Progress: the August goal + stage funnel, compact */}
      <section className="rounded-lg border border-neutral-200 bg-white p-3">
        <div className="mb-2 flex items-baseline justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">August Pilot Goal</p>
            <p className="text-sm font-bold text-neutral-900">{pilotAcquisition.goal} Pilot Schools</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Progress</p>
            <p className="text-lg font-black text-violet-700">
              {pilotAcquisition.progress} <span className="text-sm font-medium text-neutral-400">/ {pilotAcquisition.goal}</span>
            </p>
          </div>
        </div>
        <div className="space-y-1">
          {PIPELINE_STAGE_ORDER.map((stage, i) => (
            <div key={stage.key}>
              <StageBar label={stage.label} value={pipelineHealth[stage.key]} max={maxStageValue} />
              {i < PIPELINE_STAGE_ORDER.length - 1 && <p className="pl-1 text-xs leading-none text-neutral-300">↓</p>}
            </div>
          ))}
        </div>
      </section>

      {/* Sections 3-7 — a compact grid, everything visible without scrolling */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card title="Pipeline Health">
          <div className="space-y-1.5">
            {PIPELINE_STAGE_ORDER.map((stage) => (
              <StageBar key={stage.key} label={stage.label} value={pipelineHealth[stage.key]} max={maxStageValue} />
            ))}
          </div>
        </Card>

        <Card title="At Risk">
          {atRisk.length === 0 && <Empty>Nothing at risk.</Empty>}
          <ul className="space-y-1">
            {atRisk.map((item) => (
              <li key={item.schoolId}>
                <Link href={`/growth/schools/${item.schoolId}`} className="block rounded-md px-1.5 py-1 text-sm hover:bg-neutral-50">
                  <span className="font-medium text-neutral-900">{item.schoolName}</span>
                  <span className="block text-xs text-amber-700">⚠ {item.reason}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Recent Wins">
          {recentWins.length === 0 && <Empty>No wins yet this period.</Empty>}
          <ul className="space-y-1">
            {recentWins.slice(0, 8).map((w, i) => (
              <li key={`${w.kind}-${w.schoolId}-${i}`}>
                <Link href={`/growth/schools/${w.schoolId}`} className="block rounded-md px-1.5 py-1 text-sm hover:bg-neutral-50">
                  <span className="font-medium text-neutral-900">{w.schoolName}</span>
                  <span className="block text-xs text-emerald-700">✅ {WIN_LABEL[w.kind]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="This Week">
          <PipelineRow label="Schools researched" value={thisWeek.schoolsResearched} />
          <PipelineRow label="Schools contacted" value={thisWeek.schoolsContacted} />
          <PipelineRow label="Discovery meetings" value={thisWeek.discoveryMeetings} />
          <PipelineRow label="Demos" value={thisWeek.demos} />
          <PipelineRow label="Pilot agreements" value={thisWeek.pilotAgreements} />
          <PipelineRow label="Active pilots" value={thisWeek.activePilots} />
        </Card>

        <Card title="Founder Focus">
          <div className="space-y-2 text-xs">
            <div>
              <p className="font-semibold text-neutral-500">Today&apos;s Goal</p>
              <p className="text-neutral-700">Complete every Mission Today task before doing new engineering.</p>
            </div>
            <div>
              <p className="font-semibold text-neutral-500">Reminder</p>
              <p className="text-neutral-700">Real conversations beat speculative features.</p>
            </div>
            <div>
              <p className="font-semibold text-neutral-500">Current Company Phase</p>
              <p className="text-neutral-700">Phase 1 — Earn the Right to Exist</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Sprint PE-7 Part 7 — End-of-Day Review: facts only, no AI summary */}
      {eodReview && (
        <details className="rounded-lg border border-neutral-200 bg-white p-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-neutral-500">End-of-Day Review</summary>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <EodList title="Schools contacted today" items={eodReview.schoolsContacted} />
            <EodList title="Responses" items={eodReview.responses} />
            <EodList title="No responses" items={eodReview.noResponses} />
            <EodList title="Follow-ups due tomorrow" items={eodReview.followUpsDueTomorrow.map((f) => `${f.schoolName} — ${f.task}`)} />
            <EodList title="Discovery meetings booked today" items={eodReview.discoveryMeetingsBooked} />
            <EodList title="Demo schedule" items={eodReview.demoSchedule} />
            <EodList title="Pilot opportunities" items={eodReview.pilotOpportunities} />
          </div>
        </details>
      )}

      {/* Section 8 — Platform Admin: secondary, visually de-emphasized, below Founder Mission Control */}
      <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/60 p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">Platform Admin (secondary)</h2>

        <section className="mb-4">
          <h3 className="mb-2 text-xs font-medium text-neutral-400">Platform Stats</h3>
          {stats ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {[
                { label: 'Total Users', value: stats.users.toLocaleString() },
                { label: 'Students', value: stats.students.toLocaleString() },
                { label: 'Assessments', value: stats.assessments.toLocaleString() },
                { label: 'Compass Sessions', value: stats.compassSessions.toLocaleString() },
                { label: 'Payments', value: stats.payments.toLocaleString() },
                { label: 'Total Revenue', value: `KES ${stats.totalRevenue.toLocaleString()}` },
                { label: 'Active Subs', value: stats.activeSubscriptions.toLocaleString() },
              ].map((s) => (
                <div key={s.label} className="rounded-md border border-neutral-200 bg-white p-2.5">
                  <p className="text-[11px] text-neutral-400">{s.label}</p>
                  <p className="text-base font-semibold text-neutral-700">{s.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-400">Loading…</p>
          )}
        </section>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <section>
            <h3 className="mb-2 text-xs font-medium text-neutral-400">Recent Sign-ups</h3>
            <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-xs uppercase text-neutral-400">
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="hidden px-3 py-2 text-left md:table-cell">Signed up</th>
                    <th className="px-3 py-2 text-left">Plan</th>
                    <th className="px-3 py-2 text-right">Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-neutral-400">Loading…</td>
                    </tr>
                  ) : (
                    recentUsers.map((u) => (
                      <tr key={u.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50">
                        <td className="px-3 py-2 text-neutral-700">{u.email}</td>
                        <td className="hidden px-3 py-2 text-neutral-500 md:table-cell">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${PLAN_COLOR[u.plan] ?? PLAN_COLOR.free}`}>{u.plan}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-amber-700">{u.balance.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="mb-2 text-xs font-medium text-neutral-400">Give User Free Access</h3>
              <div className="rounded-md border border-neutral-200 bg-white p-3">
                <p className="mb-2 text-xs text-neutral-400">Grants a 90-day Term subscription + 50 tokens</p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="user@example.com"
                    value={grantEmail}
                    onChange={(e) => setGrantEmail(e.target.value)}
                    className="flex-1 rounded-md border border-neutral-200 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none"
                  />
                  <button
                    onClick={handleGrantAccess}
                    disabled={grantLoading || !grantEmail.trim()}
                    className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-40"
                  >
                    {grantLoading ? '…' : 'Grant'}
                  </button>
                </div>
                {grantStatus && <p className="mt-2 text-xs text-neutral-600">{grantStatus}</p>}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-medium text-neutral-400">Quick Actions</h3>
              <div className="space-y-1.5 rounded-md border border-neutral-200 bg-white p-3">
                <Link href="/admin/pilot" className="block rounded-md px-3 py-1.5 text-sm text-violet-700 hover:bg-violet-50">Pilot Students →</Link>
                <Link href="/admin/schools" className="block rounded-md px-3 py-1.5 text-sm text-violet-700 hover:bg-violet-50">Live Schools &amp; Payments →</Link>
                <Link href="/admin/core-schools/new" className="block rounded-md px-3 py-1.5 text-sm text-violet-700 hover:bg-violet-50">Onboard Core School →</Link>
                <button onClick={handleExportCSV} className="block w-full rounded-md px-3 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-50">Export Users CSV ↓</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

/** Mission Today's rich card, matching PE-6's own worked example: bucket + name, Score, Why (every satisfied factor visible — no black box), Next action, and a manual ⭐ boost toggle. */
function SchoolRecommendationCard({ school, onToggleStar }: { school: TargetedSchool; onToggleStar: () => void }) {
  const satisfiedFactors = school.factors.filter((f) => f.satisfied)
  return (
    <div className={`rounded-lg border-2 p-4 shadow-sm ${BUCKET_STYLE[school.bucket]}`}>
      <div className="mb-1 flex items-start justify-between gap-2">
        <Link href={`/growth/schools/${school.schoolId}`} className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-neutral-900">{school.bucket} {school.schoolName}</span>
        </Link>
        <button
          onClick={onToggleStar}
          className={`shrink-0 text-lg ${school.starred ? 'text-amber-500' : 'text-neutral-300 hover:text-amber-400'}`}
          aria-label="Toggle high interest"
        >
          ⭐
        </button>
      </div>
      <p className="mb-2 text-xs font-semibold text-neutral-500">Score: {school.score}</p>
      <p className="mb-1 text-xs font-medium text-neutral-500">Why:</p>
      <ul className="mb-2 space-y-0.5">
        {satisfiedFactors.length === 0 && <li className="text-xs text-neutral-400">No positive signals found yet.</li>}
        {satisfiedFactors.map((f) => (
          <li key={f.label} className="text-xs text-emerald-700">✓ {f.label}</li>
        ))}
      </ul>
      <p className="text-xs font-semibold text-neutral-700">Next action: {school.nextAction}</p>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-neutral-200 bg-white p-3">
      <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</h2>
      {children}
    </section>
  )
}

/** Section 3's readable-bar example ("Research ██████ 18") without percentages or a charting library — width is proportional to the largest stage value on the page. */
function StageBar({ label, value, max }: { label: string; value: number; max: number }) {
  const widthPct = Math.max(4, Math.round((value / max) * 100))
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-16 shrink-0 text-neutral-600">{label}</span>
      <span className="h-3 flex-1 overflow-hidden rounded-full bg-neutral-100">
        <span className="block h-full rounded-full bg-violet-500" style={{ width: `${widthPct}%` }} />
      </span>
      <span className="w-6 shrink-0 text-right font-semibold text-neutral-900">{value}</span>
    </div>
  )
}

function PipelineRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-100 py-1 last:border-0">
      <span className="text-sm text-neutral-600">{label}</span>
      <span className="text-sm font-semibold text-neutral-900">{value}</span>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-neutral-400">{children}</p>
}

function HeaderStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-2 text-center">
      <p className="text-[10px] uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="text-base font-bold text-neutral-800">{value}</p>
    </div>
  )
}

function EodList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-neutral-500">{title} ({items.length})</p>
      {items.length === 0 ? (
        <p className="text-xs text-neutral-300">None.</p>
      ) : (
        <ul className="space-y-0.5 text-xs text-neutral-700">
          {items.map((item, i) => <li key={i}>- {item}</li>)}
        </ul>
      )}
    </div>
  )
}
