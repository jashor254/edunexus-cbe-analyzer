// components/paperIntelligence/ScriptPhotos.tsx
//
// Paper Intelligence — full-screen view of a learner's captured pages during
// review. UI only: the parent fetches short-lived signed links.

'use client'

type Props = {
  learnerName: string
  pages: Array<{ pageNumber: number; url: string }> | null
  error: string | null
  onClose: () => void
}

export function ScriptPhotos({ learnerName, pages, error, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-black/90 overflow-y-auto" role="dialog" aria-modal="true" aria-label={`${learnerName}'s script`}>
      <div className="sticky top-0 flex items-center justify-between bg-black/80 px-4 py-3">
        <span className="text-white font-bold">{learnerName}</span>
        <button onClick={onClose} className="text-white text-sm font-bold rounded-xl bg-white/15 px-4 py-2">Close</button>
      </div>
      <div className="px-2 pb-8 space-y-3">
        {error && <p className="text-red-300 text-sm text-center pt-6">{error}</p>}
        {!error && !pages && <p className="text-gray-300 text-sm text-center pt-6">Loading pages…</p>}
        {pages?.length === 0 && <p className="text-gray-300 text-sm text-center pt-6">No pages captured.</p>}
        {pages?.map(p => (
          <figure key={p.pageNumber}>
            <figcaption className="text-gray-400 text-xs mb-1">Page {p.pageNumber}</figcaption>
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL of a private photo; not something next/image should cache */}
            <img src={p.url} alt={`Page ${p.pageNumber}`} className="w-full rounded-lg" />
          </figure>
        ))}
      </div>
    </div>
  )
}
