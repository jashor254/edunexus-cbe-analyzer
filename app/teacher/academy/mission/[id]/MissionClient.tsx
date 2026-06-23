'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Copy,
  Check,
  Loader2,
  ExternalLink,
  Zap,
  Award,
  CheckCircle2,
  TrendingUp,
  ChevronRight,
  Star,
  Target,
} from 'lucide-react'
import type { MissionWithCompletion, MissionVerdict, RubricDimension } from '@/lib/academy/types'

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  compare:     { label: 'Compare',     color: '#7c3aed', bg: '#f5f3ff' },
  investigate: { label: 'Investigate', color: '#0891b2', bg: '#ecfeff' },
  apply:       { label: 'Apply',       color: '#059669', bg: '#ecfdf5' },
  create:      { label: 'Create',      color: '#d97706', bg: '#fffbeb' },
  teach:       { label: 'Teach',       color: '#dc2626', bg: '#fef2f2' },
  build:       { label: 'Build',       color: '#1d4ed8', bg: '#eff6ff' },
}

const SCORE_LABELS: Record<number, string> = {
  1: 'Superficial',
  2: 'Basic',
  3: 'Solid',
  4: 'Sharp',
  5: 'Expert',
}

interface Props {
  mission: MissionWithCompletion
  moduleColor: string
}

