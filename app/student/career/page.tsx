'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import JourneyLinks from '@/components/student/JourneyLinks'
import {
  Search, Sparkles, TrendingUp, ChevronRight, Star,
  Loader2, AlertCircle, Briefcase, Zap, RefreshCw, BookOpen,
  ArrowRight, Clock, Brain, TrendingDown, Minus, ArrowUpRight,
  Target, CheckCircle, AlertTriangle, ChevronDown, ChevronUp,
  DollarSign, Timer, BarChart3, Flame,
} from 'lucide-react'
import type {
  CareerSummary,
  CapabilityMatchReport,
  CapabilityCareerMatch,
  CapabilityProfile,
  CapabilityDimension,
  CapabilityGrowthReport,
} from '@/lib/career/types'
import type { ProvisionalCareerPreview as ProvisionalPreview } from '@/lib/career/provisionalPreview'
import type { CareerFamilyInsight } from '@/lib/learnerIntelligence/careerIntelligence'
import { CAPABILITY_LABELS } from '@/lib/career/capabilityExtractor'
import { alignmentToPercent, tierLabel, tierColor, demandLabel } from '@/lib/career/capabilityMatchEngine'

// Junior (Grade 7-9) response shape from /api/career/capability-matches —
// broad exploration families, never a ranked/percentage career prediction.
type CareerExplorationReport = {
  mode:             'exploration'
  families:         CareerFamilyInsight[]
  disclaimer:       string
  dominant_cluster: string[]
  assessment_count: number
}
type CareerMatchesResponse = (CapabilityMatchReport & { mode: 'planning' }) | CareerExplorationReport

// ── Constants ────────────────────────────────────────────────────────────────

