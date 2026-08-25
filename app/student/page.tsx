'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Compass, Zap, Flame, TrendingUp, BookOpen, Star,
  ChevronRight, ArrowUpRight, Target, Sparkles,
  Trophy, Brain, AlertCircle, CheckCircle2, Calendar,
  BarChart3, Users, Map, Clock,
} from 'lucide-react'
import type { StudentHomeData } from '@/app/api/student/home/route'

// ─── Colour helpers ───────────────────────────────────────────────────────────

const LEVEL_COLOR: Record<number, string> = {
  1: '#f43f5e',
  2: '#f59e0b',
  3: '#10b981',
  4: '#8b5cf6',
}
const LEVEL_BG: Record<number, string> = {
  1: 'rgba(244,63,94,0.12)',
  2: 'rgba(245,158,11,0.12)',
  3: 'rgba(16,185,129,0.12)',
  4: 'rgba(139,92,246,0.12)',
}

const PATHWAY_COLOR: Record<string, string> = {
  'STEM':                 '#6366f1',
  'Social Sciences':      '#0ea5e9',
  'Arts & Sports Science':'#f59e0b',
  'Arts & Sports':        '#f59e0b',
}

const FRS_COLOR: Record<string, string> = {
  Leading:  '#8b5cf6',
  Strong:   '#10b981',
  Growing:  '#0ea5e9',
  Emerging: '#f59e0b',
  Building: '#94a3b8',
}

const TREND_COLOR: Record<string, string> = {
  Improving:       '#10b981',
  Steady:          '#0ea5e9',
  'Needs practice':'#f59e0b',
  Mixed:           '#94a3b8',
  'Just started':  '#94a3b8',
}

