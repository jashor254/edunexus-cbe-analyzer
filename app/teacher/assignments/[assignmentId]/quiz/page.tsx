'use client'

import { useEffect, useState, use, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Trash2, Save, Sparkles, Check, X, RefreshCw, Search } from 'lucide-react'
import { friendlyMessage } from '@/lib/errors/friendlyMessage'

interface DraftQuestion {
  /** Present for a question loaded from the server — preserved on save so its identity survives edits (Sprint 9 Slice 1). Absent for a newly added question. */
  id?: string
  questionText: string
  choices: string[]
  correctIndex: number
}

// Adaptive Variant Generation Pipeline — variants are review artifacts over
// the canonical question above, never a second quiz editor (see the sprint's
// own "canonical question remains the editing surface" rule).
interface VariantRow {
  id: string
  question_id: string
  variant_type: 'foundation' | 'supported_practice' | 'extension'
  question_text: string
  choices: string[]
  status: 'draft' | 'approved' | 'rejected' | 'archived'
}

const TIER_LABEL: Record<VariantRow['variant_type'], string> = {
  foundation: 'Foundation',
  supported_practice: 'Supported Practice',
  extension: 'Extension',
}

// Sprint 8 (Assessment Excellence) — the Review Dashboard's filter controls.
// Client-side only: the batched variants fetch already returns every
// status/tier in one call, so filtering here needs zero new API surface.
type StatusFilter = 'all' | 'draft' | 'approved' | 'rejected'
type TierFilter = 'all' | VariantRow['variant_type']

function emptyQuestion(): DraftQuestion {
  return { questionText: '', choices: ['', ''], correctIndex: 0 }
}

