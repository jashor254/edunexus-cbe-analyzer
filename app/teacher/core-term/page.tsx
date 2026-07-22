'use client'

// app/teacher/core-term/page.tsx
//
// Sprint 10A Commit 3 — the teacher-facing End-of-Term screen. Every action
// here calls an existing, unmodified Core route (only one new thin action,
// 'publish' on app/api/core/assessments/route.ts, was added this commit —
// see that route's own comment). No business logic lives in this file: it
// only displays state already computed by lib/core/assessments.ts and
// lib/core/report-cards.ts, and calls their routes in the mission's own
// order (lock -> compute -> generate -> publish).
//
// Scoped to the caller's current term only (via /api/core/my-membership) —
// no historical-term picker, matching this sprint's "smallest compliant
// solution" scope.
//
// Styling matches app/teacher/dashboard/page.tsx's light theme convention
// (bg-slate-50 layout, slate-900 text, teal-600 accents) — the dark-theme
// pattern seen elsewhere in this codebase (app/admin/core-schools/new)
// belongs to a standalone page outside the teacher layout and does not
// apply here (confirmed by actually rendering this page).

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Loader2, AlertCircle, CheckCircle2, Circle, Lock } from 'lucide-react'
import type { ClassWithDetails, SchoolReportCard, Term } from '@/types/core'
import { OperationalBreadcrumb } from '@/components/core/OperationalBreadcrumb'
import {
  getPreferredClassId, setPreferredClassId,
  getLastWorkingContext, setLastWorkingContext, clearLastWorkingContext,
} from '@/lib/config/teacherWorkspaceMemory'

type Membership = {
  schoolId: string
  schoolName: string
  role: string
  currentTerm: Term | null
}

type CoreAssessment = {
  id: string
  title: string
  term: string
  year: number
  is_published: boolean
  subjects: string[]
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.formErrors?.[0] ?? json.error ?? 'Request failed')
  return json.data as T
}

