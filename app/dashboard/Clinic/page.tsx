// app/dashboard/clinic/page.tsx
export const dynamic = 'force-dynamic'

import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  FileText,
  TrendingUp,
  Award,
  ArrowRight,
  Sparkles,
  Brain,
  Target,
  Download,
  ChevronRight,
  Users,
  GraduationCap,
  AlertCircle,
  CheckCircle2,
  Zap,
} from 'lucide-react'

export default async function ClinicDashboardPage() {
  const supabase = await createClient()

  // 1. Auth
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  // 2. Parallel queries — ✅ fixed table names
  const [
    { data: students },
    { data: tokenBalance },
    { data: subscription },
  ] = await Promise.all([
    supabase
      .from('students')
      .select(`*, assessments(id, term, year, subject_scores, created_at)`)
      .eq('user_id', user.id)
      .order('name'),

    // ✅ token_balances (not user_tokens)
    supabase
      .from('token_balances')
      .select('balance')
      .eq('user_id', user.id)
      .single(),

    // ✅ status + expires_at + plan (not sub_status, end_date, plan_type)
    supabase
      .from('subscriptions')
      .select('plan, expires_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .single(),
  ])

  const hasSubscription = !!subscription
  const tokens          = tokenBalance?.balance || 0
  const hasAccess       = hasSubscription || tokens > 0

  // 3. Stats
  const totalStudents      = students?.length || 0
  const totalAssessments   = students?.reduce((acc, s) => acc + (s.assessments?.length || 0), 0) || 0
  const studentsNeedingAttention = students?.filter(s => {
    const latest = s.assessments?.[s.assessments.length - 1]
    if (!latest?.subject_scores) return false
    const vals  = Object.values(latest.subject_scores) as number[]
    const avg   = vals.reduce((a, b) => a + b, 0) / vals.length
    return avg < 2.5
  }).length || 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">

      {/* Ambient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-20 right-20 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 rounded-xl blur-md opacity-60" />
              <div className="relative w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900">Academic Clinic</h1>
              <p className="text-sm text-slate-500">Deep insights • Personalized plans • Career guidance</p>
            </div>
          </div>

          {/* Access badge */}
          <div className={`px-4 py-2 rounded-2xl flex items-center gap-2 ${
            hasAccess
              ? 'bg-green-100 border-2 border-green-300'
              : 'bg-amber-100 border-2 border-amber-300'
          }`}>
            {hasAccess ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="font-bold text-green-800">
                  {hasSubscription ? `✨ ${subscription.plan} Plan` : `${tokens} tokens left`}
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <Link href="/pricing" className="font-bold text-amber-800 hover:underline">
                  Buy tokens to continue
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Users,      color: 'blue',   value: totalStudents,                           label: 'Students'      },
            { icon: FileText,   color: 'purple', value: totalAssessments,                        label: 'Assessments'   },
            { icon: AlertCircle,color: 'amber',  value: studentsNeedingAttention,                label: 'Need Attention' },
            { icon: TrendingUp, color: 'green',  value: totalStudents - studentsNeedingAttention, label: 'On Track'      },
          ].map(({ icon: Icon, color, value, label }) => (
            <div key={label} className="bg-white rounded-2xl p-6 border-2 border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 bg-${color}-100 rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 text-${color}-600`} />
                </div>
                <span className="text-2xl font-black text-slate-900">{value}</span>
              </div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>

        {/* Students grid */}
        {students && students.length > 0 ? (
          <div className="space-y-6">
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-blue-600" />
              Your Students
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {students.map((student) => {
                const assessmentsSorted = [...(student.assessments || [])].sort(
                  (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                )
                const latest      = assessmentsSorted[0]
                const scores      = latest?.subject_scores || {}
                const scoreValues = Object.values(scores) as number[]
                const avgScore    = scoreValues.length
                  ? (scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length).toFixed(1)
                  : 'N/A'
                const needsAttention    = avgScore !== 'N/A' && parseFloat(avgScore) < 2.5
                const assessmentCount   = student.assessments?.length || 0
                const hasAssessments    = assessmentCount > 0

                return (
                  <div
                    key={student.id}
                    className="group bg-white rounded-3xl p-6 border-2 border-slate-100 hover:border-blue-200 transition-all hover:shadow-xl"
                  >
                    {/* Student header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                          needsAttention ? 'bg-amber-100' : 'bg-gradient-to-br from-blue-100 to-indigo-100'
                        }`}>
                          <GraduationCap className={`w-6 h-6 ${needsAttention ? 'text-amber-600' : 'text-blue-600'}`} />
                        </div>
                        <div>
                          <h3 className="font-black text-slate-900">{student.name}</h3>
                          <p className="text-sm text-slate-500">Grade {student.grade}</p>
                        </div>
                      </div>
                      {student.current_pathway && (
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                          {student.current_pathway}
                        </span>
                      )}
                    </div>

                    {/* Mini stats */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-xs text-slate-500 mb-1">Average</p>
                        <p className={`text-xl font-black ${
                          avgScore === 'N/A'               ? 'text-slate-400' :
                          parseFloat(avgScore) >= 3.0      ? 'text-green-600' :
                          parseFloat(avgScore) >= 2.0      ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {avgScore}
                        </p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-xs text-slate-500 mb-1">Assessments</p>
                        <p className="text-xl font-black text-slate-900">{assessmentCount}</p>
                      </div>
                    </div>

                    {/* Buttons */}
                    <div className="space-y-2">
                      {hasAssessments ? (
                        <Link
                          href={`/dashboard/clinic/reports/${student.id}`}
                          className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:from-blue-700 hover:to-indigo-700 transition-all group"
                        >
                          <FileText className="w-4 h-4" />
                          View Full Report
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                      ) : (
                        <Link
                          href={`/dashboard/assessments/add?student=${student.id}`}
                          className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-all"
                        >
                          Add Assessment First
                        </Link>
                      )}

                      {/* ✅ Fixed: POST request with proper body */}
                      {hasAccess && hasAssessments && (
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch('/api/clinic/download', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  studentId: student.id,
                                  assessments: assessmentsSorted,
                                  profile: {
                                    name:        student.name,
                                    grade:       student.grade,
                                    pathway:     student.current_pathway,
                                    dateOfBirth: student.date_of_birth,
                                  }
                                })
                              })
                              if (res.ok) {
                                const blob = await res.blob()
                                const url  = URL.createObjectURL(blob)
                                const a    = document.createElement('a')
                                a.href     = url
                                a.download = `${student.name.replace(/\s+/g, '_')}_Report.pdf`
                                a.click()
                                URL.revokeObjectURL(url)
                              } else {
                                const err = await res.json()
                                alert(err.error || 'Download failed. Try again.')
                              }
                            } catch {
                              alert('Network error. Please try again.')
                            }
                          }}
                          className="w-full py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:border-blue-300 hover:text-blue-600 transition-all"
                        >
                          <Download className="w-4 h-4" />
                          Download PDF
                        </button>
                      )}
                    </div>

                    {/* Needs attention tag */}
                    {needsAttention && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">
                        <AlertCircle className="w-4 h-4" />
                        <span className="font-bold">Needs attention</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-slate-200">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">No students yet</h3>
            <p className="text-slate-500 mb-6">Add your first student to start using the Academic Clinic</p>
            <Link
              href="/dashboard/students/add"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:scale-105 transition-all"
            >
              <GraduationCap className="w-5 h-5" />
              Add Student
            </Link>
          </div>
        )}

        {/* Features banner */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl p-8 text-white shadow-2xl">
          <h3 className="text-2xl font-black mb-6 flex items-center gap-2">
            <Sparkles className="w-6 h-6" />
            What's in the Academic Clinic?
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Brain,      title: 'Deep Analysis',    desc: 'Subject-by-subject breakdown with learning patterns' },
              { icon: Target,     title: 'Pathway Guidance', desc: 'For junior students (Grades 7-9)'                    },
              { icon: TrendingUp, title: 'Career Matching',  desc: 'For senior students (Grades 10-12)'                  },
              { icon: Download,   title: 'PDF Reports',      desc: 'Downloadable reports for school and parents'         },
            ].map((f, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                  <f.icon className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-black text-lg mb-2">{f.title}</h4>
                <p className="text-sm text-indigo-100">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 text-right">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 rounded-xl font-bold hover:bg-indigo-50 transition-all"
            >
              <Zap className="w-4 h-4" />
              {hasAccess ? 'Get more tokens' : 'Unlock access'}
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}