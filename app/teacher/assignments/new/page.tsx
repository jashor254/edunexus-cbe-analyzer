'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { FileText, ChevronRight, Compass, Home, Search, Copy, Check, MessageCircle, ArrowRight } from 'lucide-react'
import { SENIOR_PATHWAY_ELECTIVES, getSeniorCompulsorySubjects, SENIOR_PATHWAYS } from '@/lib/curriculum/subjects'

type SubstrandItem = {
  id: string
  title: string
  displayName: string
  strandTitle: string
}

type AssignmentMode = 'kicd' | 'custom'

type CreatedAssignment = {
  id: string
  className: string
  subject: string
  topic: string
  dueDate: string
  mode: AssignmentMode
  customContent: string
}

const CBC_JUNIOR_SUBJECTS = [
  'Mathematics',
  'English',
  'Kiswahili',
  'Integrated Science',
  'Social Studies',
  'Agriculture & Nutrition',
  'Pre-Technical Studies',
  'Creative Arts & Sports',
  'CRE',
  'Business Studies',
]

// Full senior subject list — all compulsory + all pathway electives, deduped & sorted.
// Pathway filtering happens in Compass at assignment-attempt time, not here.
const CBC_SENIOR_SUBJECTS = Array.from(new Set([
  ...SENIOR_PATHWAYS.flatMap(p => getSeniorCompulsorySubjects(p)),
  ...Object.values(SENIOR_PATHWAY_ELECTIVES).flat(),
])).sort()

