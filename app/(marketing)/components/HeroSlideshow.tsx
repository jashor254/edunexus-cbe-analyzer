// app/(marketing)/components/HeroSlideshow.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LearningCompassMockup,
  AcademicClinicMockup,
  TeacherDashboardMockup,
  CareerExplorerMockup,
  SchemeOfWorkMockup,
} from './ProductMockups'
import { FOCUS_RING } from '../constants'

const SLIDES = [
  {
    id: 0,
    label: '🧭 Learning Compass',
    sublabel: 'Personalised tutoring at midnight',
    color: 'from-amber-500 to-orange-500',
    glowColor: 'from-amber-500/20 to-orange-500/20',
    activeText: 'text-amber-300',
    activeBg: 'bg-amber-500/10',
    activeBorder: 'border-amber-500/30',
    activeDot: 'bg-gradient-to-r from-amber-500 to-orange-500',
    component: LearningCompassMockup,
  },
  {
    id: 1,
    label: '📋 Learner Intelligence Report',
    sublabel: 'Exact gaps identified',
    color: 'from-violet-500 to-purple-500',
    glowColor: 'from-violet-500/20 to-purple-500/20',
    activeText: 'text-violet-300',
    activeBg: 'bg-violet-500/10',
    activeBorder: 'border-violet-500/30',
    activeDot: 'bg-gradient-to-r from-violet-500 to-purple-500',
    component: AcademicClinicMockup,
  },
  {
    id: 2,
    label: '👨‍🏫 Teacher Dashboard',
    sublabel: 'Class intelligence',
    color: 'from-teal-500 to-cyan-500',
    glowColor: 'from-teal-500/20 to-cyan-500/20',
    activeText: 'text-teal-300',
    activeBg: 'bg-teal-500/10',
    activeBorder: 'border-teal-500/30',
    activeDot: 'bg-gradient-to-r from-teal-500 to-cyan-500',
    component: TeacherDashboardMockup,
  },
  {
    id: 3,
    label: '🎯 Career Explorer',
    sublabel: '200+ Kenya careers',
    color: 'from-cyan-500 to-blue-500',
    glowColor: 'from-cyan-500/20 to-blue-500/20',
    activeText: 'text-cyan-300',
    activeBg: 'bg-cyan-500/10',
    activeBorder: 'border-cyan-500/30',
    activeDot: 'bg-gradient-to-r from-cyan-500 to-blue-500',
    component: CareerExplorerMockup,
  },
  {
    id: 4,
    label: '📄 Scheme of Work',
    sublabel: 'Full term in 5 minutes',
    color: 'from-blue-500 to-indigo-500',
    glowColor: 'from-blue-500/20 to-indigo-500/20',
    activeText: 'text-blue-300',
    activeBg: 'bg-blue-500/10',
    activeBorder: 'border-blue-500/30',
    activeDot: 'bg-gradient-to-r from-blue-500 to-indigo-500',
    component: SchemeOfWorkMockup,
  },
]

// Idle timer constant — resume rotation 8s after last interaction
const RESUME_DELAY = 8000