export default function TeacherCoreTermPage() {
  const [membership, setMembership] = useState<Membership | null | undefined>(undefined)
  const [classes, setClasses] = useState<ClassWithDetails[]>([])
  const [classId, setClassId] = useState('')
  const [year, setYear] = useState<number>(new Date().getFullYear())

  const [assessments, setAssessments] = useState<CoreAssessment[]>([])
  const [summaryReady, setSummaryReady] = useState(false)
  const [reportCards, setReportCards] = useState<SchoolReportCard[]>([])

  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null) // action currently in flight
  const [loadingClassData, setLoadingClassData] = useState(false)
  // Sprint 10 (Core Administration Completion, Phase 4 — Report Approval):
  // publishing is parent-facing and irreversible in effect (generateReportCards
  // refuses to regenerate over a published card — see that function's own
  // guard comment), so this is now a deliberate two-click action instead of
  // one click firing the request immediately. No backend change — the same
  // publishReportCards() call, gated the same way (canPublishReport,
  // admin-tier only); this only adds a client-side pause before it fires.
  const [confirmingPublish, setConfirmingPublish] = useState(false)

  useEffect(() => {
    fetchJson<{ membership: Membership | null }>('/api/core/my-membership')
      .then(({ membership }) => {
        setMembership(membership)
        if (membership?.currentTerm) setYear(new Date(membership.currentTerm.start_date).getFullYear())
      })
      .catch(e => { setMembership(null); setError(e instanceof Error ? e.message : 'Failed to load your school') })
  }, [])

  useEffect(() => {
    if (!membership) return
    fetchJson<{ classes: ClassWithDetails[] }>(`/api/core/classes?schoolId=${membership.schoolId}`)
      .then(({ classes }) => {
        setClasses(classes)
        // PRP-4 (Teacher Continuity, Phase 6) — restore the class a
        // teacher last worked on here, but only if it still genuinely
        // exists in this school's class list (never fabricate a
        // selection); a teacher can always change it, this only saves
        // re-picking the same class on a return visit (Phase 1's audit
        // found this page reset its picker on every load).
        const preferred = getPreferredClassId('core-term')
        if (preferred && classes.some(c => c.id === preferred)) setClassId(preferred)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load classes'))
  }, [membership])

  function selectClass(id: string) {
    setClassId(id)
    setConfirmingPublish(false)
    if (id) setPreferredClassId('core-term', id)
  }

  const termNumber = membership?.currentTerm?.term_number
  const termId = membership?.currentTerm?.id

  const refresh = useCallback(async () => {
    if (!membership || !classId || !termNumber || !termId) return
    setLoadingClassData(true)
    setError('')
    try {
      const [assessmentData, summaryData, reportData] = await Promise.all([
        fetchJson<CoreAssessment[]>(
          `/api/core/assessments?schoolId=${membership.schoolId}&classId=${classId}&term=${termNumber}&year=${year}`
        ),
        fetchJson<unknown[]>(
          `/api/core/assessments?schoolId=${membership.schoolId}&classId=${classId}&view=summary&termId=${termId}`
        ),
        fetchJson<SchoolReportCard[]>(
          `/api/core/reports?schoolId=${membership.schoolId}&classId=${classId}&termId=${termId}`
        ).catch(() => [] as SchoolReportCard[]), // 404 = no report cards generated yet, not an error
      ])
      setAssessments(assessmentData)
      setSummaryReady(summaryData.length > 0)
      setReportCards(reportData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load class data')
    } finally {
      setLoadingClassData(false)
    }
  }, [membership, classId, termNumber, termId, year])

  useEffect(() => { refresh() }, [refresh])

  async function runAction(key: string, fn: () => Promise<unknown>) {
    setBusy(key)
    setError('')
    try {
      await fn()
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  const lockAssessment = (assessmentId: string) =>
    runAction(`lock-${assessmentId}`, () =>
      fetchJson('/api/core/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish', schoolId: membership!.schoolId, classId, assessmentId }),
      })
    )

  const generateSummaries = () =>
    runAction('compute', () =>
      fetchJson('/api/core/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'compute', schoolId: membership!.schoolId, classId, termId }),
      })
    )

  const generateReportCards = () =>
    runAction('generate', () =>
      fetchJson('/api/core/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: membership!.schoolId, classId, termId }),
      })
    )

  const publishReportCards = () => {
    if (!confirmingPublish) { setConfirmingPublish(true); return }
    setConfirmingPublish(false)
    return runAction('publish-reports', () =>
      fetchJson('/api/core/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish', schoolId: membership!.schoolId, classId, termId }),
      })
    )
  }

  const assessmentsLocked  = assessments.length > 0 && assessments.every(a => a.is_published)
  const reportsGenerated   = reportCards.length > 0
  const reportsPublished   = reportsGenerated && reportCards.every(r => r.is_published)

  // PRP-4 (Teacher Continuity, Phase 3/5) — remember only "I was working
  // End of Term for class X", never any mark/comment/report content, and
  // only while there's genuinely unfinished work here. Once published,
  // the context is cleared immediately — Phase 5's rule that destructive
  // actions (Publish) are never something Continuity re-offers; a
  // finished term has nothing left to "resume".
  useEffect(() => {
    if (!classId || loadingClassData) return
    const cls = classes.find(c => c.id === classId)
    if (!cls) return
    const matchKey = `core-term-${classId}`
    if (reportsPublished) {
      // Only clear if the stored context is actually this class's —
      // never wipe out an unrelated remembered context (e.g. an
      // in-progress assessment for a different class) just because this
      // one finished.
      if (getLastWorkingContext()?.matchKey === matchKey) clearLastWorkingContext()
      return
    }
    if (assessments.length > 0) {
      setLastWorkingContext({
        kind: 'core-term',
        matchKey,
        classId,
        className: cls.display_name ?? cls.class_name,
        href: '/teacher/core-term',
      })
    }
  }, [classId, classes, assessments.length, reportsPublished, loadingClassData])

  if (membership === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <OperationalBreadcrumb parent={{ label: 'Academic Office', href: '/teacher/core-office/academic' }} current="Official Report Cards" />

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">Official Report Cards</h1>
          <p className="text-sm text-slate-500">
            Lock assessments, generate summaries, and publish official report cards for your class. Looking for
            parent WhatsApp/email/clinic reports instead? That&apos;s{' '}
            <Link href="/teacher/reports" className="text-teal-600 font-bold hover:underline">Parent Reports</Link>.
          </p>
        </div>
        {membership && ['school_admin', 'headteacher', 'deputy_headteacher'].includes(membership.role) && (
          <Link href="/teacher/core-term/status" className="text-xs text-teal-600 hover:text-teal-700 font-medium whitespace-nowrap">
            School Status →
          </Link>
        )}
      </header>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {membership === null && (
        <p className="text-sm text-slate-500">No school membership found for your account.</p>
      )}

      {membership && !membership.currentTerm && (
        <p className="text-sm text-slate-500">No current term is set for {membership.schoolName} yet.</p>
      )}

      {membership && membership.currentTerm && (
        <>
          <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
            <p className="text-sm text-slate-500">{membership.schoolName} — {membership.currentTerm.name}</p>
            <div>
              <label className="block text-sm text-slate-600 mb-1.5">Class</label>
              <select
                value={classId}
                onChange={e => selectClass(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:border-teal-500 transition-colors"
              >
                <option value="">Select a class…</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.display_name ?? c.class_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {classId && loadingClassData && (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
            </div>
          )}

          {classId && !loadingClassData && (
            <div className="space-y-4">
              {/* PRP-3 (Teacher Workflow Engine, Phase 4: Momentum) — once
                  everything below is done, say so plainly instead of
                  leaving four checkmarks for the teacher to re-verify
                  themselves. The four steps stay visible underneath for
                  anyone who wants to review them; nothing is hidden. */}
              {reportsPublished && (
                <div className="flex items-center gap-3 border border-emerald-200 bg-emerald-50 rounded-2xl px-4 py-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <p className="text-sm font-bold text-emerald-800">
                    Report cards are locked, generated, and published for this class. Nothing left to do here.
                  </p>
                </div>
              )}

              {/* Progress (Phase 5): only existing state, no new calculations */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-2">
                <StatusRow label="Assessments Locked" done={assessmentsLocked} />
                <StatusRow label="Summaries Generated" done={summaryReady} />
                <StatusRow label="Reports Generated" done={reportsGenerated} />
                <StatusRow label="Reports Published" done={reportsPublished} />
              </div>

              {/* Step 1: lock assessments */}
              <section className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
                <h2 className="text-sm font-black text-slate-900">Assessments</h2>
                {assessments.length === 0 && <p className="text-sm text-slate-400">No assessments recorded for this term/year yet.</p>}
                <div className="space-y-2">
                  {assessments.map(a => (
                    <div key={a.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-700">{a.title}</span>
                      {a.is_published ? (
                        <span className="flex items-center gap-1 text-teal-600 text-xs"><Lock className="w-3.5 h-3.5" /> Locked</span>
                      ) : (
                        <button
                          onClick={() => lockAssessment(a.id)}
                          disabled={busy === `lock-${a.id}`}
                          className="text-xs bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
                        >
                          {busy === `lock-${a.id}` ? 'Locking…' : 'Lock'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Step 2-4: summaries -> report cards -> publish */}
              <section className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
                <h2 className="text-sm font-black text-slate-900">Report Cards</h2>
                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    label="Generate Summaries" busyLabel="Generating…" busy={busy === 'compute'}
                    disabled={!assessmentsLocked || assessments.length === 0} onClick={generateSummaries}
                  />
                  <ActionButton
                    label="Generate Report Cards" busyLabel="Generating…" busy={busy === 'generate'}
                    disabled={!summaryReady} onClick={generateReportCards}
                  />
                  <ActionButton
                    label={confirmingPublish ? 'Confirm Publish' : 'Publish Report Cards'}
                    busyLabel="Publishing…" busy={busy === 'publish-reports'}
                    disabled={!reportsGenerated || reportsPublished} onClick={publishReportCards}
                  />
                  {confirmingPublish && (
                    <button
                      onClick={() => setConfirmingPublish(false)}
                      className="text-xs text-slate-400 hover:text-slate-600 px-2"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {confirmingPublish && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    This releases final grades to parents for every learner in this class and cannot be undone from
                    here. Click &quot;Confirm Publish&quot; to proceed.
                  </p>
                )}
                {reportCards.length > 0 && (
                  <p className="text-xs text-slate-400">
                    {reportCards.length} report card{reportCards.length === 1 ? '' : 's'}
                    {reportsPublished ? ' — all published.' : ' generated, not yet published.'}
                  </p>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StatusRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done ? <CheckCircle2 className="w-4 h-4 text-teal-600" /> : <Circle className="w-4 h-4 text-slate-300" />}
      <span className={done ? 'text-slate-700' : 'text-slate-400'}>{label}</span>
    </div>
  )
}

function ActionButton({
  label, busyLabel, busy, disabled, onClick,
}: { label: string; busyLabel: string; busy: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className="text-sm bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors font-medium"
    >
      {busy ? busyLabel : label}
    </button>
  )
}
