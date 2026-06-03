'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Plus, BookOpen, Loader2, Zap, ClipboardList, AlertCircle,
} from 'lucide-react'
import type { SchemeWithProgress } from '@/app/api/sow/list/route'

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getCurrentTerm(): 1 | 2 | 3 {
  const m = new Date().getMonth() + 1
  return m <= 4 ? 1 : m <= 8 ? 2 : 3
}

function getTermWeek(term: 1 | 2 | 3, year: number): number {
  const startMonth = term === 1 ? 1 : term === 2 ? 5 : 9
  const termStart  = new Date(year, startMonth - 1, 1)
  return Math.min(
    Math.max(Math.floor((Date.now() - termStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1, 1),
    14
  )
}

// ─── Subject badge colors ─────────────────────────────────────────────────────

const SUBJECT_COLORS: Record<string, { bg: string; text: string; abbr: string }> = {
  'social studies':     { bg: '#E1F5EE', text: '#085041', abbr: 'SS' },
  'integrated science': { bg: '#E6F1FB', text: '#0C447C', abbr: 'SC' },
  'mathematics':        { bg: '#FAEEDA', text: '#854F0B', abbr: 'MA' },
  'english':            { bg: '#EEEDFE', text: '#3C3489', abbr: 'EN' },
  'kiswahili':          { bg: '#E8F5E9', text: '#1B5E20', abbr: 'KI' },
  'creative arts':      { bg: '#FCE4EC', text: '#880E4F', abbr: 'CA' },
}

function subjectColor(name: string) {
  const lc = name.toLowerCase()
  for (const [key, val] of Object.entries(SUBJECT_COLORS)) {
    if (lc.includes(key)) return val
  }
  return { bg: '#F3F4F6', text: '#374151', abbr: name.slice(0, 2).toUpperCase() }
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

type PillColor = 'green' | 'amber' | 'red' | 'gray'

function Pill({ label, color }: { label: string; color: PillColor }) {
  const cls: Record<PillColor, string> = {
    green: 'bg-teal-50 text-teal-700 border-teal-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red:   'bg-red-50 text-red-600 border-red-200',
    gray:  'bg-gray-100 text-gray-500 border-gray-200',
  }
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${cls[color]}`}>
      {label}
    </span>
  )
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: PillColor }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const fill: Record<PillColor, string> = {
    green: 'bg-teal-500',
    amber: 'bg-amber-400',
    red:   'bg-red-400',
    gray:  'bg-gray-300',
  }
  return (
    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
      <div className={`h-2 rounded-full transition-all ${fill[color]}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ─── Scheme Card ──────────────────────────────────────────────────────────────

function SchemeCard({
  scheme,
  currentWeek,
  onRefresh,
}: {
  scheme: SchemeWithProgress
  currentWeek: number
  onRefresh: () => void
}) {
  const [generatingLP,  setGeneratingLP]  = useState(false)
  const [generatingROW, setGeneratingROW] = useState(false)
  const [lpError,  setLpError]  = useState('')
  const [rowError, setRowError] = useState('')

  const colors     = subjectColor(scheme.learning_area)
  const nextLPWeek = (scheme.latest_lp_week ?? 0) + 1
  const allDone    = nextLPWeek > (scheme.total_weeks ?? 0)

  // Progress values
  const lpPct  = scheme.total_lessons > 0
    ? Math.round((scheme.lesson_plans_count / scheme.total_lessons) * 100) : 0
  const rowLessons = scheme.row_count * (scheme.lessons_per_week || 1)
  const rowPct = scheme.total_lessons > 0
    ? Math.round((rowLessons / scheme.total_lessons) * 100) : 0
  const rowOverdue = scheme.row_count < (scheme.latest_lp_week ?? 0) - 1

  // Pill states
  const lpPill: { label: string; color: PillColor } =
    scheme.lesson_plans_count === 0
      ? { label: 'Not started', color: 'gray' }
      : scheme.lesson_plans_count >= scheme.total_lessons
      ? { label: 'Complete', color: 'green' }
      : { label: `Week ${scheme.latest_lp_week} of ${scheme.total_weeks}`, color: 'amber' }

  const rowPill: { label: string; color: PillColor } =
    scheme.row_count === 0
      ? { label: 'Not started', color: 'gray' }
      : rowLessons >= scheme.total_lessons
      ? { label: 'Complete', color: 'green' }
      : rowOverdue
      ? { label: `Week ${scheme.row_count} overdue`, color: 'red' }
      : { label: `Week ${scheme.row_count}`, color: 'amber' }

  async function handleGenerateLP() {
    setLpError('')
    setGeneratingLP(true)
    try {
      const res = await fetch('/api/lesson-plans/generate-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sowId: scheme.id, weekNumber: nextLPWeek }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Generation failed')
      onRefresh()
    } catch (err: unknown) {
      setLpError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setGeneratingLP(false)
    }
  }

  async function handleGenerateROW() {
    setRowError('')
    setGeneratingROW(true)
    try {
      const res = await fetch('/api/teacher/records-of-work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemeId:       scheme.id,
          school:         scheme.school,
          grade:          scheme.grade,
          learningArea:   scheme.learning_area,
          term:           scheme.term,
          year:           scheme.year,
          curriculumMode: scheme.curriculum_mode,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'ROW generation failed')
      onRefresh()
    } catch (err: unknown) {
      setRowError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setGeneratingROW(false)
    }
  }

  const busy = generatingLP || generatingROW

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

      {/* ── Section 1: Header ──────────────────────────────────────────────────── */}
      <div className="p-5 flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-black shrink-0"
          style={{ backgroundColor: colors.bg, color: colors.text }}
        >
          {colors.abbr}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-black text-gray-900 text-base leading-tight">{scheme.learning_area}</h3>
          <p className="text-gray-500 text-sm">{scheme.grade} · Term {scheme.term} · {scheme.year}</p>
          <p className="text-gray-400 text-xs mt-0.5">
            {scheme.total_lessons} lessons · {scheme.total_weeks} weeks · {scheme.lessons_per_week} per week
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <Link
            href={`/teacher/scheme-of-work/${scheme.id}`}
            className="text-xs font-bold text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition"
          >
            View SOW
          </Link>

          {allDone ? (
            <span className="text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-lg">
              All plans done ✓
            </span>
          ) : (
            <button
              onClick={handleGenerateLP}
              disabled={busy}
              className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingLP
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</>
                : <><Zap className="w-3 h-3" /> Generate Wk {nextLPWeek}</>}
            </button>
          )}
        </div>
      </div>

      {/* ── Section 2: Progress bars ───────────────────────────────────────────── */}
      <div className="px-5 pb-5 pt-4 grid grid-cols-3 gap-5 border-t border-gray-100">

        {/* SOW — always complete */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-gray-600">Scheme of Work</span>
            <Pill label="Complete" color="green" />
          </div>
          <ProgressBar value={1} max={1} color="green" />
          <p className="text-[11px] text-gray-400 mt-1">
            {scheme.total_lessons} / {scheme.total_lessons} lessons
          </p>
        </div>

        {/* Lesson Plans */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-gray-600">Lesson Plans</span>
            <Pill label={lpPill.label} color={lpPill.color} />
          </div>
          <ProgressBar
            value={scheme.lesson_plans_count}
            max={scheme.total_lessons}
            color={lpPill.color === 'gray' ? 'gray' : lpPill.color === 'green' ? 'green' : 'amber'}
          />
          <p className="text-[11px] text-gray-400 mt-1">
            {scheme.lesson_plans_count} / {scheme.total_lessons} plans
          </p>
          {lpError && <p className="text-[10px] text-red-500 mt-1 leading-tight">{lpError}</p>}
        </div>

        {/* Record of Work */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-gray-600">Record of Work</span>
            <Pill label={rowPill.label} color={rowPill.color} />
          </div>
          <ProgressBar
            value={rowLessons}
            max={scheme.total_lessons}
            color={rowPill.color === 'gray' ? 'gray' : rowPill.color === 'green' ? 'green' : rowPill.color === 'red' ? 'red' : 'amber'}
          />
          <p className="text-[11px] text-gray-400 mt-1">
            {rowLessons} / {scheme.total_lessons} recorded
          </p>
          {scheme.row_count < (scheme.latest_lp_week ?? 0) && (
            <button
              onClick={handleGenerateROW}
              disabled={busy}
              className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 transition disabled:opacity-50"
            >
              {generatingROW
                ? <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Generating…</>
                : <><ClipboardList className="w-2.5 h-2.5" /> Generate RoW</>}
            </button>
          )}
          {rowError && <p className="text-[10px] text-red-500 mt-1 leading-tight">{rowError}</p>}
        </div>
      </div>

      {/* ── Section 3: Status strip ────────────────────────────────────────────── */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-gray-400 shrink-0">
          Current week: {currentWeek} · Next LP due: Friday ·
          Last RoW: {scheme.row_count > 0 ? `Week ${scheme.row_count}` : 'none'}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full border border-teal-200">
            SOW ✓
          </span>
          {scheme.latest_lp_week && (
            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
              LP Wk 1–{scheme.latest_lp_week} ✓
            </span>
          )}
          {!allDone && (
            <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
              LP Wk {nextLPWeek} pending
            </span>
          )}
          {scheme.row_count > 0 && (
            <span className="text-[10px] font-bold bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full border border-teal-200">
              RoW Wk 1–{scheme.row_count} ✓
            </span>
          )}
          {rowOverdue && (
            <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-200">
              RoW Wk {scheme.row_count + 1} overdue
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MySchemesPage() {
  const [schemes, setSchemes]           = useState<SchemeWithProgress[]>([])
  const [loading, setLoading]           = useState(true)
  const [fetchError, setFetchError]     = useState('')
  const [selectedTerm, setSelectedTerm] = useState<1 | 2 | 3>(getCurrentTerm())

  const currentTerm = getCurrentTerm()
  const currentYear = new Date().getFullYear()
  const currentWeek = getTermWeek(currentTerm, currentYear)

  const fetchSchemes = useCallback(async () => {
    setFetchError('')
    try {
      const res = await fetch('/api/sow/list', { cache: 'no-store' })
      if (res.status === 401) { window.location.href = '/login'; return }
      if (!res.ok) throw new Error('Failed to load schemes')
      const d = await res.json()
      setSchemes(d.data?.schemes ?? [])
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSchemes() }, [fetchSchemes])

  const filtered = schemes.filter(s => s.term === selectedTerm)

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-5">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900">My Schemes of Work</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Term {currentTerm}, {currentYear} · {schemes.length} scheme{schemes.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link
            href="/teacher/scheme-of-work/new"
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Scheme
          </Link>
        </div>

        {/* ── Current week indicator ──────────────────────────────────────────── */}
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5 w-fit">
          <span className="text-base">📅</span>
          <span className="text-sm font-bold text-indigo-800">
            Week {currentWeek} of Term {currentTerm}
          </span>
        </div>

        {/* ── Term tabs ───────────────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {([1, 2, 3] as const).map(t => (
            <button
              key={t}
              onClick={() => setSelectedTerm(t)}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                selectedTerm === t
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Term {t}
            </button>
          ))}
        </div>

        {/* ── Error ───────────────────────────────────────────────────────────── */}
        {fetchError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {fetchError}
          </div>
        )}

        {/* ── Scheme cards ────────────────────────────────────────────────────── */}
        {filtered.length > 0 ? (
          <div className="space-y-4">
            {filtered.map(scheme => (
              <SchemeCard
                key={scheme.id}
                scheme={scheme}
                currentWeek={currentWeek}
                onRefresh={fetchSchemes}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
            <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <h3 className="font-black text-gray-500 text-lg mb-2">
              No schemes for Term {selectedTerm} yet
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              Generate your first CBC scheme of work for this term
            </p>
            <Link
              href="/teacher/scheme-of-work/new"
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition"
            >
              <Plus className="w-4 h-4" />
              Create Scheme for Term {selectedTerm}
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
