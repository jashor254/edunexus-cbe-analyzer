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

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Loader2, AlertCircle, CheckCircle2, Circle, ArrowRight,
  CalendarRange, BookOpen, ClipboardList, Lock, FileCheck, Send,
  TrendingUp, Users2, ArrowLeftRight, GraduationCap, CalendarClock, Building, UserCheck,
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

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' })
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

  useEffect(() => {
    fetchJson<{ membership: Membership | null }>('/api/core/my-membership')
      .then(({ membership }) => setMembership(membership))
      .catch(e => { setMembership(null); setError(e instanceof Error ? e.message : 'Failed to load your school') })
  }, [])

  const isAdminTier = !!membership && ADMIN_TIER_ROLES.includes(membership.role)

  useEffect(() => {
    if (!membership || !isAdminTier) return
    fetchJson<SchoolAcademicReadiness>(`/api/core/academic-readiness?schoolId=${membership.schoolId}`)
      .then(setReadiness)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load readiness'))
  }, [membership, isAdminTier])

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

  const currentYear = academicYears?.find(y => y.is_current)
  const currentTermRow = membership.currentTerm

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
              <StructureRow
                icon={BookOpen}
                label="Subjects"
                status={readiness ? (readiness.subjects.reason ?? 'Every grade in use has subjects assigned.') : 'Loading…'}
                unavailable
              />
              <StructureRow
                icon={Building}
                label="Classes"
                status={readiness ? `${readiness.classes.count} class(es), ${readiness.grades.inUse} of ${readiness.grades.count} grades in use` : 'Loading…'}
              />
              <p className="text-xs text-slate-400 pt-3 mt-1 border-t border-slate-100">
                Academic years, terms and subjects are set up during school activation. Dedicated management screens for editing them are not yet available.
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
                <OperationRow icon={ClipboardList} label="End of Term" done={totalClasses > 0 && lockedAssessments === totalClasses}
                  detail="Summaries computed once assessments are locked" />
                <OperationRow icon={FileCheck} label="Report Generation" done={totalClasses > 0 && generatedReports === totalClasses}
                  detail={totalClasses === 0 ? 'No classes yet' : `${generatedReports} of ${totalClasses} classes generated`} />
                <OperationRow icon={Send} label="Report Publication" done={totalClasses > 0 && publishedReports === totalClasses}
                  detail={totalClasses === 0 ? 'No classes yet' : `${publishedReports} of ${totalClasses} classes published`} />
                <Link href="/teacher/core-term" className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-teal-600 hover:text-teal-700">
                  <span className="text-sm font-bold">Open End of Term workflow</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
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

          {/* Section 4 — Future Modules */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Future Modules</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FutureModule icon={TrendingUp} label="Promotion" />
              <FutureModule icon={ArrowLeftRight} label="Transfer" />
              <FutureModule icon={GraduationCap} label="Graduation" />
              <FutureModule icon={CalendarClock} label="Timetable" />
              <FutureModule icon={Users2} label="Departments" />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
