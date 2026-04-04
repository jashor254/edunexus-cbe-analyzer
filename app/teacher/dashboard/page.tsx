export const dynamic = 'force-dynamic'

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Users, BookOpen, FileText, AlertTriangle,
  PlusCircle, ChevronRight, Eye, Clock,
  TrendingUp, CheckCircle2, Scroll,
} from 'lucide-react'

function getTermInfo() {
  const month = new Date().getMonth() + 1
  if (month >= 1 && month <= 3)  return 'Term 1'
  if (month >= 4 && month <= 7)  return 'Term 2'
  return 'Term 3'
}

function levelLabel(avg: number) {
  if (avg >= 3.5) return 'Exceeds'
  if (avg >= 2.5) return 'Meets'
  if (avg >= 1.5) return 'Approaching'
  return 'Below'
}

function levelColor(avg: number) {
  if (avg >= 3.5) return 'text-purple-600 bg-purple-50'
  if (avg >= 2.5) return 'text-green-600 bg-green-50'
  if (avg >= 1.5) return 'text-amber-600 bg-amber-50'
  return 'text-red-600 bg-red-50'
}

export default async function TeacherDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = createServiceClient()

  const { data: teacher } = await db
    .from('teachers')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!teacher) redirect('/teacher/setup')

  const firstName = teacher.full_name?.split(' ')[0] || 'Mwalimu'
  const term = getTermInfo()
  const today = new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  // Fetch dashboard data in parallel
  const [classesResult, alertsResult, assignmentsResult, schemesResult] = await Promise.all([
    db.from('teacher_classes')
      .select('id, name, grade, subject, class_code, academic_year')
      .eq('teacher_id', teacher.id)
      .order('created_at', { ascending: false }),

    db.from('student_alerts')
      .select('*, students(name, grade)')
      .eq('teacher_id', teacher.id)
      .eq('is_resolved', false)
      .order('created_at', { ascending: false })
      .limit(5),

    db.from('assignments')
      .select('id, title, status, due_date, class_id')
      .eq('teacher_id', teacher.id)
      .eq('status', 'active')
      .order('due_date', { ascending: true }),

    db.from('schemes_of_work')
      .select('id, grade, learning_area, term, year, curriculum_mode, created_at')
      .eq('teacher_id', teacher.id)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const classes = classesResult.data || []
  const alerts = alertsResult.data || []
  const activeAssignments = assignmentsResult.data || []
  const recentSchemes = schemesResult.data || []

  // Get student counts + avg per class
  const classesWithStats = await Promise.all(
    classes.map(async (cls) => {
      const { data: links } = await db
        .from('class_students')
        .select('student_id')
        .eq('class_id', cls.id)

      const studentIds = (links || []).map((l: any) => l.student_id)
      let avgLevel = null
      let needsAttention = 0

      if (studentIds.length > 0) {
        const { data: assessments } = await db
          .from('assessments')
          .select('student_id, subject_scores')
          .in('student_id', studentIds)
          .order('created_at', { ascending: false })

        const latestPerStudent: Record<string, any> = {}
        ;(assessments || []).forEach((a: any) => {
          if (!latestPerStudent[a.student_id]) latestPerStudent[a.student_id] = a
        })

        const avgs = Object.values(latestPerStudent).map((a: any) => {
          const vals = Object.values(a.subject_scores as Record<string, number>)
          return vals.reduce((s, v) => s + v, 0) / vals.length
        })

        if (avgs.length > 0) {
          avgLevel = avgs.reduce((s, v) => s + v, 0) / avgs.length
          needsAttention = avgs.filter(a => a < 2.5).length
        }
      }

      return {
        ...cls,
        studentCount: studentIds.length,
        avgLevel: avgLevel ? Math.round(avgLevel * 10) / 10 : null,
        needsAttention,
      }
    })
  )

  // Total students (unique across classes)
  const allStudentIds = new Set<string>()
  for (const cls of classesWithStats) {
    const { data: links } = await db
      .from('class_students')
      .select('student_id')
      .eq('class_id', cls.id)
    ;(links || []).forEach((l: any) => allStudentIds.add(l.student_id))
  }

  // Pending submissions
  let pendingCount = 0
  for (const a of activeAssignments) {
    const { count } = await db
      .from('assignment_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('assignment_id', a.id)
      .eq('status', 'submitted')
    pendingCount += count || 0
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900 mb-1">
          Habari {firstName}! 👋
        </h1>
        <p className="text-gray-500">{teacher.school} · {teacher.subject || 'Teacher'}</p>
        <p className="text-sm text-gray-400 mt-1">{today} · {term}, {new Date().getFullYear()}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          {
            icon: Users,
            value: allStudentIds.size,
            label: 'Total Students',
            color: 'text-blue-600',
            bg: 'bg-blue-50',
          },
          {
            icon: BookOpen,
            value: classes.length,
            label: 'Active Classes',
            color: 'text-teal-600',
            bg: 'bg-teal-50',
          },
          {
            icon: FileText,
            value: pendingCount,
            label: 'Pending Marking',
            color: 'text-violet-600',
            bg: 'bg-violet-50',
          },
          {
            icon: AlertTriangle,
            value: alerts.length,
            label: 'Needs Attention',
            color: alerts.length > 0 ? 'text-red-600' : 'text-green-600',
            bg: alerts.length > 0 ? 'bg-red-50' : 'bg-green-50',
          },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center mb-3`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div className={`text-3xl font-black ${stat.color} mb-1`}>{stat.value}</div>
            <div className="text-sm text-gray-500 font-medium">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Early Warning Alerts */}
      {alerts.length > 0 && (
        <div className="mb-8 bg-red-50 border border-red-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Attention Needed ({alerts.length} student{alerts.length !== 1 ? 's' : ''})
            </h2>
            <Link href="/teacher/alerts" className="text-sm text-red-600 font-bold hover:underline flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {alerts.slice(0, 3).map((alert: any) => {
              const student = alert.students
              const isHigh = alert.alert_type === 'inactive' || alert.alert_type === 'holiday_inactive'
              return (
                <div key={alert.id} className="bg-white rounded-xl border border-red-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className={`text-lg ${isHigh ? '🔴' : '🟡'}`}>{isHigh ? '🔴' : '🟡'}</span>
                      <div>
                        <div className="font-bold text-gray-900">
                          {student?.name} — Grade {student?.grade}
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5">{alert.message}</p>
                      </div>
                    </div>
                    <Link
                      href="/teacher/alerts"
                      className="shrink-0 text-xs text-red-600 border border-red-200 px-3 py-1.5 rounded-lg font-bold hover:bg-red-50 transition"
                    >
                      View
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* My Classes */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-teal-600" />
            My Classes
          </h2>
          <div className="flex gap-2">
            <Link
              href="/teacher/classes"
              className="text-sm text-gray-500 hover:text-gray-700 font-bold flex items-center gap-1"
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {classesWithStats.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center">
            <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No classes yet. Create your first class.</p>
            <Link
              href="/teacher/classes"
              className="inline-flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-teal-700 transition"
            >
              <PlusCircle className="w-4 h-4" /> Create Class
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {classesWithStats.slice(0, 6).map((cls) => (
              <div key={cls.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <BookOpen className="w-4 h-4 text-teal-600" />
                      <h3 className="font-black text-gray-900">{cls.name}</h3>
                    </div>
                    <p className="text-sm text-gray-500">
                      {cls.studentCount} students · {cls.academic_year}
                    </p>
                  </div>
                  {cls.avgLevel !== null && (
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${levelColor(cls.avgLevel)}`}>
                      {levelLabel(cls.avgLevel)}
                    </span>
                  )}
                </div>

                <div className="text-xs text-gray-400 font-mono bg-gray-50 px-2 py-1 rounded-lg inline-block mb-3">
                  Code: <strong className="text-gray-700">{cls.class_code}</strong>
                </div>

                {cls.avgLevel !== null && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Class avg</span>
                      <span>{cls.avgLevel}/4</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          cls.avgLevel >= 3.5 ? 'bg-purple-500' :
                          cls.avgLevel >= 2.5 ? 'bg-green-500' :
                          cls.avgLevel >= 1.5 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${(cls.avgLevel / 4) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2 text-xs mb-4">
                  {cls.needsAttention > 0 && (
                    <span className="text-red-600 bg-red-50 px-2 py-1 rounded-lg font-semibold">
                      🔴 {cls.needsAttention} need attention
                    </span>
                  )}
                  {cls.avgLevel !== null && cls.avgLevel >= 3 && (
                    <span className="text-green-600 bg-green-50 px-2 py-1 rounded-lg font-semibold">
                      ✅ Class on track
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/teacher/classes/${cls.id}`}
                    className="flex-1 text-center text-sm text-teal-700 border border-teal-200 bg-teal-50 px-3 py-2 rounded-xl font-bold hover:bg-teal-100 transition flex items-center justify-center gap-1"
                  >
                    <Eye className="w-4 h-4" /> View Class
                  </Link>
                  <Link
                    href={`/teacher/assignments/new?classId=${cls.id}`}
                    className="flex-1 text-center text-sm text-white bg-teal-600 px-3 py-2 rounded-xl font-bold hover:bg-teal-700 transition flex items-center justify-center gap-1"
                  >
                    <PlusCircle className="w-4 h-4" /> Assignment
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Assignments */}
      {activeAssignments.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-violet-600" />
              Active Assignments
            </h2>
            <Link href="/teacher/assignments" className="text-sm text-gray-500 hover:text-gray-700 font-bold flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 shadow-sm overflow-hidden">
            {activeAssignments.slice(0, 5).map((a: any) => {
              const due = new Date(a.due_date)
              const daysLeft = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              return (
                <div key={a.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition">
                  <div>
                    <div className="font-bold text-gray-900 text-sm">{a.title}</div>
                    <div className="text-xs text-gray-400">
                      Due {due.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {daysLeft > 0 ? ` · ${daysLeft}d left` : ' · Overdue'}
                    </div>
                  </div>
                  <Link
                    href={`/teacher/assignments/${a.id}`}
                    className="text-xs text-teal-600 font-bold hover:underline flex items-center gap-1"
                  >
                    Mark <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { href: '/teacher/classes',           icon: PlusCircle,    label: 'New Class',       color: 'bg-teal-600'   },
          { href: '/teacher/assignments/new',    icon: FileText,      label: 'New Assignment',  color: 'bg-blue-600'   },
          { href: '/teacher/scheme-of-work',     icon: Scroll,        label: 'Scheme of Work',  color: 'bg-indigo-600' },
          { href: '/teacher/reports',            icon: TrendingUp,    label: 'Class Reports',   color: 'bg-violet-600' },
          { href: '/teacher/alerts',             icon: CheckCircle2,  label: 'Review Alerts',   color: 'bg-amber-600'  },
        ].map((action, i) => (
          <Link
            key={i}
            href={action.href}
            className={`${action.color} text-white rounded-2xl p-4 flex flex-col items-center justify-center gap-2 text-center hover:opacity-90 transition shadow-sm`}
          >
            <action.icon className="w-6 h-6" />
            <span className="text-sm font-bold">{action.label}</span>
          </Link>
        ))}
      </div>

      {/* My Schemes */}
      {recentSchemes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <Scroll className="w-5 h-5 text-indigo-600" />
              My Schemes of Work
            </h2>
            <Link
              href="/teacher/scheme-of-work"
              className="text-sm text-gray-500 hover:text-gray-700 font-bold flex items-center gap-1"
            >
              Create New <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 shadow-sm overflow-hidden">
            {recentSchemes.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition">
                <div>
                  <div className="font-bold text-gray-900 text-sm">
                    {s.learning_area} · {s.grade}
                  </div>
                  <div className="text-xs text-gray-400">
                    Term {s.term} {s.year} · {new Date(s.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <Link
                  href="/teacher/scheme-of-work"
                  className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1"
                >
                  Create New <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
