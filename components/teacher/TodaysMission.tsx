'use client'

import Link from 'next/link'
import { AlertOctagon, AlertTriangle, Eye, ArrowRight, PlusCircle } from 'lucide-react'
import type { AttentionSeverity } from '@/lib/attentionFeed/types'
import { topPriorityItems } from '@/lib/attentionFeed/prioritize'
import { useDashboardData } from '@/components/teacher/DashboardDataProvider'

const PRIORITY_COUNT = 3

const PRIORITY_META: Record<AttentionSeverity, { icon: typeof AlertOctagon; iconCls: string }> = {
  critical: { icon: AlertOctagon,  iconCls: 'bg-red-500 text-white' },
  at_risk:  { icon: AlertTriangle, iconCls: 'bg-amber-500 text-white' },
  watch:    { icon: Eye,           iconCls: 'bg-blue-500 text-white' },
  info:     { icon: Eye,           iconCls: 'bg-emerald-500 text-white' },
}

interface Props {
  firstName:      string
  today:          string
  term:           string
  weekOfTerm:     number
  activeClasses:  number
}

// The teacher's daily entry point — reads /api/teacher/attention-feed via
// DashboardDataProvider (shared with Teacher Intelligence, one fetch per
// load) instead of computing anything new. The headline itself is the
// single highest-priority item's own title, so it reads as a live status
// ("Grade 8 Science needs attention") rather than a static greeting.
export default function TodaysMission({ firstName, today, term, weekOfTerm, activeClasses }: Props) {
  const { attentionItems, attentionError } = useDashboardData()
  const noClasses = activeClasses === 0
  const loading   = !noClasses && attentionItems === null && !attentionError

  const priorities   = attentionItems ? topPriorityItems(attentionItems, PRIORITY_COUNT) : []
  const [topPriority, ...restPriorities] = priorities

  const headline = noClasses
    ? `Welcome, ${firstName}`
    : loading
    ? `Hi ${firstName}`
    : topPriority
    ? topPriority.title
    : `Nothing urgent today, ${firstName}`

  return (
    <div className="bg-[#0c1929] relative overflow-hidden rounded-3xl">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute top-0 left-1/4 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative px-5 sm:px-8 py-8">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse shrink-0" />
          <span className="text-teal-400 text-sm font-semibold">{today}</span>
          {!noClasses && (
            <>
              <span className="w-1 h-1 rounded-full bg-slate-600 hidden sm:block" />
              <span className="text-slate-400 text-sm">{term}, Week {weekOfTerm}</span>
            </>
          )}
        </div>

        <p className="text-slate-400 text-sm font-medium mb-1 tracking-wide uppercase">
          {noClasses ? 'Welcome to EduNexus' : "Today's Mission"}
        </p>
        {!noClasses && !loading && topPriority && (
          <p className="text-slate-500 text-sm mb-1">Hi {firstName} —</p>
        )}
        {topPriority && !loading ? (
          <Link href={topPriority.actionLink} className="block group">
            <h1 className="text-2xl sm:text-3xl font-black leading-tight text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-300 group-hover:from-teal-300 group-hover:to-cyan-200 transition-colors">
              {headline}
            </h1>
          </Link>
        ) : (
          <h1 className="text-2xl sm:text-3xl font-black leading-tight text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-300">
            {headline}
          </h1>
        )}

        {/* Remaining priorities */}
        {!noClasses && (
          <div className="mt-6 space-y-2 max-w-lg">
            {loading ? (
              <div className="h-10 bg-white/5 rounded-xl animate-pulse" />
            ) : restPriorities.length > 0 ? (
              restPriorities.map(item => {
                const meta = PRIORITY_META[item.severity]
                const Icon = meta.icon
                return (
                  <Link
                    key={item.itemKey}
                    href={item.actionLink}
                    className="flex items-center gap-3 bg-white/5 hover:bg-white/8 border border-white/10 rounded-xl px-3.5 py-2.5 transition-all group"
                  >
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${meta.iconCls}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-slate-200 text-sm font-medium truncate flex-1">{item.title}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-teal-400 transition-colors shrink-0" />
                  </Link>
                )
              })
            ) : !topPriority ? (
              <p className="text-slate-500 text-sm">A good day to keep moving on your teaching materials.</p>
            ) : null}
          </div>
        )}

        {/* Primary CTA — exactly one */}
        <Link
          href={noClasses ? '/teacher/classes' : '/teacher/scheme-of-work'}
          className="inline-flex items-center gap-2 mt-6 bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-5 py-3 rounded-xl font-black text-sm shadow-lg shadow-teal-900/30 hover:scale-[1.02] transition-transform"
        >
          {noClasses ? <PlusCircle className="w-4 h-4" /> : null}
          {noClasses ? 'Set Up Your First Class' : 'Continue Teaching'}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}
