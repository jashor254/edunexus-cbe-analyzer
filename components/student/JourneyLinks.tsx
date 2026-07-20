// components/student/JourneyLinks.tsx
//
// Sprint 6 (Learner Growth Experience Convergence) — the fix for the
// Phase 2 Journey Audit's core finding: every learner-growth page
// (Blueprint, Career, Progress, Holiday Planner, Clinic, Portfolio,
// Achievements, Timeline) was reachable only from the flat top/bottom nav
// bar, with zero mutual links between them — ten disconnected leaves, not
// a connected journey. This is the one shared "where else can I go from
// here" strip every one of those pages renders, instead of each page
// inventing its own ad-hoc set of links. Self-service routes only (no
// [learnerId] needed) — every one of these already resolves the caller's
// own learner record server-side.

import Link from 'next/link'

const JOURNEY_STEPS = [
  { key: 'blueprint', label: 'Blueprint', href: '/student/blueprint' },
  { key: 'progress', label: 'Progress', href: '/student/progress' },
  { key: 'career', label: 'Careers', href: '/student/career' },
  { key: 'holiday', label: 'Holiday Plan', href: '/student/holiday' },
  { key: 'clinic', label: 'Clinic', href: '/dashboard/clinic' },
  { key: 'timeline', label: 'Timeline', href: '/student/timeline' },
  { key: 'portfolio', label: 'Portfolio', href: '/student/portfolio' },
  { key: 'achievements', label: 'Achievements', href: '/student/achievements' },
] as const

export type JourneyStepKey = (typeof JOURNEY_STEPS)[number]['key']

const THEME = {
  light: {
    label: 'text-gray-400',
    link: 'text-teal-700 bg-teal-50 border-teal-100 hover:bg-teal-100 focus-visible:ring-teal-500',
  },
  dark: {
    label: 'text-white/40',
    link: 'text-violet-300 bg-white/5 border-white/10 hover:bg-white/10 focus-visible:ring-violet-500',
  },
} as const

export default function JourneyLinks({ current, theme = 'light' }: { current: JourneyStepKey; theme?: keyof typeof THEME }) {
  const others = JOURNEY_STEPS.filter(step => step.key !== current)
  const styles = THEME[theme]

  return (
    <nav aria-label="Learner journey" className="max-w-2xl mx-auto px-4 pb-8">
      <p className={`text-[11px] font-black uppercase tracking-wide mb-2 ${styles.label}`}>Continue your journey</p>
      <div className="flex flex-wrap gap-2">
        {others.map(step => (
          <Link
            key={step.key}
            href={step.href}
            className={`text-xs font-bold rounded-full px-3 py-1.5 border transition-colors focus-visible:ring-2 focus-visible:outline-none ${styles.link}`}
          >
            {step.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