function NewAssignmentForm() {
  const searchParams = useSearchParams()
  const prefillClassId = searchParams.get('classId') || ''
  const planId        = searchParams.get('planId') || ''
  const planSubject   = searchParams.get('subject') || ''
  const planTopic     = searchParams.get('topic') || ''
  const planStrand    = searchParams.get('strand') || ''
  const planWeek      = searchParams.get('week') || ''

  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>('kicd')

  const [classes, setClasses] = useState<{ id: string; name: string; grade: number; subject: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<CreatedAssignment | null>(null)
  const [copied, setCopied] = useState(false)

  // Substrand picker state
  const [substrands, setSubstrands] = useState<SubstrandItem[]>([])
  const [substrandsLoading, setSubstrandsLoading] = useState(false)
  const [substrandId, setSubstrandId] = useState('')
  const [substrandSearch, setSubstrandSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState({
    class_id: prefillClassId,
    title: '',
    subject: '',
    topic: '',
    instructions: '',
    due_date: '',
    type: 'practice' as 'practice' | 'graded' | 'exam',
    max_score: 100,
    is_compass_guided: true,
    is_holiday_assignment: false,
    holiday_period: '',
    lesson_plan_id: '',
  })

  // Pre-fill from lesson plan URL params
  useEffect(() => {
    if (!planId) return
    setForm(prev => ({
      ...prev,
      title: `${planTopic} — Week ${planWeek} Assignment`,
      subject: planSubject,
      topic: planTopic,
      lesson_plan_id: planId,
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId])

  useEffect(() => {
    fetch('/api/teacher/classes')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setClasses(d.data.classes)
          if (!prefillClassId && d.data.classes.length > 0) {
            setForm(p => ({ ...p, class_id: d.data.classes[0].id }))
          }
        }
      })
  }, [prefillClassId])

  // Auto-fill subject from selected class (only when not pre-filled from plan)
  useEffect(() => {
    const cls = classes.find(c => c.id === form.class_id)
    if (cls && !form.subject) {
      setForm(p => ({ ...p, subject: cls.subject }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.class_id, classes])

  // Fetch substrands when class or subject changes
  useEffect(() => {
    const cls = classes.find(c => c.id === form.class_id)
    const grade = cls?.grade
    const subject = form.subject

    if (!grade || !subject || subject.toLowerCase() === 'all subjects') {
      setSubstrands([])
      setSubstrandId('')
      setSubstrandSearch('')
      return
    }

    setSubstrandsLoading(true)
    setSubstrandId('')
    setSubstrandSearch('')

    fetch(`/api/teacher/assignments/substrands?grade=${grade}&subject=${encodeURIComponent(subject)}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) return
        const items: SubstrandItem[] = d.data.substrands
        setSubstrands(items)
        // Auto-match pre-filled topic from lesson plan
        if (planTopic) {
          const match = items.find(ss => ss.title === planTopic)
          if (match) {
            setSubstrandId(match.id)
            setSubstrandSearch(match.title)
          } else {
            setSubstrandSearch(planTopic)
          }
        }
      })
      .catch(() => setSubstrands([]))
      .finally(() => setSubstrandsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.class_id, form.subject, classes])

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredSubstrands = substrandSearch && !substrandId
    ? substrands.filter(ss =>
        ss.title.toLowerCase().includes(substrandSearch.toLowerCase()) ||
        ss.strandTitle.toLowerCase().includes(substrandSearch.toLowerCase())
      )
    : substrands

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.class_id) { setError('Please select a class'); return }
    if (!form.due_date) { setError('Due date is required'); return }

    if (assignmentMode === 'kicd') {
      if (!form.topic) {
        setError(substrands.length > 0 ? 'Please select a substrand from the dropdown' : 'Topic is required')
        return
      }
    } else {
      if (!form.instructions.trim()) { setError('Assignment content is required'); return }
    }

    const payload = assignmentMode === 'custom'
      ? { ...form, topic: 'Custom' }
      : form

    setLoading(true)
    try {
      const res = await fetch('/api/teacher/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error || 'Failed to create assignment'); return }
      const cls = classes.find(c => c.id === form.class_id)
      setCreated({
        id:          data.data.assignment.id,
        className:   cls?.name ?? 'Your Class',
        subject:     form.subject,
        topic:       assignmentMode === 'custom' ? 'Custom' : form.topic,
        dueDate:     form.due_date,
        mode:        assignmentMode,
        customContent: form.instructions,
      })
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const minDate = new Date().toISOString().split('T')[0]

  // --- Share card shown after successful creation ---
  if (created) {
    const formattedDate = new Date(created.dueDate + 'T00:00:00').toLocaleDateString('en-KE', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })

    const topicLine = created.mode === 'custom'
      ? (created.customContent.trim().slice(0, 50) + (created.customContent.trim().length > 50 ? '…' : '')) || 'Custom Assignment'
      : created.topic

    const waMessage =
      `📚 *New Assignment — ${created.className}*\n\n` +
      `*Subject:* ${created.subject || 'Mixed'}\n` +
      `*Topic:* ${topicLine}\n` +
      `*Due:* ${formattedDate}\n\n` +
      `Students can access it at:\n` +
      `👉 edunexus.co.ke/learn\n\n` +
      `Please ensure your child completes it before the due date.\n` +
      `— EduNexus 🇰🇪`

    const waUrl = `https://wa.me/?text=${encodeURIComponent(waMessage)}`

    async function handleCopy() {
      await navigator.clipboard.writeText(waMessage)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }

    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center">
            <Check className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Assignment Created!</h1>
            <p className="text-gray-500 text-sm">Now let parents know via WhatsApp</p>
          </div>
        </div>

        {/* WhatsApp share card */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden mb-4">
          <div className="bg-[#25D366] px-5 py-3 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-white" />
            <span className="text-white font-black text-sm">Share with Parents via WhatsApp</span>
          </div>

          {/* Message preview */}
          <div className="px-5 py-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Message Preview</p>
            <div className="bg-[#ECF8F1] rounded-2xl rounded-tl-none px-4 py-3 text-sm text-gray-800 whitespace-pre-line font-mono leading-relaxed border border-green-100">
              {waMessage}
            </div>
          </div>

          {/* Buttons */}
          <div className="px-5 pb-5 grid grid-cols-2 gap-3">
            <button
              onClick={handleCopy}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 font-bold text-sm transition-all ${
                copied
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {copied
                ? <><Check className="w-4 h-4" /> Copied!</>
                : <><Copy className="w-4 h-4" /> Copy Message</>
              }
            </button>

            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#25D366] text-white font-bold text-sm hover:bg-[#1ebe5d] transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Share via WhatsApp
            </a>
          </div>
        </div>

        {/* Navigation actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/teacher/assignments/${created.id}`}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 transition-colors"
          >
            View Assignment <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/teacher/assignments/new"
            onClick={() => setCreated(null)}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gray-900 text-white font-bold text-sm hover:bg-gray-700 transition-colors"
          >
            <FileText className="w-4 h-4" /> New Assignment
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <Link
          href={planId ? `/teacher/lesson-plans/${planId}` : '/teacher/assignments'}
          className="text-sm text-gray-400 hover:text-gray-600 font-medium"
        >
          ← {planId ? 'Back to Lesson Plan' : 'Back to Assignments'}
        </Link>
        <h1 className="text-3xl font-black text-gray-900 mt-3">New Assignment</h1>
        <p className="text-gray-500">Create a new assignment for your students</p>
      </div>

      {planId && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <div>
            <p className="font-bold text-teal-800 text-sm">Pre-filled from Lesson Plan</p>
            <p className="text-teal-600 text-xs">{planSubject} — {planTopic}{planStrand ? ` · ${planStrand}` : ''}{planWeek ? ` · Week ${planWeek}` : ''}</p>
          </div>
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => {
            setAssignmentMode('kicd')
            setError('')
          }}
          className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm transition-all ${
            assignmentMode === 'kicd'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          📚 KICD Topic
        </button>
        <button
          type="button"
          onClick={() => {
            setAssignmentMode('custom')
            setError('')
          }}
          className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm transition-all ${
            assignmentMode === 'custom'
              ? 'bg-violet-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          ✏️ Custom / Mixed
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Title */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Fractions — Mixed Numbers Practice"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none text-gray-900"
              required
            />
          </div>

          {/* Class */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              Class <span className="text-red-500">*</span>
            </label>
            <select
              value={form.class_id}
              onChange={e => setForm(p => ({ ...p, class_id: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
              required
            >
              <option value="">Select a class...</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} (Grade {c.grade})</option>
              ))}
            </select>
          </div>

          {assignmentMode === 'kicd' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                {/* Subject */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  {(() => {
                    const cls = classes.find(c => c.id === form.class_id)
                    const grade = cls?.grade ?? 0
                    const subjects =
                      grade >= 7 && grade <= 9  ? CBC_JUNIOR_SUBJECTS  :
                      grade >= 10 && grade <= 12 ? CBC_SENIOR_SUBJECTS :
                      null
                    return subjects ? (
                      <select
                        value={form.subject}
                        onChange={e => {
                          setForm(p => ({ ...p, subject: e.target.value, topic: '' }))
                          setSubstrandId('')
                          setSubstrandSearch('')
                        }}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
                        required
                      >
                        <option value="">Select subject…</option>
                        {subjects.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={form.subject}
                        onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                        placeholder="e.g. Physics"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900"
                        required
                      />
                    )
                  })()}
                </div>

                {/* Topic / Substrand */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    Topic / Substrand <span className="text-red-500">*</span>
                  </label>

                  {substrandsLoading ? (
                    <div className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-400 text-sm flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      Loading KICD substrands…
                    </div>
                  ) : substrands.length > 0 ? (
                    <div className="relative" ref={dropdownRef}>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input
                          value={substrandSearch}
                          onChange={e => {
                            setSubstrandSearch(e.target.value)
                            setShowDropdown(true)
                            setSubstrandId('')
                            setForm(p => ({ ...p, topic: '' }))
                          }}
                          onFocus={() => setShowDropdown(true)}
                          placeholder="Search substrands…"
                          className={`w-full pl-9 pr-4 py-3 rounded-xl border outline-none text-gray-900 focus:ring-2 focus:ring-teal-100 ${
                            substrandId
                              ? 'border-teal-500 bg-teal-50'
                              : 'border-gray-200 focus:border-teal-500'
                          }`}
                          autoComplete="off"
                        />
                      </div>

                      {showDropdown && filteredSubstrands.length > 0 && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                          {filteredSubstrands.slice(0, 60).map(ss => (
                            <button
                              key={ss.id}
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => {
                                setForm(p => ({ ...p, topic: ss.title }))
                                setSubstrandId(ss.id)
                                setSubstrandSearch(ss.title)
                                setShowDropdown(false)
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-teal-50 transition-colors border-b border-gray-50 last:border-0"
                            >
                              <div className="text-sm font-medium text-gray-900 truncate">{ss.displayName}</div>
                              <div className="text-xs text-gray-400">{ss.strandTitle}</div>
                            </button>
                          ))}
                          {filteredSubstrands.length > 60 && (
                            <div className="px-4 py-2 text-xs text-gray-400 text-center italic">
                              {filteredSubstrands.length - 60} more — type to narrow
                            </div>
                          )}
                        </div>
                      )}

                      {substrandId && (
                        <p className="text-xs text-teal-600 mt-1 font-medium">✓ KICD substrand selected</p>
                      )}
                    </div>
                  ) : (
                    <input
                      value={form.topic}
                      onChange={e => setForm(p => ({ ...p, topic: e.target.value }))}
                      placeholder="e.g. Mixed Fractions"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900"
                      required
                    />
                  )}
                </div>
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  Instructions for Students <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.instructions}
                  onChange={e => setForm(p => ({ ...p, instructions: e.target.value }))}
                  placeholder="Describe what students should do..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none text-gray-900 resize-none"
                  required
                />
              </div>
            </>
          ) : (
            <>
              {/* Custom mode: optional subject + assignment content */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  Subject <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  value={form.subject}
                  onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                  placeholder="e.g. Integrated Science, Mixed"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 outline-none text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  Assignment Content <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.instructions}
                  onChange={e => setForm(p => ({ ...p, instructions: e.target.value }))}
                  placeholder={`Describe what students should cover, or paste your questions directly.\n\nExample:\n1. Define an ecosystem\n2. List 3 biotic factors\n3. Explain food chains and webs\n\nOr simply: 'Revise all topics covered this term in Integrated Science'`}
                  rows={8}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 outline-none text-gray-900 resize-none"
                  required
                />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Due date */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                Due Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.due_date}
                min={minDate}
                onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900"
                required
              />
            </div>
            {/* Type */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Type</label>
              <select
                value={form.type}
                onChange={e => setForm(p => ({ ...p, type: e.target.value as 'practice' | 'graded' | 'exam' }))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
              >
                <option value="practice">Practice</option>
                <option value="graded">Graded</option>
                <option value="exam">Exam</option>
              </select>
            </div>
          </div>

          {/* Max score (only for graded/exam) */}
          {(form.type === 'graded' || form.type === 'exam') && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Max Score</label>
              <input
                type="number"
                value={form.max_score}
                onChange={e => setForm(p => ({ ...p, max_score: Number(e.target.value) }))}
                min={1}
                max={200}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900"
              />
            </div>
          )}

          {/* Compass Guided toggle */}
          <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center">
                  <Compass className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-black text-gray-900 text-sm">Compass Guided</div>
                  <div className="text-xs text-gray-500">
                    Compass delivers assignment Socratically & tracks performance
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForm(p => ({ ...p, is_compass_guided: !p.is_compass_guided }))}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  form.is_compass_guided ? 'bg-teal-600' : 'bg-gray-200'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                  form.is_compass_guided ? 'left-7' : 'left-1'
                }`} />
              </button>
            </div>
            {form.is_compass_guided && (
              <p className="text-xs text-teal-700 mt-3">
                ✅ Students click "Start with Compass 🧭" and Compass guides them Socratically.
                Performance is automatically summarized for marking.
              </p>
            )}
          </div>

          {/* Holiday Assignment toggle */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                  <Home className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-black text-gray-900 text-sm">Holiday Assignment</div>
                  <div className="text-xs text-gray-500">
                    Mark this as a holiday assignment — students see it tagged
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForm(p => ({ ...p, is_holiday_assignment: !p.is_holiday_assignment, holiday_period: !p.is_holiday_assignment ? p.holiday_period : '' }))}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  form.is_holiday_assignment ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                  form.is_holiday_assignment ? 'left-7' : 'left-1'
                }`} />
              </button>
            </div>
            {form.is_holiday_assignment && (
              <div className="mt-3">
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Holiday Period (optional)
                </label>
                <input
                  type="text"
                  value={form.holiday_period}
                  onChange={e => setForm(p => ({ ...p, holiday_period: e.target.value }))}
                  placeholder="e.g. August 2026 Holidays"
                  className="w-full px-3 py-2.5 rounded-xl border border-blue-200 focus:border-blue-500 outline-none text-gray-900 bg-white"
                />
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-teal-600 to-blue-600 text-white py-4 rounded-xl font-black text-lg hover:from-teal-700 hover:to-blue-700 transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-60"
          >
            {loading
              ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><FileText className="w-5 h-5" /> Create Assignment <ChevronRight className="w-5 h-5" /></>
            }
          </button>
        </form>
      </div>
    </div>
  )
}

export default function NewAssignmentPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><span className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <NewAssignmentForm />
    </Suspense>
  )
}