const AI_IMPACT_BADGE: Record<string, { label: string; classes: string }> = {
  low:          { label: 'AI-Safe',      classes: 'bg-green-500/20 text-green-400 border-green-500/30' },
  medium:       { label: 'AI-Assisted',  classes: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  high:         { label: 'AI-Disrupted', classes: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  transforming: { label: 'AI-Evolving',  classes: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
}

const TIER_STYLES: Record<string, { border: string; badge: string; glow: string }> = {
  primary:        { border: 'border-green-500/40',  badge: 'bg-green-500/20 text-green-400',    glow: 'from-green-900/20 to-emerald-900/20' },
  stretch:        { border: 'border-blue-500/40',   badge: 'bg-blue-500/20 text-blue-400',      glow: 'from-blue-900/20 to-indigo-900/20' },
  alternative:    { border: 'border-amber-500/40',  badge: 'bg-amber-500/20 text-amber-400',    glow: 'from-amber-900/20 to-yellow-900/20' },
  entrepreneurial:{ border: 'border-purple-500/40', badge: 'bg-purple-500/20 text-purple-400',  glow: 'from-purple-900/20 to-violet-900/20' },
}

const LEVEL_COLORS: Record<string, string> = {
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

const PATHWAYS = [
  { value: '',                      label: 'All Pathways' },
  { value: 'STEM',                  label: 'STEM' },
  { value: 'Social Sciences',       label: 'Social Sciences' },
  { value: 'Arts & Sports Science', label: 'Arts & Sports Science' },
]

const CATEGORIES = [
  { value: '',            label: 'All Careers' },
  { value: 'technology',  label: 'Technology' },
  { value: 'health',      label: 'Health' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'trades',      label: 'Trades & Engineering' },
  { value: 'education',   label: 'Education' },
  { value: 'business',    label: 'Business' },
  { value: 'media',       label: 'Media & Content' },
  { value: 'environment', label: 'Environment' },
  { value: 'creative',    label: 'Creative' },
  { value: 'finance',     label: 'Finance' },
]

// ── Trend icon ───────────────────────────────────────────────────────────────

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'accelerating') return <ArrowUpRight className="w-3.5 h-3.5 text-green-400" />
  if (trend === 'growing')      return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
  if (trend === 'declining')    return <TrendingDown className="w-3.5 h-3.5 text-red-400" />
  return <Minus className="w-3.5 h-3.5 text-white/30" />
}

// ── Capability profile card ───────────────────────────────────────────────────

function CapabilityBar({
  dimension,
  score,
  level,
  trend,
  isDominant,
  confidence,
}: {
  dimension: CapabilityDimension
  score:     number
  level:     string
  trend:     string
  isDominant:boolean
  confidence:number
}) {
  const pct   = Math.round(score * 100)
  const color = LEVEL_COLORS[level] ?? 'bg-white/30'

  return (
    <div className={`space-y-1.5 ${confidence < 0.4 ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-semibold ${isDominant ? 'text-violet-300' : 'text-white/60'}`}>
          {CAPABILITY_LABELS[dimension]}
          {isDominant && <Star className="inline w-3 h-3 ml-1 text-violet-400 fill-violet-400" />}
        </span>
        <div className="flex items-center gap-1.5">
          <TrendIcon trend={trend} />
          <span className="text-xs text-white/40 capitalize">{level}</span>
          <span className="text-xs font-bold text-white/70 w-8 text-right">{pct}%</span>
        </div>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color} ${isDominant ? 'opacity-100' : 'opacity-70'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function CapabilityProfileCard({
  profile,
  dominant,
  assessmentCount,
  onRecompute,
  loading,
}: {
  profile:        CapabilityProfile
  dominant:       string[]
  assessmentCount:number
  onRecompute:    () => void
  loading:        boolean
}) {
  return (
    <div className="bg-white/5 border border-violet-500/20 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-violet-400" />
          <h3 className="text-white font-bold">Your Capability Profile</h3>
        </div>
        <button
          onClick={onRecompute}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 font-semibold disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Update
        </button>
      </div>

      <div className="space-y-3">
        {DIMENSION_ORDER.map(dim => {
          const s = profile[dim]
          return (
            <CapabilityBar
              key={dim}
              dimension={dim}
              score={s.raw_score}
              level={s.level}
              trend={s.trend}
              isDominant={dominant.includes(dim)}
              confidence={s.confidence}
            />
          )
        })}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <span className="text-xs text-white/30">Based on {assessmentCount} assessment{assessmentCount !== 1 ? 's' : ''}</span>
        {dominant.length > 0 && (
          <span className="text-xs text-violet-400/70">
            ★ Dominant: {dominant.map(d => CAPABILITY_LABELS[d as CapabilityDimension] ?? d).join(', ')}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Capability match card ─────────────────────────────────────────────────────

function CapabilityMatchCard({ match }: { match: CapabilityCareerMatch }) {
  const style   = TIER_STYLES[match.tier] ?? TIER_STYLES.alternative
  const pct     = alignmentToPercent(match.alignment_score)
  const topGap  = match.gaps.find(g => g.gap_severity === 'significant' || g.gap_severity === 'moderate')
  const rc      = match.reality_check

  return (
    <Link
      href={`/student/career/${match.career_slug}?source=career_match`}
      className={`group block bg-gradient-to-br ${style.glow} border ${style.border} rounded-2xl p-5 hover:opacity-90 transition-all space-y-3`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${style.badge}`}>
          {tierLabel(match.tier)}
        </span>
        <span className={`text-2xl font-black ${pct >= 75 ? 'text-green-400' : pct >= 55 ? 'text-blue-400' : 'text-amber-400'}`}>
          {pct}%
        </span>
      </div>

      <h3 className="text-white font-bold text-base leading-snug group-hover:text-violet-300 transition-colors">
        {match.career_title}
      </h3>

      <p className="text-white/50 text-xs leading-relaxed line-clamp-3">
        {match.narrative}
      </p>

      {/* Reality check chips */}
      <div className="flex flex-wrap gap-1.5">
        {rc.kenya_demand === 'critical_shortage' && (
          <span className="flex items-center gap-1 text-[11px] bg-green-500/15 text-green-400 rounded-full px-2 py-0.5">
            <Flame className="w-3 h-3" /> High Demand
          </span>
        )}
        {rc.kenya_demand === 'undersupplied' && (
          <span className="flex items-center gap-1 text-[11px] bg-emerald-500/15 text-emerald-400 rounded-full px-2 py-0.5">
            <TrendingUp className="w-3 h-3" /> Growing
          </span>
        )}
        {rc.kenya_demand === 'saturated' && (
          <span className="flex items-center gap-1 text-[11px] bg-amber-500/15 text-amber-400 rounded-full px-2 py-0.5">
            <AlertTriangle className="w-3 h-3" /> Competitive
          </span>
        )}
        <span className="flex items-center gap-1 text-[11px] bg-white/10 text-white/50 rounded-full px-2 py-0.5">
          <Timer className="w-3 h-3" /> {rc.time_to_income_years}yr to income
        </span>
        <span className={`flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 ${
          rc.cost_barrier === 'low' ? 'bg-green-500/10 text-green-400' :
          rc.cost_barrier === 'high' ? 'bg-red-500/10 text-red-400' :
          'bg-white/10 text-white/40'
        }`}>
          <DollarSign className="w-3 h-3" />
          {rc.cost_barrier === 'low' ? 'Low cost' : rc.cost_barrier === 'high' ? 'High cost' : 'Med cost'}
        </span>
        {!rc.kcse_achievable && (
          <span className="flex items-center gap-1 text-[11px] bg-orange-500/10 text-orange-400 rounded-full px-2 py-0.5">
            <AlertTriangle className="w-3 h-3" /> KCSE stretch
          </span>
        )}
      </div>

      {/* Top gap */}
      {topGap && (
        <div className={`text-xs rounded-lg px-3 py-2 ${
          topGap.gap_severity === 'significant' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
        }`}>
          Gap: {CAPABILITY_LABELS[topGap.dimension]} — {topGap.narrative}
        </div>
      )}

      {match.strengths.length > 0 && !topGap && (
        <div className="text-xs rounded-lg px-3 py-2 bg-green-500/10 text-green-400 flex items-start gap-2">
          <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {match.strengths[0].narrative}
        </div>
      )}

      <div className="flex items-center gap-1 text-violet-400 text-xs font-semibold group-hover:translate-x-1 transition-transform">
        Full deep-dive <ArrowRight className="w-3 h-3" />
      </div>
    </Link>
  )
}

// ── 4-tier match panel ────────────────────────────────────────────────────────

function CapabilityMatchPanel({
  report,
  onRefresh,
  loading,
}: {
  report:    CapabilityMatchReport
  onRefresh: () => void
  loading:   boolean
}) {
  const [showAlternative, setShowAlternative] = useState(false)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-xl flex items-center gap-2">
            <Target className="w-5 h-5 text-violet-400" />
            Your Career Matches
          </h2>
          <p className="text-white/40 text-xs mt-1">
            Matched from {report.total_careers_scored} careers · {report.assessment_count} assessment{report.assessment_count !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300 font-semibold disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </button>
      </div>

      {/* Primary matches */}
      {report.primary.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-green-400 text-sm font-bold flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Strong Matches
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {report.primary.map(m => <CapabilityMatchCard key={m.career_slug} match={m} />)}
          </div>
        </div>
      )}

      {/* Stretch matches */}
      {report.stretch.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-blue-400 text-sm font-bold flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Stretch Goals
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {report.stretch.slice(0, 3).map(m => <CapabilityMatchCard key={m.career_slug} match={m} />)}
          </div>
        </div>
      )}

      {/* Entrepreneurial tier */}
      {report.entrepreneurial.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-purple-400 text-sm font-bold flex items-center gap-2">
            <Zap className="w-4 h-4" /> Entrepreneurial Opportunity
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {report.entrepreneurial.map(m => <CapabilityMatchCard key={`e-${m.career_slug}`} match={m} />)}
          </div>
        </div>
      )}

      {/* Alternative — collapsed by default */}
      {report.alternative.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setShowAlternative(v => !v)}
            className="flex items-center gap-2 text-amber-400/70 text-sm font-semibold hover:text-amber-400 transition-colors"
          >
            {showAlternative ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showAlternative ? 'Hide' : 'Show'} Alternative Paths ({report.alternative.length})
          </button>
          {showAlternative && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {report.alternative.map(m => <CapabilityMatchCard key={m.career_slug} match={m} />)}
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-white/20 text-xs leading-relaxed border-t border-white/5 pt-4">
        {report.disclaimer}
      </p>
    </div>
  )
}

// ── Junior exploration panel (families, not predictions) ──────────────────────

function CareerFamilyCard({ family }: { family: CareerFamilyInsight }) {
  return (
    <div className="bg-white/5 border border-violet-500/20 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-white font-bold text-base">{family.categoryLabel}</h3>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300">
          {family.insight.confidence} confidence
        </span>
      </div>
      <p className="text-white/60 text-xs leading-relaxed">{family.insight.observation}</p>
      {family.insight.evidence.length > 0 && (
        <ul className="space-y-1">
          {family.insight.evidence.slice(0, 2).map((e, i) => (
            <li key={i} className="text-white/40 text-[11px] leading-relaxed flex items-start gap-1.5">
              <span className="text-violet-400 mt-0.5">•</span>{e}
            </li>
          ))}
        </ul>
      )}
      <p className="text-violet-300/80 text-xs leading-relaxed">{family.insight.action}</p>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {family.exampleCareerTitles.map(t => (
          <span key={t} className="text-[11px] bg-white/5 border border-white/10 text-white/50 rounded-full px-2 py-0.5">{t}</span>
        ))}
      </div>
    </div>
  )
}

function CareerExplorationPanel({ report }: { report: CareerExplorationReport }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white font-bold text-xl flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-400" />
          Fields Worth Exploring
        </h2>
        <p className="text-white/40 text-xs mt-1">
          You&apos;re exploring possibilities, not being predicted — these broaden as you take on more subjects, projects, and activities.
        </p>
      </div>
      {report.families.length === 0 ? (
        <p className="text-white/40 text-sm">Add more assessments to unlock exploration areas.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {report.families.map(f => <CareerFamilyCard key={f.category} family={f} />)}
        </div>
      )}
      <p className="text-white/20 text-xs leading-relaxed border-t border-white/5 pt-4">{report.disclaimer}</p>
    </div>
  )
}

// ── Explore career card ───────────────────────────────────────────────────────

function CareerCard({ career }: { career: CareerSummary }) {
  const badge    = AI_IMPACT_BADGE[career.ai_impact.level] ?? AI_IMPACT_BADGE.medium
  const salaryMin = career.salary_range_kes?.entry
    ? `KES ${(career.salary_range_kes.entry.min / 1000).toFixed(0)}k`
    : null

  return (
    <Link
      href={`/student/career/${career.slug}?source=explorer`}
      className="group block bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 hover:border-violet-500/40 transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-white font-bold text-base leading-tight group-hover:text-violet-300 transition-colors">
          {career.title}
        </h3>
      </div>
      <p className="text-white/50 text-sm mb-4 line-clamp-2">{career.description}</p>
      <div className="flex flex-wrap gap-2 items-center">
        <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${badge.classes}`}>
          {badge.label}
        </span>
        {salaryMin && (
          <span className="text-xs text-white/40 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            from {salaryMin}
          </span>
        )}
        <span className="ml-auto text-violet-400 text-xs font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
          Explore <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </Link>
  )
}

// ── Growth Banner ─────────────────────────────────────────────────────────────

function GrowthBanner({ growth }: { growth: CapabilityGrowthReport }) {
  if (!growth.previous_computed_at) return null

  const icon =
    growth.overall_direction === 'improved' ? <TrendingUp className="w-4 h-4 text-green-400" /> :
    growth.overall_direction === 'declined' ? <TrendingDown className="w-4 h-4 text-orange-400" /> :
    <Minus className="w-4 h-4 text-white/40" />

  const bg =
    growth.overall_direction === 'improved' ? 'bg-green-500/10 border-green-500/20' :
    growth.overall_direction === 'declined' ? 'bg-orange-500/10 border-orange-500/20' :
    'bg-white/5 border-white/10'

  const weeks = growth.weeks_tracked
  const since = weeks < 2 ? 'this week' : `${weeks}w ago`

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${bg}`}>
      {icon}
      <div className="min-w-0">
        <span className={`text-xs font-semibold ${
          growth.overall_direction === 'improved' ? 'text-green-400' :
          growth.overall_direction === 'declined' ? 'text-orange-400' :
          'text-white/50'
        }`}>
          Since {since}:
        </span>
        <span className="text-xs text-white/60 ml-1.5">{growth.highlight}</span>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CareerPage() {
  const [careers,         setCareers]         = useState<CareerSummary[]>([])
  // A career we do not have a verified profile for. The API returns an outline
  // with no salary figures, entry grades or course costs — see
  // lib/career/provisionalPreview.ts for why it is that narrow.
  const [provisional,     setProvisional]     = useState<ProvisionalPreview | null>(null)
  const [capabilityReport,setCapabilityReport] = useState<CareerMatchesResponse | null>(null)
  const [profile,         setProfile]         = useState<CapabilityProfile | null>(null)
  const [growth,          setGrowth]          = useState<CapabilityGrowthReport | null>(null)
  const [loading,         setLoading]         = useState(true)
  const [matchLoading,    setMatchLoading]    = useState(false)
  const [profileLoading,  setProfileLoading]  = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  const [query,           setQuery]           = useState('')
  const [category,        setCategory]        = useState('')
  const [pathway,         setPathway]         = useState('')
  const [studentId,       setStudentId]       = useState<string | null>(null)
  const [seeded,          setSeeded]          = useState(false)

  // Load student
  useEffect(() => {
    fetch('/api/students/list')
      .then(r => r.json())
      .then(d => {
        const students = d?.data?.students ?? []
        if (students.length > 0) {
          const s = students[0]
          setStudentId(s.id as string)
          if (s.current_pathway) setPathway(s.current_pathway as string)
        }
      })
      .catch(() => null)
  }, [])

  // Load capability profile + matches + growth when studentId is ready
  useEffect(() => {
    if (!studentId) return

    fetch(`/api/career/capability?studentId=${studentId}`)
      .then(r => r.json())
      .then(d => {
        const p = d?.data?.profile as CapabilityProfile | null
        setProfile(p)

        if (p) {
          // Load matches and growth in parallel
          return Promise.all([
            fetch(`/api/career/capability-matches?studentId=${studentId}`)
              .then(r => r.json())
              .then(d2 => setCapabilityReport(d2?.data ?? null)),
            fetch(`/api/career/growth?studentId=${studentId}`)
              .then(r => r.json())
              .then(d3 => setGrowth(d3?.data?.growth ?? null)),
          ])
        }
      })
      .catch(() => null)
  }, [studentId])

  // Compute profile + matches (fresh)
  const handleComputeMatches = async () => {
    if (!studentId) return
    setMatchLoading(true)
    try {
      const res  = await fetch('/api/career/capability-matches', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ studentId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? 'Could not compute matches. Make sure assessments have been added.')
        return
      }
      setCapabilityReport(data?.data ?? null)
      // Update stored profile reference from the recomputed report
      if (data?.data?.assessment_count) {
        const p = await fetch(`/api/career/capability?studentId=${studentId}`)
          .then(r => r.json())
          .then(d => d?.data?.profile as CapabilityProfile | null)
        setProfile(p)
      }
    } catch {
      setError('Could not compute matches. Please try again.')
    } finally {
      setMatchLoading(false)
    }
  }

  // Recompute profile only
  const handleRecomputeProfile = async () => {
    if (!studentId) return
    setProfileLoading(true)
    try {
      await fetch('/api/career/capability', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ studentId }),
      })
      const p = await fetch(`/api/career/capability?studentId=${studentId}`)
        .then(r => r.json())
        .then(d => d?.data?.profile as CapabilityProfile | null)
      setProfile(p)
      // Refresh matches too
      const report = await fetch(`/api/career/capability-matches?studentId=${studentId}`)
        .then(r => r.json())
        .then(d => d?.data as CareerMatchesResponse | null)
      setCapabilityReport(report)
    } catch {
      // silent
    } finally {
      setProfileLoading(false)
    }
  }

  // Load careers
  const loadCareers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (query)    params.set('q',        query)
      if (category) params.set('category', category)
      if (pathway)  params.set('pathway',  pathway)

      const res  = await fetch(`/api/career/search?${params}`)
      const data = await res.json()
      const list: CareerSummary[] = data?.data?.careers ?? []
      setCareers(list)
      setProvisional(data?.data?.provisional ? (data.data.preview as ProvisionalPreview) : null)
      setSeeded(list.length > 0)
    } catch {
      setError('Could not load careers. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [query, category, pathway])

  useEffect(() => { loadCareers() }, [loadCareers])

  // Search demand telemetry (Phase 9.1) — deliberately decoupled from the
  // fetch above so the real search stays exactly as responsive as it is
  // today (no UX change). This reports the already-fetched result once the
  // learner's query/filters have been stable for 600ms and a real response
  // has landed — never once per keystroke, never a second DB search, never a
  // trigger for unknown-career AI generation (it only reads `careers` state
  // the fetch above already produced).
  const lastTrackedKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (loading) return
    const timer = setTimeout(() => {
      const normalizedQuery = query.trim().toLowerCase().replace(/\s+/g, ' ')
      const isMeaningfulSearch = normalizedQuery.length > 0 || Boolean(category) || Boolean(pathway)
      if (!isMeaningfulSearch) return

      const key = `${normalizedQuery}|${category}|${pathway}`
      if (lastTrackedKeyRef.current === key) return
      lastTrackedKeyRef.current = key

      fetch('/api/career/search/track', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query, category, pathway,
          resultCount: careers.length,
        }),
      }).catch(() => { /* telemetry only — never surface to the learner */ })
    }, 600)
    return () => clearTimeout(timer)
  }, [query, category, pathway, careers, loading])

  return (
    <div className="min-h-screen bg-[#0a0a14]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10">

        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <div className="text-center space-y-4 py-8">
          <div className="inline-flex items-center gap-2 bg-violet-500/20 border border-violet-500/30 rounded-full px-4 py-2 text-violet-300 text-sm font-semibold">
            <Sparkles className="w-4 h-4" />
            Career Operating System
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight">
            What does the world of work<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">
              actually look like?
            </span>
          </h1>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            Not generic advice — matches built from your real capabilities, Kenya market data,
            honest AI impact, and career paths that actually exist in this country.
          </p>
        </div>

        {/* ── CAPABILITY PROFILE ───────────────────────────────────────────── */}
        {studentId && (
          <section className="space-y-6">
            {profile ? (
              <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start">
                {/* Profile bars + growth */}
                <div className="space-y-3">
                  <CapabilityProfileCard
                    profile={profile}
                    dominant={capabilityReport?.dominant_cluster ?? profile.dominant_cluster}
                    assessmentCount={capabilityReport?.assessment_count ?? profile.assessment_count}
                    onRecompute={handleRecomputeProfile}
                    loading={profileLoading}
                  />
                  {growth && <GrowthBanner growth={growth} />}
                </div>

                {/* Matches */}
                {capabilityReport?.mode === 'exploration' ? (
                  <CareerExplorationPanel report={capabilityReport} />
                ) : capabilityReport ? (
                  <CapabilityMatchPanel
                    report={capabilityReport}
                    onRefresh={handleComputeMatches}
                    loading={matchLoading}
                  />
                ) : (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                  </div>
                )}
              </div>
            ) : (
              /* No profile yet */
              <div className="bg-white/5 border border-violet-500/20 rounded-2xl p-8 text-center space-y-4">
                <Brain className="w-12 h-12 text-violet-400/40 mx-auto" />
                <div>
                  <h3 className="text-white font-bold text-lg mb-1">Build Your Capability Profile</h3>
                  <p className="text-white/50 text-sm max-w-md mx-auto">
                    We analyse your assessment results to map your 6 core capabilities — then match you
                    to careers based on what you can actually do, not just your subjects.
                  </p>
                </div>
                <button
                  onClick={handleComputeMatches}
                  disabled={matchLoading}
                  className="mx-auto flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold px-6 py-3 rounded-xl transition-colors disabled:opacity-50"
                >
                  {matchLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Building your profile…</>
                    : <><Sparkles className="w-4 h-4" /> Build My Capability Profile</>
                  }
                </button>
                {error && (
                  <div className="flex items-center gap-2 justify-center text-sm text-red-400">
                    <AlertCircle className="w-4 h-4" /> {error}
                  </div>
                )}
                <p className="text-white/25 text-xs">
                  Requires at least one assessment. Ask your teacher or parent to record one for you first.
                </p>
              </div>
            )}
          </section>
        )}

        {/* ── EXPLORE ALL CAREERS ──────────────────────────────────────────── */}
        <section>
          <h2 className="text-white font-bold text-xl mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-violet-400" />
            Explore All Careers
          </h2>

          <div className="flex flex-wrap gap-2 mb-4">
            {PATHWAYS.map(p => (
              <button
                key={p.value}
                onClick={() => setPathway(p.value)}
                className={`text-sm font-semibold px-4 py-2 rounded-xl border transition-colors ${
                  pathway === p.value
                    ? 'bg-violet-600 border-violet-500 text-white'
                    : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                placeholder="Search careers (e.g. doctor, engineer, journalist)…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
            >
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value} className="bg-[#0d0d1a]">{c.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {Object.entries(AI_IMPACT_BADGE).map(([key, badge]) => (
              <span key={key} className={`text-xs font-medium px-2.5 py-1 rounded-full border ${badge.classes}`}>
                {badge.label}
              </span>
            ))}
            <span className="text-xs text-white/30 self-center ml-1">— AI impact on this career</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
            </div>
          ) : error && careers.length === 0 ? (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl p-5 text-red-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          ) : careers.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center space-y-4">
              <BookOpen className="w-12 h-12 text-white/20 mx-auto" />
              {!seeded ? (
                <>
                  <p className="text-white/50 text-sm">Career database is empty.</p>
                  <button
                    onClick={loadCareers}
                    className="mx-auto flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
                  >
                    <Zap className="w-4 h-4" /> Load Career Database
                  </button>
                </>
              ) : provisional ? (
                <div className="text-left space-y-3">
                  <div>
                    <p className="text-white font-bold text-lg">{provisional.title}</p>
                    <p className="text-white/40 text-xs uppercase tracking-wide">{provisional.pathway} pathway</p>
                  </div>
                  <p className="text-white/70 text-sm">{provisional.description}</p>
                  {provisional.requiredSubjects.length > 0 && (
                    <p className="text-white/60 text-sm">
                      Subjects that matter most: {provisional.requiredSubjects.join(', ')}
                    </p>
                  )}
                  <div className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-300 mt-0.5" />
                    <p className="text-amber-100/90 text-xs leading-relaxed">{provisional.provisionalNotice}</p>
                  </div>
                </div>
              ) : (
                <p className="text-white/50 text-sm">No careers match your search. Try different keywords.</p>
              )}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {careers.map(career => (
                <CareerCard key={career.id} career={career} />
              ))}
            </div>
          )}
        </section>

        {/* ── SKILL AGE TIMELINE TEASER ────────────────────────────────────── */}
        <section className="bg-gradient-to-br from-violet-900/20 to-indigo-900/20 border border-violet-500/20 rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-6 h-6 text-violet-400" />
            <h2 className="text-white font-bold text-xl">The Skill Age Timeline</h2>
          </div>
          <p className="text-white/60 text-sm mb-6 max-w-2xl">
            Every career has a skill timeline by age: what to learn at 10–13, 14–16, 17–19, and 20–24.
            Click any career to see exactly where you are on the path and what comes next.
          </p>
          <div className="grid grid-cols-4 gap-2 max-w-xl">
            {['10–13', '14–16', '17–19', '20–24'].map((range, i) => (
              <div key={range} className="text-center">
                <div className={`h-2 rounded-full mb-2 ${i === 0 ? 'bg-violet-500' : 'bg-white/10'}`} />
                <span className="text-white/40 text-xs">{range}</span>
              </div>
            ))}
          </div>
          <p className="text-violet-400/60 text-xs mt-3">
            Select a career below to see your position on the timeline
          </p>
        </section>

      </div>
      <JourneyLinks current="career" theme="dark" />
    </div>
  )
}
