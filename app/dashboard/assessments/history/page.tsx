'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import {
  ChevronDown, ChevronUp, Calendar, BookOpen, Filter,
  MessageCircle, PlusCircle, Loader2, AlertCircle,
  GraduationCap, BarChart3, FileText, ArrowLeft,
} from 'lucide-react'
import { getGradeColor, getGradeLabel, getCurriculumConfig } from '@/lib/curriculum'
import { friendlyMessage } from '@/lib/errors/friendlyMessage'

// ─── Types ────────────────────────────────────────────────────────────────────
interface AssessmentRecord {
  id:               string
  student_id:       string
  student_name:     string
  student_grade:    number
  student_pathway:  string | null
  grade:            number
  term:             number
  year:             number
  grade_level:      string
  subject_scores:   Record<string, number | string>
  curriculum_type?: string | null
  assessment_style?: string | null
  mathematics_type: 'core' | 'essential' | null
  pathway_electives: string[] | null
  created_at:       string
}

interface StudentMeta {
  id:    string
  name:  string
  grade: number
}

// ─── Subject label map ────────────────────────────────────────────────────────
const SUBJECT_LABELS: Record<string, string> = {
  mathematics:               'Mathematics',
  english:                   'English',
  kiswahili:                 'Kiswahili',
  integrated_science:        'Integrated Science',
  social_studies:            'Social Studies',
  pre_technical_studies:     'Pre-Technical Studies',
  pre_technical:             'Pre-Technical Studies',
  creative_arts_sports:      'Creative Arts & Sports',
  agriculture_nutrition:     'Agriculture & Nutrition',
  cre:                       'Christian RE',
  ire:                       'Islamic RE',
  hre:                       'Hindu RE',
  core_mathematics:          'Core Mathematics',
  essential_mathematics:     'Essential Mathematics',
  kiswahili_ksl:             'Kiswahili / KSL',
  community_service_learning:'Community Service Learning',
  community_service:         'Community Service',
  biology:                   'Biology',
  chemistry:                 'Chemistry',
  physics:                   'Physics',
  computer_studies:          'Computer Studies',
  agriculture:               'Agriculture',
  geography:                 'Geography',
  history_citizenship:       'History & Citizenship',
  business_studies:          'Business Studies',
  home_science:              'Home Science',
  fine_arts:                 'Fine Arts',
  music_dance:               'Music & Dance',
  sports_recreation:         'Sports & Recreation',
  theatre_film:              'Theatre & Film',
  physical_education:        'Physical Education',
  drawing_design:            'Drawing & Design',
  general_science:           'General Science',
  // IGCSE subjects
  english_first_language:    'English First Language',
  english_second_language:   'English Second Language',
  french:                    'French',
  history:                   'History',
  economics:                 'Economics',
  global_perspectives:       'Global Perspectives',
  combined_science:          'Combined Science',
  environmental_management:  'Environmental Management',
  additional_mathematics:    'Additional Mathematics',
  computer_science:          'Computer Science',
  art_design:                'Art & Design',
  music:                     'Music',
  drama:                     'Drama',
  accounting:                'Accounting',
  science:                   'Sciences',
  humanities:                'Humanities',
  ict:                       'ICT / Computer Studies',
  pshe:                      'PSHE',
}

