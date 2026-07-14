'use client'

import Link from 'next/link'
import type { SchemeWithProgress } from '@/app/api/sow/list/route'
import { useDashboardData } from '@/components/teacher/DashboardDataProvider'

function getCurrentTerm(): 1 | 2 | 3 {
  const month = new Date().getMonth() + 1
  if (month <= 3) return 1
  if (month <= 7) return 2
  return 3
}

function pct(n: number, total: number): number {
  if (!total) return 0
  return Math.min(100, Math.round((n / total) * 100))
}

function schemeLabel(s: SchemeWithProgress): string {
  return `${s.grade} · ${s.learning_area}`
}

// Purely visual — no raw counts, just the bar (Sprint 5.5: "no totals").
function MiniBar({ label, percent, color }: { label: string; percent: number; color: 'blue' | 'green' }) {
  const barCls = color === 'blue' ? 'bg-blue-500' : 'bg-emerald-500'
  return (
    <div>
      <span className="text-[11px] font-bold text-slate-500">{label}</span>
      <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
        <div className={`h-1.5 rounded-full ${barCls}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function SchemeProgressCard({ scheme }: { scheme: SchemeWithProgress }) {
  const lpPct      = pct(scheme.lesson_plans_count, scheme.total_lessons)
  const rowPct     = pct(scheme.row_count, scheme.total_lessons)
  const overallPct = Math.round((lpPct + rowPct) / 2)

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-black text-slate-900 truncate">{schemeLabel(scheme)}</p>
        <span className="text-xs font-black text-slate-500 shrink-0">{overallPct}%</span>
      </div>
      <MiniBar label="Lesson Plans" percent={lpPct} color="blue" />
      <MiniBar label="Record of Work" percent={rowPct} color="green" />
    </div>
  )
}

// Reads /api/sow/list via DashboardDataProvider — same fetch Continue
// Working reads, so the endpoint is only called once per dashboard load
// (Sprint 5.5: Performance).
export default function WeeklyTeachingProgress() {
  const { schemes } = useDashboardData()

  if (schemes === null) {
    return (
      <div>
        <h2 className="text-sm font-black text-slate-900 mb-3">Weekly Teaching Progress</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  const currentTerm = getCurrentTerm()
  const currentYear = new Date().getFullYear()
  const termSchemes = schemes.filter(s => s.term === currentTerm && s.year === currentYear)

  if (termSchemes.length === 0) {
    return (
      <div>
        <h2 className="text-sm font-black text-slate-900 mb-3">Weekly Teaching Progress</h2>
        <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-6 text-center">
          <p className="text-slate-500 text-sm mb-3">No Scheme of Work yet for this term.</p>
          <Link
            href="/teacher/scheme-of-work/new"
            className="inline-flex items-center gap-1.5 bg-teal-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-teal-700 transition"
          >
            Create Scheme of Work
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-sm font-black text-slate-900 mb-3">Weekly Teaching Progress</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {termSchemes.map(s => <SchemeProgressCard key={s.id} scheme={s} />)}
      </div>
    </div>
  )
}
