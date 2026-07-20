'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Users,
  FileText,
  Compass,
  ClipboardList,
  BarChart3,
  Search,
  TrendingUp,
  PlusCircle,
  X,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Zap,
  Sparkles,
  Shield,
  Trash2,
  ArrowUpRight,
  Star,
} from 'lucide-react'
import type { CompassActivityResult, CompassActivitySession } from '@/app/api/parent/compass-activity/route'
import { NoStudentsEmpty } from '@/components/ui/empty-states'
import {
  SENIOR_PATHWAYS,
  SENIOR_PATHWAY_ELECTIVES,
  getSeniorCompulsorySubjects,
  validateSeniorSubjects,
  type SeniorPathway,
} from '@/lib/curriculum/subjects'
import { friendlyMessage } from '@/lib/errors/friendlyMessage'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  studentsCount: number
  assessmentsCount: number
  sessionsCount: number
  subscription: { plan: string; expiresAt: string } | null
  tokenBalance: number
  pendingAssignments: number
  isAdmin: boolean
  hasTeacherAccount: boolean
  teacherStudentsCount: number
  teacherAssignmentsCount: number
}

interface Assessment {
  id: string
  term: number
  year: number
  grade: number
  subject_scores: Record<string, number>
  created_at: string
}

interface Student {
  id: string
  name: string
  grade: number
  school: string | null
  current_pathway: string | null
  curriculum_type: 'cbc' | 'igcse' | 'ib' | 'other'
  created_at: string
  assessments: Assessment[]
  teacherManaged: boolean  // true = Scenario B (teacher-created, parent linked via invite)
}

