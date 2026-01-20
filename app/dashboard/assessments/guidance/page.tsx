'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { supabase, type Student, type Assessment } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { 
  formatSubjectName, 
  getConfidenceBadge,
  getPathwayColor 
} from '@/lib/pathwayCalculator'
import { 
  getTierConfig,
  generateSubjectRecommendation,
} from '@/lib/adaptiveLearning'
import { analyzeSkillGaps } from '@/lib/competencyFramework'

// 1. Logic yote sasa iko ndani ya Component inaitwa GuidanceContent
function GuidanceContent() {
  const [student, setStudent] = useState<Student | null>(null)
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const studentId = searchParams.get('student')

  const loadData = useCallback(async () => {
    if (!studentId) return

    setLoading(true)
    setError(null)

    try {
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single()

      if (studentError) throw studentError
      if (studentData) setStudent(studentData)

      const { data: assessmentData, error: assessmentError } = await supabase
        .from('assessments')
        .select('*')
        .eq('student_id', studentId)
        .eq('grade_level', 'junior')
        .not('pathway_recommendations', 'is', null)
        .order('year', { ascending: true })
        .order('term', { ascending: true })

      if (assessmentError) throw assessmentError
      if (assessmentData) setAssessments(assessmentData)

    } catch (err) {
      console.error('Error loading data:', err)
      setError('Failed to load pathway guidance data')
    } finally {
      setLoading(false)
    }
  }, [studentId])

  useEffect(() => {
    if (!studentId) {
      router.push('/dashboard')
      return
    }
    loadData()
  }, [studentId, loadData, router])

  if (loading || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <div className="mt-4 text-xl font-semibold text-gray-700">Loading pathway guidance...</div>
        </div>
      </div>
    )
  }

  const latestAssessment = assessments.length > 0 ? assessments[assessments.length - 1] : null
  const latestRec = latestAssessment?.pathway_recommendations

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">← Back to Dashboard</Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{student.name}</h1>
          <p className="text-gray-600 mt-1">Grade {student.grade} • Junior School Pathway Guidance</p>
        </div>

        {assessments.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-gray-600 mb-4">No assessments with pathway guidance yet.</p>
            <Link href={`/dashboard/assessments/add?student=${studentId}`} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold">Add Assessment</Link>
          </div>
        ) : !latestRec ? (
          <div className="bg-yellow-50 p-6 rounded-xl"><p>Pathway recommendations not available yet.</p></div>
        ) : (
          <>
            {/* Pathway Affinity Section */}
            <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Current Pathway Affinity</h2>
                <div className={`px-4 py-2 rounded-full border-2 ${getConfidenceBadge(latestRec.confidence)}`}>
                  <span className="font-bold uppercase text-sm">{latestRec.confidence} Confidence</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {[
                  { name: 'STEM', score: latestRec.stem_score },
                  { name: 'Arts & Sports', score: latestRec.arts_sports_score },
                  { name: 'Social Sciences', score: latestRec.social_sciences_score }
                ].map((pathway) => {
                  const isTop = pathway.name === latestRec.top_pathway
                  const colors = getPathwayColor(pathway.name)
                  return (
                    <div key={pathway.name} className={`border-2 rounded-lg p-6 transition-all ${isTop ? `${colors.border} ${colors.bg} shadow-lg scale-105` : 'border-gray-200'}`}>
                      <h3 className="font-bold text-lg">{pathway.name}</h3>
                      <div className={`text-5xl font-bold mb-3 ${isTop ? colors.text : 'text-gray-700'}`}>{pathway.score}%</div>
                      <div className="w-full bg-gray-200 rounded-full h-4 mb-3">
                        <div className={`h-4 rounded-full ${isTop ? colors.bg : 'bg-gray-400'}`} style={{ width: `${pathway.score}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
                <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2 text-lg">💡 Guidance for Parents</h3>
                <div className="text-blue-800 leading-relaxed whitespace-pre-line">{latestRec.guidance_message}</div>
              </div>
            </div>

            {/* Learning Plans Section */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl shadow-lg p-8 mb-8 border-2 border-purple-300">
               <h2 className="text-2xl font-bold text-purple-900 mb-6">Personalized Learning Plans 🎓</h2>
               
               {(() => {
                 const scores = latestAssessment.subject_scores || {}
                 const allSubjects = Object.entries(scores).sort((a, b) => (a[1] as number) - (b[1] as number))
                 
                 return (
                   <div className="space-y-6">
                     {allSubjects.map(([subjectKey, score]) => {
                       const rec = generateSubjectRecommendation(formatSubjectName(subjectKey), score as number, subjectKey)
                       const config = getTierConfig(rec.tier)
                       const gaps = analyzeSkillGaps(subjectKey, score as number, rec.targetLevel)

                       return (
                         <div key={subjectKey} className={`${config.bgClass} border-2 ${config.borderClass} rounded-lg p-6`}>
                            <div className="flex justify-between items-center mb-4">
                              <h4 className="text-xl font-bold">{rec.subject}</h4>
                              <span className={`${config.badgeClass} px-3 py-1 rounded-full text-sm font-bold`}>Level {score as number}</span>
                            </div>
                            <p className="mb-4 text-gray-700">{rec.description}</p>
                            <div className="bg-white p-4 rounded-lg">
                              <h5 className="font-bold mb-2 text-sm">Action Plan:</h5>
                              <ul className="text-sm space-y-1">
                                {rec.actionSteps.map((step, i) => <li key={i}>• {step}</li>)}
                              </ul>
                            </div>
                         </div>
                       )
                     })}
                   </div>
                 )
               })()}
            </div>

            {/* Trends Section */}
            {assessments.length > 1 && (
              <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                <h2 className="text-2xl font-bold mb-6">Pathway Affinity Trends 📊</h2>
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                     <thead>
                       <tr className="bg-gray-100"><th className="p-4">Term/Year</th><th className="p-4">STEM</th><th className="p-4">Arts</th><th className="p-4">Social</th></tr>
                     </thead>
                     <tbody>
                       {assessments.map(a => (
                         <tr key={a.id} className="border-b">
                           <td className="p-4">T{a.term} {a.year}</td>
                           <td className="p-4">{a.pathway_recommendations?.stem_score}%</td>
                           <td className="p-4">{a.pathway_recommendations?.arts_sports_score}%</td>
                           <td className="p-4">{a.pathway_recommendations?.social_sciences_score}%</td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                </div>
              </div>
            )}

            <div className="mt-8 flex gap-4">
               <Link href={`/dashboard/assessments/add?student=${studentId}`} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold">Add New Assessment</Link>
               <button onClick={() => alert("Phase 4 AI Analysis Coming Soon!")} className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold">🤖 AI Deep Dive</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// 2. Export ya mwisho inayotumia Suspense kuzuia Build Error
export default function PathwayGuidancePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Preparing guidance reports...</p>
        </div>
      </div>
    }>
      <GuidanceContent />
    </Suspense>
  )
}