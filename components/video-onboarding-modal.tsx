'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, X, SkipForward } from 'lucide-react'
import confetti from 'canvas-confetti'

type Role = 'teacher' | 'parent' | 'student' | 'school_admin' | 'admin'

const VIDEO_MAP: Record<string, string> = {
  teacher:      '/videos/onboarding/teacher.mp4',
  parent:       '/videos/onboarding/parent.mp4',
  student:      '/videos/onboarding/learner.mp4',
  school_admin: '/videos/onboarding/teacher.mp4',
}

const WELCOME_COPY: Record<string, { greeting: string; tagline: string }> = {
  teacher:      { greeting: 'Karibu, Mwalimu! 👩‍🏫',      tagline: 'Want a 30-second tour of your dashboard?' },
  parent:       { greeting: 'Welcome! 👨‍👩‍👧',               tagline: 'Want a 30-second tour of what you can do here?' },
  student:      { greeting: 'Hey, Superstar! 🌟',          tagline: 'Want a quick tour before you dive in?' },
  school_admin: { greeting: 'Karibu, Mwalimu! 👩‍🏫',      tagline: 'Want a 30-second tour of your dashboard?' },
}

const LS_KEY = (role: string) => `edunexus_onboarding_v1_${role}`

type Stage = 'prompt' | 'video' | 'done'

interface VideoOnboardingModalProps {
  userId: string
  role: Role
  secondaryRole?: string | null
}

export function VideoOnboardingModal({ userId, role, secondaryRole }: VideoOnboardingModalProps) {
  const [stage, setStage] = useState<Stage | null>(null)
  const [playing, setPlaying]   = useState(false)
  const [ended, setEnded]       = useState(false)
  const [progress, setProgress] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  const effectiveRole = (secondaryRole === 'teacher' ? 'teacher' : role) as string
  const videoSrc  = VIDEO_MAP[effectiveRole]
  const copy      = WELCOME_COPY[effectiveRole] ?? WELCOME_COPY.parent

  useEffect(() => {
    if (!videoSrc) return
    const lsKey = LS_KEY(effectiveRole)
    if (localStorage.getItem(lsKey)) return
    fetch('/api/users/onboarding-status')
      .then(r => r.json())
      .then(d => { if (!d?.completed) setStage('prompt') })
      .catch(() => setStage('prompt'))
  }, [effectiveRole, videoSrc])

  const markComplete = useCallback(async () => {
    localStorage.setItem(LS_KEY(effectiveRole), 'true')
    try { await fetch('/api/users/onboarding-status', { method: 'POST' }) } catch { /* best-effort */ }
  }, [effectiveRole])

  const handleWatchTutorial = useCallback(() => {
    setStage('video')
    // Let the video element mount first
    setTimeout(() => { videoRef.current?.play().catch(() => null) }, 150)
  }, [])

  const handleSkip = useCallback(async () => {
    await markComplete()
    setStage('done')
  }, [markComplete])

  const handleComplete = useCallback(async () => {
    confetti({ particleCount: 160, spread: 75, origin: { y: 0.6 } })
    await markComplete()
    setTimeout(() => setStage('done'), 600)
  }, [markComplete])

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current
    if (!v || !v.duration) return
    setProgress(v.currentTime / v.duration)
  }, [])

  const handleEnded = useCallback(() => {
    setEnded(true)
    setPlaying(false)
  }, [])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) { v.play(); setPlaying(true) }
    else          { v.pause(); setPlaying(false) }
  }, [])

  if (!stage || stage === 'done' || !videoSrc) return null

  // ── Prompt card ──────────────────────────────────────────────────────────
  if (stage === 'prompt') {
    return (
      <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-90 w-[calc(100%-32px)] max-w-sm">
        <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          {/* Gold accent line */}
          <div className="h-0.5 bg-linear-to-r from-blue-500 via-amber-400 to-blue-500" />

          <div className="p-5">
            <button
              onClick={handleSkip}
              className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <p className="font-black text-white text-lg leading-tight mb-1">{copy.greeting}</p>
            <p className="text-slate-400 text-sm mb-5">{copy.tagline}</p>

            <div className="flex gap-3">
              <button
                onClick={handleWatchTutorial}
                className="flex-1 flex items-center justify-center gap-2 bg-linear-to-r from-blue-500 to-amber-500 text-white font-black py-3 rounded-xl text-sm hover:scale-[1.03] active:scale-[0.98] transition-transform"
              >
                <Play className="w-4 h-4 fill-white" /> Watch Tutorial
              </button>
              <button
                onClick={handleSkip}
                className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-sm transition"
              >
                Explore myself
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Full video modal ─────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/95 z-100 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md relative overflow-hidden shadow-2xl">

        {/* Progress bar */}
        <div className="h-1 bg-white/10">
          <div
            className="h-full bg-linear-to-r from-blue-500 to-amber-500 transition-all duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {/* Skip */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 z-10 flex items-center gap-1 text-xs text-slate-400 hover:text-white transition bg-white/5 hover:bg-white/10 rounded-xl px-3 py-2 font-semibold"
        >
          Skip <SkipForward className="w-3 h-3" />
        </button>

        {/* Video */}
        <div className="relative bg-black aspect-9/16 max-h-[65vh] overflow-hidden">
          <video
            ref={videoRef}
            src={videoSrc}
            className="w-full h-full object-cover"
            playsInline
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
          {!playing && !ended && (
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition"
            >
              <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center hover:scale-110 transition-transform">
                <Play className="w-8 h-8 text-white fill-white ml-1" />
              </div>
            </button>
          )}
          {playing && (
            <button onClick={togglePlay} className="absolute inset-0" aria-label="Pause" />
          )}
        </div>

        {/* Bottom action */}
        <div className="p-6 pt-5">
          {ended ? (
            <div className="flex flex-col items-center gap-4">
              <p className="text-slate-300 text-center text-sm">You&apos;re all set — let&apos;s go!</p>
              <button
                onClick={handleComplete}
                className="w-full bg-linear-to-r from-blue-500 to-amber-500 text-white font-black py-4 rounded-2xl text-lg hover:scale-105 transition-transform"
              >
                Let&apos;s Go! 🚀
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-slate-400 text-sm">Your personalised tour — 30 seconds</p>
              {!playing && (
                <button
                  onClick={togglePlay}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2 rounded-xl text-sm transition"
                >
                  <Play className="w-4 h-4 fill-white" /> Resume
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
