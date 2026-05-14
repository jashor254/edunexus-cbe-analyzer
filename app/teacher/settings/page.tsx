'use client'

import { useState, useEffect } from 'react'
import { Save, CheckCircle2, User, School, Phone, BadgeCheck, Trophy, Calendar, Hash } from 'lucide-react'

const SUBJECTS = [
  'Mathematics','English','Kiswahili','Integrated Science','Geography',
  'History & Citizenship','Business Studies','Agriculture and Nutrition',
  'Creative Arts & Sports','Pre-Technical Studies','Social Studies',
  'Christian Religious Education','Islamic Religious Education','All Subjects',
]
const GRADES = [7, 8, 9, 10, 11, 12]

// CBC curriculum: which grades each subject is taught in
const SUBJECT_GRADES: Record<string, number[]> = {
  'Mathematics':                    [7, 8, 9, 10, 11, 12],
  'English':                        [7, 8, 9, 10, 11, 12],
  'Kiswahili':                      [7, 8, 9, 10, 11, 12],
  'Christian Religious Education':  [7, 8, 9, 10, 11, 12],
  'Islamic Religious Education':    [7, 8, 9, 10, 11, 12],
  'All Subjects':                   [7, 8, 9, 10, 11, 12],
  // Junior Secondary only (Grade 7–9)
  'Integrated Science':             [7, 8, 9],
  'Social Studies':                 [7, 8, 9],
  'Pre-Technical Studies':          [7, 8, 9],
  'Agriculture and Nutrition':      [7, 8, 9],
  'Creative Arts & Sports':         [7, 8, 9],
  // Senior Secondary only (Grade 10–12)
  'Geography':                      [10, 11, 12],
  'History & Citizenship':          [10, 11, 12],
  'Business Studies':               [10, 11, 12],
}

type TeacherProfile = {
  id: string
  full_name: string
  school: string
  subject: string | null
  grade_levels: number[]
  phone: string | null
  tsc_number: string | null
  is_verified: boolean
  pioneer_number: number | null
  created_at: string
}

export default function TeacherProfilePage() {
  const [profile, setProfile]   = useState<TeacherProfile | null>(null)
  const [form, setForm]         = useState({
    full_name: '', school: '', subject: '', phone: '', tsc_number: '', grade_levels: [] as number[],
  })
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    fetch('/api/teacher/profile')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.teacher) {
          const t: TeacherProfile = d.data.teacher
          setProfile(t)
          setForm({
            full_name:   t.full_name         || '',
            school:      t.school            || '',
            subject:     t.subject           || '',
            phone:       t.phone             || '',
            tsc_number:  t.tsc_number        || '',
            grade_levels: t.grade_levels     || [7, 8, 9, 10, 11, 12],
          })
        }
      })
      .catch(() => setError('Could not load profile.'))
      .finally(() => setLoading(false))
  }, [])

  function toggleGrade(g: number) {
    setForm(prev => ({
      ...prev,
      grade_levels: prev.grade_levels.includes(g)
        ? prev.grade_levels.filter(x => x !== g)
        : [...prev.grade_levels, g].sort((a, b) => a - b),
    }))
  }

  function handleSubjectChange(subject: string) {
    const suggested = SUBJECT_GRADES[subject]
    setForm(prev => ({
      ...prev,
      subject,
      // Auto-set grades only when the suggested set is more specific than current
      grade_levels: suggested ?? prev.grade_levels,
    }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/teacher/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (!d.success) { setError(d.error || 'Failed to save'); return }
      setProfile(d.data?.teacher ?? profile)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <span className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })
    : null

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">My Profile</h1>
        <p className="text-gray-500 text-sm mt-1">Update your details — this appears on all your documents</p>
      </div>

      {/* Stats bar */}
      {profile && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {profile.pioneer_number && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-amber-600 font-bold">Pioneer</p>
                <p className="text-lg font-black text-amber-800">#{profile.pioneer_number}</p>
              </div>
            </div>
          )}
          {memberSince && (
            <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <p className="text-xs text-teal-600 font-bold">Member since</p>
                <p className="text-sm font-black text-teal-800">{memberSince}</p>
              </div>
            </div>
          )}
          {profile.is_verified && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                <BadgeCheck className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-blue-600 font-bold">Status</p>
                <p className="text-sm font-black text-blue-800">Verified</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Form card */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-teal-600 to-blue-600 px-6 py-4">
          <h2 className="text-white font-black text-base">Personal Information</h2>
          <p className="text-teal-100 text-xs mt-0.5">Shown on SOW, lesson plans and records of work</p>
        </div>

        <form onSubmit={save} className="p-6 space-y-5">

          {/* Name + School */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-gray-400" /> Full Name <span className="text-red-500">*</span>
              </label>
              <input
                value={form.full_name}
                onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                placeholder="e.g. Mwalimu Kamau Njoroge"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none text-gray-900 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <School className="w-3.5 h-3.5 text-gray-400" /> School Name <span className="text-red-500">*</span>
              </label>
              <input
                value={form.school}
                onChange={e => setForm(p => ({ ...p, school: e.target.value }))}
                placeholder="e.g. Nairobi Academy"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none text-gray-900 text-sm"
                required
              />
            </div>
          </div>

          {/* TSC + Phone */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-gray-400" /> TSC Number
                <span className="text-xs text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                value={form.tsc_number}
                onChange={e => setForm(p => ({ ...p, tsc_number: e.target.value }))}
                placeholder="e.g. 0123456"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none text-gray-900 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-gray-400" /> Phone
                <span className="text-xs text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                value={form.phone}
                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="e.g. 0712 345 678"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none text-gray-900 text-sm"
              />
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Primary Subject</label>
            <select
              value={form.subject}
              onChange={e => handleSubjectChange(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none text-gray-900 bg-white text-sm"
            >
              <option value="">Select your main subject...</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {form.subject && SUBJECT_GRADES[form.subject] && (
              <p className="text-xs text-teal-600 mt-1.5 font-medium">
                ✓ Grade levels auto-set for {form.subject} ({SUBJECT_GRADES[form.subject].join(', ')})
              </p>
            )}
          </div>

          {/* Grade levels */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Grade Levels You Teach</label>
            <div className="flex flex-wrap gap-2">
              {GRADES.map(g => (
                <button
                  key={g} type="button" onClick={() => toggleGrade(g)}
                  className={`w-12 h-12 rounded-xl font-black text-sm transition-all border ${
                    form.grade_levels.includes(g)
                      ? 'bg-teal-600 text-white border-teal-600 shadow-md scale-105'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-teal-300 hover:bg-teal-50'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">Controls which grades appear in the SOW builder · tap to adjust</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !form.full_name.trim() || !form.school.trim()}
            className="w-full bg-gradient-to-r from-teal-600 to-blue-600 text-white py-3.5 rounded-xl font-black hover:from-teal-700 hover:to-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saved
              ? <><CheckCircle2 className="w-5 h-5" /> Saved!</>
              : saving
              ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><Save className="w-5 h-5" /> Save Changes</>
            }
          </button>
        </form>
      </div>
    </div>
  )
}
