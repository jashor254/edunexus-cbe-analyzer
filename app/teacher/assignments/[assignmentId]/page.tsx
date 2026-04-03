'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import {
  FileText, Users, Clock, CheckCircle2,
  XCircle, ChevronRight, Download, Send,
} from 'lucide-react'

function statusBadge(status: string, isOverdue: boolean) {
  if (isOverdue) return { label: '🔴 Overdue', cls: 'bg-red-100 text-red-700' }
  if (status === 'marked')      return { label: '📝 Marked',      cls: 'bg-blue-100 text-blue-700' }
  if (status === 'submitted')   return { label: '✅ Submitted',   cls: 'bg-green-100 text-green-700' }
  if (status === 'in_progress') return { label: '🔄 In Progress', cls: 'bg-amber-100 text-amber-700' }
  return { label: '⏳ Pending', cls: 'bg-gray-100 text-gray-600' }
}

interface MarkingState {
  [studentId: string]: {
    score: string
    feedback: string
    saving: boolean
    saved: boolean
  }
}

export default function AssignmentDetailPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = use(params)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [markingStates, setMarkingStates] = useState<MarkingState>({})
  const [markingStudent, setMarkingStudent] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/teacher/assignments/${assignmentId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setData(d.data)
          const initial: MarkingState = {}
          ;(d.data.submissions || []).forEach((s: any) => {
            initial[s.student_id] = {
              score: s.score !== null ? String(s.score) : '',
              feedback: s.teacher_feedback || '',
              saving: false,
              saved: false,
            }
          })
          setMarkingStates(initial)
        }
      })
      .finally(() => setLoading(false))
  }, [assignmentId])

  async function markSubmission(studentId: string) {
    const state = markingStates[studentId]
    if (!state) return

    setMarkingStates(prev => ({ ...prev, [studentId]: { ...prev[studentId], saving: true } }))

    const res = await fetch(`/api/teacher/assignments/${assignmentId}/mark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        score: state.score !== '' ? Number(state.score) : null,
        feedback: state.feedback,
      }),
    })
    const d = await res.json()

    if (d.success) {
      setMarkingStates(prev => ({ ...prev, [studentId]: { ...prev[studentId], saving: false, saved: true } }))
      // Update submission in data
      setData((prev: any) => ({
        ...prev,
        submissions: prev.submissions.map((s: any) =>
          s.student_id === studentId
            ? { ...s, status: 'marked', score: d.data.submission.score, teacher_feedback: d.data.submission.teacher_feedback }
            : s
        ),
      }))
      setMarkingStudent(null)
    } else {
      setMarkingStates(prev => ({ ...prev, [studentId]: { ...prev[studentId], saving: false } }))
      alert('Failed to save mark. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <span className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <p className="text-gray-500">Assignment not found.</p>
        <Link href="/teacher/assignments" className="text-teal-600 font-bold mt-2 inline-block">← Back</Link>
      </div>
    )
  }

  const { assignment, submissions } = data
  const due = new Date(assignment.due_date)
  const daysLeft = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const submitted = submissions.filter((s: any) => ['submitted', 'marked'].includes(s.status)).length
  const marked = submissions.filter((s: any) => s.status === 'marked').length
  const submissionPct = submissions.length > 0 ? Math.round((submitted / submissions.length) * 100) : 0

  const activeMarking = markingStudent
    ? submissions.find((s: any) => s.student_id === markingStudent)
    : null

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

      {/* Header */}
      <div className="mb-6">
        <Link href="/teacher/assignments" className="text-sm text-gray-400 hover:text-gray-600 font-medium">
          ← Back to Assignments
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between mt-3">
          <div>
            <h1 className="text-3xl font-black text-gray-900">{assignment.title}</h1>
            <p className="text-gray-500 mt-1">
              {assignment.teacher_classes?.name} · {assignment.subject} · {assignment.topic}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="text-xs font-bold capitalize bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg">
                {assignment.type}
              </span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                assignment.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {assignment.status}
              </span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                daysLeft < 0 ? 'bg-red-100 text-red-700' :
                daysLeft <= 2 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {daysLeft < 0 ? 'Overdue' : `Due in ${daysLeft}d`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Students', value: submissions.length, color: 'text-gray-900' },
          { label: 'Submitted', value: submitted, color: 'text-green-600' },
          { label: 'Marked', value: marked, color: 'text-blue-600' },
          { label: 'Pending', value: submissions.length - submitted, color: 'text-amber-600' },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4 text-center shadow-sm">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Submission progress bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 shadow-sm">
        <div className="flex justify-between text-sm font-bold text-gray-700 mb-2">
          <span>Submission Progress</span>
          <span>{submitted}/{submissions.length} ({submissionPct}%)</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className="h-3 rounded-full bg-teal-500 transition-all"
            style={{ width: `${submissionPct}%` }}
          />
        </div>
      </div>

      {/* Bulk actions */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button className="flex items-center gap-2 text-sm border border-gray-200 text-gray-600 px-4 py-2 rounded-xl font-bold hover:bg-gray-50 transition">
          <Send className="w-4 h-4" /> Remind Pending Students
        </button>
        <a
          href={`/api/teacher/reports/knec-export?classId=${assignment.class_id}&term=2&year=2025`}
          className="flex items-center gap-2 text-sm border border-gray-200 text-gray-600 px-4 py-2 rounded-xl font-bold hover:bg-gray-50 transition"
        >
          <Download className="w-4 h-4" /> Export Scores CSV
        </a>
      </div>

      {/* Submissions table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-black text-gray-500 uppercase">Student</th>
              <th className="text-left px-5 py-3 text-xs font-black text-gray-500 uppercase hidden md:table-cell">Status</th>
              <th className="text-left px-5 py-3 text-xs font-black text-gray-500 uppercase hidden md:table-cell">Score</th>
              <th className="text-left px-5 py-3 text-xs font-black text-gray-500 uppercase hidden md:table-cell">Submitted</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {submissions.map((s: any) => {
              const badge = statusBadge(s.status, s.isOverdue)
              const ms = markingStates[s.student_id]

              return (
                <>
                  <tr key={s.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-4">
                      <div className="font-bold text-gray-900">{s.students?.name}</div>
                      <div className="text-xs text-gray-400">Grade {s.students?.grade}</div>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      {s.score !== null
                        ? <span className="font-black text-gray-900">{s.score}/{assignment.max_score}</span>
                        : <span className="text-gray-400 text-sm">—</span>
                      }
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      {s.submitted_at
                        ? <span className="text-sm text-gray-500">
                            {new Date(s.submitted_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                          </span>
                        : <span className="text-gray-400 text-sm">—</span>
                      }
                    </td>
                    <td className="px-5 py-4">
                      {['submitted', 'in_progress', 'marked'].includes(s.status) && (
                        <button
                          onClick={() => setMarkingStudent(markingStudent === s.student_id ? null : s.student_id)}
                          className="text-xs text-teal-600 border border-teal-200 bg-teal-50 px-3 py-1.5 rounded-lg font-bold hover:bg-teal-100 transition"
                        >
                          {s.status === 'marked' ? 'Edit Mark' : 'Mark'}
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Inline marking panel */}
                  {markingStudent === s.student_id && ms && (
                    <tr key={`mark-${s.id}`}>
                      <td colSpan={5} className="px-5 py-0">
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 my-2">
                          <h3 className="font-black text-gray-900 mb-3">
                            Marking: {s.students?.name}
                          </h3>

                          {s.compass_summary && (
                            <div className="bg-white border border-blue-100 rounded-xl p-4 mb-4">
                              <div className="text-xs font-black text-blue-600 mb-1">🤖 COMPASS SUMMARY</div>
                              <p className="text-sm text-gray-700">{s.compass_summary}</p>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1">
                                Score (0–{assignment.max_score})
                              </label>
                              <input
                                type="number"
                                value={ms.score}
                                onChange={e => setMarkingStates(prev => ({
                                  ...prev,
                                  [s.student_id]: { ...prev[s.student_id], score: e.target.value }
                                }))}
                                min={0}
                                max={assignment.max_score}
                                placeholder="e.g. 78"
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1">
                                Feedback for Student
                              </label>
                              <input
                                type="text"
                                value={ms.feedback}
                                onChange={e => setMarkingStates(prev => ({
                                  ...prev,
                                  [s.student_id]: { ...prev[s.student_id], feedback: e.target.value }
                                }))}
                                placeholder="e.g. Good work on fractions!"
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900"
                              />
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => markSubmission(s.student_id)}
                              disabled={ms.saving}
                              className="flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-teal-700 transition disabled:opacity-60"
                            >
                              {ms.saving
                                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : <><CheckCircle2 className="w-4 h-4" /> Save Mark</>
                              }
                            </button>
                            <button
                              onClick={() => setMarkingStudent(null)}
                              className="px-4 py-2.5 border border-gray-200 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-50 transition"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
