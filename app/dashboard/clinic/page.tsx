'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import {
  FileText, Users, GraduationCap, AlertCircle, CheckCircle2,
  PlusCircle, X, Loader2, TrendingUp, Calendar, BarChart3,
  Brain, Target, Sparkles, ChevronRight, Zap,
  ArrowRight, Share2,
} from 'lucide-react'
import { getCurriculumConfig, getNumericScore } from '@/lib/curriculum'
import type { CurriculumType } from '@/lib/curriculum'
import { StudentCardsSkeleton } from '@/components/ui/skeletons'
import { NoStudentsEmpty } from '@/components/ui/empty-states'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Assessment {
  id: string
  term: number
  year: number
  grade: number
  subject_scores: Record<string, number | string>
  curriculum_type?: string | null
  created_at: string
}

interface ClinicReport {
  id: string
  pdf_url: string | null
  term: number | null
  year: number | null
  created_at: string
  whatsapp_sent_at: string | null
  email_sent_at: string | null
}

interface Student {
  id: string
  name: string
  grade: number
  school: string | null
  current_pathway: string | null
  curriculum_type?: string | null
  year_level?: string | null
  teacher_id?: string | null
  created_at: string
  assessments: Assessment[]
  clinicReport?: ClinicReport | null
}

interface ListResponse {
  students:    Student[]
  plan:        string
  maxStudents: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const LEVEL_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'Below Expectations',      color: 'text-red-700',    bg: 'bg-red-100'    },
  2: { label: 'Approaching Expectations', color: 'text-amber-700',  bg: 'bg-amber-100'  },
  3: { label: 'Meets Expectations',       color: 'text-green-700',  bg: 'bg-green-100'  },
  4: { label: 'Exceeds Expectations',     color: 'text-purple-700', bg: 'bg-purple-100' },
}

function cbcAvgScore(scores: Record<string, number | string>): number | null {
  const vals = Object.values(scores).filter(v => typeof v === 'number') as number[]
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function igcseAvgGrade(scores: Record<string, number | string>): { grade: string; label: string; color: string } | null {
  const config = getCurriculumConfig('igcse')
  const nums = Object.values(scores)
    .map(v => getNumericScore('igcse', v))
    .filter(n => n > 0)
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

function scoreBar(score: number, max = 4) {
  const pct = Math.round((score / max) * 100)
  const color =
    score >= 3.5 ? 'bg-purple-500' :
    score >= 2.5 ? 'bg-green-500'  :
    score >= 1.5 ? 'bg-amber-500'  : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-500 w-6 text-right">{score.toFixed(1)}</span>
    </div>
  )
}

function levelConfig(score: number | null) {
  if (score === null) return null
  const rounded = Math.round(score) as 1 | 2 | 3 | 4
  return LEVEL_LABELS[Math.max(1, Math.min(4, rounded)) as 1 | 2 | 3 | 4]
}

// ─── Curriculum badge ─────────────────────────────────────────────────────────
function CurriculumBadge({ curriculum, grade }: { curriculum: string | null | undefined; grade: number }) {
  if (curriculum === 'igcse') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
        🌍 IGCSE · Year {grade}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">
      🇰🇪 CBC · Grade {grade}
    </span>
  )
}

