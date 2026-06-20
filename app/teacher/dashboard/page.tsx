export const dynamic = 'force-dynamic'

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  BookOpen, AlertTriangle, Sparkles, ArrowUpRight,
} from 'lucide-react'

function getTermInfo() {
  const month = new Date().getMonth() + 1
  if (month >= 1 && month <= 3)  return 'Term 1'
  if (month >= 4 && month <= 7)  return 'Term 2'
  return 'Term 3'
}

export default async function TeacherDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = createServiceClient()

  const { data: teacher } = await db
    .from('teachers')
    .select('id, full_name, school, subject, pioneer_number, is_verified')
    .eq('user_id', user.id)
    .single()

  if (!teacher) redirect('/teacher/setup')

  const firstName = teacher.full_name?.split(' ')[0] || 'Mwalimu'
  const term      = getTermInfo()
  const today     = new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const hour      = new Date().getHours()
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const [classesResult, alertsResult, weeklyIntelResult] = await Promise.all([
    db.from('teacher_classes')
      .select('id')
      .eq('teacher_id', teacher.id),
    db.from('student_alerts')
      .select('id')
      .eq('teacher_id', teacher.id)
      .eq('is_resolved', false),
    db.from('weekly_intelligence')
      .select('week_number, week_health_score, remedial_bank_items')
      .eq('teacher_id', teacher.id)
      .order('week_number', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const activeClasses   = (classesResult.data ?? []).length
  const needsAttention  = (alertsResult.data ?? []).length
  const weeklyIntel     = weeklyIntelResult.data ?? null

  const remedialCount = Array.isArray(weeklyIntel?.remedial_bank_items)
    ? (weeklyIntel!.remedial_bank_items as unknown[]).length
    : 0

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Hero header ──────────────────────────────────────────────── */}
      <div className="bg-[#0c1929] relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse shrink-0" />
            <span className="text-teal-400 text-sm font-semibold">{today}</span>
            <span className="w-1 h-1 rounded-full bg-slate-600 hidden sm:block" />
            <span className="text-slate-400 text-sm">{term}, {new Date().getFullYear()}</span>
          </div>
          <p className="text-slate-400 text-sm font-medium mb-1 tracking-wide uppercase">Welcome back</p>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
            {greeting},{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-300">
              {firstName}
            </span>
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            {teacher.school}
            {teacher.subject && <span className="text-slate-500"> · {teacher.subject}</span>}
          </p>

          {/* ── Two stat cards ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 mt-7 max-w-sm">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center mb-3 shadow-lg shadow-teal-900/20">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <div className="text-2xl font-black text-white mb-0.5">{activeClasses}</div>
              <div className="text-xs text-slate-400 font-medium">Active Classes</div>
            </div>

            <Link
              href="/teacher/alerts"
              className={`bg-white/5 border rounded-2xl p-4 backdrop-blur-sm hover:bg-white/8 transition-all ${
                needsAttention > 0 ? 'border-red-500/30' : 'border-white/10'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 shadow-lg ${
                needsAttention > 0
                  ? 'bg-gradient-to-br from-red-500 to-rose-500 shadow-red-900/20'
                  : 'bg-gradient-to-br from-emerald-500 to-teal-500 shadow-emerald-900/20'
              }`}>
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
              <div className="text-2xl font-black text-white mb-0.5">{needsAttention}</div>
              <div className="text-xs text-slate-400 font-medium">Needs Attention</div>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-7 space-y-4">

        {/* TIE Intel summary — only if weekly_intelligence exists */}
        {weeklyIntel && (
          <Link
            href="/teacher/lesson-plans"
            className="flex items-center justify-between bg-white border border-gray-100 shadow-sm rounded-2xl p-5 hover:shadow-md transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <p className="font-black text-gray-900 text-sm">This week&apos;s TIE Intel — Week {weeklyIntel.week_number}</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  Health score{' '}
                  <span className={`font-bold ${
                    (weeklyIntel.week_health_score ?? 0) >= 75
                      ? 'text-emerald-600'
                      : (weeklyIntel.week_health_score ?? 0) >= 50
                        ? 'text-amber-600'
                        : 'text-red-600'
                  }`}>
                    {weeklyIntel.week_health_score ?? '—'}%
                  </span>
                  {remedialCount > 0 && (
                    <span className="ml-2">· {remedialCount} substrand{remedialCount !== 1 ? 's' : ''} flagged</span>
                  )}
                </p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-teal-600 transition-colors shrink-0" />
          </Link>
        )}

        {/* Nudge — quick link to Documents when user has nothing else visible */}
        {activeClasses === 0 && !weeklyIntel && (
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 text-center">
            <p className="text-gray-500 text-sm mb-3">No classes yet. Start by creating your first scheme of work.</p>
            <Link
              href="/teacher/documents"
              className="inline-flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-teal-700 transition"
            >
              Go to Documents
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
