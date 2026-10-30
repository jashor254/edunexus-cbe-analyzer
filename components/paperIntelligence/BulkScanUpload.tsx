'use client'

// Mark Papers bulk scan (S1, docs/engineering/mark-papers-flow-plan.md): the
// teacher uploads ONE scanned PDF of the whole class instead of photographing
// each script. The browser splits it in class-list order, N pages per learner
// (absent learners skipped), the teacher confirms the split on thumbnails,
// then every page goes through the same pages route a phone photo uses
// (captureSource 'scan') and every script is auto-marked. Nothing is filed —
// the teacher still reviews and uploads marks. UI only.

import { useEffect, useMemo, useRef, useState } from 'react'
import { FileUp, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { openPdf, type OpenedPdf } from '@/lib/paperIntelligence/clientPdf'
import { planScanSplit, suggestPagesPerLearner, type ScanLearner } from '@/lib/paperIntelligence/scanSplit'

type RosterLearner = { submissionId: string; name: string; alreadyCaptured: boolean }
type LearnerRun = { status: 'waiting' | 'uploading' | 'marking' | 'done' | 'failed'; message?: string }

const MARKING_CONCURRENCY = 3

export function BulkScanUpload({ base, learners, maxPagesPerScript, onClose }: {
  /** /api/teacher/assignments/[id]/paper-intelligence */
  base: string
  learners: RosterLearner[]
  maxPagesPerScript: number
  onClose: () => void
}) {
  const [pdf, setPdf] = useState<OpenedPdf | null>(null)
  const [fileName, setFileName] = useState('')
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [absent, setAbsent] = useState<Record<string, boolean>>(() => Object.fromEntries(learners.map(l => [l.submissionId, l.alreadyCaptured])))
  const [perLearner, setPerLearner] = useState('')
  const [thumbs, setThumbs] = useState<Record<number, string>>({})
  const [runs, setRuns] = useState<Record<string, LearnerRun> | null>(null)
  const pdfRef = useRef<OpenedPdf | null>(null)

  useEffect(() => () => { void pdfRef.current?.close() }, [])

  const scanLearners: ScanLearner[] = useMemo(
    () => learners.map(l => ({ submissionId: l.submissionId, name: l.name, absent: !!absent[l.submissionId] })),
    [learners, absent],
  )
  const presentCount = scanLearners.filter(l => !l.absent).length

  const plan = useMemo(() => {
    const n = Number(perLearner)
    if (!pdf || !Number.isInteger(n) || n < 1) return null
    try { return planScanSplit(pdf.numPages, scanLearners, n, maxPagesPerScript) } catch { return null }
  }, [pdf, perLearner, scanLearners, maxPagesPerScript])

  // Thumbnail of each learner's first page — enough to check the stack lines up.
  useEffect(() => {
    if (!pdf || !plan) return
    let cancelled = false
    void (async () => {
      for (const a of plan.assignments) {
        const first = a.pdfPages[0]
        if (cancelled || thumbs[first]) continue
        try {
          const url = await pdf.thumbnail(first)
          if (!cancelled) setThumbs(prev => ({ ...prev, [first]: url }))
        } catch { /* a missing thumbnail only hides the preview */ }
      }
    })()
    return () => { cancelled = true }
  }, [pdf, plan])

  async function choose(file: File | undefined) {
    if (!file) return
    if (file.type && file.type !== 'application/pdf') { setError('Choose a PDF file from the scanner.'); return }
    setOpening(true); setError(null); setThumbs({})
    try {
      await pdfRef.current?.close()
      const opened = await openPdf(file)
      pdfRef.current = opened
      setPdf(opened)
      setFileName(file.name)
      const guess = suggestPagesPerLearner(opened.numPages, presentCount, maxPagesPerScript)
      setPerLearner(guess ? String(guess) : '')
    } catch {
      setError('That PDF could not be opened. Re-save it from the scanner and try again.')
    } finally {
      setOpening(false)
    }
  }

  async function start() {
    if (!pdf || !plan) return
    const initial: Record<string, LearnerRun> = Object.fromEntries(plan.assignments.map(a => [a.submissionId, { status: 'waiting' as const }]))
    setRuns(initial)
    const set = (id: string, run: LearnerRun) => setRuns(prev => ({ ...(prev ?? {}), [id]: run }))

    // Marking runs in a small pool while later scripts upload.
    const marking: Promise<void>[] = []
    let inFlight = 0
    const mark = async (id: string) => {
      while (inFlight >= MARKING_CONCURRENCY) await Promise.race(marking)
      inFlight++
      set(id, { status: 'marking' })
      const job = fetch(`${base}/mark-script`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submissionId: id }) })
        .then(res => set(id, res.ok
          ? { status: 'done' }
          : res.status === 409
            ? { status: 'failed', message: 'Already being marked from another request — check the class list in a moment.' }
            : { status: 'failed', message: 'Uploaded, but marking failed — mark it again from the class list.' }))
        .catch(() => set(id, { status: 'failed', message: 'Uploaded, but marking failed — mark it again from the class list.' }))
        .finally(() => { inFlight-- })
      marking.push(job)
    }

    for (const a of plan.assignments) {
      set(a.submissionId, { status: 'uploading' })
      let failure: string | null = null
      for (let i = 0; i < a.pdfPages.length && !failure; i++) {
        try {
          const img = await pdf.renderPage(a.pdfPages[i])
          const res = await fetch(`${base}/pages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ submissionId: a.submissionId, pageNumber: i + 1, imageBase64: img.imageBase64, mimeType: img.mimeType, captureSource: 'scan' }),
          })
          if (!res.ok) failure = (await res.json().catch(() => null))?.error ?? `Page ${a.pdfPages[i]} could not be uploaded.`
        } catch {
          failure = `Page ${a.pdfPages[i]} could not be read or uploaded.`
        }
      }
      if (failure) set(a.submissionId, { status: 'failed', message: failure })
      else await mark(a.submissionId)
    }
    await Promise.all(marking)
  }

  const finished = runs !== null && Object.values(runs).every(r => r.status === 'done' || r.status === 'failed')
  const running = runs !== null && !finished

  return (
    <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-black text-gray-900 flex items-center gap-2"><FileUp className="w-4 h-4 text-teal-600" /> Upload a scanned PDF</h2>
        {!running && <button onClick={onClose} className="text-sm text-gray-400 font-medium">Close</button>}
      </div>

      {!pdf && (
        <>
          <ul className="text-xs text-gray-500 space-y-1 mb-3 list-disc ml-4">
            <li>Stack the scripts in <span className="font-bold">class-list order</span>, the same number of pages each.</li>
            <li>Scan at <span className="font-bold">300 dpi, greyscale</span>, to one PDF. Keep blank pages — turn blank-page removal off.</li>
            <li>Learners with no script: tick them absent below so the pages line up.</li>
          </ul>
          <label className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-3 rounded-xl cursor-pointer transition">
            {opening ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
            {opening ? 'Opening…' : 'Choose the PDF'}
            <input type="file" accept="application/pdf" className="hidden" onChange={e => choose(e.target.files?.[0])} disabled={opening} />
          </label>
        </>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {pdf && runs === null && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600"><span className="font-bold">{fileName}</span> · {pdf.numPages} pages · {presentCount} learners with scripts</p>
          <label className="block">
            <span className="text-xs font-bold text-gray-600">Pages per learner</span>
            <input value={perLearner} onChange={e => setPerLearner(e.target.value)} inputMode="numeric" placeholder={`1–${maxPagesPerScript}`} className="mt-1 w-32 border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          </label>

          {plan && (plan.unassignedPages.length > 0 || plan.shortLearners.length > 0) && (
            <div className="rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs px-3 py-2 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                The PDF has {pdf.numPages} pages but {presentCount} learners × {perLearner} = {plan.expectedPages}.
                {plan.unassignedPages.length > 0 && ` ${plan.unassignedPages.length} page(s) left over.`}
                {plan.shortLearners.length > 0 && ` Short: ${plan.shortLearners.join(', ')}.`}
                {' '}Check for a missing or extra page, or an absent learner, before uploading.
              </span>
            </div>
          )}

          <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl max-h-96 overflow-y-auto">
            {learners.map(l => {
              const a = plan?.assignments.find(x => x.submissionId === l.submissionId)
              const first = a?.pdfPages[0]
              return (
                <li key={l.submissionId} className="flex items-center gap-3 px-3 py-2">
                  <div className="w-10 h-14 shrink-0 bg-gray-100 rounded overflow-hidden">
                    {first && thumbs[first] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbs[first]} alt={`First page for ${l.name}`} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-gray-900 truncate">{l.name}</div>
                    <div className="text-xs text-gray-400">
                      {absent[l.submissionId] ? (l.alreadyCaptured ? 'Already captured — skipped' : 'Absent — no script') : a ? (a.pdfPages.length === 1 ? `PDF page ${a.pdfPages[0]}` : `PDF pages ${a.pdfPages[0]}–${a.pdfPages[a.pdfPages.length - 1]}`) : 'No pages left'}
                    </div>
                  </div>
                  <label className="text-xs text-gray-500 flex items-center gap-1">
                    <input type="checkbox" checked={!!absent[l.submissionId]} onChange={e => setAbsent(prev => ({ ...prev, [l.submissionId]: e.target.checked }))} />
                    Skip
                  </label>
                </li>
              )
            })}
          </ul>

          <button onClick={start} disabled={!plan || plan.assignments.length === 0}
            className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold px-4 py-3 rounded-xl transition">
            Upload and mark {plan?.assignments.length ?? 0} scripts
          </button>
        </div>
      )}

      {runs !== null && (
        <div className="space-y-2">
          {running && <p className="text-sm text-amber-700">Keep this page open until every script is marked.</p>}
          <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl max-h-96 overflow-y-auto">
            {plan?.assignments.map(a => {
              const r = runs[a.submissionId]
              return (
                <li key={a.submissionId} className="flex items-center gap-2 px-3 py-2 text-sm">
                  {r?.status === 'done' ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                    : r?.status === 'failed' ? <AlertTriangle className="w-4 h-4 text-red-600" />
                    : r?.status === 'waiting' ? <span className="w-4 h-4" />
                    : <Loader2 className="w-4 h-4 animate-spin text-teal-600" />}
                  <span className="font-bold text-gray-900 flex-1 truncate">{a.name}</span>
                  <span className="text-xs text-gray-500">
                    {r?.status === 'uploading' ? 'Uploading' : r?.status === 'marking' ? 'Marking' : r?.status === 'done' ? 'Marked' : r?.status === 'failed' ? r.message : 'Waiting'}
                  </span>
                </li>
              )
            })}
          </ul>
          {finished && (
            <button onClick={onClose} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-3 rounded-xl transition">
              Done — back to the class list
            </button>
          )}
        </div>
      )}
    </section>
  )
}
