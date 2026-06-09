'use client'

import { useState, useEffect, useRef, useCallback, use } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft,
  Loader2,
  Download,
  GraduationCap,
  Check,
  CalendarCheck,
  Sparkles,
  ClipboardList,
  Printer,
} from 'lucide-react'
import type { LessonPlanRecord } from '@/lib/lessonPlan/types'

interface SOWMeta {
  school: string
  grade: string
  learning_area: string
  term: string
  year: number
  teacher_name: string | null
  tsc_number: string | null
}

const SECTIONS: Array<{
  key: keyof LessonPlanRecord
  label: string
  hint?: string
}> = [
  { key: 'organisation_of_learning', label: 'Organisation of Learning' },
  { key: 'introduction',             label: 'Introduction / Getting Started (5 mins)', hint: 'Set induction — link to prior learning' },
  { key: 'step_1',                   label: 'Step 1 — Guided Discovery (10 mins)' },
  { key: 'step_2',                   label: 'Step 2 — Group Activity (10 mins)' },
  { key: 'step_3',                   label: 'Step 3 — Application / Discussion (10 mins)' },
  { key: 'conclusion',               label: 'Conclusion / Hitimisho (5 mins)' },
  { key: 'extended_activities',      label: 'Extended Activities' },
  { key: 'reflection',               label: 'Reflection of the Lesson / Maoni', hint: 'Fill in after teaching' },
]

const STATUS_COLORS = {
  generated: 'bg-blue-50 text-blue-700 border-blue-200',
  edited:    'bg-amber-50 text-amber-700 border-amber-200',
  taught:    'bg-green-50 text-green-700 border-green-200',
}

