// app/dashboard/clinic/reports/[studentId]/page.tsx
export const dynamic = 'force-dynamic'

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { adaptCanonicalCareersForClinic } from '@/lib/academicClinic/canonicalCareerAdapter'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, 
  Download, 
  FileText, 
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  Brain,
  Target,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Clock,
  Users
} from 'lucide-react'
import {
  generateReport,
  formatSubjectName,
  calculateVitals,
  generateActionPlan,
  generateJuniorGuidance,
  type SubjectProgress,
  type StudentProfile,
  type Vitals,
  type ActionPlan,
  type JuniorGuidance,
  type SeniorGuidance
} from '@/lib/academicClinic/reportGenerator'
import { buildSeniorGuidanceFromCanonical } from '@/lib/academicClinic/canonicalSeniorGuidance'
import { resolveCanonicalGrowthInput } from '@/lib/academicClinic/canonicalTrajectory'
import { resolveCanonicalCareerMatches } from '@/lib/learnerIntelligence/careerIntelligenceOrchestration'
import type { CanonicalGrowthInput } from '@/lib/academicClinic/reportGenerator'
import { DownloadReportButton } from '@/components/clinic/DownloadReportButton'

export default async function StudentReportPage({
  params
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params

  const supabase = await createClient()

  // 1. Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  // 2. Verify student belongs to this user — use service client for consistent
  //    RLS-bypass behaviour (ownership enforced via the user_id filter)
  const db = createServiceClient()
  const { data: student, error: studentError } = await db
    .from('students')
    .select('id, name, grade, current_pathway, school, date_of_birth')
    .eq('id', studentId)
    .eq('user_id', user.id)
    .single()

  if (studentError || !student) {
    notFound()
  }

  // 3. Fetch assessments
  const { data: assessments, error: assessmentsError } = await db
    .from('assessments')
    .select('subject_scores, term, year')
    .eq('student_id', studentId)
    .order('created_at', { ascending: true })

  if (assessmentsError || !assessments || assessments.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-amber-50 border-4 border-amber-200 rounded-3xl p-12 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-amber-900 mb-2">No Assessments Found</h2>
          <p className="text-amber-700 mb-6">Add assessments first to generate a report.</p>
          <Link 
            href={`/dashboard/assessments/add?student=${student.id}`}
            className="inline-block bg-amber-600 text-white px-8 py-3 rounded-full font-bold hover:bg-amber-700 transition-colors"
          >
            Add Assessment
          </Link>
        </div>
      </div>
    )
  }

  // 4. Prepare subject data for report
  const latestAssessment = assessments[assessments.length - 1]
  const currentScores = latestAssessment.subject_scores || {}

  // Build subject progress array
  const subjectProgress: SubjectProgress[] = Object.keys(currentScores).map(subject => {
    const scores = assessments
      .map(a => a.subject_scores?.[subject])
      .filter((s): s is number => s !== undefined && s !== null)
    
    const latestScore = scores[scores.length - 1]
    
    // Calculate trend
    let trend: 'improving' | 'declining' | 'stable' = 'stable'
    if (scores.length > 1) {
      if (scores[scores.length - 1] > scores[0]) trend = 'improving'
      else if (scores[scores.length - 1] < scores[0]) trend = 'declining'
    }
    
    // Calculate velocity
    let velocity = 0
    if (scores.length > 1) {
      let totalChange = 0
      for (let i = 1; i < scores.length; i++) {
        totalChange += scores[i] - scores[i-1]
      }
      velocity = totalChange / (scores.length - 1)
    }
    
    return {
      subject,
      displayName: formatSubjectName(subject),
      level: latestScore as 1 | 2 | 3 | 4,
      trend,
      velocity: parseFloat(velocity.toFixed(2)),
      previousScores: scores
    }
  })

  // Calculate vitals
  const vitals: Vitals = calculateVitals(subjectProgress)
  const average = vitals.overallAverage

  // Create student profile
  const studentProfile: StudentProfile = {
    id: student.id,
    name: student.name,
    grade: student.grade,
    level: student.grade >= 10 ? 'Senior School' : 'Junior School',
    term: latestAssessment.term || 1,
    year: latestAssessment.year || new Date().getFullYear(),
    pathway: student.current_pathway,
    school: student.school
  }

  // Create action plan
  const actionPlan: ActionPlan = generateActionPlan(subjectProgress)

  // Generate guidance based on grade level
  const isJunior = student.grade <= 9

  // Phase 9.1.7 — canonical careers CAREER_DATABASE does not already
  // represent, so this surface (like assessmentPipeline.ts, Phase 9.1.6)
  // also sees careers published after the one-off migration, in both normal
  // matching and dream-career lookup.
  let additionalCareers: import('@/lib/academicClinic/careerEngine').CareerData[] = []
  try {
    const canonicalCareers = await repos.careers.getAllCareersWithCOS()
    additionalCareers = adaptCanonicalCareersForClinic(canonicalCareers)
  } catch (err) {
    console.error('[clinic/reports] canonical career fetch failed (non-fatal — falls back to CAREER_DATABASE only):', err)
  }

  const juniorGuidance: JuniorGuidance | undefined = isJunior ? generateJuniorGuidance(subjectProgress) : undefined

  // Phase 2.1 (Decision 2 — one canonical career-ranking owner): this is the
  // nav-reachable "View Report" surface (4 real entry points into this
  // route, per the Phase 2 caller map) — it now sources top careers from
  // resolveCanonicalCareerMatches(), the same canonical engine the
  // download route and the auto-emailed pipeline now use, instead of the
  // legacy CareerEngine.
  let seniorGuidance: SeniorGuidance | undefined
  if (!isJunior) {
    try {
      const canonical = await resolveCanonicalCareerMatches(student.id)
      seniorGuidance = buildSeniorGuidanceFromCanonical(canonical, subjectProgress, student.name?.split(' ')[0] ?? 'This student', student.grade)
    } catch (err) {
      console.error('[clinic/reports] canonical career match resolution failed (non-fatal — page still renders):', err)
      seniorGuidance = buildSeniorGuidanceFromCanonical({ matches: [], mode: 'planning', insufficientEvidence: true, generatedAt: null }, subjectProgress, student.name?.split(' ')[0] ?? 'This student', student.grade)
    }
  }

  // Phase 2.2 (canonical trajectory closure, Step 22 — cross-surface
  // consistency): same canonical Projection growth/risk read the other two
  // live report paths now use, so this nav-reachable surface can't disagree
  // with the auto-emailed report or the paid download for the same learner.
  let canonicalGrowth: CanonicalGrowthInput | null = null
  try {
    canonicalGrowth = await resolveCanonicalGrowthInput(student.id)
  } catch (err) {
    console.error('[clinic/reports] canonical growth resolution failed (non-fatal — page still renders):', err)
  }

  // Generate final report
  const report = generateReport(
    studentProfile,
    subjectProgress,
    vitals,
    actionPlan,
    assessments,
    juniorGuidance,
    seniorGuidance,
    undefined,
    additionalCareers,
    canonicalGrowth
  )

  // Access status. Both reads here were querying columns that do not exist —
  // `balance` on the legacy `user_tokens` table (its column is
  // `tokens_remaining`) and `sub_status` on `subscriptions` (its column is
  // `status`) — so both silently returned null and hasAccess was always false.
  // Canonical balances live in `token_balances`, and an active subscription is
  // status='active' AND not yet expired, matching
  // repos.billing.findActiveSubscription(). The legacy table is left in place.
  const { data: tokens } = await supabase
    .from('token_balances')
    .select('balance')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  const hasAccess = Boolean(subscription) || (tokens?.balance ?? 0) > 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      
      {/* Header */}
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link 
            href="/dashboard/clinic" 
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Clinic
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <span className="font-bold">EDUNEXUS</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Student Header */}
        <div className="bg-white rounded-3xl p-8 border-2 border-slate-100 shadow-lg">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-slate-900">
                  {student.name}
                </h1>
                <div className="flex flex-wrap gap-3 mt-2">
                  <span className="px-3 py-1 bg-slate-100 rounded-full text-sm font-bold">
                    Grade {student.grade}
                  </span>
                  <span className="px-3 py-1 bg-slate-100 rounded-full text-sm font-bold">
                    Term {report.studentProfile.term} • {report.studentProfile.year}
                  </span>
                  {student.current_pathway && (
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-bold">
                      {student.current_pathway}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Download Button */}
            {hasAccess && (
              <DownloadReportButton
                studentId={student.id}
                studentName={student.name}
                assessments={assessments}
                profile={{
                  name: student.name,
                  grade: student.grade,
                  pathway: student.current_pathway,
                  dateOfBirth: student.date_of_birth,
                }}
              />
            )}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-6 border-2 border-slate-100">
            <p className="text-sm text-slate-500 mb-1">Average Score</p>
            <p className="text-3xl font-black text-slate-900">{report.vitals.overallAverage}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 border-2 border-slate-100">
            <p className="text-sm text-slate-500 mb-1">Strengths</p>
            <p className="text-3xl font-black text-green-600">{report.vitals.strengths}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 border-2 border-slate-100">
            <p className="text-sm text-slate-500 mb-1">Need Work</p>
            <p className="text-3xl font-black text-amber-600">{report.vitals.needsWork}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 border-2 border-slate-100">
            <p className="text-sm text-slate-500 mb-1">Urgent</p>
            <p className="text-3xl font-black text-red-600">{report.vitals.urgent}</p>
          </div>
        </div>

        {/* Subject Breakdown */}
        <div className="bg-white rounded-3xl p-8 border-2 border-slate-100">
          <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2">
            <Brain className="w-6 h-6 text-blue-600" />
            Subject Analysis
          </h2>

          <div className="space-y-3">
            {report.subjectBreakdown.map((subject, idx) => (
              <div key={idx} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black ${
                  subject.level >= 3 ? 'bg-green-100 text-green-700' :
                  subject.level >= 2 ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {subject.level}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-900">{subject.displayName}</span>
                    {subject.level <= 2 && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                        Needs Attention
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>Trend: {subject.trend}</span>
                    <span>•</span>
                    <span>Velocity: {subject.velocity > 0 ? '+' : ''}{subject.velocity}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Guidance Section — pilot gate fix (2026-08-25): a zero-evidence
            learner used to see this same card headlined with a confident
            "Pathway Recommendation" (recommendedPathway defaulted to 'Arts
            & Sports Science' via a NaN-average comparison that always fell
            through). Render the honest insufficient-evidence state instead
            of the recommendation heading/reasoning in that case. */}
        {isJunior && report.juniorGuidance && !report.juniorGuidance.insufficientEvidence && (
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl p-8 text-white">
            <h2 className="text-2xl font-black mb-4 flex items-center gap-2">
              <Target className="w-6 h-6" />
              Pathway Recommendation
            </h2>
            <p className="text-xl font-bold mb-4">{report.juniorGuidance.recommendedPathway}</p>
            <p className="text-indigo-100 mb-4">{report.juniorGuidance.reasoning}</p>

            {report.juniorGuidance.strengths.length > 0 && (
              <div className="mt-4">
                <p className="font-bold mb-2">💪 Strengths:</p>
                <ul className="list-disc list-inside text-indigo-100">
                  {report.juniorGuidance.strengths.slice(0, 3).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {isJunior && report.juniorGuidance?.insufficientEvidence && (
          <div className="bg-slate-100 rounded-3xl p-8 text-slate-700">
            <h2 className="text-2xl font-black mb-4 flex items-center gap-2">
              <Target className="w-6 h-6" />
              Pathway Recommendation
            </h2>
            <p className="text-slate-600">
              Not enough evidence yet to recommend a pathway. Once at least one subject assessment is
              recorded for this learner, a pathway recommendation will appear here.
            </p>
          </div>
        )}

        {!isJunior && report.seniorGuidance && (
          <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-3xl p-8 text-white">
            <h2 className="text-2xl font-black mb-4 flex items-center gap-2">
              <Award className="w-6 h-6" />
              Career Matches
            </h2>
            {report.seniorGuidance.topCareers.length > 0 ? (
              <div className="grid md:grid-cols-3 gap-4">
                {report.seniorGuidance.topCareers.map((career, idx) => (
                  <div key={idx} className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
                    <p className="font-bold text-lg mb-1">{career.name}</p>
                    <p className="text-2xl font-black mb-2">{career.matchPercentage}%</p>
                    <p className="text-sm text-indigo-100">{career.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-indigo-100">
                No confident career match yet — complete more assessments to unlock personalised recommendations.
              </p>
            )}
          </div>
        )}

        {/* Action Plan */}
        <div className="bg-white rounded-3xl p-8 border-2 border-slate-100">
          <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2">
            <Clock className="w-6 h-6 text-blue-600" />
            Action Plan
          </h2>

          <div className="space-y-4">
            {report.actionPlan.immediate.length > 0 && (
              <div>
                <h3 className="font-bold text-red-600 mb-2">Urgent (This Week)</h3>
                <ul className="space-y-2">
                  {report.actionPlan.immediate.slice(0, 3).map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-slate-700">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {report.actionPlan.shortTerm.length > 0 && (
              <div className="mt-4">
                <h3 className="font-bold text-amber-600 mb-2">This Month</h3>
                <ul className="space-y-2">
                  {report.actionPlan.shortTerm.slice(0, 3).map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-slate-700">
                      <CheckCircle2 className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Academic Summary */}
        {report.clinicalOverview && (
          <div className="bg-amber-50 border-l-4 border-amber-400 rounded-2xl p-6">
            <h2 className="font-black text-slate-900 mb-3 flex items-center gap-2">
              <Brain className="w-5 h-5 text-amber-600" />
              Academic Summary
            </h2>
            <p className="text-slate-700 leading-relaxed">
              {report.clinicalOverview.clinicalParagraph}
            </p>
          </div>
        )}

        {/* Holiday Plan */}
        {report.holidayPlan && (
          <div className="bg-white rounded-3xl p-8 border-2 border-slate-100">
            <h2 className="text-2xl font-black text-slate-900 mb-6">📅 3-Week Holiday Study Plan</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {report.holidayPlan.weeks.map((week: { weekNumber: number; theme: string; goal: string; activities: string[] }, i: number) => (
                <div key={i} className="bg-slate-50 rounded-2xl p-5">
                  <div className="font-black text-slate-900 mb-1">Week {week.weekNumber}</div>
                  <div className="text-sm font-bold text-blue-600 mb-2">{week.theme}</div>
                  <div className="text-xs text-slate-500 mb-3">{week.goal}</div>
                  <div className="space-y-1">
                    {week.activities.slice(0, 3).map((a: string, j: number) => (
                      <div key={j} className="text-xs text-slate-600 flex gap-2">
                        <span className="text-blue-400">▸</span>
                        <span>{a}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Learning Compass */}
        {report.learningCompassRec && (
          <div className="bg-slate-900 rounded-3xl p-8 text-white">
            <h2 className="text-xl font-black mb-4 flex items-center gap-2">
              🧭 Learning Compass — Start Here
            </h2>
            <p className="text-2xl font-black text-yellow-400 mb-2">
              {report.learningCompassRec.firstSessionSubject}
            </p>
            <p className="text-slate-300 mb-4">
              {report.learningCompassRec.sessionGoal}
            </p>
            <div className="space-y-2">
              {report.learningCompassRec.topicsToAsk.map((t: string, i: number) => (
                <div key={i} className="flex gap-3 text-sm text-slate-300">
                  <span className="text-yellow-400 font-bold w-5">{i + 1}.</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>
            <a
              href={`/learn?student=${studentId}`}
              className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-yellow-400 text-slate-900 rounded-xl font-black hover:bg-yellow-300 transition-colors"
            >
              Start Learning Compass Session →
            </a>
          </div>
        )}

        {/* Report ID */}
        <div className="text-center text-xs text-slate-400">
          <p>Report ID: {report.reportId}</p>
          <p>Generated: {new Date(report.generatedAt).toLocaleString()}</p>
        </div>
      </div>
    </div>
  )
}