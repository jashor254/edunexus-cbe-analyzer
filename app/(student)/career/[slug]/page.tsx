'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Sparkles, TrendingUp, MapPin, Clock, BookOpen,
  Star, CheckCircle2, AlertTriangle, Loader2, Users, Heart,
  ChevronRight, Zap, Shield, Target, GraduationCap, Briefcase
} from 'lucide-react'
import type { Career, CareerMatchWithDetail } from '@/lib/career/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

const AI_IMPACT_CONFIG: Record<string, { label: string; classes: string; icon: React.ReactNode; message: string }> = {
  low:          {
    label: 'AI-Safe',
    classes: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: <Shield className="w-4 h-4" />,
    message: 'This career is protected by human skills AI cannot replicate.',
  },
  medium:       {
    label: 'AI-Assisted',
    classes: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    icon: <Zap className="w-4 h-4" />,
    message: 'AI assists this career. Learn to use the tools and you\'ll be more effective, not replaced.',
  },
  high:         {
    label: 'AI-Disrupted',
    classes: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    icon: <AlertTriangle className="w-4 h-4" />,
    message: 'Routine tasks in this career are automating. Specialization and judgment are your advantage.',
  },
  transforming: {
    label: 'AI-Evolving Fast',
    classes: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    icon: <Sparkles className="w-4 h-4" />,
    message: 'This role looks very different by 2028. Those who adapt early will lead.',
  },
}

const PATHWAY_TYPE_LABELS: Record<string, string> = {
  university:     'University Degree',
  college:        'College / Diploma',
  tvet:           'TVET / Technical',
  self_taught:    'Self-Taught',
  entrepreneurial:'Start Your Own',
  apprenticeship: 'Apprenticeship',
}

