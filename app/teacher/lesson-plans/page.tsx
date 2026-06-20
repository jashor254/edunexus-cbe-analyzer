'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  BookOpen,
  CheckCircle2,
  Loader2,
  Download,
  Eye,
  Pencil,
  GraduationCap,
  CalendarOff,
  Clock,
  ChevronRight,
  Zap,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface LessonPlan {
  id: string
  sow_id: string
  week_number: number
  lesson_number: number
  strand: string
  sub_strand: string
  status: 'generated' | 'edited' | 'taught'
  taught_date: string | null
  teacher_flagged_followup: 'none' | 'minor' | 'major' | null
}

interface SOW {
  id: string
  school: string
  grade: string
  learning_area: string
  term: string
  year: number
  timeline: Array<{ week: number; lesson: number; isBreak: boolean }>
  breaks: Array<{ title: string; startWeek: number; endWeek: number }>
}

interface SavedSOW {
  id: string
  learning_area: string
  grade: string
  term: string
  year: number
}

type QuickCheckContent = {
  id: string
  suggested_activity: string
  questions: string[]
  generated_at: string
}

type RemedialCard = {
  substrand_health_id: string
  sow_id: string
  strand: string
  sub_strand: string
  struggle_count: number
  root_cause: string | null
  quick_check: QuickCheckContent | null
}

const ROOT_CAUSE_LABELS: Record<string, string> = {
  PACE_MISMATCH:    'Needs more time',
  CONCEPT_LEAP:     'Big concept jump',
  PREREQUISITE_GAP: 'Prior knowledge',
  LANGUAGE_BARRIER: 'Language support',
  RESOURCE_MISMATCH:'Try different resources',
  TEACHER_STRATEGY: 'Try a new approach',
  UNKNOWN:          'Needs revisiting',
}

const STATUS_COLORS = {
  generated: 'bg-blue-50 text-blue-700 border-blue-200',
  edited:    'bg-amber-50 text-amber-700 border-amber-200',
  taught:    'bg-green-50 text-green-700 border-green-200',
}

const STATUS_LABELS = {
  generated: 'Ready',
  edited:    'Edited',
  taught:    'Taught',
}

