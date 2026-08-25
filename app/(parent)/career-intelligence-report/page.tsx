'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Brain, TrendingUp, AlertTriangle, Loader2, ChevronRight,
  Sparkles, BookOpen, Target, Users, Lightbulb, Shield,
  ArrowRight, Star, CheckCircle2, Lock, Zap, Globe,
  GraduationCap, Building2, User, Bot, Heart, Award,
} from 'lucide-react'
import type { CareerIntelligenceReport } from '@/lib/career/types'

// ── Types ────────────────────────────────────────────────────────────────────

type StudentProfile = {
  id: string
  name: string
  grade: number
  date_of_birth?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function ReadinessRing({ score, label }: { score: number; label: string }) {
  const color = score >= 67 ? '#22c55e' : score >= 44 ? '#f59e0b' : '#f97316'
  const r     = 44
  const circ  = 2 * Math.PI * r
  const dash  = ((100 - score) / 100) * circ

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg className="rotate-[-90deg]" width="112" height="112" viewBox="0 0 112 112">
          <circle cx="56" cy="56" r={r} fill="none" stroke="#ffffff15" strokeWidth="10" />
          <circle
            cx="56" cy="56" r={r} fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={`${circ}`}
            strokeDashoffset={`${dash}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-white">{score}</span>
          <span className="text-xs text-white/40">/ 100</span>
        </div>
      </div>
      <span className="text-sm font-semibold" style={{ color }}>{label}</span>
    </div>
  )
}

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  accent = 'violet',
  children,
}: {
  icon: React.ElementType
  title: string
  subtitle?: string
  accent?: 'violet' | 'green' | 'amber' | 'blue' | 'pink' | 'indigo' | 'teal'
  children: React.ReactNode
}) {
  const colors: Record<string, { border: string; icon: string; bg: string }> = {
    violet: { border: 'border-violet-500/25', icon: 'text-violet-400', bg: 'from-violet-900/20 to-indigo-900/20' },
    green:  { border: 'border-green-500/25',  icon: 'text-green-400',  bg: 'from-green-900/20 to-teal-900/20' },
    amber:  { border: 'border-amber-500/25',  icon: 'text-amber-400',  bg: 'from-amber-900/20 to-orange-900/20' },
    blue:   { border: 'border-blue-500/25',   icon: 'text-blue-400',   bg: 'from-blue-900/20 to-indigo-900/20' },
    pink:   { border: 'border-pink-500/25',   icon: 'text-pink-400',   bg: 'from-pink-900/20 to-purple-900/20' },
    indigo: { border: 'border-indigo-500/25', icon: 'text-indigo-400', bg: 'from-indigo-900/20 to-violet-900/20' },
    teal:   { border: 'border-teal-500/25',   icon: 'text-teal-400',   bg: 'from-teal-900/20 to-cyan-900/20' },
  }
  const c = colors[accent]
  return (
    <section className={`bg-gradient-to-br ${c.bg} border ${c.border} rounded-2xl p-6 space-y-4`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 p-2 rounded-xl bg-white/5 shrink-0`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
        <div>
          <h2 className="text-white font-bold text-lg leading-tight">{title}</h2>
          {subtitle && <p className="text-white/40 text-sm mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function Chip({ text, variant = 'default' }: { text: string; variant?: 'green' | 'amber' | 'red' | 'violet' | 'default' }) {
  const v: Record<string, string> = {
    green:   'bg-green-500/15 border-green-500/30 text-green-300',
    amber:   'bg-amber-500/15 border-amber-500/30 text-amber-300',
    red:     'bg-red-500/15 border-red-500/30 text-red-300',
    violet:  'bg-violet-500/15 border-violet-500/30 text-violet-300',
    default: 'bg-white/5 border-white/10 text-white/60',
  }
  return (
    <span className={`inline-flex text-xs px-2.5 py-1 rounded-full border font-medium ${v[variant]}`}>
      {text}
    </span>
  )
}

function DoorCard({
  icon: Icon,
  title,
  description,
  color,
}: {
  icon: React.ElementType
  title: string
  description: string
  color: string
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className={`text-sm font-bold ${color}`}>{title}</span>
      </div>
      <p className="text-white/60 text-sm leading-relaxed">{description}</p>
    </div>
  )
}

function ChainViz({ subject, chain }: { subject: string; chain: string[] }) {
  return (
    <div className="space-y-1.5">
      <div className="text-white/80 text-sm font-semibold">{subject}</div>
      {chain.map((step, i) => (
        <div key={i} className={`text-sm pl-3 ${i === 0 ? 'text-white/70' : i === chain.length - 1 ? 'text-violet-300 font-medium' : 'text-white/50'}`}>
          {step}
        </div>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CareerIntelligenceReportPage() {
  const [students, setStudents]       = useState<StudentProfile[]>([])
  const [selected, setSelected]       = useState<StudentProfile | null>(null)
  const [report, setReport]           = useState<CareerIntelligenceReport | null>(null)
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [generating, setGenerating]   = useState(false)
  const [error, setError]             = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/students/list')
      .then(r => r.json())
      .then(d => {
        const list: StudentProfile[] = d?.data?.students ?? []
        setStudents(list)
        if (list.length > 0) setSelected(list[0])
      })
      .catch(() => null)
      .finally(() => setLoadingStudents(false))
  }, [])

  async function generateReport(studentId: string) {
    setGenerating(true)
    setError(null)
    setReport(null)
    try {
      const res = await fetch(`/api/career/intelligence-report?studentId=${studentId}`)
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? 'Failed to generate report')
        return
      }
      setReport(data.data.report)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  if (loadingStudents) {
    return (
      <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a14]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── HEADER ────────────────────────────────────────────────────────── */}
        <div className="text-center space-y-3 py-6">
          <div className="inline-flex items-center gap-2 bg-violet-500/20 border border-violet-500/30 rounded-full px-4 py-2 text-violet-300 text-sm font-semibold">
            <Brain className="w-4 h-4" />
            Career Intelligence Report
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white">
            Career Intelligence Engine
          </h1>
          <p className="text-white/50 text-base max-w-xl mx-auto">
            13-section analysis connecting today's learning to tomorrow's opportunities.
            Evidence-based. Honest. Built for Kenya.
          </p>
        </div>

        {/* ── STUDENT SELECTOR ──────────────────────────────────────────────── */}
        {students.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {students.map(s => (
              <button
                key={s.id}
                onClick={() => { setSelected(s); setReport(null) }}
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
        )}

        {!selected ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center">
            <p className="text-white/40">No student profiles found. Add a student first.</p>
          </div>
        ) : !report ? (
          // ── GENERATE CTA ────────────────────────────────────────────────────
          <div className="bg-gradient-to-br from-violet-900/30 to-indigo-900/30 border border-violet-500/30 rounded-2xl p-8 text-center space-y-5">
            <div className="w-16 h-16 bg-violet-500/20 rounded-2xl flex items-center justify-center mx-auto">
              <Brain className="w-8 h-8 text-violet-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-xl mb-2">
                Generate {selected.name}'s Career Intelligence Report
              </h2>
              <p className="text-white/50 text-sm max-w-md mx-auto">
                A 13-section analysis of {selected.name.split(' ')[0]}'s learning profile,
                hidden strengths, growth barriers, and the clearest path from school to opportunity.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-white/50">
              {[
                'Career readiness score',
                'AI reality check',
                'Hidden strengths',
                'Teacher insights',
                'Four career doors',
                'Education → Opportunity chains',
                'Parent guidance',
                'If Learning Continues...',
              ].map(item => (
                <div key={item} className="bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-center">
                  {item}
                </div>
              ))}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={() => generateReport(selected.id)}
              disabled={generating}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-lg hover:shadow-violet-500/25 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {generating
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating report…</>
                : <><Sparkles className="w-5 h-5" /> Generate Full Report</>
              }
            </button>

            {generating && (
              <p className="text-white/30 text-xs">
                This takes 20–40 seconds. We're analysing {selected.name.split(' ')[0]}'s full profile.
              </p>
            )}
          </div>
        ) : (
          // ── FULL 13-SECTION REPORT ───────────────────────────────────────
          <div className="space-y-6">

            {/* Report header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-white font-bold text-xl">{report.student_name}</h2>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300">
                    {report.mode === 'exploration' ? 'Exploring Possibilities' : 'Career Planning'}
                  </span>
                </div>
                <p className="text-white/40 text-sm">
                  Grade {report.grade} · Age {report.age}
                  {report.pathway ? ` · ${report.pathway} Pathway` : ''}
                  {report.dream_career ? ` · Dream: ${report.dream_career}` : ''}
                </p>
              </div>
              <button
                onClick={() => generateReport(selected.id)}
                disabled={generating}
                className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300 font-semibold disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {generating ? 'Regenerating…' : 'Regenerate'}
              </button>
            </div>

            {/* ── S1: Career Readiness Snapshot ─────────────────────────────── */}
            <SectionCard icon={Target} title="Career Readiness Snapshot" subtitle="Where this learner stands today" accent="violet">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <ReadinessRing score={report.readiness_score} label={report.readiness_label} />
                <div className="flex-1 space-y-3">
                  <p className="text-white/70 text-sm leading-relaxed">{report.readiness_summary}</p>
                  <p className="text-white/50 text-xs italic">{report.learning_habits_note}</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-white/40 uppercase tracking-wide mb-1.5 font-semibold">Current Strengths</p>
                      <div className="flex flex-wrap gap-1.5">
                        {report.current_strengths.map(s => <Chip key={s} text={s} variant="green" />)}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-white/40 uppercase tracking-wide mb-1.5 font-semibold">Current Challenges</p>
                      <div className="flex flex-wrap gap-1.5">
                        {report.current_challenges.map(c => <Chip key={c} text={c} variant="amber" />)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* ── S2: Hidden Strengths ──────────────────────────────────────── */}
            <SectionCard icon={Lightbulb} title="Hidden Strengths" subtitle="What the marks don't always show" accent="green">
              <div className="space-y-3">
                {report.hidden_strengths.map((hs, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-1.5">
                    <p className="text-white/85 text-sm font-medium">{hs.strength}</p>
                    <p className="text-white/50 text-xs">{hs.evidence}</p>
                    <p className="text-green-400/80 text-xs">{hs.career_relevance}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* ── S3: Growth Barriers ───────────────────────────────────────── */}
            <SectionCard icon={AlertTriangle} title="Growth Barriers" subtitle="What's limiting future opportunities — and how to change that" accent="amber">
              <div className="space-y-3">
                {report.growth_barriers.map((gb, i) => (
                  <div key={i} className="bg-white/5 border border-amber-500/20 rounded-xl p-4 space-y-1.5">
                    <p className="text-amber-300 text-sm font-medium">{gb.barrier}</p>
                    <p className="text-white/50 text-xs">{gb.explanation}</p>
                    <div className="flex items-start gap-2 pt-1">
                      <ChevronRight className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
                      <p className="text-green-300/80 text-xs">{gb.opportunity_if_improved}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* ── S4: Future Opportunity Landscape ──────────────────────────── */}
            <SectionCard icon={Globe} title="Future Opportunity Landscape" subtitle="Where this learner fits today — and where they could go" accent="blue">
              <div className="space-y-4">
                {report.strong_fit_now.length > 0 && (
                  <div>
                    <p className="text-xs text-green-400 font-bold uppercase tracking-wide mb-2">Strong fit now</p>
                    <div className="space-y-2">
                      {report.strong_fit_now.map((e, i) => (
                        <div key={i} className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                          <p className="text-white font-semibold text-sm">{e.career}</p>
                          <p className="text-white/50 text-xs mt-0.5 leading-relaxed">{e.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {report.fit_after_improvement.length > 0 && (
                  <div>
                    <p className="text-xs text-blue-400 font-bold uppercase tracking-wide mb-2">Possible after improvement</p>
                    <div className="space-y-2">
                      {report.fit_after_improvement.map((e, i) => (
                        <div key={i} className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                          <p className="text-white font-semibold text-sm">{e.career}</p>
                          <p className="text-white/50 text-xs mt-0.5">{e.what_to_improve}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {report.unlikely_today.length > 0 && (
                  <div>
                    <p className="text-xs text-white/30 font-bold uppercase tracking-wide mb-2">Unlikely today — but possible over time</p>
                    <div className="space-y-2">
                      {report.unlikely_today.map((e, i) => (
                        <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 opacity-70">
                          <p className="text-white/60 font-semibold text-sm">{e.career}</p>
                          <p className="text-white/40 text-xs mt-0.5">{e.what_would_make_realistic}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* ── S5: AI Reality Check ──────────────────────────────────────── */}
            {report.ai_reality_check && (
              <SectionCard icon={Bot} title="AI Reality Check" subtitle={`How AI changes ${report.ai_reality_check.career_title}`} accent="indigo">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-xs text-red-400 font-bold uppercase tracking-wide">AI will automate</p>
                    {report.ai_reality_check.tasks_ai_will_automate.map((t, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-white/50">
                        <span className="text-red-400 mt-1 text-xs">×</span> {t}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-green-400 font-bold uppercase tracking-wide">Humans will still do</p>
                    {report.ai_reality_check.tasks_humans_still_do.map((t, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-white/70">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" /> {t}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="text-xs text-violet-400 font-bold uppercase tracking-wide mb-1.5">How to prepare</p>
                  <p className="text-white/60 text-sm leading-relaxed">{report.ai_reality_check.how_to_prepare}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 font-bold uppercase tracking-wide mb-1.5">Skills becoming more valuable</p>
                  <div className="flex flex-wrap gap-1.5">
                    {report.ai_reality_check.skills_becoming_valuable.map(s => <Chip key={s} text={s} variant="violet" />)}
                  </div>
                </div>
              </SectionCard>
            )}

            {/* ── S6: Four Career Doors ─────────────────────────────────────── */}
            {report.four_doors && (
              <SectionCard icon={Lock} title="The Four Career Doors" subtitle="Four ways the same skills can create value" accent="pink">
                <div className="grid sm:grid-cols-2 gap-3">
                  <DoorCard icon={Building2} title="Door 1 — Employment"       color="text-blue-400"   description={report.four_doors.employment} />
                  <DoorCard icon={User}      title="Door 2 — Self-Employment"  color="text-green-400"  description={report.four_doors.self_employment} />
                  <DoorCard icon={TrendingUp} title="Door 3 — Business"        color="text-amber-400"  description={report.four_doors.business_creation} />
                  <DoorCard icon={Bot}       title="Door 4 — AI-Augmented"     color="text-violet-400" description={report.four_doors.ai_augmented} />
                </div>
              </SectionCard>
            )}

            {/* ── S7: Education → Opportunity Map ───────────────────────────── */}
            {report.education_chains.length > 0 && (
              <SectionCard icon={ArrowRight} title="Education → Opportunity Map" subtitle="Why school subjects matter — the actual chain" accent="teal">
                <div className="grid sm:grid-cols-2 gap-5">
                  {report.education_chains.map((ec, i) => (
                    <ChainViz key={i} subject={ec.subject} chain={ec.chain} />
                  ))}
                </div>
              </SectionCard>
            )}

            {/* ── S8: Domain Expertise ──────────────────────────────────────── */}
            <SectionCard icon={Award} title="On Mastery vs Average" subtitle="Why going deep matters more than knowing a little about everything" accent="violet">
              <p className="text-white/70 text-sm leading-relaxed">{report.domain_expertise}</p>
            </SectionCard>

            {/* ── S9: Career Flexibility ────────────────────────────────────── */}
            <SectionCard icon={TrendingUp} title="Career Flexibility" subtitle="How today's interests can grow in multiple directions" accent="green">
              <p className="text-white/70 text-sm leading-relaxed">{report.career_flexibility}</p>
            </SectionCard>

            {/* ── S10: Parent Guidance ──────────────────────────────────────── */}
            <SectionCard icon={Heart} title="Parent Guidance" subtitle="Simple, affordable, realistic actions" accent="pink">
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-pink-400 font-bold uppercase tracking-wide mb-2">Three actions this week</p>
                  <ul className="space-y-2">
                    {report.parent_this_week.map((a, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-white/65">
                        <CheckCircle2 className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs text-violet-400 font-bold uppercase tracking-wide mb-2">Three actions this month</p>
                  <ul className="space-y-2">
                    {report.parent_this_month.map((a, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-white/65">
                        <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-xs text-amber-400 font-bold uppercase tracking-wide mb-1.5">One long-term habit</p>
                  <p className="text-white/70 text-sm">{report.parent_long_term_habit}</p>
                </div>
              </div>
            </SectionCard>

            {/* ── S11: Teacher Insight ──────────────────────────────────────── */}
            <SectionCard icon={GraduationCap} title="Teacher Insight" subtitle="For educators who want to see the full picture" accent="blue">
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-amber-400 font-bold uppercase tracking-wide mb-1.5">Subjects requiring intervention</p>
                  <div className="flex flex-wrap gap-1.5">
                    {report.teacher_insight.subjects_requiring_intervention.map(s => (
                      <Chip key={s} text={s} variant="amber" />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-green-400 font-bold uppercase tracking-wide mb-1.5">Hidden strengths a teacher might miss</p>
                  <ul className="space-y-1.5">
                    {report.teacher_insight.hidden_strengths.map((s, i) => (
                      <li key={i} className="text-white/65 text-sm flex items-start gap-2">
                        <Lightbulb className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" /> {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs text-blue-400 font-bold uppercase tracking-wide mb-1.5">Suggested classroom opportunities</p>
                  <ul className="space-y-1.5">
                    {report.teacher_insight.suggested_classroom_opportunities.map((s, i) => (
                      <li key={i} className="text-white/65 text-sm flex items-start gap-2">
                        <Star className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" /> {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs text-violet-400 font-bold uppercase tracking-wide mb-1.5">Suggested responsibilities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {report.teacher_insight.suggested_responsibilities.map(s => (
                      <Chip key={s} text={s} variant="violet" />
                    ))}
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-xs text-white/40 uppercase tracking-wide mb-1.5 font-semibold">How to nurture confidence</p>
                  <p className="text-white/70 text-sm">{report.teacher_insight.how_to_nurture_confidence}</p>
                </div>
              </div>
            </SectionCard>

            {/* ── S12: Learner Challenge ────────────────────────────────────── */}
            <SectionCard icon={Zap} title="Learner Challenge" subtitle="One achievable challenge that connects learning to life" accent="amber">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 space-y-3">
                <p className="text-white font-bold text-base">{report.learner_challenge.challenge}</p>
                <p className="text-white/60 text-sm leading-relaxed">{report.learner_challenge.why}</p>
                <div>
                  <p className="text-xs text-amber-400 font-bold uppercase tracking-wide mb-1.5">How to do it</p>
                  <p className="text-white/65 text-sm">{report.learner_challenge.how_to_do_it}</p>
                </div>
              </div>
            </SectionCard>

            {/* ── S13: Career Intelligence Summary ─────────────────────────── */}
            <SectionCard icon={Shield} title="Career Intelligence Summary" subtitle="Evidence-based. Not motivational fluff." accent="indigo">
              <p className="text-white/80 text-sm leading-relaxed">{report.intelligence_summary}</p>
            </SectionCard>

            {/* ── SIGNATURE: If Learning Continues Like This... ─────────────── */}
            <section className="bg-gradient-to-br from-violet-900/40 via-indigo-900/30 to-violet-900/40 border border-violet-400/30 rounded-2xl p-7 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-500/20 rounded-xl">
                  <Sparkles className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">If Learning Continues Like This…</h2>
                  <p className="text-violet-300/60 text-sm">The story that becomes possible</p>
                </div>
              </div>
              <div className="prose prose-invert prose-sm max-w-none">
                {report.if_learning_continues.split('\n\n').map((para, i) => (
                  <p key={i} className="text-white/75 text-sm leading-relaxed mb-3 last:mb-0">
                    {para}
                  </p>
                ))}
              </div>
            </section>

            {/* ── DISCLAIMER ────────────────────────────────────────────────── */}
            <div className="border-t border-white/5 pt-4">
              <p className="text-white/25 text-xs leading-relaxed">{report.disclaimer}</p>
            </div>

            {/* ── FOOTER CTA ────────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-3 justify-center pb-8">
              <Link
                href="/career"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white font-semibold px-5 py-3 rounded-xl transition-all text-sm border border-white/10"
              >
                <BookOpen className="w-4 h-4" />
                Explore Careers
              </Link>
              <Link
                href="/career-intelligence"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white font-semibold px-5 py-3 rounded-xl transition-all text-sm border border-white/10"
              >
                <Brain className="w-4 h-4" />
                Capability Profile
              </Link>
              <Link
                href="/learn"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold px-5 py-3 rounded-xl transition-all shadow-lg hover:shadow-violet-500/20 text-sm"
              >
                <Zap className="w-4 h-4" />
                View Learning Compass Progress
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
