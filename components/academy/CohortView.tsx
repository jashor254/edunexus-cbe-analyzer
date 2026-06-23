'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Users, ChevronLeft, Copy, Check, Crown, Zap, BookOpen,
  LogOut, Loader2, Trophy,
} from 'lucide-react'
import type { CohortDetail } from '@/lib/academy/cohorts'

interface Props {
  cohort: CohortDetail
  currentTeacherId: string
}

export default function CohortView({ cohort, currentTeacherId }: Props) {
  const router = useRouter()
  const [copied, setCopied]   = useState(false)
  const [leaving, setLeaving] = useState(false)
  const isLead = cohort.lead_teacher_id === currentTeacherId

  function copyCode() {
    navigator.clipboard.writeText(cohort.join_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleLeave() {
    if (!confirm('Leave this cohort?')) return
    setLeaving(true)
    try {
      const res = await fetch(`/api/academy/cohort/${cohort.id}/leave`, { method: 'POST' })
      if (!res.ok) {
        const j = await res.json()
        alert(j.error ?? 'Failed to leave cohort')
        setLeaving(false)
        return
      }
      router.push('/teacher/academy/cohort/new')
    } catch {
      setLeaving(false)
    }
  }

  const maxXp   = Math.max(...cohort.members.map(m => m.totalXp), 1)
  const current = cohort.members.find(m => m.teacher_id === currentTeacherId)
  const myRank  = cohort.members.findIndex(m => m.teacher_id === currentTeacherId) + 1

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="bg-[#0c1929] relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-size-[40px_40px]" />
        <div className="absolute top-0 left-1/3 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <Link
              href="/teacher/academy/cohort/new"
              className="inline-flex items-center gap-1.5 text-slate-400 hover:text-teal-400 text-xs font-semibold transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> My Cohorts
            </Link>
            {!isLead && (
              <button
                onClick={handleLeave}
                disabled={leaving}
                className="flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-red-300 transition"
              >
                {leaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                Leave cohort
              </button>
            )}
          </div>

          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-12 h-12 bg-cyan-500/15 border border-cyan-500/30 rounded-2xl flex items-center justify-center shrink-0">
              <Users className="w-6 h-6 text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-black text-white leading-tight">{cohort.name}</h1>
              {cohort.school && <p className="text-slate-400 text-xs mt-0.5">{cohort.school}</p>}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-xs text-slate-400">{cohort.totalMembers} member{cohort.totalMembers !== 1 ? 's' : ''}</span>
                {myRank > 0 && (
                  <span className="flex items-center gap-1 text-xs font-bold text-amber-400">
                    <Trophy className="w-3.5 h-3.5" /> #{myRank} on leaderboard
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Join code (visible to lead and members) */}
          <div className="mt-6 flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-4 py-2">
              <span className="text-[11px] text-slate-400 font-semibold">Join code</span>
              <span className="text-lg font-black text-white tracking-[0.25em]">{cohort.join_code}</span>
            </div>
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-bold px-3 py-2 rounded-xl transition"
            >
              {copied ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
            </button>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* My position card */}
        {current && (
          <div className="bg-white rounded-2xl border border-teal-100 shadow-sm p-5">
            <p className="text-[11px] font-black text-teal-600 uppercase tracking-wide mb-3">Your standing</p>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-center">
                <p className="text-3xl font-black text-gray-900">#{myRank}</p>
                <p className="text-[11px] text-gray-400">Rank</p>
              </div>
              <div className="h-10 w-px bg-gray-100" />
              <div className="text-center">
                <p className="text-3xl font-black text-amber-500">{current.totalXp}</p>
                <p className="text-[11px] text-gray-400">XP</p>
              </div>
              <div className="h-10 w-px bg-gray-100" />
              <div className="text-center">
                <p className="text-3xl font-black text-teal-600">{current.completedLessons}</p>
                <p className="text-[11px] text-gray-400">Lessons</p>
              </div>
              <div className="flex-1 min-w-0 ml-2">
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="h-2 bg-teal-400 rounded-full transition-all"
                    style={{ width: `${Math.round((current.totalXp / maxXp) * 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  {maxXp - current.totalXp > 0 ? `${maxXp - current.totalXp} XP to #1` : 'You are leading!'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Full leaderboard */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" /> Leaderboard
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {cohort.members.map((m, idx) => {
              const isMe = m.teacher_id === currentTeacherId
              const rank = idx + 1
              const pct  = Math.round((m.totalXp / maxXp) * 100)
              const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null

              return (
                <div
                  key={m.teacher_id}
                  className={`flex items-center gap-4 px-5 py-3.5 ${isMe ? 'bg-teal-50/60' : ''}`}
                >
                  {/* Rank */}
                  <div className="w-8 text-center shrink-0">
                    {medal
                      ? <span className="text-lg leading-none">{medal}</span>
                      : <span className="text-sm font-black text-gray-400">#{rank}</span>
                    }
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-bold truncate ${isMe ? 'text-teal-700' : 'text-gray-800'}`}>
                        {m.full_name ?? 'Mwalimu'}
                        {isMe && <span className="text-[11px] font-normal text-teal-500 ml-1">(you)</span>}
                      </span>
                      {m.isLead && (
                        <span className="flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">
                          <Crown className="w-2.5 h-2.5" /> Lead
                        </span>
                      )}
                    </div>
                    {m.school && <p className="text-[11px] text-gray-400 truncate">{m.school}</p>}
                    {/* XP bar */}
                    <div className="w-full bg-gray-100 rounded-full h-1 mt-1.5">
                      <div
                        className="h-1 rounded-full transition-all"
                        style={{ width: `${pct}%`, background: isMe ? '#14b8a6' : '#e2e8f0' }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="shrink-0 text-right">
                    <div className="flex items-center gap-1.5 justify-end mb-0.5">
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span className="text-sm font-black text-gray-800">{m.totalXp}</span>
                    </div>
                    <div className="flex items-center gap-1.5 justify-end text-[11px] text-gray-400">
                      <BookOpen className="w-3 h-3" />
                      {m.completedLessons}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex justify-center">
          <Link
            href="/teacher/academy"
            className="text-xs font-bold text-teal-600 hover:text-teal-700 transition"
          >
            Back to Academy →
          </Link>
        </div>
      </div>
    </div>
  )
}