interface Assignment {
  id: string
  title: string
  subject: string
  topic: string
  instructions: string
  due_date: string
  type: string
  is_compass_guided: boolean
  daysLeft: number
  isOverdue: boolean
  submissionStatus: string
  teachers?: { full_name: string }
  teacher_classes?: { name: string; grade: number; subject: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'kariukidennis092@gmail.com'

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function getGreetingEmoji(): string {
  const h = new Date().getHours()
  if (h < 12) return '☀️'
  if (h < 17) return '👋'
  return '🌙'
}

function cbcLevelLabel(avg: number): { label: string; color: string; border: string } {
  if (avg >= 3.5) return { label: 'Exceeding (EE)', color: 'text-purple-600', border: 'border-l-purple-500' }
  if (avg >= 2.5) return { label: 'Meets (ME)', color: 'text-green-600', border: 'border-l-green-500' }
  if (avg >= 1.5) return { label: 'Approaching (AE)', color: 'text-amber-600', border: 'border-l-amber-500' }
  return { label: 'Below (BE)', color: 'text-red-600', border: 'border-l-red-500' }
}

function cbcLevelBadge(avg: number): string {
  if (avg >= 3.5) return 'bg-purple-100 text-purple-700'
  if (avg >= 2.5) return 'bg-green-100 text-green-700'
  if (avg >= 1.5) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function igcseGradeColor(grade: string): { color: string; border: string } {
  if (grade === 'A*' || grade === 'A') return { color: 'text-purple-600', border: 'border-l-purple-500' }
  if (grade === 'B') return { color: 'text-green-600', border: 'border-l-green-500' }
  if (grade === 'C') return { color: 'text-blue-600', border: 'border-l-blue-500' }
  if (grade === 'D' || grade === 'E') return { color: 'text-amber-600', border: 'border-l-amber-500' }
  return { color: 'text-red-600', border: 'border-l-red-500' }
}

function getStudentSummary(student: Student): {
  label: string
  colorClass: string
  borderClass: string
  badgeClass: string
  pct: number
} {
  const latest = student.assessments?.[0]
  if (!latest || !latest.subject_scores || Object.keys(latest.subject_scores).length === 0) {
    return { label: 'No data', colorClass: 'text-slate-400', borderClass: 'border-l-slate-300', badgeClass: 'bg-slate-100 text-slate-500', pct: 0 }
  }

  if (student.curriculum_type === 'igcse') {
    const scores = Object.values(latest.subject_scores) as number[]
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    // IGCSE: scores stored as 1-7 (7=A*, 1=G)
    const gradeMap: Record<number, string> = { 7: 'A*', 6: 'A', 5: 'B', 4: 'C', 3: 'D', 2: 'E', 1: 'F' }
    const rounded = Math.round(avg)
    const grade = gradeMap[rounded] || 'C'
    const { color, border } = igcseGradeColor(grade)
    return { label: grade, colorClass: color, borderClass: border, badgeClass: 'bg-blue-100 text-blue-700', pct: (avg / 7) * 100 }
  }

  // CBC: 1–4
  const scores = Object.values(latest.subject_scores) as number[]
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  const { label, color, border } = cbcLevelLabel(avg)
  return { label, colorClass: color, borderClass: border, badgeClass: cbcLevelBadge(avg), pct: (avg / 4) * 100 }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function planDisplayName(plan: string): string {
  const names: Record<string, string> = { term: 'Term Plan', premium: 'Premium', school: 'School Plan', admin: 'Admin' }
  return names[plan] || plan
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-xl ${className ?? ''}`} />
}

// ─── Add Student Modal ────────────────────────────────────────────────────────
// Two-scenario modal:
//   Scenario A — parent creates student independently (no teacher involved)
//   Scenario B — teacher already created student, parent links via invite

const CBC_GRADES = [7, 8, 9, 10, 11, 12]
const IGCSE_YEARS = [7, 8, 9, 10, 11]

type ModalStep = 'choose' | 'create' | 'invite_info'

function AddStudentModal({
  onClose,
  onSuccess,
  hasTeacherManagedStudents,
}: {
  onClose: () => void
  onSuccess: () => void
  hasTeacherManagedStudents: boolean
}) {
  const [step, setStep] = useState<ModalStep>(hasTeacherManagedStudents ? 'choose' : 'choose')
  const [name, setName] = useState('')
  const [curriculum, setCurriculum] = useState<'cbc' | 'igcse'>('cbc')
  const [grade, setGrade] = useState(7)
  const [school, setSchool] = useState('')
  const [pathway, setPathway] = useState<SeniorPathway | ''>('')
  const [electives, setElectives] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const gradeOptions = curriculum === 'igcse' ? IGCSE_YEARS : CBC_GRADES
  const isSenior = grade >= 10 && curriculum === 'cbc'

  // Reset grade when curriculum changes
  useEffect(() => {
    setGrade(curriculum === 'igcse' ? 7 : 7)
  }, [curriculum])

  function handleGradeChange(g: number) {
    setGrade(g)
    if (g < 10) { setPathway(''); setElectives([]) }
  }

  function handlePathwayChange(p: SeniorPathway | '') {
    setPathway(p)
    setElectives([])
  }

  function toggleElective(subject: string) {
    setElectives(prev => {
      if (prev.includes(subject)) return prev.filter(e => e !== subject)
      if (prev.length >= 3) return prev
      return [...prev, subject]
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Student name is required'); return }
    if (isSenior) {
      if (!pathway) { setError('Please select a pathway for Grade 10–12 students'); return }
      const v = validateSeniorSubjects(pathway as SeniorPathway, electives)
      if (!v.valid) { setError(v.error ?? 'Invalid subject selection'); return }
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/students/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          grade,
          school: school.trim() || null,
          curriculum_type: curriculum,
          ...(isSenior && pathway ? {
            current_pathway:   pathway,
            selected_subjects: [
              ...getSeniorCompulsorySubjects(pathway as SeniorPathway),
              ...electives,
            ],
          } : {}),
        }),
      })
      const json = await res.json()
      if (!json.success) { setError(json.error || 'Failed to add student'); setLoading(false); return }
      onSuccess()
      onClose()
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-y-auto max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            {step !== 'choose' && (
              <button
                onClick={() => setStep('choose')}
                className="text-slate-400 hover:text-slate-600 transition-colors mr-1"
              >
                ←
              </button>
            )}
            <h2 className="text-xl font-black text-slate-900">
              {step === 'choose' ? 'Add a Student' : step === 'create' ? 'Add Independently' : 'Link via Teacher Invite'}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Step 1: Choose scenario ── */}
        {step === 'choose' && (
          <div className="p-6 space-y-4">
            {hasTeacherManagedStudents && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                You already have a child linked through their teacher. Adding another student here is for a <strong>different child</strong> not yet on EduNexus.
              </div>
            )}
            <p className="text-slate-600 text-sm">How is your child enrolled with EduNexus?</p>

            <button
              onClick={() => setStep('invite_info')}
              className="w-full text-left p-4 rounded-2xl border-2 border-teal-200 bg-teal-50 hover:border-teal-400 hover:bg-teal-100 transition-all group"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">🏫</span>
                <div>
                  <p className="font-black text-slate-900 text-sm">Through their school or teacher</p>
                  <p className="text-xs text-slate-500 mt-0.5">Their teacher manages assessments on EduNexus — you just need an invite link from the teacher to connect.</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setStep('create')}
              className="w-full text-left p-4 rounded-2xl border-2 border-violet-200 bg-violet-50 hover:border-violet-400 hover:bg-violet-100 transition-all group"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">🏠</span>
                <div>
                  <p className="font-black text-slate-900 text-sm">No teacher on EduNexus yet</p>
                  <p className="text-xs text-slate-500 mt-0.5">You manage your child's assessments yourself — home schooling, tuition, or the school isn't on EduNexus.</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* ── Step 2A: Invite info (Scenario B) ── */}
        {step === 'invite_info' && (
          <div className="p-6 space-y-5">
            <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 font-black text-teal-800">
                <span className="text-xl">✅</span> How it works
              </div>
              <ol className="space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-teal-500 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-black">1</span>
                  Ask your child&apos;s teacher to share the <strong>EduNexus invite link</strong> for your child.
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-teal-500 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-black">2</span>
                  The teacher generates it from their portal: <span className="font-mono text-xs bg-white border border-teal-200 px-1.5 py-0.5 rounded">Teacher Portal → Class → Students → Share Invite</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-teal-500 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-black">3</span>
                  Click the link while logged in here — your account links to your child automatically. No duplicate needed!
                </li>
              </ol>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-500">
              <strong className="text-slate-700">Why not just add the student yourself?</strong> The teacher&apos;s student record already has their assessments, class, and learning profile. Creating a duplicate here would lose all that data and show a blank compass.
            </div>
            <button
              onClick={onClose}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-xl font-black transition-colors"
            >
              Got it — I&apos;ll ask the teacher
            </button>
          </div>
        )}

        {/* ── Step 2B: Create independently (Scenario A) ── */}
        {step === 'create' && (
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-black text-slate-700 mb-1.5">Student Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Grace Wanjiku"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          {/* Curriculum */}
          <div>
            <label className="block text-sm font-black text-slate-700 mb-2">Curriculum</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCurriculum('cbc')}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  curriculum === 'cbc'
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="text-xl mb-1">🇰🇪</div>
                <div className="font-black text-sm text-slate-900">CBC Kenya</div>
                <div className="text-xs text-slate-500">Grade 7–12</div>
              </button>
              <button
                type="button"
                onClick={() => setCurriculum('igcse')}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  curriculum === 'igcse'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="text-xl mb-1">🌍</div>
                <div className="font-black text-sm text-slate-900">Cambridge IGCSE</div>
                <div className="text-xs text-slate-500">Year 7–11</div>
              </button>
            </div>
          </div>

          {/* Grade/Year */}
          <div>
            <label className="block text-sm font-black text-slate-700 mb-1.5">
              {curriculum === 'igcse' ? 'Year' : 'Grade'}
            </label>
            <select
              value={grade}
              onChange={e => handleGradeChange(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            >
              {gradeOptions.map(g => (
                <option key={g} value={g}>
                  {curriculum === 'igcse' ? `Year ${g}` : `Grade ${g}`}
                </option>
              ))}
            </select>
          </div>

          {/* Senior School Pathway — Grade 10-12 CBC only */}
          {isSenior && (
            <div className="border-t border-slate-100 pt-4 space-y-4">
              <p className="text-xs font-black text-slate-500 uppercase tracking-wide">Senior School Pathway</p>

              {/* Pathway selector */}
              <div>
                <label className="block text-sm font-black text-slate-700 mb-1.5">
                  Pathway <span className="text-red-500">*</span>
                </label>
                <select
                  value={pathway}
                  onChange={e => handlePathwayChange(e.target.value as SeniorPathway | '')}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                >
                  <option value="">Select pathway…</option>
                  {SENIOR_PATHWAYS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Compulsory subjects — read-only */}
              {pathway && (
                <div>
                  <label className="block text-sm font-black text-slate-700 mb-1.5">
                    Compulsory Subjects
                    <span className="ml-2 text-xs font-normal text-slate-400">automatic</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {getSeniorCompulsorySubjects(pathway as SeniorPathway).map(s => (
                      <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Elective selection */}
              {pathway && (
                <div>
                  <label className="block text-sm font-black text-slate-700 mb-1.5">
                    Elective Subjects
                    <span className={`ml-2 text-xs font-${electives.length === 3 ? 'black' : 'normal'} ${electives.length === 3 ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {electives.length} / 3 selected{electives.length === 3 ? ' ✓' : ''}
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {SENIOR_PATHWAY_ELECTIVES[pathway as SeniorPathway].map(subject => {
                      const selected = electives.includes(subject)
                      const maxed    = !selected && electives.length >= 3
                      return (
                        <button
                          key={subject}
                          type="button"
                          onClick={() => toggleElective(subject)}
                          disabled={maxed}
                          className={[
                            'text-xs px-2.5 py-1 rounded-full border font-medium transition-all',
                            selected
                              ? 'bg-violet-600 border-violet-600 text-white'
                              : maxed
                              ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-violet-400 hover:text-violet-700',
                          ].join(' ')}
                        >
                          {subject}
                        </button>
                      )
                    })}
                  </div>
                  {electives.length < 3 && (
                    <p className="text-xs text-slate-400 mt-2">Choose exactly 3 electives from the {pathway} pathway</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* School */}
          <div>
            <label className="block text-sm font-black text-slate-700 mb-1.5">
              School <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={school}
              onChange={e => setSchool(e.target.value)}
              placeholder="e.g. Nairobi School"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {friendlyMessage(error).message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-linear-to-r from-violet-600 to-purple-600 text-white py-3.5 rounded-xl font-black hover:scale-[1.02] transition-all disabled:opacity-60 disabled:scale-100"
          >
            {loading ? 'Adding...' : 'Add Student'}
          </button>
        </form>
        )}

      </div>
    </div>
  )
}

// ─── Student Card ─────────────────────────────────────────────────────────────

function StudentCard({
  student,
  onRemoved,
}: {
  student: Student
  onRemoved: () => void
}) {
  const summary = getStudentSummary(student)
  const latest = student.assessments?.[0]
  const isCbc = student.curriculum_type !== 'igcse'
  const [removing, setRemoving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function handleRemove() {
    setRemoving(true)
    try {
      const method = student.teacherManaged ? 'PATCH' : 'DELETE'
      const res = await fetch(`/api/students/${student.id}`, { method })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      onRemoved()
    } catch {
      setRemoving(false)
      setConfirmOpen(false)
    }
  }

  return (
    <div className={`bg-white border border-slate-200 border-l-4 ${summary.borderClass} rounded-2xl p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all relative`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-black text-slate-900 text-base">{student.name}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {isCbc ? (
              <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                🇰🇪 CBC · Grade {student.grade}
              </span>
            ) : (
              <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                🌍 IGCSE · Year {student.grade}
              </span>
            )}
            {student.teacherManaged && (
              <span className="text-xs font-bold bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
                🏫 via teacher
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {summary.label !== 'No data' && (
            <span className={`text-xs font-black px-2.5 py-1 rounded-xl ${summary.badgeClass}`}>
              {summary.label}
            </span>
          )}
          <button
            onClick={() => setConfirmOpen(true)}
            className="text-slate-300 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-50"
            title={student.teacherManaged ? 'Unlink from teacher' : 'Remove student'}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Latest assessment */}
      {latest ? (
        <div className="mb-4">
          <p className="text-xs text-slate-500 mb-1.5">
            Last: Term {latest.term}, {latest.year}
          </p>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all"
              style={{ width: `${Math.min(100, Math.max(4, summary.pct))}%` }}
            />
          </div>
          <p className={`text-xs font-bold mt-1 ${summary.colorClass}`}>
            {isCbc ? `Level avg · ${summary.label}` : `Avg grade · ${summary.label}`}
          </p>
        </div>
      ) : (
        <div className="mb-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-400 text-center">
          No assessments yet
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {student.teacherManaged ? (
          <span className="text-xs font-bold bg-teal-50 text-teal-600 px-3 py-1.5 rounded-lg flex items-center gap-1">
            🏫 Teacher adds assessments
          </span>
        ) : (
          <Link
            href={`/dashboard/assessments/add?student=${student.id}`}
            className="text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Add Assessment
          </Link>
        )}
        <Link
          href={`/learn?student=${student.id}`}
          className="text-xs font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
        >
          <Compass className="w-3.5 h-3.5" /> Compass
        </Link>
        <Link
          href={`/dashboard/assessments/history?student=${student.id}`}
          className="text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
        >
          <TrendingUp className="w-3.5 h-3.5" /> History
        </Link>
      </div>

      {/* Teacher invite nudge — only for Scenario A (no teacher linked) */}
      {!student.teacherManaged && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-start gap-2.5">
          <span className="text-base shrink-0 mt-0.5">👩‍🏫</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-800 leading-snug mb-1">
              {student.name}&apos;s teacher isn&apos;t on EduNexus yet
            </p>
            <p className="text-[11px] text-amber-700/70 leading-snug mb-2">
              When they join, the Compass aligns with what&apos;s being taught in class and you get instant assessment alerts.
            </p>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `Hi! I'm using EduNexus for ${student.name} — it's an AI learning platform for CBC students that gives personalised tutoring and clinical performance reports.\n\nWhen their teacher is on EduNexus too, the platform aligns directly with what's being taught in class and I get notified the moment work is marked.\n\nWould you consider joining? It's completely free for teachers:\nhttps://edunexus.co.ke/signup?role=teacher\n\nThank you! 🙏`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-black text-green-700 bg-green-100 hover:bg-green-200 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Invite teacher via WhatsApp
            </a>
          </div>
        </div>
      )}

      {/* Confirm remove/unlink dialog */}
      {confirmOpen && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6 z-10 text-center">
          <Trash2 className="w-8 h-8 text-red-400 mb-3" />
          <p className="font-black text-slate-900 text-sm mb-1">
            {student.teacherManaged ? 'Unlink from teacher?' : 'Remove student?'}
          </p>
          <p className="text-xs text-slate-500 mb-5">
            {student.teacherManaged
              ? `You'll stop seeing ${student.name}'s updates. The teacher's record stays intact.`
              : `This permanently deletes ${student.name} and all their assessments.`}
          </p>
          <div className="flex gap-3 w-full">
            <button
              onClick={() => setConfirmOpen(false)}
              disabled={removing}
              className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-black hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRemove}
              disabled={removing}
              className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-black transition-colors disabled:opacity-60"
            >
              {removing ? 'Removing…' : student.teacherManaged ? 'Unlink' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [userEmail, setUserEmail] = useState<string>('')
  const [userName, setUserName] = useState<string>('')

  const [statsLoading, setStatsLoading] = useState(true)
  const [studentsLoading, setStudentsLoading] = useState(true)
  const [assignmentsLoading, setAssignmentsLoading] = useState(true)

  const [statsError, setStatsError] = useState('')
  const [studentsError, setStudentsError] = useState('')

  const [showAddModal, setShowAddModal]   = useState(false)
  const [selfCreatedCount, setSelfCreatedCount] = useState(0)
  const [compassActivity,  setCompassActivity]  = useState<CompassActivityResult | null>(null)
  const [compassLoading,   setCompassLoading]   = useState(true)

  // ── Fetch user identity (from Supabase client) ────────────────────────────
  useEffect(() => {
    import('@/utils/supabase/client').then(({ createClient }) => {
      const sb = createClient()
      sb.auth.getUser().then(({ data: { user } }) => {
        if (!user) return
        setUserEmail(user.email ?? '')
        const meta = user.user_metadata
        const full: string = meta?.full_name || meta?.name || ''
        setUserName(full ? full.split(' ')[0] : (user.email ?? '').split('@')[0])
      })
    })
  }, [])

  // ── Fetch stats ───────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    setStatsError('')
    try {
      const res = await fetch('/api/dashboard/stats')
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setStats(json.data)
    } catch {
      setStatsError('Could not load stats.')
    } finally {
      setStatsLoading(false)
    }
  }, [])

  // ── Fetch students ────────────────────────────────────────────────────────
  const fetchStudents = useCallback(async () => {
    setStudentsLoading(true)
    setStudentsError('')
    try {
      const res = await fetch('/api/students/list')
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      // Sort assessments newest first per student
      const sorted: Student[] = (json.data.students ?? []).map((s: Student) => ({
        ...s,
        assessments: [...(s.assessments ?? [])].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
      }))
      setStudents(sorted)
      setSelfCreatedCount(json.data.selfCreatedCount ?? 0)
    } catch {
      setStudentsError('Could not load students.')
    } finally {
      setStudentsLoading(false)
    }
  }, [])

  // ── Fetch Compass activity for parent ────────────────────────────────────
  const fetchCompassActivity = useCallback(async () => {
    setCompassLoading(true)
    try {
      const res  = await fetch('/api/parent/compass-activity')
      const json = await res.json() as { success: boolean; data?: CompassActivityResult }
      if (json.success && json.data) setCompassActivity(json.data)
    } catch {
      // non-fatal
    } finally {
      setCompassLoading(false)
    }
  }, [])

  // ── Fetch assignments ─────────────────────────────────────────────────────
  const fetchAssignments = useCallback(async () => {
    setAssignmentsLoading(true)
    try {
      const res = await fetch('/api/student/assignments')
      const json = await res.json()
      if (json.success) setAssignments(json.data.assignments ?? [])
    } catch {
      // assignments are optional — fail silently
    } finally {
      setAssignmentsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    fetchStudents()
    fetchAssignments()
    fetchCompassActivity()
  }, [fetchStats, fetchStudents, fetchAssignments, fetchCompassActivity])

  const isAdmin = userEmail === ADMIN_EMAIL || stats?.isAdmin === true

  // Recent assessments (across all students, last 5)
  const recentAssessments = students
    .flatMap(s => (s.assessments ?? []).map(a => ({ ...a, studentName: s.name, curriculumType: s.curriculum_type })))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  // ── Subscription / plan display ────────────────────────────────────────────
  function renderPlanBadge() {
    if (isAdmin) {
      return (
        <span className="text-xs font-black bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded-full">
          👑 Administrator · Unlimited access
        </span>
      )
    }
    if (stats?.subscription) {
      return (
        <span className="text-xs font-black bg-green-100 text-green-700 border border-green-200 px-3 py-1.5 rounded-full">
          <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
          {planDisplayName(stats.subscription.plan)} · Active until {formatDate(stats.subscription.expiresAt)}
        </span>
      )
    }
    if (stats && stats.tokenBalance > 0) {
      return (
        <span className="text-xs font-black bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-full">
          <Zap className="w-3.5 h-3.5 inline mr-1" />
          {stats.tokenBalance} session{stats.tokenBalance !== 1 ? 's' : ''} remaining
        </span>
      )
    }
    return (
      <span className="text-xs font-black bg-slate-100 text-slate-500 border border-slate-200 px-3 py-1.5 rounded-full flex items-center gap-1.5">
        Free account ·{' '}
        <Link href="/pricing" className="text-violet-600 hover:underline">Upgrade</Link>
      </span>
    )
  }

  const showUpgradeBanner =
    !isAdmin &&
    !stats?.subscription &&
    (stats?.tokenBalance ?? 0) < 3

  return (
    <div className="bg-white min-h-screen">

      {/* ── SECTION 0: Admin banner ────────────────────────────────────────── */}
      {isAdmin && (
        <div className="bg-gradient-to-r from-red-900/50 to-orange-900/50 border-b border-red-500/30 py-3 px-6">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <span className="text-red-300 font-black text-sm">
              👑 Admin Mode — {userEmail}
            </span>
            <Link
              href="/admin"
              className="text-xs bg-red-500/20 border border-red-500/30 text-red-300 px-3 py-1.5 rounded-lg font-black hover:bg-red-500/30 transition"
            >
              Open Admin Panel →
            </Link>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── SECTION 1: Personalized greeting ─────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            {userName ? (
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
                {getGreeting()}, {userName}! {getGreetingEmoji()}
              </h1>
            ) : (
              <Skeleton className="h-9 w-64" />
            )}
            <p className="text-slate-500 text-sm mt-1">
              Welcome to your EduNexus dashboard
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 bg-violet-50 border border-violet-200 text-violet-600 px-3 py-1 rounded-full text-xs font-bold">
                <Sparkles className="w-3 h-3" />
                Personalised Learning
              </span>
              <span className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-600 px-3 py-1 rounded-full text-xs font-bold">
                <Shield className="w-3 h-3" />
                You are in control
              </span>
            </div>
          </div>
          <div className="flex-shrink-0">
            {statsLoading ? <Skeleton className="h-8 w-48" /> : renderPlanBadge()}
          </div>
        </div>

        {/* ── SECTION 2: Quick stats ────────────────────────────────────────── */}
        {statsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : statsError ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-center justify-between">
            <span className="text-red-700 text-sm font-bold">{statsError}</span>
            <button onClick={fetchStats} className="text-xs text-red-600 underline font-bold">Retry</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                icon: Users,
                value: stats?.studentsCount ?? 0,
                label: 'Students',
                color: 'text-violet-600',
                bg: 'bg-violet-50',
                border: 'border-violet-100',
                extra: stats?.studentsCount === 0 && (
                  <button onClick={() => setShowAddModal(true)} className="text-xs text-violet-600 hover:underline font-bold mt-1">Add student</button>
                ),
              },
              {
                icon: FileText,
                value: stats?.assessmentsCount ?? 0,
                label: 'Assessments',
                color: 'text-blue-600',
                bg: 'bg-blue-50',
                border: 'border-blue-100',
              },
              {
                icon: Compass,
                value: stats?.sessionsCount ?? 0,
                label: 'Compass Sessions',
                color: 'text-amber-600',
                bg: 'bg-amber-50',
                border: 'border-amber-100',
              },
              {
                icon: ClipboardList,
                value: stats?.pendingAssignments ?? 0,
                label: 'Pending Assignments',
                color: stats?.pendingAssignments ? 'text-pink-600' : 'text-slate-400',
                bg: stats?.pendingAssignments ? 'bg-pink-50' : 'bg-slate-50',
                border: stats?.pendingAssignments ? 'border-pink-100' : 'border-slate-100',
              },
            ].map(({ icon: Icon, value, label, color, bg, border, extra }, i) => (
              <div key={i} className={`${bg} border ${border} rounded-2xl p-5 flex flex-col`}>
                <div className={`w-9 h-9 ${bg} border ${border} rounded-xl flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div className={`text-3xl font-black ${color}`}>{value}</div>
                <div className="text-xs font-bold text-slate-500 mt-0.5">{label}</div>
                {extra ?? null}
              </div>
            ))}
          </div>
        )}

        {/* ── SECTION 3: Teacher portal banner ─────────────────────────────── */}
        {stats?.hasTeacherAccount && (
          <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center text-lg">
                👨‍🏫
              </div>
              <div>
                <p className="font-black text-slate-900 text-sm">Teacher Portal</p>
                <p className="text-teal-700 text-xs">
                  {stats.teacherStudentsCount} student{stats.teacherStudentsCount !== 1 ? 's' : ''} linked ·{' '}
                  {stats.teacherAssignmentsCount} assignment{stats.teacherAssignmentsCount !== 1 ? 's' : ''} active
                </p>
              </div>
            </div>
            <Link
              href="/teacher/dashboard"
              className="bg-teal-500/20 border border-teal-500/30 text-teal-700 px-4 py-2 rounded-xl font-black text-sm hover:bg-teal-100 transition flex-shrink-0"
            >
              Open Teacher Portal →
            </Link>
          </div>
        )}

        {/* ── SECTION 4: My Students ────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-violet-600" />
              My Students
            </h2>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-black px-4 py-2 rounded-xl transition-colors"
            >
              <PlusCircle className="w-4 h-4" /> Add Student
            </button>
          </div>

          {studentsLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-52" />)}
            </div>
          ) : studentsError ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-center justify-between">
              <span className="text-red-700 text-sm font-bold">{studentsError}</span>
              <button onClick={fetchStudents} className="text-xs text-red-600 underline font-bold">Retry</button>
            </div>
          ) : students.length === 0 ? (
            <NoStudentsEmpty onAddStudent={() => setShowAddModal(true)} />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.map(s => (
                <StudentCard
                  key={s.id}
                  student={s}
                  onRemoved={() => { fetchStudents(); fetchStats() }}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── SECTION 4b: Compass Activity ─────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Compass className="w-5 h-5 text-amber-500" />
              Learning Compass Activity
            </h2>
            <Link href="/learn" className="text-xs font-bold text-amber-600 hover:underline flex items-center gap-0.5">
              Open Compass <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {compassLoading ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : !compassActivity || compassActivity.sessions.length === 0 ? (
            <div className="bg-amber-50 border border-amber-100 border-dashed rounded-2xl p-6 text-center">
              <Compass className="w-8 h-8 text-amber-300 mx-auto mb-3" />
              <p className="text-slate-600 text-sm font-bold mb-1">No Compass sessions yet</p>
              <p className="text-slate-400 text-xs mb-4">
                When your child uses the Learning Compass, their progress will appear here — subject by subject.
              </p>
              <Link
                href="/learn"
                className="inline-flex items-center gap-1.5 bg-amber-500 text-white text-sm font-black px-4 py-2 rounded-xl hover:bg-amber-600 transition-colors"
              >
                Start First Session
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {/* This week summary bar */}
              {compassActivity.weeklyCount > 0 && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-black text-slate-900 text-sm">
                      {compassActivity.weeklyCount === 1
                        ? `1 session this week`
                        : `${compassActivity.weeklyCount} sessions this week`}
                      {compassActivity.activeStudents.length > 0 && (
                        <span className="text-amber-700 font-normal"> — {compassActivity.activeStudents.join(', ')}</span>
                      )}
                    </p>
                    <p className="text-amber-600 text-xs mt-0.5">
                      {compassActivity.totalXp > 0 ? `${compassActivity.totalXp} XP earned total · ` : ''}{compassActivity.totalSessions} sessions in last 30 days
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl">
                    <Star className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-amber-700 font-black text-sm">{compassActivity.totalSessions}</span>
                  </div>
                </div>
              )}

              {/* Session cards — most recent first, max 6 */}
              <div className="grid sm:grid-cols-2 gap-3">
                {compassActivity.sessions.slice(0, 6).map((s: CompassActivitySession) => (
                  <div
                    key={s.id}
                    className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-black text-slate-900 text-sm">{s.studentName}</p>
                        <p className="text-xs text-slate-500">Grade {s.grade} · {s.subject}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                        s.weekLabel === 'This week'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {s.weekLabel}
                      </span>
                    </div>

                    {/* Level movement */}
                    {s.startingLevel && s.endingLevel ? (
                      <div className={`flex items-center gap-2 mb-2 px-3 py-1.5 rounded-xl ${
                        s.levelGained
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-slate-50 border border-slate-200'
                      }`}>
                        {s.levelGained ? (
                          <>
                            <ArrowUpRight className="w-3.5 h-3.5 text-green-600 shrink-0" />
                            <span className="text-xs font-bold text-green-700">
                              Level up: {['','BE','AE','ME','EE'][s.startingLevel]} → {['','BE','AE','ME','EE'][s.endingLevel]}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-slate-500">
                            Level: {['','BE','AE','ME','EE'][s.endingLevel]}
                          </span>
                        )}
                      </div>
                    ) : null}

                    {/* AI summary */}
                    {s.summary && (
                      <p className="text-xs text-slate-500 leading-snug italic">
                        &ldquo;{s.summary}&rdquo;
                      </p>
                    )}

                    {/* Footer stats */}
                    <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400 font-medium">
                        {s.exchangeCount} exchange{s.exchangeCount !== 1 ? 's' : ''}
                      </span>
                      {s.xpEarned > 0 && (
                        <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                          <Zap className="w-3 h-3" /> +{s.xpEarned} XP
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {compassActivity.sessions.length > 6 && (
                <p className="text-center text-xs text-slate-400 pt-1">
                  Showing last 6 sessions · {compassActivity.sessions.length} total in past 30 days
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── SECTION 5: Quick Actions ──────────────────────────────────────── */}
        <div>
          <h2 className="text-xl font-black text-slate-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              {
                icon: Compass,
                title: 'Learning Compass',
                sub: 'Adapts to your child\'s level',
                gradient: 'from-amber-500 to-orange-500',
                shadow: 'shadow-amber-500/20',
                href: '/learn',
                badge: null,
              },
              {
                icon: BarChart3,
                title: 'Academic Clinic',
                sub: 'Clinic reports · parent verified',
                gradient: 'from-violet-500 to-purple-500',
                shadow: 'shadow-violet-500/20',
                href: '/dashboard/clinic',
                badge: null,
              },
              {
                icon: PlusCircle,
                title: 'Add Assessment',
                sub: 'Log term scores',
                gradient: 'from-blue-500 to-cyan-500',
                shadow: 'shadow-blue-500/20',
                href: '/dashboard/assessments/add',
                badge: null,
              },
              {
                icon: TrendingUp,
                title: 'History',
                sub: 'View all assessments',
                gradient: 'from-green-500 to-emerald-500',
                shadow: 'shadow-green-500/20',
                href: '/dashboard/assessments/history',
                badge: null,
              },
              {
                icon: Users,
                title: 'Study Groups',
                sub: 'Join or create',
                gradient: 'from-pink-500 to-rose-500',
                shadow: 'shadow-pink-500/20',
                href: '/dashboard/groups',
                badge: null,
              },
              {
                icon: Search,
                title: 'Career Explorer',
                sub: 'Explore careers',
                gradient: 'from-cyan-500 to-blue-500',
                shadow: 'shadow-cyan-500/20',
                // Parent-facing career intelligence entry point — /career is
                // the student's own self-service explorer (Sprint 19).
                href: '/career-intelligence',
                badge: null,
              },
              {
                icon: FileText,
                title: 'Report Card',
                sub: 'View published report card',
                gradient: 'from-slate-500 to-slate-700',
                shadow: 'shadow-slate-500/20',
                href: '/report-card',
                badge: null,
              },
              {
                icon: ClipboardList,
                title: 'My Assignments',
                sub: stats?.pendingAssignments ? `${stats.pendingAssignments} pending` : 'View all assignments',
                gradient: 'from-amber-500 to-orange-600',
                shadow: 'shadow-amber-500/20',
                href: '/dashboard/assignments',
                badge: stats?.pendingAssignments && stats.pendingAssignments > 0 ? stats.pendingAssignments : null,
              },
              // 'Class Resources' and 'Calendar' tiles were removed here
              // (Sprint 2, Platform Audit v1.0 Blocker #4): they pointed at
              // /dashboard/resources and /dashboard/calendar, which moved to
              // /resources and /calendar (app/(student)/*) so students could
              // reach them at all — but that route group redirects a parent
              // straight back to /dashboard, turning this tile into a dead
              // end for the parent audience this page actually serves. Their
              // copy ("Notes & files from your teacher") was student-facing
              // to begin with; a real parent-facing equivalent is Sprint 4
              // (Parent LMS Parity), not a routing fix — not added here.
            ].map(({ icon: Icon, title, sub, gradient, shadow, href, badge }) => (
              <Link
                key={href}
                href={href}
                className={`bg-gradient-to-br ${gradient} rounded-2xl p-4 flex flex-col items-start hover:scale-[1.02] transition-transform shadow-lg ${shadow} relative`}
              >
                {badge && (
                  <span className="absolute top-2 right-2 bg-white text-orange-600 text-xs font-black w-5 h-5 rounded-full flex items-center justify-center shadow">
                    {badge}
                  </span>
                )}
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="font-black text-white text-sm leading-tight">{title}</div>
                <div className="text-white/70 text-xs mt-0.5">{sub}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── SECTION 6: Recent Activity ────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* Left: Recent Assessments */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Recent Assessments
              </h2>
              <Link href="/dashboard/assessments/history" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-0.5">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              {studentsLoading ? (
                <div className="p-4 space-y-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : recentAssessments.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-slate-500 text-sm mb-4">No assessments yet.<br />Add your first assessment to see history here.</p>
                  <Link
                    href="/dashboard/assessments/add"
                    className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-sm font-black px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    <PlusCircle className="w-4 h-4" /> Add Assessment
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentAssessments.map((a, i) => {
                    const isCbc = a.curriculumType !== 'igcse'
                    const scores = Object.values(a.subject_scores ?? {}) as number[]
                    const avg = scores.length ? scores.reduce((x, y) => x + y, 0) / scores.length : 0
                    return (
                      <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-slate-900">{a.studentName}</p>
                          <p className="text-xs text-slate-500">Term {a.term}, {a.year} · {formatDate(a.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${isCbc ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                            {isCbc ? '🇰🇪 CBC' : '🌍 IGCSE'}
                          </span>
                          <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${isCbc ? cbcLevelBadge(avg) : 'bg-blue-50 text-blue-700'}`}>
                            {isCbc ? cbcLevelLabel(avg).label.split(' ')[0] : `${avg.toFixed(1)}`}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Assignments */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-pink-600" />
                Assignments
              </h2>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              {assignmentsLoading ? (
                <div className="p-4 space-y-3">
                  {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : assignments.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-slate-500 text-sm mb-4">
                    No assignments from teachers yet.<br />
                    Join a class to receive assignments.
                  </p>
                  <Link
                    href="/dashboard/settings"
                    className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-sm font-black px-4 py-2 rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Join a Class →
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {assignments.slice(0, 5).map(a => (
                    <div key={a.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div>
                          <p className="text-sm font-black text-slate-900">{a.title}</p>
                          <p className="text-xs text-slate-500">{a.teachers?.full_name ?? 'Teacher'} · {a.subject}</p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg flex-shrink-0 ${
                          a.isOverdue ? 'bg-red-100 text-red-700' : a.daysLeft <= 2 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {a.isOverdue ? '⚠ Overdue' : `${a.daysLeft}d left`}
                        </span>
                      </div>
                      {a.is_compass_guided && (
                        <Link
                          href={`/chat?assignmentId=${a.id}&topic=${encodeURIComponent(a.topic)}&instructions=${encodeURIComponent(a.instructions)}`}
                          className="inline-flex items-center gap-1.5 text-xs bg-gradient-to-r from-violet-500 to-purple-500 text-white px-3 py-1.5 rounded-lg font-black hover:scale-105 transition-all"
                        >
                          <Compass className="w-3.5 h-3.5" /> Start with Compass
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── SECTION 7: Upgrade banner ─────────────────────────────────────── */}
        {!statsLoading && showUpgradeBanner && (
          <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-2xl p-6 text-center">
            <p className="font-black text-slate-900 text-lg mb-2">🚀 Ready to unlock full access?</p>
            <p className="text-slate-500 mb-5 text-sm">
              Get unlimited Learning Compass sessions, Academic Clinic reports, and more.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/early-access"
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-black hover:scale-105 transition-all text-sm shadow-lg shadow-green-500/20"
              >
                💚 Pay via M-PESA (Early Access)
              </Link>
              <Link
                href="/pricing"
                className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-xl font-black hover:scale-105 transition-all text-sm shadow-lg shadow-violet-500/20"
              >
                View Plans →
              </Link>
            </div>
          </div>
        )}

      </div>

      {/* ── Add Student Modal ─────────────────────────────────────────────────── */}
      {showAddModal && (
        <AddStudentModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { fetchStudents(); fetchStats() }}
          hasTeacherManagedStudents={students.some(s => s.teacherManaged)}
        />
      )}
    </div>
  )
}
