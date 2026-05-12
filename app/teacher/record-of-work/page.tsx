'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ClipboardList, Plus, BookOpen, Calendar, ChevronRight,
  Loader2, Trash2, AlertTriangle, Sparkles, ArrowRight,
  CheckCircle2, Clock, GraduationCap,
} from 'lucide-react'

interface ROWRecord {
  id: string
  school: string
  grade: string
  learning_area: string
  term: string
  year: number
  curriculum_mode: string | null
  teacher_name: string
  scheme_id: string | null
  created_at: string
  total_entries: number
  completed_entries: number
}

interface SavedScheme {
  id: string
  grade: string
  learning_area: string
  term: string
  year: number
  curriculum_mode: string
  total_lessons: number
  school: string
}

const TERM_COLORS: Record<string, string> = {
  '1': 'from-teal-500 to-emerald-500',
  '2': 'from-indigo-500 to-violet-500',
  '3': 'from-rose-500 to-pink-500',
}

export default function RecordOfWorkListPage() {
  const [records, setRecords]     = useState<ROWRecord[]>([])
  const [schemes, setSchemes]     = useState<SavedScheme[]>([])
  const [loading, setLoading]     = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating]   = useState(false)
  const [deleteId, setDeleteId]   = useState<string | null>(null)

  // Create form state
  const [fromScheme, setFromScheme] = useState<'scheme' | 'manual'>('scheme')
  const [selectedSchemeId, setSelectedSchemeId] = useState('')
  const [manualGrade, setManualGrade]       = useState('')
  const [manualSubject, setManualSubject]   = useState('')
  const [manualTerm, setManualTerm]         = useState('1')
  const [manualYear, setManualYear]         = useState(new Date().getFullYear())
  const [manualSchool, setManualSchool]     = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/teacher/records-of-work').then(r => r.json()),
      fetch('/api/sow/list').then(r => r.json()),
    ]).then(([rowData, sowData]) => {
      if (rowData.success)  setRecords(rowData.data.records || [])
      if (sowData.success)  setSchemes(sowData.data.schemes || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function handleCreate() {
    setCreating(true)
    let payload: any

    if (fromScheme === 'scheme' && selectedSchemeId) {
      const scheme = schemes.find(s => s.id === selectedSchemeId)!
      payload = {
        schemeId:       selectedSchemeId,
        school:         scheme.school,
        grade:          scheme.grade,
        learningArea:   scheme.learning_area,
        term:           scheme.term,
        year:           scheme.year,
        curriculumMode: scheme.curriculum_mode,
      }
    } else {
      payload = {
        school:       manualSchool,
        grade:        manualGrade,
        learningArea: manualSubject,
        term:         manualTerm,
        year:         manualYear,
      }
    }

    try {
      const res  = await fetch('/api/teacher/records-of-work', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (data.success) {
        window.location.href = `/teacher/record-of-work/${data.data.rowId}`
      }
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/teacher/records-of-work/${id}`, { method: 'DELETE' })
    setRecords(prev => prev.filter(r => r.id !== id))
    setDeleteId(null)
  }

  const inputCls = 'w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-gray-900 transition text-sm'

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Hero */}
      <div className="bg-[#0c1929] relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute top-0 right-1/3 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-900/40">
                <ClipboardList className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white leading-tight">
                  Record of <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-300">Work</span>
                </h1>
                <p className="text-slate-400 text-xs mt-0.5 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  KICD aligned · CBC &amp; 8-4-4 · Kenya
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-5 py-2.5 rounded-xl font-black text-sm hover:opacity-90 transition shadow-lg shadow-teal-900/30"
            >
              <Plus className="w-4 h-4" /> New Record
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
            {[
              { label: 'Records',        value: records.length,                              icon: ClipboardList, grad: 'from-indigo-500 to-violet-500' },
              { label: 'Lessons Done',   value: records.reduce((s,r) => s + r.completed_entries, 0), icon: CheckCircle2, grad: 'from-teal-500 to-emerald-500' },
              { label: 'In Progress',    value: records.filter(r => r.completed_entries > 0 && r.completed_entries < r.total_entries).length, icon: Clock, grad: 'from-amber-500 to-orange-500' },
            ].map((s, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${s.grad} flex items-center justify-center mb-2 shadow-md`}>
                  <s.icon className="w-4 h-4 text-white" />
                </div>
                <div className="text-2xl font-black text-white">{s.value}</div>
                <div className="text-xs text-slate-400 font-medium mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-20 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm font-medium">Loading records...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-14 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-black text-gray-700 mb-2">No Records of Work Yet</h3>
            <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">
              Create your first Record of Work from a saved Scheme of Work, or start a new one manually.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-500 text-white px-6 py-3 rounded-xl font-black text-sm hover:opacity-90 transition shadow-lg shadow-teal-900/20"
            >
              <Plus className="w-4 h-4" /> Create First Record
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {records.map(record => {
              const pct = record.total_entries > 0 ? Math.round((record.completed_entries / record.total_entries) * 100) : 0
              const grad = TERM_COLORS[record.term] || 'from-indigo-500 to-violet-500'
              return (
                <div key={record.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden group">
                  <div className={`h-1.5 bg-gradient-to-r ${grad}`} />
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shrink-0 shadow-sm`}>
                          <ClipboardList className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="font-black text-gray-900 text-sm leading-tight">{record.learning_area}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{record.grade}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => setDeleteId(record.id)}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-400 hover:text-red-600 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">Term {record.term}</span>
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">{record.year}</span>
                      {record.scheme_id && (
                        <span className="text-xs bg-teal-50 text-teal-700 border border-teal-100 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" /> From SOW
                        </span>
                      )}
                    </div>

                    {record.total_entries > 0 ? (
                      <div className="mb-4">
                        <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                          <span>Progress</span>
                          <span className="font-bold text-gray-600">{record.completed_entries}/{record.total_entries} lessons</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full bg-gradient-to-r ${grad} transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="text-right text-xs text-gray-400 mt-1 font-bold">{pct}%</div>
                      </div>
                    ) : (
                      <div className="mb-4 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-xs text-amber-700 font-medium">
                        No lesson entries yet — open to add manually
                      </div>
                    )}

                    <Link
                      href={`/teacher/record-of-work/${record.id}`}
                      className={`flex items-center justify-center gap-2 w-full bg-gradient-to-r ${grad} text-white px-4 py-2.5 rounded-xl font-black text-sm hover:opacity-90 transition shadow-sm`}
                    >
                      Open Record <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-gradient-to-br from-[#0c1929] to-slate-800 px-6 py-5">
              <h2 className="text-white font-black text-lg">New Record of Work</h2>
              <p className="text-slate-400 text-xs mt-0.5">Link to a saved scheme or start manually</p>
            </div>

            <div className="p-6 space-y-5">
              {/* Source toggle */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 rounded-2xl p-1.5">
                {(['scheme', 'manual'] as const).map(mode => (
                  <button key={mode} onClick={() => setFromScheme(mode)}
                    className={`py-2.5 rounded-xl text-sm font-black transition-all ${fromScheme === mode ? 'bg-white shadow text-gray-900' : 'text-slate-500 hover:text-gray-700'}`}>
                    {mode === 'scheme' ? '📋 From Scheme of Work' : '✏️ Manual Entry'}
                  </button>
                ))}
              </div>

              {fromScheme === 'scheme' ? (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Select a saved Scheme</label>
                  {schemes.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                      <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                      <p className="text-amber-700 text-sm font-bold">No saved schemes yet</p>
                      <p className="text-amber-600 text-xs mt-0.5">Generate and save a Scheme of Work first, or use manual entry.</p>
                    </div>
                  ) : (
                    <select value={selectedSchemeId} onChange={e => setSelectedSchemeId(e.target.value)} className={inputCls}>
                      <option value="">Choose a scheme...</option>
                      {schemes.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.grade} · {s.learning_area} · Term {s.term} {s.year} ({s.total_lessons} lessons)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Grade / Form</label>
                      <input value={manualGrade} onChange={e => setManualGrade(e.target.value)} placeholder="e.g. Grade 8" className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Subject</label>
                      <input value={manualSubject} onChange={e => setManualSubject(e.target.value)} placeholder="e.g. Mathematics" className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Term</label>
                      <select value={manualTerm} onChange={e => setManualTerm(e.target.value)} className={inputCls}>
                        <option value="1">Term 1</option>
                        <option value="2">Term 2</option>
                        <option value="3">Term 3</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Year</label>
                      <select value={manualYear} onChange={e => setManualYear(Number(e.target.value))} className={inputCls}>
                        {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">School</label>
                      <input value={manualSchool} onChange={e => setManualSchool(e.target.value)} placeholder="e.g. Nairobi Academy" className={inputCls} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 rounded-xl border border-slate-200 text-gray-600 font-bold text-sm hover:bg-slate-50 transition">
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || (fromScheme === 'scheme' && !selectedSchemeId) || (fromScheme === 'manual' && (!manualGrade || !manualSubject))}
                className="flex items-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-500 text-white px-6 py-2.5 rounded-xl font-black text-sm hover:opacity-90 transition disabled:opacity-40 shadow-md shadow-teal-900/20"
              >
                {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><ArrowRight className="w-4 h-4" /> Create Record</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="font-black text-gray-900 text-lg mb-2">Delete Record?</h3>
            <p className="text-gray-500 text-sm mb-6">This will permanently delete the record and all lesson entries.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-3 rounded-xl border border-slate-200 font-bold text-gray-600 hover:bg-slate-50 transition text-sm">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-black text-sm hover:bg-red-700 transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
