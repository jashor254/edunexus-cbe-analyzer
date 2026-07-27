'use client'

// app/teacher/core-office/page.tsx (renamed from core-readiness in Sprint 10G)
//
// Sprint 10E built this as a readiness report. Sprint 10F turned it into
// the "School Operations" workspace — the one canonical landing page for
// every Core operational screen (Team, Admissions, End of Term). Sprint
// 10G activates it as the permanent Administrative Workspace ("School
// Office") admin-tier users land on by default: renamed in place rather
// than building a second hub page (this page already was the hub Sprint
// 10G's brief described), plus a School Profile section.
//
// Every number on this page comes from an existing route, unmodified:
// /api/core/academic-readiness (Sprint 10E), /api/core/teachers?list=true
// (Sprint 10E), /api/core/school (Sprint 9B, School Profile section), and
// lib/core/client/termStatus.ts's fetchClassTermStatuses (Sprint 10F
// Phase 10). No new aggregation logic was written; percentages/counts
// below are plain derivations over already-computed fields (e.g. "5 of 6
// checks pass"), not a new readiness calculation.
//
// Deliberately NOT shown: "Assessment Ready" / "Compass Ready" as
// school-wide checklist items. No existing endpoint computes either at
// school scope — eligibleForAssessment/eligibleForCompass
// (lib/core/learnerOnboarding.ts::getLearnerReadiness) are per-learner
// only. Inventing a school-wide aggregate here would be new business
// logic, which this sprint's mission explicitly forbids — the checklist
// below shows exactly the six dimensions getSchoolAcademicReadiness()
// actually reports, no more.
//
// Sprint 10H — Classes/Assessments/End of Term (the "Workflows" grid)
// and the old inline "Academic Structure" section (Academic Years list)
// moved to app/teacher/core-office/academic/page.tsx, the new Academic
// Office section, so that every academic-administration screen has
// exactly one canonical entry point (School Office -> Academic Office ->
// existing page) instead of two competing paths into the same pages.
// Nothing was duplicated: the data those cards showed now lives only on
// the Academic Office page.

import { useState, useEffect, type ChangeEvent } from 'react'
import Link from 'next/link'
import { Loader2, AlertCircle, CheckCircle2, XCircle, Users, UserPlus, ArrowRight, Building2, BookOpen, School as SchoolIcon } from 'lucide-react'
import type { Term, School, SchoolSettings } from '@/types/core'
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

type TeacherMembership = { status: 'pending' | 'active' }

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.formErrors?.[0] ?? json.error ?? 'Request failed')
  return json.data as T
}

function describeResolved<T>(r: Resolved<T>, label: (v: T) => string): string {
  return r.resolved === false ? r.reason : label(r.value as T)
}

function Row({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />}
      <div>
        <p className="text-sm font-bold text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{detail}</p>
      </div>
    </div>
  )
}

function WorkflowCard({ href, icon: Icon, title, status, tone }: {
  href?: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  status: string
  tone: 'ready' | 'pending' | 'blocked' | 'neutral'
}) {
  const toneClass = {
    ready:   'text-emerald-600 bg-emerald-50',
    pending: 'text-amber-600 bg-amber-50',
    blocked: 'text-slate-400 bg-slate-50',
    neutral: 'text-slate-500 bg-slate-50',
  }[tone]

  const body = (
    <div className="flex items-center justify-between border border-slate-200 rounded-2xl p-4 bg-white h-full">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${toneClass}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800">{title}</p>
          <p className="text-xs text-slate-500 truncate">{status}</p>
        </div>
      </div>
      {href && <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />}
    </div>
  )

  return href ? (
    <Link href={href} className="hover:border-teal-400 rounded-2xl transition-colors block">{body}</Link>
  ) : body
}

