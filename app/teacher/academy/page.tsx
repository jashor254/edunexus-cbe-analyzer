export const dynamic = 'force-dynamic'

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, Clock, CheckCircle2, Award, ChevronRight, GraduationCap } from 'lucide-react'
import { getModulesWithProgress } from '@/lib/academy/queries'

export default async function AcademyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = createServiceClient()
  const { data: teacher } = await db
    .from('teachers')
    .select('id, full_name')
    .eq('user_id', user.id)
    .single()

  if (!teacher) redirect('/teacher/setup')

  const modules = await getModulesWithProgress(teacher.id)

  const totalLessons = modules.reduce((s, m) => s + m.lessons.length, 0)
  const completedLessons = modules.reduce((s, m) => s + m.completedCount, 0)
  const overallPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0
  const allComplete = totalLessons > 0 && completedLessons >= totalLessons

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Hero */}
      <div className="bg-[#0c1929] relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute top-0 left-1/3 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-12">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-teal-400 text-sm font-semibold uppercase tracking-wider">Phase 1</span>
          </div>
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                EduNexus{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-300">
                  AI Academy
                </span>
              </h1>
              <p className="text-slate-400 mt-2 max-w-lg text-sm leading-relaxed">
                Become an AI-fluent educator in 6 modules. Master the tools and mindset that will define the next decade of Kenyan teaching.
              </p>
            </div>
            {allComplete && (
              <Link
                href="/teacher/academy/certificate"
                className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-white px-5 py-3 rounded-xl font-black text-sm shadow-lg shadow-amber-900/30 hover:opacity-90 transition shrink-0"
              >
                <Award className="w-4 h-4" /> Claim Certificate
              </Link>
            )}
          </div>

          {/* Overall progress */}
          <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-teal-400" />
                <span className="text-white font-bold text-sm">Phase 1 Progress</span>
              </div>
              <span className="text-teal-400 font-black text-sm">{completedLessons}/{totalLessons} lessons</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2.5">
              <div
                className="h-2.5 rounded-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-500"
                style={{ width: `${overallPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-slate-400 text-xs">{overallPct}% complete</span>
              {allComplete && (
                <span className="text-teal-400 text-xs font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> All done!
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Module cards */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-2 mb-6">
          <BookOpen className="w-4 h-4 text-slate-500" />
          <h2 className="text-base font-black text-gray-900">6 Modules · Phase 1</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((mod) => {
            const pct = mod.lessons.length > 0
              ? Math.round((mod.completedCount / mod.lessons.length) * 100)
              : 0
            const isComplete = mod.completedCount === mod.lessons.length && mod.lessons.length > 0
            const isStarted = mod.completedCount > 0

            return (
              <Link
                key={mod.id}
                href={`/teacher/academy/module/${mod.slug}`}
                className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden flex flex-col"
              >
                {/* Color accent top bar */}
                <div
                  className="h-1.5 w-full"
                  style={{ background: mod.color ?? '#14b8a6' }}
                />

                <div className="p-5 flex flex-col flex-1">
                  {/* Module number + status */}
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className="text-[11px] font-black px-2.5 py-1 rounded-lg"
                      style={{
                        background: `${mod.color ?? '#14b8a6'}18`,
                        color: mod.color ?? '#14b8a6',
                      }}
                    >
                      Module {mod.order}
                    </span>
                    {isComplete ? (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Done
                      </span>
                    ) : isStarted ? (
                      <span className="text-[11px] text-amber-600 font-bold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">
                        In progress
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-semibold bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                        Not started
                      </span>
                    )}
                  </div>

                  <h3 className="font-black text-gray-900 text-sm leading-tight mb-2">{mod.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed flex-1 mb-4">{mod.description}</p>

                  {/* Meta row */}
                  <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {mod.estimated_mins} min
                    </span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      {mod.lessons.length} lessons
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-[11px] text-gray-400 mb-1.5">
                      <span>{mod.completedCount}/{mod.lessons.length} completed</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: mod.color ?? '#14b8a6',
                        }}
                      />
                    </div>
                  </div>

                  <div
                    className="mt-4 flex items-center justify-between text-xs font-bold group-hover:gap-2 transition-all"
                    style={{ color: mod.color ?? '#14b8a6' }}
                  >
                    <span>{isComplete ? 'Review module' : isStarted ? 'Continue' : 'Start module'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Certificate teaser */}
        {!allComplete && (
          <div className="mt-8 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
              <Award className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="font-black text-amber-900 text-sm">EduNexus AI Pioneer Teacher Certificate</h3>
              <p className="text-amber-700 text-xs mt-0.5">
                Complete all {totalLessons} lessons across 6 modules to earn your certificate.
                {totalLessons > 0 && completedLessons > 0 && (
                  <span className="font-bold"> {totalLessons - completedLessons} lessons to go.</span>
                )}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
