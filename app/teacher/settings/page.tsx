'use client'

import { useState, useEffect } from 'react'
import { Save, CheckCircle2 } from 'lucide-react'

const SUBJECTS = [
  'Mathematics','English','Kiswahili','Integrated Science','Geography',
  'History & Citizenship','Business Studies','Agriculture',
  'Creative Arts & Sports','Pre-Technical Studies','All Subjects',
]
const GRADES = [7,8,9,10,11,12]

export default function TeacherSettingsPage() {
  const [form, setForm] = useState({ full_name: '', school: '', subject: '', phone: '', grade_levels: [] as number[] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/teacher/profile')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data.teacher) {
          const t = d.data.teacher
          setForm({
            full_name:    t.full_name   || '',
            school:       t.school      || '',
            subject:      t.subject     || '',
            phone:        t.phone       || '',
            grade_levels: t.grade_levels || [7,8,9,10,11,12],
          })
        }
      })
      .finally(() => setLoading(false))
  }, [])

  function toggleGrade(g: number) {
    setForm(prev => ({
      ...prev,
      grade_levels: prev.grade_levels.includes(g)
        ? prev.grade_levels.filter(x => x !== g)
        : [...prev.grade_levels, g].sort((a,b) => a-b),
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
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><span className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-black text-gray-900 mb-2">Settings</h1>
      <p className="text-gray-500 mb-8">Update your teacher profile</p>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
        <form onSubmit={save} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Full Name *</label>
            <input value={form.full_name} onChange={e => setForm(p => ({...p, full_name: e.target.value}))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900" required />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">School *</label>
            <input value={form.school} onChange={e => setForm(p => ({...p, school: e.target.value}))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900" required />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Primary Subject</label>
            <select value={form.subject} onChange={e => setForm(p => ({...p, subject: e.target.value}))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white">
              <option value="">Select...</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Grade Levels You Teach</label>
            <div className="flex flex-wrap gap-2">
              {GRADES.map(g => (
                <button key={g} type="button" onClick={() => toggleGrade(g)}
                  className={`w-12 h-12 rounded-xl font-bold text-sm transition-all ${
                    form.grade_levels.includes(g) ? 'bg-teal-600 text-white shadow scale-105' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>{g}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Phone (optional)</label>
            <input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))}
              placeholder="0712 345 678"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900" />
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}
          <button type="submit" disabled={saving}
            className="w-full bg-teal-600 text-white py-3.5 rounded-xl font-black hover:bg-teal-700 transition flex items-center justify-center gap-2 disabled:opacity-60">
            {saved ? <><CheckCircle2 className="w-5 h-5" /> Saved!</>
              : saving ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><Save className="w-5 h-5" /> Save Changes</>
            }
          </button>
        </form>
      </div>
    </div>
  )
}
