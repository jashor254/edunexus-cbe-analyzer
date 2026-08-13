'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

const LEVEL_LABELS: Record<number, string> = {
  1: 'Emerging',
  2: 'Developing',
  3: 'Proficient',
  4: 'Exemplary',
}

type PilotStudent = {
  tracking_id: string
  term: number
  year: number
  whatsapp_sent_at: string | null
  parent_name: string | null
  parent_phone: string | null
  feedback_notes: string | null
  feedback_received_at: string | null
  student_id: string
  name: string
  grade: number
  school: string | null
  curriculum_type: string
  report_id: string | null
  generated_at: string | null
  shared_token: string | null
  pdf_url: string | null
  overall_level: number | null
  top_pathway: string | null
  priority_subject: string | null
}

type AllStudentOption = {
  id: string
  name: string
  grade: number
}

export default function PilotPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [students, setStudents] = useState<PilotStudent[]>([])
  const [loading, setLoading] = useState(true)

  // Add student modal
  const [showAdd, setShowAdd] = useState(false)
  const [allStudents, setAllStudents] = useState<AllStudentOption[]>([])
  const [allStudentsLoading, setAllStudentsLoading] = useState(false)
  const [addStudentId, setAddStudentId] = useState('')
  const [addParentName, setAddParentName] = useState('')
  const [addParentPhone, setAddParentPhone] = useState('')
  const [addTerm, setAddTerm] = useState(1)
  const [addYear, setAddYear] = useState(2026)
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Per-card state
  const [expandedWhatsApp, setExpandedWhatsApp] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({})
  const [savingFeedback, setSavingFeedback] = useState<Set<string>>(new Set())
  const [markingSent, setMarkingSent] = useState<Set<string>>(new Set())

  async function fetchStudents() {
    setLoading(true)
    const res = await fetch('/api/admin/pilot/students')
    const json = await res.json()
    if (json.success) {
      setStudents(json.data.students)
      const drafts: Record<string, string> = {}
      for (const s of json.data.students) {
        drafts[s.tracking_id] = s.feedback_notes ?? ''
      }
      setFeedbackDrafts(drafts)
    }
    setLoading(false)
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase().trim() ?? '')) {
        router.replace('/dashboard')
        return
      }
      setReady(true)
      fetchStudents()
    })
  }, [router])

  // Cross-tenant reads go through the server, never the browser's Supabase
  // client. This used to be a direct `.from('students')` query that only
  // worked because of an RLS policy trusting a self-writable admin flag
  // (removed by migration 20260812190000). The endpoint below re-derives
  // authorization server-side via requireGrowthUser().
  const fetchAllStudents = async () => {
    setAllStudentsLoading(true)
    setAddError(null)
    try {
      const res = await fetch('/api/admin/pilot/available-students')
      const json = await res.json()
      if (json.success) {
        setAllStudents(json.data.students as AllStudentOption[])
      } else {
        setAllStudents([])
        setAddError(
          res.status === 401 || res.status === 403
            ? 'You are not authorised to load the student list.'
            : 'Could not load students. Please try again.'
        )
      }
    } catch {
      setAllStudents([])
      setAddError('Could not load students. Please try again.')
    }
    setAllStudentsLoading(false)
  }

  const handleOpenAdd = () => {
    setShowAdd(true)
    fetchAllStudents()
  }

  const handleAddStudent = async () => {
    if (!addStudentId || !addParentName.trim() || !addParentPhone.trim()) {
      setAddError('All fields are required')
      return
    }
    setAddLoading(true)
    setAddError(null)
    const res = await fetch('/api/admin/pilot/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: addStudentId,
        parent_name: addParentName.trim(),
        parent_phone: addParentPhone.trim(),
        term: addTerm,
        year: addYear,
      }),
    })
    const json = await res.json()
    if (json.success) {
      setShowAdd(false)
      setAddStudentId('')
      setAddParentName('')
      setAddParentPhone('')
      fetchStudents()
    } else {
      setAddError(json.error ?? 'Failed to add student')
    }
    setAddLoading(false)
  }

  const patchTracking = async (
    tracking_id: string,
    updates: Record<string, string | null>
  ) => {
    const res = await fetch('/api/admin/pilot/tracking', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tracking_id, updates }),
    })
    return res.json()
  }

  const handleMarkSent = async (s: PilotStudent) => {
    setMarkingSent((prev) => new Set(prev).add(s.tracking_id))
    const json = await patchTracking(s.tracking_id, {
      whatsapp_sent_at: new Date().toISOString(),
    })
    if (json.success) {
      setStudents((prev) =>
        prev.map((x) =>
          x.tracking_id === s.tracking_id
            ? { ...x, whatsapp_sent_at: json.data.record.whatsapp_sent_at }
            : x
        )
      )
    }
    setMarkingSent((prev) => {
      const next = new Set(prev)
      next.delete(s.tracking_id)
      return next
    })
  }

  const handleSaveFeedback = async (s: PilotStudent) => {
    const notes = feedbackDrafts[s.tracking_id] ?? ''
    setSavingFeedback((prev) => new Set(prev).add(s.tracking_id))
    const updates: Record<string, string | null> = { feedback_notes: notes }
    if (notes.trim() && !s.feedback_received_at) {
      updates.feedback_received_at = new Date().toISOString()
    }
    const json = await patchTracking(s.tracking_id, updates)
    if (json.success) {
      setStudents((prev) =>
        prev.map((x) =>
          x.tracking_id === s.tracking_id
            ? {
                ...x,
                feedback_notes: json.data.record.feedback_notes,
                feedback_received_at: json.data.record.feedback_received_at,
              }
            : x
        )
      )
    }
    setSavingFeedback((prev) => {
      const next = new Set(prev)
      next.delete(s.tracking_id)
      return next
    })
  }

  const toggleWhatsApp = (id: string) => {
    setExpandedWhatsApp((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const buildWhatsAppMessage = (s: PilotStudent): string => {
    const levelLabel = s.overall_level ? LEVEL_LABELS[s.overall_level] ?? '' : ''
    const link = s.shared_token ? `edunexus.co.ke/shared/${s.shared_token}` : ''
    return `Habari ${s.parent_name ?? 'Mzazi'},\nNimekamilisha ripoti ya ${s.name} ya Term ${s.term}.\n${s.name} yuko Level ${s.overall_level ?? '—'} (${levelLabel}).\nPathway inayopendekezwa: ${s.top_pathway ?? '—'}.\nAnahitaji msaada: ${s.priority_subject ?? '—'}.\nRipoti kamili: ${link}`
  }

  const handleCopy = async (s: PilotStudent) => {
    const msg = buildWhatsAppMessage(s)
    await navigator.clipboard.writeText(msg)
    setCopiedId(s.tracking_id)
    setTimeout(() => setCopiedId(null), 4000)
  }

  // Metrics
  const total = students.length
  const reportsGenerated = students.filter((s) => s.report_id !== null).length
  const sentToParents = students.filter((s) => s.whatsapp_sent_at !== null).length
  const feedbackReceived = students.filter((s) => s.feedback_received_at !== null).length

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <a href="/admin" className="text-white/40 hover:text-white/70 text-sm transition-colors">
                ← Admin
              </a>
            </div>
            <h1 className="text-3xl font-black text-white">Pilot Students</h1>
            <p className="text-white/50 text-sm mt-1">
              Term 1, 2026 · {total} student{total !== 1 ? 's' : ''} · Kahutini
            </p>
          </div>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            + Add Student
          </button>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total students', value: total },
            { label: 'Reports generated', value: reportsGenerated },
            { label: 'Sent to parents', value: sentToParents },
            { label: 'Feedback received', value: feedbackReceived },
          ].map((m) => (
            <div key={m.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-white/50 text-xs mb-1">{m.label}</p>
              <p className="text-2xl font-black text-white">{m.value}</p>
            </div>
          ))}
        </div>

        {/* Student cards */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-5 animate-pulse h-40" />
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center">
            <p className="text-white/40 text-sm">No pilot students yet. Click "Add Student" to begin.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {students.map((s) => {
              const waExpanded = expandedWhatsApp.has(s.tracking_id)
              const waMsg = buildWhatsAppMessage(s)
              const waJustCopied = copiedId === s.tracking_id
              const levelLabel = s.overall_level ? LEVEL_LABELS[s.overall_level] ?? '' : ''

              return (
                <div key={s.tracking_id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">

                  {/* TOP ROW */}
                  <div className="flex items-start justify-between gap-4 p-5">
                    {/* Left: avatar + name */}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-violet-700 flex items-center justify-center text-sm font-bold shrink-0">
                        {s.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-white text-base">{s.name}</p>
                        <p className="text-white/50 text-xs">Grade {s.grade} · {s.curriculum_type}</p>
                        {(s.parent_name || s.parent_phone) && (
                          <p className="text-white/40 text-xs mt-0.5">
                            {s.parent_name}{s.parent_name && s.parent_phone ? ' · ' : ''}{s.parent_phone}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: status pills */}
                    <div className="flex flex-wrap gap-2 justify-end shrink-0">
                      {/* Report pill */}
                      {s.report_id ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-900/50 text-green-400 border border-green-500/30">
                          Report ready
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/10 text-white/50 border border-white/20">
                          No report
                        </span>
                      )}

                      {/* Sent pill */}
                      {s.whatsapp_sent_at ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-900/50 text-green-400 border border-green-500/30">
                          Sent {new Date(s.whatsapp_sent_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-900/50 text-amber-400 border border-amber-500/30">
                          Not sent
                        </span>
                      )}

                      {/* Feedback pill */}
                      {s.feedback_received_at ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-900/50 text-green-400 border border-green-500/30">
                          Feedback received
                        </span>
                      ) : s.whatsapp_sent_at ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-900/50 text-amber-400 border border-amber-500/30">
                          Feedback pending
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/10 text-white/50 border border-white/20">
                          No feedback
                        </span>
                      )}
                    </div>
                  </div>

                  {/* BODY ROW */}
                  <div className="flex items-start justify-between gap-4 px-5 pb-5">
                    {/* Stats */}
                    <div className="space-y-1 text-sm">
                      {s.overall_level && (
                        <p className="text-white/70">
                          <span className="text-white/40 text-xs">Level</span>{' '}
                          <span className="font-semibold">{s.overall_level} — {levelLabel}</span>
                        </p>
                      )}
                      {s.top_pathway && (
                        <p className="text-white/70">
                          <span className="text-white/40 text-xs">Pathway</span>{' '}
                          <span className="font-semibold">{s.top_pathway}</span>
                        </p>
                      )}
                      {s.priority_subject && (
                        <p className="text-white/70">
                          <span className="text-white/40 text-xs">Needs help</span>{' '}
                          <span className="font-semibold">{s.priority_subject}</span>
                        </p>
                      )}
                      {s.generated_at && (
                        <p className="text-white/30 text-xs">
                          Generated {new Date(s.generated_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 justify-end items-start">
                      {!s.report_id ? (
                        <a
                          href={`/dashboard/clinic?student=${s.student_id}`}
                          className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          Generate report
                        </a>
                      ) : (
                        <>
                          {s.shared_token && (
                            <a
                              href={`/shared/${s.shared_token}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition-colors"
                            >
                              PDF
                            </a>
                          )}
                          <button
                            onClick={() => toggleWhatsApp(s.tracking_id)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                              waExpanded
                                ? 'bg-green-700 text-white'
                                : 'bg-white/10 hover:bg-white/20 text-white'
                            }`}
                          >
                            WhatsApp msg
                          </button>
                          <a
                            href={`/dashboard/clinic?student=${s.student_id}`}
                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition-colors"
                          >
                            Re-generate
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  {/* WHATSAPP EXPAND */}
                  {waExpanded && (
                    <div className="mx-5 mb-4 bg-[#0d1117] border border-green-800/50 rounded-xl p-4 space-y-3 animate-in slide-in-from-top-1 duration-200">
                      <pre className="text-sm text-white/80 whitespace-pre-wrap font-sans leading-relaxed">
                        {waMsg}
                      </pre>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleCopy(s)}
                          className="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          Copy message
                        </button>
                        {waJustCopied && (
                          <div className="flex items-center gap-2 text-green-400 text-xs font-medium">
                            <span>Copied! Mark as sent?</span>
                            <button
                              onClick={() => handleMarkSent(s)}
                              disabled={markingSent.has(s.tracking_id)}
                              className="px-3 py-1 bg-green-800 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                            >
                              {markingSent.has(s.tracking_id) ? '…' : 'Yes'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* FEEDBACK ROW */}
                  <div className="border-t border-white/10 px-5 py-3 flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="Parent feedback / notes..."
                      value={feedbackDrafts[s.tracking_id] ?? ''}
                      onChange={(e) =>
                        setFeedbackDrafts((prev) => ({ ...prev, [s.tracking_id]: e.target.value }))
                      }
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500 min-w-0"
                    />
                    <button
                      onClick={() => handleSaveFeedback(s)}
                      disabled={savingFeedback.has(s.tracking_id)}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors shrink-0"
                    >
                      {savingFeedback.has(s.tracking_id) ? '…' : 'Save'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ADD STUDENT MODAL */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#13131f] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Add Pilot Student</h2>
              <button
                onClick={() => setShowAdd(false)}
                className="text-white/40 hover:text-white/70 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-white/60 text-xs mb-1 block">Student</label>
                <select
                  value={addStudentId}
                  onChange={(e) => setAddStudentId(e.target.value)}
                  disabled={allStudentsLoading}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 disabled:opacity-50"
                >
                  <option value="">
                    {allStudentsLoading
                      ? 'Loading students…'
                      : allStudents.length === 0
                        ? 'No students available'
                        : 'Select a student…'}
                  </option>
                  {allStudents.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} (Grade {st.grade})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Parent name</label>
                <input
                  type="text"
                  placeholder="e.g. Jane Kariuki"
                  value={addParentName}
                  onChange={(e) => setAddParentName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Parent phone</label>
                <input
                  type="tel"
                  placeholder="e.g. 0712 345 678"
                  value={addParentPhone}
                  onChange={(e) => setAddParentPhone(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-white/60 text-xs mb-1 block">Term</label>
                  <select
                    value={addTerm}
                    onChange={(e) => setAddTerm(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value={1}>Term 1</option>
                    <option value={2}>Term 2</option>
                    <option value={3}>Term 3</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-white/60 text-xs mb-1 block">Year</label>
                  <input
                    type="number"
                    value={addYear}
                    onChange={(e) => setAddYear(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>
            </div>

            {addError && (
              <p className="text-red-400 text-xs">{addError}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStudent}
                disabled={addLoading}
                className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {addLoading ? 'Adding…' : 'Add to pilot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
