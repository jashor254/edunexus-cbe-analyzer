// app/teacher/assessment/page.tsx
//
// PRP-2 (Teacher Workspace Foundation Implementation, ADR-0019 §4) — a thin
// composition page. PRP-1's audit found Assessment had no unifying nav
// entry: marks entry (per class, lib/assessments) and end-of-term
// lock/publish (lib/core/report-cards, at /teacher/core-term) were two
// steps of one job a teacher could only reach through unrelated drill-down
// paths. This page composes existing reads only — getPendingAssessments()
// (lib/assessments/getters.ts, already built) and a link to the existing
// End of Term page — no new calculation, no new table, no new service.

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PieChart, ArrowRight, CalendarCheck, ClipboardCheck } from 'lucide-react'
import { getPendingAssessments } from '@/lib/assessments/getters'

export const dynamic = 'force-dynamic'

export default async function AssessmentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = createServiceClient()
  const { data: teacher } = await db
    .from('teachers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!teacher) redirect('/teacher/setup')

  const pending = await getPendingAssessments(teacher.id)

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <PieChart className="w-5 h-5 text-teal-600" /> Assessment
        </h1>
        <p className="text-sm text-slate-500">Enter marks for a test, then lock and publish at the end of term.</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Marks Not Yet Entered</h2>
        {pending.length === 0 && (
          <p className="text-sm text-slate-500 border border-slate-200 rounded-2xl bg-white p-4">
            No assessments are waiting for marks right now. Create one from a class page.
          </p>
        )}
        {pending.map(a => (
          <Link
            key={a.id}
            href={`/teacher/classes/${a.class_id}/assessments/${a.id}`}
            className="flex items-center justify-between gap-3 border border-slate-200 rounded-2xl bg-white p-4 hover:-translate-y-0.5 hover:shadow-sm transition-all group"
          >
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-900 truncate">{a.title}</p>
              <p className="text-xs text-slate-400 truncate">{a.class_name} · Term {a.term} · {a.year}</p>
            </div>
            <span className="flex items-center gap-1 text-xs font-bold text-teal-600 group-hover:text-teal-700 shrink-0">
              <ClipboardCheck className="w-3.5 h-3.5" /> Enter Marks <ArrowRight className="w-3 h-3" />
            </span>
          </Link>
        ))}
      </section>

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">End of Term</h2>
        <Link
          href="/teacher/core-term"
          className="flex items-center justify-between gap-3 border border-slate-200 rounded-2xl bg-white p-4 hover:-translate-y-0.5 hover:shadow-sm transition-all group"
        >
          <div>
            <p className="text-sm font-black text-slate-900">Official Report Cards</p>
            <p className="text-xs text-slate-400">Lock assessments, compute summaries, publish report cards.</p>
          </div>
          <span className="flex items-center gap-1 text-xs font-bold text-teal-600 group-hover:text-teal-700 shrink-0">
            <CalendarCheck className="w-3.5 h-3.5" /> Open <ArrowRight className="w-3 h-3" />
          </span>
        </Link>
      </section>
    </div>
  )
}
