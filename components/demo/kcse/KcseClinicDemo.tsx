'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { X, ChevronLeft, ChevronRight, ArrowRight, FileText } from 'lucide-react'

import KcseCoverPage from './pages/KcseCoverPage'
import KcseOverviewPage from './pages/KcseOverviewPage'
import KcseSubjectPage from './pages/KcseSubjectPage'
import KcsePathwayPage from './pages/KcsePathwayPage'
import KcseStudyPlanPage from './pages/KcseStudyPlanPage'
import KcseCompassPage from './pages/KcseCompassPage'
import KcseTeacherPage from './pages/KcseTeacherPage'
import { KCSE_PAGE_TITLES } from './kcseMockData'

const PAGES = [
  KcseCoverPage,
  KcseOverviewPage,
  KcseSubjectPage,
  KcsePathwayPage,
  KcseStudyPlanPage,
  KcseCompassPage,
  KcseTeacherPage,
] as const

type Props = {
  isOpen: boolean
  onClose: () => void
}

export default function KcseClinicDemo({ isOpen, onClose }: Props) {
  const [currentPage, setCurrentPage] = useState(1)
  const [direction, setDirection] = useState<'next' | 'prev'>('next')
  const touchStartX = useRef(0)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setCurrentPage(1)
      setDirection('next')
    }
  }, [isOpen])

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }, [currentPage])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { setDirection('next'); setCurrentPage(p => Math.min(PAGES.length, p + 1)) }
      if (e.key === 'ArrowLeft') { setDirection('prev'); setCurrentPage(p => Math.max(1, p - 1)) }
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const goNext = useCallback(() => {
    setDirection('next')
    setCurrentPage(p => Math.min(PAGES.length, p + 1))
  }, [])

  const goPrev = useCallback(() => {
    setDirection('prev')
    setCurrentPage(p => Math.max(1, p - 1))
  }, [])

  const goTo = useCallback((index: number) => {
    setDirection(index + 1 > currentPage ? 'next' : 'prev')
    setCurrentPage(index + 1)
  }, [currentPage])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStartX.current - e.changedTouches[0].clientX
    if (delta > 60) goNext()
    else if (delta < -60) goPrev()
  }

  if (!isOpen) return null

  const CurrentPage = PAGES[currentPage - 1]

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end md:items-center justify-center p-0 md:p-6">
      <div className="absolute inset-0" onClick={onClose} />

      <div
        className="relative bg-white w-full h-full md:rounded-2xl md:max-w-4xl md:h-[90vh] md:mx-auto flex flex-col overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-8 md:slide-in-from-bottom-0 md:zoom-in-95 duration-300"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button
          onClick={onClose}
          aria-label="Close demo"
          className="absolute top-3 right-3 z-30 min-w-11 min-h-11 w-11 h-11 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        <div ref={contentRef} className="flex-1 min-h-0 overflow-hidden">
          <div
            key={currentPage}
            className={`h-full animate-in fade-in duration-200 ${
              direction === 'next' ? 'slide-in-from-right-4' : 'slide-in-from-left-4'
            }`}
          >
            <CurrentPage />
          </div>
        </div>

        {/* Bottom bar */}
        <div className="shrink-0 bg-slate-950 border-t border-white/10">
          {/* KCSE mode badge */}
          <div className="flex justify-center pt-2">
            <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-black px-3 py-0.5 rounded-full tracking-widest">
              KCSE MODE · FORM 3 · 8-4-4 CURRICULUM
            </span>
          </div>

          {/* Navigation row */}
          <div className="flex items-center justify-between px-4 py-2 gap-3">
            <button
              onClick={goPrev}
              disabled={currentPage === 1}
              className="flex items-center gap-1.5 text-white/50 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-sm font-bold min-w-11 min-h-11 justify-start"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Prev</span>
            </button>

            <div className="flex items-center gap-2">
              {PAGES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`Go to ${KCSE_PAGE_TITLES[i]}`}
                  className={`rounded-full transition-all duration-200 min-h-11 flex items-center justify-center ${
                    currentPage === i + 1
                      ? 'w-5 h-3 md:w-5 md:h-2 bg-amber-400'
                      : 'w-3 h-3 md:w-2 md:h-2 bg-white/20 hover:bg-white/40'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={goNext}
              disabled={currentPage === PAGES.length}
              className="flex items-center gap-1.5 text-white/50 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-sm font-bold min-w-11 min-h-11 justify-end"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Page title md+ */}
          <div className="hidden md:flex justify-center -mt-2 pb-1">
            <span className="text-white/30 text-xs">{KCSE_PAGE_TITLES[currentPage - 1]}</span>
          </div>

          {/* CTA row */}
          <div className="flex items-center justify-between px-4 pb-4 gap-3">
            <div className="flex items-center gap-1.5 text-white/30 text-xs min-w-0">
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate hidden sm:block">Sample — James Kamau (mock data)</span>
            </div>
            <Link
              href="/signup"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-linear-to-r from-amber-500 to-orange-500 text-white px-4 py-2.5 rounded-xl font-black text-sm hover:scale-105 transition-all shadow-lg shadow-amber-500/20 whitespace-nowrap min-h-11"
            >
              Get My Child&apos;s Real KCSE Report
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