function getHour(): number { return new Date().getHours() }
function greeting(first: string): string {
  const h = getHour()
  if (h < 12) return `Good morning, ${first} 🌤️`
  if (h < 17) return `Good afternoon, ${first} ☀️`
  return `Good evening, ${first} 🌙`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({
  icon, value, label, color,
}: { icon: React.ReactNode; value: string | number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2.5 bg-white/[0.05] border border-white/[0.07] rounded-2xl px-4 py-3">
      <div className="shrink-0" style={{ color }}>{icon}</div>
      <div>
        <div className="text-white font-black text-lg leading-none">{value}</div>
        <div className="text-white/40 text-[10px] uppercase tracking-wider mt-0.5">{label}</div>
      </div>
    </div>
  )
}

// ─── NEXT ACTION ────────────────────────────────────────────────────────────

function NextActionHero({ data }: { data: StudentHomeData }) {
  const na = data.nextAction

  if (!na) {
    // Honest zero-state: no live assignment or approved action exists.
    // Never claim the system is "still learning about you" repeatedly —
    // one coherent message, and a genuine, always-available fallback.
    return (
      <Link
        href="/learn"
        className="group relative rounded-3xl p-6 overflow-hidden block"
        style={{ background: 'linear-gradient(135deg, #3730a3 0%, #4f46e5 50%, #6d28d9 100%)' }}
      >
        <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        <div className="relative">
          <p className="text-white/50 text-[11px] uppercase tracking-wider font-bold mb-2">Your next step</p>
          <h2 className="text-xl font-black text-white mb-1">
            {data.hasPendingApprovedAction ? 'Your teacher is reviewing your next steps' : 'Practise with Compass'}
          </h2>
          <p className="text-white/60 text-sm">
            {data.hasTeacher
              ? 'Nothing due right now — a great time to practise'
              : 'Ask your teacher for a class invite, or explore with Compass'}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all">
            <Sparkles size={15} />
            Open Compass
          </div>
        </div>
      </Link>
    )
  }

  const urgent = na.isOverdue
  const bg = urgent
    ? 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 50%, #b91c1c 100%)'
    : 'linear-gradient(135deg, #3730a3 0%, #4f46e5 50%, #6d28d9 100%)'
  const Icon = na.kind === 'compass_action' ? Compass : BookOpen

  return (
    <Link href={na.href} className="group relative rounded-3xl p-6 overflow-hidden block" style={{ background: bg }}>
      <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
            <Icon size={22} className="text-white" />
          </div>
          <ArrowUpRight size={20} className="text-white/50 group-hover:text-white transition-all" />
        </div>
        <p className="text-white/50 text-[11px] uppercase tracking-wider font-bold mb-1">Your next step</p>
        <h2 className="text-xl font-black text-white mb-1">{na.title}</h2>
        {na.subject && <p className="text-white/50 text-xs mb-2">{na.subject}</p>}
        <p className="text-white/70 text-sm">{na.subtitle}</p>
        <div className="mt-4 inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all">
          Start
          <ArrowUpRight size={14} />
        </div>
      </div>
    </Link>
  )
}

// ─── NEEDS ATTENTION ────────────────────────────────────────────────────────

function AttentionSection({ data }: { data: StudentHomeData }) {
  if (data.attention.length === 0) return null
  return (
    <div className="rounded-3xl p-5 border border-amber-500/20 bg-amber-500/[0.06]">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle size={16} className="text-amber-400" />
        <h3 className="font-bold text-white/90">Needs attention</h3>
      </div>
      <div className="space-y-2">
        {data.attention.map(item => {
          const content = (
            <div className="flex items-center justify-between py-2 border-b border-white/[0.05] last:border-0">
              <span className="text-white/80 text-sm">{item.label}</span>
              <ChevronRight size={14} className="text-white/30" />
            </div>
          )
          return item.href
            ? <Link key={item.id} href={item.href} className="block hover:bg-white/[0.03] rounded-xl px-1 -mx-1">{content}</Link>
            : <div key={item.id}>{content}</div>
        })}
      </div>
    </div>
  )
}

// ─── YOUR LEARNING (subject state + recent progress) ───────────────────────

function LearningStateSection({ data }: { data: StudentHomeData }) {
  if (!data.hasAssessment) {
    return (
      <div className="rounded-3xl p-6 border border-dashed border-white/10 text-center">
        <BarChart3 size={32} className="mx-auto mb-3 text-white/20" />
        <p className="text-white/40 text-sm font-semibold mb-1">No assessment data yet</p>
        <p className="text-white/25 text-xs">Your parent or teacher will add your term scores here</p>
      </div>
    )
  }

  return (
    <div className="rounded-3xl p-5 border border-white/[0.07] bg-white/[0.03]">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={16} className="text-indigo-400" />
        <h3 className="font-bold text-white/90">Where you are</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {data.learningState.map(s => {
          const color = LEVEL_COLOR[s.level]
          const bg    = LEVEL_BG[s.level]
          const trend = TREND_COLOR[s.trendLabel]
          return (
            <div key={s.subject} className="rounded-2xl p-4 border flex flex-col gap-2" style={{ backgroundColor: bg, borderColor: `${color}30` }}>
              <span className="text-white/90 font-semibold text-sm leading-tight">{s.displayName}</span>
              <span className="text-[11px] font-bold" style={{ color: trend }}>{s.trendLabel}</span>
            </div>
          )
        })}
      </div>
      {data.recentProgress.length > 0 && (
        <div className="mt-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 space-y-1">
          {data.recentProgress.map(p => (
            <p key={p.subject} className="text-emerald-400 text-xs font-semibold">✓ {p.message}</p>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── CONTINUE ───────────────────────────────────────────────────────────────

function AssignmentRow({ a }: { a: StudentHomeData['continueAssignments'][0] }) {
  const urgent  = a.daysLeft <= 2 && !a.isOverdue
  const color   = a.isOverdue ? '#f43f5e' : urgent ? '#f59e0b' : '#10b981'
  const dueText = a.isOverdue
    ? `${Math.abs(a.daysLeft)}d overdue`
    : a.daysLeft === 0
    ? 'Due today'
    : `${a.daysLeft}d left`
  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/[0.05] last:border-0">
      <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
        <BookOpen size={16} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-white/90 font-semibold text-sm truncate">{a.title}</div>
        <div className="text-white/40 text-xs">{a.subject}</div>
      </div>
      <span className="shrink-0 text-[11px] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: `${color}18`, color }}>
        {dueText}
      </span>
    </div>
  )
}

function SessionRow({ s }: { s: StudentHomeData['continueSessions'][0] }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/[0.05] last:border-0">
      <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(99,102,241,0.15)' }}>
        <Brain size={16} color="#6366f1" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white/90 font-semibold text-sm">{s.subjectLabel}</span>
          {s.levelGained && (
            <span className="text-[10px] font-bold text-violet-300 bg-violet-500/20 px-1.5 py-0.5 rounded-full">Level Up ↑</span>
          )}
        </div>
        {s.summary && <p className="text-white/40 text-xs mt-0.5 truncate">{s.summary}</p>}
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[11px] text-white/30">{s.relativeDate}</span>
          {s.xpEarned > 0 && <span className="text-[11px] font-bold text-amber-400">+{s.xpEarned} XP</span>}
        </div>
      </div>
    </div>
  )
}

// ─── Empty / Loading states ───────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-40 bg-white/[0.04] rounded-2xl" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map(i => <div key={i} className="h-20 bg-white/[0.04] rounded-2xl" />)}
      </div>
      <div className="h-48 bg-white/[0.04] rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-64 bg-white/[0.04] rounded-2xl" />
        <div className="h-64 bg-white/[0.04] rounded-2xl" />
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type LoadState = 'loading' | 'loaded' | 'error'

export default function StudentHomePage() {
  const [data, setData]   = useState<StudentHomeData | null>(null)
  const [state, setState] = useState<LoadState>('loading')

  useEffect(() => {
    fetch('/api/student/home')
      .then(r => r.json())
      .then(j => {
        if (j.error) setState('error')
        else { setData(j.data); setState('loaded') }
      })
      .catch(() => setState('error'))
  }, [])

  // Loading, error, and real-zero-data are distinct states (Phase 7 §25) —
  // a network failure never renders as "you have no assignments."
  if (state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <AlertCircle size={40} className="mx-auto mb-4 text-rose-400" />
          <p className="text-white/60 text-sm">Couldn't load your dashboard right now</p>
          <Link href="/learn" className="mt-4 inline-block text-indigo-400 text-sm underline">
            Go to Learning Compass →
          </Link>
        </div>
      </div>
    )
  }

  if (state === 'loading' || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 pt-8">
        <Skeleton />
      </div>
    )
  }

  const { student, stats } = data
  const pathColor    = PATHWAY_COLOR[student.pathway ?? ''] ?? '#6366f1'
  const pathwayLabel = student.pathway ?? 'Discovering'

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5 pb-24">

      {/* ── GREETING ─────────────────────────────────────────────────────── */}
      <div
        className="relative rounded-3xl overflow-hidden p-6 md:p-8"
        style={{ background: 'linear-gradient(135deg, #1e1040 0%, #0d1a4a 50%, #071428 100%)' }}
      >
        <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ backgroundColor: pathColor }} />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p className="text-white/50 text-sm mb-1 tracking-wide">{greeting(student.firstName)}</p>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">{student.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/10 text-white/80">Grade {student.grade}</span>
              {student.school && (
                <span className="text-xs px-3 py-1.5 rounded-full bg-white/[0.06] text-white/50">{student.school}</span>
              )}
            </div>
          </div>
          {data.hasAssessment && (
            <div className="shrink-0 flex flex-col items-center">
              <div className="relative w-20 h-20">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke={FRS_COLOR[stats.frsLabel] ?? '#94a3b8'}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 42}
                    strokeDashoffset={2 * Math.PI * 42 * (1 - stats.futureReadiness / 100)}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-black text-white leading-none">{stats.futureReadiness}</span>
                </div>
              </div>
              <span className="mt-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: FRS_COLOR[stats.frsLabel] }}>
                {stats.frsLabel}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── 1. WHAT SHOULD I DO NOW? ───────────────────────────────────────── */}
      <NextActionHero data={data} />

      {/* ── 2. NEEDS ATTENTION ─────────────────────────────────────────────── */}
      <AttentionSection data={data} />

      {/* ── STATS ROW (secondary — below the action, not above it) ─────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatPill icon={<Zap size={18} />} value={stats.totalXp.toLocaleString()} label="Total XP" color="#f59e0b" />
        <StatPill icon={<Flame size={18} />} value={stats.streak > 0 ? `${stats.streak}d` : '—'} label="Streak" color="#f43f5e" />
        <StatPill icon={<Brain size={18} />} value={stats.sessionsThisWeek} label="This week" color="#6366f1" />
        <StatPill icon={<Trophy size={18} />} value={stats.totalSessions} label="Sessions" color="#10b981" />
      </div>

      {/* ── 3/4. YOUR LEARNING + CONTINUE ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="flex flex-col gap-5">
          <LearningStateSection data={data} />

          {/* Blueprint teaser — one insight + CTA, never the full Blueprint (Phase 7 §11) */}
          <Link href={data.blueprintHref} className="group rounded-3xl p-5 border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.05] transition-all block">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Map size={16} className="text-violet-400" />
                <h3 className="font-bold text-white/90">Understand my learning</h3>
              </div>
              <ChevronRight size={16} className="text-white/30 group-hover:text-white/60 transition-colors" />
            </div>
            <p className="text-white/50 text-xs">
              {data.blueprintTeaser.insight ?? 'See your full learning picture'}
            </p>
          </Link>
        </div>

        <div className="flex flex-col gap-5">
          {data.continueAssignments.length > 0 && (
            <div className="rounded-3xl p-5 border border-white/[0.07] bg-white/[0.03]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-amber-400" />
                  <h3 className="font-bold text-white/90">Assignments</h3>
                </div>
                <Link href="/dashboard/assignments" className="text-indigo-400 text-xs font-semibold hover:text-indigo-300 transition-colors">
                  View all
                </Link>
              </div>
              {data.continueAssignments.map(a => <AssignmentRow key={a.id} a={a} />)}
            </div>
          )}

          {data.continueSessions.length > 0 ? (
            <div className="rounded-3xl p-5 border border-white/[0.07] bg-white/[0.03]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-violet-400" />
                  <h3 className="font-bold text-white/90">Recent learning</h3>
                </div>
                <Link href="/learn" className="text-indigo-400 text-xs font-semibold hover:text-indigo-300 transition-colors">+ New session</Link>
              </div>
              {data.continueSessions.map(s => <SessionRow key={s.id} s={s} />)}
            </div>
          ) : (
            <div className="rounded-3xl p-6 border border-dashed border-white/10 text-center">
              <Compass size={32} className="mx-auto mb-3 text-white/20" />
              <p className="text-white/40 text-sm font-semibold mb-1">No Compass sessions yet</p>
              <Link href="/learn" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all mt-2">
                <Sparkles size={14} />
                Start now
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── 5. EXPLORE — Career + Study Groups, deliberately below all learning work ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Link href="/student/career" className="group rounded-3xl p-5 border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.05] transition-all block">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${pathColor}20` }}>
              <Target size={18} style={{ color: pathColor }} />
            </div>
            <ChevronRight size={16} className="text-white/30 group-hover:text-white/60 transition-colors" />
          </div>
          <h3 className="font-bold text-white/90 mb-1">Explore your future</h3>
          <p className="text-sm font-semibold" style={{ color: pathColor }}>{pathwayLabel}</p>
        </Link>

        <Link href="/student/groups" className="group rounded-3xl p-5 border border-white/[0.07] bg-white/3 hover:bg-white/5 transition-all block">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(244,63,94,0.15)' }}>
              <Users size={18} style={{ color: '#f43f5e' }} />
            </div>
            <ChevronRight size={16} className="text-white/30 group-hover:text-white/60 transition-colors" />
          </div>
          <h3 className="font-bold text-white/90 mb-1">Study groups</h3>
          <p className="text-white/40 text-xs">Compete with classmates</p>
        </Link>
      </div>

      {/* ── No class connected ─────────────────────────────────────────────── */}
      {!data.hasTeacher && (
        <div className="rounded-3xl p-5 flex items-center gap-4 border" style={{ borderColor: 'rgba(99,102,241,0.2)', backgroundColor: 'rgba(99,102,241,0.06)' }}>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
            <Star size={18} className="text-indigo-400" />
          </div>
          <div className="flex-1">
            <p className="text-white/80 font-semibold text-sm">Not connected to a class?</p>
            <p className="text-white/40 text-xs mt-0.5">Ask your teacher for an invite link to unlock assignments and class insights</p>
          </div>
        </div>
      )}

    </div>
  )
}
