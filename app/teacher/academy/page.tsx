export const dynamic = 'force-dynamic'

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, Clock, CheckCircle2, Award, ChevronRight, GraduationCap, Lock, Zap, Star } from 'lucide-react'
import { getModulesWithProgress, getPhaseStats } from '@/lib/academy/queries'
import { PHASE_META } from '@/lib/academy/types'
import type { ModuleWithProgress, PhaseStats } from '@/lib/academy/types'

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
  const phaseStats = await getPhaseStats(modules)

  const phases = [...new Set(modules.map(m => m.phase))].sort()
  const modulesByPhase = new Map<number, ModuleWithProgress[]>()
  for (const phase of phases) {
    modulesByPhase.set(phase, modules.filter(m => m.phase === phase))
  }

  const overallCompleted = modules.reduce((s, m) => s + m.completedCount, 0)
  const overallTotal = modules.reduce((s, m) => s + m.lessons.length, 0)
  const phase1Stats = phaseStats.find(p => p.phase === 1)
  const phase1Complete = phase1Stats?.allComplete ?? false

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Hero */}
      <div className="bg-[#0c1929] relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-size-[40px_40px]" />
        <div className="absolute top-0 left-1/3 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-12">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-teal-400" />
              <span className="text-teal-400 text-sm font-semibold uppercase tracking-wider">EduNexus AI Academy</span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/teacher/academy/cohort/new"
                className="flex items-center gap-1.5 text-slate-400 hover:text-cyan-400 text-xs font-bold transition"
              >
                Cohorts
              </Link>
              <span className="text-slate-700 text-xs">·</span>
              <Link
                href="/teacher/academy/portfolio"
                className="flex items-center gap-1.5 text-slate-400 hover:text-teal-400 text-xs font-bold transition"
              >
                My Portfolio →
              </Link>
            </div>
          </div>
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                From first lesson to{' '}
                <span className="text-transparent bg-clip-text bg-linear-to-r from-teal-400 to-cyan-300">
                  AI Builder
                </span>
              </h1>
              <p className="text-slate-400 mt-2 max-w-lg text-sm leading-relaxed">
                Five phases. Real Kenyan CBC context. Free tools integrated at every step. Start as a beginner — finish building your own AI workflows.
              </p>
            </div>
            {phase1Complete && (
              <Link
                href="/teacher/academy/certificate"
                className="flex items-center gap-2 bg-linear-to-r from-amber-500 to-yellow-400 text-white px-5 py-3 rounded-xl font-black text-sm shadow-lg shadow-amber-900/30 hover:opacity-90 transition shrink-0"
              >
                <Award className="w-4 h-4" /> Claim Certificate
              </Link>
            )}
          </div>

          {/* Overall progress bar */}
          <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white font-bold text-sm">Overall progress</span>
              <span className="text-teal-400 font-black text-sm">{overallCompleted}/{overallTotal} lessons</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-linear-to-r from-teal-500 to-cyan-400 transition-all duration-500"
                style={{ width: `${overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0}%` }}
              />
            </div>
            {/* Phase milestone dots */}
            <div className="flex gap-2 mt-4 flex-wrap">
              {phaseStats.map(ps => {
                const meta = PHASE_META.find(m => m.phase === ps.phase)
                return (
                  <div
                    key={ps.phase}
                    className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg"
                    style={{
                      background: ps.allComplete ? `${meta?.color ?? '#14b8a6'}22` : 'rgba(255,255,255,0.06)',
                      color: ps.allComplete ? (meta?.color ?? '#14b8a6') : '#64748b',
                    }}
                  >
                    {ps.allComplete && <CheckCircle2 className="w-3 h-3" />}
                    {ps.locked && <Lock className="w-3 h-3" />}
                    {meta?.badge}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Phases */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-12">
        {phaseStats.map(ps => {
          const meta = PHASE_META.find(m => m.phase === ps.phase)
          const phaseModules = modulesByPhase.get(ps.phase) ?? []

          return (
            <PhaseSection
              key={ps.phase}
              stats={ps}
              meta={meta ?? { phase: ps.phase, title: `Phase ${ps.phase}`, badge: '', description: '', color: '#14b8a6' }}
              modules={phaseModules}
            />
          )
        })}

        {/* Coming soon phases */}
        <ComingSoonPhases existingPhases={phases} />
      </div>
    </div>
  )
}

function PhaseSection({
  stats,
  meta,
  modules,
}: {
  stats: PhaseStats
  meta: { phase: number; title: string; badge: string; description: string; color: string }
  modules: ModuleWithProgress[]
}) {
  const isLocked = stats.locked
  const isEarlyAccess = stats.earlyAccess

  return (
    <div>
      {/* Phase header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[11px] font-black px-2.5 py-1 rounded-lg"
              style={{ background: `${meta.color}18`, color: meta.color }}
            >
              Phase {meta.phase}
            </span>
            {isLocked && (
              <span className="flex items-center gap-1 text-[11px] text-slate-400 font-bold bg-slate-100 px-2.5 py-1 rounded-lg">
                <Lock className="w-3 h-3" /> Locked — complete 50% of Phase {meta.phase - 1} to unlock
              </span>
            )}
            {isEarlyAccess && (
              <span className="flex items-center gap-1 text-[11px] text-amber-600 font-bold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">
                <Zap className="w-3 h-3" /> Early Access
              </span>
            )}
            {stats.allComplete && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                <CheckCircle2 className="w-3 h-3" /> Complete
              </span>
            )}
          </div>
          <h2 className="text-lg font-black text-gray-900">{meta.title}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{meta.description}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-gray-400 mb-1">{stats.completedLessons}/{stats.totalLessons} lessons</div>
          <div className="w-32 bg-gray-100 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ width: `${stats.pct}%`, background: meta.color }}
            />
          </div>
        </div>
      </div>

      {/* Module grid */}
      {isLocked ? (
        <LockedPhaseGrid modules={modules} color={meta.color} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map(mod => (
            <ModuleCard key={mod.id} mod={mod} />
          ))}
        </div>
      )}
    </div>
  )
}

function ModuleCard({ mod }: { mod: ModuleWithProgress }) {
  const pct = mod.lessons.length > 0
    ? Math.round((mod.completedCount / mod.lessons.length) * 100)
    : 0
  const isComplete = mod.completedCount === mod.lessons.length && mod.lessons.length > 0
  const isStarted = mod.completedCount > 0

  return (
    <Link
      href={`/teacher/academy/module/${mod.slug}`}
      className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden flex flex-col"
    >
      <div className="h-1.5 w-full" style={{ background: mod.color ?? '#14b8a6' }} />
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-[11px] font-black px-2.5 py-1 rounded-lg"
            style={{ background: `${mod.color ?? '#14b8a6'}18`, color: mod.color ?? '#14b8a6' }}
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

        <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
          {mod.estimated_mins && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {mod.estimated_mins} min
            </span>
          )}
          <span className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            {mod.lessons.length} lesson{mod.lessons.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-gray-400 mb-1.5">
            <span>{mod.completedCount}/{mod.lessons.length} completed</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ width: `${pct}%`, background: mod.color ?? '#14b8a6' }}
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
}