export default function QuizBuilderPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = use(params)
  const [questions, setQuestions] = useState<DraftQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const [variantsByQuestion, setVariantsByQuestion] = useState<Record<string, VariantRow[]>>({})
  const [generating, setGenerating] = useState<Record<string, boolean>>({})
  const [variantError, setVariantError] = useState<Record<string, string>>({})
  const [busyVariantId, setBusyVariantId] = useState<string | null>(null)

  // Sprint 8 (Assessment Excellence) — Review Dashboard state. Filter/search
  // are pure client-side reads of variantsByQuestion, already fetched in
  // full; bulk selection/actions reuse the same approve/reject endpoints
  // every single-variant action already calls, just batched server-side.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [tierFilter, setTierFilter] = useState<TierFilter>('all')
  const [searchText, setSearchText] = useState('')
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set())
  const [bulkActing, setBulkActing] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [generatingAll, setGeneratingAll] = useState(false)
  const [generateAllSummary, setGenerateAllSummary] = useState('')

  useEffect(() => {
    fetch(`/api/teacher/assignments/${assignmentId}/questions`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data.questions.length > 0) {
          const loaded: DraftQuestion[] = d.data.questions.map((q: { id: string; question_text: string; choices: string[]; correct_index: number }) => ({
            id: q.id, questionText: q.question_text, choices: q.choices, correctIndex: q.correct_index,
          }))
          setQuestions(loaded)
          if (loaded.some(q => q.id)) void loadAllVariants()
        } else {
          setQuestions([emptyQuestion()])
        }
      })
      .finally(() => setLoading(false))
  }, [assignmentId])

  /** Sprint 8 — one request for every question's variants, replacing the prior one-fetch-per-question loop (N round trips for an N-question quiz). */
  async function loadAllVariants() {
    const res = await fetch(`/api/teacher/assignments/${assignmentId}/variants`)
    const data = await res.json()
    if (!data.success) return
    const grouped: Record<string, VariantRow[]> = {}
    for (const v of data.data.variants as VariantRow[]) {
      ;(grouped[v.question_id] ??= []).push(v)
    }
    setVariantsByQuestion(grouped)
  }

  async function handleGenerate(questionId: string) {
    setVariantError(prev => ({ ...prev, [questionId]: '' }))
    setGenerating(prev => ({ ...prev, [questionId]: true }))
    try {
      const res = await fetch(`/api/teacher/assignments/${assignmentId}/questions/${questionId}/variants/generate`, { method: 'POST' })
      const data = await res.json()
      if (!data.success) { setVariantError(prev => ({ ...prev, [questionId]: data.error || 'Generation failed' })); return }
      if (data.data.failed?.length > 0) {
        setVariantError(prev => ({
          ...prev,
          [questionId]: `${data.data.failed.length} tier(s) could not be generated: ${data.data.failed.map((f: { tier: string; reason: string }) => `${f.tier} — ${f.reason}`).join('; ')}`,
        }))
      }
      await loadAllVariants()
    } finally {
      setGenerating(prev => ({ ...prev, [questionId]: false }))
    }
  }

  /** Sprint 8 — loops the same per-question generate the single button calls, server-side, skipping questions that already have variants. Replaces "click Generate 10 times" with one click. */
  async function handleGenerateAll() {
    setGeneratingAll(true)
    setGenerateAllSummary('')
    try {
      const res = await fetch(`/api/teacher/assignments/${assignmentId}/variants/generate-all`, { method: 'POST' })
      const data = await res.json()
      if (!data.success) { setGenerateAllSummary(data.error || 'Generation failed'); return }
      const { processedCount, skippedCount } = data.data
      setGenerateAllSummary(
        processedCount === 0
          ? (skippedCount > 0 ? 'Every question already has variants.' : 'No questions to generate for.')
          : `Generated variants for ${processedCount} question${processedCount === 1 ? '' : 's'}${skippedCount > 0 ? ` (${skippedCount} already had variants, skipped)` : ''}.`
      )
      await loadAllVariants()
    } finally {
      setGeneratingAll(false)
    }
  }

  async function handleVariantAction(questionId: string, variantId: string, action: 'approve' | 'reject' | 'regenerate') {
    setBusyVariantId(variantId)
    try {
      const res = await fetch(`/api/teacher/assignments/${assignmentId}/questions/${questionId}/variants/${variantId}/${action}`, { method: 'POST' })
      const data = await res.json()
      if (!data.success) { setVariantError(prev => ({ ...prev, [questionId]: data.error || `Failed to ${action}` })); return }
      await loadAllVariants()
    } finally {
      setBusyVariantId(null)
    }
  }

  function toggleVariantSelected(variantId: string) {
    setSelectedVariantIds(prev => {
      const next = new Set(prev)
      if (next.has(variantId)) next.delete(variantId)
      else next.add(variantId)
      return next
    })
  }

  /** Sprint 8 — bulk approve/reject over every currently-selected variant, via the one batch endpoint (no new lifecycle logic — same approveVariant()/rejectVariant() every single click already calls). */
  async function handleBulkAction(action: 'approve' | 'reject') {
    if (selectedVariantIds.size === 0) return
    setBulkActing(true)
    setBulkError('')
    try {
      const res = await fetch(`/api/teacher/assignments/${assignmentId}/variants/bulk-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantIds: [...selectedVariantIds], action }),
      })
      const data = await res.json()
      if (!data.success) { setBulkError(data.error || `Bulk ${action} failed`); return }
      if (data.data.failed?.length > 0) {
        setBulkError(`${data.data.failed.length} variant(s) could not be ${action === 'approve' ? 'approved' : 'rejected'} — another tier may already be approved.`)
      }
      setSelectedVariantIds(new Set())
      await loadAllVariants()
    } finally {
      setBulkActing(false)
    }
  }

  const allVariants = useMemo(() => Object.values(variantsByQuestion).flat(), [variantsByQuestion])
  const hasActiveFilter = statusFilter !== 'all' || tierFilter !== 'all' || searchText.trim() !== ''

  function matchesFilter(v: VariantRow): boolean {
    if (v.status === 'archived') return false
    if (statusFilter !== 'all' && v.status !== statusFilter) return false
    if (tierFilter !== 'all' && v.variant_type !== tierFilter) return false
    if (searchText.trim() && !v.question_text.toLowerCase().includes(searchText.trim().toLowerCase())) return false
    return true
  }

  function updateQuestion(index: number, patch: Partial<DraftQuestion>) {
    setQuestions(prev => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)))
  }

  function updateChoice(qIndex: number, cIndex: number, value: string) {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIndex) return q
      const choices = [...q.choices]
      choices[cIndex] = value
      return { ...q, choices }
    }))
  }

  function addChoice(qIndex: number) {
    setQuestions(prev => prev.map((q, i) => (i === qIndex && q.choices.length < 6 ? { ...q, choices: [...q.choices, ''] } : q)))
  }

  function removeChoice(qIndex: number, cIndex: number) {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIndex || q.choices.length <= 2) return q
      const choices = q.choices.filter((_, idx) => idx !== cIndex)
      const correctIndex = q.correctIndex >= choices.length ? 0 : q.correctIndex
      return { ...q, choices, correctIndex }
    }))
  }

  function addQuestion() {
    setQuestions(prev => [...prev, emptyQuestion()])
  }

  function removeQuestion(index: number) {
    setQuestions(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    setError('')
    setSaved(false)

    const cleaned = questions
      .map(q => ({ ...q, questionText: q.questionText.trim(), choices: q.choices.map(c => c.trim()) }))
      .filter(q => q.questionText && q.choices.every(c => c))

    if (cleaned.length === 0) {
      setError('Add at least one question with all choices filled in.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/teacher/assignments/${assignmentId}/questions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: cleaned }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error || 'Failed to save'); return }
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <Link href={`/teacher/assignments/${assignmentId}`} className="text-sm text-gray-400 hover:text-gray-600 font-medium">
          ← Back to Assignment
        </Link>
        <h1 className="text-3xl font-black text-gray-900 mt-3">Quiz Questions</h1>
        <p className="text-gray-500 mt-1">Multiple choice — students get their score instantly, no marking needed</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
          {friendlyMessage(error).message}
        </div>
      )}
      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm mb-4 font-bold">
          Saved — students will see this question set.
        </div>
      )}

      {/* ── Review Dashboard toolbar (Sprint 8, Assessment Excellence) ──────
          Generate All + filter/search + bulk approve/reject, over the one
          batched variants fetch — the "40+ clicks for a 10-question quiz"
          friction finding this sprint set out to fix. Only shown once at
          least one question is saved (variants can't exist before that). */}
      {questions.some(q => q.id) && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs font-black text-gray-400">REVIEW DASHBOARD</span>
            <button
              onClick={handleGenerateAll}
              disabled={generatingAll}
              className="flex items-center gap-1.5 text-xs font-black text-purple-700 hover:text-purple-800 transition disabled:opacity-60"
            >
              {generatingAll
                ? <span className="w-3.5 h-3.5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                : <Sparkles className="w-3.5 h-3.5" />}
              Generate All (questions with none yet)
            </button>
          </div>

          {generateAllSummary && (
            <p className="text-xs text-gray-500">{generateAllSummary}</p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-1 min-w-40 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50">
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder="Search variant text..."
                className="flex-1 bg-transparent outline-none text-sm text-gray-700 min-w-0"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 outline-none"
            >
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              value={tierFilter}
              onChange={e => setTierFilter(e.target.value as TierFilter)}
              className="px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 outline-none"
            >
              <option value="all">All tiers</option>
              <option value="foundation">Foundation</option>
              <option value="supported_practice">Supported Practice</option>
              <option value="extension">Extension</option>
            </select>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap text-xs">
            <p className="text-gray-400">
              {allVariants.filter(matchesFilter).length} of {allVariants.filter(v => v.status !== 'archived').length} variant{allVariants.length === 1 ? '' : 's'} shown
              {hasActiveFilter ? ' (filtered)' : ''}
            </p>
            {selectedVariantIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-500">{selectedVariantIds.size} selected</span>
                <button
                  onClick={() => handleBulkAction('approve')}
                  disabled={bulkActing}
                  className="flex items-center gap-1 font-black text-green-700 hover:text-green-800 disabled:opacity-60"
                >
                  <Check className="w-3.5 h-3.5" /> Approve selected
                </button>
                <button
                  onClick={() => handleBulkAction('reject')}
                  disabled={bulkActing}
                  className="flex items-center gap-1 font-black text-red-600 hover:text-red-700 disabled:opacity-60"
                >
                  <X className="w-3.5 h-3.5" /> Reject selected
                </button>
              </div>
            )}
          </div>
          {bulkError && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{bulkError}</p>}
        </div>
      )}

      <div className="space-y-4 mb-6">
        {questions.map((q, qIndex) => (
          <div key={qIndex} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <span className="text-xs font-black text-gray-400">QUESTION {qIndex + 1}</span>
              {questions.length > 1 && (
                <button onClick={() => removeQuestion(qIndex)} className="text-gray-300 hover:text-red-500 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <textarea
              value={q.questionText}
              onChange={e => updateQuestion(qIndex, { questionText: e.target.value })}
              placeholder="Type the question..."
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-teal-500 resize-none mb-3"
            />

            <div className="space-y-2">
              {q.choices.map((choice, cIndex) => (
                <div key={cIndex} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${qIndex}`}
                    checked={q.correctIndex === cIndex}
                    onChange={() => updateQuestion(qIndex, { correctIndex: cIndex })}
                    className="w-4 h-4 accent-teal-600 shrink-0"
                    title="Mark as correct answer"
                  />
                  <input
                    value={choice}
                    onChange={e => updateChoice(qIndex, cIndex, e.target.value)}
                    placeholder={`Choice ${String.fromCharCode(65 + cIndex)}`}
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-200 outline-none focus:border-teal-500 text-sm"
                  />
                  {q.choices.length > 2 && (
                    <button onClick={() => removeChoice(qIndex, cIndex)} className="text-gray-300 hover:text-red-500 transition shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {q.choices.length < 6 && (
              <button
                onClick={() => addChoice(qIndex)}
                className="mt-2 text-xs font-bold text-teal-700 hover:text-teal-800 transition"
              >
                + Add choice
              </button>
            )}

            {q.id && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-gray-400">ADAPTIVE VARIANTS</span>
                  <button
                    onClick={() => handleGenerate(q.id!)}
                    disabled={generating[q.id]}
                    className="flex items-center gap-1.5 text-xs font-black text-purple-700 hover:text-purple-800 transition disabled:opacity-60"
                  >
                    {generating[q.id]
                      ? <span className="w-3.5 h-3.5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                      : <Sparkles className="w-3.5 h-3.5" />}
                    Generate Adaptive Variants
                  </button>
                </div>

                {variantError[q.id] && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                    {variantError[q.id]}
                  </div>
                )}

                <div className="space-y-2">
                  {(variantsByQuestion[q.id] ?? []).filter(matchesFilter).map(v => (
                    <div key={v.id} className={`bg-gray-50 rounded-xl p-3 text-sm ${selectedVariantIds.has(v.id) ? 'ring-2 ring-teal-400' : ''}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {v.status === 'draft' && (
                            <input
                              type="checkbox"
                              checked={selectedVariantIds.has(v.id)}
                              onChange={() => toggleVariantSelected(v.id)}
                              className="w-3.5 h-3.5 accent-teal-600"
                              title="Select for bulk approve/reject"
                            />
                          )}
                          <span className="font-black text-xs text-gray-500">{TIER_LABEL[v.variant_type]}</span>
                        </div>
                        <span className={
                          v.status === 'approved' ? 'text-xs font-bold text-green-700'
                            : v.status === 'rejected' ? 'text-xs font-bold text-red-600'
                            : 'text-xs font-bold text-gray-500'
                        }>{v.status}</span>
                      </div>
                      <p className="text-gray-700 mb-2">{v.question_text}</p>
                      <div className="flex gap-3">
                        {v.status === 'draft' && (
                          <>
                            <button
                              onClick={() => handleVariantAction(q.id!, v.id, 'approve')}
                              disabled={busyVariantId === v.id}
                              className="flex items-center gap-1 text-xs font-bold text-green-700 hover:text-green-800 disabled:opacity-60"
                            >
                              <Check className="w-3.5 h-3.5" /> Approve
                            </button>
                            <button
                              onClick={() => handleVariantAction(q.id!, v.id, 'reject')}
                              disabled={busyVariantId === v.id}
                              className="flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700 disabled:opacity-60"
                            >
                              <X className="w-3.5 h-3.5" /> Reject
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleVariantAction(q.id!, v.id, 'regenerate')}
                          disabled={busyVariantId === v.id}
                          className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-700 disabled:opacity-60"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                        </button>
                      </div>
                    </div>
                  ))}
                  {(variantsByQuestion[q.id] ?? []).filter(v => v.status !== 'archived').length > 0
                    && (variantsByQuestion[q.id] ?? []).filter(matchesFilter).length === 0 && (
                    <p className="text-xs text-gray-400 italic">No variants match the current filter.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={addQuestion}
          className="flex items-center gap-2 border border-gray-200 text-gray-700 bg-gray-50 px-4 py-2.5 rounded-xl font-black text-sm hover:bg-gray-100 transition"
        >
          <Plus className="w-4 h-4" /> Add Question
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2.5 rounded-xl font-black text-sm hover:bg-teal-700 transition disabled:opacity-60"
        >
          {saving
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <><Save className="w-4 h-4" /> Save Quiz</>
          }
        </button>
      </div>
    </div>
  )
}
