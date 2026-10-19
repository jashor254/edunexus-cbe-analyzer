'use client'

// Mark Papers — the front door to Paper Intelligence (docs/engineering/
// mark-papers-flow-plan.md). Mark first, file after: the teacher starts a
// paper (quick-create, or one of their topical assignments), marks it by
// phone or scanned PDF, reviews, and only then uploads the marks — as a
// topical assignment or into a termly assessment (Opener, CAT, Mid-Term,
// End-Term, Exam, KJSEA SBA). Adaptive assignments and quizzes are not listed.
// UI only — GET /api/teacher/paper-intelligence/papers.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Camera, ListChecks, Upload, ScanLine, ChevronRight, CheckCircle2, PlusCircle } from 'lucide-react'
import QuickPaperForm from '@/components/paperIntelligence/QuickPaperForm'
import type { PapersResponse } from '@/app/api/teacher/paper-intelligence/papers/route'

type Paper = PapersResponse['papers'][number]

const STEPS = [
  { icon: Camera,     title: 'Photograph the marking scheme', sub: 'AI turns it into a rubric you can edit' },
  { icon: ScanLine,   title: 'Capture the scripts',            sub: 'Phone, one learner at a time — or upload a scanned PDF of the whole class' },
  { icon: ListChecks, title: 'Review question by question',    sub: 'Confirm or change every mark — you decide' },
  { icon: Upload,     title: 'Upload the marks',               sub: 'As a topical assignment, or into Opener / CAT / Mid-Term / End-Term / SBA' },
]

function uploadLabel(p: Paper): string | null {
  if (!p.upload) return null
  const where = p.upload.destination === 'topical' ? 'topical assignment' : 'termly assessment'
  return `Uploaded to ${where} · ${p.upload.learnerCount} learner${p.upload.learnerCount === 1 ? '' : 's'}`
}

export default function MarkPapersPage() {
  const [papers, setPapers] = useState<Paper[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    fetch('/api/teacher/paper-intelligence/papers')
      .then(async r => {
        const body = await r.json().catch(() => null)
        if (!r.ok || !body?.success) throw new Error(body?.error ?? 'Could not load your papers')
        setPapers((body.data as PapersResponse).papers)
      })
      .catch((e: unknown) => { setPapers([]); setError(e instanceof Error ? e.message : 'Could not load your papers') })
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 flex items-center gap-2">
          <Camera className="w-7 h-7 text-teal-600" /> Mark Papers
        </h1>
        <p className="text-gray-500 mt-1">
          Mark a pile of paper scripts. The AI suggests marks — you confirm every one — then you choose where the marks go.
        </p>
      </div>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4 mb-6">
        <div className="text-xs font-black text-teal-800 uppercase tracking-wide mb-3">How it works</div>
        <ol className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {STEPS.map(({ icon: Icon, title, sub }, i) => (
            <li key={title} className="flex items-start gap-3">
              <div className="w-8 h-8 shrink-0 rounded-xl bg-white border border-teal-100 flex items-center justify-center">
                <Icon className="w-4 h-4 text-teal-600" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">{i + 1}. {title}</div>
                <div className="text-xs text-gray-500">{sub}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* ── Start a new paper ────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-8 shadow-sm">
        {showNew ? (
          <>
            <h2 className="text-sm font-black text-gray-900 mb-3">New paper</h2>
            <QuickPaperForm />
          </>
        ) : (
          <button onClick={() => setShowNew(true)} className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-3 rounded-xl transition">
            <PlusCircle className="w-4 h-4" /> Mark a new paper
          </button>
        )}
      </div>

      {/* ── Papers ───────────────────────────────────────────────────────── */}
      <h2 className="text-sm font-black text-gray-900 mb-3">Your papers</h2>
      {papers === null ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm">
          {error}. Please refresh the page to try again.
        </div>
      ) : papers.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-2xl border-2 border-dashed border-gray-200 px-4 text-sm text-gray-400">
          No papers yet. Tap <span className="font-bold text-gray-600">Mark a new paper</span> to start.
        </div>
      ) : (
        <ul className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
          {papers.map(p => {
            const uploaded = uploadLabel(p)
            return (
              <li key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-gray-900 text-sm leading-tight flex items-center gap-2 flex-wrap">
                    {p.title}
                    {p.quickPaper && <span className="text-[10px] font-black uppercase tracking-wide bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Paper</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {p.className ? `${p.className}${p.grade ? ` · G${p.grade}` : ''} · ` : ''}{p.subject} · out of {p.maxScore}
                  </div>
                  {uploaded
                    ? <div className="text-xs font-bold text-green-700 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {uploaded}</div>
                    : <div className="text-xs text-amber-600 mt-1">Marks not uploaded yet</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/teacher/assignments/${p.id}/paper-intelligence/review`}
                    className="text-sm font-bold text-teal-600 hover:text-teal-800 border border-teal-200 hover:border-teal-400 px-3 py-2 rounded-xl transition"
                  >
                    Review &amp; upload
                  </Link>
                  <Link
                    href={`/teacher/assignments/${p.id}/paper-intelligence`}
                    className="flex items-center gap-1 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-xl transition"
                  >
                    <Camera className="w-4 h-4" /> Mark <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
