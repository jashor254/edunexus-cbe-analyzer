'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import {
  CheckCircle2, Clock, AlertTriangle, MessageSquare,
  ChevronDown, ChevronUp, Send, Users, FileText, Printer,
} from 'lucide-react'
import { generateAssignmentPDF } from '@/lib/assignments/pdfRenderer'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarkingState {
  score: string
  feedback: string
  saving: boolean
  saved: boolean
  expanded: boolean
}

interface Submission {
  id: string
  student_id: string
  status: string
  score: number | null
  teacher_feedback: string | null
  compass_summary: string | null
  work_text: string | null
  file_name: string | null
  submitted_at: string | null
  marked_at: string | null
  isOverdue: boolean
  students: { name: string; grade: number } | null
}

interface Assignment {
  id: string
  title: string
  subject: string
  topic: string
  type: string
  status: string
  due_date: string
  max_score: number
  class_id: string
  is_compass_guided: boolean
  is_quiz: boolean
  teacher_classes: { name: string; grade: number } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function buildWhatsAppReminder(studentName: string, subject: string, dueDate: string): string {
  const formattedDate = new Date(dueDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'long' })
  const text = encodeURIComponent(
    `Reminder: ${studentName} has a pending ${subject} assignment due ${formattedDate}. Please remind them to submit on EduNexus. edunexus.co.ke`
  )
  return `https://wa.me/?text=${text}`
}

// ─── Bulk Feedback Modal ──────────────────────────────────────────────────────

