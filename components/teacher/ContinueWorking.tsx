'use client'

import Link from 'next/link'
import { NotebookPen, ClipboardList, ArrowRight, Flame } from 'lucide-react'
import type { SchemeWithProgress } from '@/app/api/sow/list/route'
import { useDashboardData } from '@/components/teacher/DashboardDataProvider'

function getCurrentTerm(): 1 | 2 | 3 {
  const month = new Date().getMonth() + 1
  if (month <= 3) return 1
  if (month <= 7) return 2
  return 3
}

function schemeLabel(s: SchemeWithProgress): string {
  return `${s.grade} · ${s.learning_area}`
}

type Track = 'lp' | 'row'

export interface ContinueItem {
  key:    string
  scheme: SchemeWithProgress
  track:  Track
  done:   number
  total:  number
  ratio:  number
  // Not populated yet — no existing endpoint estimates workload. Kept on
  // the shape now so a real estimate can be wired in later without
  // touching card layout or callers (Sprint 5: Time Awareness).
  estimatedMinutes?: number
}

// Exported for PRP-3's Next Action Engine (TodayAtAGlance) — the same
// already-fetched `schemes` data (via DashboardDataProvider, one fetch),
// reused for a second, smaller presentation rather than fetched again.
export function buildContinueItems(schemes: SchemeWithProgress[]): ContinueItem[] {
  const items: ContinueItem[] = []
  for (const s of schemes) {
    if (s.total_lessons > 0 && s.lesson_plans_count < s.total_lessons) {
      items.push({ key: `${s.id}-lp`, scheme: s, track: 'lp', done: s.lesson_plans_count, total: s.total_lessons, ratio: s.lesson_plans_count / s.total_lessons })
    }
    if (s.total_lessons > 0 && s.row_count < s.total_lessons) {
      items.push({ key: `${s.id}-row`, scheme: s, track: 'row', done: s.row_count, total: s.total_lessons, ratio: s.row_count / s.total_lessons })
    }
  }
  return items.sort((a, b) => a.ratio - b.ratio).slice(0, 4)
}

function trackMeta(track: Track) {
  return track === 'lp'
    ? { Icon: NotebookPen,   label: 'Lesson Plans',   href: (s: SchemeWithProgress) => `/teacher/lesson-plans?sowId=${s.id}`, cls: { bg: 'bg-blue-50 border-blue-100', icon: 'bg-blue-500 text-white' } }
    : { Icon: ClipboardList, label: 'Record of Work', href: () => '/teacher/record-of-work',                                cls: { bg: 'bg-emerald-50 border-emerald-100', icon: 'bg-emerald-500 text-white' } }
}

// The single most-incomplete item gets visual emphasis — a priority
// model instead of a flat list (Sprint 5).
function PriorityCard({ item }: { item: ContinueItem }) {
  const { Icon, label, href, cls } = trackMeta(item.track)
  return (
    <Link
      href={href(item.scheme)}
      className={`flex items-center gap-4 ${cls.bg} border-2 border-teal-300 rounded-2xl px-5 py-4 hover:-translate-y-0.5 hover:shadow-md transition-all group relative`}
    >
      <span className="absolute -top-2.5 left-4 flex items-center gap-1 bg-teal-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
        <Flame className="w-2.5 h-2.5" /> Highest priority
      </span>
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${cls.icon}`}>
        <Icon className="w-5 h-5" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-slate-900 truncate">{schemeLabel(item.scheme)}</p>
        <p className="text-xs text-slate-500">{label} · {item.done} / {item.total} complete</p>
      </div>
      <span className="flex items-center gap-1 text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors shrink-0">
        Continue <ArrowRight className="w-4 h-4" />
      </span>
    </Link>
  )
}

function CompactCard({ item }: { item: ContinueItem }) {
  const { Icon, label, href, cls } = trackMeta(item.track)
  return (
    <Link
      href={href(item.scheme)}
      className={`flex items-center gap-3 ${cls.bg} border rounded-2xl px-4 py-3 hover:-translate-y-0.5 hover:shadow-sm transition-all group`}
    >
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cls.icon}`}>
        <Icon className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 truncate">{schemeLabel(item.scheme)}</p>
        <p className="text-xs text-slate-500">{label} · {item.done} / {item.total} complete</p>
      </div>
      <span className="flex items-center gap-1 text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors shrink-0">
        Continue <ArrowRight className="w-3.5 h-3.5" />
      </span>
    </Link>
  )
}

// Reads /api/sow/list via DashboardDataProvider — the same fetch feeds
// Weekly Teaching Progress, so the endpoint is only called once per
// dashboard load. If nothing is unfinished, this renders nothing and
// Teaching Workspace's plain "create" links are the natural fallback —
// no continuation is ever fabricated (Sprint 5 / 5.5).
export default function ContinueWorking() {
  const { schemes } = useDashboardData()

  if (schemes === null) return null

  const currentTerm = getCurrentTerm()
  const currentYear = new Date().getFullYear()
  const termSchemes = schemes.filter(s => s.term === currentTerm && s.year === currentYear)
  const continueItems = buildContinueItems(termSchemes)

  if (continueItems.length === 0) return null

  const [top, ...rest] = continueItems

  return (
    <div>
      <h2 className="text-sm font-black text-slate-900 mb-3">Continue Working</h2>
      <div className="space-y-3">
        <PriorityCard item={top} />
        {rest.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-3">
            {rest.map(item => <CompactCard key={item.key} item={item} />)}
          </div>
        )}
      </div>
    </div>
  )
}
