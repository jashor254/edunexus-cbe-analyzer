'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap, School, Hash, ChevronRight, Trophy, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react'

export default function TeacherSetupPage() {
  const router = useRouter()
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [pioneer,  setPioneer]  = useState<{ number: number } | null>(null)

  const [fullName,  setFullName]  = useState('')
  const [school,    setSchool]    = useState('')
  const [tscNumber, setTscNumber] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!fullName.trim() || !school.trim()) {
      setError('Full name and school name are required.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/teacher/profile', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name:    fullName.trim(),
          school:       school.trim(),
          tsc_number:   tscNumber.trim() || null,
          subject:      null,
          grade_levels: [7, 8, 9, 10, 11, 12],
          phone:        null,
        }),
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.error || 'Failed to save profile. Please try again.')
        return
      }

      if (data.teacher?.pioneer_number) {
        setPioneer({ number: data.teacher.pioneer_number })
      } else {
        router.push('/teacher/scheme-of-work')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Pioneer celebration screen ─────────────────────────────────────────────
  if (pioneer) {
    return (
      <div className="min-h-screen bg-[#070d16] flex items-center justify-center px-4 py-12 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-teal-500/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-amber-500/6 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative w-full max-w-md">
          <div className="bg-slate-900/90 backdrop-blur border border-white/10 rounded-3xl p-10 text-center shadow-2xl">

            {/* Trophy */}
            <div className="w-20 h-20 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-teal-500/30">
              <Trophy className="w-10 h-10 text-white" />
            </div>

            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-300 px-4 py-1.5 rounded-full text-xs font-black mb-5">
              🏅 PIONEER TEACHER #{pioneer.number} OF 500
            </div>

            <h1 className="text-3xl font-black text-white mb-2">
              Welcome, Pioneer!
            </h1>
            <p className="text-slate-400 text-sm mb-8">
              You&apos;re #{pioneer.number} of 500 selected teachers building EduNexus with us.
            </p>

            {/* Benefits */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left mb-6">
              <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-4">Your pioneer benefits</p>
              <div className="space-y-3">
                {[
                  'Full access during beta — completely free',
                  '50% off forever when we go paid (KES 750/term)',
                  'Pioneer badge on your profile',
                  'Direct line to the product team',
                ].map((b, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <span className="text-slate-300 text-sm">{b}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-3 mb-7">
              <p className="text-amber-300 text-xs font-bold">
                🔒 Your 50% discount is locked in and tied to your account. Forever.
              </p>
            </div>

            <p className="text-slate-500 text-xs font-black uppercase tracking-wider mb-3">Your first task</p>
            <a
              href="/teacher/scheme-of-work"
              className="group flex items-center justify-center gap-2 w-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white py-4 rounded-2xl font-black hover:from-teal-400 hover:to-cyan-400 transition-all shadow-xl shadow-teal-500/20 text-base"
            >
              Generate your first Scheme of Work
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ── Setup form ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#070d16] relative overflow-hidden flex flex-col">

      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px]" />

      {/* Glow orbs */}
      <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-teal-500/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-cyan-500/6 rounded-full blur-[100px] pointer-events-none" />

      {/* Top nav */}
      <div className="relative flex items-center justify-between max-w-5xl mx-auto w-full px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/25">
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-black text-base tracking-tight">EduNexus</span>
        </div>
        <div className="text-sm text-slate-500">
          <span className="text-teal-400 font-bold">500</span> pioneer spots ·{' '}
          <span className="text-teal-400 font-bold">Free</span> during beta
        </div>
      </div>

      {/* Main content */}
      <div className="relative flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">

          {/* Badge */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 text-teal-300 px-4 py-1.5 rounded-full text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              Kenya CBC &amp; 8-4-4 Platform for Teachers
            </div>
          </div>

          {/* Headline */}
          <div className="text-center mb-10">
            <h1 className="text-4xl sm:text-5xl font-black text-white leading-[1.1] mb-3">
              Set up your
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-300 mt-1">
                teaching profile
              </span>
            </h1>
            <p className="text-slate-400 text-base">
              Three fields. Under 30 seconds. Then you&apos;re in.
            </p>
          </div>

          {/* Form card */}
          <div className="relative">
            {/* Glow border */}
            <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-teal-500/20 via-transparent to-cyan-500/10 pointer-events-none" />
            <div className="relative bg-slate-900/80 backdrop-blur-sm rounded-3xl p-8 border border-white/5 shadow-2xl">

              <form onSubmit={handleSubmit} className="space-y-5">

                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">
                    Full Name <span className="text-teal-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Mwalimu Kamau Njoroge"
                    className="w-full px-4 py-3.5 rounded-xl bg-slate-800/80 border border-slate-700 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition text-white placeholder-slate-600 text-sm"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                    <School className="w-3.5 h-3.5 text-slate-600" />
                    School Name <span className="text-teal-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={school}
                    onChange={e => setSchool(e.target.value)}
                    placeholder="e.g. Nairobi Academy"
                    className="w-full px-4 py-3.5 rounded-xl bg-slate-800/80 border border-slate-700 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition text-white placeholder-slate-600 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-slate-600" />
                    TSC Number{' '}
                    <span className="text-slate-500 font-normal text-xs">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={tscNumber}
                    onChange={e => setTscNumber(e.target.value)}
                    placeholder="e.g. 0123456"
                    className="w-full px-4 py-3.5 rounded-xl bg-slate-800/80 border border-slate-700 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition text-white placeholder-slate-600 text-sm"
                  />
                  <p className="text-xs text-slate-600 mt-1.5">Appears on scheme of work and lesson plan cover pages</p>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-sm font-medium">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !fullName.trim() || !school.trim()}
                  className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white py-4 rounded-xl font-black text-base hover:from-teal-400 hover:to-cyan-400 transition-all flex items-center justify-center gap-2 shadow-2xl shadow-teal-500/25 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                >
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      Get Started
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          <p className="text-center text-slate-600 text-sm mt-6">
            Teacher accounts are always free · No credit card needed
          </p>
        </div>
      </div>
    </div>
  )
}
