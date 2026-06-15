'use client'

import { useState, useEffect, useRef, useCallback, use } from 'react'
import Link from 'next/link'
import {
  ChevronLeft, Loader2, Download, Check, BookOpen, AlertCircle, FolderOpen,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SchemeMeta {
  id: string
  school: string
  grade: string
  learning_area: string
  term: number
  year: number
  curriculum_mode: string
  total_lessons: number
  total_weeks: number
  lessons_per_week: number
  teacher_name: string | null
  tsc_number: string | null
  textbook: string | null
}

interface SchemeLesson {
  id: string
  week: number
  lesson: number
  strand: string
  substrand: string
  learning_outcomes: string
  learning_experiences: string
  key_inquiry_questions: string
  learning_resources: string
  assessment_methods: string
  reflection: string
}

interface BreakItem {
  id: string
  title: string
  startWeek: number
  endWeek: number
  startLesson: number
  endLesson: number
}

// ─── Break color palette ──────────────────────────────────────────────────────

const NAMED_BREAK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'August Holiday':    { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' },
  'Half Term':         { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' },
  'October Holiday':   { bg: '#FCE7F3', text: '#9D174D', border: '#EC4899' },
  'Games Day':         { bg: '#D1FAE5', text: '#065F46', border: '#10B981' },
  'Public Holiday':    { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' },
  'Revision Week':     { bg: '#EDE9FE', text: '#5B21B6', border: '#8B5CF6' },
  'Exam Week':         { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' },
}

const FALLBACK_PALETTE = [
  { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' },
  { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' },
  { bg: '#D1FAE5', text: '#065F46', border: '#10B981' },
  { bg: '#FCE7F3', text: '#9D174D', border: '#EC4899' },
  { bg: '#EDE9FE', text: '#5B21B6', border: '#8B5CF6' },
]

function buildBreakColorMap(breaks: BreakItem[]) {
  const names = [...new Set(breaks.map(b => b.title))]
  return Object.fromEntries(
    names.map((name, i) => [
      name,
      NAMED_BREAK_COLORS[name] ?? FALLBACK_PALETTE[i % FALLBACK_PALETTE.length],
    ])
  )
}

// ─── EditableCell ─────────────────────────────────────────────────────────────

function EditableCell({
  value,
  onSave,
  multiline = false,
  className = '',
}: {
  value: string
  onSave: (v: string) => void
  multiline?: boolean
  className?: string
}) {
  return (
    <div
      contentEditable
      suppressContentEditableWarning
      onBlur={e => {
        const v = e.currentTarget.textContent ?? ''
        if (v !== value) onSave(v)
      }}
      onPaste={e => {
        e.preventDefault()
        const text = e.clipboardData.getData('text/plain')
        document.execCommand('insertText', false, text)
      }}
      className={`outline-none focus:bg-amber-50 focus:ring-1 focus:ring-amber-400/60 rounded-sm cursor-text whitespace-pre-wrap leading-snug ${multiline ? 'min-h-[2.5rem]' : ''} ${className}`}
    >
      {value}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SOWDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [scheme, setScheme]   = useState<SchemeMeta | null>(null)
  const [lessons, setLessons] = useState<SchemeLesson[]>([])
  const [breaks, setBreaks]   = useState<BreakItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'editing' | 'saved'>('idle')
  const [downloading, setDownloading] = useState(false)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const breakColorMap = buildBreakColorMap(breaks)

  useEffect(() => {
    fetch(`/api/schemes/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setScheme(d.data.scheme)
          setLessons(d.data.lessons)
          setBreaks(Array.isArray(d.data.breaks) ? d.data.breaks : [])
        } else {
          setError(d.error ?? 'Failed to load scheme')
        }
      })
      .catch(() => setError('Failed to load scheme'))
      .finally(() => setLoading(false))
  }, [id])

  const updateField = useCallback((lessonId: string, field: string, value: string) => {
    // Optimistic local update
    setLessons(prev => prev.map(l => l.id === lessonId ? { ...l, [field]: value } : l))
    setSaveState('editing')
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/schemes/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonId, field, value }),
        })
        if (res.ok) {
          setSaveState('saved')
          setTimeout(() => setSaveState('idle'), 2000)
        } else {
          setSaveState('idle')
        }
      } catch {
        setSaveState('idle')
      }
    }, 800)
  }, [id])

  async function handleDownload() {
    if (!scheme) return
    setDownloading(true)
    try {
      const res = await fetch('/api/documents/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'sow', schemeId: id }),
      })
      const d = await res.json()
      if (d.success && d.data.html) {
        const win = window.open('', '_blank')
        if (win) { win.document.write(d.data.html); win.document.close(); win.print() }
      }
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (error || !scheme) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <p className="font-bold text-gray-700">{error ?? 'Scheme not found'}</p>
          <Link href="/teacher/scheme-of-work" className="text-sm text-indigo-600 hover:underline">← Back to Schemes</Link>
        </div>
      </div>
    )
  }

  // Build interleaved rows: lessons + break separators ordered by week
  type Row =
    | { type: 'lesson'; data: SchemeLesson }
    | { type: 'break';  data: BreakItem }

  const sortedBreaks = [...breaks].sort((a, b) =>
    a.startWeek !== b.startWeek ? a.startWeek - b.startWeek : a.startLesson - b.startLesson
  )
  const rows: Row[] = []
  let bi = 0
  for (const lesson of lessons) {
    while (bi < sortedBreaks.length && sortedBreaks[bi].endWeek < lesson.week) {
      rows.push({ type: 'break', data: sortedBreaks[bi++] })
    }
    rows.push({ type: 'lesson', data: lesson })
  }
  while (bi < sortedBreaks.length) {
    rows.push({ type: 'break', data: sortedBreaks[bi++] })
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="bg-[#0c1929] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Link
                href="/teacher/scheme-of-work"
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 hover:bg-white/10 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </Link>
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shrink-0">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-black text-white leading-tight">{scheme.learning_area}</h1>
                <p className="text-slate-400 text-xs mt-0.5">
                  {scheme.grade} · Term {scheme.term} {scheme.year} · {scheme.total_weeks} wks · {scheme.total_lessons} lessons
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Save indicator */}
              {saveState === 'editing' && (
                <span className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold">
                  <Loader2 className="w-3 h-3 animate-spin" /> Editing…
                </span>
              )}
              {saveState === 'saved' && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                  <Check className="w-3 h-3" /> Saved
                </span>
              )}

              <Link
                href="/teacher/documents"
                className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white px-4 py-2 rounded-xl font-bold text-sm transition"
              >
                <FolderOpen className="w-4 h-4" />
                My Documents
              </Link>

              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white px-4 py-2 rounded-xl font-bold text-sm hover:opacity-90 transition shadow-lg disabled:opacity-60"
              >
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download PDF
              </button>
            </div>
          </div>

          {/* Meta strip */}
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400">
            {scheme.school && <span><span className="text-slate-500">School:</span> {scheme.school}</span>}
            {scheme.teacher_name && <span><span className="text-slate-500">Teacher:</span> {scheme.teacher_name}</span>}
            {scheme.tsc_number && <span><span className="text-slate-500">TSC:</span> {scheme.tsc_number}</span>}
            {scheme.textbook && <span><span className="text-slate-500">Textbook:</span> {scheme.textbook}</span>}
            <span className="text-slate-500 text-xs italic">Click any cell to edit · Auto-saves after 800ms</span>
          </div>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-xs border-collapse" style={{ minWidth: '900px' }}>
            <thead>
              <tr style={{ background: '#1e293b' }}>
                {['Wk', 'Ls', 'Strand', 'Sub-Strand', 'Learning Outcomes', 'Learning Experiences', 'Key Inquiry Qs', 'Resources', 'Assessment'].map((h, i) => (
                  <th
                    key={i}
                    className="px-3 py-3 text-left font-black uppercase tracking-wide text-slate-300"
                    style={{ fontSize: '9px', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                if (row.type === 'break') {
                  const b = row.data
                  const c = breakColorMap[b.title] ?? FALLBACK_PALETTE[0]
                  const wkRange = b.startWeek === b.endWeek ? `Wk ${b.startWeek}` : `Wk ${b.startWeek}–${b.endWeek}`
                  return (
                    <tr key={`break-${b.id}`} style={{ backgroundColor: c.bg, borderLeft: `4px solid ${c.border}` }}>
                      <td
                        colSpan={9}
                        style={{ padding: '10px 16px', fontWeight: 700, fontSize: '11px', color: c.text, letterSpacing: '0.02em' }}
                      >
                        ── {b.title}
                        <span style={{ marginLeft: '12px', fontWeight: 400, fontSize: '10px', opacity: 0.75 }}>{wkRange}</span>
                      </td>
                    </tr>
                  )
                }

                const l = row.data
                const isEven = idx % 2 === 0

                return (
                  <tr
                    key={l.id}
                    style={{ backgroundColor: isEven ? '#ffffff' : '#f8fafc' }}
                    className="hover:bg-amber-50/30 transition-colors"
                  >
                    {/* Week + Lesson — not editable */}
                    <td className="px-3 py-2 text-center font-bold text-slate-500 border-r border-slate-100 align-top" style={{ width: '36px' }}>
                      {l.week}
                    </td>
                    <td className="px-3 py-2 text-center font-bold text-slate-400 border-r border-slate-100 align-top" style={{ width: '32px' }}>
                      {l.lesson}
                    </td>

                    {/* Editable fields */}
                    {([
                      { field: 'strand',               w: '110px' },
                      { field: 'substrand',            w: '130px' },
                      { field: 'learning_outcomes',    w: '160px' },
                      { field: 'learning_experiences', w: '160px' },
                      { field: 'key_inquiry_questions',w: '140px' },
                      { field: 'learning_resources',   w: '120px' },
                      { field: 'assessment_methods',   w: '100px' },
                    ] as const).map(({ field, w }) => (
                      <td
                        key={field}
                        className="px-2 py-1.5 border-r border-slate-100 align-top"
                        style={{ width: w, verticalAlign: 'top' }}
                      >
                        <EditableCell
                          value={(l as unknown as Record<string, string>)[field] ?? ''}
                          onSave={v => updateField(l.id, field, v)}
                          multiline
                          className="text-slate-700 text-[11px] w-full"
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>

          {rows.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No lesson data found for this scheme.</p>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-3 text-center">
          {scheme.total_lessons} lessons · {breaks.length} break{breaks.length !== 1 ? 's' : ''} · Click any cell to edit, changes auto-save
        </p>
      </div>
    </div>
  )
}