function formatKES(amount: number): string {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`
  if (amount >= 1000) return `${(amount / 1000).toFixed(0)}k`
  return String(amount)
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
    // Load student profile
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
    const params = studentId ? `?studentId=${studentId}` : ''
    fetch(`/api/career/${slug}${params}`)
      .then(r => r.json())
      .then(d => {
        setCareer(d?.data?.career ?? null)
        setMatch(d?.data?.student_match ?? null)
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [slug, studentId])

  // Set timeline to student's current age group
  useEffect(() => {
    if (!career) return
    const ageRanges = career.skill_timeline.map(t => t.age_range)
    let idx = 0
    if (studentAge >= 20) idx = 3
    else if (studentAge >= 17) idx = 2
    else if (studentAge >= 14) idx = 1
    else idx = 0
    setActiveTimelineIdx(Math.min(idx, ageRanges.length - 1))
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
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    )
  }

  if (!career) {
    return (
      <div className="min-h-screen bg-[#0a0a14] flex flex-col items-center justify-center gap-4">
        <p className="text-white/50">Career not found.</p>
        <Link href="/career" className="text-violet-400 text-sm hover:text-violet-300">
          ← Back to careers
        </Link>
      </div>
    )
  }

  const aiConfig = AI_IMPACT_CONFIG[career.ai_impact_level] ?? AI_IMPACT_CONFIG.medium
  const currentTimeline = career.skill_timeline[activeTimelineIdx]

  return (
    <div className="min-h-screen bg-[#0a0a14]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── BACK + SAVE ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <Link
            href="/career"
            className="flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors"
          >
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

        {/* ── HERO ──────────────────────────────────────────────────────────── */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
          <div className="flex flex-wrap gap-2 mb-4">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${aiConfig.classes}`}>
              {aiConfig.icon} {aiConfig.label}
            </span>
            <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 capitalize">
              {career.category}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">{career.title}</h1>
          <p className="text-white/60 text-base leading-relaxed">{career.description}</p>

          {/* Salary */}
          {career.salary_range_kes && (
            <div className="mt-5 flex flex-wrap gap-4">
              <div className="bg-white/5 rounded-xl px-4 py-3">
                <div className="text-xs text-white/40 mb-1">Starting salary</div>
                <div className="text-white font-bold">
                  KES {formatKES(career.salary_range_kes.min)}/mo
                </div>
              </div>
              <div className="bg-white/5 rounded-xl px-4 py-3">
                <div className="text-xs text-white/40 mb-1">Experienced</div>
                <div className="text-white font-bold">
                  KES {formatKES(career.salary_range_kes.max)}/mo
                </div>
              </div>
              {career.salary_range_kes.senior_max && (
                <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3">
                  <div className="text-xs text-violet-400/70 mb-1">Senior / specialist</div>
                  <div className="text-violet-300 font-bold">
                    KES {formatKES(career.salary_range_kes.senior_max)}/mo
                  </div>
                </div>
              )}
              <div className="bg-white/5 rounded-xl px-4 py-3 flex-1 min-w-[120px]">
                <div className="text-xs text-white/40 mb-1">Note</div>
                <div className="text-white/60 text-xs">{career.salary_range_kes.note}</div>
              </div>
            </div>
          )}
        </div>

        {/* ── AI MATCH SCORE (if available) ─────────────────────────────────── */}
        {match && (
          <div className="bg-gradient-to-br from-violet-900/30 to-indigo-900/30 border border-violet-500/30 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-bold flex items-center gap-2">
                <Target className="w-5 h-5 text-violet-400" /> Your Match Score
              </h2>
              <span className={`text-3xl font-black ${
                match.match_score >= 75 ? 'text-green-400' :
                match.match_score >= 55 ? 'text-amber-400' : 'text-orange-400'
              }`}>{match.match_score}%</span>
            </div>
            <p className="text-white/60 text-sm mb-4">{match.match_reasoning}</p>
            {match.subject_gaps && (match.subject_gaps as unknown[]).length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-white/40 font-semibold uppercase tracking-wide">Subject Gaps</div>
                {(match.subject_gaps as Array<{ subject: string; current_score: number; required_score: number; advice: string }>)
                  .map(gap => (
                    <div key={gap.subject} className="bg-white/5 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white/80 text-sm font-semibold capitalize">{gap.subject}</span>
                        <span className="text-xs text-amber-400">{gap.current_score}/4 → needs {gap.required_score}/4</span>
                      </div>
                      <p className="text-white/50 text-xs">{gap.advice}</p>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        )}

        {/* ── AI IMPACT HONEST SECTION ─────────────────────────────────────── */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-white font-bold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              What AI Will Change
            </h2>
            <p className="text-white/60 text-sm leading-relaxed">{career.ai_impact}</p>
          </div>
          <div className="bg-green-900/20 border border-green-500/20 rounded-2xl p-6">
            <h2 className="text-white font-bold mb-3 flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-400" />
              What AI Will NOT Replace
            </h2>
            <ul className="space-y-2">
              {career.future_skills.map(skill => (
                <li key={skill} className="flex items-start gap-2 text-sm text-white/70">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                  {skill}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── SKILL AGE TIMELINE ───────────────────────────────────────────── */}
        <section>
          <h2 className="text-white font-bold text-xl mb-2 flex items-center gap-2">
            <Clock className="w-5 h-5 text-violet-400" />
            Skill Age Timeline
          </h2>
          <p className="text-white/40 text-sm mb-5">
            Where you are now, and what to build next.
          </p>

          {/* Timeline tabs — horizontal scroll on mobile */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
            {career.skill_timeline.map((item, idx) => {
              const isStudent = idx === activeTimelineIdx
              const ageStart = parseInt(item.age_range.split('–')[0])
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
                    isStudent
                      ? 'bg-violet-600 border-violet-500 text-white'
                      : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                  }`}
                >
                  <span>{item.age_range}</span>
                  {isStudentAge && (
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-300" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Active timeline content */}
          {currentTimeline && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
              <div>
                <div className="text-violet-400 text-sm font-semibold mb-1">Why this matters</div>
                <p className="text-white/70 text-sm">{currentTimeline.why}</p>
              </div>

              <div>
                <div className="text-white/40 text-sm font-semibold uppercase tracking-wide mb-3">Skills to build</div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {currentTimeline.skills.map(skill => (
                    <div key={skill} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
                      <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
                      <span className="text-white/80 text-sm">{skill}</span>
                    </div>
                  ))}
                </div>
              </div>

              {currentTimeline.activities && currentTimeline.activities.length > 0 && (
                <div>
                  <div className="text-white/40 text-sm font-semibold uppercase tracking-wide mb-3">Suggested activities</div>
                  <ul className="space-y-2">
                    {currentTimeline.activities.map(activity => (
                      <li key={activity} className="flex items-start gap-2 text-sm text-white/60">
                        <Star className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        {activity}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── PATHWAYS ──────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-white font-bold text-xl mb-5 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-violet-400" />
            The 3 Pathways to Get There
          </h2>
          <div className="space-y-4">
            {career.pathways.map((pathway, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <span className="text-xs font-semibold text-violet-400 uppercase tracking-wide">
                      {PATHWAY_TYPE_LABELS[pathway.type] ?? pathway.type}
                    </span>
                    <h3 className="text-white font-bold mt-1">{pathway.description}</h3>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-white/40 text-xs mb-1">Duration</div>
                    <div className="text-white font-bold text-sm">{pathway.duration_years} yr{pathway.duration_years > 1 ? 's' : ''}</div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="text-white/40 text-xs mb-1">Cost (KES)</div>
                    <div className="text-white font-semibold text-sm">
                      {formatKES(pathway.cost_kes.min)} – {formatKES(pathway.cost_kes.max)}
                    </div>
                    <div className="text-white/30 text-xs mt-0.5">{pathway.cost_kes.note}</div>
                  </div>
                  {pathway.entry_requirements && (
                    <div className="bg-white/5 rounded-xl p-3">
                      <div className="text-white/40 text-xs mb-1">Entry requirement</div>
                      <div className="text-white/70 text-xs">{pathway.entry_requirements}</div>
                    </div>
                  )}
                </div>

                {pathway.institutions.length > 0 && (
                  <div className="mt-4">
                    <div className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-2">Where in Kenya</div>
                    <div className="flex flex-wrap gap-2">
                      {pathway.institutions.map(inst => (
                        <span key={inst} className="text-xs bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-white/60">
                          {inst}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── REQUIRED SUBJECTS with student scores overlay ────────────────── */}
        {career.required_subjects.length > 0 && (
          <section>
            <h2 className="text-white font-bold text-xl mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-violet-400" />
              Required Subjects
            </h2>
            <div className="flex flex-wrap gap-2">
              {career.required_subjects.map(subj => {
                const gap = match?.subject_gaps
                  ? (match.subject_gaps as Array<{ subject: string }>)
                      .find(g => g.subject.toLowerCase() === subj.toLowerCase())
                  : null
                return (
                  <span
                    key={subj}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium ${
                      gap
                        ? 'bg-amber-500/20 border border-amber-500/30 text-amber-300'
                        : 'bg-white/5 border border-white/10 text-white/70'
                    }`}
                  >
                    {subj.replace(/_/g, ' ')}
                    {gap && <AlertTriangle className="inline-block w-3 h-3 ml-1.5 mb-0.5" />}
                  </span>
                )
              })}
            </div>
            {match?.subject_gaps && (match.subject_gaps as unknown[]).length > 0 && (
              <p className="text-amber-400/60 text-xs mt-2">
                <AlertTriangle className="inline-block w-3 h-3 mr-1" />
                Amber subjects are areas where your scores need improvement for this career.
              </p>
            )}
          </section>
        )}

        {/* ── KENYA REALITY ─────────────────────────────────────────────────── */}
        {career.kenya_market_outlook && (
          <section className="bg-gradient-to-br from-green-900/20 to-teal-900/20 border border-green-500/20 rounded-2xl p-6">
            <h2 className="text-white font-bold text-xl mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-400" />
              Kenya Market Reality
            </h2>
            <p className="text-white/70 text-sm leading-relaxed">{career.kenya_market_outlook}</p>
          </section>
        )}

        {/* ── KENYA EXAMPLES ────────────────────────────────────────────────── */}
        {career.kenya_examples && career.kenya_examples.length > 0 && (
          <section>
            <h2 className="text-white font-bold text-xl mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-violet-400" />
              Kenyans Who Did It
            </h2>
            <div className="space-y-3">
              {career.kenya_examples.map(example => (
                <div key={example.name} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <div className="font-bold text-white mb-1">{example.name}</div>
                  <p className="text-white/60 text-sm mb-2">{example.what_they_did}</p>
                  <div className="flex items-center gap-2 text-xs text-violet-400">
                    <Briefcase className="w-3 h-3" />
                    Started from: {example.started_from}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── OBSOLETE SKILLS (if any) ──────────────────────────────────────── */}
        {career.obsolete_skills && career.obsolete_skills.length > 0 && (
          <section className="bg-red-900/10 border border-red-500/20 rounded-2xl p-6">
            <h2 className="text-white/80 font-bold mb-3 flex items-center gap-2 text-base">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              Skills AI Is Already Replacing in This Field
            </h2>
            <ul className="space-y-1">
              {career.obsolete_skills.map(skill => (
                <li key={skill} className="text-red-400/60 text-sm flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500/40" />
                  {skill}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── SAVE CTA ──────────────────────────────────────────────────────── */}
        <div className="text-center pb-8">
          <button
            onClick={handleSaveInterest}
            disabled={saving || saved || !studentId}
            className={`inline-flex items-center gap-2 font-bold px-8 py-4 rounded-2xl transition-all text-base ${
              saved
                ? 'bg-green-500/20 border border-green-500/30 text-green-400 cursor-default'
                : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg hover:shadow-violet-500/25 disabled:opacity-40'
            }`}
          >
            {saved
              ? <><CheckCircle2 className="w-5 h-5" /> Career Saved to Your Profile!</>
              : <><Heart className="w-5 h-5" /> Save This Career</>
            }
          </button>
          <Link href="/career" className="block mt-4 text-white/30 text-sm hover:text-white/50 transition-colors">
            ← Back to all careers
          </Link>
        </div>

      </div>
    </div>
  )
}
