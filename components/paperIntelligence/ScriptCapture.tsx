// components/paperIntelligence/ScriptCapture.tsx
//
// Paper Intelligence — photograph one learner's script, page by page. UI only:
// the parent page owns compression, upload and marking. A blurry shot is shown
// as "retake" before anything uploads; every captured page can be retaken or
// removed. Rear camera, one page per tap, big buttons for a cheap phone.

export type CapturedPage = {
  pageNumber: number
  /** data: URL for the thumbnail — only for pages taken in this session. */
  previewUrl: string | null
  status: 'uploading' | 'saved' | 'blurry' | 'failed'
  message?: string
}

type Props = {
  learnerName: string
  pages: CapturedPage[]
  maxPages: number
  busy: boolean
  alreadyMarked: boolean
  onPhoto: (file: File, pageNumber: number) => void
  onRemove: (pageNumber: number) => void
  onMark: () => void
  onBack: () => void
}

export function ScriptCapture({ learnerName, pages, maxPages, busy, alreadyMarked, onPhoto, onRemove, onMark, onBack }: Props) {
  const saved = pages.filter(p => p.status === 'saved')
  const nextPage = Math.min(maxPages, (pages.reduce((m, p) => Math.max(m, p.pageNumber), 0)) + 1)
  const pending = pages.some(p => p.status === 'uploading')
  const canAddPage = pages.length < maxPages && !busy

  return (
    <section>
      <button onClick={onBack} className="text-sm text-gray-400 font-medium mb-3">← Class list</button>
      <h1 className="text-xl font-bold text-gray-800 mb-1">{learnerName}</h1>
      <p className="text-sm text-gray-500 mb-4">Photograph every page of the script, in order. Answers can run onto the next page — that’s fine.</p>

      <div className="space-y-2 mb-4">
        {pages.map(p => (
          <div key={p.pageNumber} className={`flex items-center gap-3 rounded-2xl border bg-white p-2 ${p.status === 'blurry' || p.status === 'failed' ? 'border-red-300' : 'border-gray-200'}`}>
            {p.previewUrl
              // eslint-disable-next-line @next/next/no-img-element -- in-memory data: URL of a photo just taken; nothing for next/image to optimize
              ? <img src={p.previewUrl} alt={`Page ${p.pageNumber}`} className="h-16 w-12 rounded-lg object-cover bg-gray-100" />
              : <div className="h-16 w-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs">📄</div>}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-800 text-sm">Page {p.pageNumber}</p>
              <p className={`text-xs ${p.status === 'saved' ? 'text-teal-600' : p.status === 'uploading' ? 'text-gray-500' : 'text-red-600'}`}>
                {p.status === 'saved' && '✓ Saved'}
                {p.status === 'uploading' && 'Uploading…'}
                {(p.status === 'blurry' || p.status === 'failed') && (p.message ?? 'Retake this page')}
              </p>
            </div>
            <label className={`text-xs font-bold px-3 py-2 rounded-xl ${busy ? 'text-gray-300' : 'text-teal-700 bg-teal-50 active:bg-teal-100'}`}>
              Retake
              <input type="file" accept="image/*" capture="environment" className="hidden" disabled={busy}
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPhoto(f, p.pageNumber) }} />
            </label>
            {p.status !== 'uploading' && (
              <button onClick={() => onRemove(p.pageNumber)} disabled={busy} className="text-xs text-gray-400 px-2 py-2" aria-label={`Remove page ${p.pageNumber}`}>✕</button>
            )}
          </div>
        ))}
      </div>

      {canAddPage && (
        <label className="block w-full rounded-2xl border-2 border-dashed border-teal-300 bg-white py-8 text-center cursor-pointer active:bg-teal-50">
          <span className="text-teal-600 font-bold">📷 Photograph page {nextPage}</span>
          <input type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPhoto(f, nextPage) }} />
        </label>
      )}

      {alreadyMarked && (
        <p className="mt-3 text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">This script already has AI marks. Marking again replaces them.</p>
      )}

      <button
        onClick={onMark}
        disabled={saved.length === 0 || pending || busy}
        className="mt-4 w-full rounded-2xl bg-teal-600 text-white font-bold py-4 disabled:opacity-40"
      >
        {`Mark script (${saved.length} page${saved.length === 1 ? '' : 's'}) → next learner`}
      </button>
    </section>
  )
}
