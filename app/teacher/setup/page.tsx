'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap, School, ChevronRight, Trophy, CheckCircle2, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function TeacherSetupPage() {
  const router = useRouter()
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [pioneer,  setPioneer]  = useState<{ number: number } | null>(null)

  const [fullName,   setFullName]   = useState('')
  const [school,     setSchool]     = useState('')
  const [tscNumber,  setTscNumber]  = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!fullName.trim() || !school.trim()) {
      setError('Full name and school name are required.')
      return
    }

    setLoading(true)
    try {
      const res  = await fetch('/api/teacher/profile', {
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
        router.push('/sow')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Pioneer confirmation screen ────────────────────────────────────────────
  if (pioneer) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12 text-white">
        <div className="w-full max-w-md">

          {/* Glow */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-teal-600/10 rounded-full blur-[100px]" />
          </div>

          <div className="relative bg-slate-900 border border-teal-500/30 rounded-3xl p-10 text-center shadow-2xl">

            {/* Badge */}
            <div className="w-20 h-20 bg-linear-to-br from-teal-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-teal-500/30">
              <Trophy className="w-10 h-10 text-white" />
            </div>

            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 text-teal-300 px-4 py-1.5 rounded-full text-xs font-black mb-5">
              PIONEER TEACHER #{pioneer.number} OF 500
            </div>

            <h1 className="text-3xl font-black text-white mb-2">
              Welcome, Pioneer Teacher!
            </h1>
            <p className="text-white/50 text-sm mb-8">
              You&apos;re #{pioneer.number} of 500 selected teachers building EduNexus with us.
            </p>

            {/* Benefits */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left mb-6">
              <p className="text-xs font-black text-white/50 uppercase tracking-wider mb-4">Your pioneer benefits</p>
              <div className="space-y-3">
                {[
                  'Full access during beta — completely free',
                  '50% off forever when we go paid (KES 750/term)',
                  'Pioneer badge on your profile',
                  'Direct line to the product team',
                ].map((b, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <span className="text-white/70 text-sm">{b}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pioneer promise callout */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-3 mb-7">
              <p className="text-amber-300 text-xs font-bold">
                🔒 Your 50% discount is locked in and tied to your account. Forever.
              </p>
            </div>

            {/* First task */}
            <p className="text-white/40 text-xs font-black uppercase tracking-wider mb-3">
              Your first task
            </p>
            <Link
              href="/sow"
              className="group flex items-center justify-center gap-2 w-full bg-linear-to-r from-teal-500 to-cyan-500 text-white py-4 rounded-2xl font-black hover:scale-105 transition-all shadow-xl shadow-teal-500/20 text-base"
            >
              Generate your first SOW
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Setup form ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-linear-to-br from-teal-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-1">Quick Setup</h1>
          <p className="text-gray-500 text-sm">Three fields — done in 30 seconds.</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="e.g. Mwalimu Kamau Njoroge"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition text-gray-900 placeholder-gray-400"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                <School className="w-4 h-4 inline mr-1" />
                School Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={school}
                onChange={e => setSchool(e.target.value)}
                placeholder="e.g. Nairobi Academy"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition text-gray-900 placeholder-gray-400"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                TSC Number{' '}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={tscNumber}
                onChange={e => setTscNumber(e.target.value)}
                placeholder="e.g. 0123456"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition text-gray-900 placeholder-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1">
                Saved locally for SOW cover pages. Not stored in your account.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !fullName.trim() || !school.trim()}
              className="w-full bg-linear-to-r from-teal-600 to-blue-600 text-white py-4 rounded-xl font-black text-base hover:from-teal-700 hover:to-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-60"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Start Generating Schemes
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-400 text-sm mt-6">
          Teacher accounts are always free. No credit card needed.
        </p>
      </div>
    </div>
  )
}
