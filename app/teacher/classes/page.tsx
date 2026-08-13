'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  BookOpen, PlusCircle, Users, ChevronRight, Copy, Check, X,
} from 'lucide-react'
import { friendlyMessage } from '@/lib/errors/friendlyMessage'
import { getStandingLabel, getStandingColorClasses } from '@/lib/teacherWorkspace/standing'

const levelLabel = (avg: number) => getStandingLabel(avg, 'short')
const levelColor = (avg: number) => getStandingColorClasses(avg).badge

const SUBJECTS = [
  'Mathematics','English','Kiswahili','Integrated Science','Geography',
  'History & Citizenship','Business Studies','Agriculture',
  'Creative Arts & Sports','Pre-Technical Studies','All Subjects',
]

interface TeacherClass {
  id: string
  name: string
  grade: number
  subject: string
  academic_year: string
  class_code: string
  student_count: number
  avg_level: number | null
}

/**
 * Which workspace this teacher is in, from the canonical institutional read
 * (`GET /api/teacher/teaching-assignments`). Only the discriminant is needed
 * here — this screen lists LEGACY `teacher_classes`, and the context decides
 * how honestly to frame them, not what to list.
 */
type ContextKind = 'school' | 'school_unassigned' | 'solo' | null

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [contextKind, setContextKind] = useState<ContextKind>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [newClass, setNewClass] = useState({
    name: '', grade: 7, subject: 'Mathematics', academic_year: '2025', stream: '',
  })
  const [hasStream, setHasStream] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Two independent reads, deliberately not merged: this page lists the
    // teacher's own legacy `teacher_classes`, while the context comes from
    // Core `class_subjects`. Merging them would let a private class stand in
    // for an institutional assignment, which is precisely what this
    // convergence exists to stop. The context only reframes the page.
    Promise.all([
      fetch('/api/teacher/classes')
        .then(r => r.json())
        .then(d => { if (d.success) setClasses(d.data.classes) })
        .catch(() => {}),
      fetch('/api/teacher/teaching-assignments')
        .then(r => r.json())
        .then(d => { if (d.data?.kind) setContextKind(d.data.kind) })
        // A failed context read must not decide the teacher is a Solo
        // Teacher — it leaves `contextKind` null, which shows the neutral
        // legacy framing rather than asserting something unproven.
        .catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  // A school teacher's institutional classes are assigned by their
  // administrator and shown on the dashboard's My Teaching panel. Creating a
  // class here would make a private one the school does not know about, so
  // the create action stays available to Solo Teachers — whose private
  // planning workspace this genuinely is — and is withdrawn from school
  // teachers.
  //
  // This is presentation-level clarity, not the safety boundary. The route
  // itself no longer provisions a school for anyone
  // (resolveExistingOwningSchool), so a private class created by a teacher
  // with no membership is simply school-less rather than the seed of a
  // fictional institution.
  const isSchoolTeacher = contextKind === 'school' || contextKind === 'school_unassigned'

  async function createClass(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCreating(true)
    try {
      const res = await fetch('/api/teacher/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newClass, stream: hasStream ? newClass.stream : undefined }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error || 'Failed to create class'); return }
      setClasses(prev => [{ ...data.data.class, student_count: 0, avg_level: null }, ...prev])
      setShowModal(false)
      setHasStream(false)
      setNewClass({ name: '', grade: 7, subject: 'Mathematics', academic_year: '2025', stream: '' })
    } catch {
      setError('Something went wrong.')
    } finally {
      setCreating(false)
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
            {isSchoolTeacher ? 'My Own Classes' : 'My Classes'}
          </h1>
          <p className="text-gray-500 mt-1">
            {isSchoolTeacher
              ? 'Private classes you created. Classes assigned to you by your school appear under My Teaching.'
              : 'Manage your classes and share codes with parents'}
          </p>
        </div>
        {!isSchoolTeacher && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center justify-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-teal-700 transition shadow-sm sm:self-auto self-start"
          >
            <PlusCircle className="w-4 h-4" /> Create Class
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <span className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          {isSchoolTeacher ? (
            // Phase 19 — a school teacher is never told to "create your first
            // class." Building the school's teaching structure is the
            // administrator's responsibility, not theirs.
            <>
              <h3 className="text-xl font-black text-gray-600 mb-2">No private classes</h3>
              <p className="text-gray-400 max-w-md mx-auto">
                The classes and subjects your school has assigned to you appear under
                My Teaching on your dashboard. If nothing is listed there yet, contact
                your school administrator.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-xl font-black text-gray-600 mb-2">No classes yet</h3>
              <p className="text-gray-400 mb-6">Create your first class and share the code with parents</p>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 transition"
              >
                <PlusCircle className="w-4 h-4" /> Create First Class
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {classes.map((cls) => (
            <div key={cls.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-black text-gray-900">{cls.name}</h3>
                  <p className="text-sm text-gray-500">Grade {cls.grade} · {cls.academic_year}</p>
                </div>
                {cls.avg_level !== null && (
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${levelColor(cls.avg_level)}`}>
                    {levelLabel(cls.avg_level)}
                  </span>
                )}
              </div>

              {/* Class code with copy */}
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 mb-4">
                <span className="text-xs text-gray-500 font-medium">Code:</span>
                <span className="font-mono font-black text-gray-800 text-sm flex-1">{cls.class_code}</span>
                <button
                  onClick={() => copyCode(cls.class_code)}
                  className="text-gray-400 hover:text-teal-600 transition"
                  title="Copy code"
                >
                  {copiedCode === cls.class_code
                    ? <Check className="w-4 h-4 text-green-500" />
                    : <Copy className="w-4 h-4" />
                  }
                </button>
              </div>

              <div className="flex items-center gap-3 text-sm text-gray-500 mb-4">
                <Users className="w-4 h-4" />
                <span>{cls.student_count} student{cls.student_count !== 1 ? 's' : ''}</span>
                {cls.avg_level !== null && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span>Avg: {cls.avg_level}/4</span>
                  </>
                )}
              </div>

              {cls.avg_level !== null && (
                <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                  <div
                    className={`h-2 rounded-full ${getStandingColorClasses(cls.avg_level).bar}`}
                    style={{ width: `${(cls.avg_level / 4) * 100}%` }}
                  />
                </div>
              )}

              <div className="flex gap-2">
                <Link
                  href={`/teacher/classes/${cls.id}`}
                  className="flex-1 flex items-center justify-center gap-2 text-sm text-teal-700 border border-teal-200 bg-teal-50 px-4 py-2.5 rounded-xl font-bold hover:bg-teal-100 transition"
                >
                  View Class <ChevronRight className="w-4 h-4" />
                </Link>
                <Link
                  href={`/teacher/gradebook/${cls.id}`}
                  className="flex items-center justify-center gap-2 text-sm text-gray-700 border border-gray-200 bg-gray-50 px-4 py-2.5 rounded-xl font-bold hover:bg-gray-100 transition"
                >
                  Gradebook
                </Link>
                <Link
                  href={`/teacher/resources/${cls.id}`}
                  className="flex items-center justify-center gap-2 text-sm text-gray-700 border border-gray-200 bg-gray-50 px-4 py-2.5 rounded-xl font-bold hover:bg-gray-100 transition"
                >
                  Resources
                </Link>
                <Link
                  href={`/teacher/calendar/${cls.id}`}
                  className="flex items-center justify-center gap-2 text-sm text-gray-700 border border-gray-200 bg-gray-50 px-4 py-2.5 rounded-xl font-bold hover:bg-gray-100 transition"
                >
                  Calendar
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Class Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-black text-gray-900">Create New Class</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={createClass} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Class Name *</label>
                <input
                  value={newClass.name}
                  onChange={e => setNewClass(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. 8B Mathematics"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none text-gray-900"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Grade *</label>
                  <select
                    value={newClass.grade}
                    onChange={e => setNewClass(p => ({ ...p, grade: Number(e.target.value) }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
                  >
                    {[7,8,9,10,11,12].map(g => <option key={g} value={g}>Grade {g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Year *</label>
                  <select
                    value={newClass.academic_year}
                    onChange={e => setNewClass(p => ({ ...p, academic_year: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
                  >
                    {['2024','2025','2026'].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Subject *</label>
                <select
                  value={newClass.subject}
                  onChange={e => setNewClass(p => ({ ...p, subject: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
                >
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Stream toggle */}
              <div className="flex items-center gap-3 py-1">
                <button
                  type="button"
                  onClick={() => { setHasStream(v => !v); setNewClass(p => ({ ...p, stream: '' })) }}
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${hasStream ? 'bg-teal-600' : 'bg-gray-200'}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${hasStream ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                <span className="text-sm font-medium text-gray-700">This class has a stream (e.g. 9Y, 9G)</span>
              </div>

              {hasStream && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Stream Name *</label>
                  <input
                    value={newClass.stream}
                    onChange={e => setNewClass(p => ({ ...p, stream: e.target.value }))}
                    placeholder="e.g. Y, G, A, North, South"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none text-gray-900"
                    required={hasStream}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Grade {newClass.grade}{newClass.stream ? newClass.stream : '?'} will be grouped with other Grade {newClass.grade} streams in analytics
                  </p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                  {friendlyMessage(error).message}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {creating
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : 'Create Class'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