// ─── Add Student Modal ────────────────────────────────────────────────────────
function AddStudentModal({
  onClose,
  onSuccess,
}: {
  onClose:   () => void
  onSuccess: (student: Student) => void
}) {
  const [name,       setName]       = useState('')
  const [grade,      setGrade]      = useState<number>(7)
  const [school,     setSchool]     = useState('')
  const [curriculum, setCurriculum] = useState<CurriculumType>('cbc')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const gradeOptions = curriculum === 'igcse'
    ? [7, 8, 9, 10, 11]
    : [7, 8, 9, 10, 11, 12]

  const gradeLabel = curriculum === 'igcse' ? 'Year Level' : 'Grade'

  // Keep grade in valid range when switching curriculum
  useEffect(() => {
    if (curriculum === 'igcse' && grade > 11) setGrade(11)
  }, [curriculum, grade])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setLoading(true)
    setError(null)
    try {
      // Create student via API
      const res = await fetch('/api/students/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), grade, school: school.trim() || null }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to create student')
      }

      // Save curriculum_type and year_level via supabase (API doesn't handle these)
      const supabase = createClient()
      const yearLevel = curriculum === 'igcse' ? `Year ${grade}` : `Grade ${grade}`
      await supabase
        .from('students')
        .update({ curriculum_type: curriculum, year_level: yearLevel })
        .eq('id', json.data.student.id)

      onSuccess({
        ...json.data.student,
        assessments: [],
        curriculum_type: curriculum,
        year_level: yearLevel,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating student')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative overflow-y-auto max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-xl transition-colors"
        >
          <X className="w-5 h-5 text-slate-500" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Add Student</h2>
            <p className="text-sm text-slate-500">Enter your child's details</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Student Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Grace Wanjiku"
              required
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none font-medium text-slate-900 transition-colors"
            />
          </div>

          {/* Curriculum selector */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Which curriculum does your child follow? *
            </label>
            <div className="grid grid-cols-1 gap-3">
              {/* CBC card */}
              <button
                type="button"
                onClick={() => setCurriculum('cbc')}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                  curriculum === 'cbc'
                    ? 'border-green-500 bg-green-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-black text-slate-900 flex items-center gap-2">
                      🇰🇪 CBC Kenya
                      {curriculum === 'cbc' && (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">Competency-Based Curriculum</div>
                    <div className="text-xs text-slate-400 mt-1">Grade 7-12 · National curriculum · Levels 1-4</div>
                  </div>
                </div>
              </button>

              {/* IGCSE card */}
              <button
                type="button"
                onClick={() => setCurriculum('igcse')}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                  curriculum === 'igcse'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-black text-slate-900 flex items-center gap-2">
                      🌍 Cambridge IGCSE
                      {curriculum === 'igcse' && (
                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">International curriculum</div>
                    <div className="text-xs text-slate-400 mt-1">Year 7-11 · Grades A*-G · Brookhouse, Hillcrest, ISK etc.</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Grade / Year Level */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              {gradeLabel} *
            </label>
            <select
              value={grade}
              onChange={e => setGrade(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none font-medium text-slate-900 transition-colors bg-white"
            >
              {gradeOptions.map(g => (
                <option key={g} value={g}>
                  {curriculum === 'igcse' ? `Year ${g}` : `Grade ${g}`}
                  {curriculum === 'cbc' && (g <= 9 ? ' (Junior School)' : ' (Senior School)')}
                  {curriculum === 'igcse' && (g <= 9 ? ' (Lower Secondary)' : ' (IGCSE)')}
                </option>
              ))}
            </select>
          </div>

          {/* School */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              School (Optional)
            </label>
            <input
              type="text"
              value={school}
              onChange={e => setSchool(e.target.value)}
              placeholder={curriculum === 'igcse' ? 'e.g. Brookhouse School' : 'e.g. Nairobi Academy'}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none font-medium text-slate-900 transition-colors"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border-2 border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              {loading ? 'Adding…' : 'Add Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Student Card ─────────────────────────────────────────────────────────────
function StudentCard({ student }: { student: Student }) {
  const sorted  = [...(student.assessments ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  const latest      = sorted[0]
  const isIGCSE     = student.curriculum_type === 'igcse'
  const count       = student.assessments?.length ?? 0
  const hasTeacher  = !!student.teacher_id
  const report      = student.clinicReport

  // Last assessment label
  const lastDate = latest
    ? isIGCSE && latest.curriculum_type === 'igcse'
      ? `${latest.year}`
      : `Term ${latest.term}, ${latest.year}`
    : null

  // Performance for CBC
  const cbcAvg  = !isIGCSE && latest?.subject_scores ? cbcAvgScore(latest.subject_scores) : null
  const cbcLevel = levelConfig(cbcAvg)

  // Performance for IGCSE
  const igcseGrade = isIGCSE && latest?.subject_scores ? igcseAvgGrade(latest.subject_scores) : null

  return (
    <div className="bg-white rounded-3xl p-6 border-2 border-slate-100 hover:border-blue-200 hover:shadow-lg transition-all group">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-lg leading-tight">{student.name}</h3>
            <div className="mt-1">
              <CurriculumBadge curriculum={student.curriculum_type} grade={student.grade} />
            </div>
          </div>
        </div>
        {student.current_pathway && (
          <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
            {student.current_pathway}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Last Assessment
          </p>
          <p className="text-sm font-bold text-slate-800">{lastDate ?? 'None yet'}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
            <BarChart3 className="w-3 h-3" /> Assessments
          </p>
          <p className="text-sm font-bold text-slate-800">{count}</p>
        </div>
      </div>

      {/* CBC Performance */}
      {!isIGCSE && cbcAvg !== null && cbcLevel && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-slate-500 font-medium">Overall Performance</p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cbcLevel.bg} ${cbcLevel.color}`}>
              {cbcLevel.label}
            </span>
          </div>
          {scoreBar(cbcAvg)}
        </div>
      )}

      {/* IGCSE Performance */}
      {isIGCSE && igcseGrade && (
        <div className="mb-4">
          <p className="text-xs text-slate-500 font-medium mb-1.5">Overall Performance</p>
          <div className="flex items-center gap-2">
            <span
              className="text-2xl font-black px-3 py-1 rounded-xl text-white"
              style={{ backgroundColor: igcseGrade.color }}
            >
              {igcseGrade.grade}
            </span>
            <span className="text-sm font-bold text-slate-700">{igcseGrade.label}</span>
          </div>
        </div>
      )}

      {/* Teacher-generated report banner */}
      {report && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-2xl p-4">
          <div className="flex items-start gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-black text-green-800">Report generated by your teacher</p>
              <p className="text-xs text-green-600 mt-0.5">
                {report.term ? `Term ${report.term}, ${report.year}` : new Date(report.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {report.pdf_url ? (
              <>
                <a
                  href={report.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 bg-green-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-green-700 transition"
                >
                  <FileText className="w-3.5 h-3.5" /> View Report
                </a>
                <a
                  href={report.pdf_url}
                  download
                  className="flex-1 py-2 bg-white border border-green-200 text-green-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-green-50 transition"
                >
                  <ArrowRight className="w-3.5 h-3.5 rotate-90" /> Download PDF
                </a>
              </>
            ) : (
              <Link
                href={`/dashboard/clinic/reports/${student.id}`}
                className="flex-1 py-2 bg-green-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-green-700 transition"
              >
                <Sparkles className="w-3.5 h-3.5" /> View Report
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Teacher-uses-EduNexus info banner (no report yet) */}
      {hasTeacher && !report && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-2xl p-3">
          <div className="flex items-start gap-2">
            <span className="text-base shrink-0">💡</span>
            <p className="text-xs text-blue-800 leading-relaxed">
              <strong>Your child's teacher uses EduNexus.</strong> Ask them to generate your report automatically from class scores, or enter scores yourself below.
            </p>
          </div>
        </div>
      )}

      {/* Actions — hide "Generate Clinical Report" if teacher-generated report exists */}
      <div className="space-y-2">
        <Link
          href={`/dashboard/assessments/history?student_id=${student.id}`}
          className="w-full py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
        >
          <FileText className="w-4 h-4" />
          View History
        </Link>
        {!report && (
          <Link
            href={`/dashboard/assessments/add?student=${student.id}`}
            className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:from-blue-700 hover:to-indigo-700 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            Add Assessment
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        )}
        {!report && (
          count > 0 ? (
            <Link
              href={`/dashboard/clinic/reports/${student.id}`}
              className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:from-violet-700 hover:to-indigo-700 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Generate Clinical Report
            </Link>
          ) : (
            <p className="text-xs text-center text-slate-400 py-2">
              Add an assessment to generate a report
            </p>
          )
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ClinicPage() {
  const router = useRouter()

  const [students,    setStudents]    = useState<Student[]>([])
  const [plan,        setPlan]        = useState<string>('free')
  const [maxStudents, setMaxStudents] = useState<number>(1)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [showModal,   setShowModal]   = useState(false)

  const loadStudents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/students/list')
      if (res.status === 401) { router.push('/login'); return }
      const json = await res.json() as { success: boolean; data: ListResponse; error: string | null }
      if (!json.success) throw new Error(json.error ?? 'Failed to load')

      let students: Student[] = json.data.students

      // Supplement with curriculum_type, year_level, teacher_id and clinic reports
      if (students.length > 0) {
        const supabase = createClient()
        const studentIds = students.map(s => s.id)

        const [extrasResult, reportsResult] = await Promise.all([
          supabase.from('students').select('id, curriculum_type, year_level, teacher_id').in('id', studentIds),
          supabase.from('student_clinic_reports')
            .select('id, student_id, pdf_url, term, year, created_at, whatsapp_sent_at, email_sent_at')
            .in('student_id', studentIds)
            .order('created_at', { ascending: false }),
        ])

        const extrasMap = Object.fromEntries((extrasResult.data ?? []).map(e => [e.id, e]))

        // Latest report per student
        const reportMap: Record<string, ClinicReport> = {}
        for (const r of (reportsResult.data ?? [])) {
          if (!reportMap[r.student_id]) reportMap[r.student_id] = r as ClinicReport
        }

        students = students.map(s => ({
          ...s,
          curriculum_type: extrasMap[s.id]?.curriculum_type ?? 'cbc',
          year_level:      extrasMap[s.id]?.year_level      ?? null,
          teacher_id:      extrasMap[s.id]?.teacher_id      ?? null,
          clinicReport:    reportMap[s.id] ?? null,
        }))
      }

      setStudents(students)
      setPlan(json.data.plan)
      setMaxStudents(json.data.maxStudents)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { loadStudents() }, [loadStudents])

  const canAddMore = students.length < maxStudents

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">

      {/* Ambient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-20 right-20 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-violet-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 rounded-xl blur-md opacity-50" />
              <div className="relative w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900">Academic Clinic</h1>
              <p className="text-sm text-slate-500">
                Deep insights for your child's CBC & IGCSE journey
              </p>
            </div>
          </div>

          {/* Curriculum support badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold px-2 py-1 bg-green-100 text-green-700 rounded-full">🇰🇪 CBC</span>
            <span className="text-xs font-bold px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full">🌍 IGCSE</span>
          </div>
        </div>

        {/* Add Student button */}
        <div className="flex justify-end">
          {canAddMore ? (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              <PlusCircle className="w-5 h-5" />
              Add Student
            </button>
          ) : (
            <Link
              href="/pricing"
              className="flex items-center gap-2 px-6 py-3 bg-amber-100 text-amber-800 rounded-2xl font-bold border-2 border-amber-200 hover:bg-amber-200 transition-colors"
            >
              <Zap className="w-5 h-5" />
              Upgrade to add more
            </Link>
          )}
        </div>

        {/* ── Plan badge ── */}
        <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm w-fit">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <span className="text-sm font-bold text-slate-700 capitalize">{plan} plan</span>
          <span className="text-sm text-slate-400">·</span>
          <span className="text-sm text-slate-500">{students.length}/{maxStudents} student{maxStudents !== 1 ? 's' : ''}</span>
        </div>

        {/* ── Loading ── */}
        {loading && <StudentCardsSkeleton />}

        {/* ── Error ── */}
        {error && !loading && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* ── Students grid ── */}
        {!loading && !error && students.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Your Students
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {students.map(s => <StudentCard key={s.id} student={s} />)}
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && !error && students.length === 0 && (
          <NoStudentsEmpty onAddStudent={() => setShowModal(true)} />
        )}

        {/* ── Upgrade banner when limit reached ── */}
        {!loading && !canAddMore && students.length > 0 && plan !== 'admin' && (
          <div className="flex items-center justify-between gap-4 p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm font-bold text-amber-800">
                You've reached your {plan} plan limit ({maxStudents} student{maxStudents !== 1 ? 's' : ''}).
              </p>
            </div>
            <Link href="/pricing" className="px-4 py-2 bg-amber-600 text-white rounded-xl font-bold text-sm hover:bg-amber-700 transition-colors whitespace-nowrap">
              Upgrade Plan
            </Link>
          </div>
        )}

        {/* ── What's in the clinic ── */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-8 text-white shadow-2xl">
          <h3 className="text-2xl font-black mb-2 flex items-center gap-2">
            <Sparkles className="w-6 h-6" />
            What's in the Academic Clinic?
          </h3>
          <p className="text-indigo-200 mb-6 text-sm">
            Everything you need to understand and support your child's CBC & IGCSE journey.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Brain,      title: 'Deep Analysis',      desc: 'Subject-by-subject breakdown with learning patterns and trends' },
              { icon: Target,     title: 'Pathway Guidance',   desc: 'Junior students: which senior pathway fits best (CBC & IGCSE)'  },
              { icon: TrendingUp, title: 'Career Matching',    desc: 'Senior students: honest career recommendations'                 },
              { icon: Share2,     title: 'Share with Teacher', desc: "Send reports via WhatsApp directly to your child's teacher"     },
            ].map((f, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <h4 className="font-black mb-1">{f.title}</h4>
                <p className="text-xs text-indigo-200 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-indigo-700 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors"
            >
              <Zap className="w-4 h-4" />
              View plans
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

      </div>

      {/* ── Modal ── */}
      {showModal && (
        <AddStudentModal
          onClose={() => setShowModal(false)}
          onSuccess={student => {
            setStudents(prev => [...prev, student])
            setShowModal(false)
          }}
        />
      )}
    </div>
  )
}
