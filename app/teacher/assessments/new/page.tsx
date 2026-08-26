'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ClipboardList, ArrowLeft, CheckCircle2, Lock } from 'lucide-react'

// Phase 3B — the ONE institutional teacher entry point for
// "My Teaching -> Class -> Canonical Subject -> Add Assessment"
// (docs — Phase 3A established server-side canonical subject authority via
// `classSubjectId`; this page is its first real caller).
//
// Deliberately mirrors app/teacher/assignments/new/page.tsx's shape (mirror
// the TeachingAssignment type locally rather than importing the server-only
// lib/core/teachingAssignments.ts module; self-fetch /api/teacher/teaching-
// assignments) but does NOT reproduce that page's "pick again from a
// dropdown" pattern — this page's whole reason to exist is that the teacher
// already chose their subject by clicking into it from My Teaching, so the
// `classSubjectId` query param locks the form instead of re-offering a
// choice (Phase 3B Step 9/23).
//
// GET /api/teacher/teaching-assignments only ever returns CURRENT
// (`ended_at IS NULL`) assignments (lib/repositories/teacher.repository.ts) —
// an ended or cross-school `classSubjectId` simply will not appear in the
// list, which is what gives this page's "not found" state its fail-closed
// meaning for free (Step 13/21) without any extra staleness check here. The
// POST below still re-verifies everything server-side (Step 8) — this is
// UX, not the security boundary.
type TeachingAssignment = {
  assignmentId: string
  schoolId: string
  schoolName: string
  classId: string
  className: string
  subjectId: string
  subjectName: string
}
type TeachingContext =
  | { kind: 'school'; assignments: TeachingAssignment[] }
  | { kind: 'school_unassigned'; schoolIds: string[] }
  | { kind: 'solo' }

const ASSESSMENT_TYPES: { value: string; label: string }[] = [
  { value: 'cat', label: 'CAT' },
  { value: 'opener', label: 'Opener Exam' },
  { value: 'midterm', label: 'Mid-Term Exam' },
  { value: 'endterm', label: 'End-Term Exam' },
  { value: 'exam', label: 'Exam' },
  { value: 'assignment', label: 'Assignment' },
]

