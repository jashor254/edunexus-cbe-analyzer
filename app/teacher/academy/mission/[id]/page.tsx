export const dynamic = 'force-dynamic'

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getMission } from '@/lib/academy/missions'
import MissionClient from './MissionClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function MissionPage({ params }: Props) {
  const { id } = await params

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

  const mission = await getMission(id, teacher.id)
  if (!mission) notFound()

  // Get the parent module to know which module page to link back to
  const { data: module } = await db
    .from('academy_modules')
    .select('slug, title, color')
    .eq('id', mission.module_id)
    .single()

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-[#0c1929] relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-10">
          <Link
            href={module ? `/teacher/academy/module/${module.slug}` : '/teacher/academy'}
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-teal-400 text-xs font-semibold transition mb-5"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {module?.title ?? 'AI Academy'}
          </Link>
          <MissionClient mission={mission} moduleColor={module?.color ?? '#14b8a6'} />
        </div>
      </div>
    </div>
  )
}
