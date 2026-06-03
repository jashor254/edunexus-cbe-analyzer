'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  generateReport,
  formatSubjectName,
  calculateVitals,
  generateActionPlan,
  generateJuniorGuidance,
  generateSeniorGuidance,
} from '@/lib/academicClinic/reportGenerator'
import type {
  AcademicClinicReport,
  SubjectProgress,
  StudentProfile,
} from '@/lib/academicClinic/types'
import {
  FileText,
  Download,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  AlertCircle,
  Target,
  Sparkles,
  ChevronDown,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student {
  id: string
  name: string
  grade: number
  school: string | null
  current_pathway: string | null
}

interface Assessment {
  subject_scores: Record<string, number>
  grade: number
  created_at: string
  term?: number
  year?: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calculateTrend(
  subject: string,
  assessments: Assessment[],
): 'improving' | 'declining' | 'stable' {
  const scores = assessments
    .map((a) => (a.subject_scores as Record<string, number>)[subject])
    .filter((s): s is number => s !== undefined && s !== null)
  if (scores.length < 2) return 'stable'
  const first = scores[scores.length - 1]
  const last = scores[0]
  if (last > first) return 'improving'
  if (last < first) return 'declining'
  return 'stable'
}

function buildSubjects(assessments: Assessment[]): SubjectProgress[] {
  const latestScores = assessments[0]?.subject_scores || {}
  return Object.entries(latestScores).map(([subject, score]) => ({
    subject,
    displayName: formatSubjectName(subject),
    level: Math.max(1, Math.min(4, Math.round(score as number))) as 1 | 2 | 3 | 4,
    trend: calculateTrend(subject, assessments),
    velocity: 0,
    previousScores: assessments
      .map((a) => (a.subject_scores as Record<string, number>)[subject])
      .filter((s): s is number => s !== undefined && s !== null),
  }))
}

// ─── Trajectory badge ─────────────────────────────────────────────────────────

const TRAJECTORY_STYLES: Record<string, string> = {
  IMPROVING: 'bg-green-100 text-green-800',
  STABLE: 'bg-blue-100 text-blue-800',
  'NEEDS ATTENTION': 'bg-amber-100 text-amber-800',
  CRITICAL: 'bg-red-100 text-red-800',
}

const TRAJECTORY_ICONS: Record<string, React.ReactNode> = {
  IMPROVING: <TrendingUp className="w-4 h-4" />,
  STABLE: <Minus className="w-4 h-4" />,
  'NEEDS ATTENTION': <TrendingDown className="w-4 h-4" />,
  CRITICAL: <AlertCircle className="w-4 h-4" />,
}

// ─── Level colours ────────────────────────────────────────────────────────────

const LEVEL_STYLES: Record<number, string> = {
  1: 'bg-red-100 text-red-800 border-red-200',
  2: 'bg-amber-100 text-amber-800 border-amber-200',
  3: 'bg-green-100 text-green-800 border-green-200',
  4: 'bg-purple-100 text-purple-800 border-purple-200',
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'Emerging',
  2: 'Developing',
  3: 'Proficient',
  4: 'Exemplary',
}

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

// ─── Component ───────────────────────────────────────────────────────────────

export default function AcademicClinicPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [selectedTerm, setSelectedTerm] = useState<1 | 2 | 3>(1)
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR)
  const [generating, setGenerating] = useState(false)
  const [report, setReport] = useState<AcademicClinicReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  // ── Fetch students on mount
  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('Please log in to access the Academic Clinic.')
        setLoading(false)
        return
      }

      const { data, error: fetchErr } = await supabase
        .from('students')
        .select('id, name, grade, school, current_pathway')
        .eq('user_id', user.id)
        .order('name')

      if (fetchErr) {
        setError('Could not load student profiles.')
      } else {
        setStudents(data || [])
        if (data && data.length > 0) setSelectedStudentId(data[0].id)
      }
      setLoading(false)
    }
    load()
  }, [])

  const selectedStudent = students.find((s) => s.id === selectedStudentId)

  // ── Generate report
  async function handleGenerate() {
    if (!selectedStudent) return
    setGenerating(true)
    setReport(null)
    setError(null)

    try {
      const { data: assessments, error: fetchErr } = await supabase
        .from('assessments')
        .select('subject_scores, grade, created_at, term, year')
        .eq('student_id', selectedStudentId)
        .order('created_at', { ascending: false })
        .limit(5)

      if (fetchErr || !assessments || assessments.length === 0) {
        setError('No assessments found for this student. Add an assessment first.')
        setGenerating(false)
        return
      }

      const subjects = buildSubjects(assessments as Assessment[])

      if (subjects.length === 0) {
        setError('Assessment data has no subject scores. Check the assessment records.')
        setGenerating(false)
        return
      }

      const currentGrade = assessments[0]?.grade || selectedStudent.grade
      const firstName = selectedStudent.name.split(' ')[0]
      const isJunior = currentGrade <= 9

      const studentProfile: StudentProfile = {
        id: selectedStudent.id,
        name: selectedStudent.name,
        grade: currentGrade,
        level: isJunior ? 'Junior School' : 'Senior School',
        term: selectedTerm,
        year: selectedYear,
        pathway: selectedStudent.current_pathway,
        school: selectedStudent.school,
      }

      const vitals = calculateVitals(subjects)
      const actionPlan = generateActionPlan(subjects)
      const guidance = isJunior
        ? generateJuniorGuidance(subjects)
        : generateSeniorGuidance(subjects, firstName, currentGrade)

      const generated = generateReport(
        studentProfile,
        subjects,
        vitals,
        actionPlan,
        assessments,
        isJunior ? (guidance as any) : undefined,
        !isJunior ? (guidance as any) : undefined,
      )

      setReport(generated)
    } catch (err) {
      setError('An unexpected error occurred while generating the report.')
      console.error(err)
    } finally {
      setGenerating(false)
    }
  }

  // ── Download PDF
  async function handleDownload() {
    if (!report) return
    setDownloading(true)
    try {
      const res = await fetch('/api/academic-clinic/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report }),
      })

      if (!res.ok) {
        setError('PDF generation failed. Please try again.')
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Academic_Clinic_${report.studentProfile.name.replace(/\s+/g, '_')}_Term${report.studentProfile.term}_${report.studentProfile.year}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError('Failed to download PDF.')
      console.error(err)
    } finally {
      setDownloading(false)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-[#1a2744] text-white">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm font-semibold tracking-widest uppercase text-blue-300">
              EduNexus
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight">Academic Clinic</h1>
          <p className="text-blue-200 mt-1 text-sm">
            Personalised clinical academic report — CBC aligned
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Student info + selectors */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5">
          <h2 className="font-bold text-slate-800 text-lg">Report Setup</h2>

          {/* Student selector */}
          {students.length === 0 ? (
            <div className="text-slate-500 text-sm bg-slate-50 rounded-xl p-4">
              No student profiles found. Add a student from the dashboard first.
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Student
              </label>
              <div className="relative">
                <select
                  value={selectedStudentId}
                  onChange={(e) => {
                    setSelectedStudentId(e.target.value)
                    setReport(null)
                    setError(null)
                  }}
                  className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — Grade {s.grade}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>

              {selectedStudent && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
                    Grade {selectedStudent.grade}
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 text-xs font-semibold px-3 py-1 rounded-full">
                    {selectedStudent.grade <= 9 ? 'Junior School' : 'Senior School'}
                  </span>
                  {selectedStudent.school && (
                    <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 text-xs font-semibold px-3 py-1 rounded-full">
                      {selectedStudent.school}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Term + Year selectors */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Term
              </label>
              <div className="flex gap-2">
                {([1, 2, 3] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setSelectedTerm(t)
                      setReport(null)
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                      selectedTerm === t
                        ? 'bg-[#1a2744] text-white border-[#1a2744]'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    T{t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Year
              </label>
              <div className="relative">
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(Number(e.target.value))
                    setReport(null)
                  }}
                  className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-medium text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!selectedStudentId || generating}
            className="w-full flex items-center justify-center gap-2 bg-[#1a2744] hover:bg-[#243358] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-colors"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating your clinical report...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Academic Report
              </>
            )}
          </button>
        </div>

        {/* Report preview */}
        {report && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Preview header */}
            <div className="bg-gradient-to-r from-[#1a2744] to-[#243358] px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest mb-1">
                    Academic Clinic Report
                  </p>
                  <h3 className="text-xl font-black">{report.studentProfile.name}</h3>
                  <p className="text-blue-200 text-sm mt-0.5">
                    Grade {report.studentProfile.grade} · Term {report.studentProfile.term} ·{' '}
                    {report.studentProfile.year}
                  </p>
                </div>
                <span className="text-xs text-blue-300 font-mono">{report.reportId}</span>
              </div>
            </div>

            {/* Key stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100">
              {/* Overall level */}
              <div className="p-5 flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" />
                  Overall Level
                </span>
                <span
                  className={`mt-1 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                    LEVEL_STYLES[report.clinicalOverview.overallCompetencyLevel]
                  }`}
                >
                  L{report.clinicalOverview.overallCompetencyLevel} —{' '}
                  {LEVEL_LABELS[report.clinicalOverview.overallCompetencyLevel]}
                </span>
                <span className="text-2xl font-black text-slate-800 mt-1">
                  {report.vitals.overallAverage}
                  <span className="text-sm font-semibold text-slate-400">/4.0</span>
                </span>
              </div>

              {/* Trajectory */}
              <div className="p-5 flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Trajectory
                </span>
                <span
                  className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    TRAJECTORY_STYLES[report.clinicalOverview.trajectory] ?? 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {TRAJECTORY_ICONS[report.clinicalOverview.trajectory]}
                  {report.clinicalOverview.trajectory}
                </span>
              </div>

              {/* Strengths */}
              <div className="p-5 flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Strengths
                </span>
                <span className="text-3xl font-black text-green-600 mt-1">
                  {report.vitals.strengths}
                </span>
                <span className="text-xs text-slate-500">
                  subject{report.vitals.strengths !== 1 ? 's' : ''} at L3–L4
                </span>
              </div>

              {/* Priority areas */}
              <div className="p-5 flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />
                  Priority Areas
                </span>
                <span className="text-3xl font-black text-red-500 mt-1">
                  {report.vitals.urgent + report.vitals.needsWork}
                </span>
                <span className="text-xs text-slate-500">
                  subject{report.vitals.urgent + report.vitals.needsWork !== 1 ? 's' : ''} needing
                  support
                </span>
              </div>
            </div>

            {/* Clinical paragraph preview */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Clinical Assessment
              </p>
              <p className="text-sm text-slate-700 leading-relaxed line-clamp-3">
                {report.clinicalOverview.clinicalParagraph}
              </p>
            </div>

            {/* Subject breakdown preview */}
            {report.subjectBreakdown.length > 0 && (
              <div className="px-6 py-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Subject Snapshot
                </p>
                <div className="flex flex-wrap gap-2">
                  {report.subjectBreakdown.map((s) => (
                    <span
                      key={s.subject}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        LEVEL_STYLES[s.level]
                      }`}
                    >
                      {s.displayName}
                      <span className="opacity-70">L{s.level}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Download button */}
            <div className="px-6 py-5 border-t border-slate-100">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-colors"
              >
                {downloading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Preparing PDF...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Download Full Clinical Report (PDF)
                  </>
                )}
              </button>
              <p className="text-center text-xs text-slate-400 mt-2">
                7-page report · CBC aligned · EduNexus Academic Clinic
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
