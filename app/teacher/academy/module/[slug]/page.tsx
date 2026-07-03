export const dynamic = 'force-dynamic'

import '../../academy-content.css'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Clock, BookOpen, CheckCircle2 } from 'lucide-react'
import { getModuleWithLessons, getAdjacentModules } from '@/lib/academy/queries'
import { getReflectionsForModule } from '@/lib/academy/reflections'
import { getMissionsForModule } from '@/lib/academy/missions'
import { getEvidenceForModule, getRecentPlans } from '@/lib/academy/evidence'
import LessonAccordion from '@/components/academy/LessonAccordion'
import MissionCard from '@/components/academy/MissionCard'
import type { AcademyReflection } from '@/lib/academy/types'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function ModulePage({ params }: Props) {
  const { slug } = await params

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

  const mod = await getModuleWithLessons(slug, teacher.id)
  if (!mod) notFound()

  const lessonIds = mod.lessons.map(l => l.id)

  const [{ prev, next }, reflectionRows, missions, evidenceMap, recentPlans] = await Promise.all([
    getAdjacentModules(mod.order, mod.phase),
    getReflectionsForModule(teacher.id, mod.id),
    getMissionsForModule(mod.id, teacher.id),
    getEvidenceForModule(teacher.id, lessonIds),
    getRecentPlans(teacher.id),
  ])

  const initialReflections = reflectionRows.reduce<Record<string, AcademyReflection>>(
    (acc, r) => { acc[r.lesson_id] = r; return acc },
    {}
  )

  const pct = mod.lessons.length > 0
    ? Math.round((mod.completedCount / mod.lessons.length) * 100)
    : 0

  const isComplete = mod.completedCount === mod.lessons.length && mod.lessons.length > 0

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Hero */}
      <div className="bg-[#0c1929] relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-size-[40px_40px]" />
        <div
          className="absolute top-0 left-1/3 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-20"
          style={{ background: mod.color ?? '#14b8a6' }}
        />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-10">
          {/* Breadcrumb */}
          <Link
            href="/teacher/academy"
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-teal-400 text-xs font-semibold transition mb-5"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> AI Academy
          </Link>

          {/* Module badge */}
          <div className="flex items-center gap-2 mb-3">
            <span
              className="text-xs font-black px-3 py-1.5 rounded-lg"
              style={{
                background: `${mod.color ?? '#14b8a6'}25`,
                color: mod.color ?? '#14b8a6',
              }}
            >
              Module {mod.order} · Phase {mod.phase}
            </span>
            {isComplete && (
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> Complete
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">{mod.title}</h1>
          {mod.description && (
            <p className="text-slate-400 mt-2 text-sm leading-relaxed max-w-xl">{mod.description}</p>
          )}

          {/* Meta */}
          <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
            {mod.estimated_mins && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> {mod.estimated_mins} min
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> {mod.lessons.length} lessons
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-6">
            <div className="flex justify-between text-xs text-slate-400 mb-2">
              <span>{mod.completedCount}/{mod.lessons.length} lessons completed</span>
              <span className="font-bold" style={{ color: mod.color ?? '#14b8a6' }}>{pct}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: mod.color ?? '#14b8a6',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Lessons */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <LessonAccordion
          lessons={mod.lessons}
          moduleColor={mod.color ?? '#14b8a6'}
          moduleId={mod.id}
          initialReflections={initialReflections}
          initialEvidence={evidenceMap}
          recentPlans={recentPlans}
        />

        {/* Missions section */}
        {missions.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs font-black text-gray-400 uppercase tracking-wider shrink-0">
                Module Missions
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <p className="text-xs text-gray-500 mb-4 text-center">
              Missions turn theory into practice. Complete them to earn XP and build real AI judgement.
            </p>
            <div className="space-y-3">
              {missions.map(m => (
                <MissionCard key={m.id} mission={m} moduleColor={mod.color ?? '#14b8a6'} />
              ))}
            </div>
          </div>
        )}

        {/* Module navigation */}
        <div className="mt-10 flex items-center justify-between gap-4">
          {prev ? (
            <Link
              href={`/teacher/academy/mod/${prev.slug}`}
              className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 hover:border-gray-300 hover:shadow-sm px-4 py-2.5 rounded-xl text-sm font-bold transition"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="max-w-35 truncate">{prev.title}</span>
            </Link>
          ) : (
            <Link
              href="/teacher/academy"
              className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 hover:border-gray-300 hover:shadow-sm px-4 py-2.5 rounded-xl text-sm font-bold transition"
            >
              <ChevronLeft className="w-4 h-4" /> All Modules
            </Link>
          )}

          {next ? (
            <Link
              href={`/teacher/academy/mod/${next.slug}`}
              className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition hover:opacity-90 shadow-sm"
              style={{ background: mod.color ?? '#14b8a6' }}
            >
              <span className="max-w-35 truncate">{next.title}</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          ) : isComplete ? (
            <Link
              href="/teacher/academy/certificate"
              className="flex items-center gap-2 bg-linear-to-r from-amber-500 to-yellow-400 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition shadow-sm"
            >
              Claim Certificate <ChevronRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              href="/teacher/academy"
              className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition shadow-sm"
              style={{ background: mod.color ?? '#14b8a6' }}
            >
              All Modules <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
