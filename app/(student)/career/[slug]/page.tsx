'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Sparkles, TrendingUp, MapPin, Clock, BookOpen,
  Star, CheckCircle2, AlertTriangle, Loader2, Users, Heart,
  ChevronRight, Zap, Shield, Target, GraduationCap, Briefcase,
  Info, Rocket, User, ArrowRight,
} from 'lucide-react'
import type { Career, CareerMatchWithDetail, CareerDoor } from '@/lib/career/types'

// ── Door config ───────────────────────────────────────────────────────────────

const DOOR_CONFIG = {
  employment: {
    label: 'Employment',
    icon: Briefcase,
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    accent: 'text-blue-400',
  },
  self_employment: {
    label: 'Self Employment',
    icon: User,
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    badge: 'bg-green-500/20 text-green-400 border-green-500/30',
    accent: 'text-green-400',
  },
  entrepreneurship: {
    label: 'Build a Business',
    icon: Rocket,
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    accent: 'text-amber-400',
  },
  ai_era: {
    label: 'AI-Era Opportunity',
    icon: Sparkles,
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    badge: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    accent: 'text-violet-400',
  },
}

function formatKES(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`
  return String(n)
}

// ── 4 Doors Section ───────────────────────────────────────────────────────────

function DoorCard({ door }: { door: CareerDoor }) {
  const cfg = DOOR_CONFIG[door.type]
  const Icon = cfg.icon
  const isAIEra = door.type === 'ai_era'

  return (
    <div className={`${cfg.bg} border ${cfg.border} rounded-2xl p-5 space-y-3 relative overflow-hidden`}>
      {isAIEra && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
          </span>
          <span className="text-xs font-bold text-violet-400 uppercase tracking-wide">New Door</span>
        </div>
      )}
      <div className="flex items-center gap-2.5">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${cfg.bg} border ${cfg.border}`}>
          <Icon className={`w-4.5 h-4.5 ${cfg.accent}`} />
        </div>
        <h3 className={`font-bold text-sm ${cfg.accent}`}>{cfg.label}</h3>
      </div>
      <h4 className="text-white font-bold text-base leading-tight">{door.title}</h4>
      <p className="text-white/60 text-sm leading-relaxed">{door.description}</p>

      {/* Door-type specific details */}
      {door.type === 'employment' && (
        <div className="space-y-2">
          {door.salary_range && (
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-white/70">
                KES {formatKES(door.salary_range.min)} – {formatKES(door.salary_range.max)}/mo
              </span>
            </div>
          )}
          {door.time_to_first_job && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-white/50 text-xs">{door.time_to_first_job}</span>
            </div>
          )}
          {door.employers && door.employers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {door.employers.slice(0, 4).map(e => (
                <span key={e} className="text-xs bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg text-white/50">{e}</span>
              ))}
              {door.employers.length > 4 && (
                <span className="text-xs text-white/30">+{door.employers.length - 4} more</span>
              )}
            </div>
          )}
        </div>
      )}

      {door.type === 'self_employment' && (
        <div className="space-y-2">
          {door.startup_cost_kes && (
            <div className="flex items-center gap-2 text-sm">
              <Zap className="w-3.5 h-3.5 text-green-400 shrink-0" />
              <span className="text-white/70">
                Start from KES {formatKES(door.startup_cost_kes.min)}
              </span>
            </div>
          )}
          {door.platforms && door.platforms.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {door.platforms.slice(0, 4).map(p => (
                <span key={p} className="text-xs bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg text-white/50">{p}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {door.type === 'entrepreneurship' && (
        <div className="space-y-2">
          {door.market_size && (
            <div className="flex items-start gap-2 text-sm">
              <Target className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span className="text-white/60 text-xs">{door.market_size}</span>
            </div>
          )}
          {door.kenya_examples && door.kenya_examples.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {door.kenya_examples.slice(0, 3).map(e => (
                <span key={e} className="text-xs bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg text-amber-400/80">{e}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {door.type === 'ai_era' && (
        <div className="space-y-2">
          {door.ai_opportunity && (
            <p className="text-violet-300/80 text-xs leading-relaxed">{door.ai_opportunity}</p>
          )}
          {door.skills_needed && door.skills_needed.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {door.skills_needed.map(s => (
                <span key={s} className="text-xs bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-lg text-violet-300/80">{s}</span>
              ))}
            </div>
          )}
          {door.early_mover_advantage && (
            <div className="flex items-center gap-1.5 mt-2">
              <Star className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-400 text-xs font-semibold">Early mover advantage</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CareerDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)

  const [career, setCareer] = useState<Career | null>(null)
  const [match, setMatch] = useState<CareerMatchWithDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [studentAge, setStudentAge] = useState<number>(15)
  const [activeTimelineIdx, setActiveTimelineIdx] = useState(0)

  useEffect(() => {
    fetch('/api/students/list')
      .then(r => r.json())
      .then(d => {
        const students = d?.data?.students ?? []
        if (students.length > 0) {
          const s = students[0]
          setStudentId(s.id as string)
          if (s.date_of_birth) {
            const age = Math.floor((Date.now() - new Date(s.date_of_birth as string).getTime()) / (365.25 * 24 * 3600 * 1000))
            setStudentAge(age)
          }
        }
      })
      .catch(() => null)
  }, [])

  useEffect(() => {
    const qs = studentId ? `?studentId=${studentId}` : ''
    fetch(`/api/career/${slug}${qs}`)
      .then(r => r.json())
      .then(d => {
        setCareer(d?.data?.career ?? null)
        setMatch(d?.data?.student_match ?? null)
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [slug, studentId])

  useEffect(() => {
    if (!career) return
    let idx = 0
    if (studentAge >= 20) idx = 3
    else if (studentAge >= 17) idx = 2
    else if (studentAge >= 14) idx = 1
    setActiveTimelineIdx(Math.min(idx, career.skill_timeline.length - 1))
  }, [career, studentAge])

  const handleSaveInterest = async () => {
    if (!studentId || !career) return
    setSaving(true)
    try {
      await fetch('/api/career/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, careerSlug: career.slug, interestLevel: 4 }),
      })
      setSaved(true)
    } catch { /* silent */ } finally { setSaving(false) }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
    </div>
  )

  if (!career) return (
    <div className="min-h-screen bg-[#0a0a14] flex flex-col items-center justify-center gap-4">
      <p className="text-white/50">Career not found.</p>
      <Link href="/career" className="text-violet-400 text-sm hover:text-violet-300">← Back to careers</Link>
    </div>
  )

  const currentTimeline = career.skill_timeline[activeTimelineIdx]
  const aiImpact = career.ai_impact

  return (
    <div className="min-h-screen bg-[#0a0a14]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── NAV ────────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <Link href="/career" className="flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> All Careers
          </Link>
          <button
            onClick={handleSaveInterest}
            disabled={saving || saved || !studentId}
            className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border transition-all ${
              saved
                ? 'bg-green-500/20 border-green-500/30 text-green-400'
                : 'bg-white/5 border-white/10 text-white/70 hover:bg-violet-500/20 hover:border-violet-500/30 hover:text-violet-300 disabled:opacity-40'
            }`}
          >
            {saved ? <><CheckCircle2 className="w-4 h-4" /> Saved!</> : <><Heart className="w-4 h-4" /> Save Career</>}
          </button>
        </div>

        {/* ── HERO ───────────────────────────────────────────────────────────── */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 capitalize">
              {career.category}
            </span>
            {career.pathway && (
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300">
                {career.pathway} Pathway
              </span>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">{career.title}</h1>
          <p className="text-white/60 text-base leading-relaxed">{career.description}</p>

          {career.salary_range_kes && (
            <div className="mt-5 flex flex-wrap gap-3">
              <div className="bg-white/5 rounded-xl px-4 py-3">
                <div className="text-xs text-white/40 mb-1">Starting</div>
                <div className="text-white font-bold">KES {formatKES(career.salary_range_kes.min)}/mo</div>
              </div>
              <div className="bg-white/5 rounded-xl px-4 py-3">
                <div className="text-xs text-white/40 mb-1">Experienced</div>
                <div className="text-white font-bold">KES {formatKES(career.salary_range_kes.max)}/mo</div>
              </div>
              {career.salary_range_kes.senior_max && (
                <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3">
                  <div className="text-xs text-violet-400/70 mb-1">Senior specialist</div>
                  <div className="text-violet-300 font-bold">KES {formatKES(career.salary_range_kes.senior_max)}/mo</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── MATCH SCORE ────────────────────────────────────────────────────── */}
        {match && (
          <div className="bg-gradient-to-br from-violet-900/30 to-indigo-900/30 border border-violet-500/30 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-bold flex items-center gap-2">
                <Target className="w-5 h-5 text-violet-400" /> Your Match Score
              </h2>
              <span className={`text-3xl font-black ${match.match_score >= 75 ? 'text-green-400' : match.match_score >= 55 ? 'text-amber-400' : 'text-orange-400'}`}>
                {match.match_score}%
              </span>
            </div>
            <p className="text-white/60 text-sm">{match.match_reasoning}</p>
          </div>
        )}

        {/* ══ THE 4 DOORS ════════════════════════════════════════════════════════ */}
        {career.doors && career.doors.length > 0 && (
          <section>
            <h2 className="text-white font-bold text-xl mb-2 flex items-center gap-2">
              <Zap className="w-5 h-5 text-violet-400" />
              The 4 Ways to Build This Career
            </h2>
            <p className="text-white/40 text-sm mb-5">
              Every career has more than one door. Employment is just one of them.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {career.doors.map(door => (
                <DoorCard key={door.type} door={door} />
              ))}
            </div>
          </section>
        )}

        {/* ══ AI IMPACT SECTION ══════════════════════════════════════════════════ */}
        {aiImpact && (
          <section>
            <h2 className="text-white font-bold text-xl mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-400" />
              How AI Is Changing This Career
            </h2>
            <p className="text-white/40 text-sm mb-5">
              Honest assessment — not fear, not hype. Just what's actually happening.
            </p>

            {/* 3-column grid */}
            <div className="grid sm:grid-cols-3 gap-4 mb-5">
              {/* Replacing */}
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <h3 className="text-red-400 font-bold text-sm">AI Is Replacing</h3>
                </div>
                <ul className="space-y-2">
                  {aiImpact.replacing.map(task => (
                    <li key={task} className="flex items-start gap-2 text-xs text-white/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500/50 shrink-0 mt-1.5" />
                      {task}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Creating */}
              <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <h3 className="text-green-400 font-bold text-sm">AI Is Creating</h3>
                </div>
                <ul className="space-y-2">
                  {aiImpact.creating.map(opp => (
                    <li key={opp} className="flex items-start gap-2 text-xs text-white/60">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
                      {opp}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Human Advantage */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <h3 className="text-blue-400 font-bold text-sm">Human Advantage</h3>
                </div>
                <ul className="space-y-2">
                  {aiImpact.human_advantage.map(adv => (
                    <li key={adv} className="flex items-start gap-2 text-xs text-white/60">
                      <Star className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      {adv}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Honest summary */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
              <p className="text-white/70 text-sm leading-relaxed">{aiImpact.honest_summary}</p>
              <p className="text-white/40 text-xs flex items-start gap-1.5">
                <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-white/30" />
                {aiImpact.timeline}
              </p>
            </div>
          </section>
        )}

        {/* ── SKILL AGE TIMELINE ──────────────────────────────────────────────── */}
        <section>
          <h2 className="text-white font-bold text-xl mb-2 flex items-center gap-2">
            <Clock className="w-5 h-5 text-violet-400" />
            Skill Age Timeline
          </h2>
          <p className="text-white/40 text-sm mb-5">Where you are now, and what to build next.</p>

          <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
            {career.skill_timeline.map((item, idx) => {
              const isActive = idx === activeTimelineIdx
              const isStudentAge = (
                (studentAge >= 10 && studentAge <= 13 && idx === 0) ||
                (studentAge >= 14 && studentAge <= 16 && idx === 1) ||
                (studentAge >= 17 && studentAge <= 19 && idx === 2) ||
                (studentAge >= 20 && idx === 3)
              )
              return (
                <button
                  key={item.age_range}
                  onClick={() => setActiveTimelineIdx(idx)}
                  className={`shrink-0 flex flex-col items-center gap-1 px-5 py-3 rounded-xl border text-sm font-semibold transition-all ${
                    isActive ? 'bg-violet-600 border-violet-500 text-white' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                  }`}
                >
                  <span>{item.age_range}</span>
                  {item.phase && <span className={`text-xs ${isActive ? 'text-violet-200' : 'text-white/30'}`}>{item.phase}</span>}
                  {isStudentAge && <span className="w-1.5 h-1.5 rounded-full bg-violet-300" />}
                </button>
              )
            })}
          </div>

          {currentTimeline && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
              <div>
                <div className="text-violet-400 text-sm font-semibold mb-1">Why this age matters</div>
                <p className="text-white/70 text-sm">{currentTimeline.why}</p>
              </div>
              <div>
                <div className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-3">Skills to build now</div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {currentTimeline.skills.map(skill => (
                    <div key={skill} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
                      <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
                      <span className="text-white/80 text-sm">{skill}</span>
                    </div>
                  ))}
                </div>
              </div>
              {currentTimeline.parent_action && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                  <div className="text-amber-400 text-xs font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5" /> Parent Action Right Now
                  </div>
                  <p className="text-amber-300/80 text-sm">{currentTimeline.parent_action}</p>
                </div>
              )}
              {currentTimeline.activities && currentTimeline.activities.length > 0 && (
                <div>
                  <div className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-3">Suggested activities</div>
                  <ul className="space-y-2">
                    {currentTimeline.activities.map(activity => (
                      <li key={activity} className="flex items-start gap-2 text-sm text-white/60">
                        <ChevronRight className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                        {activity}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── REQUIRED SUBJECTS ──────────────────────────────────────────────── */}
        {career.required_subjects.length > 0 && (
          <section>
            <h2 className="text-white font-bold text-xl mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-violet-400" /> Required Subjects
            </h2>
            <div className="flex flex-wrap gap-2">
              {career.required_subjects.map(subj => {
                const importance = career.subject_importance?.[subj] ?? 'helpful'
                const gap = match?.subject_gaps
                  ? (match.subject_gaps as Array<{ subject: string }>).find(g => g.subject.toLowerCase() === subj.toLowerCase())
                  : null
                const classes =
                  gap ? 'bg-amber-500/20 border-amber-500/30 text-amber-300' :
                  importance === 'critical' ? 'bg-violet-500/10 border-violet-500/20 text-violet-300' :
                  'bg-white/5 border-white/10 text-white/70'
                return (
                  <span key={subj} className={`px-3 py-1.5 rounded-xl text-sm font-medium border ${classes}`}>
                    {subj.replace(/_/g, ' ')}
                    {importance === 'critical' && <span className="ml-1 text-xs opacity-60">(critical)</span>}
                    {gap && <AlertTriangle className="inline-block w-3 h-3 ml-1.5 mb-0.5" />}
                  </span>
                )
              })}
            </div>
          </section>
        )}

        {/* ── KENYA REALITY ──────────────────────────────────────────────────── */}
        {career.kenya_market_outlook && (
          <section className="bg-gradient-to-br from-green-900/20 to-teal-900/20 border border-green-500/20 rounded-2xl p-6">
            <h2 className="text-white font-bold text-xl mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-400" /> Kenya Market Reality
            </h2>
            <p className="text-white/70 text-sm leading-relaxed">{career.kenya_market_outlook}</p>
          </section>
        )}

        {/* ── KENYA EXAMPLES ─────────────────────────────────────────────────── */}
        {career.kenya_examples && career.kenya_examples.length > 0 && (
          <section>
            <h2 className="text-white font-bold text-xl mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-violet-400" /> Kenyans Who Did It
            </h2>
            <div className="space-y-3">
              {career.kenya_examples.map(example => {
                const doorLabel = example.door ? DOOR_CONFIG[example.door]?.label : null
                return (
                  <div key={example.name} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="font-bold text-white">{example.name}</div>
                      {doorLabel && (
                        <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-lg shrink-0">{doorLabel}</span>
                      )}
                    </div>
                    <p className="text-white/60 text-sm mb-2">{example.what_they_did}</p>
                    <div className="flex items-center gap-2 text-xs text-violet-400/70">
                      <Briefcase className="w-3 h-3" />
                      Started from: {example.started_from}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── FUTURE SKILLS ──────────────────────────────────────────────────── */}
        {career.future_skills && career.future_skills.length > 0 && (
          <section>
            <h2 className="text-white font-bold text-base mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" /> Skills That Will Matter More as AI Grows
            </h2>
            <div className="flex flex-wrap gap-2">
              {career.future_skills.map(skill => (
                <span key={skill} className="text-xs bg-green-500/10 border border-green-500/20 px-2.5 py-1.5 rounded-xl text-green-300/80">
                  {skill}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ── DISCLAIMER ─────────────────────────────────────────────────────── */}
        <div className="bg-white/3 border border-white/8 rounded-xl p-4 flex items-start gap-2.5">
          <Info className="w-3.5 h-3.5 text-white/25 shrink-0 mt-0.5" />
          <p className="text-white/35 text-xs italic leading-relaxed">{career.disclaimer}</p>
        </div>

        {/* ── SAVE CTA ───────────────────────────────────────────────────────── */}
        <div className="text-center pb-8">
          <button
            onClick={handleSaveInterest}
            disabled={saving || saved || !studentId}
            className={`inline-flex items-center gap-2 font-bold px-8 py-4 rounded-2xl transition-all text-base ${
              saved
                ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg hover:shadow-violet-500/25 disabled:opacity-40'
            }`}
          >
            {saved ? <><CheckCircle2 className="w-5 h-5" /> Saved!</> : <><Heart className="w-5 h-5" /> Save This Career</>}
          </button>
          <Link href="/career" className="block mt-4 text-white/30 text-sm hover:text-white/50 transition-colors">
            ← Back to all careers
          </Link>
        </div>

      </div>
    </div>
  )
}
