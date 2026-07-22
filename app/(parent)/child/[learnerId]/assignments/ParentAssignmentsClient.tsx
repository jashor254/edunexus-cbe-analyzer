'use client'

// Sprint 5 (Parent Experience Convergence) — read-only assignment status
// for one linked learner. Fetches the exact same
// /api/student/assignments?studentId= route the learner's own device
// calls (already parent-authorized via requireStudent/requireParent) —
// no submit modal, no file upload, no write action: "visibility, not
// administrative control."

import { useEffect, useState } from 'react'
import { FileText, CheckCircle2, Clock } from 'lucide-react'

interface AssignmentItem {
  id: string
  title: string
  subject: string
  due_date: string
  daysLeft: number
  isOverdue: boolean
  submissionStatus: 'pending' | 'submitted' | 'marked'
  submission: { score: number | null; teacher_feedback: string | null } | null
  max_score: number
}

export default function ParentAssignmentsClient({ studentId }: { studentId: string }) {
  const [assignments, setAssignments] = useState<AssignmentItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/student/assignments?studentId=${studentId}`)
      .then(r => r.json())
      .then(json => { if (json.success) setAssignments(json.data.assignments) })
      .finally(() => setLoading(false))
  }, [studentId])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (assignments.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-black text-gray-600">No assignments yet</h3>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {assignments.map(a => (
        <div key={a.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-gray-400 mb-0.5">{a.subject}</div>
              <div className="font-black text-gray-900">{a.title}</div>
              <div className="text-xs text-gray-400 mt-1">
                Due {new Date(a.due_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
              </div>
            </div>
            <span className={`shrink-0 text-xs font-black px-2.5 py-1 rounded-lg ${
              a.submissionStatus === 'marked' ? 'bg-emerald-100 text-emerald-700' :
              a.submissionStatus === 'submitted' ? 'bg-sky-100 text-sky-700' :
              a.isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {a.submissionStatus === 'marked' ? 'Marked' :
                a.submissionStatus === 'submitted' ? 'Submitted' :
                a.isOverdue ? 'Overdue' : 'Pending'}
            </span>
          </div>
          {a.submissionStatus === 'marked' && a.submission && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <span className="font-black text-gray-900">{a.submission.score ?? '—'}/{a.max_score}</span>
                {a.submission.teacher_feedback && (
                  <p className="text-gray-600 mt-1">{a.submission.teacher_feedback}</p>
                )}
              </div>
            </div>
          )}
          {a.submissionStatus === 'pending' && !a.isOverdue && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
              <Clock className="w-3.5 h-3.5" /> {a.daysLeft === 0 ? 'Due today' : `${a.daysLeft} day${a.daysLeft === 1 ? '' : 's'} left`}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
