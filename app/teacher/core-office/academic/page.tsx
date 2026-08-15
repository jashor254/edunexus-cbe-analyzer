'use client'

// app/teacher/core-office/academic/page.tsx
//
// Sprint 10H Phase 2 — the Academic Office section inside the School
// Office workspace. Pure UI composition: every number and status shown
// here is read from routes/functions that already existed before this
// sprint (getSchoolAcademicReadiness via /api/core/academic-readiness,
// fetchClassTermStatuses, /api/core/academic-years). No new business
// logic, no new API route, no new readiness calculation — this page only
// arranges existing state into the order a real school's academic office
// actually works in: Structure -> Operations -> Status -> Future modules.
//
// This is not a second dashboard. It is the ONE canonical home for
// academic administration inside School Office (accordingly the
// "Classes" / "Assessments" / "End of Term" cards and the "Academic
// Structure" section that used to live directly on
// app/teacher/core-office/page.tsx were moved here, not duplicated —
// see that file's own comment for the before/after).
//
// Academic Years/Terms/Subjects have no dedicated management screen in
// this codebase yet (confirmed in the Phase 1 audit — see
// docs/architecture/sprint-10h-academic-office-workspace.md §A). Rather
// than fabricate one, this page states that plainly instead of linking
// anywhere for those three rows.
//
// Sprint 11G — added an "Attendance Administration" card linking to
// app/teacher/core-office/attendance/page.tsx, replacing the inert
// "Attendance" entry that used to sit in the Future Modules grid below
// (Sprint 10H): Attendance is a real, built domain now (Sprints 11B-11F),
// so it moved out of the placeholder grid rather than being duplicated in
// both places.
//
// Sprint 10 (Core Administration Completion, this session) — same
// treatment for Classes/Subjects, Promotion and Transfer: all three had a
// fully built backend with zero UI (see docs/architecture/
// sprint9-school-operations-excellence-audit.md §2), confirmed by this
// file rendering them as FutureModule placeholders despite the backend
// already existing. Classes/Subjects rows in "Academic Structure" now link
// to the new /academic/structure screen instead of being marked
// `unavailable`; Promotion and Transfer moved out of the Future Modules
// grid into real cards, same pattern as the Sprint 11G Attendance move.
// Graduation is folded into the Promotion card (graduation is a
// `promotion_type` value on the same decisions array, not a separate
// backend) rather than kept as its own placeholder. Timetable and
// Departments remain genuinely unbuilt — no schema, no lib, no API exists
// for either — and correctly stay as Future Modules.

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Loader2, AlertCircle, CheckCircle2, Circle, ArrowRight,
  CalendarRange, BookOpen, ClipboardList, Lock, FileCheck, Send,
  TrendingUp, Users2, ArrowLeftRight, CalendarClock, Building, UserCheck,
} from 'lucide-react'
import type { Term, AcademicYear } from '@/types/core'
import { ADMIN_TIER_ROLES } from '@/lib/core/adminTierRoles'
import { fetchClassTermStatuses, type ClassTermStatus } from '@/lib/core/client/termStatus'
import { OperationalBreadcrumb } from '@/components/core/OperationalBreadcrumb'

type Membership = {
  schoolId: string
  schoolName: string
  role: string
  currentTerm: Term | null
}

type Resolved<T> = { resolved: true; value: T } | { resolved: false; value: null; reason: string }

type SchoolAcademicReadiness = {
  activationStatus: 'CREATED' | 'INITIALIZED' | 'ACTIVE'
  academicYear: Resolved<{ name: string }>
  term: Resolved<{ name: string }>
  grades: { count: number; inUse: number }
  classes: { count: number }
  subjects: { allGradesInUseHaveSubjects: boolean; reason?: string }
  teachers: { activeTeacherMemberships: number; allActiveTeachersHaveCanonicalIdentity: boolean; reason?: string }
  learners: { enrolledLearnerCount: number; allClassesHaveLearners: boolean; reason?: string }
  overallReady: boolean
  blockingReasons: string[]
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.formErrors?.[0] ?? json.error ?? 'Request failed')
  return json.data as T
}