function subjectLabel(key: string) {
  return SUBJECT_LABELS[key] ?? key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// ─── CBC Level config ─────────────────────────────────────────────────────────
const LEVEL: Record<number, { label: string; bar: string; badge: string; text: string }> = {
  1: { label: 'Below Expectations',       bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700',     text: 'text-red-700'    },
  2: { label: 'Approaching Expectations', bar: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700', text: 'text-amber-700'  },
  3: { label: 'Meets Expectations',       bar: 'bg-green-500',  badge: 'bg-green-100 text-green-700', text: 'text-green-700'  },
  4: { label: 'Exceeds Expectations',     bar: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700',text: 'text-purple-700' },
}

function getLvl(score: number) {
  const n = Math.max(1, Math.min(4, Math.round(score))) as 1|2|3|4
  return LEVEL[n]
}

function ScoreBar({ score }: { score: number }) {
  const pct   = Math.round((score / 4) * 100)
  const level = getLvl(score)
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${level.bar} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold w-4 ${level.text}`}>{score}</span>
    </div>
  )
}

// ─── IGCSE grade badge ────────────────────────────────────────────────────────
function IGCSEGradeBadge({ grade }: { grade: string }) {
  const color = getGradeColor('igcse', grade)
  const label = getGradeLabel('igcse', grade)
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg font-black text-sm text-white"
        style={{ backgroundColor: color }}
      >
        {grade}
      </span>
      <span className="text-xs text-slate-600 font-medium">{label}</span>
    </div>
  )
}

// ─── Average utils ────────────────────────────────────────────────────────────
function calcCBCAvg(scores: Record<string, number | string>): number | null {
  const vals = Object.values(scores).filter(v => typeof v === 'number' && (v as number) >= 1 && (v as number) <= 4) as number[]
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function calcIGCSEAvg(scores: Record<string, number | string>): { grade: string; label: string; color: string } | null {
  const config = getCurriculumConfig('igcse')
  const entries = Object.values(scores).filter(v => typeof v === 'string')
  const nums = entries.map(v => {
    const gl = config.gradeLabels.find(g => g.value == v)
    return gl ? gl.numericEquivalent : 0
  }).filter(n => n > 0)
  if (!nums.length) return null
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length
  let closest = config.gradeLabels[0]
  let minDiff = Infinity
  for (const gl of config.gradeLabels) {
    const diff = Math.abs(gl.numericEquivalent - avg)
    if (diff < minDiff) { minDiff = diff; closest = gl }
  }
  return { grade: String(closest.value), label: closest.label, color: closest.color }
}

// ─── Assessment style label ───────────────────────────────────────────────────
const STYLE_LABELS: Record<string, string> = {
  formative:           'Term Assessment',
  mock_exam:           'Mock Exam',
  end_of_term:         'End of Term',
  cambridge_predicted: 'Predicted Grades',
  summative:           'Internal Exam',
}

function assessmentPeriodLabel(a: AssessmentRecord): string {
  if (a.curriculum_type === 'igcse') {
    const style = a.assessment_style ? (STYLE_LABELS[a.assessment_style] ?? a.assessment_style) : 'Assessment'
    return `${style}, ${a.year}`
  }
  return `Term ${a.term}, ${a.year}`
}

// ─── WhatsApp share ───────────────────────────────────────────────────────────
function shareOnWhatsApp(a: AssessmentRecord) {
  const isIGCSE = a.curriculum_type === 'igcse'

  if (isIGCSE) {
    const avgData = calcIGCSEAvg(a.subject_scores)
    const subjects = Object.entries(a.subject_scores)
      .slice(0, 5)
      .map(([k, v]) => `  • ${subjectLabel(k)}: ${v} (${getGradeLabel('igcse', v)})`)
      .join('\n')
    const text = encodeURIComponent(
      `📚 *${a.student_name}'s IGCSE Progress Report*\n` +
      `Year ${a.grade} | ${assessmentPeriodLabel(a)}\n\n` +
      `*Overall: Grade ${avgData?.grade ?? '—'} — ${avgData?.label ?? 'N/A'}*\n\n` +
      `Subject highlights:\n${subjects}\n\n` +
      `_Generated via EduNexus Academic Clinic_`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  } else {
    const avg      = calcCBCAvg(a.subject_scores)
    const avgLabel = avg !== null ? getLvl(avg).label : 'N/A'
    const subjects = Object.entries(a.subject_scores)
      .slice(0, 5)
      .map(([k, v]) => `  • ${subjectLabel(k)}: ${v}/4 (${typeof v === 'number' ? getLvl(v).label : v})`)
      .join('\n')
    const text = encodeURIComponent(
      `📚 *${a.student_name}'s CBC Progress Report*\n` +
      `Grade ${a.grade} | Term ${a.term}, ${a.year}\n\n` +
      `*Overall: ${avgLabel}*\n\n` +
      `Subject highlights:\n${subjects}\n\n` +
      `_Generated via EduNexus Academic Clinic_`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }
}

// ─── Assessment Card ──────────────────────────────────────────────────────────
function AssessmentCard({ a }: { a: AssessmentRecord }) {
  const [expanded, setExpanded] = useState(false)

  const isIGCSE    = a.curriculum_type === 'igcse'
  const entries    = Object.entries(a.subject_scores)
  const preview    = entries.slice(0, 3)
  const rest       = entries.slice(3)
  const date       = new Date(a.created_at).toLocaleDateString('en-KE', { month: 'short', year: 'numeric' })

  // CBC avg
  const cbcAvg      = !isIGCSE ? calcCBCAvg(a.subject_scores) : null
  const cbcAvgLevel = cbcAvg !== null ? getLvl(cbcAvg) : null

  // IGCSE avg
  const igcseAvg = isIGCSE ? calcIGCSEAvg(a.subject_scores) : null

  return (
    <div className="bg-white rounded-3xl border-2 border-slate-100 shadow-sm overflow-hidden hover:border-blue-100 transition-colors">
      {/* Card header */}
      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <GraduationCap className="w-4 h-4 text-blue-500" />
              <span className="font-black text-slate-900">{a.student_name}</span>
              {/* Curriculum badge */}
              {isIGCSE ? (
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
                  🌍 IGCSE · Year {a.grade}
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                  🇰🇪 CBC · Grade {a.grade}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" />
                {assessmentPeriodLabel(a)}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {date}
              </span>
            </div>
          </div>

          {/* CBC average badge */}
          {!isIGCSE && cbcAvgLevel && cbcAvg !== null && (
            <div className="flex flex-col items-end gap-1">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${cbcAvgLevel.badge}`}>
                {cbcAvgLevel.label}
              </span>
              <span className="text-xs text-slate-400">avg {cbcAvg.toFixed(1)}/4.0</span>
            </div>
          )}

          {/* IGCSE average badge */}
          {isIGCSE && igcseAvg && (
            <div className="flex flex-col items-end gap-1">
              <span
                className="px-3 py-1 rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: igcseAvg.color }}
              >
                Grade {igcseAvg.grade} — {igcseAvg.label}
              </span>
              <span className="text-xs text-slate-400">avg grade</span>
            </div>
          )}
        </div>

        {/* Subject preview */}
        <div className="space-y-2">
          {preview.map(([key, score]) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-xs text-slate-600 w-40 shrink-0 truncate">{subjectLabel(key)}</span>
              {isIGCSE ? (
                <IGCSEGradeBadge grade={String(score)} />
              ) : (
                <ScoreBar score={Number(score)} />
              )}
            </div>
          ))}

          {rest.length > 0 && expanded && rest.map(([key, score]) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-xs text-slate-600 w-40 shrink-0 truncate">{subjectLabel(key)}</span>
              {isIGCSE ? (
                <IGCSEGradeBadge grade={String(score)} />
              ) : (
                <ScoreBar score={Number(score)} />
              )}
            </div>
          ))}
        </div>

        {rest.length > 0 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-3 flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
          >
            {expanded
              ? <><ChevronUp   className="w-3.5 h-3.5" /> Show less</>
              : <><ChevronDown className="w-3.5 h-3.5" /> +{rest.length} more subjects</>
            }
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 px-5 sm:px-6 pb-5">
        <Link
          href={`/dashboard/clinic/reports/${a.student_id}`}
          className="flex items-center gap-1.5 px-4 py-2 bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-bold hover:from-blue-700 hover:to-indigo-700 transition-all"
        >
          <FileText className="w-3.5 h-3.5" />
          View Full Report
        </Link>
        <button
          onClick={() => shareOnWhatsApp(a)}
          className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Share with Teacher
        </button>
      </div>
    </div>
  )
}

// ─── Main (inner) ─────────────────────────────────────────────────────────────
function HistoryContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [assessments,  setAssessments]  = useState<AssessmentRecord[]>([])
  const [students,     setStudents]     = useState<StudentMeta[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)

  const [filterStudent, setFilterStudent] = useState<string>(searchParams.get('student_id') ?? '')
  const [filterYear,    setFilterYear]    = useState<string>('')
  const [filterTerm,    setFilterTerm]    = useState<string>('')

  const loadHistory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filterStudent) params.set('student_id', filterStudent)
      if (filterYear)    params.set('year', filterYear)
      if (filterTerm)    params.set('term', filterTerm)

      const res = await fetch(`/api/assessments/history?${params}`)
      if (res.status === 401) { router.push('/login'); return }
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Failed to load')
      setAssessments(json.data.assessments ?? [])
      setStudents(json.data.students ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [router, filterStudent, filterYear, filterTerm])

  useEffect(() => { loadHistory() }, [loadHistory])

  const availableYears = useMemo(() => {
    const years = [...new Set(assessments.map(a => a.year))].sort((a, b) => b - a)
    return years
  }, [assessments])

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href="/dashboard/clinic"
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2 font-medium"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Clinic
            </Link>
            <h1 className="text-3xl font-black text-slate-900">Assessment History</h1>
            <p className="text-slate-500 text-sm mt-1">All assessments for all your students</p>
          </div>
          <Link
            href="/dashboard/assessments/add"
            className="flex items-center gap-2 px-5 py-3 bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md"
          >
            <PlusCircle className="w-4 h-4" />
            Add Assessment
          </Link>
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-bold text-slate-600">Filter</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Student</label>
              <select
                value={filterStudent}
                onChange={e => setFilterStudent(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 bg-white focus:outline-none focus:border-blue-400"
              >
                <option value="">All Students</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.name} (Gr {s.grade})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Year</label>
              <select
                value={filterYear}
                onChange={e => setFilterYear(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 bg-white focus:outline-none focus:border-blue-400"
              >
                <option value="">All Years</option>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Term (CBC)</label>
              <select
                value={filterTerm}
                onChange={e => setFilterTerm(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 bg-white focus:outline-none focus:border-blue-400"
              >
                <option value="">All Terms</option>
                <option value="1">Term 1</option>
                <option value="2">Term 2</option>
                <option value="3">Term 3</option>
              </select>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="font-medium">{friendlyMessage(error).message}</span>
          </div>
        )}

        {!loading && !error && (
          <p className="text-sm text-slate-500 font-medium">
            {assessments.length === 0
              ? 'No assessments found'
              : `${assessments.length} assessment${assessments.length !== 1 ? 's' : ''} found`
            }
          </p>
        )}

        {!loading && !error && assessments.length > 0 && (
          <div className="space-y-4">
            {assessments.map(a => <AssessmentCard key={a.id} a={a} />)}
          </div>
        )}

        {!loading && !error && assessments.length === 0 && (
          <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-slate-200">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">No assessments yet</h3>
            <p className="text-slate-500 mb-6 max-w-xs mx-auto">
              Add your first assessment to see history here.
            </p>
            <Link
              href="/dashboard/assessments/add"
              className="inline-flex items-center gap-2 px-6 py-3 bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              Add Assessment
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────
export default function HistoryPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    }>
      <HistoryContent />
    </Suspense>
  )
}
