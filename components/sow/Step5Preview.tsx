'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  Loader2,
  Download,
  Save,
  Plus,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Zap,
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { downloadSOWAsPDF, getColumnConfig } from '@/lib/sow/pdfRenderer'
import type {
  SOWContext,
  SelectedSubstrand,
  TimelineSlot,
  BreakItem,
  GeneratedLesson,
  SOWGenerationResult,
} from '@/lib/sow/types'

function slotInBreak(week: number, lesson: number, b: BreakItem): boolean {
  const afterStart = week > b.startWeek || (week === b.startWeek && lesson >= b.startLesson)
  const beforeEnd  = week < b.endWeek   || (week === b.endWeek   && lesson <= b.endLesson)
  return afterStart && beforeEnd
}

interface Props {
  context: SOWContext
  selectedSubstrands: SelectedSubstrand[]
  timeline: TimelineSlot[]
  breaks: BreakItem[]
  onBack: () => void
  onReset: () => void
}

export default function Step5Preview({
  context,
  selectedSubstrands,
  timeline,
  breaks,
  onBack,
  onReset,
}: Props) {
  const supabase = createClient()

  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState('')
  const [progressPct, setProgressPct] = useState(0)
  const [result, setResult] = useState<SOWGenerationResult | null>(null)
  const [reflections, setReflections] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [savedSowId, setSavedSowId] = useState<string | null>(null)
  const [genError, setGenError] = useState('')
  const [generatingWeek1, setGeneratingWeek1] = useState(false)
  const [week1Generated, setWeek1Generated] = useState(false)

  const teachingSlots = timeline.filter(s => !s.isBreak).length
  const colConfig = getColumnConfig(context.curriculumMode)

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    setGenError('')
    setResult(null)
    setProgressPct(0)
    setProgress('Fetching KICD curriculum data…')

    // Step A: Fetch KICD enrichment
    const subjectName = context.learningAreaName.toLowerCase()

    const [{ data: kicdArea }, { data: kicdStrands }] = await Promise.all([
      supabase
        .from('sow_learning_areas')
        .select('kicd_subject_data')
        .ilike('name', `%${subjectName}%`)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('sow_strands')
        .select('title, kicd_data')
        .ilike('title', `%${subjectName}%`),
    ])

    const enrichedContext: SOWContext = {
      ...context,
      kicdContext: {
        subjectData: (kicdArea as any)?.kicd_subject_data || {},
        strandData: (kicdStrands as any[]) || [],
        subtopicMap: Object.fromEntries(
          selectedSubstrands
            .filter(s => s.subtopics?.length)
            .map(s => [s.strandTitle, s.subtopics!])
        ),
      },
    }

    setProgress(`Generating ${teachingSlots} lessons with DeepSeek AI…`)
    setProgressPct(10)

    // Step B: Call generate API with pre-built timeline
    try {
      const res = await fetch('/api/sow/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: enrichedContext,
          selectedSubstrands,
          timeline,
          breaks,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        if (res.status === 401) {
          setGenError('You must be logged in to generate a scheme. Please sign in and try again.')
        } else if (res.status === 403) {
          setGenError('A teacher account is required to generate schemes. Sign in with your teacher account.')
        } else {
          setGenError(data.error || `Generation failed (${res.status})`)
        }
        setGenerating(false)
        return
      }

      setResult(data.data.result)
      setProgressPct(100)
      setProgress('')
    } catch (err: any) {
      setGenError(`Network error: ${err.message}`)
    } finally {
      setGenerating(false)
    }
  }, [context, selectedSubstrands, timeline, breaks, teachingSlots, supabase])

  async function handleSave() {
    if (!result) return
    setSaving(true)

    const avgConf =
      result.lessons.reduce((s, l) => s + l._confidence, 0) / (result.lessons.length || 1)

    const totalWeeks = result.lessons.length
      ? result.lessons[result.lessons.length - 1].week - result.lessons[0].week + 1
      : 0

    const schemeData = {
      meta: {
        school: context.school,
        teacherName: context.teacherName,
        tscNumber: context.tscNumber,
        grade: context.gradeName,
        learningArea: context.learningAreaName,
        term: String(context.term),
        year: context.year,
        textbook: context.textbook || '',
        totalLessons: result.summary.generated,
        totalWeeks,
        generatedDate: new Date().toLocaleDateString('en-KE'),
        curriculumMode: context.curriculumMode,
        averageConfidence: Math.round(avgConf * 100) / 100,
      },
      lessons: result.lessons.map(l => ({
        ...l,
        reflection: reflections[`${l.week}_${l.lesson}`] || '',
      })),
      breaks,
    }

    try {
      const res = await fetch('/api/sow/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schemeData }),
      })
      const d = await res.json()
      if (d.success) {
        setSaveSuccess(true)
        setSavedSowId(d.data?.schemeId || null)
        setTimeout(() => setSaveSuccess(false), 6000)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerateWeek1() {
    if (!savedSowId) return
    setGeneratingWeek1(true)
    try {
      const res = await fetch('/api/lesson-plans/generate-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sowId: savedSowId, weekNumber: 1 }),
      })
      const d = await res.json()
      if (d.success) setWeek1Generated(true)
    } finally {
      setGeneratingWeek1(false)
    }
  }

  function handleDownload() {
    if (!result) return
    const avgConf =
      result.lessons.reduce((s, l) => s + l._confidence, 0) / (result.lessons.length || 1)

    const totalWeeks = result.lessons.length
      ? result.lessons[result.lessons.length - 1].week - result.lessons[0].week + 1
      : 0

    downloadSOWAsPDF(
      {
        meta: {
          school: context.school,
          teacherName: context.teacherName,
          tscNumber: context.tscNumber,
          grade: context.gradeName,
          learningArea: context.learningAreaName,
          term: String(context.term),
          year: context.year,
          textbook: context.textbook || '',
          totalLessons: result.summary.generated,
          totalWeeks,
          generatedDate: new Date().toLocaleDateString('en-KE'),
          curriculumMode: context.curriculumMode,
          averageConfidence: Math.round(avgConf * 100) / 100,
        },
        lessons: result.lessons.map(l => ({
          ...l,
          reflection: reflections[`${l.week}_${l.lesson}`] || '',
        })),
        breaks,
      },
      colConfig
    )
  }

  // ── Not yet generated ──────────────────────────────────────────────────────

  if (!result && !generating) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm text-center">
          <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-teal-600" />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Ready to Generate</h2>
          <p className="text-gray-500 text-sm mb-2">
            {context.learningAreaName} · {context.gradeName} · Term {context.term} {context.year}
          </p>
          <p className="text-gray-400 text-sm mb-6">
            {selectedSubstrands.length} topic{selectedSubstrands.length !== 1 ? 's' : ''} · {teachingSlots} lessons (one per slot)
          </p>

          {genError && (
            <div className="mb-5 bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-red-700 text-sm font-medium text-left">
              {genError}
            </div>
          )}

          <button
            onClick={handleGenerate}
            className="bg-teal-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-teal-700 transition text-base"
          >
            Generate Scheme of Work
          </button>
        </div>

        <div className="flex justify-start">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 px-5 py-3 rounded-xl border border-gray-200 font-bold hover:bg-gray-50 transition"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        </div>
      </div>
    )
  }

  // ── Generating ─────────────────────────────────────────────────────────────

  if (generating) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-12 shadow-sm text-center">
        <Loader2 className="w-10 h-10 text-teal-600 animate-spin mx-auto mb-5" />
        <p className="text-gray-800 font-bold text-base mb-4">{progress}</p>
        <div className="w-full bg-gray-100 rounded-full h-2.5 max-w-md mx-auto">
          <div
            className="bg-teal-500 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-gray-400 text-xs mt-3">This may take 1–3 minutes for large schemes…</p>
      </div>
    )
  }

  // ── Generated ──────────────────────────────────────────────────────────────

  const avgConf =
    result!.lessons.reduce((s, l) => s + l._confidence, 0) / (result!.lessons.length || 1)

  // Build a lookup by week+lesson for O(1) access during table rendering
  const lessonByKey = new Map(result!.lessons.map(l => [`${l.week}_${l.lesson}`, l]))
  let lessonRowIdx = 0
  const tableRows = timeline.map(slot => {
    if (slot.isBreak) {
      const matchBreak = breaks.find(b => slotInBreak(slot.week, slot.lesson, b))
      return (
        <tr key={`s${slot.slotIndex}`} className="bg-amber-50">
          <td className="px-3 py-2 text-center font-bold text-amber-800 text-xs">{slot.week}</td>
          <td className="px-3 py-2 text-center text-amber-600 text-xs">{slot.lesson}</td>
          <td
            colSpan={colConfig.hasInquiryQuestions ? 8 : 7}
            className="px-3 py-2 text-center font-bold text-amber-800 text-xs italic"
          >
            {(matchBreak?.title ?? 'BREAK').toUpperCase()}
          </td>
        </tr>
      )
    }
    const lesson = lessonByKey.get(`${slot.week}_${slot.lesson}`)
    if (!lesson) return null
    const myIdx = lessonRowIdx++
    return (
      <LessonRow
        key={`s${slot.slotIndex}`}
        lesson={lesson}
        defaultExpanded={myIdx < 3}
        reflection={reflections[`${slot.week}_${slot.lesson}`] || ''}
        onReflectionChange={val =>
          setReflections(prev => ({ ...prev, [`${slot.week}_${slot.lesson}`]: val }))
        }
        hasCBC={colConfig.hasInquiryQuestions}
      />
    )
  })

  return (
    <div className="space-y-6">
      {/* Quality summary */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5 text-center">
          <div className="text-3xl font-black text-teal-700 mb-1">{result!.summary.generated}</div>
          <div className="text-sm text-teal-600 font-bold">Lessons Generated</div>
        </div>
        <div
          className={`rounded-2xl p-5 text-center border ${
            result!.summary.failed > 0
              ? 'bg-amber-50 border-amber-200'
              : 'bg-green-50 border-green-200'
          }`}
        >
          <div
            className={`text-3xl font-black mb-1 ${
              result!.summary.failed > 0 ? 'text-amber-700' : 'text-green-700'
            }`}
          >
            {result!.summary.failed > 0 ? result!.summary.failed : '✓'}
          </div>
          <div
            className={`text-sm font-bold ${
              result!.summary.failed > 0 ? 'text-amber-600' : 'text-green-600'
            }`}
          >
            {result!.summary.failed > 0 ? 'Failed' : 'All Successful'}
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-center">
          <div className="text-3xl font-black text-blue-700 mb-1">
            {Math.round(avgConf * 100)}%
          </div>
          <div className="text-sm text-blue-600 font-bold">Avg Quality</div>
        </div>
      </div>

      <div className="bg-teal-50 border border-teal-200 rounded-xl px-5 py-3 text-sm text-teal-700 font-medium">
        ✅ DeepSeek AI · KICD Aligned · {context.curriculumMode === 'cbc_senior' ? 'CBC Senior' : context.curriculumMode} · {context.gradeName}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 bg-teal-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-teal-700 transition"
        >
          <Download className="w-4 h-4" /> Download PDF
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save to My Schemes'}
        </button>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 border border-gray-300 text-gray-600 px-5 py-3 rounded-xl font-bold hover:bg-gray-50 transition"
        >
          Regenerate
        </button>
        <button
          onClick={onReset}
          className="flex items-center gap-2 border border-gray-300 text-gray-600 px-5 py-3 rounded-xl font-bold hover:bg-gray-50 transition"
        >
          <Plus className="w-4 h-4" /> New SOW
        </button>
      </div>

      {saveSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3 flex items-center gap-2 text-green-700 font-bold text-sm">
          <CheckCircle2 className="w-4 h-4" /> Scheme saved successfully!
        </div>
      )}

      {savedSowId && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4">
          <div className="flex items-start gap-3">
            <BookOpen className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-blue-900 mb-1">Lesson plans will auto-generate every Friday</div>
              <p className="text-sm text-blue-700 mb-3">
                First batch ready: next Friday at 6PM EAT. Or generate Week 1 right now.
              </p>
              {week1Generated ? (
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-green-700">
                    <CheckCircle2 className="w-4 h-4" /> Week 1 lesson plans ready!
                  </span>
                  <Link
                    href={`/teacher/lesson-plans?sowId=${savedSowId}`}
                    className="flex items-center gap-1.5 text-sm font-bold text-blue-700 hover:text-blue-900 underline"
                  >
                    View Lesson Plans
                  </Link>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleGenerateWeek1}
                    disabled={generatingWeek1}
                    className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-60 text-sm"
                  >
                    {generatingWeek1 ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                    ) : (
                      <><Zap className="w-4 h-4" /> Generate Week 1 Now</>
                    )}
                  </button>
                  <Link
                    href={`/teacher/lesson-plans?sowId=${savedSowId}`}
                    className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-900"
                  >
                    <BookOpen className="w-4 h-4" /> View Lesson Plans
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preview table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-black text-gray-900">Lesson Preview</h2>
            <p className="text-sm text-gray-500">Click any row to expand. Edit reflection column directly.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-225">
            <thead>
              <tr className="bg-slate-700">
                {['WK', 'LSN', colConfig.col3, colConfig.col4, colConfig.col5,
                  colConfig.col6,
                  ...(colConfig.hasInquiryQuestions ? [colConfig.col7!] : []),
                  colConfig.col8, colConfig.col9, colConfig.col10 || 'REFLECTION'
                ].map(h => (
                  <th
                    key={h}
                    className="text-left px-3 py-3 text-xs font-bold text-white whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows}
            </tbody>
          </table>
        </div>
      </div>

      {/* Failures */}
      {result!.failures.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <h3 className="font-black text-red-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {result!.failures.length} lesson{result!.failures.length !== 1 ? 's' : ''} failed to generate
          </h3>
          <div className="space-y-1">
            {result!.failures.map((f, i) => (
              <div key={i} className="text-sm text-red-700">
                Week {f.week} Lesson {f.lesson} · {f.substrand}: {f.error}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-start">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 px-5 py-3 rounded-xl border border-gray-200 font-bold hover:bg-gray-50 transition"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
      </div>
    </div>
  )
}

// ─── Lesson row sub-component ──────────────────────────────────────────────────

function LessonRow({
  lesson,
  defaultExpanded,
  reflection,
  onReflectionChange,
  hasCBC,
}: {
  lesson: GeneratedLesson
  defaultExpanded: boolean
  reflection: string
  onReflectionChange: (val: string) => void
  hasCBC: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const confPct = Math.round(lesson._confidence * 100)
  const confColor =
    confPct >= 85 ? 'text-green-600' : confPct >= 70 ? 'text-amber-600' : 'text-red-500'

  return (
    <tr
      className={`border-b border-gray-100 cursor-pointer transition ${
        expanded ? 'bg-teal-50/20' : 'hover:bg-gray-50'
      }`}
      onClick={() => setExpanded(e => !e)}
    >
      <td className="px-3 py-3 font-bold text-gray-700 align-top text-xs">{lesson.week}</td>
      <td className="px-3 py-3 font-bold text-gray-700 align-top text-xs">{lesson.lesson}</td>
      <td className="px-3 py-3 text-gray-700 align-top text-xs max-w-22.5">{lesson.strand}</td>
      <td className="px-3 py-3 text-gray-700 align-top text-xs max-w-22.5">{lesson.substrand}</td>
      <td className="px-3 py-3 align-top">
        {expanded ? (
          <ul className="text-xs text-gray-700 space-y-1 list-disc pl-3">
            {lesson.learningOutcomes.map((o, i) => <li key={i}>{o}</li>)}
          </ul>
        ) : (
          <span className="text-xs text-gray-500 line-clamp-2">{lesson.learningOutcomes[0]}</span>
        )}
      </td>
      <td className="px-3 py-3 align-top">
        {expanded ? (
          <ul className="text-xs text-gray-700 space-y-1 list-disc pl-3">
            {lesson.learningExperiences.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        ) : (
          <span className="text-xs text-gray-500 line-clamp-1">{lesson.learningExperiences[0]}</span>
        )}
      </td>
      {hasCBC && (
        <td className="px-3 py-3 align-top">
          {expanded ? (
            <ul className="text-xs text-gray-700 space-y-1 list-disc pl-3">
              {lesson.keyInquiryQuestions.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          ) : (
            <span className="text-xs text-gray-500 line-clamp-1">{lesson.keyInquiryQuestions[0]}</span>
          )}
        </td>
      )}
      <td className="px-3 py-3 align-top">
        {expanded ? (
          <ul className="text-xs text-gray-700 space-y-1 list-disc pl-3">
            {lesson.learningResources.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        ) : (
          <span className="text-xs text-gray-500 line-clamp-1">{lesson.learningResources.join(', ')}</span>
        )}
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-600">{lesson.assessmentMethods.join(', ')}</span>
          {expanded && (
            <span className={`text-[10px] font-bold ${confColor}`}>
              {confPct}% quality
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-3 align-top" onClick={e => e.stopPropagation()}>
        <textarea
          rows={expanded ? 3 : 1}
          value={reflection}
          onChange={e => onReflectionChange(e.target.value)}
          placeholder="Add reflection…"
          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 resize-none focus:outline-none focus:border-teal-400 min-w-20"
        />
      </td>
    </tr>
  )
}
