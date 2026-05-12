'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Target, Sparkles, Search, ArrowLeft, X, GraduationCap,
  TrendingUp, DollarSign, AlertCircle, ChevronRight,
  Globe, BookOpen, Loader2,
} from 'lucide-react'
import type { DynamicCareer } from '@/lib/academicClinic/dynamicCareerGenerator'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Student {
  id: string
  name: string
  grade: number
  curriculum_type: string | null
  year_level: number | null
}

interface Assessment {
  id: string
  subject_scores: Record<string, number> | null
  grade: number | null
  curriculum_type: string | null
  term: string | null
  year: number | null
}

interface CareerMatchResult {
  topMatches: Array<{
    career: { name: string; description: string; kenyanMarket?: any; cbcMapping?: any; aiForecast?: any }
    matchScore: number
    pathway: { criticalGaps: string[]; nextSteps: string[] }
    matchDimensions: { academicFit: number; futureProofing: number }
  }>
  curriculumType?: string
  isLocked?: boolean
}

interface Props {
  students: Student[]
  initialStudentId: string
  initialAssessment: Assessment | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PATHWAY_COLORS: Record<string, { bg: string; border: string; text: string; icon: string; label: string }> = {
  STEM:              { bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  text: 'text-amber-400',  icon: '🔬', label: 'STEM' },
  'Arts & Sports':   { bg: 'bg-green-500/10',  border: 'border-green-500/30',  text: 'text-green-400',  icon: '🎨', label: 'Arts & Sports' },
  'Social Sciences': { bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   text: 'text-blue-400',   icon: '📚', label: 'Social Sciences' },
}

function getPathwayFromScores(scores: Record<string, number> | null): { pathway: string; confidence: number } {
  if (!scores) return { pathway: 'STEM', confidence: 60 }

  const stemSubjects = ['mathematics', 'science', 'physics', 'chemistry', 'biology', 'computer_studies', 'core_mathematics']
  const artsSubjects = ['music_dance', 'fine_arts', 'theatre_film', 'sports_recreation', 'creative_arts']
  const socialSubjects = ['history_citizenship', 'business_studies', 'geography', 'social_studies', 'cre', 'ire']

  const avg = (keys: string[]) => {
    const vals = keys.map(k => scores[k]).filter(v => v !== undefined && v !== null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  }

  const stemAvg   = avg(stemSubjects)
  const artsAvg   = avg(artsSubjects)
  const socialAvg = avg(socialSubjects)
  const max = Math.max(stemAvg, artsAvg, socialAvg)

  if (max === stemAvg)   return { pathway: 'STEM',              confidence: Math.round(60 + (stemAvg / 4) * 30) }
  if (max === artsAvg)   return { pathway: 'Arts & Sports',     confidence: Math.round(60 + (artsAvg / 4) * 30) }
  return                        { pathway: 'Social Sciences',   confidence: Math.round(60 + (socialAvg / 4) * 30) }
}

function getMatchBarColor(score: number): string {
  if (score >= 85) return 'bg-green-500'
  if (score >= 70) return 'bg-amber-500'
  return 'bg-blue-500'
}

function getMatchLabel(score: number): string {
  if (score >= 90) return 'Excellent match'
  if (score >= 80) return 'Strong match'
  if (score >= 70) return 'Good potential'
  return 'Possible with work'
}

function isSeniorGrade(student: Student): boolean {
  const grade = student.grade ?? 0
  const year  = student.year_level ?? 0
  return grade >= 10 || year >= 10
}

// ─── Career Detail Modal ──────────────────────────────────────────────────────

function CareerModal({
  match,
  student,
  onClose,
}: {
  match: CareerMatchResult['topMatches'][0]
  student: Student
  onClose: () => void
}) {
  const { career, matchScore, pathway } = match
  const market = career.kenyanMarket || {}
  const ai = career.aiForecast || {}
  const cbc = career.cbcMapping || {}

  const compassUrl = `/chat?context=${encodeURIComponent(`I want to be a ${career.name}. Help me build the skills I need.`)}`
  const whatsappText = encodeURIComponent(`Check out this career match for ${student.name}: ${career.name} (${matchScore}% match) on EduNexus Kenya!`)

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-white/10 p-6 flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl font-black text-white">{matchScore}%</span>
              <span className="text-slate-400 text-sm">match</span>
            </div>
            <h2 className="text-xl font-black text-white">{career.name}</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition flex-shrink-0">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Description */}
          <p className="text-slate-300 leading-relaxed">{career.description}</p>

          {/* Salary */}
          {market.salaryRangeKES && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">💰 Salary Range (KES/month)</p>
              <div className="grid grid-cols-3 gap-3 text-center sm:grid-cols-3">
                {[
                  { label: 'Entry', val: market.salaryRangeKES.entry },
                  { label: 'Mid',   val: market.salaryRangeKES.mid   },
                  { label: 'Senior',val: market.salaryRangeKES.senior },
                ].map(s => (
                  <div key={s.label}>
                    <div className="text-green-400 font-black">{(s.val / 1000).toFixed(0)}K</div>
                    <div className="text-xs text-slate-400">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Universities */}
          {market.keyEmployers?.length > 0 && (
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">🏢 Key Employers</p>
              <div className="flex flex-wrap gap-2">
                {market.keyEmployers.map((e: string) => (
                  <span key={e} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-slate-300">{e}</span>
                ))}
              </div>
            </div>
          )}

          {/* CBC Pathway */}
          {cbc.seniorSchoolPathways?.length > 0 && (
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">🎓 Senior School Path</p>
              <div className="flex flex-wrap gap-2">
                {cbc.seniorSchoolPathways.map((p: string) => (
                  <span key={p} className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full text-xs font-bold">{p}</span>
                ))}
              </div>
            </div>
          )}

          {/* Gaps */}
          {pathway.criticalGaps.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
              <p className="text-xs font-black uppercase tracking-wider text-amber-400 mb-2">⚠️ Areas to Strengthen</p>
              <ul className="space-y-1">
                {pathway.criticalGaps.map((g, i) => (
                  <li key={i} className="text-sm text-amber-200 flex items-start gap-2">
                    <span className="mt-0.5 text-amber-400">•</span>{g}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* AI Risk */}
          {ai.automationRisk !== undefined && (
            <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-1">🤖 AI Disruption Risk</p>
                <p className="text-sm text-slate-300">
                  {ai.automationRisk < 30 ? 'Low — highly human-centric role' :
                   ai.automationRisk < 60 ? 'Moderate — some tasks automated' :
                   'High — significant AI exposure'}
                </p>
              </div>
              <div className={`text-2xl font-black ${ai.automationRisk < 30 ? 'text-green-400' : ai.automationRisk < 60 ? 'text-amber-400' : 'text-red-400'}`}>
                {ai.automationRisk}%
              </div>
            </div>
          )}

          {/* Market outlook */}
          {market.sectorGrowth && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-1">🇰🇪 Kenya Market Outlook</p>
              <p className="text-sm text-slate-300 capitalize">{market.sectorGrowth} sector · {market.saturationLevel?.replace('_', ' ')} market</p>
            </div>
          )}

          {/* CTAs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <Link
              href={compassUrl}
              className="flex items-center justify-center gap-2 bg-amber-500 text-slate-950 px-5 py-3 rounded-xl font-black hover:bg-amber-400 transition text-sm"
            >
              🧭 Start Learning Compass
            </Link>
            <a
              href={`https://wa.me/?text=${whatsappText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-green-600/20 border border-green-600/40 text-green-400 px-5 py-3 rounded-xl font-black hover:bg-green-600/30 transition text-sm"
            >
              📤 Share via WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Career Match Card ────────────────────────────────────────────────────────

function CareerMatchCard({
  match,
  onExplore,
  curriculumType,
}: {
  match: CareerMatchResult['topMatches'][0]
  onExplore: () => void
  curriculumType: string
}) {
  const { career, matchScore, pathway } = match
  const market = career.kenyanMarket || {}
  const salary = market.salaryRangeKES

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all group">
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className={`text-lg font-black ${getMatchBarColor(matchScore).replace('bg-', 'text-')}`}>
          {matchScore}%
        </span>
        {curriculumType === 'igcse' && (
          <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-full text-xs font-bold">🌍 IGCSE</span>
        )}
      </div>

      <h3 className="text-white font-black text-lg mb-2 leading-tight">{career.name}</h3>

      {/* Match bar */}
      <div className="mb-3">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full ${getMatchBarColor(matchScore)} rounded-full transition-all`}
            style={{ width: `${matchScore}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-1">{getMatchLabel(matchScore)}</p>
      </div>

      {/* Stats */}
      <div className="space-y-1.5 mb-4 text-sm">
        {salary && (
          <div className="flex items-center gap-2 text-slate-300">
            <DollarSign className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
            <span>KES {(salary.entry / 1000).toFixed(0)}K – {(salary.senior / 1000).toFixed(0)}K/mo</span>
          </div>
        )}
        {market.keyEmployers?.length > 0 && (
          <div className="flex items-center gap-2 text-slate-300">
            <GraduationCap className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
            <span className="truncate">{market.keyEmployers[0]}</span>
          </div>
        )}
        {market.sectorGrowth && (
          <div className="flex items-center gap-2 text-slate-300">
            <TrendingUp className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="capitalize">{market.sectorGrowth} in Kenya</span>
          </div>
        )}
        {career.aiForecast?.automationRisk !== undefined && (
          <div className="flex items-center gap-2 text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            <span>{career.aiForecast.automationRisk < 40 ? 'Low' : career.aiForecast.automationRisk < 65 ? 'Moderate' : 'High'} AI disruption risk</span>
          </div>
        )}
      </div>

      {/* Gaps */}
      {pathway.criticalGaps.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-amber-400 font-bold mb-1">Gap: {pathway.criticalGaps[0]}</p>
        </div>
      )}

      <button
        onClick={onExplore}
        className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/20 hover:bg-white/10 text-white rounded-xl px-4 py-2.5 text-sm font-black transition-all group-hover:border-amber-500/40"
      >
        Explore Career
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─── Main Client Component ────────────────────────────────────────────────────

export default function CareerExplorerClient({ students, initialStudentId, initialAssessment }: Props) {
  const [activeStudentId, setActiveStudentId] = useState(initialStudentId)
  const [assessment, setAssessment] = useState<Assessment | null>(initialAssessment)
  const [matches, setMatches] = useState<CareerMatchResult | null>(null)
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [matchError, setMatchError] = useState<string | null>(null)
  const [showCount, setShowCount] = useState(6)
  const [selectedMatch, setSelectedMatch] = useState<CareerMatchResult['topMatches'][0] | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState<any>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [switchingStudent, setSwitchingStudent] = useState(false)

  const activeStudent = students.find(s => s.id === activeStudentId) ?? students[0]
  const curriculumType = activeStudent?.curriculum_type || 'cbc'
  const isIGCSE = curriculumType === 'igcse'

  const isSenior = activeStudent ? isSeniorGrade(activeStudent) : false
  const { pathway, confidence } = getPathwayFromScores(assessment?.subject_scores ?? null)
  const pathwayConfig = PATHWAY_COLORS[pathway] ?? PATHWAY_COLORS['STEM']

  const handleStudentSwitch = useCallback(async (studentId: string) => {
    if (studentId === activeStudentId) return
    setSwitchingStudent(true)
    setActiveStudentId(studentId)
    setMatches(null)
    setMatchError(null)
    setSearchResult(null)

    try {
      const res = await fetch(`/api/students/${studentId}/latest-assessment`)
      if (res.ok) {
        const data = await res.json()
        setAssessment(data.assessment ?? null)
      } else {
        setAssessment(null)
      }
    } catch {
      setAssessment(null)
    } finally {
      setSwitchingStudent(false)
    }
  }, [activeStudentId])

  const handleGenerateMatches = useCallback(async () => {
    setLoadingMatches(true)
    setMatchError(null)
    try {
      const res = await fetch('/api/careers/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: activeStudentId, action: 'full-assessment' }),
      })
      if (!res.ok) throw new Error('Failed to generate matches')
      const data = await res.json()
      setMatches(data.data ?? data)
    } catch (err: any) {
      setMatchError(err.message || 'Failed to generate matches. Please try again.')
    } finally {
      setLoadingMatches(false)
    }
  }, [activeStudentId])

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    setSearchError(null)
    setSearchResult(null)
    try {
      const grade = activeStudent?.grade ?? ''
      const res = await fetch(`/api/careers/search?name=${encodeURIComponent(searchQuery.trim())}&grade=${grade}`)
      if (res.status === 429) { setSearchError('Too many searches. Wait a moment.'); return }
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      setSearchResult(data.data ?? data)
    } catch {
      setSearchError('Search failed. Please try again.')
    } finally {
      setSearchLoading(false)
    }
  }, [searchQuery, activeStudent])

  const topMatches = matches?.topMatches ?? []
  const visibleMatches = topMatches.slice(0, showCount)

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ── Header ── */}
      <div className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-slate-400 hover:text-white transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-black">Career Intelligence</h1>
                <p className="text-xs text-slate-400">
                  {activeStudent ? `Based on ${activeStudent.name}'s actual performance` : 'AI-powered matching'}
                </p>
              </div>
            </div>
            <div className="ml-auto flex gap-2">
              <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full text-xs font-bold">
                🤖 AI
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${isIGCSE ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400' : 'bg-green-500/10 border border-green-500/30 text-green-400'}`}>
                {isIGCSE ? '🌍 IGCSE' : '🇰🇪 CBC'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ── Student Selector ── */}
        {students.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {students.map(s => (
              <button
                key={s.id}
                onClick={() => handleStudentSwitch(s.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-black transition-all ${
                  s.id === activeStudentId
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        {switchingStudent ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          </div>
        ) : !assessment ? (
          /* ── No Assessment ── */
          <div className="text-center py-16 bg-white/5 border border-white/10 rounded-3xl">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="text-xl font-black mb-2">Add an assessment first</h3>
            <p className="text-slate-400 mb-6 max-w-sm mx-auto">
              Career Intelligence needs {activeStudent?.name}'s term results to generate matches.
            </p>
            <Link
              href="/dashboard/assessments/add"
              className="inline-flex items-center gap-2 bg-amber-500 text-slate-950 px-6 py-3 rounded-xl font-black hover:bg-amber-400 transition"
            >
              Add Assessment →
            </Link>
          </div>
        ) : !isSenior ? (
          /* ── Junior Student (Grade 7-9) ── */
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
              <h2 className="text-lg font-black mb-1">
                {activeStudent?.name} is in Grade {activeStudent?.grade ?? activeStudent?.year_level} — Junior School
              </h2>
              <p className="text-slate-400 text-sm mb-4">
                Career matching unlocks in Grade 10. Based on current performance:
              </p>

              {/* Pathway Preview */}
              <div className={`${pathwayConfig.bg} border ${pathwayConfig.border} rounded-2xl p-5 mb-4`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">{pathwayConfig.icon}</span>
                  <div>
                    <p className={`text-lg font-black ${pathwayConfig.text}`}>{pathway} Pathway</p>
                    <p className="text-sm text-slate-400">Confidence: {confidence}%</p>
                  </div>
                </div>
                <p className="text-slate-300 text-sm">
                  Based on {activeStudent?.name}'s strongest subjects. This suggests a natural fit for the {pathway} senior school pathway.
                </p>
              </div>

              <Link
                href={`/dashboard/assessments/guidance?student=${activeStudentId}`}
                className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white px-5 py-2.5 rounded-xl font-black hover:bg-white/20 transition text-sm"
              >
                <BookOpen className="w-4 h-4" />
                View Pathway Guide →
              </Link>
            </div>
          </div>
        ) : (
          /* ── Senior Student (Grade 10+) ── */
          <div className="space-y-6">

            {/* Section 1: Pathway Badge */}
            <div className={`${pathwayConfig.bg} border ${pathwayConfig.border} rounded-3xl p-6`}>
              <div className="flex items-start gap-4">
                <span className="text-4xl">{pathwayConfig.icon}</span>
                <div className="flex-1">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-1">Recommended Senior School Path</p>
                  <h2 className={`text-2xl font-black ${pathwayConfig.text}`}>{pathway} Pathway</h2>
                  <p className="text-slate-300 text-sm mt-1">
                    Based on {activeStudent?.name}'s strongest subjects · {confidence}% confidence
                  </p>
                </div>
                <div className={`text-2xl font-black ${pathwayConfig.text}`}>{confidence}%</div>
              </div>
            </div>

            {/* Section 2: Career Matches */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black">Your Top Career Matches</h2>
                {!matches && (
                  <button
                    onClick={handleGenerateMatches}
                    disabled={loadingMatches}
                    className="flex items-center gap-2 bg-amber-500 text-slate-950 px-5 py-2.5 rounded-xl font-black hover:bg-amber-400 transition disabled:opacity-50 text-sm"
                  >
                    {loadingMatches ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> Generate Matches</>
                    )}
                  </button>
                )}
              </div>

              {matchError && (
                <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-red-300 text-sm">{matchError}</p>
                </div>
              )}

              {loadingMatches && (
                <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center">
                  <Loader2 className="w-10 h-10 text-amber-400 animate-spin mx-auto mb-4" />
                  <p className="text-slate-300 font-black">Analysing {activeStudent?.name}'s profile...</p>
                  <p className="text-slate-500 text-sm mt-1">Matching against 200+ Kenyan careers</p>
                </div>
              )}

              {visibleMatches.length > 0 && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visibleMatches.map((m, i) => (
                      <CareerMatchCard
                        key={i}
                        match={m}
                        curriculumType={curriculumType}
                        onExplore={() => setSelectedMatch(m)}
                      />
                    ))}
                  </div>
                  {topMatches.length > showCount && (
                    <div className="text-center mt-4">
                      <button
                        onClick={() => setShowCount(c => c + 6)}
                        className="px-6 py-2.5 bg-white/5 border border-white/20 text-slate-300 rounded-xl hover:bg-white/10 transition font-bold text-sm"
                      >
                        Show more careers ↓
                      </button>
                    </div>
                  )}
                </>
              )}

              {!matches && !loadingMatches && (
                <div className="bg-white/5 border border-white/10 rounded-3xl p-10 text-center">
                  <div className="text-4xl mb-3">🎯</div>
                  <p className="text-slate-400">Click <strong className="text-white">Generate Matches</strong> to see AI-powered career recommendations based on {activeStudent?.name}'s performance.</p>
                </div>
              )}
            </div>

            {/* IGCSE: International Opportunities */}
            {isIGCSE && (
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-3xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Globe className="w-6 h-6 text-blue-400" />
                  <h3 className="text-lg font-black">🌍 International Opportunities</h3>
                </div>
                <p className="text-slate-300 text-sm mb-4">
                  {activeStudent?.name}'s IGCSE qualification is recognised in 160+ countries. Explore global pathways alongside Kenyan options.
                </p>
                <div className="grid sm:grid-cols-3 gap-3">
                  {[
                    { label: 'A-Levels', desc: 'UK sixth form curriculum — opens top global universities' },
                    { label: 'IB Diploma', desc: 'International Baccalaureate — rigorous & globally recognised' },
                    { label: 'Direct Entry', desc: 'Some universities accept IGCSE for foundation programmes' },
                  ].map(opt => (
                    <div key={opt.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <p className="font-black text-blue-300 mb-1">{opt.label}</p>
                      <p className="text-xs text-slate-400">{opt.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 3: Career Search */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Search className="w-5 h-5 text-slate-400" />
                <h3 className="text-lg font-black">Search any career</h3>
              </div>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Try: Blockchain Developer, Vet, Marine Engineer..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm"
                />
                <button
                  onClick={handleSearch}
                  disabled={searchLoading || !searchQuery.trim()}
                  className="px-5 py-2.5 bg-amber-500 text-slate-950 rounded-xl font-black hover:bg-amber-400 transition disabled:opacity-50 text-sm flex items-center gap-2"
                >
                  {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Search
                </button>
              </div>

              {searchError && (
                <div className="flex items-center gap-2 text-red-400 text-sm mb-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {searchError}
                </div>
              )}

              {searchResult?.career && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mt-2">
                  {searchResult.source === 'dynamic' && (
                    <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-3 text-xs text-amber-300">
                      <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                      AI-researched this career specifically for you.
                    </div>
                  )}
                  <h4 className="font-black text-white mb-1">{searchResult.career.name}</h4>
                  <p className="text-slate-300 text-sm mb-2">{searchResult.career.description}</p>
                  {searchResult.career.salary_range && (
                    <p className="text-green-400 text-sm font-bold">{searchResult.career.salary_range}</p>
                  )}
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* ── Career Detail Modal ── */}
      {selectedMatch && activeStudent && (
        <CareerModal
          match={selectedMatch}
          student={activeStudent}
          onClose={() => setSelectedMatch(null)}
        />
      )}
    </div>
  )
}