function BulkFeedbackModal({
  assignment,
  pendingSubmissions,
  onDone,
  onClose,
}: {
  assignment: Assignment
  pendingSubmissions: Submission[]
  onDone: (updates: { student_id: string; score: number | null; feedback: string }[]) => void
  onClose: () => void
}) {
  const [bulkFeedback, setBulkFeedback] = useState('')
  const [bulkScore, setBulkScore] = useState('')
  const [saving, setSaving] = useState(false)

  const submittedPending = pendingSubmissions.filter(s => s.status === 'submitted')

  async function handleApply() {
    if (submittedPending.length === 0) return
    setSaving(true)
    const updates: { student_id: string; score: number | null; feedback: string }[] = []

    for (const sub of submittedPending) {
      const res = await fetch(`/api/teacher/assignments/${assignment.id}/mark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: sub.student_id,
          score: bulkScore !== '' ? Number(bulkScore) : null,
          feedback: bulkFeedback,
          status: 'marked',
        }),
      })
      const d = await res.json()
      if (d.success) {
        updates.push({ student_id: sub.student_id, score: bulkScore !== '' ? Number(bulkScore) : null, feedback: bulkFeedback })
      }
    }

    setSaving(false)
    onDone(updates)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-black text-gray-900 mb-1">Mark All with Same Feedback</h2>
        <p className="text-sm text-gray-500 mb-5">
          Apply one score + feedback to all {submittedPending.length} submitted (unmarked) students.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              Score (optional) — out of {assignment.max_score}
            </label>
            <input
              type="number"
              value={bulkScore}
              onChange={e => setBulkScore(e.target.value)}
              min={0}
              max={assignment.max_score}
              placeholder={`e.g. 85`}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Feedback message</label>
            <textarea
              value={bulkFeedback}
              onChange={e => setBulkFeedback(e.target.value)}
              rows={3}
              placeholder="e.g. Good effort! Review your working in questions 3 and 4."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleApply}
            disabled={saving || submittedPending.length === 0}
            className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-black text-sm hover:bg-teal-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><CheckCircle2 className="w-4 h-4" /> Mark {submittedPending.length} Students</>
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
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AssignmentMarkingPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = use(params)
  const [data, setData] = useState<{ assignment: Assignment; submissions: Submission[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'submitted' | 'pending'>('submitted')
  const [markingStates, setMarkingStates] = useState<Record<string, MarkingState>>({})
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [sentNotice, setSentNotice] = useState<Record<string, string>>({})
  const [printingLevel, setPrintingLevel] = useState<number | null>(null)
  const [strugglingAlerts, setStrugglingAlerts] = useState<{ name: string; studentId: string; score: number; maxScore: number }[]>([])

  useEffect(() => {
    fetch(`/api/teacher/assignments/${assignmentId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setData(d.data)
          const initial: Record<string, MarkingState> = {}
          ;(d.data.submissions || []).forEach((s: Submission) => {
            initial[s.student_id] = {
              score: s.score !== null ? String(s.score) : '',
              feedback: s.teacher_feedback || '',
              saving: false,
              saved: s.status === 'marked',
              expanded: false,
            }
          })
          setMarkingStates(initial)
        }
      })
      .finally(() => setLoading(false))
  }, [assignmentId])

  async function markSubmission(sub: Submission, status: 'marked' | 'needs_revision' = 'marked') {
    const ms = markingStates[sub.student_id]
    if (!ms) return

    setMarkingStates(prev => ({ ...prev, [sub.student_id]: { ...prev[sub.student_id], saving: true } }))

    const res = await fetch(`/api/teacher/assignments/${assignmentId}/mark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: sub.student_id,
        score: ms.score !== '' ? Number(ms.score) : null,
        feedback: ms.feedback,
        status,
      }),
    })
    const d = await res.json()

    if (d.success) {
      setMarkingStates(prev => ({
        ...prev,
        [sub.student_id]: { ...prev[sub.student_id], saving: false, saved: true, expanded: false },
      }))
      setData(prev => prev ? {
        ...prev,
        submissions: prev.submissions.map(s =>
          s.student_id === sub.student_id
            ? { ...s, status: 'marked', score: d.data.submission.score, teacher_feedback: d.data.submission.teacher_feedback }
            : s
        ),
      } : prev)
      setSentNotice(prev => ({
        ...prev,
        [sub.student_id]: `Feedback sent to ${sub.students?.name || 'student'}!`,
      }))
      setTimeout(() => setSentNotice(prev => { const n = { ...prev }; delete n[sub.student_id]; return n }), 3000)

      // Track Level 1 students for WhatsApp alert
      const savedScore = d.data.submission.score
      if (savedScore !== null && data) {
        const level = cbcLevel(savedScore, data.assignment.max_score)
        if (level === 1) {
          setStrugglingAlerts(prev => {
            const exists = prev.some(a => a.studentId === sub.student_id)
            if (exists) return prev
            return [...prev, {
              name: sub.students?.name || 'Student',
              studentId: sub.student_id,
              score: savedScore,
              maxScore: data.assignment.max_score,
            }]
          })
        }
      }
    } else {
      setMarkingStates(prev => ({ ...prev, [sub.student_id]: { ...prev[sub.student_id], saving: false } }))
      alert('Failed to save mark. Please try again.')
    }
  }

  function handleBulkDone(updates: { student_id: string; score: number | null; feedback: string }[]) {
    setData(prev => {
      if (!prev) return prev
      const updateMap = new Map(updates.map(u => [u.student_id, u]))
      return {
        ...prev,
        submissions: prev.submissions.map(s => {
          const u = updateMap.get(s.student_id)
          if (u) return { ...s, status: 'marked', score: u.score, teacher_feedback: u.feedback }
          return s
        }),
      }
    })
    setMarkingStates(prev => {
      const next = { ...prev }
      updates.forEach(u => {
        if (next[u.student_id]) {
          next[u.student_id] = { ...next[u.student_id], saved: true, expanded: false }
        }
      })
      return next
    })
    setShowBulkModal(false)
  }

  function cbcLevel(score: number, max: number): number {
    const pct = max > 0 ? (score / max) * 100 : 0
    if (pct >= 75) return 4
    if (pct >= 55) return 3
    if (pct >= 40) return 2
    return 1
  }

  function printLevel(level: 1 | 2 | 3 | 4) {
    if (!data) return
    setPrintingLevel(level)
    const { assignment } = data
    const html = generateAssignmentPDF({
      assignment: {
        title: assignment.title,
        subject: assignment.subject,
        topic: assignment.topic,
        instructions: '',
        due_date: assignment.due_date,
        max_score: assignment.max_score,
      },
      meta: {
        class_name: assignment.teacher_classes?.name,
        grade: assignment.teacher_classes?.grade ? String(assignment.teacher_classes.grade) : undefined,
      },
      level,
    })
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      setTimeout(() => { win.print(); win.close(); setPrintingLevel(null) }, 700)
    } else {
      setPrintingLevel(null)
    }
  }

  function printClassSet() {
    if (!data) return
    setPrintingLevel(0)
    const { assignment } = data
    const pages = ([1, 2, 3, 4] as const).map(level =>
      generateAssignmentPDF({
        assignment: {
          title: assignment.title,
          subject: assignment.subject,
          topic: assignment.topic,
          instructions: '',
          due_date: assignment.due_date,
          max_score: assignment.max_score,
        },
        meta: {
          class_name: assignment.teacher_classes?.name,
          grade: assignment.teacher_classes?.grade ? String(assignment.teacher_classes.grade) : undefined,
        },
        level,
      })
    )
    const combined = `<html><head><style>@media print{.page-break{page-break-after:always}}</style></head><body>
      ${pages.map((p, i) => `<div class="page-break">${p.replace(/<!DOCTYPE html>[\s\S]*?<body>/, '').replace(/<\/body>[\s\S]*?<\/html>/, '')}</div>`).join('')}
    </body></html>`
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(combined)
      win.document.close()
      setTimeout(() => { win.print(); win.close(); setPrintingLevel(null) }, 700)
    } else {
      setPrintingLevel(null)
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
  const submittedList = submissions.filter(s => ['submitted', 'marked'].includes(s.status))
  const pendingList = submissions.filter(s => !['submitted', 'marked'].includes(s.status))
  const markedCount = submissions.filter(s => s.status === 'marked').length
  const submissionPct = submissions.length > 0 ? Math.round((submittedList.length / submissions.length) * 100) : 0

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <Link href="/teacher/assignments" className="text-sm text-gray-400 hover:text-gray-600 font-medium">
            ← Back to Assignments
          </Link>
          <Link
            href={`/teacher/assignments/${assignmentId}/results`}
            className="text-sm font-bold text-teal-600 hover:text-teal-800 border border-teal-200 hover:border-teal-400 px-3 py-1.5 rounded-xl transition"
          >
            Upload Paper Results
          </Link>
        </div>

        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg capitalize ${
              assignment.type === 'graded' ? 'bg-blue-100 text-blue-700' :
              assignment.type === 'exam' ? 'bg-purple-100 text-purple-700' :
              'bg-gray-100 text-gray-600'
            }`}>{assignment.type}</span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
              daysLeft < 0 ? 'bg-red-100 text-red-700' :
              daysLeft <= 2 ? 'bg-amber-100 text-amber-700' :
              'bg-green-100 text-green-700'
            }`}>
              {daysLeft < 0 ? 'Overdue' : `Due in ${daysLeft}d`}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900">{assignment.title}</h1>
          <p className="text-gray-500 mt-1">
            {assignment.teacher_classes?.name} &nbsp;·&nbsp; Grade {assignment.teacher_classes?.grade} &nbsp;·&nbsp; {assignment.subject}
          </p>
          {assignment.is_quiz && (
            <Link
              href={`/teacher/assignments/${assignment.id}/quiz`}
              className="inline-flex items-center gap-1.5 mt-2 text-xs font-black text-teal-700 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-lg hover:bg-teal-100 transition"
            >
              Manage quiz questions
            </Link>
          )}
        </div>
      </div>

      {/* ── Progress bar ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="font-black text-gray-900 text-sm">
            {submittedList.length}/{submissions.length} submitted
          </span>
          <span className="text-sm text-gray-500">{markedCount} marked</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div className="h-3 rounded-full bg-teal-500 transition-all" style={{ width: `${submissionPct}%` }} />
        </div>
        <div className="flex gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block" /> {submittedList.length} submitted</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> {pendingList.length} pending</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> {markedCount} marked</span>
        </div>
      </div>

      {/* ── Print differentiated papers ────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-gray-500" />
            <span className="font-black text-gray-900 text-sm">Print Differentiated Papers</span>
          </div>
          <button
            onClick={printClassSet}
            disabled={printingLevel !== null}
            className="flex items-center gap-1.5 bg-gray-900 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-gray-700 transition disabled:opacity-60"
          >
            {printingLevel === 0
              ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Printer className="w-3.5 h-3.5" />
            }
            Download Class Set (all 4 levels)
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {([
            { level: 1, label: 'Emerging',    colour: 'border-red-300 text-red-700 hover:bg-red-50' },
            { level: 2, label: 'Approaching', colour: 'border-amber-300 text-amber-700 hover:bg-amber-50' },
            { level: 3, label: 'Meeting',     colour: 'border-blue-300 text-blue-700 hover:bg-blue-50' },
            { level: 4, label: 'Exceeding',   colour: 'border-green-300 text-green-700 hover:bg-green-50' },
          ] as const).map(({ level, label, colour }) => (
            <button
              key={level}
              onClick={() => printLevel(level)}
              disabled={printingLevel !== null}
              className={`flex flex-col items-center gap-1 border-2 rounded-xl py-3 px-2 text-xs font-bold transition disabled:opacity-50 ${colour}`}
            >
              {printingLevel === level
                ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                : <Printer className="w-4 h-4" />
              }
              Level {level}
              <span className="font-normal opacity-70">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Struggling students alert ───────────────────────────────────── */}
      {strugglingAlerts.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-black text-orange-900 text-sm">
                {strugglingAlerts.length} student{strugglingAlerts.length > 1 ? 's' : ''} scored Level 1 — notify parents?
              </div>
              <div className="text-xs text-orange-600 mt-0.5">
                Recommend 15 min daily Learning Compass sessions this week
              </div>
            </div>
            <button
              onClick={() => setStrugglingAlerts([])}
              className="text-xs text-orange-400 hover:text-orange-600 font-bold"
            >
              Dismiss
            </button>
          </div>
          <div className="space-y-2">
            {strugglingAlerts.map(a => (
              <div key={a.studentId} className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-orange-100">
                <div>
                  <span className="font-bold text-gray-900 text-sm">{a.name}</span>
                  <span className="text-xs text-orange-600 ml-2">
                    {a.score}/{a.maxScore} pts · Level 1
                  </span>
                </div>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Hi, your child ${a.name} scored Level 1 in ${assignment.topic} (${assignment.subject}).\n\nRecommended: Ask them to review their Learning Compass session on this topic — 15 mins daily this week.\n\n— ${assignment.teacher_classes?.name || 'EduNexus'}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-black text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-xl hover:bg-green-100 transition whitespace-nowrap"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Alert Parent
                </a>
              </div>
            ))}
            {strugglingAlerts.length > 1 && (
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Hi, ${strugglingAlerts.length} students scored Level 1 in ${assignment.topic} (${assignment.subject}).\n\nPlease encourage 15 min daily Learning Compass practice this week.\n\n— EduNexus`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-green-600 text-white py-2.5 rounded-xl font-black text-sm hover:bg-green-700 transition"
              >
                <MessageSquare className="w-4 h-4" /> Alert All {strugglingAlerts.length} Parents
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setActiveTab('submitted')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition ${
            activeTab === 'submitted'
              ? 'bg-teal-600 text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <FileText className="w-4 h-4" /> Submitted ({submittedList.length})
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition ${
            activeTab === 'pending'
              ? 'bg-amber-500 text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Clock className="w-4 h-4" /> Pending ({pendingList.length})
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SUBMITTED TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'submitted' && (
        <div className="space-y-3">
          {/* Bulk action button */}
          {submittedList.some(s => s.status !== 'marked') && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="font-black text-gray-900 text-sm">Mark All at Once</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Apply one feedback message to all {submittedList.filter(s => s.status !== 'marked').length} unmarked submissions
                </div>
              </div>
              <button
                onClick={() => setShowBulkModal(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-black text-sm hover:bg-blue-700 transition whitespace-nowrap"
              >
                <Users className="w-4 h-4" /> Mark All
              </button>
            </div>
          )}

          {submittedList.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 font-bold">No submissions yet</p>
            </div>
          ) : (
            submittedList.map(sub => {
              const ms = markingStates[sub.student_id]
              const isMarked = sub.status === 'marked'
              const notice = sentNotice[sub.student_id]

              return (
                <div
                  key={sub.id}
                  className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                    isMarked ? 'border-green-200' : 'border-gray-200'
                  }`}
                >
                  {/* Row header */}
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
                          isMarked ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {sub.students?.name?.charAt(0) || '?'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-black text-gray-900 truncate">{sub.students?.name}</div>
                          <div className="text-xs text-gray-400">
                            {sub.submitted_at ? `Submitted ${timeAgo(sub.submitted_at)}` : 'Submitted'}
                            {isMarked && sub.score !== null && (
                              <span className="ml-2 text-green-600 font-bold">· {sub.score}/{assignment.max_score} pts</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isMarked && (
                          <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded-lg">
                            Marked
                          </span>
                        )}
                        {notice && (
                          <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {notice}
                          </span>
                        )}
                        <button
                          onClick={() => setMarkingStates(prev => ({
                            ...prev,
                            [sub.student_id]: { ...prev[sub.student_id], expanded: !prev[sub.student_id]?.expanded },
                          }))}
                          className="text-gray-400 hover:text-gray-600 transition"
                        >
                          {ms?.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded marking panel */}
                  {ms?.expanded && (
                    <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 space-y-4">
                      {/* View work */}
                      {sub.work_text && (
                        <div className="bg-white border border-gray-200 rounded-xl p-4">
                          <div className="text-xs font-black text-gray-500 mb-2">STUDENT WORK</div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{sub.work_text}</p>
                        </div>
                      )}

                      {/* Attached file */}
                      {sub.file_name && (
                        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-3">
                          <div className="text-sm text-gray-700 truncate">📎 {sub.file_name}</div>
                          <button
                            onClick={async () => {
                              const res = await fetch(`/api/teacher/assignments/${assignment.id}/submissions/${sub.id}/file-url`)
                              const data = await res.json()
                              if (data.success) window.open(data.data.url, '_blank')
                            }}
                            className="shrink-0 text-xs font-black text-teal-700 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-lg hover:bg-teal-100 transition"
                          >
                            Download
                          </button>
                        </div>
                      )}

                      {/* Compass summary */}
                      {sub.compass_summary && (
                        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                          <div className="text-xs font-black text-teal-600 mb-2">COMPASS SUMMARY</div>
                          <p className="text-sm text-gray-700">{sub.compass_summary}</p>
                        </div>
                      )}

                      {assignment.is_quiz ? (
                        <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 text-sm text-teal-800 font-bold">
                          Auto-graded quiz — {sub.score ?? 0}/{assignment.max_score}. No manual marking needed.
                        </div>
                      ) : (
                        <>
                          {/* Score + feedback inputs */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1">
                                Score (0–{assignment.max_score})
                              </label>
                              <input
                                type="number"
                                value={ms.score}
                                onChange={e => setMarkingStates(prev => ({
                                  ...prev,
                                  [sub.student_id]: { ...prev[sub.student_id], score: e.target.value },
                                }))}
                                min={0}
                                max={assignment.max_score}
                                placeholder="e.g. 85"
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1">
                                Quick feedback (optional)
                              </label>
                              <input
                                type="text"
                                value={ms.feedback}
                                onChange={e => setMarkingStates(prev => ({
                                  ...prev,
                                  [sub.student_id]: { ...prev[sub.student_id], feedback: e.target.value },
                                }))}
                                placeholder="Great work! Review Q3."
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
                              />
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => markSubmission(sub, 'marked')}
                              disabled={ms.saving}
                              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-xl font-black text-sm hover:bg-green-700 transition disabled:opacity-60"
                            >
                              {ms.saving
                                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : <><CheckCircle2 className="w-4 h-4" /> Mark as Good</>
                              }
                            </button>
                            <button
                              onClick={() => markSubmission(sub, 'needs_revision')}
                              disabled={ms.saving}
                              className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-xl font-black text-sm hover:bg-orange-600 transition disabled:opacity-60"
                            >
                              <AlertTriangle className="w-4 h-4" /> Needs Revision
                            </button>
                            <button
                              onClick={() => markSubmission(sub, 'marked')}
                              disabled={ms.saving || (!ms.score && !ms.feedback)}
                              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2.5 rounded-xl font-black text-sm hover:bg-teal-700 transition disabled:opacity-40"
                            >
                              <Send className="w-4 h-4" /> Send Feedback
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PENDING TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'pending' && (
        <div className="space-y-3">
          {pendingList.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-green-200">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="text-green-600 font-black">All students have submitted!</p>
            </div>
          ) : (
            <>
              {pendingList.map(sub => (
                <div key={sub.id} className="bg-white rounded-2xl border border-amber-200 shadow-sm px-5 py-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-black shrink-0">
                      {sub.students?.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <div className="font-black text-gray-900">{sub.students?.name}</div>
                      <div className="text-xs text-amber-600 font-bold">Not submitted yet</div>
                    </div>
                  </div>
                  <a
                    href={buildWhatsAppReminder(
                      sub.students?.name || 'your student',
                      assignment.subject,
                      assignment.due_date
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-black text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-xl hover:bg-green-100 transition whitespace-nowrap"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Remind
                  </a>
                </div>
              ))}

              {/* Remind all */}
              <div className="pt-2">
                <a
                  href={buildWhatsAppReminder(
                    `${pendingList.length} students`,
                    assignment.subject,
                    assignment.due_date
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-green-600 text-white py-3 rounded-2xl font-black hover:bg-green-700 transition"
                >
                  <MessageSquare className="w-4 h-4" /> Remind ALL {pendingList.length} Pending Parents
                </a>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Bulk modal ─────────────────────────────────────────────────────── */}
      {showBulkModal && (
        <BulkFeedbackModal
          assignment={assignment}
          pendingSubmissions={submittedList}
          onDone={handleBulkDone}
          onClose={() => setShowBulkModal(false)}
        />
      )}
    </div>
  )
}
