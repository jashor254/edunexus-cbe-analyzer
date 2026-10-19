'use client'

// Mark Papers — the visible front door to Paper Intelligence. Paper
// Intelligence works per assignment (the rubric and the class roster both
// hang off one), so this page is only a picker: choose the assignment, then
// hand over to the existing photo-marking and review flow. UI only — the
// list comes from the same /api/teacher/assignments the Assignments page uses.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Camera, ListChecks, Users, CheckCircle2, PlusCircle, ChevronRight, FileText } from 'lucide-react'

type Assignment = {
  id: string
  title: string
  subject: string
  topic: string
  status: string
  due_date: string
  teacher_classes: { name: string; grade: number } | null
}

const STEPS = [
  { icon: Camera,       title: 'Photograph the marking scheme', sub: 'AI turns it into a rubric you can edit' },
  { icon: Users,        title: 'Photograph each learner’s script', sub: 'AI marks in the background while you move on' },
  { icon: ListChecks,   title: 'Review question by question',   sub: 'Confirm or change every mark — you decide' },
  { icon: CheckCircle2, title: 'Marks land in the gradebook',   sub: 'Each script saves the moment it is reviewed' },
]

export default function MarkPapersPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/teacher/assignments')
      .then(async r => {
        const body = await r.json()
        if (!r.ok || !body.success) throw new Error(body.error ?? 'Could not load your assignments')
        const list = body.data.assignments as Assignment[]
        setAssignments([...list].sort((a, b) => b.due_date.localeCompare(a.due_date)))
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load your assignments'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 flex items-center gap-2">
          <Camera className="w-7 h-7 text-teal-600" /> Mark Papers
        </h1>
        <p className="text-gray-500 mt-1">
          Mark a pile of paper scripts with your phone camera. The AI suggests marks — you confirm every one.
        </p>
      </div>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4 mb-8">
        <div className="text-xs font-black text-teal-800 uppercase tracking-wide mb-3">How it works</div>
        <ol className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {STEPS.map(({ icon: Icon, title, sub }, i) => (
            <li key={title} className="flex items-start gap-3">
              <div className="w-8 h-8 shrink-0 rounded-xl bg-white border border-teal-100 flex items-center justify-center">
                <Icon className="w-4 h-4 text-teal-600" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">{i + 1}. {title}</div>
                <div className="text-xs text-gray-500">{sub}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* ── Pick the assignment ──────────────────────────────────────────── */}
      <h2 className="text-sm font-black text-gray-900 mb-3">Which assignment are you marking?</h2>

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm">
          {error}. Please refresh the page to try again.
        </div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-2xl border-2 border-dashed border-gray-200 px-4">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-black text-gray-700 mb-1">Create the assignment first</h3>
          <p className="text-gray-400 text-sm mb-5">
            Paper marking attaches to an assignment, so the marks know which class and which learners they belong to.
          </p>
          <Link
            href="/teacher/assignments/new"
            className="inline-flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 transition"
          >
            <PlusCircle className="w-4 h-4" /> Create Assignment
          </Link>
        </div>
      ) : (
        <ul className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
          {assignments.map(a => (
            <li key={a.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-gray-900 text-sm leading-tight">{a.title}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {a.teacher_classes ? `${a.teacher_classes.name} · G${a.teacher_classes.grade} · ` : ''}
                  {a.subject}
                  {' · Due '}
                  {new Date(a.due_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/teacher/assignments/${a.id}/paper-intelligence/review`}
                  className="text-sm font-bold text-teal-600 hover:text-teal-800 border border-teal-200 hover:border-teal-400 px-3 py-2 rounded-xl transition"
                >
                  Review
                </Link>
                <Link
                  href={`/teacher/assignments/${a.id}/paper-intelligence`}
                  className="flex items-center gap-1 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-xl transition"
                >
                  <Camera className="w-4 h-4" /> Mark papers <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
