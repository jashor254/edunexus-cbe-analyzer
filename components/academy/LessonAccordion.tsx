'use client'

import { useState, useTransition } from 'react'
import {
  ChevronDown,
  CheckCircle2,
  Circle,
  Loader2,
  PenLine,
  ExternalLink,
  BookOpen,
  Sparkles,
  TrendingUp,
  ChevronRight,
} from 'lucide-react'
import Link from 'next/link'
import EvidencePanel from '@/components/academy/EvidencePanel'
import type { LessonWithCompletion, AcademyReflection, ReflectionFeedback, AcademyEvidence, RecentPlan } from '@/lib/academy/types'

interface Props {
  lessons: LessonWithCompletion[]
  moduleColor: string
  moduleId: string
  initialReflections: Record<string, AcademyReflection>
  initialEvidence: Record<string, AcademyEvidence[]>
  recentPlans: RecentPlan[]
}

const PRACTICE_MIN_CHARS = 15

const REFLECTION_QUESTIONS = [
  { key: 'tried',       label: 'What did you try in your classroom based on this lesson?', placeholder: 'Describe the activity, class, and subject…' },
  { key: 'worked',      label: 'What worked? (name the class, subject, what happened)',     placeholder: 'Be specific — what did learners respond to?' },
  { key: 'failed',      label: 'What was difficult or did not work?',                       placeholder: 'Honest assessment — what fell flat?' },
  { key: 'surprised',   label: 'What surprised you?',                                       placeholder: 'Something you did not expect from learners or the AI…' },
  { key: 'next_action', label: 'What will you do differently next time?',                   placeholder: 'One concrete change you will make…' },
] as const

type ReflectionKey = (typeof REFLECTION_QUESTIONS)[number]['key']

type ReflectionState = Record<ReflectionKey, string>

const EMPTY_REFLECTION: ReflectionState = {
  tried: '', worked: '', failed: '', surprised: '', next_action: '',
}

const SCORE_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'Surface',       color: '#64748b', bg: '#f1f5f9' },
  2: { label: 'Developing',    color: '#d97706', bg: '#fffbeb' },
  3: { label: 'Thoughtful',    color: '#0891b2', bg: '#ecfeff' },
  4: { label: 'Deep',          color: '#7c3aed', bg: '#f5f3ff' },
  5: { label: 'Transformative',color: '#059669', bg: '#ecfdf5' },
}

const GROWTH_ICONS: Record<string, string> = {
  surface:       '🌱',
  developing:    '🌿',
  deep:          '🌳',
  transformative:'✨',
}