export default function LessonPlansPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [sows, setSows] = useState<SavedSOW[]>([])
  const [selectedSowId, setSelectedSowId] = useState<string>(searchParams.get('sowId') || '')
  const [plans, setPlans] = useState<LessonPlan[]>([])
  const [sow, setSow] = useState<SOW | null>(null)
  const [selectedWeek, setSelectedWeek] = useState<number>(1)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState<number | null>(null)
  const [downloadingWeek, setDownloadingWeek] = useState<number | null>(null)
  const [pendingEvaluations, setPendingEvaluations] = useState(0)
  const [error, setError] = useState('')
  const [remedialCards, setRemedialCards] = useState<RemedialCard[]>([])
  const [generatingCheckId, setGeneratingCheckId] = useState<string | null>(null)
  const [expandedCheckId, setExpandedCheckId] = useState<string | null>(null)

  // Load available SOWs
  useEffect(() => {
    fetch('/api/sow/list')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setSows(d.data.schemes || [])
          if (!selectedSowId && d.data.schemes?.length) {
            setSelectedSowId(d.data.schemes[0].id)
          }
        }
      })
  }, [])

  const loadPlans = useCallback(async (sowId: string) => {
    if (!sowId) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/lesson-plans/list?sowId=${sowId}`)
      const d = await res.json()
      if (d.success) {
        setPlans(d.data.plans || [])
        setSow(d.data.sow || null)
        const pending = d.data.pendingEvaluations ?? 0
        setPendingEvaluations(pending)
        sessionStorage.setItem('pendingEvaluations', String(pending))
        // Set initial week to first week that has plans, or week 1
        const weeks = [...new Set((d.data.plans || []).map((p: LessonPlan) => p.week_number) as number[])].sort((a, b) => a - b)
        if (weeks.length) setSelectedWeek(weeks[0] as number)
      } else {
        setError(d.error || 'Failed to load plans')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedSowId) loadPlans(selectedSowId)
  }, [selectedSowId, loadPlans])

  useEffect(() => {
    if (!selectedSowId) return
    setRemedialCards([])
    setExpandedCheckId(null)
    fetch(`/api/teaching-intelligence/remedial-bank?sowId=${selectedSowId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setRemedialCards(d.data.cards ?? []) })
      .catch(() => {})
  }, [selectedSowId])

  async function handleGenerateQuickCheck(card: RemedialCard) {
    if (!sow || generatingCheckId) return
    setGeneratingCheckId(card.substrand_health_id)
    try {
      const res = await fetch('/api/teaching-intelligence/quick-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          substrandHealthId: card.substrand_health_id,
          sowId:             card.sow_id,
          strand:            card.strand,
          subStrand:         card.sub_strand,
          grade:             sow.grade,
          learningArea:      sow.learning_area,
          struggleCount:     card.struggle_count,
          rootCause:         card.root_cause,
        }),
      })
      const d = await res.json()
      if (d.success && d.data.quickCheck) {
        const qc = d.data.quickCheck as QuickCheckContent
        setRemedialCards(prev => prev.map(c =>
          c.substrand_health_id === card.substrand_health_id
            ? { ...c, quick_check: qc }
            : c
        ))
        setExpandedCheckId(card.substrand_health_id)
      }
    } finally {
      setGeneratingCheckId(null)
    }
  }

  async function handleGenerateWeek(weekNumber: number) {
    if (!selectedSowId) return
    setGenerating(weekNumber)
    try {
      const res = await fetch('/api/lesson-plans/generate-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sowId: selectedSowId, weekNumber }),
      })
      const d = await res.json()
      if (d.success) {
        await loadPlans(selectedSowId)
        setSelectedWeek(weekNumber)
      } else {
        setError(d.error || 'Generation failed')
      }
    } finally {
      setGenerating(null)
    }
  }

  async function handleDownloadWeek(weekNumber: number) {
    const weekPlans = plans.filter(p => p.week_number === weekNumber)
    if (!weekPlans.length) return
    setDownloadingWeek(weekNumber)
    try {
      const res = await fetch('/api/lesson-plans/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planIds: weekPlans.map(p => p.id) }),
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
      setDownloadingWeek(null)
    }
  }

  // Derive week list from SOW timeline
  const allWeeks = sow?.timeline
    ? [...new Set(sow.timeline.map(s => s.week))].sort((a, b) => a - b)
    : [...new Set(plans.map(p => p.week_number))].sort((a, b) => a - b)

  // Check if a week is a break week
  function isBreakWeek(week: number): boolean {
    if (!sow?.timeline) return false
    const slots = sow.timeline.filter(s => s.week === week)
    return slots.length > 0 && slots.every(s => s.isBreak)
  }

  function getBreakTitle(week: number): string {
    if (!sow?.breaks) return 'BREAK'
    const b = sow.breaks.find(br => br.startWeek <= week && week <= br.endWeek)
    return b?.title || 'BREAK'
  }

  function hasPlans(week: number): boolean {
    return plans.some(p => p.week_number === week)
  }

  const weekPlans = plans.filter(p => p.week_number === selectedWeek)

  if (!sows.length && !loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center shadow-sm">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Schemes of Work yet</h2>
          <p className="text-gray-500 mb-6">Generate a Scheme of Work first, then come back to create lesson plans.</p>
          <Link
            href="/sow"
            className="bg-teal-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 transition inline-flex items-center gap-2"
          >
            <Zap className="w-4 h-4" /> Generate SOW
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-teal-600" />
            Lesson Plans
            {pendingEvaluations > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-bold bg-amber-100 text-amber-700 border border-amber-300 px-2.5 py-0.5 rounded-full">
                {pendingEvaluations} taught, not evaluated
              </span>
            )}
          </h1>
          {sow && (
            <p className="text-sm text-gray-500 mt-0.5">
              {sow.learning_area} · {sow.grade} · Term {sow.term} {sow.year}
            </p>
          )}
        </div>

        {/* SOW selector */}
        {sows.length > 1 && (
          <select
            value={selectedSowId}
            onChange={e => setSelectedSowId(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium bg-white shadow-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
          >
            {sows.map(s => (
              <option key={s.id} value={s.id}>
                {s.learning_area} · {s.grade} · Term {s.term} {s.year}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* This Week's Quick Wins — only shown when the remedial bank has items */}
      {remedialCards.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
            <Sparkles className="w-4 h-4 text-teal-600" />
            <span className="font-bold text-gray-900 text-sm">This Week&apos;s Quick Wins</span>
            <span className="text-xs text-gray-400 font-medium">
              {remedialCards.length} sub-strand{remedialCards.length !== 1 ? 's' : ''} to revisit
            </span>
          </div>

          <div className="divide-y divide-gray-50">
            {remedialCards.map(card => {
              const isExpanded = expandedCheckId === card.substrand_health_id
              const isGenerating = generatingCheckId === card.substrand_health_id
              const label = card.root_cause ? ROOT_CAUSE_LABELS[card.root_cause] : null

              return (
                <div key={card.substrand_health_id}>
                  <div className="flex items-start gap-3 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm truncate">{card.sub_strand}</div>
                      <div className="text-xs text-gray-400 truncate">{card.strand}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                          {card.struggle_count} follow-up{card.struggle_count !== 1 ? 's' : ''}
                        </span>
                        {label && (
                          <span className="text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-full">
                            {label}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {card.quick_check ? (
                        <button
                          onClick={() => setExpandedCheckId(isExpanded ? null : card.substrand_health_id)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 border border-teal-200 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          View Check
                        </button>
                      ) : (
                        <button
                          onClick={() => handleGenerateQuickCheck(card)}
                          disabled={!!generatingCheckId}
                          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-60 px-3 py-1.5 rounded-lg transition"
                        >
                          {isGenerating ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                          ) : (
                            <><Zap className="w-3.5 h-3.5" /> Quick Check</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && card.quick_check && (
                    <div className="mx-5 mb-4 bg-teal-50 border border-teal-100 rounded-xl p-4 space-y-3">
                      <div>
                        <div className="text-xs font-bold text-teal-700 uppercase tracking-wide mb-1">10-Minute Activity</div>
                        <p className="text-sm text-gray-800 leading-relaxed">{card.quick_check.suggested_activity}</p>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-teal-700 uppercase tracking-wide mb-1">Check for Understanding</div>
                        <ol className="space-y-1.5">
                          {card.quick_check.questions.map((q, i) => (
                            <li key={i} className="text-sm text-gray-800 flex gap-2">
                              <span className="text-teal-600 font-bold shrink-0">{i + 1}.</span>
                              <span>{q}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-red-700 text-sm font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-4">

          {/* Week sidebar — horizontal scroll on mobile, vertical list on desktop */}
          <div className="md:w-28 shrink-0">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide px-2 mb-2">Weeks</div>
            <div className="flex flex-row md:flex-col gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {allWeeks.map(week => {
              const isBreak = isBreakWeek(week)
              const hasPlan = hasPlans(week)
              const isSelected = selectedWeek === week

              return (
                <button
                  key={week}
                  onClick={() => !isBreak && setSelectedWeek(week)}
                  disabled={isBreak}
                  className={`
                    shrink-0 md:w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition whitespace-nowrap
                    ${isSelected && !isBreak ? 'bg-teal-600 text-white shadow-sm' : ''}
                    ${!isSelected && !isBreak ? 'text-gray-700 hover:bg-gray-100' : ''}
                    ${isBreak ? 'text-amber-600 bg-amber-50 cursor-default text-xs' : ''}
                  `}
                >
                  {isBreak ? (
                    <>
                      <CalendarOff className="w-3 h-3 mb-0.5" />
                      <span>W{week}</span>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span>W{week}</span>
                      {hasPlan && !isSelected && (
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                      )}
                    </div>
                  )}
                </button>
              )
            })}
            </div>
          </div>

          {/* Main content area */}
          <div className="flex-1 min-w-0">
            {isBreakWeek(selectedWeek) ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
                <CalendarOff className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                <div className="font-bold text-amber-800 text-lg">{getBreakTitle(selectedWeek)}</div>
                <p className="text-amber-600 text-sm mt-1">No lesson plans for this week</p>
              </div>
            ) : weekPlans.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
                <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <div className="font-bold text-gray-800 text-lg mb-1">Week {selectedWeek} — No plans yet</div>
                <p className="text-gray-400 text-sm mb-5">
                  Plans generate automatically every Friday, or generate now.
                </p>
                <button
                  onClick={() => handleGenerateWeek(selectedWeek)}
                  disabled={generating === selectedWeek}
                  className="bg-teal-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-teal-700 transition inline-flex items-center gap-2 disabled:opacity-60"
                >
                  {generating === selectedWeek ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                  ) : (
                    <><Zap className="w-4 h-4" /> Generate Week {selectedWeek} Now</>
                  )}
                </button>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                {/* Week header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-teal-50 rounded-full flex items-center justify-center">
                      <span className="text-teal-700 font-black text-sm">{weekPlans.length}</span>
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">Week {selectedWeek}</div>
                      <div className="text-xs text-gray-500">{weekPlans.length} lesson{weekPlans.length !== 1 ? 's' : ''} ready</div>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {(() => {
                      const weekPending = weekPlans.filter(
                        p => p.status === 'taught' && !p.teacher_flagged_followup
                      ).length
                      return weekPending > 0 ? (
                        <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                          {weekPending} lesson{weekPending !== 1 ? 's' : ''} not yet evaluated
                        </span>
                      ) : null
                    })()}
                    <button
                      onClick={() => handleDownloadWeek(selectedWeek)}
                      disabled={downloadingWeek === selectedWeek}
                      className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-teal-700 border border-gray-200 hover:border-teal-300 px-4 py-2 rounded-xl transition disabled:opacity-60"
                    >
                      {downloadingWeek === selectedWeek ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Download All Week {selectedWeek}
                    </button>
                  </div>
                </div>

                {/* Lesson rows */}
                <div className="divide-y divide-gray-50">
                  {weekPlans.map(plan => (
                    <div key={plan.id} className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-bold text-gray-400">L{plan.lesson_number}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[plan.status]}`}>
                            {STATUS_LABELS[plan.status]}
                          </span>
                        </div>
                        <div className="font-semibold text-gray-900 text-sm truncate">{plan.sub_strand}</div>
                        <div className="text-xs text-gray-400 truncate">{plan.strand}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          href={`/teacher/lesson-plans/${plan.id}`}
                          className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-teal-700 border border-gray-200 hover:border-teal-300 px-3 py-1.5 rounded-lg transition"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </Link>
                        <Link
                          href={`/teacher/lesson-plans/${plan.id}?edit=1`}
                          className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-blue-700 border border-gray-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </Link>
                        <Link
                          href={`/teacher/lesson-plans/${plan.id}?taught=1`}
                          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition border ${
                            plan.status === 'taught'
                              ? 'text-green-700 border-green-200 bg-green-50'
                              : 'text-gray-600 hover:text-green-700 border-gray-200 hover:border-green-300'
                          }`}
                        >
                          <GraduationCap className="w-3.5 h-3.5" />
                          {plan.status === 'taught' ? 'Taught' : 'Mark Taught'}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
