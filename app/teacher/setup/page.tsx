'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap, School, BookOpen, Phone, ChevronRight, CheckCircle2 } from 'lucide-react'

const SUBJECTS = [
  'Mathematics',
  'English',
  'Kiswahili',
  'Integrated Science',
  'Geography',
  'History & Citizenship',
  'Business Studies',
  'Agriculture',
  'Creative Arts & Sports',
  'Pre-Technical Studies',
  'All Subjects',
]

const GRADES = [7, 8, 9, 10, 11, 12]

export default function TeacherSetupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    full_name: '',
    school: '',
    subject: '',
    grade_levels: [7, 8, 9, 10, 11, 12] as number[],
    phone: '',
  })

  function toggleGrade(g: number) {
    setForm(prev => ({
      ...prev,
      grade_levels: prev.grade_levels.includes(g)
        ? prev.grade_levels.filter(x => x !== g)
        : [...prev.grade_levels, g].sort((a, b) => a - b),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.full_name.trim() || !form.school.trim()) {
      setError('Full name and school are required.')
      return
    }
    if (form.grade_levels.length === 0) {
      setError('Please select at least one grade level.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/teacher/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.error || 'Failed to save profile')
        return
      }

      router.push('/teacher/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-2">
            Set Up Your Teacher Account
          </h1>
          <p className="text-gray-500">
            Free forever — built for Kenyan CBC teachers
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            {['Class management', 'Student insights', 'KNEC CBA export'].map(f => (
              <span key={f} className="flex items-center gap-1 text-xs text-teal-700 bg-teal-50 border border-teal-200 px-3 py-1 rounded-full font-semibold">
                <CheckCircle2 className="w-3 h-3" /> {f}
              </span>
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Full Name */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.full_name}
                onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                placeholder="e.g. Mwalimu Kamau Njoroge"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition text-gray-900 placeholder-gray-400"
                required
              />
            </div>

            {/* School */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                <School className="w-4 h-4 inline mr-1" />
                School Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.school}
                onChange={e => setForm(p => ({ ...p, school: e.target.value }))}
                placeholder="e.g. Nairobi Academy"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition text-gray-900 placeholder-gray-400"
                required
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                <BookOpen className="w-4 h-4 inline mr-1" />
                Primary Subject
              </label>
              <select
                value={form.subject}
                onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition text-gray-900 bg-white"
              >
                <option value="">Select subject...</option>
                {SUBJECTS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Grade levels */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">
                Grade Levels You Teach
              </label>
              <div className="flex flex-wrap gap-2">
                {GRADES.map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGrade(g)}
                    className={`w-12 h-12 rounded-xl font-bold text-sm transition-all ${
                      form.grade_levels.includes(g)
                        ? 'bg-teal-600 text-white shadow-md scale-105'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Selected: Grade {form.grade_levels.join(', ')}
              </p>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                <Phone className="w-4 h-4 inline mr-1" />
                Phone Number
                <span className="text-gray-400 font-normal ml-1">(optional)</span>
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="e.g. 0712 345 678"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition text-gray-900 placeholder-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1">
                Used in parent WhatsApp messages (your contact for queries)
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-teal-600 to-blue-600 text-white py-4 rounded-xl font-black text-lg hover:from-teal-700 hover:to-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-60"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Set Up My Dashboard
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-400 text-sm mt-6">
          Teacher accounts are always free. No credit card needed.
        </p>
      </div>
    </div>
  )
}
