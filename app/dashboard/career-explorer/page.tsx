// app/dashboard/career-explorer/page.tsx
// THE one main career page — all others redirect here.

export const dynamic = 'force-dynamic'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CareerExplorerClient from './CareerExplorerClient'

export default async function CareerExplorerPage() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  // Fetch ALL students for this user
  const { data: students } = await supabase
    .from('students')
    .select('id, name, grade, curriculum_type, year_level')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (!students || students.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🎯</div>
          <h2 className="text-2xl font-black mb-3">Add a Student First</h2>
          <p className="text-slate-400 mb-6">
            Career Intelligence needs a student profile to get started.
          </p>
          <Link
            href="/dashboard/assessments/add"
            className="inline-flex items-center gap-2 bg-amber-500 text-slate-950 px-6 py-3 rounded-xl font-black hover:bg-amber-400 transition-all"
          >
            Add Student & Assessment →
          </Link>
        </div>
      </div>
    )
  }

  // For the first (most recent) student, fetch their latest assessment
  const firstStudent = students[0]
  const { data: latestAssessments } = await supabase
    .from('assessments')
    .select('id, subject_scores, grade, curriculum_type, term, year')
    .eq('student_id', firstStudent.id)
    .order('created_at', { ascending: false })
    .limit(1)

  const latestAssessment = latestAssessments?.[0] ?? null

  return (
    <CareerExplorerClient
      students={students}
      initialStudentId={firstStudent.id}
      initialAssessment={latestAssessment}
    />
  )
}
