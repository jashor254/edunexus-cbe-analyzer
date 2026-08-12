export const dynamic = 'force-dynamic'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Scroll, NotebookPen, ClipboardList, Presentation, ArrowRight,
  BookOpen, UserCheck, CalendarCheck,
} from 'lucide-react'
import AttentionFeed from '@/components/teacher/AttentionFeed'
import TodaysMission from '@/components/teacher/TodaysMission'
import ContinueWorking from '@/components/teacher/ContinueWorking'
import WeeklyTeachingProgress from '@/components/teacher/WeeklyTeachingProgress'
import TodayAtAGlance from '@/components/teacher/TodayAtAGlance'
import { DashboardDataProvider } from '@/components/teacher/DashboardDataProvider'
import { getPendingAssessments } from '@/lib/assessments/getters'
import { getTeacherDashboardProjection } from '@/lib/teacherWorkspace/dashboardProjection'

function getTermInfo() {
  const month = new Date().getMonth() + 1
  if (month >= 1 && month <= 3)  return { term: 'Term 1', number: 1 as const }
  if (month >= 4 && month <= 7)  return { term: 'Term 2', number: 2 as const }
  return { term: 'Term 3', number: 3 as const }
}

// Same lightweight month/date arithmetic already used to derive the term
// itself — a display calendar helper, not a new intelligence calculation.
function getWeekOfTerm(termNumber: 1 | 2 | 3): number {
  const now = new Date()
  const termStart = termNumber === 1
    ? new Date(now.getFullYear(), 0, 6)
    : termNumber === 2
    ? new Date(now.getFullYear(), 4, 5)
    : new Date(now.getFullYear(), 8, 1)
  const daysSince = (now.getTime() - termStart.getTime()) / (1000 * 60 * 60 * 24)
  return Math.max(1, Math.ceil(daysSince / 7))
}

// Phase 1 — school/class entry points, shown only when the teacher has
// class context. Every href already existed in the sidebar; nothing new.
const SCHOOL_ITEMS = [
  { href: '/teacher/classes',    icon: BookOpen,      label: 'My Classes',            sub: 'Rosters & learners' },
  { href: '/teacher/attendance', icon: UserCheck,     label: 'Attendance',            sub: 'Mark the register' },
  { href: '/teacher/core-term',  icon: CalendarCheck, label: 'Official Report Cards', sub: 'Lock & publish' },
]

const WORKSPACE_ITEMS = [
  { href: '/teacher/scheme-of-work', icon: Scroll,        label: 'Scheme of Work', sub: 'Plan the term' },
  { href: '/teacher/lesson-plans',   icon: NotebookPen,   label: 'Lesson Plans',   sub: 'Prepare lessons' },
  { href: '/teacher/record-of-work', icon: ClipboardList, label: 'Record of Work', sub: 'Log what was taught' },
  { href: '/teacher/slides',         icon: Presentation,  label: 'AI Slides',      sub: 'Generate a deck' },
]

export default async function TeacherDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { teacher, activeClasses, activeSchemes } = await getTeacherDashboardProjection(user.id)

  if (!teacher) redirect('/teacher/setup')

  const firstName   = teacher.full_name?.split(' ')[0] || 'Mwalimu'
  const { term, number: termNumber } = getTermInfo()
  const weekOfTerm  = getWeekOfTerm(termNumber)
  const today       = new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const pendingAssessments = await getPendingAssessments(teacher.id)

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-8">

        <DashboardDataProvider activeClasses={activeClasses}>

          {/* ── 1. Today's Mission ────────────────────────────────────── */}
          <TodaysMission
            firstName={firstName}
            today={today}
            term={term}
            weekOfTerm={weekOfTerm}
            activeClasses={activeClasses}
            activeSchemes={activeSchemes}
          />

          {/* ── 2. Continue Teaching ──────────────────────────────────────
              Phase 1 — promoted above the attention blocks. This is the
              teacher's actual work in progress (scheme -> lesson plans ->
              record of work), and it renders for any teacher with schemes,
              with or without a class. */}
          <ContinueWorking />

          {/* ── 3. Needs your attention ─────────────────────────────────── */}
          <TodayAtAGlance
            pendingAssessmentCount={pendingAssessments.length}
            pendingAssessments={pendingAssessments.map(a => ({ id: a.id, class_id: a.class_id, title: a.title, class_name: a.class_name }))}
          />

          {/* ── 4. Teacher Intelligence ───────────────────────────────── */}
          {activeClasses > 0 && (
            <div>
              <h2 className="text-sm font-black text-slate-900 mb-3">Teacher Intelligence</h2>
              <AttentionFeed />
            </div>
          )}

          {/* ── 5. Weekly Teaching Progress ───────────────────────────── */}
          <WeeklyTeachingProgress />

        </DashboardDataProvider>

        {/* ── 6. Quick actions ─────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-black text-slate-900 mb-3">Quick actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {WORKSPACE_ITEMS.map(({ href, icon: Icon, label, sub }) => (
              <Link
                key={href}
                href={href}
                className="bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-col items-start hover:-translate-y-0.5 hover:shadow-sm transition-all group"
              >
                <div className="w-8 h-8 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center mb-2.5">
                  <Icon className="w-4 h-4 text-teal-600" />
                </div>
                <div className="font-black text-slate-900 text-sm leading-tight">{label}</div>
                <div className="text-slate-400 text-xs mt-0.5 mb-3">{sub}</div>
                <span className="flex items-center gap-1 text-xs font-bold text-teal-600 group-hover:text-teal-700 transition-colors">
                  Open <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* ── 7. My School ──────────────────────────────────────────────────
            Phase 1 — school and class administration becomes a named,
            bounded section instead of the front door. Shown only when there
            is real school/class context, so an independent teacher is not
            offered institutional concepts they have no use for. My Classes
            remains fully reachable from the sidebar's My School group either
            way — this hides a dashboard shortcut, never a capability.

            The condition is deliberately `activeClasses > 0` and nothing
            more: Phase 0 established that EduNexus cannot yet answer "which
            Core classes are assigned to this teacher" (no
            listClassesForTeacher query exists), so this block makes no claim
            about assignment — it only surfaces entry points the teacher
            already had. */}
        {activeClasses > 0 && (
          <div>
            <h2 className="text-sm font-black text-slate-900 mb-3">My School</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SCHOOL_ITEMS.map(({ href, icon: Icon, label, sub }) => (
                <Link
                  key={href}
                  href={href}
                  className="bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-col items-start hover:-translate-y-0.5 hover:shadow-sm transition-all group"
                >
                  <div className="w-8 h-8 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center mb-2.5">
                    <Icon className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="font-black text-slate-900 text-sm leading-tight">{label}</div>
                  <div className="text-slate-400 text-xs mt-0.5 mb-3">{sub}</div>
                  <span className="flex items-center gap-1 text-xs font-bold text-slate-600 group-hover:text-slate-800 transition-colors">
                    Open <ArrowRight className="w-3 h-3" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