export default function HeroSlideshow() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [visible, setVisible] = useState(true)

  const goTo = useCallback((idx: number) => {
    setVisible(false)
    // Pause auto-rotation, resume after idle
    setPaused(true)
    setTimeout(() => {
      setActive(idx)
      setVisible(true)
    }, 150)
    // Resume rotation after RESUME_DELAY of no interaction
    const t = setTimeout(() => setPaused(false), RESUME_DELAY)
    return () => clearTimeout(t)
  }, [])

  // Auto-rotation — respects paused + page visibility
  useEffect(() => {
    if (paused) return
    const tick = () => {
      if (document.visibilityState === 'hidden') return
      setVisible(false)
      setTimeout(() => {
        setActive((prev) => (prev + 1) % SLIDES.length)
        setVisible(true)
      }, 150)
    }
    const id = setInterval(tick, 4000)
    return () => clearInterval(id)
  }, [paused])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goTo((active + 1) % SLIDES.length)
      if (e.key === 'ArrowLeft')  goTo((active - 1 + SLIDES.length) % SLIDES.length)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [active, goTo])

  const slide = SLIDES[active]
  const MockupComponent = slide.component

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Label above */}
      <p className="text-xs text-white/35 italic mb-3 md:text-left text-center">
        See EduNexus in action →
      </p>

      {/* Floating badge */}
      <div className="absolute -top-3 right-0 z-10 hidden md:block">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-full px-3 py-1 text-[10px] font-black text-white/40">
          🧭 Personalised · 🇰🇪 Made in Kenya
        </div>
      </div>

      {/* ── Desktop layout: side-by-side ─────────────────────────── */}
      <div className="hidden md:flex gap-5 items-start">
        {/* LEFT: feature tabs */}
        <div className="flex flex-col gap-1.5 w-52 shrink-0 pt-1">
          {SLIDES.map((s) => {
            const isActive = s.id === active
            return (
              <button
                key={s.id}
                onClick={() => goTo(s.id)}
                className={`
                  relative flex flex-col items-start text-left px-4 py-3 min-h-15
                  rounded-2xl border transition-all duration-300 ${FOCUS_RING}
                  ${isActive
                    ? `${s.activeBg} ${s.activeBorder}`
                    : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/10'
                  }
                `}
              >
                {/* Active left border accent */}
                {isActive && (
                  <div className={`absolute left-0 top-3 bottom-3 w-0.75 bg-linear-to-b ${s.color} rounded-full`} />
                )}
                <span className={`text-sm font-black leading-tight transition-colors ${isActive ? s.activeText : 'text-white/55'}`}>
                  {s.label}
                </span>
                <span className={`text-xs mt-0.5 transition-colors ${isActive ? 'text-white/55' : 'text-white/50'}`}>
                  {s.sublabel}
                </span>
              </button>
            )
          })}

          {/* Dot indicators */}
          <div className="flex gap-1.5 mt-3 pl-4">
            {SLIDES.map((s) => (
              <button
                key={s.id}
                onClick={() => goTo(s.id)}
                aria-label={`Go to ${s.label}`}
                className={`
                  rounded-full transition-all duration-300 ${FOCUS_RING}
                  ${s.id === active
                    ? `w-4 h-2 ${s.activeDot}`
                    : 'w-2 h-2 bg-white/20 hover:bg-white/40'
                  }
                `}
              />
            ))}
          </div>
        </div>

        {/* RIGHT: mockup with glow */}
        <div className="flex-1 min-w-0 relative">
          {/* Per-slide glow */}
          <div
            className={`absolute -inset-6 bg-linear-to-br ${slide.glowColor} rounded-3xl blur-3xl pointer-events-none transition-all duration-500`}
          />
          <div
            className={`relative transition-all duration-300 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.97]'}`}
            style={{ willChange: 'opacity, transform' }}
          >
            <MockupComponent />
          </div>
        </div>
      </div>

      {/* ── Mobile layout: stacked ────────────────────────────────── */}
      <div className="md:hidden flex flex-col gap-3">
        {/* Horizontal scrollable pill tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
          {SLIDES.map((s) => {
            const isActive = s.id === active
            return (
              <button
                key={s.id}
                onClick={() => goTo(s.id)}
                className={`
                  flex-shrink-0 px-3 py-2 rounded-2xl border
                  transition-all duration-300 ${FOCUS_RING}
                  ${isActive
                    ? `${s.activeBg} ${s.activeBorder}`
                    : 'bg-transparent border-white/10 hover:bg-white/5'
                  }
                `}
              >
                <div className={`text-xs font-black whitespace-nowrap ${isActive ? s.activeText : 'text-white/50'}`}>
                  {s.label}
                </div>
              </button>
            )
          })}
        </div>

        {/* Mockup — max height on mobile so it's a preview */}
        <div
          className={`relative transition-all duration-300 max-h-80 overflow-hidden rounded-3xl ${visible ? 'opacity-100' : 'opacity-0'}`}
          style={{ willChange: 'opacity' }}
        >
          {/* Fade-out at bottom on mobile to show it continues */}
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-linear-to-t from-slate-950 to-transparent z-10 pointer-events-none rounded-b-3xl" />
          <div className={`absolute -inset-4 bg-linear-to-br ${slide.glowColor} rounded-3xl blur-2xl pointer-events-none`} />
          <div className="relative">
            <MockupComponent />
          </div>
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-2">
          {SLIDES.map((s) => (
            <button
              key={s.id}
              onClick={() => goTo(s.id)}
              aria-label={`Go to ${s.label}`}
              className={`
                rounded-full transition-all duration-300 ${FOCUS_RING}
                ${s.id === active
                  ? `w-5 h-2 ${s.activeDot}`
                  : 'w-2 h-2 bg-white/20 hover:bg-white/40'
                }
              `}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
