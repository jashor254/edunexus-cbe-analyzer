'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Search, Sparkles, TrendingUp, MapPin, ChevronRight, Star,
  Loader2, AlertCircle, Briefcase, Zap, RefreshCw, BookOpen,
  Target, ArrowRight, Clock
} from 'lucide-react'
import type { CareerSummary, CareerMatchWithDetail } from '@/lib/career/types'

// ── Helpers ─────────────────────────────────────────────────────────────────

const AI_IMPACT_BADGE: Record<string, { label: string; classes: string }> = {
  low:          { label: 'AI-Safe',       classes: 'bg-green-500/20 text-green-400 border-green-500/30' },
  medium:       { label: 'AI-Assisted',   classes: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  high:         { label: 'AI-Disrupted',  classes: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  transforming: { label: 'AI-Evolving',   classes: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
}

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

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 75 ? 'text-green-400' :
    score >= 55 ? 'text-amber-400' :
    'text-orange-400'
  return (
    <span className={`text-2xl font-black ${color}`}>{score}%</span>
  )
}

function CareerCard({ career, matchScore }: { career: CareerSummary; matchScore?: number }) {
  const badge = AI_IMPACT_BADGE[career.ai_impact.level] ?? AI_IMPACT_BADGE.medium
  const salaryMin = career.salary_range_kes?.entry
    ? `KES ${(career.salary_range_kes.entry.min / 1000).toFixed(0)}k`
    : null

  return (
    <Link
      href={`/career/${career.slug}`}
      className="group block bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 hover:border-violet-500/40 transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-white font-bold text-base leading-tight group-hover:text-violet-300 transition-colors">
          {career.title}
        </h3>
        {matchScore !== undefined && (
          <ScoreBadge score={matchScore} />
        )}
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

function MatchCard({ match }: { match: CareerMatchWithDetail }) {
  const badge = AI_IMPACT_BADGE[match.career.ai_impact.level] ?? AI_IMPACT_BADGE.medium
  return (
    <Link
      href={`/career/${match.career.slug}`}
      className="group block bg-gradient-to-br from-violet-900/30 to-indigo-900/30 border border-violet-500/30 rounded-2xl p-5 hover:border-violet-400/60 transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${badge.classes}`}>
          {badge.label}
        </span>
        <ScoreBadge score={match.match_score} />
      </div>
      <h3 className="text-white font-bold text-lg mb-1 group-hover:text-violet-300 transition-colors">
        {match.career.title}
      </h3>
      <p className="text-white/50 text-sm mb-3 line-clamp-2">{match.match_reasoning}</p>
      {match.subject_gaps && (match.subject_gaps as Array<{ subject: string; gap: number }>).length > 0 && (
        <div className="text-xs text-amber-400/80">
          Gap: {(match.subject_gaps as Array<{ subject: string }>).map(g => g.subject).join(', ')}
        </div>
      )}
      <div className="mt-3 flex items-center gap-1 text-violet-400 text-xs font-semibold group-hover:translate-x-1 transition-transform">
        Full deep-dive <ArrowRight className="w-3 h-3" />
      </div>
    </Link>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CareerPage() {
  const [careers, setCareers] = useState<CareerSummary[]>([])
  const [matches, setMatches] = useState<CareerMatchWithDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [matchLoading, setMatchLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [studentId, setStudentId] = useState<string | null>(null)
  const [seeded, setSeeded] = useState(false)

  // Load student profile to get studentId
  useEffect(() => {
    fetch('/api/students/list')
      .then(r => r.json())
      .then(d => {
        const students = d?.data?.students ?? []
        if (students.length > 0) setStudentId(students[0].id as string)
      })
      .catch(() => null)
  }, [])

  // Load careers
  const loadCareers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (category) params.set('category', category)

      const res = await fetch(`/api/career/search?${params}`)
      const data = await res.json()

      if (!res.ok) {
        // If no careers yet, offer to seed
        if (data?.data?.careers?.length === 0) {
          setSeeded(false)
        }
        setCareers(data?.data?.careers ?? [])
        return
      }

      const list: CareerSummary[] = data?.data?.careers ?? []
      setCareers(list)
      if (list.length > 0) setSeeded(true)
    } catch {
      setError('Could not load careers. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [query, category])

  useEffect(() => { loadCareers() }, [loadCareers])

  // Load AI matches
  useEffect(() => {
    if (!studentId) return
    fetch(`/api/career/match?studentId=${studentId}`)
      .then(r => r.json())
      .then(d => setMatches(d?.data?.matches ?? []))
      .catch(() => null)
  }, [studentId])

  const handleGenerateMatches = async () => {
    if (!studentId) return
    setMatchLoading(true)
    try {
      const res = await fetch('/api/career/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, force: true }),
      })
      const data = await res.json()
      setMatches(data?.data?.matches ?? [])
    } catch {
      // silent
    } finally {
      setMatchLoading(false)
    }
  }

  const handleSeed = async () => {
    setLoading(true)
    try {
      await fetch('/api/admin/career/seed', { method: 'POST' })
      await loadCareers()
    } catch {
      setError('Seed failed. Ask an admin to run it.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a14]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10">

        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <div className="text-center space-y-4 py-8">
          <div className="inline-flex items-center gap-2 bg-violet-500/20 border border-violet-500/30 rounded-full px-4 py-2 text-violet-300 text-sm font-semibold">
            <Sparkles className="w-4 h-4" />
            Career Reality Check
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight">
            What does the world of work<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">
              actually look like?
            </span>
          </h1>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            Not generic advice — real Kenya salaries, honest AI impact, age-based skill timelines,
            and career paths that actually exist in this country.
          </p>
        </div>

        {/* ── AI MATCH PANEL ───────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-xl flex items-center gap-2">
              <Target className="w-5 h-5 text-violet-400" />
              Your Top Career Matches
            </h2>
            {studentId && (
              <button
                onClick={handleGenerateMatches}
                disabled={matchLoading}
                className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 font-semibold disabled:opacity-50 transition-colors"
              >
                {matchLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                  : <><RefreshCw className="w-4 h-4" /> Refresh matches</>
                }
              </button>
            )}
          </div>

          {matches.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {matches.slice(0, 3).map(m => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
              {!studentId ? (
                <p className="text-white/40 text-sm">No student profile found. Add assessments to see career matches.</p>
              ) : (
                <div className="space-y-3">
                  <Briefcase className="w-10 h-10 text-white/20 mx-auto" />
                  <p className="text-white/50 text-sm">No matches yet.</p>
                  <button
                    onClick={handleGenerateMatches}
                    disabled={matchLoading}
                    className="mx-auto flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {matchLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysing your profile…</>
                      : <><Sparkles className="w-4 h-4" /> Generate My Matches</>
                    }
                  </button>
                  <p className="text-white/30 text-xs">Based on your subject scores and interests</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── SEARCH + FILTER ──────────────────────────────────────────────── */}
        <section>
          <h2 className="text-white font-bold text-xl mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-violet-400" />
            Explore All Careers
          </h2>

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

          {/* AI Impact Legend */}
          <div className="flex flex-wrap gap-2 mb-6">
            {Object.entries(AI_IMPACT_BADGE).map(([key, badge]) => (
              <span key={key} className={`text-xs font-medium px-2.5 py-1 rounded-full border ${badge.classes}`}>
                {badge.label}
              </span>
            ))}
            <span className="text-xs text-white/30 self-center ml-1">— AI impact on this career</span>
          </div>

          {/* Career Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
            </div>
          ) : error ? (
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
                    onClick={handleSeed}
                    className="mx-auto flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
                  >
                    <Zap className="w-4 h-4" /> Load Career Database
                  </button>
                </>
              ) : (
                <p className="text-white/50 text-sm">No careers match your search. Try different keywords.</p>
              )}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {careers.map(career => {
                const match = matches.find(m => m.career.slug === career.slug)
                return (
                  <CareerCard
                    key={career.id}
                    career={career}
                    matchScore={match?.match_score}
                  />
                )
              })}
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
    </div>
  )
}
