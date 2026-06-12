export const dynamic = 'force-dynamic'

import '../../academy-content.css'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Clock, BookOpen, CheckCircle2 } from 'lucide-react'
import { getModuleWithLessons, getAdjacentModules } from '@/lib/academy/queries'
import LessonAccordion from '@/components/academy/LessonAccordion'

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

  const [module, adjacent] = await Promise.all([
    getModuleWithLessons(slug, teacher.id),
    (async () => {
      // We need the module order — fetch it first (already done above) or grab from module
      return null // resolved after module loads below
    })(),
  ])

  if (!module) notFound()

  const { prev, next } = await getAdjacentModules(module.order, module.phase)

  const pct = module.lessons.length > 0
    ? Math.round((module.completedCount / module.lessons.length) * 100)
    : 0

  const isComplete = module.completedCount === module.lessons.length && module.lessons.length > 0

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Hero */}
      <div className="bg-[#0c1929] relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div
          className="absolute top-0 left-1/3 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-20"
          style={{ background: module.color ?? '#14b8a6' }}
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
                background: `${module.color ?? '#14b8a6'}25`,
                color: module.color ?? '#14b8a6',
              }}
            >
              Module {module.order} · Phase {module.phase}
            </span>
            {isComplete && (
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> Complete
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">{module.title}</h1>
          {module.description && (
            <p className="text-slate-400 mt-2 text-sm leading-relaxed max-w-xl">{module.description}</p>
          )}

          {/* Meta */}
          <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
            {module.estimated_mins && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> {module.estimated_mins} min
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> {module.lessons.length} lessons
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-6">
            <div className="flex justify-between text-xs text-slate-400 mb-2">
              <span>{module.completedCount}/{module.lessons.length} lessons completed</span>
              <span className="font-bold" style={{ color: module.color ?? '#14b8a6' }}>{pct}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: module.color ?? '#14b8a6',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Lessons */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <LessonAccordion
          lessons={module.lessons}
          moduleColor={module.color ?? '#14b8a6'}
        />

        {/* Module navigation */}
        <div className="mt-10 flex items-center justify-between gap-4">
          {prev ? (
            <Link
              href={`/teacher/academy/module/${prev.slug}`}
              className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 hover:border-gray-300 hover:shadow-sm px-4 py-2.5 rounded-xl text-sm font-bold transition"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="max-w-[140px] truncate">{prev.title}</span>
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
              href={`/teacher/academy/module/${next.slug}`}
              className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition hover:opacity-90 shadow-sm"
              style={{ background: module.color ?? '#14b8a6' }}
            >
              <span className="max-w-[140px] truncate">{next.title}</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          ) : isComplete ? (
            <Link
              href="/teacher/academy/certificate"
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition shadow-sm"
            >
              Claim Certificate <ChevronRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              href="/teacher/academy"
              className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition shadow-sm"
              style={{ background: module.color ?? '#14b8a6' }}
            >
              All Modules <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
