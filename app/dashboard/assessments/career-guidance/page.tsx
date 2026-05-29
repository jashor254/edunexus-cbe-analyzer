// app/dashboard/assessments/career-guidance/page.tsx
// For Senior School students (Grade 10-12)
// Shows honest career recommendations based on actual performance
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import {
  Brain, Compass, ArrowRight, Star, TrendingUp,
  AlertTriangle, CheckCircle2, Zap, Target,
  BookOpen, Award, ChevronDown, ChevronUp,
  Loader2, Sparkles, MessageCircle, Heart,
  GraduationCap, Clock, Shield
} from 'lucide-react'
import { analyzeCareerOptions, generateCareerIntegratedLearningPlan } from '@/lib/academicClinic/careerEngine'
import type { CareerRecommendation, CareerProfile } from '@/lib/academicClinic/careerEngine'
import IntegratedLearningPlanDisplay from '@/components/integratedlearningplan'
import { CareerAnalysisSkeleton } from '@/components/ui/skeletons'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SUBJECT_LABELS: Record<string, { label: string; emoji: string }> = {
  english:              { label: 'English',             emoji: '📚' },
  kiswahili_ksl:        { label: 'Kiswahili/KSL',       emoji: '🗣️' },
  community_service:    { label: 'Community Service',   emoji: '❤️' },
  core_mathematics:     { label: 'Core Mathematics',    emoji: '📐' },
  essential_mathematics:{ label: 'Essential Mathematics',emoji: '📊' },
  biology:              { label: 'Biology',             emoji: '🧬' },
  chemistry:            { label: 'Chemistry',           emoji: '⚗️' },
  physics:              { label: 'Physics',             emoji: '⚡' },
  computer_studies:     { label: 'Computer Studies',    emoji: '💻' },
  agriculture:          { label: 'Agriculture',         emoji: '🌱' },
  geography:            { label: 'Geography',           emoji: '🗺️' },
  history_citizenship:  { label: 'History & Citizenship',emoji: '📜' },
  business_studies:     { label: 'Business Studies',   emoji: '💼' },
  home_science:         { label: 'Home Science',        emoji: '🏠' },
  cre:                  { label: 'Christian RE',        emoji: '⛪' },
  ire:                  { label: 'Islamic RE',          emoji: '🕌' },
  fine_arts:            { label: 'Fine Arts',           emoji: '🎨' },
  music_dance:          { label: 'Music & Dance',       emoji: '🎵' },
  sports_recreation:    { label: 'Sports & Recreation', emoji: '⚽' },
  theatre_film:         { label: 'Theatre & Film',      emoji: '🎭' },
}

function getSubjectDisplay(key: string) {
  return SUBJECT_LABELS[key] || {
    label: key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    emoji: '📖'
  }
}

const LEVEL_CONFIG: Record<number, { bg: string; text: string; border: string; label: string; bar: string }> = {
  1: { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    label: 'Emerging',   bar: 'bg-red-500'    },
  2: { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  label: 'Developing', bar: 'bg-amber-500'  },
  3: { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  label: 'Proficient', bar: 'bg-green-500'  },
  4: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', label: 'Exemplary',  bar: 'bg-purple-500' },
}

const DEMAND_CONFIG: Record<string, { label: string; color: string }> = {
  very_high: { label: 'Very High Demand', color: 'text-green-700 bg-green-100'  },
  high:      { label: 'High Demand',      color: 'text-blue-700 bg-blue-100'    },
  moderate:  { label: 'Moderate Demand',  color: 'text-amber-700 bg-amber-100'  },
  low:       { label: 'Low Demand',       color: 'text-red-700 bg-red-100'      },
}

const EARNING_CONFIG: Record<string, { label: string; stars: number }> = {
  exceptional:        { label: 'Exceptional',        stars: 5 },
  very_lucrative:     { label: 'Very Lucrative',     stars: 4 },
  lucrative:          { label: 'Lucrative',          stars: 3 },
  moderate:           { label: 'Moderate',           stars: 2 },
  lower_but_stable:   { label: 'Stable',             stars: 1 },
}