export default function LessonAccordion({ lessons: initial, moduleColor, moduleId, initialReflections, initialEvidence, recentPlans }: Props) {
  const [lessons, setLessons] = useState<LessonWithCompletion[]>(initial)
  const [openId, setOpenId] = useState<string | null>(() => {
    const first = initial.find(l => !l.completed)
    return first?.id ?? initial[0]?.id ?? null
  })
  const [isPending, startTransition] = useTransition()
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, string>>({})

  // Reflection state per lesson
  const [reflections, setReflections] = useState<Record<string, AcademyReflection>>(initialReflections)
  const [reflectOpenId, setReflectOpenId] = useState<string | null>(null)
  const [reflectionDrafts, setReflectionDrafts] = useState<Record<string, ReflectionState>>({})
  const [submittingReflectionId, setSubmittingReflectionId] = useState<string | null>(null)
  const [reflectionFeedback, setReflectionFeedback] = useState<Record<string, ReflectionFeedback>>({})
  const [reflectionErrors, setReflectionErrors] = useState<Record<string, string>>({})

  function toggle(id: string) {
    setOpenId(prev => (prev === id ? null : id))
  }

  function handlePracticeChange(lessonId: string, value: string) {
    setPracticeAnswers(prev => ({ ...prev, [lessonId]: value }))
  }

  function canComplete(lesson: LessonWithCompletion): boolean {
    if (!lesson.practice_prompt) return true
    return (practiceAnswers[lesson.id] ?? '').trim().length >= PRACTICE_MIN_CHARS
  }

  async function handleMarkComplete(lessonId: string) {
    setMarkingId(lessonId)
    try {
      const res = await fetch('/api/academy/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson_id: lessonId, answer: practiceAnswers[lessonId] ?? '' }),
      })
      if (!res.ok) throw new Error('Failed to save progress')

      startTransition(() => {
        setLessons(prev =>
          prev.map(l =>
            l.id === lessonId
              ? { ...l, completed: true, completed_at: new Date().toISOString() }
              : l
          )
        )
        // Auto-open reflection panel for the just-completed lesson
        setReflectOpenId(lessonId)
        // Advance accordion to next incomplete
        const idx = lessons.findIndex(l => l.id === lessonId)
        const next = lessons.slice(idx + 1).find(l => !l.completed && l.id !== lessonId)
        if (next) setOpenId(next.id)
      })
    } catch {
      // keep state — user can retry
    } finally {
      setMarkingId(null)
    }
  }

  function getDraft(lessonId: string): ReflectionState {
    return reflectionDrafts[lessonId] ?? EMPTY_REFLECTION
  }

  function updateDraft(lessonId: string, key: ReflectionKey, value: string) {
    setReflectionDrafts(prev => ({
      ...prev,
      [lessonId]: { ...(prev[lessonId] ?? EMPTY_REFLECTION), [key]: value },
    }))
  }

  function canSubmitReflection(lessonId: string): boolean {
    const draft = getDraft(lessonId)
    return (
      draft.tried.trim().length > 10 &&
      draft.worked.trim().length > 10 &&
      draft.failed.trim().length > 10 &&
      draft.next_action.trim().length > 10
    )
  }

  async function handleSubmitReflection(lessonId: string, moduleIdParam: string) {
    const draft = getDraft(lessonId)
    setSubmittingReflectionId(lessonId)
    setReflectionErrors(prev => ({ ...prev, [lessonId]: '' }))

    try {
      const res = await fetch('/api/academy/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson_id: lessonId, module_id: moduleIdParam, ...draft }),
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        setReflectionErrors(prev => ({
          ...prev,
          [lessonId]: json.error ?? 'Could not save reflection. Please try again.',
        }))
        return
      }

      setReflections(prev => ({ ...prev, [lessonId]: json.data.reflection }))
      setReflectionFeedback(prev => ({ ...prev, [lessonId]: json.data.feedback }))
    } catch {
      setReflectionErrors(prev => ({
        ...prev,
        [lessonId]: 'Network error — please check your connection and try again.',
      }))
    } finally {
      setSubmittingReflectionId(null)
    }
  }

  return (
    <div className="space-y-3">
      {lessons.map((lesson, idx) => {
        const isOpen     = openId === lesson.id
        const isMarking  = markingId === lesson.id
        const practiceText = practiceAnswers[lesson.id] ?? ''
        const ready      = canComplete(lesson)
        const charsLeft  = lesson.practice_prompt
          ? Math.max(0, PRACTICE_MIN_CHARS - practiceText.trim().length)
          : 0

        const existingReflection = reflections[lesson.id] ?? null
        const isReflectOpen      = reflectOpenId === lesson.id
        const draft              = getDraft(lesson.id)
        const isSubmitting       = submittingReflectionId === lesson.id
        const feedback           = reflectionFeedback[lesson.id] ?? null
        const reflectError       = reflectionErrors[lesson.id] ?? ''
        const showFeedback       = feedback !== null || (existingReflection?.ai_feedback ?? null) !== null

        return (
          <div
            key={lesson.id}
            className={`bg-white rounded-2xl border transition-all overflow-hidden ${
              lesson.completed
                ? 'border-emerald-100'
                : isOpen
                ? 'border-gray-200 shadow-sm'
                : 'border-gray-100'
            }`}
          >
            {/* Lesson header */}
            <button
              onClick={() => toggle(lesson.id)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="shrink-0">
                {lesson.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Circle
                    className="w-5 h-5"
                    style={{ color: isOpen ? moduleColor : '#d1d5db' }}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-gray-400 font-semibold">Lesson {idx + 1}</span>
                  {lesson.completed && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded font-bold">
                      Done
                    </span>
                  )}
                  {lesson.completed && existingReflection && !existingReflection.is_fallback && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-bold border"
                      style={{
                        background: SCORE_LABELS[existingReflection.quality_score ?? 2]?.bg ?? '#f1f5f9',
                        color: SCORE_LABELS[existingReflection.quality_score ?? 2]?.color ?? '#64748b',
                        borderColor: SCORE_LABELS[existingReflection.quality_score ?? 2]?.color ?? '#cbd5e1',
                      }}
                    >
                      {GROWTH_ICONS[existingReflection.ai_feedback ? 'deep' : 'developing']} Reflected
                    </span>
                  )}
                  {lesson.completed && existingReflection && existingReflection.is_fallback && (
                    <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-100 px-1.5 py-0.5 rounded font-bold">
                      Reflected
                    </span>
                  )}
                  {lesson.completed && !existingReflection && (
                    <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-100 px-1.5 py-0.5 rounded font-bold">
                      Reflect ↓
                    </span>
                  )}
                </div>
                <div className="font-black text-gray-900 text-sm mt-0.5 truncate">{lesson.title}</div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Lesson content */}
            {isOpen && (
              <div className="px-5 pb-5">

                {/* Learning objective */}
                {'learning_objective' in lesson && lesson.learning_objective && (
                  <div className="mb-4 flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <BookOpen className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                    <div>
                      <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide mb-0.5">Learning objective</p>
                      <p className="text-sm text-slate-700 leading-relaxed">{(lesson as LessonWithCompletion & { learning_objective: string }).learning_objective}</p>
                    </div>
                  </div>
                )}

                {/* lesson.content is academy_lessons.content — RLS on that table grants only
                    an "authenticated read" SELECT policy (no INSERT/UPDATE policy exists at
                    all), and no route or component in this codebase ever writes to it.
                    Content is admin-seeded curriculum, never learner/teacher/AI input, so
                    this is not a live XSS sink today. If a write path is ever added, sanitize
                    with an allowlist-based sanitizer (e.g. DOMPurify) before this changes. */}
                <div
                  className="prose prose-sm max-w-none text-gray-700 prose-headings:text-gray-900 prose-headings:font-black mb-5"
                  dangerouslySetInnerHTML={{ __html: lesson.content }}
                />

                {/* Practice in EduNexus CTA */}
                {lesson.practice_link && (
                  <div className="mb-4 flex items-center gap-3 p-3.5 rounded-xl bg-teal-50 border border-teal-100">
                    <div className="shrink-0 w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
                      <ExternalLink className="w-4 h-4 text-teal-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-teal-800">Practice this in EduNexus</p>
                      <p className="text-[11px] text-teal-600">Open the tool this lesson is about — try it on your real classes.</p>
                    </div>
                    <Link
                      href={lesson.practice_link}
                      className="shrink-0 text-[11px] font-black text-white bg-teal-500 hover:bg-teal-600 px-3 py-1.5 rounded-lg transition flex items-center gap-1"
                    >
                      Open <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                )}

                {/* Practice prompt */}
                {!lesson.completed && lesson.practice_prompt && (
                  <div className="mb-5 rounded-xl border-2 border-dashed border-gray-200 p-4 bg-gray-50">
                    <div className="flex items-center gap-2 mb-2">
                      <PenLine className="w-4 h-4 shrink-0" style={{ color: moduleColor }} />
                      <span className="text-xs font-black text-gray-700">Before you continue — write your answer</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3 leading-relaxed">{lesson.practice_prompt}</p>
                    <textarea
                      value={practiceText}
                      onChange={e => handlePracticeChange(lesson.id, e.target.value)}
                      placeholder="Type your answer here…"
                      rows={3}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 resize-none"
                      style={{ '--tw-ring-color': moduleColor } as React.CSSProperties}
                    />
                    {charsLeft > 0 && (
                      <p className="text-[11px] text-gray-400 mt-1.5">
                        Keep going — {charsLeft} more {charsLeft === 1 ? 'character' : 'characters'}
                      </p>
                    )}
                  </div>
                )}

                {/* Mark complete button */}
                {!lesson.completed && (
                  <button
                    onClick={() => handleMarkComplete(lesson.id)}
                    disabled={isMarking || isPending || !ready}
                    title={!ready ? 'Write your answer above first' : undefined}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: moduleColor }}
                  >
                    {isMarking ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                    ) : (
                      <><CheckCircle2 className="w-4 h-4" /> Mark as Complete</>
                    )}
                  </button>
                )}

                {/* Completed timestamp */}
                {lesson.completed && lesson.completed_at && (
                  <p className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Completed {new Date(lesson.completed_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
            )}

            {/* ── Evidence panel ───────────────────────────────────────────── */}
            {lesson.completed && (
              <EvidencePanel
                lessonId={lesson.id}
                moduleColor={moduleColor}
                initialEvidence={initialEvidence[lesson.id] ?? []}
                recentPlans={recentPlans}
              />
            )}

            {/* ── Reflection panel ─────────────────────────────────────────── */}
            {lesson.completed && (
              <div className="border-t border-gray-100">
                {/* Reflection toggle header */}
                <button
                  onClick={() => setReflectOpenId(prev => prev === lesson.id ? null : lesson.id)}
                  className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles
                      className="w-4 h-4"
                      style={{ color: existingReflection ? moduleColor : '#f59e0b' }}
                    />
                    <span
                      className="text-xs font-black"
                      style={{ color: existingReflection ? moduleColor : '#d97706' }}
                    >
                      {existingReflection ? 'View / Update Reflection' : 'Reflect on this lesson'}
                    </span>
                    {!existingReflection && (
                      <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-100 px-1.5 py-0.5 rounded font-bold">
                        Recommended
                      </span>
                    )}
                    {existingReflection?.quality_score && !existingReflection.is_fallback && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-bold border"
                        style={{
                          background: SCORE_LABELS[existingReflection.quality_score]?.bg,
                          color:      SCORE_LABELS[existingReflection.quality_score]?.color,
                          borderColor: SCORE_LABELS[existingReflection.quality_score]?.color,
                        }}
                      >
                        {SCORE_LABELS[existingReflection.quality_score]?.label}
                      </span>
                    )}
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 text-gray-400 transition-transform ${isReflectOpen ? 'rotate-90' : ''}`}
                  />
                </button>

                {/* Reflection form / feedback */}
                {isReflectOpen && (
                  <div className="px-5 pb-5 space-y-4">

                    {/* If feedback already received, show it first */}
                    {showFeedback && (
                      <FeedbackCard
                        feedback={feedback}
                        existing={existingReflection}
                        moduleColor={moduleColor}
                      />
                    )}

                    {/* Form — always shown so teachers can improve their reflection */}
                    <div className="space-y-3">
                      {REFLECTION_QUESTIONS.map(q => (
                        <div key={q.key}>
                          <label className="block text-xs font-black text-gray-700 mb-1.5">
                            {q.label}
                          </label>
                          <textarea
                            value={draft[q.key]}
                            onChange={e => updateDraft(lesson.id, q.key, e.target.value)}
                            placeholder={
                              existingReflection
                                ? (existingReflection[q.key] || q.placeholder)
                                : q.placeholder
                            }
                            rows={2}
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 resize-none"
                            style={{ '--tw-ring-color': moduleColor } as React.CSSProperties}
                          />
                        </div>
                      ))}
                    </div>

                    {reflectError && (
                      <p className="text-xs text-red-600 font-semibold">{reflectError}</p>
                    )}

                    <button
                      onClick={() => handleSubmitReflection(lesson.id, moduleId)}
                      disabled={isSubmitting || !canSubmitReflection(lesson.id)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: moduleColor }}
                    >
                      {isSubmitting ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Getting AI feedback…</>
                      ) : existingReflection ? (
                        <><Sparkles className="w-4 h-4" /> Update Reflection</>
                      ) : (
                        <><Sparkles className="w-4 h-4" /> Submit Reflection</>
                      )}
                    </button>

                    {!canSubmitReflection(lesson.id) && (
                      <p className="text-[11px] text-gray-400">
                        Answer at least 4 of the 5 questions (10+ characters each) to submit.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Feedback card ─────────────────────────────────────────────────────────────

function FeedbackCard({
  feedback,
  existing,
  moduleColor,
}: {
  feedback: ReflectionFeedback | null
  existing: AcademyReflection | null
  moduleColor: string
}) {
  const score      = feedback?.quality_score    ?? existing?.quality_score    ?? null
  const text       = feedback?.feedback_text    ?? existing?.ai_feedback      ?? null
  const next       = feedback?.suggested_next_action ?? null
  const growth     = feedback?.growth_indicator ?? null
  const isFallback = feedback?.isFallback ?? existing?.is_fallback ?? false

  if (!text) return null

  // A fallback score is not a genuine AI judgement — never present it with
  // the same "AI Feedback" scored styling as a real evaluation.
  if (isFallback) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-1.5">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 shrink-0 text-amber-500" />
          <span className="text-xs font-black text-amber-700">Reflection received — AI review pending</span>
        </div>
        <p className="text-sm text-amber-800 leading-relaxed">{text}</p>
      </div>
    )
  }

  const meta = score ? SCORE_LABELS[score] : null

  return (
    <div
      className="rounded-xl border p-4 space-y-2"
      style={{
        background: meta?.bg ?? '#f8fafc',
        borderColor: meta?.color ? `${meta.color}30` : '#e2e8f0',
      }}
    >
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 shrink-0" style={{ color: meta?.color ?? moduleColor }} />
        <span className="text-xs font-black" style={{ color: meta?.color ?? moduleColor }}>
          AI Feedback
          {score && ` · ${meta?.label} reflection`}
          {growth && ` ${GROWTH_ICONS[growth] ?? ''}`}
        </span>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
      {next && (
        <div className="pt-1 border-t border-gray-200/60">
          <p className="text-[11px] font-black text-gray-500 uppercase tracking-wide mb-1">Next step</p>
          <p className="text-xs text-gray-600 leading-relaxed">{next}</p>
        </div>
      )}
    </div>
  )
}
