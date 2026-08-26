'use client'

import { use, useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react'

// Phase 3C — the one canonical marks-entry page. Anchored entirely to an
// already-created assessment id (never re-asks for subject/class — Step 6)
// and to GET/POST /api/core/assessments/[assessmentId]/marks, whose domain
// logic (lib/core/academicBridge.ts::getCanonicalAssessmentMarksView /
// recordCanonicalAssessmentMarks) is the actual authority; this page only
// renders what that already-authorized read returns and submits what the
// teacher typed, never subject/class/pathway identity (Step 20).
type ProgrammeStatus = 'not_applicable' | 'matched' | 'unresolved' | 'mismatch'

type RosterEntry = {
  coreLearnerId: string
  admissionNumber: string
  name: string
  existingScore: number | null
  programmeStatus: ProgrammeStatus
}

type CanonicalView = {
  kind: 'canonical'
  context: {
    assessmentId: string
    title: string
    assessmentType: string
    term: string
    year: number
    maxScore: number
    subjectName: string
    className: string
  }
  roster: RosterEntry[]
}

type ViewResponse = { kind: 'not_found' } | { kind: 'legacy' } | CanonicalView

function MarksPageInner({ assessmentId }: { assessmentId: string }) {
  const searchParams = useSearchParams()
  const schoolId = searchParams.get('schoolId') || ''

  const [view, setView] = useState<ViewResponse | null>(null)
  const [loadError, setLoadError] = useState('')
  const [scores, setScores] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set())
  const [savedCount, setSavedCount] = useState<number | null>(null)

  useEffect(() => {
    if (!schoolId) return
    fetch(`/api/core/assessments/${assessmentId}/marks?schoolId=${schoolId}`)
      .then(r => r.json())
      .then(d => {
        if (!d.data) { setLoadError('Could not load this assessment.'); return }
        setView(d.data as ViewResponse)
        if (d.data.kind === 'canonical') {
          const initial: Record<string, string> = {}
          for (const entry of (d.data as CanonicalView).roster) {
            if (entry.existingScore !== null) initial[entry.coreLearnerId] = String(entry.existingScore)
          }
          setScores(initial)
        }
      })
      .catch(() => setLoadError('Could not load this assessment.'))
  }, [assessmentId, schoolId])

  if (!schoolId) {
    return <StateCard icon={<AlertTriangle className="w-5 h-5 text-amber-500" />} title="Missing school context" body="Open this page from My Teaching or the Add Assessment success screen." />
  }
  if (loadError) {
    return <StateCard icon={<AlertTriangle className="w-5 h-5 text-rose-400" />} title="Something went wrong" body={loadError} />
  }
  if (view === null) {
    return <div className="flex justify-center py-20"><span className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" /></div>
  }
  if (view.kind === 'not_found') {
    return (
      <StateCard
        icon={<Lock className="w-5 h-5 text-amber-500" />}
        title="This assessment isn't available"
        body="It may belong to a different school, or you may no longer hold the teaching assignment it was created under."
      />
    )
  }
  if (view.kind === 'legacy') {
    return (
      <StateCard
        icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
        title="This assessment was created through the legacy assessment workflow"
        body="Use your class's existing gradebook to enter marks for it."
      />
    )
  }

  const { context, roster } = view

  async function handleSave() {
    setSaveError('')
    setSavedCount(null)
    const payloadScores = roster
      .filter(entry => scores[entry.coreLearnerId] !== undefined && scores[entry.coreLearnerId] !== '')
      .map(entry => ({ coreLearnerId: entry.coreLearnerId, score: Number(scores[entry.coreLearnerId]) }))

    if (payloadScores.length === 0) { setSaveError('Enter at least one mark before saving.'); return }
    if (payloadScores.some(s => Number.isNaN(s.score))) { setSaveError('One or more marks are not valid numbers.'); return }

    setSaving(true)
    try {
      const res = await fetch(`/api/core/assessments/${assessmentId}/marks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, scores: payloadScores }),
      })
      const json = await res.json()
      if (!res.ok) {
        const message = typeof json.error === 'string' ? json.error : 'Failed to save marks'
        setSaveError(message)
        return
      }
      setSavedCount(json.data.saved.length)
      setRejectedIds(new Set(json.data.rejected.map((r: { coreLearnerId: string }) => r.coreLearnerId)))
    } catch {
      setSaveError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/teacher/dashboard" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> My Teaching
      </Link>

      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 mb-4 flex items-center gap-3">
        <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
        <div className="min-w-0">
          <p className="font-black text-slate-900 text-sm truncate">{context.subjectName}</p>
          <p className="text-xs text-slate-500 truncate">{context.className}</p>
        </div>
      </div>

      <h1 className="text-lg font-black text-slate-900 mb-1">{context.title}</h1>
      <p className="text-sm text-slate-500 mb-5">Maximum score: {context.maxScore}</p>

      {roster.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">No learners are currently enrolled in this class for the current term.</p>
      ) : (
        <div className="space-y-2 mb-6">
          {roster.map(entry => {
            const rejected = rejectedIds.has(entry.coreLearnerId)
            return (
              <div key={entry.coreLearnerId} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 text-sm truncate">{entry.name}</p>
                  {entry.programmeStatus === 'mismatch' && (
                    <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                      <AlertTriangle className="w-3 h-3" /> Programme does not include {context.subjectName} — review before saving
                    </p>
                  )}
                  {rejected && (
                    <p className="text-xs text-rose-600 mt-0.5">Not saved — please check this mark</p>
                  )}
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={context.maxScore}
                  value={scores[entry.coreLearnerId] ?? ''}
                  onChange={e => setScores(s => ({ ...s, [entry.coreLearnerId]: e.target.value }))}
                  disabled={entry.programmeStatus === 'mismatch'}
                  placeholder="—"
                  className="w-20 text-center rounded-lg border border-slate-300 px-2 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            )
          })}
        </div>
      )}

      {saveError && <p className="text-sm text-rose-600 font-medium mb-3">{saveError}</p>}
      {savedCount !== null && (
        <p className="text-sm text-emerald-700 font-bold mb-3 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" /> Saved {savedCount} {savedCount === 1 ? 'mark' : 'marks'}
          {rejectedIds.size > 0 ? ` — ${rejectedIds.size} not saved` : ''}
        </p>
      )}

      {roster.length > 0 && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-xl bg-emerald-600 text-white font-bold py-3.5 text-base hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save marks'}
        </button>
      )}
    </div>
  )
}

function StateCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">{icon}</div>
      <p className="font-bold text-slate-900 mb-1">{title}</p>
      <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">{body}</p>
      <Link href="/teacher/dashboard" className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 hover:text-emerald-800">
        <ArrowLeft className="w-4 h-4" /> Back to My Teaching
      </Link>
    </div>
  )
}

export default function MarksPage({ params }: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = use(params)
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><span className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <MarksPageInner assessmentId={assessmentId} />
    </Suspense>
  )
}
