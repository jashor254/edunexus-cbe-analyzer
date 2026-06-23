'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Plus,
  Trash2,
  Loader2,
  FileText,
  Link2,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Camera,
  ExternalLink,
} from 'lucide-react'
import type { AcademyEvidence, EvidenceType, RecentPlan } from '@/lib/academy/types'

interface Props {
  lessonId: string
  moduleColor: string
  initialEvidence: AcademyEvidence[]
  recentPlans: RecentPlan[]
}

const TYPE_CONFIG: Record<EvidenceType, { label: string; icon: React.ReactNode; placeholder: string }> = {
  text: {
    label: 'Written observation',
    icon: <FileText className="w-4 h-4" />,
    placeholder: 'Describe what happened in your classroom — what did learners do, what did you observe, what was the outcome?',
  },
  link: {
    label: 'Photo / Link',
    icon: <Camera className="w-4 h-4" />,
    placeholder: 'https://drive.google.com/... or any link to your evidence',
  },
  plan_id: {
    label: 'EduNexus Lesson Plan',
    icon: <BookOpen className="w-4 h-4" />,
    placeholder: '',
  },
}

function formatPlanTitle(plan: RecentPlan): string {
  const date = plan.taught_date
    ? new Date(plan.taught_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
    : new Date(plan.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
  return `Wk ${plan.week_number} L${plan.lesson_number} · ${plan.strand} · ${date}`
}

function EvidenceChip({
  ev,
  onDelete,
}: {
  ev: AcademyEvidence
  onDelete: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm('Remove this evidence?')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/academy/evidence/${ev.id}`, { method: 'DELETE' })
      if (res.ok) onDelete(ev.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-start gap-3 bg-white border border-gray-100 rounded-xl p-3 group">
      <div className="shrink-0 mt-0.5 text-teal-500">
        {ev.evidence_type === 'text'    && <FileText className="w-4 h-4" />}
        {ev.evidence_type === 'link'    && <Link2 className="w-4 h-4" />}
        {ev.evidence_type === 'plan_id' && <BookOpen className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black text-gray-700 leading-snug">{ev.description}</p>
        {ev.evidence_type === 'text' && ev.content && (
          <p className="text-[11px] text-gray-500 mt-1 leading-relaxed line-clamp-2">{ev.content}</p>
        )}
        {ev.evidence_type === 'link' && ev.content && (
          <a
            href={ev.content}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-teal-600 hover:text-teal-700 mt-1 font-semibold transition"
          >
            View <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {ev.evidence_type === 'plan_id' && ev.linked_title && (
          <Link
            href={`/teacher/lesson-plans/${ev.linked_id}`}
            className="inline-flex items-center gap-1 text-[11px] text-teal-600 hover:text-teal-700 mt-1 font-semibold transition"
          >
            {ev.linked_title} <ExternalLink className="w-3 h-3" />
          </Link>
        )}
        <p className="text-[10px] text-gray-400 mt-1">
          {new Date(ev.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition p-1 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
        title="Remove evidence"
      >
        {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

export default function EvidencePanel({ lessonId, moduleColor, initialEvidence, recentPlans }: Props) {
  const [evidence, setEvidence]       = useState<AcademyEvidence[]>(initialEvidence)
  const [isOpen, setIsOpen]           = useState(false)
  const [showForm, setShowForm]       = useState(false)
  const [type, setType]               = useState<EvidenceType>('text')
  const [content, setContent]         = useState('')
  const [selectedPlan, setSelectedPlan] = useState<RecentPlan | null>(null)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState('')

  function resetForm() {
    setContent('')
    setSelectedPlan(null)
    setDescription('')
    setError('')
    setShowForm(false)
  }

  function canSubmit(): boolean {
    if (!description.trim()) return false
    if (type === 'text' && !content.trim()) return false
    if (type === 'link') {
      try { new URL(content.trim()); } catch { return false; }
    }
    if (type === 'plan_id' && !selectedPlan) return false
    return true
  }

  async function handleSubmit() {
    if (!canSubmit()) return
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/academy/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lesson_id:     lessonId,
          evidence_type: type,
          content:       type !== 'plan_id' ? content : '',
          linked_id:     type === 'plan_id' ? (selectedPlan?.id ?? '') : '',
          linked_title:  type === 'plan_id' ? (selectedPlan ? formatPlanTitle(selectedPlan) : '') : '',
          description,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json.error ?? 'Could not save evidence. Please try again.')
        return
      }
      setEvidence(prev => [json.data, ...prev])
      resetForm()
    } catch {
      setError('Network error — please check your connection.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleDelete(id: string) {
    setEvidence(prev => prev.filter(e => e.id !== id))
  }

  return (
    <div className="border-t border-gray-100">
      {/* Panel toggle */}
      <button
        onClick={() => setIsOpen(p => !p)}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2
            className="w-4 h-4"
            style={{ color: evidence.length > 0 ? moduleColor : '#94a3b8' }}
          />
          <span
            className="text-xs font-black"
            style={{ color: evidence.length > 0 ? moduleColor : '#94a3b8' }}
          >
            Evidence {evidence.length > 0 ? `(${evidence.length})` : '— Add classroom proof'}
          </span>
          {evidence.length === 0 && (
            <span className="text-[10px] bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded font-bold">
              Optional
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="px-5 pb-5 space-y-3">

          {/* Existing evidence */}
          {evidence.length > 0 && (
            <div className="space-y-2">
              {evidence.map(ev => (
                <EvidenceChip key={ev.id} ev={ev} onDelete={handleDelete} />
              ))}
            </div>
          )}

          {evidence.length === 0 && !showForm && (
            <p className="text-xs text-gray-400 leading-relaxed">
              Evidence connects your Academy learning to your classroom. Add a written observation,
              a link to a photo, or a lesson plan you generated and taught.
            </p>
          )}

          {/* Add evidence form */}
          {showForm ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">

              {/* Type selector */}
              <div>
                <p className="text-xs font-black text-gray-700 mb-2">Type of evidence</p>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(TYPE_CONFIG) as EvidenceType[]).map(t => {
                    const cfg = TYPE_CONFIG[t]
                    const active = type === t
                    return (
                      <button
                        key={t}
                        onClick={() => { setType(t); setContent(''); setSelectedPlan(null) }}
                        className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-[11px] font-black transition"
                        style={
                          active
                            ? { background: `${moduleColor}18`, borderColor: moduleColor, color: moduleColor }
                            : { background: '#fff', borderColor: '#e2e8f0', color: '#64748b' }
                        }
                      >
                        {cfg.icon}
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Content input by type */}
              {type === 'text' && (
                <div>
                  <label className="block text-xs font-black text-gray-700 mb-1.5">
                    What did you observe in your classroom?
                  </label>
                  <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder={TYPE_CONFIG.text.placeholder}
                    rows={3}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 resize-none"
                    style={{ '--tw-ring-color': moduleColor } as React.CSSProperties}
                  />
                </div>
              )}

              {type === 'link' && (
                <div>
                  <label className="block text-xs font-black text-gray-700 mb-1.5">
                    Link to photo or resource
                  </label>
                  <input
                    type="url"
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2"
                    style={{ '--tw-ring-color': moduleColor } as React.CSSProperties}
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Google Drive, WhatsApp Web, or any photo-sharing link works.
                  </p>
                </div>
              )}

              {type === 'plan_id' && (
                <div>
                  <label className="block text-xs font-black text-gray-700 mb-1.5">
                    Select a lesson plan you generated and taught
                  </label>
                  {recentPlans.length > 0 ? (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {recentPlans.map(plan => (
                        <button
                          key={plan.id}
                          onClick={() => setSelectedPlan(plan)}
                          className="w-full text-left px-3 py-2 rounded-lg border text-xs font-semibold transition"
                          style={
                            selectedPlan?.id === plan.id
                              ? { background: `${moduleColor}18`, borderColor: moduleColor, color: moduleColor }
                              : { background: '#fff', borderColor: '#e2e8f0', color: '#374151' }
                          }
                        >
                          {formatPlanTitle(plan)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 bg-white border border-gray-200 rounded-lg p-3">
                      No lesson plans yet.{' '}
                      <Link href="/teacher/lesson-plans" className="text-teal-600 font-bold hover:underline">
                        Generate one first →
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Description — always shown */}
              <div>
                <label className="block text-xs font-black text-gray-700 mb-1.5">
                  What does this evidence show? (one sentence)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. Learners debating competency integration during group work"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': moduleColor } as React.CSSProperties}
                />
              </div>

              {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !canSubmit()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black text-white transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: moduleColor }}
                >
                  {submitting
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                    : <><CheckCircle2 className="w-3.5 h-3.5" /> Save Evidence</>
                  }
                </button>
                <button
                  onClick={resetForm}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 text-xs font-black px-3 py-2 rounded-xl border border-dashed transition hover:bg-gray-50"
              style={{ borderColor: moduleColor, color: moduleColor }}
            >
              <Plus className="w-3.5 h-3.5" /> Add Evidence
            </button>
          )}
        </div>
      )}
    </div>
  )
}
