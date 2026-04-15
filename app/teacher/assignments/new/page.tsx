'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { FileText, ChevronRight, Compass, Home } from 'lucide-react'

function NewAssignmentForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefillClassId = searchParams.get('classId') || ''

  const [classes, setClasses] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
  })

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

  // Auto-fill subject from selected class
  useEffect(() => {
    const cls = classes.find((c: any) => c.id === form.class_id)
    if (cls && !form.subject) {
      setForm(p => ({ ...p, subject: cls.subject }))
    }
  }, [form.class_id, classes])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.class_id) { setError('Please select a class'); return }
    if (!form.due_date) { setError('Due date is required'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/teacher/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error || 'Failed to create assignment'); return }
      router.push(`/teacher/assignments/${data.data.assignment.id}`)
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  // Min date = today
  const minDate = new Date().toISOString().split('T')[0]

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <Link href="/teacher/assignments" className="text-sm text-gray-400 hover:text-gray-600 font-medium">
          ← Back to Assignments
        </Link>
        <h1 className="text-3xl font-black text-gray-900 mt-3">New Assignment</h1>
        <p className="text-gray-500">Create a new assignment for your students</p>
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
              {classes.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} (Grade {c.grade})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Subject */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                Subject <span className="text-red-500">*</span>
              </label>
              <input
                value={form.subject}
                onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                placeholder="e.g. Mathematics"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900"
                required
              />
            </div>
            {/* Topic */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                Topic <span className="text-red-500">*</span>
              </label>
              <input
                value={form.topic}
                onChange={e => setForm(p => ({ ...p, topic: e.target.value }))}
                placeholder="e.g. Mixed Fractions"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900"
                required
              />
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
                onChange={e => setForm(p => ({ ...p, type: e.target.value as any }))}
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
