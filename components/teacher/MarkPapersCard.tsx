import Link from 'next/link'
import { Camera, ArrowRight } from 'lucide-react'

// My Day entry point for Paper Intelligence. Before this card the feature
// was reachable only from inside a single assignment, so teachers never
// found it. Links to the Mark Papers picker; no data of its own.
export default function MarkPapersCard() {
  return (
    <Link
      href="/teacher/mark-papers"
      className="block bg-gradient-to-br from-teal-600 to-cyan-600 rounded-2xl p-5 text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group"
    >
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 shrink-0 rounded-xl bg-white/15 flex items-center justify-center">
          <Camera className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-black uppercase tracking-wide text-teal-100">Paper Intelligence</div>
          <div className="font-black text-lg leading-tight mt-0.5">Mark a pile of papers with your phone</div>
          <p className="text-sm text-teal-50/90 mt-1">
            Photograph the marking scheme and each script. AI suggests the marks, you confirm them, and they go straight to the gradebook.
          </p>
          <span className="inline-flex items-center gap-1.5 mt-3 bg-white text-teal-700 text-sm font-bold px-4 py-2 rounded-xl group-hover:bg-teal-50 transition-colors">
            Start marking <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </Link>
  )
}
