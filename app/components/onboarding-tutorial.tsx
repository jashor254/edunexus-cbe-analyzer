'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import confetti from 'canvas-confetti'
import { markOnboardingComplete } from '@/lib/user-actions'

// ─── Step definitions ─────────────────────────────────────────────────────────

type TutorialStep = {
  step: number
  title: string
  description: string
  icon: string
  gradient: string
  extra?: string
  highlight?: string
}

const tutorialSteps: TutorialStep[] = [
  {
    step: 1,
    title: 'Welcome to EduNexus!',
    description: "Kenya's AI education platform. Your child's personal tutor — available at midnight, during holidays, anytime.",
    icon: '🎓',
    gradient: 'from-violet-500 to-purple-500',
  },
  {
    step: 2,
    title: 'CBC or IGCSE?',
    description: 'We support both CBC Kenya (Grade 7-12) and Cambridge IGCSE (Year 7-11). Everything adapts automatically.',
    icon: '🇰🇪',
    gradient: 'from-amber-500 to-orange-500',
    extra: 'showCurriculumBadges',
  },
  {
    step: 3,
    title: 'Add Your Child',
    description: 'Create a student profile. Track multiple children from one account.',
    icon: '👨‍👩‍👧',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    step: 4,
    title: 'Learning Compass 🧭',
    description: "AI tutor that adapts to your child's pace. Kenyan examples — unga, matatus, KES. Works at midnight during holidays.",
    icon: '🧭',
    gradient: 'from-amber-500 to-orange-500',
    highlight: '✨ First session is on us',
  },
  {
    step: 5,
    title: 'Academic Clinic 📋',
    description: "Log term results → get detailed report showing exactly which topics need work. Not just \"C in Maths\" — specifically which strands.",
    icon: '📋',
    gradient: 'from-violet-500 to-purple-500',
    highlight: '✨ First report is on us',
  },
  {
    step: 6,
    title: 'Career Intelligence 🎯',
    description: 'Grade 10+ students get AI career matching. 200+ Kenyan careers with real KES salary ranges matched to actual performance.',
    icon: '🎯',
    gradient: 'from-cyan-500 to-blue-500',
  },
  {
    step: 7,
    title: "You're ready! 🚀",
    description: "Start by adding your child and their latest results. Your first Compass session is on us — no card needed.",
    icon: '🚀',
    gradient: 'from-green-500 to-emerald-500',
    highlight: 'Mtoto wako anastahili zaidi ya average. 🇰🇪',
  },
]

const TOTAL = tutorialSteps.length

// ─── Component ────────────────────────────────────────────────────────────────

export function OnboardingTutorial({ userId }: { userId: string }) {
  const [show, setShow]               = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [completing, setCompleting]   = useState(false)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)

  useEffect(() => {
    // Fast local check first
    const hasSeen = localStorage.getItem('hasSeenTutorial')
    if (hasSeen) return

    // DB check — only show if not completed
    fetch('/api/users/onboarding-status')
      .then(r => r.json())
      .then(data => {
        if (!data?.completed) setShow(true)
      })
      .catch(() => {
        // Fallback: show if no local flag
        setShow(true)
      })
  }, [])

  const handleComplete = useCallback(async () => {
    if (completing) return
    setCompleting(true)

    confetti({
      particleCount: 180,
      spread: 75,
      origin: { y: 0.6 },
    })

    localStorage.setItem('hasSeenTutorial', 'true')

    if (userId) {
      try {
        await markOnboardingComplete(userId)
        // Also hit the API endpoint to persist the DB column
        await fetch('/api/users/onboarding-status', { method: 'POST' })
      } catch {
        // Fail silently — localStorage is the fallback
      }
    }

    setTimeout(() => {
      setShow(false)
      window.location.href = '/dashboard/clinic'
    }, 800)
  }, [userId, completing])

  const handleDismiss = useCallback(() => {
    localStorage.setItem('hasSeenTutorial', 'true')
    setShow(false)
  }, [])

  const goNext = useCallback(() => {
    if (currentStep < TOTAL - 1) setCurrentStep(s => s + 1)
  }, [currentStep])

  const goPrev = useCallback(() => {
    if (currentStep > 0) setCurrentStep(s => s - 1)
  }, [currentStep])

  // Swipe support
  const onTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX)
  const onTouchEnd   = (e: React.TouchEvent) => {
    if (touchStartX === null) return
    const diff = touchStartX - e.changedTouches[0].clientX
    if (diff > 50)  goNext()
    if (diff < -50) goPrev()
    setTouchStartX(null)
  }

  if (!show) return null

  const step = tutorialSteps[currentStep]
  const progress = ((currentStep + 1) / TOTAL) * 100
  const isLast   = currentStep === TOTAL - 1

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
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className="absolute top-5 right-5 w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition z-10"
        >
          <X className="w-4 h-4 text-white" />
        </button>

        <div className="p-8 pt-6">
          {/* Step counter */}
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">
            Step {step.step} of {TOTAL}
          </p>

          {/* Icon */}
          <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${step.gradient} flex items-center justify-center mb-6 mx-auto`}>
            <span className="text-4xl">{step.icon}</span>
          </div>

          {/* Title + Description */}
          <h2 className="text-2xl font-black text-white text-center mb-3 leading-tight">
            {step.title}
          </h2>
          <p className="text-slate-300 text-center leading-relaxed mb-4">
            {step.description}
          </p>

          {/* Highlight pill */}
          {step.highlight && (
            <div className={`mx-auto w-fit px-4 py-2 bg-gradient-to-r ${step.gradient} bg-opacity-20 rounded-full text-sm font-black text-white text-center mb-4`}>
              {step.highlight}
            </div>
          )}

          {/* CBC / IGCSE badges */}
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

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={goPrev}
              disabled={currentStep === 0}
              className="flex items-center gap-1 text-slate-400 font-bold text-sm disabled:opacity-0 hover:text-white transition"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            {/* Dot indicators */}
            <div className="flex gap-1.5">
              {tutorialSteps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentStep(i)}
                  className={`rounded-full transition-all ${
                    i === currentStep
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
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