function AddAssessmentForm() {
  const searchParams = useSearchParams()
  const classSubjectId = searchParams.get('classSubjectId') || ''

  const [context, setContext] = useState<TeachingContext | null>(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    fetch('/api/teacher/teaching-assignments')
      .then(r => r.json())
      .then(d => { if (d.data) setContext(d.data as TeachingContext) })
      .catch(() => setLoadError('Could not load your teaching assignments.'))
  }, [])

  const [form, setForm] = useState({
    title: '',
    assessment_type: 'cat',
    term: '1',
    year: new Date().getFullYear(),
    max_score: 100,
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [created, setCreated] = useState<{ id: string; schoolId: string } | null>(null)

  if (!classSubjectId) {
    return (
      <StateCard
        icon={<ClipboardList className="w-5 h-5 text-slate-400" />}
        title="No teaching assignment selected"
        body="Open this page from My Teaching so EduNexus knows which class and subject this assessment belongs to."
      />
    )
  }

  if (loadError) {
    return <StateCard icon={<ClipboardList className="w-5 h-5 text-rose-400" />} title="Something went wrong" body={loadError} />
  }

  if (context === null) {
    return (
      <div className="flex justify-center py-20">
        <span className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const assignment = context.kind === 'school' ? context.assignments.find(a => a.assignmentId === classSubjectId) : undefined

  // Not found covers every fail-closed case Step 13/21 asks for in one
  // place: the tenure ended, it belongs to a different teacher, it belongs
  // to a different school, or the id is simply wrong — all of these are
  // "this classSubjectId is not a CURRENT assignment of yours," which is
  // exactly what a missing list entry means. Never falls back to a
  // free-text subject picker.
  if (!assignment) {
    return (
      <StateCard
        icon={<Lock className="w-5 h-5 text-amber-500" />}
        title="This teaching assignment is no longer active"
        body="It may have ended, or belong to a different class or school. Go back to My Teaching and open Add Assessment from a current assignment."
      />
    )
  }

  if (created) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
        </div>
        <p className="font-bold text-slate-900 mb-1">Assessment created</p>
        <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
          {`"${form.title}" was created for ${assignment.subjectName} — ${assignment.className}.`}
        </p>
        <div className="flex flex-col items-center gap-3">
          <Link
            href={`/teacher/assessments/${created.id}/marks?schoolId=${created.schoolId}`}
            className="w-full max-w-xs rounded-xl bg-emerald-600 text-white font-bold py-3 text-sm hover:bg-emerald-700 transition-colors"
          >
            Enter Marks
          </Link>
          <Link href="/teacher/dashboard" className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-4 h-4" /> Back to My Teaching
          </Link>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError('')
    if (!assignment) return
    if (!form.title.trim()) { setSubmitError('Assessment title is required'); return }
    if (!form.max_score || form.max_score <= 0) { setSubmitError('Maximum score must be greater than 0'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/core/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: assignment.schoolId,
          class_id: assignment.classId,
          classSubjectId: assignment.assignmentId,
          title: form.title.trim(),
          assessment_type: form.assessment_type,
          term: form.term,
          year: form.year,
          max_score: form.max_score,
          // Canonical subject identity is derived server-side from
          // classSubjectId — never sent from here (Phase 3A Step 8/13).
          subjects: [],
          curriculum_type: 'cbc',
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        const message = typeof json.error === 'string' ? json.error : 'Failed to create assessment'
        setSubmitError(message)
        return
      }
      setCreated({ id: json.data.assessmentId, schoolId: assignment.schoolId })
    } catch {
      setSubmitError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <Link href="/teacher/dashboard" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> My Teaching
      </Link>

      {/* Locked context — the teaching assignment already answers "what
          subject is this," so it is shown, never asked (Step 9). */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 mb-6 flex items-center gap-3">
        <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
        <div className="min-w-0">
          <p className="font-black text-slate-900 text-sm truncate">{assignment.subjectName}</p>
          <p className="text-xs text-slate-500 truncate">{assignment.className}{assignment.schoolName ? ` · ${assignment.schoolName}` : ''}</p>
        </div>
      </div>

      <h1 className="text-lg font-black text-slate-900 mb-4">Add Assessment</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-bold text-slate-700 mb-1">Assessment title</label>
          <input
            id="title"
            type="text"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Mid-Term Assessment"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label htmlFor="assessment_type" className="block text-sm font-bold text-slate-700 mb-1">Assessment type</label>
          <select
            id="assessment_type"
            value={form.assessment_type}
            onChange={e => setForm(f => ({ ...f, assessment_type: e.target.value }))}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {ASSESSMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="term" className="block text-sm font-bold text-slate-700 mb-1">Term</label>
            <select
              id="term"
              value={form.term}
              onChange={e => setForm(f => ({ ...f, term: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="1">Term 1</option>
              <option value="2">Term 2</option>
              <option value="3">Term 3</option>
            </select>
          </div>
          <div>
            <label htmlFor="year" className="block text-sm font-bold text-slate-700 mb-1">Year</label>
            <input
              id="year"
              type="number"
              value={form.year}
              onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="max_score" className="block text-sm font-bold text-slate-700 mb-1">Maximum score</label>
          <input
            id="max_score"
            type="number"
            min={1}
            value={form.max_score}
            onChange={e => setForm(f => ({ ...f, max_score: Number(e.target.value) }))}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {submitError && (
          <p className="text-sm text-rose-600 font-medium">{submitError}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-emerald-600 text-white font-bold py-3.5 text-base hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Creating…' : 'Create Assessment'}
        </button>
      </form>
    </div>
  )
}

function StateCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">{icon}</div>
      <p className="font-bold text-slate-900 mb-1">{title}</p>
      <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">{body}</p>
      <Link href="/teacher/dashboard" className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 hover:text-emerald-800">
        <ArrowLeft className="w-4 h-4" /> Back to My Teaching
      </Link>
    </div>
  )
}

export default function AddAssessmentPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><span className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <AddAssessmentForm />
    </Suspense>
  )
}
