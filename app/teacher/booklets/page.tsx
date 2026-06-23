import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { BookOpen, ChevronRight, ClipboardList } from 'lucide-react'

export default async function BookletsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const db = createServiceClient()

  const { data: teacher } = await db
    .from('teachers')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!teacher) redirect('/auth/login')

  const { data: schemes } = await db
    .from('schemes_of_work')
    .select('id, school, learning_area, grade, term, year, total_lessons')
    .eq('teacher_id', teacher.id)
    .order('year', { ascending: false })
    .order('term', { ascending: false })

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="bg-[#0c1929] px-4 sm:px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-900/40">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-black text-white">Booklets</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Live Record of Work — print-ready for TSC inspection
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {!schemes?.length ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
            <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <h3 className="font-black text-gray-700 mb-1">No schemes yet</h3>
            <p className="text-gray-400 text-sm">
              Generate a Scheme of Work first — booklets are created automatically.
            </p>
            <Link
              href="/teacher/scheme-of-work/new"
              className="inline-block mt-4 text-sm font-bold text-teal-600 hover:underline"
            >
              Create Scheme →
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {schemes.map(scheme => (
              <Link
                key={scheme.id}
                href={`/teacher/booklet/${scheme.id}`}
                className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 hover:border-teal-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4 text-teal-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-gray-900 text-sm truncate">
                      {scheme.learning_area}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Grade {scheme.grade} · Term {scheme.term} · {scheme.year}
                      {scheme.total_lessons ? ` · ${scheme.total_lessons} lessons` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 shrink-0 group-hover:text-teal-700">
                  View Booklet <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