function StructureRow({
  icon: Icon, label, status, href, unavailable,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  status: string
  href?: string
  unavailable?: boolean
}) {
  const body = (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <Icon className={`w-4 h-4 shrink-0 ${unavailable ? 'text-slate-300' : 'text-slate-400'}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{status}</p>
      </div>
      {href && <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />}
    </div>
  )
  return href ? <Link href={href} className="hover:bg-slate-50 -mx-1 px-1 rounded-lg block">{body}</Link> : body
}

function OperationRow({ icon: Icon, label, done, detail }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  done: boolean
  detail: string
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      {done ? <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" /> : <Circle className="w-4 h-4 text-slate-300 shrink-0" />}
      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-bold ${done ? 'text-slate-800' : 'text-slate-500'}`}>{label}</p>
        <p className="text-xs text-slate-400">{detail}</p>
      </div>
    </div>
  )
}

function FutureModule({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-3 border border-dashed border-slate-200 rounded-xl p-3 bg-slate-50/50">
      <Icon className="w-4 h-4 text-slate-300 shrink-0" />
      <div>
        <p className="text-sm font-bold text-slate-400">{label}</p>
        <p className="text-xs text-slate-400">Planned future module</p>
      </div>
    </div>
  )
}

export default function AcademicOfficePage() {
  const [membership, setMembership] = useState<Membership | null | undefined>(undefined)
  const [readiness, setReadiness] = useState<SchoolAcademicReadiness | null>(null)
  const [classStatuses, setClassStatuses] = useState<ClassTermStatus[] | null>(null)
  const [academicYears, setAcademicYears] = useState<AcademicYear[] | null>(null)
  const [terms, setTerms] = useState<Term[] | null>(null)
  const [error, setError] = useState('')
  // Sprint 12 Wave 1 (High 1) — fresh schools now get a current term set
  // automatically at activation (lib/core/schoolActivation.ts's new
  // ensureCurrentTerm step); this control is the fallback for any school
  // activated before that fix, or that otherwise ends up with none. Reuses
  // the existing `type: 'set-current-term'` action on
  // POST /api/core/academic-years (already requireSchoolAdmin-gated,
  // already existed with zero UI caller before this fix) and the same
  // fetchJson/select/button pattern already used throughout this page and
  // structure/page.tsx — no new UI pattern invented.
  const [selectedTermId, setSelectedTermId] = useState('')
  const [settingCurrentTerm, setSettingCurrentTerm] = useState(false)
  // Sprint C0 Task 2 — Release Gate 1 found subject seeding has no
  // in-flow trigger: a fresh school's admin had to already know
  // seedGradeSubjectsForSchool() exists and separately find
  // /academic/structure to call it. This one-click action reuses the
  // existing POST /api/core/subjects `action: 'seed'` route (already
  // built, already requireSchoolAdmin-gated) directly from the readiness
  // row that names the gap, instead of only linking to a separate screen.
  const [seedingSubjects, setSeedingSubjects] = useState(false)

  useEffect(() => {
    fetchJson<{ membership: Membership | null }>('/api/core/my-membership')
      .then(({ membership }) => setMembership(membership))
      .catch(e => { setMembership(null); setError(e instanceof Error ? e.message : 'Failed to load your school') })
  }, [])

  const isAdminTier = !!membership && ADMIN_TIER_ROLES.includes(membership.role)

  const refreshReadiness = useCallback(() => {
    if (!membership || !isAdminTier) return
    return fetchJson<SchoolAcademicReadiness>(`/api/core/academic-readiness?schoolId=${membership.schoolId}`)
      .then(setReadiness)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load readiness'))
  }, [membership, isAdminTier])

  useEffect(() => { refreshReadiness() }, [refreshReadiness])

  useEffect(() => {
    if (!membership?.currentTerm || !isAdminTier) return
    fetchClassTermStatuses(membership.schoolId, membership.currentTerm)
      .then(setClassStatuses)
      .catch(() => setClassStatuses([]))
  }, [membership, isAdminTier])

  useEffect(() => {
    if (!membership || !isAdminTier) return
    fetchJson<{ years: AcademicYear[]; terms: Term[] }>(`/api/core/academic-years?schoolId=${membership.schoolId}`)
      .then(({ years, terms }) => { setAcademicYears(years); setTerms(terms) })
      .catch(() => { setAcademicYears([]); setTerms([]) })
  }, [membership, isAdminTier])

  if (membership === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
      </div>
    )
  }

  const totalClasses = classStatuses?.length ?? 0
  const lockedAssessments = classStatuses?.filter(c => c.assessmentState === 'locked').length ?? 0
  const generatedReports = classStatuses?.filter(c => c.reportState === 'generated' || c.reportState === 'published').length ?? 0
  const publishedReports = classStatuses?.filter(c => c.reportState === 'published').length ?? 0
  // Sprint C0 Task 2 — previously this row was marked "done" as soon as
  // assessments were locked, which is a distinct, separate step from
  // actually computing term_subject_summaries (see termStatus.ts's new
  // `summariesComputed` field). A locked-but-not-computed school
  // incorrectly showed "End of Term" complete before Report Generation
  // could actually produce a real result.
  const summarizedClasses = classStatuses?.filter(c => c.summariesComputed).length ?? 0

  const currentYear = academicYears?.find(y => y.is_current)
  const currentTermRow = membership.currentTerm

  async function setCurrentTermNow() {
    if (!membership || !selectedTermId) return
    setSettingCurrentTerm(true)
    setError('')
    try {
      await fetchJson('/api/core/academic-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: membership.schoolId, type: 'set-current-term', termId: selectedTermId }),
      })
      window.location.reload() // membership.currentTerm is derived server-side on the my-membership route; simplest correct refresh
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set current term')
      setSettingCurrentTerm(false)
    }
  }

  async function seedSubjectsNow() {
    if (!membership) return
    setSeedingSubjects(true)
    setError('')
    try {
      await fetchJson('/api/core/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed', schoolId: membership.schoolId }),
      })
      await refreshReadiness()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set up default subjects')
    } finally {
      setSeedingSubjects(false)
    }
  }

  // Section 3 — reuses only getSchoolAcademicReadiness() + fetchClassTermStatuses(); no new
  // readiness score is computed. "Completed" / "Needs attention" are the same fields already
  // shown as WorkflowCard tones elsewhere in School Office; "Next step" is a plain first-match
  // lookup over that same fixed, existing set of booleans (no new calculation).
  const structureItems: Array<{ label: string; done: boolean }> = readiness ? [
    { label: 'Academic year set', done: readiness.academicYear.resolved },
    { label: 'Current term set', done: readiness.term.resolved },
    { label: 'Subjects assigned to grades in use', done: readiness.subjects.allGradesInUseHaveSubjects },
    { label: 'Classes created', done: readiness.classes.count > 0 },
  ] : []
  const operationItems: Array<{ label: string; done: boolean; href: string }> = classStatuses ? [
    { label: 'Assessments locked for every class', done: totalClasses > 0 && lockedAssessments === totalClasses, href: '/teacher/core-term' },
    // Sprint C0 Task 2 — previously missing entirely from this checklist:
    // an admin could see "Report cards generated" as the very next step
    // with no item ever naming that summaries must be computed first.
    { label: 'Term summaries computed for every class', done: totalClasses > 0 && summarizedClasses === totalClasses, href: '/teacher/core-term' },
    { label: 'Report cards generated for every class', done: totalClasses > 0 && generatedReports === totalClasses, href: '/teacher/core-term' },
    { label: 'Report cards published for every class', done: totalClasses > 0 && publishedReports === totalClasses, href: '/teacher/core-term' },
  ] : []
  const allItems = [...structureItems, ...operationItems]
  const completed = allItems.filter(i => i.done)
  const needsAttention = allItems.filter(i => !i.done)
  const nextStep = operationItems.find(i => !i.done) ?? structureItems.find(i => !i.done)

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <OperationalBreadcrumb current="Academic Office" />

      <header>
        <h1 className="text-xl font-black text-slate-900">Academic Office</h1>
        <p className="text-sm text-slate-500">Structure, terms, assessments and reports for {membership.schoolName}</p>
      </header>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {membership === null && <p className="text-sm text-slate-500">No school membership found for your account.</p>}
      {membership && !isAdminTier && <p className="text-sm text-slate-500">This view is available to school admins and headteachers.</p>}

      {membership && isAdminTier && (
        <>
          {/* Section 1 — Academic Structure */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Academic Structure</h2>
            <div className="border border-slate-200 rounded-2xl p-4 bg-white">
              <StructureRow
                icon={CalendarRange}
                label="Academic Years"
                status={academicYears === null ? 'Loading…' : currentYear ? `Current: ${currentYear.name}` : 'No academic year set up yet'}
              />
              <StructureRow
                icon={CalendarClock}
                label="Terms"
                status={terms === null ? 'Loading…' : currentTermRow ? `Current: ${currentTermRow.name}` : 'No current term set'}
              />
              {!currentTermRow && terms && terms.length > 0 && (
                <div className="flex items-center gap-2 py-2 -mt-1 pl-7">
                  <select
                    value={selectedTermId}
                    onChange={e => setSelectedTermId(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-teal-500"
                  >
                    <option value="">Select a term to set as current…</option>
                    {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <button
                    onClick={setCurrentTermNow}
                    disabled={settingCurrentTerm || !selectedTermId}
                    className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shrink-0"
                  >
                    {settingCurrentTerm && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Set Current
                  </button>
                </div>
              )}
              <StructureRow
                icon={BookOpen}
                label="Subjects"
                status={readiness ? (readiness.subjects.reason ?? 'Every grade in use has subjects assigned.') : 'Loading…'}
                href="/teacher/core-office/academic/structure"
              />
              {readiness && !readiness.subjects.allGradesInUseHaveSubjects && (
                <div className="flex items-center gap-2 py-2 -mt-1 pl-7">
                  <button
                    onClick={seedSubjectsNow}
                    disabled={seedingSubjects}
                    className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shrink-0"
                  >
                    {seedingSubjects && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Set Up Default Subjects
                  </button>
                </div>
              )}
              <StructureRow
                icon={Building}
                label="Classes"
                status={readiness ? `${readiness.classes.count} class(es), ${readiness.grades.inUse} of ${readiness.grades.count} grades in use` : 'Loading…'}
                href="/teacher/core-office/academic/structure"
              />
              <p className="text-xs text-slate-400 pt-3 mt-1 border-t border-slate-100">
                Academic years and terms are set up during school activation — no dedicated screen yet. Classes, streams and
                subjects are managed from Academic Structure above.
              </p>
            </div>
          </div>

          {/* Section 2 — Academic Operations */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Academic Operations</h2>
            <div className="space-y-3">
              <Link href="/teacher/core-term/status" className="block border border-slate-200 rounded-2xl p-4 bg-white hover:border-teal-400 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-4.5 h-4.5 text-slate-400" />
                    <div>
                      <p className="text-sm font-bold text-slate-800">Assessment Progress</p>
                      <p className="text-xs text-slate-500">
                        {classStatuses === null ? 'Loading…' : totalClasses === 0 ? 'No classes yet' : `${lockedAssessments} of ${totalClasses} classes locked`}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                </div>
              </Link>

              <div className="border border-slate-200 rounded-2xl p-4 bg-white">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Assessment Lock → End of Term → Report Generation → Report Publication</p>
                <OperationRow icon={Lock} label="Assessment Lock" done={totalClasses > 0 && lockedAssessments === totalClasses}
                  detail={totalClasses === 0 ? 'No classes yet' : `${lockedAssessments} of ${totalClasses} classes locked`} />
                <OperationRow icon={ClipboardList} label="End of Term" done={totalClasses > 0 && summarizedClasses === totalClasses}
                  detail={
                    totalClasses === 0 ? 'No classes yet'
                      : summarizedClasses === totalClasses ? `${summarizedClasses} of ${totalClasses} classes summarized`
                      : lockedAssessments === totalClasses ? `Ready — open End of Term below to generate summaries for ${totalClasses - summarizedClasses} class(es)`
                      : `${summarizedClasses} of ${totalClasses} classes summarized (lock remaining assessments first)`
                  } />
                <OperationRow icon={FileCheck} label="Report Generation" done={totalClasses > 0 && generatedReports === totalClasses}
                  detail={totalClasses === 0 ? 'No classes yet' : `${generatedReports} of ${totalClasses} classes generated`} />
                <OperationRow icon={Send} label="Report Publication" done={totalClasses > 0 && publishedReports === totalClasses}
                  detail={totalClasses === 0 ? 'No classes yet' : `${publishedReports} of ${totalClasses} classes published`} />
                <Link href="/teacher/core-term" className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-teal-600 hover:text-teal-700">
                  <span className="text-sm font-bold">Open End of Term workflow</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Phase 12 (DR-03/DR-05) — the actual school-wide "turn the
                  term" action. Deliberately separate from the per-class
                  report-card workflow above: this is the one operation that
                  advances every class and the school's own current term
                  together, once every class above is ready. */}
              <Link href="/teacher/core-office/academic/term-close" className="block border border-slate-200 rounded-2xl p-4 bg-white hover:border-teal-400 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CalendarClock className="w-4.5 h-4.5 text-slate-400" />
                    <div>
                      <p className="text-sm font-bold text-slate-800">Close Term</p>
                      <p className="text-xs text-slate-500">
                        {currentTermRow ? `Advance the whole school from ${currentTermRow.name}` : 'Set a current term first'}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                </div>
              </Link>

              <Link href="/teacher/core-office/academic/next-year" className="block border border-slate-200 rounded-2xl p-4 bg-white hover:border-teal-400 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CalendarRange className="w-4.5 h-4.5 text-slate-400" />
                    <div>
                      <p className="text-sm font-bold text-slate-800">Prepare Next Academic Year</p>
                      <p className="text-xs text-slate-500">Create the next year, its terms, and destination classes</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                </div>
              </Link>
            </div>
          </div>

          {/* Section 2b — Attendance Administration (Sprint 11G). This card
              replaces the "Attendance" entry that used to live in the
              Future Modules grid below (Sprint 10H) — Attendance is a real,
              built domain now (Sprints 11B-11F), not a placeholder, so it
              moved out of that grid rather than being duplicated in both
              places. */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Attendance</h2>
            <Link href="/teacher/core-office/attendance" className="block border border-slate-200 rounded-2xl p-4 bg-white hover:border-teal-400 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UserCheck className="w-4.5 h-4.5 text-slate-400" />
                  <div>
                    <p className="text-sm font-bold text-slate-800">Attendance Administration</p>
                    <p className="text-xs text-slate-500">School-wide attendance sessions, by class</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300" />
              </div>
            </Link>
          </div>

          {/* Section 3 — Workflow Status */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Workflow Status</h2>
            <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
              <div>
                <p className="text-xs font-bold text-emerald-600 mb-1">Completed ({completed.length} of {allItems.length || '—'})</p>
                {completed.length === 0 ? (
                  <p className="text-xs text-slate-400">Nothing completed yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {completed.map((i, idx) => <li key={idx} className="text-xs text-slate-600 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />{i.label}</li>)}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-amber-600 mb-1">Needs Attention</p>
                {needsAttention.length === 0 ? (
                  <p className="text-xs text-slate-400">Nothing outstanding.</p>
                ) : (
                  <ul className="space-y-1">
                    {needsAttention.map((i, idx) => <li key={idx} className="text-xs text-slate-600 flex items-center gap-1.5"><Circle className="w-3.5 h-3.5 text-amber-400 shrink-0" />{i.label}</li>)}
                  </ul>
                )}
              </div>
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-500 mb-1">Next Step</p>
                <p className="text-sm text-slate-700">
                  {nextStep ? nextStep.label : 'Everything on this screen is complete for the current term.'}
                </p>
              </div>
            </div>
          </div>

          {/* Section 3b — Learner Transitions (Sprint 10: activated from
              FutureModule placeholders — see file header comment) */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Learner Transitions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link href="/teacher/core-office/academic/promotion" className="flex items-center gap-3 border border-slate-200 rounded-xl p-3 bg-white hover:border-teal-400 transition-colors">
                <TrendingUp className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800">Promotion</p>
                  <p className="text-xs text-slate-500">Promote, repeat, or graduate learners</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
              </Link>
              <Link href="/teacher/core-office/academic/transfer" className="flex items-center gap-3 border border-slate-200 rounded-xl p-3 bg-white hover:border-teal-400 transition-colors">
                <ArrowLeftRight className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800">Transfer</p>
                  <p className="text-xs text-slate-500">Record a learner leaving the school</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
              </Link>
            </div>
          </div>

          {/* Section 4 — Future Modules: genuinely unbuilt (no schema, no
              lib, no API for either — confirmed in the Sprint 9 audit) */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Future Modules</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FutureModule icon={CalendarClock} label="Timetable" />
              <FutureModule icon={Users2} label="Departments" />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
