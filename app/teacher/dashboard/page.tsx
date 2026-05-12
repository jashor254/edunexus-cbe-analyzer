export const dynamic = 'force-dynamic'

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Users, BookOpen, FileText, AlertTriangle,
  PlusCircle, ChevronRight, Eye, Clock,
  TrendingUp, CheckCircle2, Scroll, NotebookPen,
  Sparkles, ArrowUpRight, Zap,
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

function levelGradient(avg: number) {
  if (avg >= 3.5) return { bar: 'from-purple-500 to-violet-400', badge: 'bg-purple-50 text-purple-700 border-purple-200' }
  if (avg >= 2.5) return { bar: 'from-emerald-500 to-teal-400', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  if (avg >= 1.5) return { bar: 'from-amber-500 to-yellow-400', badge: 'bg-amber-50 text-amber-700 border-amber-200' }
  return { bar: 'from-red-500 to-rose-400', badge: 'bg-red-50 text-red-700 border-red-200' }
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
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

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

  const classesWithStats = await Promise.all(
    classes.map(async (cls) => {
      const { data: links } = await db.from('class_students').select('student_id').eq('class_id', cls.id)
      const studentIds = (links || []).map((l: any) => l.student_id)
      let avgLevel = null
      let needsAttention = 0

      if (studentIds.length > 0) {
        const { data: assessments } = await db
          .from('assessments').select('student_id, subject_scores')
          .in('student_id', studentIds).order('created_at', { ascending: false })

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
      return { ...cls, studentCount: studentIds.length, avgLevel: avgLevel ? Math.round(avgLevel * 10) / 10 : null, needsAttention }
    })
  )

  const allStudentIds = new Set<string>()
  for (const cls of classesWithStats) {
    const { data: links } = await db.from('class_students').select('student_id').eq('class_id', cls.id)
    ;(links || []).forEach((l: any) => allStudentIds.add(l.student_id))
  }

  let pendingCount = 0
  for (const a of activeAssignments) {
    const { count } = await db.from('assignment_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('assignment_id', a.id).eq('status', 'submitted')
    pendingCount += count || 0
  }

  const stats = [
    { icon: Users,         value: allStudentIds.size, label: 'Total Students',   gradient: 'from-blue-500 to-indigo-500',    glow: 'shadow-blue-500/20'   },
    { icon: BookOpen,      value: classes.length,     label: 'Active Classes',   gradient: 'from-teal-500 to-cyan-500',      glow: 'shadow-teal-500/20'   },
    { icon: FileText,      value: pendingCount,       label: 'Pending Marking',  gradient: 'from-violet-500 to-purple-500',  glow: 'shadow-violet-500/20' },
    { icon: AlertTriangle, value: alerts.length,      label: 'Needs Attention',  gradient: alerts.length > 0 ? 'from-red-500 to-rose-500' : 'from-emerald-500 to-teal-500', glow: alerts.length > 0 ? 'shadow-red-500/20' : 'shadow-emerald-500/20' },
  ]

  const quickActions = [
    { href: '/teacher/classes',          icon: PlusCircle,  label: 'New Class',       sub: 'Add students',     gradient: 'from-teal-600 to-cyan-500'    },
    { href: '/teacher/assignments/new',  icon: FileText,    label: 'New Assignment',  sub: 'Create & publish', gradient: 'from-blue-600 to-indigo-500'  },
    { href: '/teacher/scheme-of-work',   icon: Scroll,      label: 'Scheme of Work',  sub: 'AI-powered',       gradient: 'from-violet-600 to-purple-500'},
    { href: '/teacher/lesson-plans',     icon: NotebookPen, label: 'Lesson Plans',    sub: 'Plan your lessons', gradient: 'from-pink-600 to-rose-500'   },
    { href: '/teacher/reports',          icon: TrendingUp,  label: 'Class Reports',   sub: 'CBC analytics',    gradient: 'from-amber-500 to-orange-500' },
  ]

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Hero header */}
      <div className="bg-[#0c1929] relative overflow-hidden">
        {/* Decorative grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:40px_40px]" />
        {/* Glow orbs */}
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8 lg:py-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-teal-400 text-sm font-semibold">{today}</span>
                <span className="w-1 h-1 rounded-full bg-slate-600" />
                <span className="text-slate-400 text-sm">{term}, {new Date().getFullYear()}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-300">{firstName}</span> 👋
              </h1>
              <p className="text-slate-400 mt-1 text-sm">
                {teacher.school}
                {teacher.subject && <span className="text-slate-500"> · {teacher.subject}</span>}
              </p>
            </div>
            <Link
              href="/teacher/scheme-of-work"
              className="hidden sm:flex items-center gap-2 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-300 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Generate Scheme
            </Link>
          </div>

          {/* Stats row — inside the dark hero */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-7">
            {stats.map((stat, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm hover:bg-white/8 transition-all">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg ${stat.glow} flex items-center justify-center mb-3`}>
                  <stat.icon className="w-4.5 h-4.5 text-white" />
                </div>
                <div className="text-2xl font-black text-white mb-0.5">{stat.value}</div>
                <div className="text-xs text-slate-400 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-7 space-y-8">

        {/* Alerts banner */}
        {alerts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-red-900 flex items-center gap-2 text-base">
                <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                {alerts.length} Student{alerts.length !== 1 ? 's' : ''} Need Attention
              </h2>
              <Link href="/teacher/alerts" className="text-sm text-red-600 font-bold hover:underline flex items-center gap-1">
                View All <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="space-y-2">
              {alerts.slice(0, 3).map((alert: any) => {
                const student = alert.students
                const isHigh = alert.alert_type === 'inactive' || alert.alert_type === 'holiday_inactive'
                return (
                  <div key={alert.id} className="bg-white rounded-xl border border-red-100 px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-base shrink-0">{isHigh ? '🔴' : '🟡'}</span>
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 text-sm truncate">{student?.name} — Grade {student?.grade}</div>
                        <p className="text-xs text-gray-500 truncate">{alert.message}</p>
                      </div>
                    </div>
                    <Link href="/teacher/alerts" className="shrink-0 text-xs text-red-600 border border-red-200 px-2.5 py-1 rounded-lg font-bold hover:bg-red-50 transition">
                      View
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-amber-500" />
            <h2 className="text-base font-black text-gray-900">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {quickActions.map((action, i) => (
              <Link
                key={i}
                href={action.href}
                className="group relative overflow-hidden rounded-2xl p-4 flex flex-col gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm hover:shadow-lg"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-90 group-hover:opacity-100 transition-opacity`} />
                <div className="relative">
                  <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center mb-2 group-hover:bg-white/25 transition-colors">
                    <action.icon className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div className="text-white font-black text-sm leading-tight">{action.label}</div>
                  <div className="text-white/70 text-xs mt-0.5">{action.sub}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Classes grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-teal-50 rounded-xl flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-teal-600" />
              </div>
              <h2 className="text-base font-black text-gray-900">My Classes</h2>
            </div>
            <Link href="/teacher/classes" className="text-sm text-teal-600 font-bold hover:underline flex items-center gap-1">
              View All <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {classesWithStats.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center">
              <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium mb-4">No classes yet. Set up your first class.</p>
              <Link
                href="/teacher/classes"
                className="inline-flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-teal-700 transition shadow-sm"
              >
                <PlusCircle className="w-4 h-4" /> Create Class
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {classesWithStats.slice(0, 6).map((cls) => {
                const grade = levelGradient(cls.avgLevel || 0)
                return (
                  <div key={cls.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden">
                    {/* Top accent */}
                    <div className={`h-1 bg-gradient-to-r ${cls.avgLevel !== null ? grade.bar : 'from-gray-200 to-gray-300'}`} />
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-black text-gray-900 leading-tight">{cls.name}</h3>
                          <p className="text-xs text-gray-400 mt-0.5">{cls.studentCount} students · {cls.academic_year}</p>
                        </div>
                        {cls.avgLevel !== null && (
                          <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${grade.badge}`}>
                            {levelLabel(cls.avgLevel)}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-gray-400 font-mono bg-gray-50 border border-gray-100 px-2.5 py-1.5 rounded-lg inline-block mb-3">
                        Code: <strong className="text-gray-700 font-black">{cls.class_code}</strong>
                      </div>

                      {cls.avgLevel !== null && (
                        <div className="mb-4">
                          <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                            <span>Class average</span>
                            <span className="font-bold text-gray-600">{cls.avgLevel}/4</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full bg-gradient-to-r ${grade.bar} transition-all`}
                              style={{ width: `${(cls.avgLevel / 4) * 100}%` }}
                            />
                          </div>
                          {cls.needsAttention > 0 && (
                            <p className="text-xs text-red-500 font-semibold mt-1.5">
                              ⚠ {cls.needsAttention} student{cls.needsAttention !== 1 ? 's' : ''} need attention
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Link
                          href={`/teacher/classes/${cls.id}`}
                          className="flex-1 text-center text-sm text-teal-700 border border-teal-100 bg-teal-50 px-3 py-2 rounded-xl font-bold hover:bg-teal-100 transition flex items-center justify-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </Link>
                        <Link
                          href={`/teacher/assignments/new?classId=${cls.id}`}
                          className="flex-1 text-center text-sm text-white bg-gradient-to-r from-teal-600 to-cyan-500 px-3 py-2 rounded-xl font-bold hover:opacity-90 transition shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <PlusCircle className="w-3.5 h-3.5" /> Assign
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Active assignments + Recent schemes — two-col on large screens */}
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Active Assignments */}
          {activeAssignments.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-violet-50 rounded-xl flex items-center justify-center">
                    <Clock className="w-4 h-4 text-violet-600" />
                  </div>
                  <h2 className="text-base font-black text-gray-900">Active Assignments</h2>
                </div>
                <Link href="/teacher/assignments" className="text-sm text-violet-600 font-bold hover:underline flex items-center gap-1">
                  View All <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {activeAssignments.slice(0, 5).map((a: any, i: number) => {
                  const due = new Date(a.due_date)
                  const daysLeft = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  const overdue = daysLeft < 0
                  return (
                    <div key={a.id} className={`flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${overdue ? 'bg-red-400' : daysLeft <= 2 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                        <div className="min-w-0">
                          <div className="font-bold text-gray-900 text-sm truncate">{a.title}</div>
                          <div className={`text-xs ${overdue ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                            Due {due.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })}
                            {overdue ? ' · Overdue' : ` · ${daysLeft}d left`}
                          </div>
                        </div>
                      </div>
                      <Link href={`/teacher/assignments/${a.id}`} className="shrink-0 text-xs text-violet-600 font-bold hover:underline flex items-center gap-0.5">
                        Mark <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recent Schemes */}
          {recentSchemes.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center">
                    <Scroll className="w-4 h-4 text-indigo-600" />
                  </div>
                  <h2 className="text-base font-black text-gray-900">My Schemes of Work</h2>
                </div>
                <Link href="/teacher/scheme-of-work" className="text-sm text-indigo-600 font-bold hover:underline flex items-center gap-1">
                  Create New <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {recentSchemes.map((s: any, i: number) => (
                  <div key={s.id} className={`flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                        <Scroll className="w-3.5 h-3.5 text-indigo-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 text-sm truncate">{s.learning_area} · {s.grade}</div>
                        <div className="text-xs text-gray-400">
                          Term {s.term} {s.year} · {new Date(s.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                    </div>
                    <Link href="/teacher/scheme-of-work" className="shrink-0 text-xs text-indigo-600 font-bold hover:underline flex items-center gap-0.5">
                      New <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Upgrade nudge */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c1929] to-slate-800 p-6 shadow-xl">
          <div className="absolute top-0 right-0 w-40 h-40 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-teal-400" />
                <span className="text-teal-400 text-xs font-bold uppercase tracking-wider">AI-Powered Teaching</span>
              </div>
              <h3 className="text-white font-black text-lg leading-tight">Unlock Full EduNexus Premium</h3>
              <p className="text-slate-400 text-sm mt-1">Advanced analytics, unlimited AI schemes & lesson plans.</p>
            </div>
            <Link
              href="/teacher/settings"
              className="shrink-0 bg-gradient-to-r from-teal-500 to-cyan-400 text-white px-5 py-2.5 rounded-xl font-black text-sm hover:opacity-90 transition shadow-lg shadow-teal-900/30 flex items-center gap-2"
            >
              Upgrade Now <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
