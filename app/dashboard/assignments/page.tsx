'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Clock, CheckCircle2, Trophy, Compass, FileText, X, Send } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssignmentItem {
  id: string
  title: string
  subject: string
  topic: string
  instructions: string
  due_date: string
  type: string
  max_score: number
  is_compass_guided: boolean
  is_holiday_assignment?: boolean
  holiday_period?: string
  daysLeft: number
  isOverdue: boolean
  submissionStatus: 'pending' | 'submitted' | 'marked'
  submission: {
    id: string
    status: string
    score: number | null
    teacher_feedback: string | null
    submitted_at: string | null
  } | null
  teachers?: { full_name: string }
  teacher_classes?: { name: string; grade: number; subject: string }
}

type FilterTab = 'all' | 'pending' | 'submitted' | 'marked'

// ─── Submit Modal ─────────────────────────────────────────────────────────────

function SubmitModal({
  assignment,
  studentId,
  onDone,
  onClose,
}: {
  assignment: AssignmentItem
  studentId: string
  onDone: () => void
  onClose: () => void
}) {
  const [workText, setWorkText] = useState('')
  const [viaCompass, setViaCompass] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/student/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: assignment.id,
          studentId,
          work_text: viaCompass ? undefined : workText || undefined,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'Failed to submit. Try again.')
        return
      }
      onDone()
    } catch {
      setError('Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-black text-gray-900">Submit Assignment</h2>
            <p className="text-sm text-gray-500 mt-0.5">{assignment.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Via Compass toggle */}
          <label className="flex items-start gap-3 p-4 border border-teal-200 bg-teal-50 rounded-2xl cursor-pointer">
            <input
              type="checkbox"
              checked={viaCompass}
              onChange={e => setViaCompass(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-teal-600"
            />
            <div>
              <div className="font-black text-gray-900 text-sm">I completed this via Compass 🧭</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Compass already tracked your work — no need to type your answers
              </div>
            </div>
          </label>

          {/* Text area for manual work */}
          {!viaCompass && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                Type your answers here (optional)
              </label>
              <textarea
                value={workText}
                onChange={e => setWorkText(e.target.value)}
                rows={5}
                placeholder="Write your answers, working, or any notes for your teacher..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none text-gray-900 resize-none"
              />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-black text-sm hover:bg-teal-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><Send className="w-4 h-4" /> Submit</>
              }
            </button>
            <button
              onClick={onClose}
              className="px-5 py-3 border border-gray-200 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Assignment Card ───────────────────────────────────────────────────────────

function AssignmentCard({
  item,
  studentId,
  onSubmitted,
}: {
  item: AssignmentItem
  studentId: string
  onSubmitted: (id: string) => void
}) {
  const [showSubmit, setShowSubmit] = useState(false)
  const status = item.submissionStatus

  const teacherName = item.teachers?.full_name || 'Teacher'
  const className = item.teacher_classes?.name || ''

  function handleDone() {
    setShowSubmit(false)
    onSubmitted(item.id)
  }

  // MARKED card
  if (status === 'marked' && item.submission) {
    return (
      <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span className="font-black text-gray-900">{item.title}</span>
            {item.is_holiday_assignment && (
              <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-lg">
                Holiday
              </span>
            )}
          </div>
          <span className="text-xs font-black bg-green-100 text-green-700 px-2.5 py-1 rounded-lg shrink-0">
            Marked
          </span>
        </div>

        <div className="text-xs text-gray-500 mb-3">
          {item.subject} &nbsp;·&nbsp; {teacherName}
          {className && <>&nbsp;·&nbsp; {className}</>}
        </div>

        {item.submission.score !== null && (
          <div className="text-2xl font-black text-green-600 mb-1">
            {item.submission.score}<span className="text-gray-400 text-base font-bold">/{item.max_score}</span>
          </div>
        )}

        {item.submission.teacher_feedback && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-gray-700 mb-3">
            <span className="font-bold text-green-700">Teacher: </span>
            &ldquo;{item.submission.teacher_feedback}&rdquo;
          </div>
        )}

        {item.is_compass_guided && (
          <Link
            href={`/chat?topic=${encodeURIComponent(item.topic)}&subject=${encodeURIComponent(item.subject)}`}
            className="inline-flex items-center gap-2 text-xs font-black text-teal-700 bg-teal-50 border border-teal-200 px-3 py-2 rounded-xl hover:bg-teal-100 transition"
          >
            <Compass className="w-3.5 h-3.5" /> Practice weak areas
          </Link>
        )}
      </div>
    )
  }

  // SUBMITTED card
  if (status === 'submitted') {
    return (
      <div className="bg-white rounded-2xl border border-blue-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-500" />
            <span className="font-black text-gray-900">{item.title}</span>
            {item.is_holiday_assignment && (
              <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-lg">Holiday</span>
            )}
          </div>
          <span className="text-xs font-black bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg shrink-0">
            Submitted
          </span>
        </div>
        <div className="text-xs text-gray-500 mb-3">
          {item.subject} &nbsp;·&nbsp; {teacherName}
          {item.submission?.submitted_at && (
            <>&nbsp;·&nbsp; {new Date(item.submission.submitted_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}</>
          )}
        </div>
        <p className="text-sm text-gray-400 italic">Awaiting teacher feedback...</p>
      </div>
    )
  }

  // PENDING card
  return (
    <>
      <div className={`bg-white rounded-2xl border shadow-sm p-5 ${item.isOverdue ? 'border-red-200' : 'border-amber-200'}`}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className={`w-5 h-5 shrink-0 ${item.isOverdue ? 'text-red-500' : 'text-amber-500'}`} />
            <span className="font-black text-gray-900 truncate">{item.title}</span>
            {item.is_holiday_assignment && (
              <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-lg shrink-0">
                Holiday
              </span>
            )}
          </div>
          <span className={`text-xs font-black px-2.5 py-1 rounded-lg shrink-0 ${
            item.isOverdue ? 'bg-red-100 text-red-700' :
            item.daysLeft <= 2 ? 'bg-amber-100 text-amber-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {item.isOverdue ? 'Overdue' : item.daysLeft === 0 ? 'Due today' : `${item.daysLeft}d left`}
          </span>
        </div>

        <div className="text-xs text-gray-500 mb-4">
          {item.subject} &nbsp;·&nbsp; {teacherName}
          {className && <>&nbsp;·&nbsp; {className}</>}
        </div>

        <div className="flex gap-2 flex-wrap">
          {item.is_compass_guided && (
            <Link
              href={`/chat?topic=${encodeURIComponent(item.topic)}&subject=${encodeURIComponent(item.subject)}&assignmentId=${item.id}`}
              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2.5 rounded-xl font-black text-sm hover:bg-teal-700 transition"
            >
              <Compass className="w-4 h-4" /> Start with Compass
            </Link>
          )}
          <button
            onClick={() => setShowSubmit(true)}
            className="flex items-center gap-2 border border-gray-200 text-gray-700 bg-gray-50 px-4 py-2.5 rounded-xl font-black text-sm hover:bg-gray-100 transition"
          >
            <Send className="w-4 h-4" /> Submit Work
          </button>
        </div>

        {item.is_holiday_assignment && item.holiday_period && (
          <div className="mt-3 text-xs text-blue-600 font-bold">
            Holiday: {item.holiday_period}
          </div>
        )}
      </div>

      {showSubmit && (
        <SubmitModal
          assignment={item}
          studentId={studentId}
          onDone={handleDone}
          onClose={() => setShowSubmit(false)}
        />
      )}
    </>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function StudentAssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentItem[]>([])
  const [studentId, setStudentId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('all')

  useEffect(() => {
    // Fetch assignments for the student
    fetch('/api/student/assignments')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setAssignments(d.data.assignments || [])
        }
      })
      .finally(() => setLoading(false))

    // Get studentId from students list
    fetch('/api/students/list')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data.students?.[0]) {
          setStudentId(d.data.students[0].id)
        }
      })
      .catch(() => {
        // Non-fatal — studentId used only for submit modal
      })
  }, [])

  function handleSubmitted(assignmentId: string) {
    setAssignments(prev => prev.map(a =>
      a.id === assignmentId
        ? { ...a, submissionStatus: 'submitted', submission: { id: '', status: 'submitted', score: null, teacher_feedback: null, submitted_at: new Date().toISOString() } }
        : a
    ))
  }

  const filtered = filter === 'all'
    ? assignments
    : assignments.filter(a => a.submissionStatus === filter)

  const pendingCount = assignments.filter(a => a.submissionStatus === 'pending').length

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: `All (${assignments.length})` },
    { key: 'pending', label: `Pending (${pendingCount})` },
    { key: 'submitted', label: `Submitted (${assignments.filter(a => a.submissionStatus === 'submitted').length})` },
    { key: 'marked', label: `Marked (${assignments.filter(a => a.submissionStatus === 'marked').length})` },
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 font-medium">
          ← Dashboard
        </Link>
        <div className="flex items-center gap-3 mt-3">
          <h1 className="text-3xl font-black text-gray-900">My Assignments</h1>
          {pendingCount > 0 && (
            <span className="bg-amber-500 text-white text-xs font-black px-2.5 py-1 rounded-full">
              {pendingCount} pending
            </span>
          )}
        </div>
        <p className="text-gray-500 mt-1">Track and submit your class assignments</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition ${
              filter === t.key
                ? 'bg-teal-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <span className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-black text-gray-600 mb-2">
            {filter === 'all' ? 'No assignments yet' : `No ${filter} assignments`}
          </h3>
          {filter === 'all' && (
            <p className="text-gray-400">
              Your teacher will assign work here. Check back soon!
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(item => (
            <AssignmentCard
              key={item.id}
              item={item}
              studentId={studentId}
              onSubmitted={handleSubmitted}
            />
          ))}
        </div>
      )}
    </div>
  )
}