const AI_RISK_CONFIG: Record<string, { label: string; color: string }> = {
  very_low: { label: 'Very Safe from AI', color: 'text-green-700 bg-green-100'  },
  low:      { label: 'Safe from AI',      color: 'text-blue-700 bg-blue-100'    },
  moderate: { label: 'Some AI Risk',      color: 'text-amber-700 bg-amber-100'  },
  high:     { label: 'High AI Risk',      color: 'text-orange-700 bg-orange-100'},
  very_high:{ label: 'Very High AI Risk', color: 'text-red-700 bg-red-100'      },
}

const KENYA_DISRUPTION_CONFIG: Record<string, { label: string; color: string }> = {
  protected:    { label: 'Protected — Safe 20+ years',   color: 'text-green-700 bg-green-100'   },
  resilient:    { label: 'Resilient — Safe 10-15 years', color: 'text-blue-700 bg-blue-100'     },
  evolving:     { label: 'Evolving — Adapt by 2030',     color: 'text-amber-700 bg-amber-100'   },
  vulnerable:   { label: 'Vulnerable — Specialize now',  color: 'text-orange-700 bg-orange-100' },
  transforming: { label: 'Transforming — Role changing', color: 'text-red-700 bg-red-100'       },
}

// ─── Career card ──────────────────────────────────────────────────────────────
function CareerCard({
  career,
  rank,
  studentId,
  studentName,
  isIGCSE = false,
}: {
  career: CareerRecommendation
  rank: number
  studentId: string
  studentName: string
  isIGCSE?: boolean
}) {
  const [expanded, setExpanded]         = useState(rank === 1)
  const [showPlan, setShowPlan]         = useState(false)
  const [plan, setPlan]                 = useState<any>(null)
  const [loadingPlan, setLoadingPlan]   = useState(false)
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)

  const demand  = DEMAND_CONFIG[career.industryDemand]  || DEMAND_CONFIG.moderate
  const earning = EARNING_CONFIG[career.earningPotential] || EARNING_CONFIG.moderate
  const aiRisk  = AI_RISK_CONFIG[career.aiDisruptionRisk] || AI_RISK_CONFIG.moderate

  const rankColors = [
    'from-amber-500 to-yellow-500',
    'from-slate-400 to-slate-500',
    'from-amber-700 to-amber-800',
    'from-blue-500 to-indigo-500',
    'from-purple-500 to-pink-500',
  ]

  const loadLearningPlan = async (subject: string) => {
    if (!subject) return
    setLoadingPlan(true)
    setSelectedSubject(subject)
    try {
      const generated = await generateCareerIntegratedLearningPlan(
        career.career,
        subject,
        2, // default current level
        3, // default target
        studentName
      )
      setPlan(generated)
      setShowPlan(true)
    } catch (err) {
      console.error('Plan error:', err)
      alert('Could not generate learning plan. Please try again.')
    } finally {
      setLoadingPlan(false)
    }
  }

  return (
    <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-sm overflow-hidden">

      {/* Card header */}
      <div
        className="p-6 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-4">
          {/* Rank badge */}
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${rankColors[rank - 1]} flex items-center justify-center flex-shrink-0 shadow-md`}>
            <span className="text-white font-black text-lg">{rank}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xl font-black text-slate-900">{career.career}</h3>
              <div className="flex items-center gap-1 flex-shrink-0">
                <div className="text-2xl font-black text-violet-700">{career.matchScore}%</div>
                <div className="text-xs text-slate-500 font-bold">match</div>
              </div>
            </div>

            {/* Match bar */}
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-700"
                style={{ width: `${career.matchScore}%` }}
              />
            </div>

            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{career.reasoning}</p>
          </div>

          {expanded
            ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0 mt-1" />
            : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0 mt-1" />
          }
        </div>

        {/* Quick badges */}
        <div className="flex flex-wrap gap-2 mt-4">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${demand.color}`}>
            📊 {demand.label}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${aiRisk.color}`}>
            🤖 {aiRisk.label}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {'⭐'.repeat(earning.stars)} {earning.label}
          </span>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t-2 border-slate-100 p-6 space-y-5">

          {/* Kenya market reality — the honest part */}
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
            <h4 className="font-black text-amber-900 text-sm mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Kenya Market Reality
            </h4>
            <p className="text-sm text-amber-800 leading-relaxed">
              {career.kenyanMarketReality}
            </p>
          </div>

          {/* IGCSE: global opportunities note */}
          {isIGCSE && (
            <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4">
              <h4 className="font-black text-indigo-900 text-sm mb-2 flex items-center gap-2">
                🌍 Global Opportunities (IGCSE Advantage)
              </h4>
              <p className="text-sm text-indigo-800 leading-relaxed">
                Your Cambridge IGCSE qualification is recognised by universities in 160+ countries. Strong grades open doors to UK, US, Canadian, and European institutions — not just Kenyan universities. Pair this career path with the right A-Level choices to maximise your options.
              </p>
            </div>
          )}

          {/* Gaps — honest */}
          {career.currentGaps.length > 0 && (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
              <h4 className="font-black text-red-900 text-sm mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Current Gaps to Address
              </h4>
              <ul className="space-y-1">
                {career.currentGaps.map((gap, i) => (
                  <li key={i} className="text-sm text-red-800 flex items-start gap-2">
                    <span className="mt-0.5">•</span>{gap}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Required subjects */}
          <div>
            <h4 className="font-black text-slate-900 text-sm mb-2 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" /> Required Subjects
            </h4>
            <div className="flex flex-wrap gap-2">
              {career.requiredSubjects.map((s, i) => (
                <span key={i} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">{s}</span>
              ))}
            </div>
          </div>

          {/* Career path */}
          <div>
            <h4 className="font-black text-slate-900 text-sm mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" /> Career Progression
            </h4>
            <div className="flex items-center gap-2 flex-wrap">
              {career.careerPath.map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="px-3 py-1.5 bg-gradient-to-r from-violet-100 to-indigo-100 text-violet-800 rounded-full text-xs font-bold">
                    {step}
                  </span>
                  {i < career.careerPath.length - 1 && (
                    <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Universities */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-black text-slate-900 text-sm mb-2 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-violet-600" /> Kenyan Universities
              </h4>
              <ul className="space-y-1">
                {career.kenyanUniversities.map((u, i) => (
                  <li key={i} className="text-sm text-slate-700 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-violet-500 rounded-full" />{u}
                  </li>
                ))}
              </ul>
            </div>
            {career.tvetOptions?.length > 0 && (
              <div>
                <h4 className="font-black text-slate-900 text-sm mb-2 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-600" /> TVET Options
                </h4>
                <ul className="space-y-1">
                  {career.tvetOptions.map((t, i) => (
                    <li key={i} className="text-sm text-slate-700 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />{t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Generate learning plan */}
          <div className="pt-2 border-t-2 border-slate-100">
            <h4 className="font-black text-slate-900 text-sm mb-3">
              📋 Generate Personalised Learning Plan
            </h4>
            <p className="text-xs text-slate-500 mb-3">
              Pick a subject you want to improve for this career:
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {career.requiredSubjects.slice(0, 4).map((subj, i) => (
                <button
                  key={i}
                  onClick={() => loadLearningPlan(subj)}
                  disabled={loadingPlan}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    selectedSubject === subj && showPlan
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-violet-100 hover:text-violet-700'
                  } disabled:opacity-50`}
                >
                  {loadingPlan && selectedSubject === subj
                    ? <><Loader2 className="w-3 h-3 inline animate-spin mr-1" />Generating...</>
                    : subj}
                </button>
              ))}
            </div>

            {showPlan && plan && (
              <div className="mt-4">
                <IntegratedLearningPlanDisplay plan={plan} />
              </div>
            )}
          </div>

          {/* Start learning */}
          <Link
            href="/dashboard/learning-compass"
            className="flex items-center justify-center gap-2 w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl font-black hover:scale-[1.02] transition-all shadow-lg"
          >
            <MessageCircle className="w-5 h-5" />
            Practice With Learning Compass — {career.career}
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── Main content ─────────────────────────────────────────────────────────────
function CareerGuidanceContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const supabase     = createClient()

  const studentId = searchParams.get('student')

  const [student,    setStudent]    = useState<any>(null)
  const [assessment, setAssessment] = useState<any>(null)
  const [careers,    setCareers]    = useState<CareerRecommendation[]>([])
  const [loading,    setLoading]    = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [activeTab,  setActiveTab]  = useState<'careers' | 'subjects'>('careers')

  const isIGCSE = student?.curriculum_type === 'igcse'

  useEffect(() => {
    if (!studentId) { router.push('/dashboard'); return }
    loadData()
  }, [studentId])

  const loadData = async () => {
    try {
      const { data: studentData } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single()

      const { data: assessments } = await supabase
        .from('assessments')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(1)

      setStudent(studentData)
      setAssessment(assessments?.[0] || null)

      if (studentData && assessments?.[0]?.subject_scores) {
        await generateCareers(studentData, assessments[0])
      }
    } catch (err) {
      console.error('Load error:', err)
      setError('Failed to load student data')
    } finally {
      setLoading(false)
    }
  }

  const generateCareers = async (studentData: any, assessmentData: any) => {
    setGenerating(true)
    setError(null)
    try {
      const scores  = assessmentData.subject_scores as Record<string, number>
      const values  = Object.values(scores)
      const avg     = values.reduce((a, b) => a + b, 0) / values.length

      // Build strengths and weaknesses from actual scores
      const strengths = Object.entries(scores)
        .filter(([, s]) => s >= 3)
        .map(([k]) => getSubjectDisplay(k).label)

      const weaknesses = Object.entries(scores)
        .filter(([, s]) => s <= 2)
        .map(([k]) => getSubjectDisplay(k).label)

      // Determine pathway confidence
      let pathwayConfidence: 'high' | 'medium' | 'low' = 'medium'
      if (avg >= 3.5) pathwayConfidence = 'high'
      else if (avg < 2.5) pathwayConfidence = 'low'

      const profile: CareerProfile = {
        studentName:       studentData.name,
        grade:             studentData.grade,
        pathway:           studentData.current_pathway || 'STEM',
        subjectScores:     scores,
        strengths,
        weaknesses,
        pathwayConfidence,
      }

      const recommendations = await analyzeCareerOptions(profile)
      setCareers(recommendations)

      // Save career context to DB so Compass can load it without recalculating
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user && recommendations.length > 0) {
          await supabase
            .from('student_learning_context')
            .upsert({
              student_id: studentData.id,
              user_id: user.id,
              top_careers: recommendations.slice(0, 3).map(c => ({
                career: c.career,
                matchScore: c.matchScore,
                gaps: c.currentGaps,
                requiredSubjects: c.requiredSubjects,
              })),
              career_gaps: recommendations[0]?.currentGaps ?? [],
              updated_at: new Date().toISOString(),
            }, { onConflict: 'student_id' })
        }
      } catch (contextErr) {
        // Non-fatal: Compass falls back to live analysis if this fails
        console.error('Failed to save career context:', contextErr)
      }
    } catch (err: any) {
      console.error('Career generation error:', err)
      setError('Could not generate career recommendations. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <CareerAnalysisSkeleton />
        </div>
      </div>
    )
  }

  if (!student || !assessment?.subject_scores) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border-4 border-amber-200 p-12 max-w-md text-center shadow-xl">
          <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black mb-2">No Assessment Found</h2>
          <p className="text-slate-600 mb-6">Add an assessment first to generate career guidance.</p>
          <Link
            href={`/dashboard/assessments/add?student=${studentId}`}
            className="inline-flex items-center gap-2 px-8 py-4 bg-violet-600 text-white rounded-full font-bold hover:scale-105 transition-all"
          >
            Add Assessment
          </Link>
        </div>
      </div>
    )
  }

  const scores     = assessment.subject_scores as Record<string, number>
  const firstName  = student.name.split(' ')[0]
  const avgScore   = (Object.values(scores).reduce((a: number, b) => a + (b as number), 0) / Object.values(scores).length).toFixed(1)
  const sortedSubjects = Object.entries(scores).sort(([, a], [, b]) => (a as number) - (b as number))
  const strengths  = sortedSubjects.filter(([, s]) => (s as number) >= 3)
  const struggles  = sortedSubjects.filter(([, s]) => (s as number) <= 2)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">

      {/* Header */}
      <div className="bg-white border-b-4 border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="font-bold text-slate-600 hover:text-violet-600 transition-colors">
            ← Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-600" />
            <span className="font-black text-sm">EDUNEXUS</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* Hero */}
        <div className="bg-gradient-to-br from-slate-900 to-indigo-900 rounded-3xl p-8 text-white shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-slate-300 font-bold text-sm mb-1">Career Guidance for</p>
              <h1 className="text-4xl font-black mb-1">{student.name}</h1>
              <p className="text-slate-300">
                Grade {student.grade} • {student.current_pathway} Pathway •
                Term {assessment.term} {assessment.year}
              </p>
              {isIGCSE && (
                <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 rounded-full text-xs font-bold">
                  🌍 Cambridge IGCSE Student
                </span>
              )}
            </div>
            <div className="text-center bg-white/10 rounded-2xl px-6 py-4 flex-shrink-0">
              <div className="text-4xl font-black">{avgScore}</div>
              <div className="text-xs text-slate-300 font-bold">Avg Score</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
            <div className="bg-white/10 rounded-2xl p-4 text-center">
              <div className="text-2xl font-black text-green-300">{strengths.length}</div>
              <div className="text-xs text-slate-300 font-bold">Strong Subjects</div>
            </div>
            <div className="bg-white/10 rounded-2xl p-4 text-center">
              <div className="text-2xl font-black text-amber-300">{struggles.length}</div>
              <div className="text-xs text-slate-300 font-bold">Need Work</div>
            </div>
            <div className="bg-white/10 rounded-2xl p-4 text-center">
              <div className="text-2xl font-black text-white">{careers.length}</div>
              <div className="text-xs text-slate-300 font-bold">Career Matches</div>
            </div>
          </div>

          {/* Honest note */}
          <div className="mt-5 bg-amber-500/20 border border-amber-400/30 rounded-2xl p-4">
            <p className="text-amber-200 text-sm font-bold flex items-start gap-2">
              <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
              These recommendations are based on {firstName}'s actual performance. We believe in honest guidance — not false hope. Every career shows the real gaps that need to be addressed.
            </p>
          </div>
        </div>

        {/* IGCSE Post-Pathway section */}
        {isIGCSE && (
          <div className="bg-gradient-to-br from-indigo-950 to-slate-900 rounded-3xl p-6 text-white border border-indigo-500/20">
            <h2 className="font-black text-lg mb-4 flex items-center gap-2">
              🎓 Post-IGCSE Pathways
            </h2>
            <p className="text-slate-300 text-sm mb-5">
              Your IGCSE results open these routes. Each leads to university — the path depends on your grades and goals.
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
                <div className="text-2xl mb-2">📘</div>
                <h3 className="font-black text-white text-sm mb-1">A-Levels</h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-3">
                  The classic route. 2 years, 3–4 subjects in depth. Required for most UK universities and strongly valued globally.
                </p>
                <div className="flex flex-wrap gap-1">
                  {['Sciences → Medicine', 'Maths → Engineering', 'Humanities → Law'].map(s => (
                    <span key={s} className="text-xs px-2 py-0.5 bg-indigo-500/30 text-indigo-200 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
              <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
                <div className="text-2xl mb-2">🌐</div>
                <h3 className="font-black text-white text-sm mb-1">IB Diploma</h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-3">
                  Internationally recognised. 6 subjects + Theory of Knowledge. Ideal for students targeting global top-50 universities.
                </p>
                <div className="flex flex-wrap gap-1">
                  {['US Ivy League', 'European unis', 'Canadian schools'].map(s => (
                    <span key={s} className="text-xs px-2 py-0.5 bg-violet-500/30 text-violet-200 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
              <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
                <div className="text-2xl mb-2">🏛️</div>
                <h3 className="font-black text-white text-sm mb-1">Direct Entry</h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-3">
                  Some universities accept strong IGCSE results directly. Foundation year programmes also bridge IGCSE to degree level.
                </p>
                <div className="flex flex-wrap gap-1">
                  {['Foundation year', 'Diploma programmes', 'Vocational routes'].map(s => (
                    <span key={s} className="text-xs px-2 py-0.5 bg-amber-500/30 text-amber-200 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl">
          {(['careers', 'subjects'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${
                activeTab === tab
                  ? 'bg-white text-violet-700 shadow-md'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'careers' ? '🎯 Career Matches' : '📚 Subject Performance'}
            </button>
          ))}
        </div>

        {/* TAB: CAREERS */}
        {activeTab === 'careers' && (
          <div className="space-y-4">
            {generating ? (
              <div className="bg-white rounded-3xl border-2 border-slate-200 p-16 text-center">
                <Loader2 className="w-12 h-12 text-violet-600 animate-spin mx-auto mb-4" />
                <p className="font-black text-slate-700 text-lg">Analysing {firstName}'s performance...</p>
                <p className="text-slate-500 text-sm mt-2">
                  DeepSeek AI is matching careers to actual scores. This takes 10-15 seconds.
                </p>
              </div>
            ) : error ? (
              <div className="bg-red-50 border-2 border-red-200 rounded-3xl p-8 text-center">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <p className="font-black text-red-900 mb-4">{error}</p>
                <button
                  onClick={() => generateCareers(student, assessment)}
                  className="px-8 py-3 bg-red-600 text-white rounded-full font-bold hover:scale-105 transition-all"
                >
                  Try Again
                </button>
              </div>
            ) : careers.length === 0 ? (
              <div className="bg-white rounded-3xl border-2 border-slate-200 p-12 text-center">
                <Brain className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="font-bold text-slate-600">No career data yet.</p>
                <button
                  onClick={() => generateCareers(student, assessment)}
                  className="mt-4 px-8 py-3 bg-violet-600 text-white rounded-full font-bold"
                >
                  Generate Now
                </button>
              </div>
            ) : (
              careers.map((career, i) => (
                <CareerCard
                  key={i}
                  career={career}
                  rank={i + 1}
                  studentId={studentId!}
                  studentName={student.name}
                  isIGCSE={isIGCSE}
                />
              ))
            )}
          </div>
        )}

        {/* TAB: SUBJECTS */}
        {activeTab === 'subjects' && (
          <div className="space-y-4">

            {struggles.length > 0 && (
              <div>
                <h3 className="font-black text-red-700 mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Needs Immediate Attention
                </h3>
                <div className="space-y-3">
                  {struggles.map(([key, score]) => {
                    const { label, emoji } = getSubjectDisplay(key)
                    const lvl = LEVEL_CONFIG[score as 1|2|3|4]
                    return (
                      <div key={key} className={`bg-white rounded-2xl border-2 ${lvl.border} p-4 shadow-sm`}>
                        <div className="flex items-center gap-4 mb-2">
                          <span className="text-2xl">{emoji}</span>
                          <div className="flex-1">
                            <div className="font-black text-slate-900">{label}</div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-1">
                              <div className={`h-full ${lvl.bar} rounded-full`} style={{ width: `${((score as number) / 4) * 100}%` }} />
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-black ${lvl.bg} ${lvl.text}`}>
                            L{score} {lvl.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 ml-10">
                          {(score as number) === 1
                            ? '🔴 Foundation level. Daily 10-min practice essential. Get teacher support immediately.'
                            : '🟡 Developing. Review fundamentals, join study group, complete exercises daily.'}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {strengths.length > 0 && (
              <div>
                <h3 className="font-black text-green-700 mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Strong Subjects — Build On These
                </h3>
                <div className="space-y-3">
                  {strengths.map(([key, score]) => {
                    const { label, emoji } = getSubjectDisplay(key)
                    const lvl = LEVEL_CONFIG[score as 1|2|3|4]
                    return (
                      <div key={key} className={`bg-white rounded-2xl border-2 ${lvl.border} p-4 shadow-sm`}>
                        <div className="flex items-center gap-4">
                          <span className="text-2xl">{emoji}</span>
                          <div className="flex-1">
                            <div className="font-black text-slate-900">{label}</div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-1">
                              <div className={`h-full ${lvl.bar} rounded-full`} style={{ width: `${((score as number) / 4) * 100}%` }} />
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-black ${lvl.bg} ${lvl.text}`}>
                            L{score} {lvl.label}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <Link
              href="/dashboard/learning-compass"
              className="flex items-center justify-center gap-2 w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl font-black hover:scale-[1.02] transition-all shadow-lg mt-4"
            >
              <MessageCircle className="w-5 h-5" />
              Practice Weak Subjects with Learning Compass
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Page export ──────────────────────────────────────────────────────────────
export default function CareerGuidancePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <CareerAnalysisSkeleton />
        </div>
      </div>
    }>
      <CareerGuidanceContent />
    </Suspense>
  )
}