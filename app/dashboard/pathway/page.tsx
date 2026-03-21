// app/dashboard/pathway/page.tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Target, ArrowLeft, Sparkles, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { 
  getPathwayRecommendation, 
  getPathwayBadge, 
  getTierBadge,
  type SubjectScores 
} from '@/lib/pathwayRecommendations'

export default async function PathwayPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get latest student with assessments
  const { data: students } = await supabase
    .from('students')
    .select(`
      *,
      assessments (
        subject_scores,
        created_at
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  const student = students?.[0]
  const latestAssessment = student?.assessments?.[0]
  const scores = latestAssessment?.subject_scores as SubjectScores | undefined

  let recommendation = null
  if (scores && Object.keys(scores).length > 0) {
    recommendation = getPathwayRecommendation(scores)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium">
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-600" />
            <span className="font-bold">Pathway Analysis</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-black text-slate-900 mb-4 text-center">
          Career Pathway <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Recommendation</span>
        </h1>
        <p className="text-lg text-slate-600 text-center mb-12">
          For junior students (Grades 7-9) • CBC Aligned
        </p>

        {recommendation ? (
          <div className="space-y-8">
            {/* Main Recommendation */}
            <div className={`rounded-3xl p-8 border-2 ${
              getPathwayBadge(recommendation.recommended_pathway).border
            } ${
              getPathwayBadge(recommendation.recommended_pathway).bg
            } shadow-xl`}>
              
              {/* Badge */}
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 ${
                getTierBadge(recommendation.tier).bg
              } ${getTierBadge(recommendation.tier).text}`}>
                <Sparkles className="w-4 h-4" />
                <span className="font-bold text-sm">{getTierBadge(recommendation.tier).label}</span>
              </div>

              {/* Pathway */}
              <div className="flex items-center gap-4 mb-6">
                <span className="text-5xl">{getPathwayBadge(recommendation.recommended_pathway).icon}</span>
                <div>
                  <h2 className="text-3xl font-black text-slate-900">
                    {recommendation.recommended_pathway}
                  </h2>
                  <p className="text-slate-600">Recommended Pathway</p>
                </div>
              </div>

              {/* Messages */}
              <div className="space-y-4">
                <p className="text-lg font-bold text-slate-800">{recommendation.confidence_message}</p>
                <div className="bg-white/50 backdrop-blur rounded-xl p-6 whitespace-pre-line">
                  {recommendation.encouraging_message}
                </div>
              </div>

              {/* Score */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <p className="text-sm text-slate-500">Average Score</p>
                <p className="text-3xl font-black text-slate-900">{recommendation.average_score}</p>
              </div>
            </div>

            {/* Alternative Pathway */}
            {recommendation.alternative_pathway && (
              <div className="bg-white rounded-3xl p-8 border-2 border-amber-200 shadow-lg">
                <h3 className="text-xl font-black mb-4">Alternative: {recommendation.alternative_pathway.pathway}</h3>
                <div className="space-y-4">
                  <p className="text-slate-700">{recommendation.alternative_pathway.message}</p>
                  <div className="bg-amber-50 rounded-xl p-4">
                    <p className="font-bold mb-2">🎯 Focus Areas:</p>
                    <ul className="space-y-2">
                      {recommendation.alternative_pathway.improvement_needed.map((item, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-amber-500 rounded-full" />
                          <span className="text-sm">
                            <span className="font-bold">{item.subject}:</span> {item.current_score} → {item.target_score}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Timestamp */}
            <p className="text-center text-xs text-slate-400">
              Analysis generated: {new Date(recommendation.calculated_at).toLocaleString()}
            </p>
          </div>
        ) : (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-12 text-center">
            <Target className="w-16 h-16 text-amber-600 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-amber-900 mb-2">No Assessment Data</h2>
            <p className="text-amber-700 mb-6">Add an assessment first to get pathway recommendations.</p>
            <Link
              href="/dashboard/assessments/add"
              className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all"
            >
              Add Assessment
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}