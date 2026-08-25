'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import confetti from 'canvas-confetti'

type Step = {
  title: string
  description: string
  icon: string
  gradient: string
  highlight?: string
  extra?: string
}

const steps: Step[] = [
  {
    title: 'Welcome to EduNexus! 🎓',
    description:
      "Kenya's first AI education platform built for CBC and IGCSE parents. Track your child's real learning — competencies, not just exam scores.",
    icon: '🎓',
    gradient: 'from-violet-500 to-indigo-600',
  },
  {
    title: 'Add Your Child',
    description:
      'Create a student profile in seconds. Supports CBC (Grade 7–12) and Cambridge IGCSE. Track multiple children from one account.',
    icon: '👨‍👩‍👧',
    gradient: 'from-blue-500 to-cyan-500',
    extra: 'showCurriculumBadges',
  },
  {
    title: 'Enter Assessment Results 📋',
    description:
      "Log your child's term results by competency level. We break it down strand by strand — not just 'C in Maths' but exactly which topics need work.",
    icon: '📋',
    gradient: 'from-teal-500 to-emerald-500',
    highlight: 'Based on the KICD competency framework',
  },
  {
    title: 'Learning Compass 🧭',
    description:
      'Chat with the Learning Compass — trained on CBC and IGCSE curriculum. Personalised to your child\'s exact level with topic selection straight from the curriculum.',
    icon: '🧭',
    gradient: 'from-amber-500 to-orange-500',
    highlight: '✨ First session is on us — no card needed',
  },
  {
    title: 'Learner Intelligence Reports 📊',
    description:
      'Personalised reports that pinpoint exactly which competency strands your child is struggling with. Share with their teacher in one click.',
    icon: '📊',
    gradient: 'from-rose-500 to-pink-600',
    highlight: '✨ First report is on us',
  },
  {
    title: 'Career Intelligence 🎯',
    description:
      'Grade 10+ students get career matching. 200+ real Kenyan careers with actual KES salary ranges, matched to your child\'s competency profile.',
    icon: '🎯',
    gradient: 'from-purple-500 to-violet-600',
  },
  {
    title: "You're Ready! 🚀",
    description:
      "Start by adding your child and their latest results. Your first session is free — no card needed.",
    icon: '🚀',
    gradient: 'from-green-500 to-emerald-500',
    highlight: 'Mtoto wako anastahili zaidi ya average. 🇰🇪',
  },
]

const TOTAL = steps.length
const LS_KEY = 'hasSeenParentTutorial'

export function OnboardingTutorial({ userId }: { userId: string }) {
  const [show, setShow]               = useState(false)
  const [current, setCurrent]         = useState(0)
  const [completing, setCompleting]   = useState(false)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)

  useEffect(() => {
    if (localStorage.getItem(LS_KEY)) return
    fetch('/api/users/onboarding-status')
      .then(r => r.json())
      .then(d => { if (!d?.completed) setShow(true) })
      .catch(() => setShow(true))
  }, [])

  const handleComplete = useCallback(async () => {
    if (completing) return
    setCompleting(true)
    confetti({ particleCount: 180, spread: 80, origin: { y: 0.6 } })
    localStorage.setItem(LS_KEY, 'true')
    try {
      await fetch('/api/users/onboarding-status', { method: 'POST' })
    } catch { /* silent */ }
    setTimeout(() => {
      setShow(false)
      window.location.href = '/dashboard'
    }, 800)
  }, [completing])

  const dismiss = useCallback(() => {
    localStorage.setItem(LS_KEY, 'true')
    setShow(false)
  }, [])

  const goNext = useCallback(() => { if (current < TOTAL - 1) setCurrent(s => s + 1) }, [current])
  const goPrev = useCallback(() => { if (current > 0) setCurrent(s => s - 1) }, [current])

  const onTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX)
  const onTouchEnd   = (e: React.TouchEvent) => {
    if (touchStartX === null) return
    const diff = touchStartX - e.changedTouches[0].clientX
    if (diff > 50) goNext()
    if (diff < -50) goPrev()
    setTouchStartX(null)
  }

  if (!show) return null

  const step   = steps[current]
  const isLast = current === TOTAL - 1
  const pct    = ((current + 1) / TOTAL) * 100

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
      <div
        className="bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg relative overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Progress bar */}
        <div className="h-1 bg-white/10">
          <div
            className={`h-full bg-gradient-to-r ${step.gradient} transition-all duration-500`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="absolute top-5 right-5 w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition z-10"
        >
          <X className="w-4 h-4 text-white" />
        </button>

        <div className="p-8 pt-6">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">
            Step {current + 1} of {TOTAL}
          </p>

          <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${step.gradient} flex items-center justify-center mb-6 mx-auto`}>
            <span className="text-4xl">{step.icon}</span>
          </div>

          <h2 className="text-2xl font-black text-white text-center mb-3 leading-tight">
            {step.title}
          </h2>
          <p className="text-slate-300 text-center leading-relaxed mb-4">
            {step.description}
          </p>

          {step.highlight && (
            <div className={`mx-auto w-fit px-4 py-2 bg-gradient-to-r ${step.gradient} rounded-full text-sm font-black text-white text-center mb-4 opacity-90`}>
              {step.highlight}
            </div>
          )}

          {step.extra === 'showCurriculumBadges' && (
            <div className="flex gap-3 justify-center mb-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-xl">
                <span className="text-lg">🇰🇪</span>
                <span className="text-sm font-black text-green-400">CBC Kenya</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <span className="text-lg">🌍</span>
                <span className="text-sm font-black text-blue-400">Cambridge IGCSE</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-6">
            <button
              onClick={goPrev}
              disabled={current === 0}
              className="flex items-center gap-1 text-slate-400 font-bold text-sm disabled:opacity-0 hover:text-white transition"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>

            <div className="flex gap-1.5">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`rounded-full transition-all ${
                    i === current
                      ? `w-6 h-2 bg-gradient-to-r ${step.gradient}`
                      : 'w-2 h-2 bg-white/20 hover:bg-white/40'
                  }`}
                />
              ))}
            </div>

            {isLast ? (
              <button
                onClick={handleComplete}
                disabled={completing}
                className={`flex items-center gap-2 bg-gradient-to-r ${step.gradient} text-white px-5 py-2.5 rounded-xl font-black hover:scale-105 transition-all text-sm disabled:opacity-70`}
              >
                Let's Go! 🚀
              </button>
            ) : (
              <button
                onClick={goNext}
                className={`flex items-center gap-2 bg-gradient-to-r ${step.gradient} text-white px-5 py-2.5 rounded-xl font-black hover:scale-105 transition-all text-sm`}
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
