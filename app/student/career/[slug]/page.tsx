'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  ArrowLeft, Sparkles, TrendingUp, MapPin, Clock, BookOpen,
  Star, CheckCircle2, AlertTriangle, Loader2, Users, Heart,
  ChevronRight, ChevronDown, ChevronUp, Zap, Shield, Target, GraduationCap, Briefcase,
  Info, Rocket, User, ArrowRight, Brain, TrendingDown, Minus,
  ArrowUpRight, DollarSign, Timer, Flame, AlertCircle, CheckCircle,
} from 'lucide-react'
import type {
  Career, CareerMatchWithDetail, CareerDoor,
  CapabilityCareerMatch, CapabilityDimension,
  KCSEMinimum, CostToQualify, SocialReality, LifeSimulation,
} from '@/lib/career/types'
import { CAPABILITY_LABELS } from '@/lib/career/capabilityExtractor'
import { alignmentToPercent, tierLabel } from '@/lib/career/capabilityMatchEngine'
import { buildLifeSimulation } from '@/lib/career/lifeSimulator'
import { getCareerSignalsForCareer, type CareerSignal } from '@/lib/career/careerSignals'

// ── Door config ───────────────────────────────────────────────────────────────

const DOOR_CONFIG = {
  employment:     { label: 'Employment',           icon: Briefcase, bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',     accent: 'text-blue-400'   },
  self_employment:{ label: 'Self Employment',      icon: User,      bg: 'bg-green-500/10',  border: 'border-green-500/20',  badge: 'bg-green-500/20 text-green-400 border-green-500/30',  accent: 'text-green-400'  },
  entrepreneurship:{ label: 'Build a Business',   icon: Rocket,    bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',  accent: 'text-amber-400'  },
  ai_era:         { label: 'AI-Era Opportunity',  icon: Sparkles,  bg: 'bg-violet-500/10', border: 'border-violet-500/20', badge: 'bg-violet-500/20 text-violet-400 border-violet-500/30', accent: 'text-violet-400' },
}

const LEVEL_FILL: Record<string, string> = {
  exceptional: 'bg-green-500',
  strong:      'bg-emerald-500',
  capable:     'bg-blue-500',
  developing:  'bg-amber-500',
  emerging:    'bg-red-500/70',
}

const DIMENSION_ORDER: CapabilityDimension[] = [
  'analytical_reasoning', 'technical_aptitude', 'communication',
  'creative_thinking', 'social_intelligence', 'resilience',
]

function formatKES(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000)    return `${(n / 1000).toFixed(0)}k`
  return String(n)
}

// ── Trend icon ────────────────────────────────────────────────────────────────

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'accelerating') return <ArrowUpRight className="w-3 h-3 text-green-400" />
  if (trend === 'growing')      return <TrendingUp className="w-3 h-3 text-emerald-400" />
  if (trend === 'declining')    return <TrendingDown className="w-3 h-3 text-red-400" />
  return <Minus className="w-3 h-3 text-white/30" />
}

// ── Capability alignment section ──────────────────────────────────────────────