export default function LessonPlanDetailPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = use(params)
  const searchParams = useSearchParams()
  const router = useRouter()

  const startInEdit  = searchParams.get('edit') === '1'
  const startTaught  = searchParams.get('taught') === '1'

  const [plan, setPlan]         = useState<LessonPlanRecord | null>(null)
  const [sow, setSow]           = useState<SOWMeta | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saveState, setSaveState] = useState<'idle' | 'editing' | 'saved'>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [downloading, setDownloading] = useState(false)
  const [showTaughtForm, setShowTaughtForm]     = useState(startTaught)
  const [taughtDate, setTaughtDate]             = useState(new Date().toISOString().split('T')[0])
  const [reflection, setReflection]             = useState('')
  const [markingTaught, setMarkingTaught]       = useState(false)
  const [suggestions, setSuggestions]           = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [showTscView, setShowTscView] = useState(false)
  const [tscData, setTscData] = useState<{
    assignment: { id: string; title: string; subject: string; topic: string } | null
    results: { total: number; marked: number; level1: number; level2: number; level3: number; level4: number } | null
  } | null>(null)
  const [loadingTsc, setLoadingTsc] = useState(false)

  useEffect(() => {
    fetch(`/api/lesson-plans/${planId}`)
      .then(r => r.json())
      .then(async d => {
        if (d.success) {
          setPlan(d.data.plan)
          setReflection(d.data.plan.reflection || '')
          // Fetch SOW meta
          const sowRes = await fetch(`/api/lesson-plans/list?sowId=${d.data.plan.sow_id}`)
          const sowD = await sowRes.json()
          if (sowD.success) setSow(sowD.data.sow)
        }
      })
      .finally(() => setLoading(false))
  }, [planId])

  const saveField = useCallback((key: keyof LessonPlanRecord, value: string) => {
    if (!plan) return
    setPlan(prev => prev ? { ...prev, [key]: value } : prev)
    setSaveState('editing')
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/lesson-plans/${planId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field: key, value }),
        })
        const d = await res.json()
        if (d.success) {
          setSaveState('saved')
          setTimeout(() => setSaveState('idle'), 2000)
        } else {
          setSaveState('idle')
        }
      } catch {
        setSaveState('idle')
      }
    }, 800)
  }, [plan, planId])

  async function handleMarkTaught() {
    if (!taughtDate) return
    setMarkingTaught(true)
    setError('')
    try {
      const res = await fetch(`/api/lesson-plans/${planId}/mark-taught`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taughtDate, reflection }),
      })
      const d = await res.json()
      if (d.success) {
        setPlan(d.data.plan)
        setShowTaughtForm(false)
        setSaveState('saved')
        setTimeout(() => setSaveState('idle'), 2000)
      } else {
        setError(d.error || 'Failed to mark as taught')
      }
    } finally {
      setMarkingTaught(false)
    }
  }

  async function handleDownload() {
    if (!plan) return
    setDownloading(true)
    try {
      const res = await fetch('/api/lesson-plans/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planIds: [plan.id] }),
      })
      const d = await res.json()
      if (d.success && d.data.html) {
        const win = window.open('', '_blank')
        if (win) {
          win.document.write(d.data.html)
          win.document.close()
          win.focus()
          setTimeout(() => { win.print(); win.close() }, 800)
        }
      }
    } finally {
      setDownloading(false)
    }
  }

  async function openTscView() {
    setShowTscView(true)
    if (tscData !== null) return
    setLoadingTsc(true)
    try {
      const res = await fetch(`/api/lesson-plans/${planId}/tsc-view`)
      const d = await res.json()
      if (d.success) setTscData(d.data)
    } finally {
      setLoadingTsc(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Lesson plan not found.</p>
        <Link href="/teacher/lesson-plans" className="text-teal-600 font-semibold mt-4 inline-block">
          ← Back to Lesson Plans
        </Link>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">

      {/* Nav */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link
          href={`/teacher/lesson-plans${plan.sow_id ? `?sowId=${plan.sow_id}` : ''}`}
          className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-teal-700 transition"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Week View
        </Link>

        <div className="flex items-center gap-2">
          {saveState === 'editing' && (
            <span className="flex items-center gap-1 text-sm text-amber-500 font-semibold">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Editing…
            </span>
          )}
          {saveState === 'saved' && (
            <span className="flex items-center gap-1 text-sm text-green-600 font-semibold">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
          <button
            onClick={async () => {
              const opening = !showTaughtForm
              setShowTaughtForm(opening)
              if (opening && suggestions.length === 0) {
                setLoadingSuggestions(true)
                try {
                  const res = await fetch('/api/lesson-plans/reflection-suggestions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ planId }),
                  })
                  const d = await res.json()
                  if (d.success) setSuggestions(d.data.suggestions || [])
                } finally {
                  setLoadingSuggestions(false)
                }
              }
            }}
            disabled={plan.status === 'taught'}
            className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border transition ${
              plan.status === 'taught'
                ? 'bg-green-50 text-green-700 border-green-200 cursor-default'
                : 'text-gray-700 border-gray-200 hover:border-green-400 hover:text-green-700'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            {plan.status === 'taught' ? `Taught ${plan.taught_date || ''}` : 'Mark as Taught'}
          </button>
          <button
            onClick={openTscView}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-purple-700 border border-gray-200 hover:border-purple-300 px-4 py-2 rounded-xl transition"
          >
            <Printer className="w-4 h-4" /> TSC View
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-teal-700 border border-gray-200 hover:border-teal-300 px-4 py-2 rounded-xl transition disabled:opacity-60"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-red-700 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Mark taught form */}
      {showTaughtForm && plan.status !== 'taught' && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 font-bold text-green-800">
            <CalendarCheck className="w-5 h-5" /> Mark This Lesson as Taught
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-green-700">Date Taught</label>
            <input
              type="date"
              value={taughtDate}
              onChange={e => setTaughtDate(e.target.value)}
              className="border border-green-200 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-400 focus:outline-none w-48"
            />
          </div>

          {/* Reflection suggestions */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-green-700">
              <Sparkles className="w-3.5 h-3.5" />
              Choose a reflection to edit:
            </div>

            {loadingSuggestions ? (
              <div className="flex items-center gap-2 text-sm text-green-700 py-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating reflection suggestions…
              </div>
            ) : suggestions.length > 0 ? (
              <div className="space-y-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setSelectedSuggestion(i)
                      setReflection(s)
                    }}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition ${
                      selectedSuggestion === i
                        ? 'border-green-500 bg-white ring-2 ring-green-300'
                        : 'border-green-200 bg-white hover:border-green-400'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        selectedSuggestion === i
                          ? 'border-green-500 bg-green-500'
                          : 'border-gray-300'
                      }`}>
                        {selectedSuggestion === i && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white block" />
                        )}
                      </span>
                      <span className="text-gray-700 leading-relaxed">{s}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Editable textarea */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-green-700">
              {suggestions.length > 0 ? 'Or write your own:' : 'Reflection (optional)'}
            </label>
            <textarea
              value={reflection}
              onChange={e => {
                setReflection(e.target.value)
                setSelectedSuggestion(null)
              }}
              rows={4}
              placeholder="How did the lesson go? What would you change next time?"
              className="border border-green-200 rounded-xl px-3 py-2.5 text-sm bg-white w-full focus:ring-2 focus:ring-green-400 focus:outline-none resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleMarkTaught}
              disabled={markingTaught}
              className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-green-700 transition flex items-center gap-2 disabled:opacity-60"
            >
              {markingTaught ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Confirm
            </button>
            <button
              onClick={() => setShowTaughtForm(false)}
              className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-4 py-2 rounded-xl border border-gray-200 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Plan header card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-gray-400">
                Week {plan.week_number} · Lesson {plan.lesson_number}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[plan.status]}`}>
                {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
              </span>
            </div>
            <h2 className="text-xl font-black text-gray-900">{plan.sub_strand}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{plan.strand}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase mb-1">Learning Outcomes</div>
            <ul className="space-y-0.5">
              {(plan.learning_outcomes as string[]).map((o, i) => (
                <li key={i} className="text-gray-700">{String.fromCharCode(97 + i)}) {o}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase mb-1">Key Inquiry Questions</div>
            <ol className="list-decimal list-inside space-y-0.5">
              {(plan.key_inquiry_questions as string[]).map((q, i) => (
                <li key={i} className="text-gray-700">{q}</li>
              ))}
            </ol>
          </div>
        </div>

        <div className="mt-3">
          <div className="text-xs font-bold text-gray-400 uppercase mb-1">Learning Resources</div>
          <div className="flex flex-wrap gap-1.5">
            {(plan.learning_resources as string[]).map((r, i) => (
              <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg">{r}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Editable sections — click any section to edit, auto-saves after 800ms */}
      {SECTIONS.map(({ key, label, hint }) => {
        const value = plan[key] as string | null

        return (
          <div key={String(key)} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <div className="font-bold text-gray-900 text-sm">{label}</div>
              {hint && <div className="text-xs text-gray-400">{hint}</div>}
            </div>
            <div className="px-5 py-4">
              <div
                contentEditable
                suppressContentEditableWarning
                onBlur={e => {
                  const v = e.currentTarget.textContent ?? ''
                  if (v !== (value ?? '')) saveField(key, v)
                }}
                onPaste={e => {
                  e.preventDefault()
                  document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
                }}
                className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed min-h-[2rem] outline-none focus:bg-amber-50 focus:ring-1 focus:ring-amber-400/50 rounded-lg px-2 py-1 -mx-2 cursor-text transition-colors"
              >
                {value || ''}
              </div>
              {!value && (
                <p className="text-xs text-gray-300 italic pointer-events-none -mt-6">Click to add…</p>
              )}
            </div>
          </div>
        )
      })}

      {/* Create Assignment from this Lesson */}
      <Link
        href={`/teacher/assignments/new?planId=${plan.id}&subject=${encodeURIComponent(sow?.learning_area || '')}&topic=${encodeURIComponent(plan.sub_strand)}&strand=${encodeURIComponent(plan.strand)}&week=${plan.week_number}&lesson=${plan.lesson_number}`}
        className="w-full py-3.5 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:from-teal-700 hover:to-cyan-700 transition shadow-sm"
      >
        <ClipboardList className="w-5 h-5" /> Create Assignment from this Lesson
      </Link>

      {/* Footer meta */}
      {sow && (
        <div className="text-xs text-gray-400 text-center py-2">
          {sow.teacher_name} · TSC {sow.tsc_number} · {sow.school} · Term {sow.term} {sow.year}
          <br />Generated by EduNexus · edunexus.co.ke
        </div>
      )}

      {/* ── TSC Inspector View Modal ─────────────────────────────────────── */}
      {showTscView && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center overflow-y-auto py-6 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-purple-50 rounded-t-2xl">
              <div>
                <h2 className="text-lg font-black text-gray-900">TSC Inspection View</h2>
                <p className="text-xs text-gray-500">Print-ready record for TSC inspectors</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const el = document.getElementById('tsc-print-area')
                    if (!el) return
                    const win = window.open('', '_blank')
                    if (win) {
                      win.document.write(`<html><head><title>TSC View — ${plan.sub_strand}</title>
                        <style>body{font-family:Arial,sans-serif;padding:20mm;font-size:11pt}
                        h1{font-size:16pt}h2{font-size:13pt;margin-top:20px;border-bottom:1px solid #ccc;padding-bottom:4px}
                        .section{margin-bottom:16px}.label{font-size:8pt;color:#888;text-transform:uppercase}
                        .val{margin-top:2px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
                        .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:9pt}
                        .tick{color:#16a34a;font-weight:bold}@media print{body{padding:15mm}}</style>
                      </head><body>${el.innerHTML}</body></html>`)
                      win.document.close()
                      setTimeout(() => { win.print(); win.close() }, 600)
                    }
                  }}
                  className="flex items-center gap-1.5 text-sm font-bold bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 transition"
                >
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button
                  onClick={() => setShowTscView(false)}
                  className="text-sm font-bold text-gray-500 hover:text-gray-700 border border-gray-200 px-4 py-2 rounded-xl transition"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Modal body */}
            {loadingTsc ? (
              <div className="flex justify-center items-center py-16">
                <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
              </div>
            ) : (
              <div id="tsc-print-area" className="p-6 space-y-6">

                {/* Header */}
                <div className="text-center border-b border-gray-200 pb-4">
                  <div className="text-xs font-bold text-gray-400 uppercase mb-1">TSC Inspection Record</div>
                  <h1 className="text-2xl font-black text-gray-900">{plan.sub_strand}</h1>
                  <p className="text-sm text-gray-500">{plan.strand}</p>
                  {sow && (
                    <p className="text-xs text-gray-400 mt-1">
                      {sow.teacher_name} · TSC {sow.tsc_number} · {sow.school} · Term {sow.term} {sow.year}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">Week {plan.week_number} · Lesson {plan.lesson_number}</p>
                </div>

                {/* Section 1 — Lesson Plan */}
                <div>
                  <h2 className="text-sm font-black text-purple-700 uppercase mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-black">1</span>
                    Lesson Plan
                    <span className="ml-auto text-green-600 font-bold text-xs">✅ On Record</span>
                  </h2>
                  <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 rounded-xl p-4">
                    {SECTIONS.filter(s => plan[s.key]).map(({ key, label }) => (
                      <div key={String(key)}>
                        <div className="font-bold text-gray-500 uppercase text-xs mb-0.5">{label}</div>
                        <div className="text-gray-700 whitespace-pre-wrap line-clamp-3">{plan[key] as string}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Status: <span className="font-bold capitalize">{plan.status}</span>
                    {plan.taught_date && <span> · Taught on {plan.taught_date}</span>}
                    {plan.reflection && <span> · Reflection recorded ✅</span>}
                  </div>
                </div>

                {/* Section 2 — Assignment */}
                <div>
                  <h2 className="text-sm font-black text-blue-700 uppercase mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-black">2</span>
                    Assignment Used
                    {tscData?.assignment
                      ? <span className="ml-auto text-green-600 font-bold text-xs">✅ Linked</span>
                      : <span className="ml-auto text-amber-600 font-bold text-xs">⚠ Not yet created</span>
                    }
                  </h2>
                  {tscData?.assignment ? (
                    <div className="bg-blue-50 rounded-xl p-4 text-sm space-y-1">
                      <div className="font-bold text-gray-900">{tscData.assignment.title}</div>
                      <div className="text-xs text-gray-500">{tscData.assignment.subject} · {tscData.assignment.topic}</div>
                      <div className="text-xs text-green-700 font-semibold mt-2">
                        Differentiated assignment used ✅
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500 italic">
                      No assignment linked yet. Use "Create Assignment from this Lesson" to link one.
                    </div>
                  )}
                </div>

                {/* Section 3 — Results */}
                <div>
                  <h2 className="text-sm font-black text-teal-700 uppercase mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center text-xs font-black">3</span>
                    Results Summary
                    {tscData?.results?.marked
                      ? <span className="ml-auto text-green-600 font-bold text-xs">✅ Results Recorded</span>
                      : <span className="ml-auto text-amber-600 font-bold text-xs">⚠ Pending</span>
                    }
                  </h2>
                  {tscData?.results && tscData.results.total > 0 ? (
                    <div className="bg-teal-50 rounded-xl p-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs mb-3">
                        {[
                          { label: 'Level 4 — Exceeding', count: tscData.results.level4, colour: 'text-green-700 bg-green-100' },
                          { label: 'Level 3 — Meeting',   count: tscData.results.level3, colour: 'text-blue-700 bg-blue-100' },
                          { label: 'Level 2 — Approaching', count: tscData.results.level2, colour: 'text-amber-700 bg-amber-100' },
                          { label: 'Level 1 — Emerging',  count: tscData.results.level1, colour: 'text-red-700 bg-red-100' },
                        ].map(({ label, count, colour }) => (
                          <div key={label} className={`rounded-xl p-3 ${colour}`}>
                            <div className="text-lg font-black">{count}</div>
                            <div className="font-bold leading-tight">{label}</div>
                            <div className="text-xs opacity-70">
                              {tscData.results!.total > 0
                                ? `${Math.round((count / tscData.results!.total) * 100)}%`
                                : '—'}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-gray-500">{tscData.results.marked} of {tscData.results.total} students marked</div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500 italic">
                      No results recorded yet.
                    </div>
                  )}
                </div>

                {/* Section 4 — Follow-up */}
                <div>
                  <h2 className="text-sm font-black text-orange-700 uppercase mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-xs font-black">4</span>
                    Follow-up Actions
                  </h2>
                  <div className="bg-orange-50 rounded-xl p-4 space-y-2 text-sm">
                    {tscData?.results?.level1 && tscData.results.level1 > 0 ? (
                      <div className="text-orange-800 font-semibold">
                        ✅ {tscData.results.level1} Level 1 student{tscData.results.level1 > 1 ? 's' : ''} identified — parents eligible for WhatsApp notification
                      </div>
                    ) : null}
                    <div className="text-gray-600">✅ Learning Compass updated for all marked students</div>
                    <div className="text-gray-600">✅ Differentiated assignment used — all four CBC levels addressed</div>
                    {plan.status === 'taught' && (
                      <div className="text-gray-600">✅ Lesson reflection recorded by teacher</div>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
