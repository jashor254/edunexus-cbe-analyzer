'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { calculateJuniorPathwayAffinity, calculateIGCSESubjectRecommendation } from '@/lib/pathwayCalculator'
import type { IGCSEPathwayStrength, IGCSESubjectRating } from '@/lib/pathwayCalculator'
import Link from 'next/link'
import {
  Loader2, ArrowLeft, GraduationCap, Target,
  TrendingUp, AlertTriangle, CheckCircle2, MessageCircle,
  Lightbulb, ChevronRight, BarChart3, Compass,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Student {
  id:              string
  name:            string
  grade:           number
  current_pathway: string | null
  curriculum_type: string | null
  year_level:      number | null
}

interface Assessment {
  id:             string
  term:           number
  year:           number
  grade:          number
  subject_scores: Record<string, number | string>
  pathway_recommendations?: PathwayRec | null
  created_at:     string
  curriculum_type?: string | null
  assessment_style?: string | null
}

interface PathwayRec {
  stem_score:            number
  arts_sports_score:     number
  social_sciences_score: number
  top_pathway:           string
  confidence:            'high' | 'medium' | 'low'
  strengths:             string[]
  development_areas:     string[]
  guidance_message:      string
}

// ─── CBC subject labels ───────────────────────────────────────────────────────
const SUBJECT_LABELS: Record<string, { label: string; emoji: string }> = {
  mathematics:           { label: 'Mathematics',            emoji: '🔢' },
  english:               { label: 'English',                emoji: '📚' },
  kiswahili:             { label: 'Kiswahili',              emoji: '🗣️' },
  integrated_science:    { label: 'Integrated Science',     emoji: '🔬' },
  social_studies:        { label: 'Social Studies',         emoji: '🌍' },
  pre_technical_studies: { label: 'Pre-Technical Studies',  emoji: '⚙️' },
  pre_technical:         { label: 'Pre-Technical Studies',  emoji: '⚙️' },
  creative_arts_sports:  { label: 'Creative Arts & Sports', emoji: '🎨' },
  agriculture_nutrition: { label: 'Agriculture & Nutrition',emoji: '🌾' },
  cre:                   { label: 'Christian RE',           emoji: '⛪' },
  ire:                   { label: 'Islamic RE',             emoji: '🕌' },
  hre:                   { label: 'Hindu RE',               emoji: '🕉️' },
  biology:               { label: 'Biology',                emoji: '🧬' },
  chemistry:             { label: 'Chemistry',              emoji: '⚗️' },
  physics:               { label: 'Physics',                emoji: '⚡' },
  history:               { label: 'History',                emoji: '📜' },
  geography:             { label: 'Geography',              emoji: '🗺️' },
  computer_science:      { label: 'Computer Science',       emoji: '💻' },
  french:                { label: 'French',                 emoji: '🇫🇷' },
  arabic:                { label: 'Arabic',                 emoji: '📖' },
  additional_mathematics:{ label: 'Add. Mathematics',       emoji: '📐' },
  economics:             { label: 'Economics',              emoji: '💹' },
  business_studies:      { label: 'Business Studies',       emoji: '💼' },
  accounting:            { label: 'Accounting',             emoji: '🧾' },
  ict:                   { label: 'ICT',                    emoji: '🖥️' },
  design_technology:     { label: 'Design & Technology',    emoji: '🔧' },
  english_language:      { label: 'English Language',       emoji: '📝' },
  literature_english:    { label: 'English Literature',     emoji: '📗' },
  global_perspectives:   { label: 'Global Perspectives',   emoji: '🌐' },
  sociology:             { label: 'Sociology',              emoji: '👥' },
  combined_science:      { label: 'Combined Science',       emoji: '🔬' },
  environmental_management: { label: 'Environmental Mgmt', emoji: '🌿' },
}

function subjectInfo(key: string) {
  return SUBJECT_LABELS[key] ?? {
    label: key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    emoji: '📖',
  }
}

// ─── CBC level config ─────────────────────────────────────────────────────────
const LEVEL: Record<number, { label: string; bar: string; badge: string }> = {
  1: { label: 'Below Expectations',       bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700'      },
  2: { label: 'Approaching Expectations', bar: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700'  },
  3: { label: 'Meets Expectations',       bar: 'bg-green-500',  badge: 'bg-green-100 text-green-700'  },
  4: { label: 'Exceeds Expectations',     bar: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700'},
}

function lvl(score: number) {
  const n = Math.max(1, Math.min(4, Math.round(score))) as 1|2|3|4
  return LEVEL[n]
}

// ─── CBC Pathway config ───────────────────────────────────────────────────────
const PATHWAYS = [
  {
    key: 'STEM', label: 'STEM Pathway', emoji: '🔬',
    bg: 'bg-blue-50', border: 'border-blue-200', bar: 'bg-blue-500', textColor: 'text-blue-700',
    careers: 'Engineering, Medicine, Computer Science, Architecture',
    note: 'Strong in Mathematics & Science? This is your path.',
  },
  {
    key: 'Arts & Sports', label: 'Arts & Sports Pathway', emoji: '🎨',
    bg: 'bg-orange-50', border: 'border-orange-200', bar: 'bg-orange-500', textColor: 'text-orange-700',
    careers: 'Graphic Design, Sports Management, Music, Film, Journalism',
    note: 'Excelling in Creative Arts & Sports? This path is for you.',
  },
  {
    key: 'Social Sciences', label: 'Social Sciences Pathway', emoji: '📚',
    bg: 'bg-violet-50', border: 'border-violet-200', bar: 'bg-violet-500', textColor: 'text-violet-700',
    careers: 'Law, Teaching, Business, International Relations, Psychology',
    note: 'Strong in English, Kiswahili & Social Studies? Explore this.',
  },
]

function pathwayScore(key: string, rec: PathwayRec): number {
  if (key === 'STEM')          return rec.stem_score
  if (key === 'Arts & Sports') return rec.arts_sports_score
  return rec.social_sciences_score
}

// ─── IGCSE rating config ──────────────────────────────────────────────────────
const IGCSE_RATING: Record<IGCSESubjectRating, { icon: string; label: string; color: string }> = {
  strongly_recommended: { icon: '⭐', label: 'Strongly Recommended', color: 'text-green-700 bg-green-100' },
  recommended:          { icon: '✅', label: 'Recommended',          color: 'text-blue-700 bg-blue-100'   },
  consider:             { icon: '⚠️', label: 'Consider',             color: 'text-amber-700 bg-amber-100' },
  not_recommended:      { icon: '❌', label: 'Needs Work First',      color: 'text-red-700 bg-red-100'    },
}

// ─── WhatsApp share ───────────────────────────────────────────────────────────
function shareWhatsApp(student: Student, rec: PathwayRec, term: number, year: number) {
  const text = encodeURIComponent(
    `📊 *${student.name}'s CBC Pathway Guidance*\n` +
    `Grade ${student.grade} | Term ${term}, ${year}\n\n` +
    `*Recommended Pathway: ${rec.top_pathway}*\n` +
    `Confidence: ${rec.confidence}\n\n` +
    `STEM: ${rec.stem_score}% | Arts & Sports: ${rec.arts_sports_score}% | Social Sciences: ${rec.social_sciences_score}%\n\n` +
    `${rec.guidance_message}\n\n` +
    `_Generated via EduNexus Academic Clinic_`
  )
  window.open(`https://wa.me/?text=${text}`, '_blank')
}

// ─── IGCSE Pathway card ───────────────────────────────────────────────────────
function IGCSEPathwayCard({ p, isTop }: { p: IGCSEPathwayStrength; isTop: boolean }) {
  return (
    <div className={`rounded-2xl p-5 border-2 ${isTop ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-100'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{p.emoji}</span>
          <div>
            <p className="font-black text-slate-900 text-sm">{p.label}</p>
            {isTop && <span className="text-xs font-bold text-indigo-600">★ Best match</span>}
          </div>
        </div>
        <span className={`text-2xl font-black ${isTop ? 'text-indigo-700' : 'text-slate-600'}`}>{p.score}%</span>
      </div>
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-700 ${isTop ? 'bg-indigo-500' : 'bg-slate-400'}`}
          style={{ width: `${p.score}%` }}
        />
      </div>
      <p className="text-xs text-slate-500 mb-2">{p.description}</p>
      <div className="flex flex-wrap gap-1">
        {p.aLevelSubjects.map(s => (
          <span key={s} className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-bold">{s}</span>
        ))}
      </div>
    </div>
  )
}

// ─── Inner component ──────────────────────────────────────────────────────────
function GuidanceContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const studentId    = searchParams.get('student')

  const [student,    setStudent]    = useState<Student | null>(null)
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [rec,        setRec]        = useState<PathwayRec | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!studentId) { router.push('/dashboard/clinic'); return }
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Fetch student (includes curriculum fields)
      const { data: s, error: sErr } = await supabase
        .from('students')
        .select('id, name, grade, current_pathway, curriculum_type, year_level')
        .eq('id', studentId)
        .eq('user_id', user.id)
        .single()

      if (sErr || !s) throw new Error('Student not found')
      setStudent(s)

      // Fetch latest assessment
      const { data: rows, error: aErr } = await supabase
        .from('assessments')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(1)

      if (aErr) throw new Error(aErr.message)
      if (!rows?.length) throw new Error('No assessments found. Add an assessment first.')

      const latest = rows[0] as Assessment
      setAssessment(latest)

      // CBC only: use stored recommendations or recalculate
      const isCBC = !s.curriculum_type || s.curriculum_type === 'cbc'
      if (isCBC) {
        const stored = latest.pathway_recommendations
        if (stored && typeof stored.stem_score === 'number') {
          setRec(stored)
        } else {
          const numericScores: Record<string, number> = {}
          for (const [k, v] of Object.entries(latest.subject_scores)) {
            numericScores[k] = typeof v === 'number' ? v : 0
          }
          setRec(calculateJuniorPathwayAffinity(numericScores))
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load guidance')
    } finally {
      setLoading(false)
    }
  }, [studentId, router])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error || !student || !assessment) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-2xl font-black text-slate-900 mb-2">Cannot load guidance</h2>
        <p className="text-slate-500 mb-6">{error ?? 'Something went wrong'}</p>
        <div className="flex justify-center gap-3">
          <Link href="/dashboard/clinic" className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">
            Back to Clinic
          </Link>
          {studentId && (
            <Link href={`/dashboard/assessments/add?student=${studentId}`} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors">
              Add Assessment
            </Link>
          )}
        </div>
      </div>
    )
  }

  const isIGCSE = student.curriculum_type === 'igcse'

  // ── IGCSE branch ─────────────────────────────────────────────────────────────
  if (isIGCSE) {
    const igcseRec = calculateIGCSESubjectRecommendation(
      assessment.subject_scores,
      student.year_level ?? 10
    )

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

          {/* Nav */}
          <div className="flex items-center justify-between">
            <Link href="/dashboard/clinic" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 font-medium">
              <ArrowLeft className="w-4 h-4" /> Back to Clinic
            </Link>
          </div>

          {/* Header */}
          <div className="bg-white rounded-3xl p-6 border-2 border-slate-100 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-md shrink-0">
                <GraduationCap className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900">{student.name}</h1>
                <p className="text-slate-500 text-sm">
                  🌍 Cambridge IGCSE · Year {student.year_level ?? student.grade} ·{' '}
                  {assessment.assessment_style ?? `Term ${assessment.term}`}, {assessment.year}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-xs font-bold px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full flex items-center gap-1">
                    <Compass className="w-3 h-3" /> Subject Selection Guide
                  </span>
                  <span className="text-xs font-bold px-3 py-1 bg-violet-100 text-violet-700 rounded-full">
                    {igcseRec.topPathway} pathway
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Top pathway highlight */}
          {igcseRec.pathwayStrengths[0] && (
            <div className="rounded-3xl p-6 border-2 bg-indigo-50 border-indigo-300">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">{igcseRec.pathwayStrengths[0].emoji}</span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Strongest Pathway</p>
                  <h2 className="text-xl font-black text-indigo-700">{igcseRec.pathwayStrengths[0].label}</h2>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-3">{igcseRec.pathwayStrengths[0].description}</p>
              <p className="text-xs text-slate-500 font-bold mb-2">Recommended A-Level subjects:</p>
              <div className="flex flex-wrap gap-2">
                {igcseRec.pathwayStrengths[0].aLevelSubjects.map(s => (
                  <span key={s} className="text-xs px-3 py-1 bg-indigo-600 text-white rounded-full font-bold">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* All pathway strengths */}
          <div className="space-y-3">
            <h3 className="font-black text-slate-900 flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-500" /> All Pathway Matches
            </h3>
            {igcseRec.pathwayStrengths.map((p, i) => (
              <IGCSEPathwayCard key={p.pathway} p={p} isTop={i === 0} />
            ))}
          </div>

          {/* Subject recommendation table */}
          <div className="bg-white rounded-3xl p-6 border-2 border-slate-100 shadow-sm">
            <h3 className="font-black text-slate-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-500" /> Subject Performance & Recommendations
            </h3>
            <div className="space-y-3">
              {igcseRec.subjectRecommendations.map(({ subject, rating, gradeLabel, numericScore }) => {
                const { label, emoji } = subjectInfo(subject)
                const ratingCfg = IGCSE_RATING[rating]
                return (
                  <div key={subject} className="flex items-center gap-3">
                    <span className="text-lg w-7 text-center shrink-0">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-700 truncate">{label}</span>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          {gradeLabel && (
                            <span className="text-xs font-black px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                              Grade {gradeLabel}
                            </span>
                          )}
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ratingCfg.color}`}>
                            {ratingCfg.icon} {ratingCfg.label}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${(numericScore / 9) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ICE Award note */}
          {igcseRec.iceAwardNote && (
            <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200">
              <div className="flex gap-3">
                <Lightbulb className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-900 font-medium leading-relaxed">
                  🏆 {igcseRec.iceAwardNote}
                </p>
              </div>
            </div>
          )}

          {/* University options */}
          {igcseRec.pathwayStrengths[0] && (
            <div className="bg-white rounded-3xl p-6 border-2 border-slate-100 shadow-sm">
              <h3 className="font-black text-slate-900 mb-4 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-500" /> University Options ({igcseRec.pathwayStrengths[0].label})
              </h3>
              <ul className="space-y-2">
                {igcseRec.pathwayStrengths[0].universityOptions.map(u => (
                  <li key={u} className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full shrink-0" />{u}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next steps */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-3xl p-6 text-white">
            <h3 className="font-black text-lg mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5" /> What next?
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Link
                href={`/dashboard/assessments/add?student=${student.id}`}
                className="flex items-center justify-between p-4 bg-white/15 hover:bg-white/25 rounded-2xl transition-colors"
              >
                <div>
                  <p className="font-bold text-sm">Add Next Assessment</p>
                  <p className="text-xs text-indigo-200 mt-0.5">Track progress over time</p>
                </div>
                <ChevronRight className="w-5 h-5 text-white/70" />
              </Link>
              <Link
                href={`/dashboard/assessments/history?student_id=${student.id}`}
                className="flex items-center justify-between p-4 bg-white/15 hover:bg-white/25 rounded-2xl transition-colors"
              >
                <div>
                  <p className="font-bold text-sm">View Full History</p>
                  <p className="text-xs text-indigo-200 mt-0.5">All past assessments</p>
                </div>
                <ChevronRight className="w-5 h-5 text-white/70" />
              </Link>
            </div>
          </div>

        </div>
      </div>
    )
  }

  // ── CBC branch (completely unchanged logic) ───────────────────────────────────
  if (!rec) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-2xl font-black text-slate-900 mb-2">Cannot load guidance</h2>
        <p className="text-slate-500 mb-6">Could not calculate pathway recommendations</p>
        <Link href="/dashboard/clinic" className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold">
          Back to Clinic
        </Link>
      </div>
    )
  }

  const sortedPathways = [...PATHWAYS]
    .map(p => ({ ...p, score: pathwayScore(p.key, rec) }))
    .sort((a, b) => b.score - a.score)

  const top = sortedPathways[0]

  const cbcScores = Object.fromEntries(
    Object.entries(assessment.subject_scores).map(([k, v]) => [k, typeof v === 'number' ? v : 0])
  )

  const strengthEntries = Object.entries(cbcScores)
    .filter(([, v]) => v >= 3).sort(([, a], [, b]) => b - a).slice(0, 3)

  const weakEntries = Object.entries(cbcScores)
    .filter(([, v]) => v <= 2).sort(([, a], [, b]) => a - b).slice(0, 3)

  const confBadge = {
    high:   'bg-green-100 text-green-700',
    medium: 'bg-amber-100 text-amber-700',
    low:    'bg-slate-100 text-slate-600',
  }[rec.confidence]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Nav */}
        <div className="flex items-center justify-between">
          <Link href="/dashboard/clinic" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 font-medium">
            <ArrowLeft className="w-4 h-4" /> Back to Clinic
          </Link>
          <button
            onClick={() => shareWhatsApp(student, rec, assessment.term, assessment.year)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Share with Teacher
          </button>
        </div>

        {/* Header card */}
        <div className="bg-white rounded-3xl p-6 border-2 border-slate-100 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-md shrink-0">
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">{student.name}</h1>
              <p className="text-slate-500 text-sm">Grade {student.grade} · Term {assessment.term}, {assessment.year}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-xs font-bold px-3 py-1 bg-blue-100 text-blue-700 rounded-full flex items-center gap-1">
                  <Compass className="w-3 h-3" /> Pathway Guidance
                </span>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${confBadge}`}>
                  {rec.confidence} confidence
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Top recommendation highlight */}
        <div className={`rounded-3xl p-6 border-2 ${top.bg} ${top.border}`}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">{top.emoji}</span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Recommended Pathway</p>
              <h2 className={`text-xl font-black ${top.textColor}`}>{top.label}</h2>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-2">{top.note}</p>
          <p className="text-xs text-slate-500"><span className="font-bold">Career paths: </span>{top.careers}</p>
        </div>

        {/* Guidance message */}
        {rec.guidance_message && (
          <div className="bg-indigo-50 rounded-2xl p-5 border border-indigo-100">
            <div className="flex gap-3">
              <Lightbulb className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
              <p className="text-sm text-indigo-900 font-medium leading-relaxed">{rec.guidance_message}</p>
            </div>
          </div>
        )}

        {/* Subject performance */}
        <div className="bg-white rounded-3xl p-6 border-2 border-slate-100 shadow-sm">
          <h3 className="font-black text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" /> Subject Performance
          </h3>
          <div className="space-y-3">
            {Object.entries(cbcScores).map(([key, score]) => {
              const { label, emoji } = subjectInfo(key)
              const level = lvl(score)
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-lg w-7 text-center shrink-0">{emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-700 truncate">{label}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ml-2 shrink-0 ${level.badge}`}>
                        {score}/4
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${level.bar} rounded-full`} style={{ width: `${(score / 4) * 100}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pathway match scores */}
        <div className="space-y-3">
          <h3 className="font-black text-slate-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-500" /> All Pathway Matches
          </h3>
          {sortedPathways.map((p, i) => (
            <div key={p.key} className={`rounded-2xl p-5 border-2 ${p.bg} ${p.border}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{p.emoji}</span>
                  <div>
                    <p className="font-black text-slate-900 text-sm">{p.label}</p>
                    {i === 0 && <span className="text-xs font-bold text-green-600">★ Best match</span>}
                  </div>
                </div>
                <span className={`text-2xl font-black ${p.textColor}`}>{p.score}%</span>
              </div>
              <div className="h-3 bg-white/60 rounded-full overflow-hidden">
                <div className={`h-full ${p.bar} rounded-full transition-all duration-700`} style={{ width: `${p.score}%` }} />
              </div>
              <p className="text-xs text-slate-500 mt-2">{p.note}</p>
            </div>
          ))}
        </div>

        {/* Strengths & needs work */}
        <div className="grid sm:grid-cols-2 gap-4">
          {strengthEntries.length > 0 && (
            <div className="bg-green-50 rounded-2xl p-5 border border-green-200">
              <h4 className="font-black text-green-800 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Top Strengths
              </h4>
              <div className="space-y-2">
                {strengthEntries.map(([key, score]) => {
                  const { label, emoji } = subjectInfo(key)
                  return (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <span>{emoji}</span>
                      <span className="font-medium text-green-800 flex-1 truncate">{label}</span>
                      <span className="text-xs font-bold text-green-600 shrink-0">{score}/4</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {weakEntries.length > 0 && (
            <div className="bg-red-50 rounded-2xl p-5 border border-red-200">
              <h4 className="font-black text-red-800 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Needs Work
              </h4>
              <div className="space-y-2">
                {weakEntries.map(([key, score]) => {
                  const { label, emoji } = subjectInfo(key)
                  return (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <span>{emoji}</span>
                      <span className="font-medium text-red-800 flex-1 truncate">{label}</span>
                      <span className="text-xs font-bold text-red-600 shrink-0">{score}/4</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* 3-step action plan */}
        <div className="bg-white rounded-3xl p-6 border-2 border-slate-100 shadow-sm">
          <h3 className="font-black text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" /> 3-Step Action Plan
          </h3>
          <div className="space-y-3">
            {([
              {
                color: 'bg-blue-100 text-blue-700',
                title: `Focus on ${top.label.replace(' Pathway', '')} subjects`,
                desc:  `Dedicate extra practice time to subjects that feed into ${top.label}.`,
              },
              {
                color: 'bg-amber-100 text-amber-700',
                title: weakEntries.length ? `Improve your weakest subject${weakEntries.length > 1 ? 's' : ''}` : 'Maintain consistency',
                desc:  weakEntries.length
                  ? `Work on: ${weakEntries.map(([k]) => subjectInfo(k).label).join(', ')}. Even moving from 2→3 is significant.`
                  : 'Keep up the great work across all subjects.',
              },
              {
                color: 'bg-green-100 text-green-700',
                title: 'Share this report with your teacher & parents',
                desc:  `A ${rec.confidence} confidence match means a clear direction. Ask your teacher for targeted support.`,
              },
            ] as const).map((item, i) => (
              <div key={i} className="flex gap-3">
                <div className={`w-8 h-8 rounded-xl font-black text-sm flex items-center justify-center shrink-0 ${item.color}`}>
                  {i + 1}
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Next steps CTA */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-3xl p-6 text-white">
          <h3 className="font-black text-lg mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5" /> What next?
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <Link
              href={`/dashboard/assessments/add?student=${student.id}`}
              className="flex items-center justify-between p-4 bg-white/15 hover:bg-white/25 rounded-2xl transition-colors"
            >
              <div>
                <p className="font-bold text-sm">Add Next Term Assessment</p>
                <p className="text-xs text-indigo-200 mt-0.5">Track progress over time</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/70" />
            </Link>
            <Link
              href={`/dashboard/assessments/history?student_id=${student.id}`}
              className="flex items-center justify-between p-4 bg-white/15 hover:bg-white/25 rounded-2xl transition-colors"
            >
              <div>
                <p className="font-bold text-sm">View Full History</p>
                <p className="text-xs text-indigo-200 mt-0.5">All past assessments</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/70" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Export (Suspense wrapper for useSearchParams) ────────────────────────────
export default function GuidancePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    }>
      <GuidanceContent />
    </Suspense>
  )
}
