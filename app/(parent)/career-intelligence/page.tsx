'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Brain, TrendingUp, AlertTriangle, Loader2, ChevronRight,
  MessageSquare, Heart, CheckCircle2, Lightbulb, ArrowLeft,
  Users, Star, AlertCircle, Sparkles, BookOpen, Target,
} from 'lucide-react'
import type {
  ParentIntelligenceReport, CapabilityCareerMatch,
} from '@/lib/career/types'

// ── Types ────────────────────────────────────────────────────────────────────

type StudentProfile = {
  id: string
  name: string
  grade: number
  date_of_birth?: string
}

type IntelligenceData = {
  has_profile: boolean
  report: ParentIntelligenceReport | null
  match_report: {
    primary: CapabilityCareerMatch[]
    stretch: CapabilityCareerMatch[]
  } | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function alignPct(score: number): number {
  return Math.round(Math.min(1, Math.max(0, score)) * 100)
}

const TIER_COLOR: Record<string, string> = {
  primary:        'text-green-400',
  stretch:        'text-blue-400',
  alternative:    'text-amber-400',
  entrepreneurial:'text-purple-400',
}
const TIER_LABEL: Record<string, string> = {
  primary:        'Strong Match',
  stretch:        'Stretch Goal',
  alternative:    'Alternative Path',
  entrepreneurial:'Entrepreneurial',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CareerCard({ match }: { match: CapabilityCareerMatch }) {
  const pct   = alignPct(match.alignment_score)
  const color = TIER_COLOR[match.tier] ?? 'text-white'
  const label = TIER_LABEL[match.tier] ?? match.tier

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-white font-semibold text-sm">{match.career_title}</div>
          <div className={`text-xs font-medium ${color} mt-0.5`}>{label}</div>
        </div>
        <div className={`text-2xl font-black shrink-0 ${color}`}>{pct}%</div>
      </div>
      <p className="text-white/50 text-xs leading-relaxed">{match.narrative}</p>
      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/40 capitalize">{match.career_category}</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/40">{match.pathway}</span>
      </div>
    </div>
  )
}

function Section({ icon: Icon, title, color = 'text-violet-400', children }: {
  icon: React.ElementType
  title: string
  color?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${color}`} />
        <h2 className="text-white font-bold text-lg">{title}</h2>
      </div>
      {children}
    </section>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CareerIntelligencePage() {
  const [students,   setStudents]   = useState<StudentProfile[]>([])
  const [selected,   setSelected]   = useState<StudentProfile | null>(null)
  const [data,       setData]       = useState<IntelligenceData | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [studentsLoading, setStudentsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/students/list')
      .then(r => r.json())
      .then(d => {
        const list: StudentProfile[] = d?.data?.students ?? []
        setStudents(list)
        if (list.length > 0) setSelected(list[0])
      })
      .catch(() => null)
      .finally(() => setStudentsLoading(false))
  }, [])

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    setData(null)
    fetch(`/api/parent/career-intelligence?studentId=${selected.id}`)
      .then(r => r.json())
      .then(d => setData(d?.data ?? null))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [selected])

  const report = data?.report

  return (
    <div className="min-h-screen bg-[#0a0a14]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Nav */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
        </div>

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-6 h-6 text-violet-400" />
            <h1 className="text-white font-black text-2xl">Career Intelligence</h1>
          </div>
          <p className="text-white/50 text-sm">
            Understand your child&apos;s capability profile and the careers that align with who they actually are.
          </p>
        </div>

        {/* Student selector */}
        {studentsLoading ? (
          <div className="flex items-center gap-2 text-white/40"><Loader2 className="w-4 h-4 animate-spin" /> Loading students…</div>
        ) : students.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {students.map(s => (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                  selected?.id === s.id
                    ? 'bg-violet-600 border-violet-500 text-white'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        ) : null}

        {/* Content */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          </div>
        )}

        {!loading && data && !data.has_profile && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-8 text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
            <div className="text-white font-bold text-lg">No capability profile yet</div>
            <p className="text-white/50 text-sm">
              {selected?.name ?? 'Your child'} needs at least one assessment recorded before we can build their capability profile.
              Ask their teacher to add assessment scores, or navigate to their Learn page.
            </p>
          </div>
        )}

        {!loading && report && (
          <div className="space-y-8">

            {/* Profile summary */}
            <div className="bg-gradient-to-br from-violet-900/20 to-indigo-900/20 border border-violet-500/20 rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2 text-violet-400 text-xs font-bold uppercase tracking-wide">
                <Sparkles className="w-4 h-4" /> Capability Summary
              </div>
              <p className="text-white/80 text-sm leading-relaxed">{report.profile_summary}</p>
            </div>

            {/* Strengths & growth areas */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Section icon={Star} title="Top Strengths" color="text-green-400">
                <div className="space-y-3">
                  {report.top_strengths.map((s, i) => (
                    <div key={i} className="flex items-start gap-2.5 bg-green-500/8 border border-green-500/15 rounded-xl p-3">
                      <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                      <p className="text-white/70 text-xs leading-relaxed">{s}</p>
                    </div>
                  ))}
                </div>
              </Section>

              <Section icon={TrendingUp} title="Growth Areas" color="text-amber-400">
                <div className="space-y-3">
                  {report.growth_areas.map((g, i) => (
                    <div key={i} className="flex items-start gap-2.5 bg-amber-500/8 border border-amber-500/15 rounded-xl p-3">
                      <Target className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-white/70 text-xs leading-relaxed">{g}</p>
                    </div>
                  ))}
                </div>
              </Section>
            </div>

            {/* Career matches */}
            <Section icon={Sparkles} title="Career Matches" color="text-violet-400">
              {report.recommended_careers.length === 0 ? (
                <p className="text-white/40 text-sm">More assessment data will unlock career matches.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {report.recommended_careers.map(m => <CareerCard key={m.career_slug} match={m} />)}
                </div>
              )}
              <Link
                href="/career"
                className="flex items-center gap-2 text-violet-400 text-sm font-semibold hover:text-violet-300 transition-colors mt-2"
              >
                View all careers <ChevronRight className="w-4 h-4" />
              </Link>
            </Section>

            {/* Conversation starters */}
            <Section icon={MessageSquare} title="Conversation Starters" color="text-blue-400">
              <p className="text-white/40 text-xs mb-3">Questions that open real conversations about their future:</p>
              <div className="space-y-2.5">
                {report.conversation_starters.map((q, i) => (
                  <div key={i} className="flex items-start gap-3 bg-blue-500/8 border border-blue-500/15 rounded-xl p-4">
                    <div className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-400 text-xs font-bold">{i + 1}</div>
                    <p className="text-white/70 text-sm leading-relaxed">&ldquo;{q}&rdquo;</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* Support actions */}
            <Section icon={Heart} title="How to Support Them" color="text-rose-400">
              <div className="space-y-2.5">
                {report.support_actions.map((a, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <ChevronRight className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <p className="text-white/70 text-sm leading-relaxed">{a}</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* Weekly habits */}
            <Section icon={BookOpen} title="Weekly Habits That Help" color="text-teal-400">
              <div className="space-y-2.5">
                {report.weekly_habits.map((h, i) => (
                  <div key={i} className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <p className="text-white/60 text-xs leading-relaxed">{h}</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* Red flags */}
            {report.red_flags.length > 0 && (
              <Section icon={AlertTriangle} title="Things to Watch" color="text-orange-400">
                <div className="space-y-2.5">
                  {report.red_flags.map((f, i) => (
                    <div key={i} className="flex items-start gap-3 bg-orange-500/8 border border-orange-500/15 rounded-xl p-4">
                      <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                      <p className="text-white/70 text-sm leading-relaxed">{f}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Career Intelligence Report CTA */}
            <div className="bg-gradient-to-br from-violet-900/30 to-indigo-900/30 border border-violet-500/25 rounded-2xl p-5 text-center space-y-3">
              <div className="text-white font-bold text-base">Want the full picture?</div>
              <p className="text-white/50 text-sm">
                The Career Intelligence Report combines this profile with a 13-section analysis —
                including hidden strengths, growth barriers, AI reality check, teacher insights,
                and the "If Learning Continues Like This…" narrative.
              </p>
              <Link
                href="/career-intelligence-report"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold px-5 py-3 rounded-xl transition-all text-sm shadow-lg hover:shadow-violet-500/20"
              >
                <BookOpen className="w-4 h-4" />
                Generate Career Intelligence Report
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Disclaimer */}
            <div className="flex items-start gap-2 text-white/30 text-xs leading-relaxed border-t border-white/10 pt-6">
              <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5 text-white/20" />
              <p>{report.disclaimer}</p>
            </div>

          </div>
        )}

      </div>
    </div>
  )
}