function LockedPhaseGrid({ modules, color }: { modules: ModuleWithProgress[]; color: string }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {modules.map(mod => (
        <div
          key={mod.id}
          className="bg-white rounded-2xl border border-gray-100 overflow-hidden opacity-50 select-none"
        >
          <div className="h-1.5 w-full" style={{ background: color }} />
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-gray-100 text-gray-400">
                Module {mod.order}
              </span>
              <Lock className="w-3.5 h-3.5 text-gray-300" />
            </div>
            <h3 className="font-black text-gray-400 text-sm leading-tight mb-2">{mod.title}</h3>
            <p className="text-xs text-gray-300 leading-relaxed">{mod.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function ComingSoonPhases({ existingPhases }: { existingPhases: number[] }) {
  const allPhases = [1, 2, 3, 4, 5]
  const missing = allPhases.filter(p => !existingPhases.includes(p))
  if (missing.length === 0) return null

  return (
    <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center">
      <Star className="w-6 h-6 text-gray-300 mx-auto mb-3" />
      <p className="text-sm font-bold text-gray-400">Phases {missing.join(' & ')} — Coming Soon</p>
      <p className="text-xs text-gray-400 mt-1">
        Pioneer and Builder phases unlock as you progress. Keep going.
      </p>
    </div>
  )
}