export default function MissionClient({ mission, moduleColor }: Props) {
  const typeMeta = TYPE_META[mission.mission_type] ?? TYPE_META.apply
  const hasRubric = (mission.evaluation_rubric?.dimensions?.length ?? 0) > 0
  const isCompleted = mission.completion !== null

  const [toolAOutput, setToolAOutput]       = useState(mission.completion?.tool_a_output ?? '')
  const [toolBOutput, setToolBOutput]       = useState(mission.completion?.tool_b_output ?? '')
  const [comparisonNotes, setComparisonNotes] = useState(mission.completion?.comparison_notes ?? '')
  const [selfScores, setSelfScores]         = useState<Record<string, number>>(
    (mission.completion?.self_scores as Record<string, number>) ?? {}
  )
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState('')
  const [verdict, setVerdict]         = useState<MissionVerdict | null>(null)
  const [xpEarned, setXpEarned]       = useState<number | null>(null)
  const [copied, setCopied]           = useState(false)
  const [submitted, setSubmitted]     = useState(false)

  const showExistingVerdict = isCompleted && !submitted && mission.completion

  function canSubmit(): boolean {
    if (comparisonNotes.trim().length < 20) return false
    if (mission.mission_type === 'compare' && !toolAOutput.trim() && !toolBOutput.trim()) return false
    return true
  }

  async function handleCopyPrompt() {
    if (!mission.tool_a_prompt) return
    await navigator.clipboard.writeText(mission.tool_a_prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSubmit() {
    if (!canSubmit()) return
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/academy/mission/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mission_id:       mission.id,
          tool_a_output:    toolAOutput,
          tool_b_output:    toolBOutput,
          comparison_notes: comparisonNotes,
          self_scores:      selfScores,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json.error ?? 'Could not save mission. Please try again.')
        return
      }
      setVerdict(json.data.verdict)
      setXpEarned(json.data.xp_earned)
      setSubmitted(true)
    } catch {
      setError('Network error — please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Mission header */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span
            className="text-[11px] font-black px-2.5 py-1 rounded-lg"
            style={{ background: typeMeta.bg, color: typeMeta.color }}
          >
            {typeMeta.label} Mission
          </span>
          <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-lg">
            <Zap className="w-3 h-3" /> {mission.xp_reward} XP
          </span>
          {isCompleted && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-lg border border-emerald-400/20">
              <CheckCircle2 className="w-3 h-3" /> Completed
            </span>
          )}
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">{mission.title}</h1>
        <p className="text-slate-400 mt-2 text-sm leading-relaxed max-w-xl">{mission.description}</p>
      </div>

      {/* Instructions */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-teal-400" />
          <span className="text-xs font-black text-teal-400 uppercase tracking-wider">Mission Brief</span>
        </div>
        <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{mission.instructions}</p>
      </div>

      {/* Existing verdict (already completed) */}
      {showExistingVerdict && mission.completion && (
        <VerdictCard
          verdict={{
            ai_score: (mission.completion.ai_score ?? 3) as MissionVerdict['ai_score'],
            ai_verdict: mission.completion.ai_verdict ?? '',
            key_insight: '',
            suggested_next_action: '',
          }}
          xpEarned={0}
          moduleColor={moduleColor}
          isExisting
        />
      )}

      {/* Submission form */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="h-1.5 w-full" style={{ background: moduleColor }} />
        <div className="p-6 space-y-6">

          {/* Step 1: Tool A prompt (compare/investigate missions) */}
          {mission.tool_a_prompt && (
            <div>
              <StepLabel number={1} label={`Use ${mission.tool_a_label ?? 'the external tool'}`} color={moduleColor} />
              <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-4 relative">
                <p className="text-xs font-black text-slate-500 uppercase tracking-wide mb-2">Copy this prompt</p>
                <p className="text-sm text-slate-700 leading-relaxed font-mono whitespace-pre-wrap">
                  {mission.tool_a_prompt}
                </p>
                <button
                  onClick={handleCopyPrompt}
                  className="absolute top-3 right-3 flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1.5 rounded-lg transition"
                  style={{
                    background: copied ? '#ecfdf5' : '#f1f5f9',
                    color: copied ? '#059669' : '#475569',
                  }}
                >
                  {copied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
              </div>

              {mission.tool_a_label && (
                <div className="mt-3">
                  <label className="block text-xs font-black text-gray-700 mb-1.5">
                    Paste the {mission.tool_a_label} response here
                  </label>
                  <textarea
                    value={toolAOutput}
                    onChange={e => setToolAOutput(e.target.value)}
                    placeholder={`Paste what ${mission.tool_a_label} gave you…`}
                    rows={5}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 resize-none"
                    style={{ '--tw-ring-color': moduleColor } as React.CSSProperties}
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Tool B — EduNexus link */}
          {mission.tool_b_link && (
            <div>
              <StepLabel
                number={mission.tool_a_prompt ? 2 : 1}
                label={`Use ${mission.tool_b_label ?? 'EduNexus'}`}
                color={moduleColor}
              />
              <div className="mt-3 flex items-center gap-3 p-3.5 rounded-xl bg-teal-50 border border-teal-100">
                <div className="shrink-0 w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
                  <ExternalLink className="w-4 h-4 text-teal-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-teal-800">{mission.tool_b_label ?? 'EduNexus'}</p>
                  <p className="text-[11px] text-teal-600">Open the tool, complete the task, then come back here.</p>
                </div>
                <Link
                  href={mission.tool_b_link}
                  target="_blank"
                  className="shrink-0 text-[11px] font-black text-white bg-teal-500 hover:bg-teal-600 px-3 py-1.5 rounded-lg transition flex items-center gap-1"
                >
                  Open <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              {mission.tool_b_label && (
                <div className="mt-3">
                  <label className="block text-xs font-black text-gray-700 mb-1.5">
                    Describe or paste what {mission.tool_b_label} produced
                  </label>
                  <textarea
                    value={toolBOutput}
                    onChange={e => setToolBOutput(e.target.value)}
                    placeholder={`What did ${mission.tool_b_label} give you? Describe the output or paste it here…`}
                    rows={4}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 resize-none"
                    style={{ '--tw-ring-color': moduleColor } as React.CSSProperties}
                  />
                </div>
              )}
            </div>
          )}

          {/* Rubric self-scoring */}
          {hasRubric && mission.evaluation_rubric && (
            <div>
              <StepLabel
                number={(mission.tool_a_prompt ? 1 : 0) + (mission.tool_b_link ? 1 : 0) + 1}
                label="Score the output using the AI Judgement Rubric"
                color={moduleColor}
              />
              <p className="text-xs text-gray-500 mt-1 mb-4">
                Rate the {mission.tool_a_label ?? 'AI'} output on each dimension (1 = poor, 5 = excellent).
              </p>
              <div className="space-y-4">
                {mission.evaluation_rubric.dimensions.map((dim: RubricDimension) => (
                  <RubricRow
                    key={dim.key}
                    dimension={dim}
                    value={selfScores[dim.key] ?? 0}
                    onChange={val => setSelfScores(prev => ({ ...prev, [dim.key]: val }))}
                    color={moduleColor}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Comparison notes — always shown */}
          <div>
            <StepLabel
              number={
                (mission.tool_a_prompt ? 1 : 0) +
                (mission.tool_b_link ? 1 : 0) +
                (hasRubric ? 1 : 0) + 1
              }
              label={
                mission.mission_type === 'apply'
                  ? 'What happened in your classroom?'
                  : 'Your comparison and verdict'
              }
              color={moduleColor}
            />
            <textarea
              value={comparisonNotes}
              onChange={e => setComparisonNotes(e.target.value)}
              placeholder={
                mission.mission_type === 'apply'
                  ? 'Describe what happened when you tried this. What did learners do? What worked? What surprised you?'
                  : 'Which output was better and why? What specific differences did you notice? What was missing from each one?'
              }
              rows={5}
              className="w-full mt-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 resize-none"
              style={{ '--tw-ring-color': moduleColor } as React.CSSProperties}
            />
            {comparisonNotes.trim().length < 20 && comparisonNotes.length > 0 && (
              <p className="text-[11px] text-gray-400 mt-1">Keep going — write at least a few sentences.</p>
            )}
          </div>

          {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting || !canSubmit()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black text-white transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            style={{ background: moduleColor }}
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Getting AI verdict…</>
            ) : isCompleted ? (
              <><Award className="w-4 h-4" /> Update Submission</>
            ) : (
              <><Award className="w-4 h-4" /> Submit Mission</>
            )}
          </button>
        </div>
      </div>

      {/* Fresh verdict after submission */}
      {submitted && verdict && (
        <VerdictCard
          verdict={verdict}
          xpEarned={xpEarned ?? 0}
          moduleColor={moduleColor}
          isExisting={false}
        />
      )}
    </div>
  )
}

// ── Step label ────────────────────────────────────────────────────────────────

function StepLabel({ number, label, color }: { number: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-black shrink-0"
        style={{ background: color }}
      >
        {number}
      </div>
      <span className="text-sm font-black text-gray-900">{label}</span>
    </div>
  )
}

// ── Rubric row ─────────────────────────────────────────────────────────────────

function RubricRow({
  dimension,
  value,
  onChange,
  color,
}: {
  dimension: RubricDimension
  value: number
  onChange: (v: number) => void
  color: string
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-sm font-black text-gray-900">{dimension.label}</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{dimension.description}</p>
        </div>
        {value > 0 && (
          <span
            className="shrink-0 text-[11px] font-black px-2 py-1 rounded-lg"
            style={{ background: `${color}18`, color }}
          >
            {value}/5
          </span>
        )}
      </div>
      <div className="flex gap-2 mt-3">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className="flex-1 py-1.5 rounded-lg text-xs font-black transition"
            style={
              value === n
                ? { background: color, color: '#fff' }
                : { background: '#e2e8f0', color: '#64748b' }
            }
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-0.5">
        <span>Poor</span>
        <span>Excellent</span>
      </div>
    </div>
  )
}

// ── Verdict card ──────────────────────────────────────────────────────────────

function VerdictCard({
  verdict,
  xpEarned,
  moduleColor,
  isExisting,
}: {
  verdict: MissionVerdict
  xpEarned: number
  moduleColor: string
  isExisting: boolean
}) {
  const scoreLabel = SCORE_LABELS[verdict.ai_score] ?? 'Solid'

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-yellow-300" />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: moduleColor }} />
            <span className="text-sm font-black text-gray-900">AI Verdict</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex">
              {[1, 2, 3, 4, 5].map(n => (
                <Star
                  key={n}
                  className="w-4 h-4"
                  style={{
                    fill: n <= verdict.ai_score ? '#f59e0b' : 'transparent',
                    color: n <= verdict.ai_score ? '#f59e0b' : '#d1d5db',
                  }}
                />
              ))}
            </div>
            <span className="text-xs font-black text-gray-600">{scoreLabel}</span>
            {xpEarned > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">
                <Zap className="w-3 h-3" /> +{xpEarned} XP
              </span>
            )}
          </div>
        </div>

        <p className="text-sm text-gray-700 leading-relaxed">{verdict.ai_verdict}</p>

        {verdict.key_insight && (
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide mb-1">Key insight</p>
            <p className="text-sm text-slate-700 leading-relaxed">{verdict.key_insight}</p>
          </div>
        )}

        {verdict.suggested_next_action && (
          <div className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 shrink-0 mt-0.5" style={{ color: moduleColor }} />
            <div>
              <p className="text-[11px] font-black text-gray-500 uppercase tracking-wide mb-0.5">Next step</p>
              <p className="text-xs text-gray-600 leading-relaxed">{verdict.suggested_next_action}</p>
            </div>
          </div>
        )}

        {isExisting && (
          <p className="text-[11px] text-gray-400 text-center">
            You can update your submission above to improve your score.
          </p>
        )}
      </div>
    </div>
  )
}
