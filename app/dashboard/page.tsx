'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Users,
  FileText,
  Compass,
  ClipboardList,
  BarChart3,
  BookOpen,
  Search,
  Calendar,
  TrendingUp,
  PlusCircle,
  X,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Zap,
  Sparkles,
  Shield,
} from 'lucide-react'
import { NoStudentsEmpty } from '@/components/ui/empty-states'

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

const CBC_GRADES = [7, 8, 9, 10, 11, 12]
const IGCSE_YEARS = [7, 8, 9, 10, 11]

function AddStudentModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('')
  const [curriculum, setCurriculum] = useState<'cbc' | 'igcse'>('cbc')
  const [grade, setGrade] = useState(7)
  const [school, setSchool] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const gradeOptions = curriculum === 'igcse' ? IGCSE_YEARS : CBC_GRADES

  // Reset grade when curriculum changes
  useEffect(() => {
    setGrade(curriculum === 'igcse' ? 7 : 7)
  }, [curriculum])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Student name is required'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/students/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), grade, school: school.trim() || null, curriculum_type: curriculum }),
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
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-black text-slate-900">Add Student</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

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
              onChange={e => setGrade(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            >
              {gradeOptions.map(g => (
                <option key={g} value={g}>
                  {curriculum === 'igcse' ? `Year ${g}` : `Grade ${g}`}
                </option>
              ))}
            </select>
          </div>

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
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white py-3.5 rounded-xl font-black hover:scale-[1.02] transition-all disabled:opacity-60 disabled:scale-100"
          >
            {loading ? 'Adding...' : 'Add Student'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Student Card ─────────────────────────────────────────────────────────────

function StudentCard({ student }: { student: Student }) {
  const summary = getStudentSummary(student)
  const latest = student.assessments?.[0]
  const isCbc = student.curriculum_type !== 'igcse'

  return (
    <div className={`bg-white border border-slate-200 border-l-4 ${summary.borderClass} rounded-2xl p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-black text-slate-900 text-base">{student.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            {isCbc ? (
              <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                🇰🇪 CBC · Grade {student.grade}
              </span>
            ) : (
              <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                🌍 IGCSE · Year {student.grade}
              </span>
            )}
          </div>
        </div>
        {summary.label !== 'No data' && (
          <span className={`text-xs font-black px-2.5 py-1 rounded-xl ${summary.badgeClass}`}>
            {summary.label}
          </span>
        )}
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
        <Link
          href={`/dashboard/assessments/add?student=${student.id}`}
          className="text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
        >
          <PlusCircle className="w-3.5 h-3.5" /> Add Assessment
        </Link>
        <Link
          href={`/chat?student=${student.id}`}
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

  const [showAddModal, setShowAddModal] = useState(false)

  // ── Fetch user identity (from Supabase client) ────────────────────────────
  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
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
    } catch {
      setStudentsError('Could not load students.')
    } finally {
      setStudentsLoading(false)
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
  }, [fetchStats, fetchStudents, fetchAssignments])

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
                AI-Powered Learning
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
              {students.map(s => <StudentCard key={s.id} student={s} />)}
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
                sub: 'AI tutoring · adapts to your child',
                gradient: 'from-amber-500 to-orange-500',
                shadow: 'shadow-amber-500/20',
                href: '/chat',
                badge: null,
              },
              {
                icon: BarChart3,
                title: 'Academic Clinic',
                sub: 'AI-generated reports · parent verified',
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
                href: '/dashboard/career-explorer',
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
        />
      )}
    </div>
  )
}