function CapabilityAlignmentSection({ match }: { match: CapabilityCareerMatch }) {
  const pct    = alignmentToPercent(match.alignment_score)
  const tier   = match.tier
  const tLabel = tierLabel(tier)

  const tierColor =
    tier === 'primary'        ? 'text-green-400'  :
    tier === 'stretch'        ? 'text-blue-400'   :
    tier === 'entrepreneurial'? 'text-purple-400' :
    'text-amber-400'

  const tierBorder =
    tier === 'primary'        ? 'border-green-500/30 from-green-900/20 to-emerald-900/20' :
    tier === 'stretch'        ? 'border-blue-500/30 from-blue-900/20 to-indigo-900/20'   :
    tier === 'entrepreneurial'? 'border-purple-500/30 from-purple-900/20 to-violet-900/20':
    'border-amber-500/30 from-amber-900/20 to-yellow-900/20'

  return (
    <section className={`bg-gradient-to-br ${tierBorder} border rounded-2xl p-6 space-y-5`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-5 h-5 text-violet-400" />
            <h2 className="text-white font-bold text-lg">Your Capability Alignment</h2>
          </div>
          <p className="text-white/40 text-xs">How your real capabilities match what this career needs</p>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-4xl font-black ${tierColor}`}>{pct}%</div>
          <div className={`text-xs font-bold mt-0.5 ${tierColor}`}>{tLabel}</div>
        </div>
      </div>

      {/* Narrative */}
      <p className="text-white/65 text-sm leading-relaxed">{match.narrative}</p>

      {/* Dimension bars */}
      <div className="space-y-3">
        <div className="text-white/40 text-xs font-semibold uppercase tracking-wide">Dimension Breakdown</div>
        {DIMENSION_ORDER.map(dim => {
          const dimProfile = match.dimension_scores[dim]
          const gap        = match.gaps.find(g => g.dimension === dim)
          const strength   = match.strengths.find(s => s.dimension === dim)
          const studentScore = gap?.student_score ?? strength ? (strength ? gap?.required_ideal ?? 0.8 : 0) : (dimProfile ?? 0)

          // Find actual student score from gap or compute from contribution
          const rawScore = gap?.student_score ?? (
            match.strengths.find(s => s.dimension === dim) ? 0.85 : 0.45
          )
          const pctBar = Math.round(rawScore * 100)
          const level  = gap?.student_level ?? (match.strengths.find(s => s.dimension === dim)?.level ?? 'capable')
          const fill   = LEVEL_FILL[level] ?? 'bg-white/30'

          const status =
            gap?.gap_severity === 'significant' ? 'gap-sig' :
            gap?.gap_severity === 'moderate'    ? 'gap-mod' :
            gap?.gap_severity === 'minor'       ? 'gap-min' :
            strength ? 'strength' : 'meets'

          return (
            <div key={dim} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-semibold ${
                  status === 'strength' ? 'text-green-300' :
                  status === 'gap-sig'  ? 'text-red-400' :
                  status === 'gap-mod'  ? 'text-amber-400' :
                  'text-white/60'
                }`}>
                  {CAPABILITY_LABELS[dim]}
                </span>
                <div className="flex items-center gap-1.5">
                  {status === 'strength' && <CheckCircle className="w-3 h-3 text-green-400" />}
                  {(status === 'gap-sig' || status === 'gap-mod') && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                  <span className="text-xs text-white/40 capitalize">{level}</span>
                  <span className="text-xs font-bold text-white/70 w-7 text-right">{pctBar}%</span>
                </div>
              </div>
              <div className="relative h-2 bg-white/8 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${fill} ${status === 'gap-sig' ? 'opacity-60' : 'opacity-80'}`}
                  style={{ width: `${pctBar}%` }}
                />
                {/* Minimum requirement marker */}
                {gap && (
                  <div
                    className="absolute top-0 h-full w-0.5 bg-red-400/60"
                    style={{ left: `${Math.round(gap.required_minimum * 100)}%` }}
                    title={`Minimum: ${Math.round(gap.required_minimum * 100)}%`}
                  />
                )}
              </div>
              {gap && gap.gap_severity !== 'none' && (
                <p className={`text-[11px] leading-relaxed ${
                  gap.gap_severity === 'significant' ? 'text-red-400/80' : 'text-amber-400/70'
                }`}>
                  {gap.narrative}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Strengths summary */}
      {match.strengths.length > 0 && (
        <div className="bg-green-500/8 border border-green-500/20 rounded-xl p-4 space-y-2">
          <div className="text-green-400 text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" /> Your Strengths for This Career
          </div>
          {match.strengths.slice(0, 2).map(s => (
            <p key={s.dimension} className="text-green-300/70 text-xs leading-relaxed">{s.narrative}</p>
          ))}
        </div>
      )}
    </section>
  )
}

// ── Career Signals section ("What's changing in this field?") ─────────────────
// Phase 8.1 — a small, human-curated, source-backed set of world-of-work
// developments (lib/career/careerSignals.ts). Reads nothing about the learner —
// the same signals render for every learner viewing this career. See
// docs/architecture/phase8-career-signals-audit.md for the architecture contract.

const SIGNAL_GEOGRAPHY_LABEL: Record<CareerSignal['geography'], string> = {
  KENYA: 'Kenya',
  EAST_AFRICA: 'East Africa',
  AFRICA: 'Africa',
  GLOBAL: 'Global',
}

const SIGNAL_CONFIDENCE_LABEL: Record<CareerSignal['confidence'], string> = {
  EARLY: 'Early signal',
  EMERGING: 'Emerging change',
  ESTABLISHED: 'Well established',
}

function CareerSignalCard({ signal }: { signal: CareerSignal }) {
  const [showSources, setShowSources] = useState(false)

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/50">
          {SIGNAL_GEOGRAPHY_LABEL[signal.geography]}
        </span>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300">
          {SIGNAL_CONFIDENCE_LABEL[signal.confidence]}
        </span>
      </div>

      <div>
        <p className="text-white font-semibold text-sm mb-1">{signal.title}</p>
        <p className="text-white/70 text-sm leading-relaxed">{signal.summary}</p>
      </div>

      <div>
        <p className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-1">Why it matters</p>
        <p className="text-white/60 text-sm leading-relaxed">{signal.learnerExplanation}</p>
      </div>

      {signal.exploreNext.length > 0 && (
        <div>
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-1">What you could explore</p>
          <ul className="space-y-1">
            {signal.exploreNext.map(item => (
              <li key={item} className="text-white/60 text-sm leading-relaxed flex items-start gap-1.5">
                <span className="text-violet-400 mt-0.5">•</span>{item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {signal.relatedCareerSlugs.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {signal.relatedCareerSlugs.map(slug => (
            <Link
              key={slug}
              href={`/student/career/${slug}?source=signal`}
              className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 capitalize hover:text-violet-300 hover:border-violet-500/30 transition-colors"
            >
              {slug.replace(/-/g, ' ')}
            </Link>
          ))}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowSources(s => !s)}
          aria-expanded={showSources}
          className="flex items-center gap-1 text-white/40 hover:text-white/60 text-xs font-medium transition-colors"
        >
          {showSources ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          Sources
        </button>
        {showSources && (
          <ul className="mt-2 space-y-1.5">
            {signal.sources.map(source => (
              <li key={source.url} className="text-xs text-white/40">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/50 hover:text-violet-300 underline underline-offset-2"
                >
                  {source.publisher}
                </a>
                {' — '}
                {new Date(source.publishedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'short' })}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function CareerSignalsSection({ careerSlug }: { careerSlug: string }) {
  const signals = getCareerSignalsForCareer(careerSlug)
  if (signals.length === 0) return null

  return (
    <section>
      <h2 className="text-white font-bold text-xl mb-1 flex items-center gap-2">
        <Zap className="w-5 h-5 text-violet-400" /> What&apos;s changing in this field?
      </h2>
      <p className="text-white/40 text-sm mb-4">Real, source-backed developments — not predictions.</p>
      <div className="space-y-4">
        {signals.map(signal => (
          <CareerSignalCard key={signal.id} signal={signal} />
        ))}
      </div>
    </section>
  )
}

// ── Reality check section ─────────────────────────────────────────────────────

function RealityCheckSection({
  career,
  capMatch,
}: {
  career:   Career
  capMatch: CapabilityCareerMatch | null
}) {
  const kcse    = career.kcse_minimum   as KCSEMinimum   | null | undefined
  const cost    = career.cost_to_qualify as CostToQualify | null | undefined
  const demand  = career.kenya_demand
  const diff    = career.difficulty
  const risk    = career.risk_level
  const time    = career.time_to_income_years

  if (!kcse && !cost && !demand) return null

  const demandBadge =
    demand === 'critical_shortage' ? { label: 'Critical Shortage', class: 'bg-green-500/15 text-green-400 border-green-500/25' } :
    demand === 'undersupplied'     ? { label: 'Undersupplied',     class: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' } :
    demand === 'balanced'          ? { label: 'Balanced Demand',   class: 'bg-blue-500/15 text-blue-400 border-blue-500/25' } :
    demand === 'saturated'         ? { label: 'Saturated Market',  class: 'bg-amber-500/15 text-amber-400 border-amber-500/25' } :
    null

  const kcseAchievable = capMatch?.reality_check.kcse_achievable ?? true

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-white font-bold text-xl flex items-center gap-2">
          <Target className="w-5 h-5 text-violet-400" />
          Reality Intelligence
        </h2>
        <p className="text-white/40 text-sm mt-1">What it actually takes — no sugarcoating.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* KCSE Minimum */}
        {kcse && (
          <div className={`rounded-2xl border p-5 space-y-3 ${
            kcseAchievable
              ? 'bg-green-500/8 border-green-500/20'
              : 'bg-amber-500/8 border-amber-500/20'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className={`w-4 h-4 ${kcseAchievable ? 'text-green-400' : 'text-amber-400'}`} />
                <span className={`text-sm font-bold ${kcseAchievable ? 'text-green-400' : 'text-amber-400'}`}>
                  KCSE Minimum
                </span>
              </div>
              <span className={`text-xl font-black ${kcseAchievable ? 'text-green-400' : 'text-amber-400'}`}>
                {kcse.overall_grade}
              </span>
            </div>

            {Object.keys(kcse.subject_grades ?? {}).length > 0 && (
              <div className="space-y-1">
                <div className="text-white/40 text-xs uppercase tracking-wide">Key subject grades</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(kcse.subject_grades).map(([subj, grade]) => (
                    <span key={subj} className="text-xs bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg text-white/60">
                      {subj.replace(/_/g, ' ')}: <strong className="text-white/80">{grade}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {!kcseAchievable && capMatch && (
              <div className="flex items-start gap-1.5 text-xs text-amber-400/80">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Your current analytical profile suggests KCSE for this career will need focused academic work.
              </div>
            )}

            {kcse.alternative_routes && kcse.alternative_routes.length > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-white/8">
                <div className="text-white/40 text-xs uppercase tracking-wide">Alternative routes</div>
                {kcse.alternative_routes.map(r => (
                  <div key={r} className="flex items-start gap-2 text-xs text-white/50">
                    <ChevronRight className="w-3 h-3 text-violet-400 shrink-0 mt-0.5" />
                    {r}
                  </div>
                ))}
              </div>
            )}

            {kcse.note && (
              <p className="text-white/30 text-xs italic pt-1 border-t border-white/8">{kcse.note}</p>
            )}
          </div>
        )}

        {/* Cost + time + risk */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
          {cost && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-bold text-white/80">Cost to Qualify</span>
              </div>
              <p className="text-white/70 font-semibold">
                KES {formatKES(cost.min)} – {formatKES(cost.max)}
              </p>
              {cost.note && <p className="text-white/40 text-xs leading-relaxed">{cost.note}</p>}
            </div>
          )}

          {time && (
            <div className="flex items-center gap-3">
              <Timer className="w-4 h-4 text-blue-400 shrink-0" />
              <div>
                <span className="text-sm font-bold text-white/80">{time} years</span>
                <span className="text-white/40 text-xs ml-1">to first stable income</span>
              </div>
            </div>
          )}

          {risk && (
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-white/40 shrink-0" />
              <div>
                <span className={`text-sm font-bold capitalize ${
                  risk === 'low' ? 'text-green-400' :
                  risk === 'high' || risk === 'variable' ? 'text-amber-400' : 'text-white/70'
                }`}>
                  {risk === 'low' ? 'Low risk' : risk === 'high' ? 'High risk' : risk === 'variable' ? 'Variable income' : 'Medium risk'}
                </span>
                <span className="text-white/30 text-xs ml-1">career path</span>
              </div>
            </div>
          )}

          {diff && (
            <div className="flex items-center gap-3">
              <BarChart className="w-4 h-4 text-white/40 shrink-0" />
              <div>
                <span className={`text-sm font-bold capitalize ${
                  diff === 'accessible' ? 'text-green-400' :
                  diff === 'very_hard' ? 'text-red-400' :
                  'text-white/70'
                }`}>
                  {diff === 'very_hard' ? 'Very hard to enter' :
                   diff === 'hard' ? 'Hard to enter' :
                   diff === 'moderate' ? 'Moderate difficulty' :
                   'Accessible'}
                </span>
              </div>
            </div>
          )}

          {demandBadge && (
            <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${demandBadge.class}`}>
              <Flame className="w-3.5 h-3.5" />
              {demandBadge.label}
            </div>
          )}

          {career.saturation_note && (
            <p className="text-white/35 text-xs italic border-t border-white/8 pt-3">{career.saturation_note}</p>
          )}
        </div>
      </div>
    </section>
  )
}

// ── Social Reality section ────────────────────────────────────────────────────

function SocialRealitySection({ sr }: { sr: SocialReality }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-white font-bold text-xl flex items-center gap-2">
          <Users className="w-5 h-5 text-violet-400" />
          The Honest Reality
        </h2>
        <p className="text-white/40 text-sm mt-1">What people get wrong about this career — and what's actually true.</p>
      </div>

      {/* Misconception vs Reality */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-red-500/8 border border-red-500/20 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-red-400 text-xs font-bold uppercase tracking-wide">Common Misconception</span>
          </div>
          <p className="text-white/60 text-sm leading-relaxed italic">&ldquo;{sr.common_misconception}&rdquo;</p>
        </div>

        <div className="bg-green-500/8 border border-green-500/20 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-green-400 text-xs font-bold uppercase tracking-wide">Honest Reality</span>
          </div>
          <p className="text-white/70 text-sm leading-relaxed">{sr.honest_reality_check}</p>
        </div>
      </div>

      {/* Parent frame */}
      {sr.parent_frame && (
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="text-amber-400 text-xs font-bold uppercase tracking-wide">For Parents</span>
          </div>
          <p className="text-amber-200/80 text-sm leading-relaxed font-medium">{sr.parent_frame.opening}</p>

          {sr.parent_frame.key_points.length > 0 && (
            <div className="space-y-2">
              <div className="text-amber-400/60 text-xs uppercase tracking-wide">Key points</div>
              {sr.parent_frame.key_points.map((pt, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-white/60">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  {pt}
                </div>
              ))}
            </div>
          )}

          {sr.parent_frame.honest_challenges.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-amber-500/15">
              <div className="text-amber-400/60 text-xs uppercase tracking-wide">Honest challenges to prepare for</div>
              {sr.parent_frame.honest_challenges.map((ch, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-white/50">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400/60 shrink-0 mt-0.5" />
                  {ch}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ── Door card ─────────────────────────────────────────────────────────────────

function DoorCard({ door }: { door: CareerDoor }) {
  const cfg  = DOOR_CONFIG[door.type]
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

      {door.type === 'employment' && (
        <div className="space-y-2">
          {door.salary_tiers && (
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-white/50 text-xs">
                Entry: KES {formatKES(door.salary_tiers.entry.min)}–{formatKES(door.salary_tiers.entry.max)} →
                Senior: KES {formatKES(door.salary_tiers.senior.min)}–{formatKES(door.salary_tiers.senior.max)}/mo
              </span>
            </div>
          )}
          {door.time_to_first_job && (
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-white/50 text-xs">{door.time_to_first_job}</span>
            </div>
          )}
          {door.employers && door.employers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {door.employers.slice(0, 4).map(e => (
                <span key={e} className="text-xs bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg text-white/50">{e}</span>
              ))}
              {door.employers.length > 4 && <span className="text-xs text-white/30">+{door.employers.length - 4} more</span>}
            </div>
          )}
        </div>
      )}

      {door.type === 'self_employment' && (
        <div className="space-y-2">
          {door.startup_cost_kes && (
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-green-400 shrink-0" />
              <span className="text-white/70">Start from KES {formatKES(door.startup_cost_kes.min)}</span>
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
            <div className="flex items-start gap-2">
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
          {door.earnings_note && <p className="text-amber-400/60 text-xs italic pt-1">{door.earnings_note}</p>}
        </div>
      )}

      {door.type === 'ai_era' && (
        <div className="space-y-2">
          {door.ai_opportunity && <p className="text-violet-300/80 text-xs leading-relaxed">{door.ai_opportunity}</p>}
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

// ── Life Simulation Section ───────────────────────────────────────────────────

const PHASE_COLOR: Record<string, string> = {
  studying: 'text-amber-400',
  entry:    'text-blue-400',
  mid:      'text-violet-400',
  senior:   'text-green-400',
}
const PHASE_BG: Record<string, string> = {
  studying: 'bg-amber-500/15 border-amber-500/25',
  entry:    'bg-blue-500/15 border-blue-500/25',
  mid:      'bg-violet-500/15 border-violet-500/25',
  senior:   'bg-green-500/15 border-green-500/25',
}
const PHASE_FILL: Record<string, string> = {
  studying: '#f59e0b',
  entry:    '#60a5fa',
  mid:      '#a78bfa',
  senior:   '#34d399',
}

function LifeSimulationSection({ sim }: { sim: LifeSimulation }) {
  const W = 360
  const H = 120
  const PAD_L = 40
  const PAD_R = 12
  const PAD_T = 12
  const PAD_B = 28
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B

  const years       = sim.simulation
  const minCumul    = Math.min(0, ...years.map(y => y.cumulative_net_kes))
  const maxCumul    = Math.max(0, ...years.map(y => y.cumulative_net_kes))
  const range       = maxCumul - minCumul || 1
  const totalYears  = years.length - 1

  const toX = (idx: number) => PAD_L + (idx / totalYears) * innerW
  const toY = (val: number) => PAD_T + innerH - ((val - minCumul) / range) * innerH

  const zeroY   = toY(0)
  const pathD   = years.map((y, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(y.cumulative_net_kes).toFixed(1)}`).join(' ')

  const breakX = sim.breakeven_age
    ? toX(sim.breakeven_age - 18)
    : null

  // Y-axis labels
  const yLabels: { val: number; y: number }[] = [
    { val: maxCumul, y: PAD_T + 4 },
    { val: 0,        y: zeroY },
  ]
  if (minCumul < 0) yLabels.push({ val: minCumul, y: PAD_T + innerH })

  return (
    <section className="bg-gradient-to-br from-indigo-900/20 to-blue-900/20 border border-indigo-500/20 rounded-2xl p-6 space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-5 h-5 text-indigo-400" />
          <h2 className="text-white font-bold text-lg">Your Financial Journey: Age 18–35</h2>
        </div>
        <p className="text-white/40 text-xs">Estimated cumulative earnings vs education cost over time</p>
      </div>

      {/* Key stat chips */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
          <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs text-white/60">Income starts at age <span className="text-white font-bold">{sim.income_start_age}</span></span>
        </div>
        {sim.breakeven_age && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
            <Target className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs text-white/60">Breakeven at age <span className="text-green-400 font-bold">{sim.breakeven_age}</span></span>
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
          <DollarSign className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-xs text-white/60">Peak: <span className="text-white font-bold">KES {formatKES(sim.peak_monthly_kes)}/mo</span></span>
        </div>
      </div>

      {/* Cumulative chart */}
      <div className="overflow-x-auto">
        <svg width={W} height={H} className="shrink-0">
          {/* Zero baseline */}
          <line x1={PAD_L} y1={zeroY} x2={W - PAD_R} y2={zeroY} stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="4,3" />

          {/* Area fill — positive zone */}
          {years.length > 0 && (() => {
            const posYears = years.filter(y => y.cumulative_net_kes > 0)
            if (posYears.length === 0) return null
            const firstPos = years.findIndex(y => y.cumulative_net_kes > 0)
            const sliceP   = years.slice(firstPos)
            const areaD    = `M${toX(firstPos).toFixed(1)},${zeroY} ` +
              sliceP.map((y, i) => `L${toX(firstPos + i).toFixed(1)},${toY(y.cumulative_net_kes).toFixed(1)}`).join(' ') +
              ` L${toX(years.length - 1).toFixed(1)},${zeroY} Z`
            return <path d={areaD} fill="rgba(52,211,153,0.10)" />
          })()}

          {/* Negative area */}
          {minCumul < 0 && (() => {
            const lastNeg = years.reduce((acc, y, i) => y.cumulative_net_kes < 0 ? i : acc, -1)
            if (lastNeg < 0) return null
            const sliceN = years.slice(0, lastNeg + 1)
            const areaN  = `M${toX(0).toFixed(1)},${zeroY} ` +
              sliceN.map((y, i) => `L${toX(i).toFixed(1)},${toY(y.cumulative_net_kes).toFixed(1)}`).join(' ') +
              ` L${toX(lastNeg).toFixed(1)},${zeroY} Z`
            return <path d={areaN} fill="rgba(251,146,60,0.08)" />
          })()}

          {/* Coloured line segments by phase */}
          {years.slice(0, -1).map((y, i) => (
            <line
              key={i}
              x1={toX(i).toFixed(1)}   y1={toY(y.cumulative_net_kes).toFixed(1)}
              x2={toX(i + 1).toFixed(1)} y2={toY(years[i + 1].cumulative_net_kes).toFixed(1)}
              stroke={PHASE_FILL[y.phase] ?? '#94a3b8'}
              strokeWidth="2"
              strokeLinecap="round"
            />
          ))}

          {/* Breakeven marker */}
          {breakX !== null && (
            <>
              <line x1={breakX.toFixed(1)} y1={PAD_T} x2={breakX.toFixed(1)} y2={H - PAD_B} stroke="#34d399" strokeWidth="1.5" strokeDasharray="3,2" />
              <circle cx={breakX.toFixed(1)} cy={zeroY.toFixed(1)} r="4" fill="#34d399" />
            </>
          )}

          {/* Milestone dots */}
          {years.filter(y => y.milestone).map(y => {
            const idx = years.indexOf(y)
            return (
              <circle key={y.age} cx={toX(idx).toFixed(1)} cy={toY(y.cumulative_net_kes).toFixed(1)} r="3.5" fill={PHASE_FILL[y.phase]} stroke="#0a0a14" strokeWidth="1.5" />
            )
          })}

          {/* Y-axis labels */}
          {yLabels.map(({ val, y }) => (
            <text key={val} x={PAD_L - 4} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="9">
              {val >= 1_000_000 ? `${(val / 1_000_000).toFixed(1)}M` : val >= 1_000 ? `${Math.round(val / 1_000)}k` : val}
            </text>
          ))}

          {/* X-axis age labels */}
          {[18, 22, 26, 30, 35].map(age => {
            const idx = age - 18
            return (
              <text key={age} x={toX(idx).toFixed(1)} y={H - 6} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="9">
                {age}
              </text>
            )
          })}
        </svg>
      </div>

      {/* Phase legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {(['studying', 'entry', 'mid', 'senior'] as const).map(ph => (
          <span key={ph} className={`px-2.5 py-1 rounded-full border font-medium capitalize ${PHASE_BG[ph]} ${PHASE_COLOR[ph]}`}>
            {ph === 'studying' ? 'Training / Study' : ph === 'entry' ? 'Entry Level' : ph === 'mid' ? 'Mid Career' : 'Senior Level'}
          </span>
        ))}
      </div>

      {/* Salary progression */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Entry',  val: sim.entry_monthly_kes,  color: 'text-blue-400'   },
          { label: 'Mid',    val: sim.mid_monthly_kes,    color: 'text-violet-400' },
          { label: 'Senior', val: sim.senior_monthly_kes, color: 'text-green-400'  },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <div className={`text-base font-black ${color}`}>KES {formatKES(val)}</div>
            <div className="text-white/40 text-xs mt-0.5">{label} / mo</div>
          </div>
        ))}
      </div>

      {/* Education cost note */}
      <div className="flex items-start gap-2 text-xs text-white/40">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Estimated education cost: <span className="text-white/60 font-semibold">KES {formatKES(sim.total_education_cost_kes)}</span>.
          {' '}Projections use average salary midpoints from current Kenya market data. Actual results depend on employer, location, and performance.
        </span>
      </div>
    </section>
  )
}

// Needed for RealityCheckSection — import after component definition avoids issues
function BarChart({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CareerDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  // Where the learner clicked from — analytics only (Phase 9.1 §8), forwarded
  // to the API so it can attribute the resulting career_result_opened event.
  const source = useSearchParams().get('source')

  const [career,          setCareer]          = useState<Career | null>(null)
  const [capabilityMatch, setCapabilityMatch] = useState<CapabilityCareerMatch | null>(null)
  const [loading,         setLoading]         = useState(true)
  const [saving,          setSaving]          = useState(false)
  const [saved,           setSaved]           = useState(false)
  const [studentId,       setStudentId]       = useState<string | null>(null)
  const [studentAge,      setStudentAge]      = useState<number>(15)
  const [studentGrade,    setStudentGrade]    = useState<number | null>(null)
  const [activeTimelineIdx, setActiveTimelineIdx] = useState(0)
  const [earlyStartTab,   setEarlyStartTab]   = useState<'14-16' | '16-18'>('14-16')

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
          if (s.grade) setStudentGrade(s.grade as number)
        }
      })
      .catch(() => null)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    if (studentId) params.set('studentId', studentId)
    if (source)    params.set('source', source)
    const qs = params.toString() ? `?${params.toString()}` : ''
    fetch(`/api/career/${slug}${qs}`)
      .then(r => r.json())
      .then(d => {
        setCareer(d?.data?.career ?? null)
        setCapabilityMatch(d?.data?.capability_match ?? null)
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [slug, studentId, source])

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
      <Link href="/student/career" className="text-violet-400 text-sm hover:text-violet-300">← Back to careers</Link>
    </div>
  )

  const currentTimeline = career.skill_timeline[activeTimelineIdx]
  const aiImpact        = career.ai_impact
  const sovereignty     = career.doors?.find(d => d.type === 'ai_era')?.ai_sovereignty
  const socialReality   = career.social_reality as SocialReality | null | undefined
  const lifeSim         = buildLifeSimulation(career)
  const isJunior        = studentGrade !== null && studentGrade >= 7  && studentGrade <= 9
  const isSenior        = studentGrade !== null && studentGrade >= 10 && studentGrade <= 12

  return (
    <div className="min-h-screen bg-[#0a0a14]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── NAV ────────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <Link href="/student/career" className="flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors">
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
            {career.kenya_demand === 'critical_shortage' && (
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-green-500/15 border border-green-500/25 text-green-400 flex items-center gap-1">
                <Flame className="w-3 h-3" /> High Demand
              </span>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">{career.title}</h1>
          <p className="text-white/60 text-base leading-relaxed">{career.description}</p>

          {career.salary_range_kes && (
            <div className="mt-5 space-y-3">
              <div className="text-xs text-white/40 uppercase tracking-wide font-semibold">Salary Journey</div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { tier: career.salary_range_kes.entry,  accent: 'bg-white/5 border-white/10',            textColor: 'text-white' },
                  { tier: career.salary_range_kes.mid,    accent: 'bg-blue-500/10 border-blue-500/20',     textColor: 'text-blue-300' },
                  { tier: career.salary_range_kes.senior, accent: 'bg-violet-500/10 border-violet-500/20', textColor: 'text-violet-300' },
                ] as Array<{ tier: typeof career.salary_range_kes.entry; accent: string; textColor: string }>).map(({ tier, accent, textColor }) => (
                  <div key={tier.label} className={`${accent} border rounded-xl px-3 py-3 text-center`}>
                    <div className="text-xs text-white/30 mb-1 leading-tight">{tier.label}</div>
                    <div className={`font-black text-sm ${textColor}`}>
                      KES {formatKES(tier.min)}–{formatKES(tier.max)}
                    </div>
                    <div className="text-white/25 text-xs mt-0.5">/month</div>
                  </div>
                ))}
              </div>
              {career.salary_range_kes.note && (
                <p className="text-white/40 text-xs">{career.salary_range_kes.note}</p>
              )}
              {career.salary_range_kes.kenya_context && (
                <p className="text-white/30 text-xs italic">{career.salary_range_kes.kenya_context}</p>
              )}
              {career.salary_range_kes.salary_growth_note && (
                <p className="text-green-400/50 text-xs">{career.salary_range_kes.salary_growth_note}</p>
              )}
              <p className="text-white/20 text-xs">Source: Zaajira, MaxisHR, BrighterMonday Kenya 2026. Updated quarterly.</p>
            </div>
          )}
        </div>

        {/* ── CAPABILITY ALIGNMENT ─────────────────────────────────────────── */}
        {capabilityMatch && <CapabilityAlignmentSection match={capabilityMatch} />}

        {/* ── REALITY INTELLIGENCE ─────────────────────────────────────────── */}
        <RealityCheckSection career={career} capMatch={capabilityMatch} />

        {/* ── LIFE SIMULATION ──────────────────────────────────────────────── */}
        {lifeSim && <LifeSimulationSection sim={lifeSim} />}

        {/* ── SOCIAL REALITY ───────────────────────────────────────────────── */}
        {socialReality && <SocialRealitySection sr={socialReality} />}

        {/* ══ THE 4 DOORS ═════════════════════════════════════════════════════ */}
        {career.doors && career.doors.length > 0 && (
          <section>
            <h2 className="text-white font-bold text-xl mb-2 flex items-center gap-2">
              <Zap className="w-5 h-5 text-violet-400" />
              The 4 Ways to Build This Career
            </h2>
            <p className="text-white/40 text-sm mb-5">
              Employment is just one door. There are three more.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {career.doors.map(door => <DoorCard key={door.type} door={door} />)}
            </div>
          </section>
        )}

        {/* ══ AI SOVEREIGNTY ══════════════════════════════════════════════════ */}
        {sovereignty && (
          <section className="space-y-5">
            <div>
              <h2 className="text-white font-bold text-xl mb-1 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-400" />
                What AI Lets You Do in This Field
              </h2>
              <p className="text-white/40 text-sm">Previously needed a team. Now possible solo.</p>
            </div>
            <div className="relative bg-violet-900/20 border border-violet-500/20 rounded-2xl p-6">
              <div className="text-violet-400/30 text-6xl font-serif leading-none select-none absolute top-4 left-5">&ldquo;</div>
              <p className="text-violet-200/90 text-base leading-relaxed font-medium pl-6 pt-2">{sovereignty.the_shift}</p>
            </div>
            <div>
              <div className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-3">What you can build</div>
              <div className="grid sm:grid-cols-2 gap-3">
                {sovereignty.what_you_can_build.map((item, i) => {
                  const icons = [Zap, Rocket, Target, Briefcase]
                  const Icon  = icons[i % icons.length]
                  return (
                    <div key={i} className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
                      <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-violet-400" />
                      </div>
                      <p className="text-white/70 text-sm leading-relaxed">{item}</p>
                    </div>
                  )
                })}
              </div>
            </div>
            {sovereignty.tools_to_learn.length > 0 && (
              <div>
                <div className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-2">Tools to learn</div>
                <div className="flex flex-wrap gap-2">
                  {sovereignty.tools_to_learn.map(tool => (
                    <span key={tool} className="text-xs bg-violet-500/10 border border-violet-500/20 px-3 py-1.5 rounded-full text-violet-300/80 font-medium">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="border-l-4 border-violet-500/60 bg-white/3 rounded-r-2xl pl-5 pr-5 py-5">
              <div className="text-violet-400 text-xs font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5" /> Real example
              </div>
              <p className="text-white/70 text-sm leading-relaxed italic">{sovereignty.sovereignty_example}</p>
            </div>
          </section>
        )}

        {/* ══ AI IMPACT ═══════════════════════════════════════════════════════ */}
        {aiImpact && (
          <section>
            <h2 className="text-white font-bold text-xl mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-400" />
              How AI Is Changing This Career
            </h2>
            <p className="text-white/40 text-sm mb-5">Honest — not fear, not hype.</p>
            <div className="grid sm:grid-cols-3 gap-4 mb-5">
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <h3 className="text-red-400 font-bold text-sm">AI Is Replacing</h3>
                </div>
                <ul className="space-y-2">
                  {aiImpact.replacing.map(task => (
                    <li key={task} className="flex items-start gap-2 text-xs text-white/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500/50 shrink-0 mt-1.5" />{task}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <h3 className="text-green-400 font-bold text-sm">AI Is Creating</h3>
                </div>
                <ul className="space-y-2">
                  {aiImpact.creating.map(opp => (
                    <li key={opp} className="flex items-start gap-2 text-xs text-white/60">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />{opp}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <h3 className="text-blue-400 font-bold text-sm">Human Advantage</h3>
                </div>
                <ul className="space-y-2">
                  {aiImpact.human_advantage.map(adv => (
                    <li key={adv} className="flex items-start gap-2 text-xs text-white/60">
                      <Star className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />{adv}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
              <p className="text-white/70 text-sm leading-relaxed">{aiImpact.honest_summary}</p>
              <p className="text-white/40 text-xs flex items-start gap-1.5">
                <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-white/30" />{aiImpact.timeline}
              </p>
            </div>
          </section>
        )}

        {/* ── CAREER SIGNALS ("What's changing in this field?") ─────────────── */}
        <CareerSignalsSection careerSlug={career.slug} />

        {/* ── SKILL TIMELINE ───────────────────────────────────────────────── */}
        <section>
          <h2 className="text-white font-bold text-xl mb-2 flex items-center gap-2">
            <Clock className="w-5 h-5 text-violet-400" /> Skill Age Timeline
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
                        <ChevronRight className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />{activity}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── REQUIRED SUBJECTS ────────────────────────────────────────────── */}
        {career.required_subjects.length > 0 && (
          <section>
            <h2 className="text-white font-bold text-xl mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-violet-400" /> Required Subjects
            </h2>
            <div className="flex flex-wrap gap-2">
              {career.required_subjects.map(subj => {
                const importance = career.subject_importance?.[subj] ?? 'helpful'
                const classes =
                  importance === 'critical' ? 'bg-violet-500/10 border-violet-500/20 text-violet-300' :
                  'bg-white/5 border-white/10 text-white/70'
                return (
                  <span key={subj} className={`px-3 py-1.5 rounded-xl text-sm font-medium border ${classes}`}>
                    {subj.replace(/_/g, ' ')}
                    {importance === 'critical' && <span className="ml-1 text-xs opacity-60">(critical)</span>}
                  </span>
                )
              })}
            </div>
          </section>
        )}

        {/* ── KENYA MARKET REALITY ─────────────────────────────────────────── */}
        {career.kenya_market_outlook && (
          <section className="bg-gradient-to-br from-green-900/20 to-teal-900/20 border border-green-500/20 rounded-2xl p-6">
            <h2 className="text-white font-bold text-xl mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-400" /> Kenya Market Reality
            </h2>
            <p className="text-white/70 text-sm leading-relaxed">{career.kenya_market_outlook}</p>
          </section>
        )}

        {/* ── KENYA EXAMPLES ───────────────────────────────────────────────── */}
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
                      {doorLabel && <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-lg shrink-0">{doorLabel}</span>}
                    </div>
                    <p className="text-white/60 text-sm mb-2">{example.what_they_did}</p>
                    <div className="flex items-center gap-2 text-xs text-violet-400/70">
                      <Briefcase className="w-3 h-3" /> Started from: {example.started_from}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── FUTURE SKILLS ────────────────────────────────────────────────── */}
        {career.future_skills && career.future_skills.length > 0 && (
          <section>
            <h2 className="text-white font-bold text-base mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" /> Skills That Matter More as AI Grows
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

        {/* ── EARLY START (JUNIOR) ─────────────────────────────────────────── */}
        {isJunior && career.early_start && (
          <section className="space-y-4">
            <div>
              <h2 className="text-white font-bold text-xl mb-1 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-amber-400" /> Start Now — Before Form 1
              </h2>
              <p className="text-white/40 text-sm">What you can do right now to get ahead.</p>
            </div>
            <div className="flex gap-2">
              {(['14-16', '16-18'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setEarlyStartTab(tab)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                    earlyStartTab === tab
                      ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                      : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/8'
                  }`}
                >
                  Age {tab}
                </button>
              ))}
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2.5">
              {(earlyStartTab === '14-16' ? career.early_start.age_14_16 : career.early_start.age_16_18).map((action, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-400 text-xs font-bold mt-0.5">
                    {i + 1}
                  </div>
                  <p className="text-white/70 text-sm leading-relaxed">{action}</p>
                </div>
              ))}
            </div>
            <div className="bg-gradient-to-br from-amber-900/20 to-orange-900/20 border border-amber-500/30 rounded-2xl p-5">
              <div className="text-amber-400 text-xs font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5" /> Your First Win Target
              </div>
              <p className="text-amber-300/90 text-sm leading-relaxed font-medium">{career.early_start.first_win}</p>
            </div>
          </section>
        )}

        {/* ── KCSE + UNIVERSITY (SENIOR) ───────────────────────────────────── */}
        {isSenior && (
          <section className="space-y-5">
            <div>
              <h2 className="text-white font-bold text-xl mb-1 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-400" /> KCSE & University Pathway
              </h2>
              <p className="text-white/40 text-sm">What you need to hit before the gate closes.</p>
            </div>
            {career.required_subjects.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-white/8">
                  <span className="text-white/60 text-xs font-semibold uppercase tracking-wide">Required KCSE Subjects</span>
                </div>
                <div className="divide-y divide-white/5">
                  {career.required_subjects.map(subj => {
                    const importance = career.subject_importance?.[subj] ?? 'helpful'
                    const badgeClass =
                      importance === 'critical' ? 'bg-violet-500/20 text-violet-300 border-violet-500/30' :
                      importance === 'important' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                      'bg-white/5 text-white/40 border-white/10'
                    return (
                      <div key={subj} className="flex items-center justify-between px-5 py-3">
                        <span className="text-white/80 text-sm capitalize">{subj.replace(/_/g, ' ')}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-lg border font-medium ${badgeClass}`}>{importance}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {career.university_courses && career.university_courses.length > 0 && (
              <div className="bg-indigo-900/20 border border-indigo-500/20 rounded-2xl p-5 space-y-3">
                <div className="text-indigo-300 text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" /> University Courses in Kenya
                </div>
                <ul className="space-y-2">
                  {career.university_courses.map(course => (
                    <li key={course} className="flex items-start gap-2 text-sm text-white/70">
                      <ChevronRight className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />{course}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* ── DISCLAIMER ───────────────────────────────────────────────────── */}
        <div className="bg-white/3 border border-white/8 rounded-xl p-4 flex items-start gap-2.5">
          <Info className="w-3.5 h-3.5 text-white/25 shrink-0 mt-0.5" />
          <p className="text-white/35 text-xs italic leading-relaxed">{career.disclaimer}</p>
        </div>

        {/* ── SAVE CTA ─────────────────────────────────────────────────────── */}
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
          <Link href="/student/career" className="block mt-4 text-white/30 text-sm hover:text-white/50 transition-colors">
            ← Back to all careers
          </Link>
        </div>

      </div>
    </div>
  )
}
