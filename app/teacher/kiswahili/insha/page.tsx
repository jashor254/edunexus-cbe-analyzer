'use client'

import { useState } from 'react'
import {
  BookOpen, Send, CheckCircle2, AlertTriangle,
  ChevronRight, RefreshCw, ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'
import type { InshaFeedback, InshaType, CbcLevel } from '@/lib/kiswahili/inshaEvaluator'
import { friendlyMessage } from '@/lib/errors/friendlyMessage'

// ── Constants ────────────────────────────────────────────────────────────────

const INSHA_TYPES: { value: InshaType; label: string; hint: string }[] = [
  { value: 'masimulizi', label: 'Masimulizi',  hint: 'Hadithi / Narrative' },
  { value: 'hoja',       label: 'Hoja',         hint: 'Mjadala / Argumentative' },
  { value: 'maelezo',    label: 'Maelezo',      hint: 'Uelezaji / Descriptive' },
  { value: 'barua_rasmi',label: 'Barua Rasmi',  hint: 'Formal Letter' },
  { value: 'mazungumzo', label: 'Mazungumzo',   hint: 'Dialogue' },
]

const GRADES = [7, 8, 9, 10, 11]

const DIMENSION_LABELS: Record<string, string> = {
  utangulizi: 'Utangulizi',
  kiini:      'Kiini',
  hitimisho:  'Hitimisho',
  msamiati:   'Msamiati',
  sarufi:     'Sarufi',
  mtiririko:  'Mtiririko',
}

const DIMENSION_WEIGHTS: Record<string, number> = {
  utangulizi: 12,
  kiini:      28,
  hitimisho:  12,
  msamiati:   18,
  sarufi:     18,
  mtiririko:  12,
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function levelColor(level: CbcLevel): string {
  if (level === 4) return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  if (level === 3) return 'bg-teal-100 text-teal-800 border-teal-200'
  if (level === 2) return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-rose-100 text-rose-800 border-rose-200'
}

function levelBar(level: CbcLevel): string {
  if (level === 4) return 'bg-emerald-500'
  if (level === 3) return 'bg-teal-500'
  if (level === 2) return 'bg-amber-400'
  return 'bg-rose-400'
}

function levelBig(level: CbcLevel): string {
  if (level === 4) return 'bg-emerald-500'
  if (level === 3) return 'bg-teal-500'
  if (level === 2) return 'bg-amber-400'
  return 'bg-rose-400'
}

const LEVEL_FULL: Record<CbcLevel, string> = {
  1: 'Chini ya Matarajio',
  2: 'Karibu na Matarajio',
  3: 'Kukidhi Matarajio',
  4: 'Kuzidi Matarajio',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DimensionCard({
  key: _,
  dimKey,
  dim,
}: {
  key: string
  dimKey: string
  dim: InshaFeedback['dimensions'][keyof InshaFeedback['dimensions']]
}) {
  const weight = DIMENSION_WEIGHTS[dimKey]
  const barWidth = `${(dim.score / 4) * 100}%`

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-bold text-gray-800 text-sm">{DIMENSION_LABELS[dimKey]}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{weight}%</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${levelColor(dim.score)}`}>
            {dim.label}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${levelBar(dim.score)}`}
          style={{ width: barWidth }}
        />
      </div>

      <p className="text-gray-600 text-sm leading-relaxed">{dim.mwongozo}</p>
    </div>
  )
}

function FeedbackResults({
  feedback,
  onReset,
}: {
  feedback: InshaFeedback
  onReset: () => void
}) {
  const typeLabel = INSHA_TYPES.find(t => t.value === feedback.insha_type)?.label ?? feedback.insha_type

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-gray-900">Matokeo ya Tathmini</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            Insha ya {typeLabel} · Darasa {feedback.grade}
          </p>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-teal-700 transition font-medium"
        >
          <RefreshCw className="w-4 h-4" /> Tathmini nyingine
        </button>
      </div>

      {/* Overall jumla */}
      <div className={`rounded-2xl p-5 flex items-center gap-4 text-white ${levelBig(feedback.jumla)}`}>
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-widest opacity-80">Kiwango cha Jumla</span>
          <span className="text-4xl font-black leading-none mt-1">{feedback.jumla}/4</span>
          <span className="text-lg font-bold mt-1">{LEVEL_FULL[feedback.jumla]}</span>
        </div>
        <div className="ml-auto hidden sm:block opacity-20">
          <BookOpen className="w-16 h-16" />
        </div>
      </div>

      {/* 6 Dimensions */}
      <div>
        <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-3">Vipimo Sita vya CBC</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(Object.keys(DIMENSION_LABELS) as Array<keyof InshaFeedback['dimensions']>).map(k => (
            <DimensionCard key={k} dimKey={k} dim={feedback.dimensions[k]} />
          ))}
        </div>
      </div>

      {/* Nguvu + Udhaifu */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Nguvu */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
          <h3 className="font-bold text-emerald-800 text-sm mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Nguvu
          </h3>
          <ul className="flex flex-col gap-2">
            {feedback.nguvu.map((n, i) => (
              <li key={i} className="text-sm text-emerald-700 flex gap-2">
                <span className="mt-0.5 shrink-0">•</span> {n}
              </li>
            ))}
          </ul>
        </div>

        {/* Udhaifu */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <h3 className="font-bold text-amber-800 text-sm mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> Maeneo ya Kuboresha
          </h3>
          <ul className="flex flex-col gap-2">
            {feedback.udhaifu.map((u, i) => (
              <li key={i} className="text-sm text-amber-700 flex gap-2">
                <span className="mt-0.5 shrink-0">•</span> {u}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Hatua inayofuata */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex gap-3">
        <ChevronRight className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-teal-700 uppercase tracking-wide mb-1">Hatua Inayofuata</p>
          <p className="text-teal-800 text-sm leading-relaxed">{feedback.hatua_inayofuata}</p>
        </div>
      </div>

      {/* Grammar corrections */}
      {feedback.makosa_ya_sarufi.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <h3 className="font-bold text-gray-700 text-sm mb-3">Makosa ya Sarufi</h3>
          <ul className="flex flex-col gap-2">
            {feedback.makosa_ya_sarufi.map((m, i) => (
              <li key={i} className="text-sm text-gray-600 font-mono bg-gray-50 rounded-lg px-3 py-2">
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ngeli errors */}
      {feedback.ngeli_zilizokosewa.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <h3 className="font-bold text-gray-700 text-sm mb-3">Ngeli Zilizokosewa</h3>
          <ul className="flex flex-col gap-2">
            {feedback.ngeli_zilizokosewa.map((n, i) => (
              <li key={i} className="text-sm text-gray-600 font-mono bg-gray-50 rounded-lg px-3 py-2">
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InshaFeedbackPage() {
  const [insha, setInsha]           = useState('')
  const [inshaType, setInshaType]   = useState<InshaType>('masimulizi')
  const [grade, setGrade]           = useState<number>(9)
  const [loading, setLoading]       = useState(false)
  const [feedback, setFeedback]     = useState<InshaFeedback | null>(null)
  const [error, setError]           = useState<string | null>(null)

  const wordCount = insha.trim().split(/\s+/).filter(Boolean).length
  const charCount = insha.length
  const tooShort  = charCount > 0 && charCount < 50
  const tooLong   = charCount > 3000

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading || tooShort || tooLong || charCount < 50) return

    setLoading(true)
    setError(null)
    setFeedback(null)

    try {
      const res = await fetch('/api/kiswahili/insha-feedback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ insha: insha.trim(), inshaType, grade }),
      })
      const data: { success: boolean; data?: { feedback: InshaFeedback }; error?: string } = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error ?? 'Tathmini imeshindwa. Tafadhali jaribu tena.')
        return
      }

      setFeedback(data.data!.feedback)
    } catch {
      setError('Tathmini imeshindwa. Angalia muunganiko wa mtandao na ujaribu tena.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">

      {/* Back nav */}
      <Link
        href="/teacher/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-teal-700 transition mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Rudi Dashibodi
      </Link>

      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Tathmini ya Insha</h1>
            <p className="text-gray-500 text-sm">Maoni ya CBC kwa Kiswahili · Darasa 7–11</p>
          </div>
        </div>
      </div>

      {/* Results view */}
      {feedback ? (
        <FeedbackResults feedback={feedback} onReset={() => { setFeedback(null); setInsha('') }} />
      ) : (

        /* Form */
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">

          {/* Grade + Type row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Darasa</label>
              <select
                value={grade}
                onChange={e => setGrade(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              >
                {GRADES.map(g => (
                  <option key={g} value={g}>Darasa {g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Aina ya Insha</label>
              <select
                value={inshaType}
                onChange={e => setInshaType(e.target.value as InshaType)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              >
                {INSHA_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label} — {t.hint}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Insha textarea */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              Insha ya Mwanafunzi
            </label>
            <textarea
              value={insha}
              onChange={e => setInsha(e.target.value)}
              rows={14}
              placeholder="Andika au banda insha ya mwanafunzi hapa..."
              className={`w-full border rounded-xl px-4 py-3 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 transition ${
                tooLong
                  ? 'border-rose-300 focus:ring-rose-400'
                  : tooShort
                  ? 'border-amber-300 focus:ring-amber-400'
                  : 'border-gray-200 focus:ring-teal-500'
              }`}
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className={`text-xs ${tooShort ? 'text-amber-600' : tooLong ? 'text-rose-600' : 'text-gray-400'}`}>
                {tooShort && 'Insha ni fupi mno — andika zaidi'}
                {tooLong  && 'Insha ni ndefu mno — upeo ni herufi 3000'}
              </span>
              <span className={`text-xs font-mono ${tooLong ? 'text-rose-500' : 'text-gray-400'}`}>
                {wordCount} maneno · {charCount}/3000
              </span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm">
              {friendlyMessage(error).message}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || charCount < 50 || tooLong}
            className="flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold px-6 py-3.5 rounded-xl transition shadow-sm text-sm"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Tathmini inaendelea...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Tathmini Insha
              </>
            )}
          </button>

          {/* Info note */}
          <p className="text-xs text-gray-400 text-center leading-relaxed">
            AI inatathmini kwa vipimo 6 vya CBC Kenya — utangulizi, kiini, hitimisho,
            msamiati, sarufi, na mtiririko. Maoni yote ni ya Kiswahili.
          </p>
        </form>
      )}
    </div>
  )
}
