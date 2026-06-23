'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Users, Plus, Hash, ChevronLeft, Loader2, Copy, Check } from 'lucide-react'
import type { Cohort } from '@/lib/academy/cohorts'

interface Props {
  teacherSchool: string | null
  existingCohorts: Cohort[]
}

export default function CohortSetupClient({ teacherSchool, existingCohorts }: Props) {
  const router = useRouter()
  const [tab, setTab]       = useState<'create' | 'join'>('create')
  const [name, setName]     = useState('')
  const [school, setSchool] = useState(teacherSchool ?? '')
  const [code, setCode]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [copied, setCopied]   = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/academy/cohort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), school: school.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create cohort')
      router.push(`/teacher/academy/cohort/${json.cohort.id}`)
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/academy/cohort/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Invalid code')
      router.push(`/teacher/academy/cohort/${json.cohort.id}`)
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-[#0c1929] relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-size-[40px_40px]" />
        <div className="relative max-w-2xl mx-auto px-4 sm:px-6 py-10">
          <Link
            href="/teacher/academy"
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-teal-400 text-xs font-semibold transition mb-6"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> AI Academy
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-500/15 border border-cyan-500/30 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">Study Cohorts</h1>
              <p className="text-slate-400 text-xs">Learn alongside colleagues — share progress, compete on XP</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Existing cohorts */}
        {existingCohorts.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-black text-gray-500 uppercase tracking-wide mb-3">Your cohorts</p>
            <div className="space-y-2">
              {existingCohorts.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-3">
                  <Link
                    href={`/teacher/academy/cohort/${c.id}`}
                    className="flex-1 text-sm font-bold text-gray-800 hover:text-teal-600 transition truncate"
                  >
                    {c.name}
                  </Link>
                  <button
                    onClick={() => copyCode(c.join_code)}
                    className="flex items-center gap-1.5 text-[11px] font-black text-gray-400 hover:text-teal-600 bg-gray-50 hover:bg-teal-50 border border-gray-200 hover:border-teal-200 px-2.5 py-1.5 rounded-lg transition"
                  >
                    {copied === c.join_code
                      ? <><Check className="w-3 h-3 text-emerald-500" /> Copied</>
                      : <><Copy className="w-3 h-3" /> {c.join_code}</>
                    }
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create / Join tabs */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-100">
            {(['create', 'join'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(null) }}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-xs font-black transition ${
                  tab === t
                    ? 'text-teal-600 border-b-2 border-teal-500'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {t === 'create' ? <><Plus className="w-3.5 h-3.5" /> Create cohort</> : <><Hash className="w-3.5 h-3.5" /> Join with code</>}
              </button>
            ))}
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            {tab === 'create' ? (
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-gray-700 mb-1.5">Cohort name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Nairobi CBC Pioneers 2026"
                    required
                    maxLength={80}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-700 mb-1.5">School <span className="font-normal text-gray-400">(optional)</span></label>
                  <input
                    type="text"
                    value={school}
                    onChange={e => setSchool(e.target.value)}
                    placeholder="e.g. Sunshine Academy"
                    maxLength={120}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-black text-sm py-3 rounded-xl transition"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create cohort
                </button>
                <p className="text-xs text-gray-400 text-center">
                  A join code is generated automatically. Share it with your colleagues.
                </p>
              </form>
            ) : (
              <form onSubmit={handleJoin} className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-gray-700 mb-1.5">Enter join code</label>
                  <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. AB3X7K"
                    maxLength={6}
                    required
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-center font-black tracking-[0.3em] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent uppercase"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || code.trim().length !== 6}
                  className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white font-black text-sm py-3 rounded-xl transition"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hash className="w-4 h-4" />}
                  Join cohort
                </button>
                <p className="text-xs text-gray-400 text-center">
                  Ask your cohort lead for the 6-character join code.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