export default function CoreOfficePage() {
  const [membership, setMembership] = useState<Membership | null | undefined>(undefined)
  const [readiness, setReadiness] = useState<SchoolAcademicReadiness | null>(null)
  const [teachers, setTeachers] = useState<TeacherMembership[] | null>(null)
  const [classStatuses, setClassStatuses] = useState<ClassTermStatus[] | null>(null)
  const [school, setSchool] = useState<School | null>(null)
  const [settings, setSettings] = useState<SchoolSettings | null>(null)
  const [error, setError] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState('')

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
    fetchJson<TeacherMembership[]>(`/api/core/teachers?schoolId=${membership.schoolId}&list=true`)
      .then(setTeachers)
      .catch(() => setTeachers([]))
  }, [membership, isAdminTier])

  useEffect(() => {
    if (!membership?.currentTerm || !isAdminTier) return
    fetchClassTermStatuses(membership.schoolId, membership.currentTerm)
      .then(setClassStatuses)
      .catch(() => setClassStatuses([]))
  }, [membership, isAdminTier])

  useEffect(() => {
    if (!membership || !isAdminTier) return
    fetchJson<{ school: School; settings: SchoolSettings | null }>(`/api/core/school?schoolId=${membership.schoolId}`)
      .then(({ school, settings }) => { setSchool(school); setSettings(settings) })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load school profile'))
  }, [membership, isAdminTier])

  if (membership === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
      </div>
    )
  }

  const activeTeachers = teachers?.filter(t => t.status === 'active').length ?? 0
  const pendingTeachers = teachers?.filter(t => t.status === 'pending').length ?? 0

  const lockedAssessments = classStatuses?.filter(c => c.assessmentState === 'locked').length ?? 0
  const totalClasses = classStatuses?.length ?? 0
  const publishedReports = classStatuses?.filter(c => c.reportState === 'published').length ?? 0

  const checklistItems: Array<{ label: string; ok: boolean; href?: string }> = readiness ? [
    { label: 'Academic year',  ok: readiness.academicYear.resolved },
    { label: 'Terms',          ok: readiness.term.resolved },
    { label: 'Teachers',       ok: readiness.teachers.allActiveTeachersHaveCanonicalIdentity, href: '/teacher/core-team' },
    { label: 'Subjects',       ok: readiness.subjects.allGradesInUseHaveSubjects },
    { label: 'Classes',        ok: readiness.classes.count > 0 },
    { label: 'Learners',       ok: readiness.learners.allClassesHaveLearners, href: '/teacher/core-admissions' },
  ] : []
  const checklistDone = checklistItems.filter(i => i.ok).length

  async function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !membership) return

    setLogoError('')
    setLogoUploading(true)
    try {
      const form = new FormData()
      form.append('schoolId', membership.schoolId)
      form.append('file', file)
      const res = await fetch('/api/core/school/logo', { method: 'POST', credentials: 'include', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Upload failed')
      setSchool(json.data.school as School)
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLogoUploading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <OperationalBreadcrumb />

      <header>
        <h1 className="text-xl font-black text-slate-900">School Operations</h1>
        <p className="text-sm text-slate-500">{membership ? membership.schoolName : 'Everything needed to run the school day to day'}</p>
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
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Workflows</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <WorkflowCard
                icon={Building2}
                title="School Activation"
                status={readiness ? readiness.activationStatus : 'Loading…'}
                tone={readiness?.activationStatus === 'ACTIVE' ? 'ready' : 'pending'}
              />
              <WorkflowCard
                href="/teacher/core-team"
                icon={Users}
                title="Teachers"
                status={teachers === null ? 'Loading…' : `${activeTeachers} Active · ${pendingTeachers} Pending`}
                tone={pendingTeachers > 0 ? 'pending' : activeTeachers > 0 ? 'ready' : 'blocked'}
              />
              <WorkflowCard
                href="/teacher/core-admissions"
                icon={UserPlus}
                title="Learners"
                status={readiness ? `${readiness.learners.enrolledLearnerCount} Enrolled · ${readiness.learners.allClassesHaveLearners ? 'Ready' : 'Incomplete'}` : 'Loading…'}
                tone={readiness?.learners.allClassesHaveLearners ? 'ready' : 'pending'}
              />
              <WorkflowCard
                href="/teacher/core-office/academic"
                icon={BookOpen}
                title="Academic Office"
                status={classStatuses === null ? 'Loading…' : totalClasses === 0 ? 'No classes yet' : `${lockedAssessments} of ${totalClasses} locked · ${publishedReports} of ${totalClasses} published`}
                tone={classStatuses && totalClasses > 0 && publishedReports === totalClasses ? 'ready' : 'pending'}
              />
            </div>
          </div>

          {readiness && (
            <div className="border border-slate-200 rounded-2xl p-4 bg-white">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-bold text-slate-800">Startup checklist</p>
                <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                  readiness.overallReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {checklistDone} of {checklistItems.length}
                </span>
              </div>

              <div className="pt-2">
                <Row ok={readiness.academicYear.resolved} label="Academic year"
                  detail={describeResolved(readiness.academicYear, v => v.name)} />
                <Row ok={readiness.term.resolved} label="Current term"
                  detail={describeResolved(readiness.term, v => v.name)} />
                <Row ok={readiness.teachers.allActiveTeachersHaveCanonicalIdentity} label="Teachers"
                  detail={readiness.teachers.reason ?? `${readiness.teachers.activeTeacherMemberships} active teacher(s), all onboarded.`} />
                <Row ok={readiness.subjects.allGradesInUseHaveSubjects} label="Subjects"
                  detail={readiness.subjects.reason ?? 'Every grade in use has subjects assigned.'} />
                <Row ok={readiness.classes.count > 0} label="Classes"
                  detail={`${readiness.classes.count} class(es), ${readiness.grades.inUse} of ${readiness.grades.count} grades in use`} />
                <Row ok={readiness.learners.allClassesHaveLearners} label="Learners"
                  detail={readiness.learners.reason ?? `${readiness.learners.enrolledLearnerCount} learner(s) enrolled this term.`} />
              </div>

              {!readiness.overallReady && readiness.blockingReasons.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-500 mb-1.5">What's blocking readiness</p>
                  <ul className="space-y-1">
                    {readiness.blockingReasons.map((r, i) => (
                      <li key={i} className="text-xs text-slate-500">• {r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">School Profile</h2>
            <div className="border border-slate-200 rounded-2xl p-4 bg-white">
              {!school ? (
                <p className="text-sm text-slate-400">Loading…</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {school.logo_url ? (
                      <img
                        src={school.logo_url}
                        alt={`${school.school_name} logo`}
                        className="w-10 h-10 rounded-xl object-cover shrink-0 border border-slate-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        <SchoolIcon className="w-5 h-5 text-slate-500" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-black text-slate-900">{school.school_name}</p>
                      {school.motto && <p className="text-xs text-slate-500 italic">"{school.motto}"</p>}
                    </div>
                  </div>

                  {isAdminTier && (
                    <div className="flex items-center gap-2 pt-1">
                      <label className="text-xs font-bold text-sky-700 hover:text-sky-900 cursor-pointer">
                        {logoUploading ? 'Uploading…' : school.logo_url ? 'Change logo' : 'Add school logo'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          disabled={logoUploading}
                          onChange={handleLogoUpload}
                        />
                      </label>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs text-slate-400">Shown on the Learner Blueprint cover and header</span>
                    </div>
                  )}
                  {logoError && <p className="text-xs text-rose-600">{logoError}</p>}

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div><dt className="text-slate-400">Type</dt><dd className="font-semibold text-slate-700">{school.school_type}</dd></div>
                    <div><dt className="text-slate-400">Curriculum</dt><dd className="font-semibold text-slate-700">{settings?.curriculum_type?.toUpperCase() ?? '—'}</dd></div>
                    <div><dt className="text-slate-400">County</dt><dd className="font-semibold text-slate-700">{school.county}{school.sub_county ? `, ${school.sub_county}` : ''}</dd></div>
                    <div><dt className="text-slate-400">NEMIS Code</dt><dd className="font-semibold text-slate-700">{school.nemis_code || '—'}</dd></div>
                    <div><dt className="text-slate-400">Phone</dt><dd className="font-semibold text-slate-700">{school.contact_phone || '—'}</dd></div>
                    <div><dt className="text-slate-400">Email</dt><dd className="font-semibold text-slate-700">{school.contact_email || '—'}</dd></div>
                    <div className="col-span-2"><dt className="text-slate-400">Address</dt><dd className="font-semibold text-slate-700">{school.address || '—'}</dd></div>
                  </dl>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
