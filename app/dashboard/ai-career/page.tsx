'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, type Student, type Assessment } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { CareerRecommendation } from '@/lib/ai/careerAnalysis'

export default function AICareerAnalysisPage() {
  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [careers, setCareers] = useState<CareerRecommendation[]>([])
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const studentId = searchParams.get('student')

  const loadData = useCallback(async () => {
    if (!studentId) return

    setLoading(true)
    setError(null)

    try {
      // Load student
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single()

      if (studentError) throw studentError
      if (!studentData) throw new Error('Student not found')
      
      setStudent(studentData)

      // Load latest assessment
      const { data: assessments, error: assessmentsError } = await supabase
        .from('assessments')
        .select('*')
        .eq('student_id', studentId)
        .order('year', { ascending: false })
        .order('term', { ascending: false })
        .limit(1)

      if (assessmentsError) throw assessmentsError
      if (!assessments || assessments.length === 0) {
        throw new Error('No assessments found. Please add an assessment first.')
      }

      const latestAssessment = assessments[0]

      // Get user ID for rate limiting
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Call AI Career Analysis API
      setAnalyzing(true)
      
      // Build profile
      const profile = {
        studentName: studentData.name,
        grade: studentData.grade,
        pathway: latestAssessment.pathway_recommendations?.top_pathway || studentData.current_pathway || 'STEM',
        subjectScores: latestAssessment.subject_scores,
        strengths: latestAssessment.pathway_recommendations?.strengths || [],
        weaknesses: latestAssessment.pathway_recommendations?.development_areas || [],
        pathwayConfidence: latestAssessment.pathway_recommendations?.confidence || 'moderate' // ✅ FIXED
      }

      const response = await fetch('/api/ai/career-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile,
          userId: user.id,
          tier: 'family'
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate career analysis')
      }

      const data = await response.json()
      setCareers(data.recommendations)

    } catch (err) {
      console.error('Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load career analysis')
    } finally {
      setLoading(false)
      setAnalyzing(false)
    }
  }, [studentId])

  useEffect(() => {
    if (!studentId) {
      router.push('/dashboard')
      return
    }
    loadData()
  }, [studentId, loadData, router])

  // Error state
  if (error && !student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="bg-red-100 border-4 border-red-600 rounded-3xl p-12 max-w-md text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-3xl font-black text-red-900 mb-4 uppercase">Error</h2>
          <p className="text-red-700 font-bold mb-6">{error}</p>
          <Link 
            href="/dashboard"
            className="inline-block bg-red-600 text-white px-8 py-4 rounded-full font-black uppercase"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading || analyzing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🤖</div>
          <div className="text-2xl font-black uppercase text-slate-700 animate-pulse">
            {analyzing ? 'AI Analyzing Career Options...' : 'Loading...'}
          </div>
          <p className="text-slate-500 mt-4">This may take 10-20 seconds</p>
        </div>
      </div>
    )
  }

  if (!student) return null

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <nav className="border-b-4 border-black bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <Link 
            href={`/dashboard/assessments/history?student=${studentId}`} 
            className="text-sm font-black uppercase tracking-wider hover:underline"
          >
            ← Back to History
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-6xl font-black uppercase tracking-tighter mb-3">
            AI Career Analysis
          </h1>
          <p className="text-xl text-slate-600">
            For <span className="font-black">{student.name}</span> • Grade {student.grade}
          </p>
          <div className="h-2 w-32 bg-gradient-to-r from-purple-600 to-blue-600 mt-6"></div>
        </div>

        {careers.length === 0 ? (
          <div className="bg-slate-50 border-4 border-dashed rounded-[50px] p-20 text-center">
            <div className="text-6xl mb-6">🤔</div>
            <h3 className="text-3xl font-black uppercase mb-4">No Analysis Yet</h3>
            <button
              onClick={loadData}
              className="bg-black text-white px-8 py-4 rounded-full font-black uppercase"
            >
              Generate Analysis
            </button>
          </div>
        ) : (
          <>
            {/* Success Banner */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-3xl p-6 mb-8">
              <div className="flex items-center gap-4">
                <div className="text-4xl">✨</div>
                <div>
                  <h2 className="text-2xl font-black uppercase">AI Analysis Complete!</h2>
                  <p className="text-purple-100">
                    Based on current performance, here are {careers.length} career recommendations
                  </p>
                </div>
              </div>
            </div>

            {/* Career Cards */}
            <div className="space-y-6">
              {careers.map((career, index) => (
                <div 
                  key={index}
                  className="bg-white border-2 border-slate-200 rounded-3xl p-8 hover:border-purple-600 transition-all"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl font-black text-purple-600">#{index + 1}</span>
                        <h3 className="text-3xl font-black uppercase">{career.career}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black uppercase text-slate-400">Match Score:</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-3 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-purple-600 to-blue-600"
                              style={{ width: `${career.matchScore}%` }}
                            />
                          </div>
                          <span className="text-xl font-black text-purple-600">{career.matchScore}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-4 py-2 rounded-full font-black text-sm ${
                        career.industryDemand === 'high' ? 'bg-green-100 text-green-800' :
                        career.industryDemand === 'moderate' ? 'bg-yellow-100 text-yellow-800' : // ✅ FIXED
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {career.industryDemand.toUpperCase()} DEMAND
                      </span>
                      <span className="text-xs font-black text-slate-400">
                      </span>
                    </div>
                  </div>

                  <p className="text-slate-700 mb-6 leading-relaxed">{career.reasoning}</p>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Required Subjects */}
                    <div className="bg-blue-50 rounded-2xl p-4">
                      <h4 className="font-black uppercase text-sm text-blue-900 mb-3">📚 Required Subjects</h4>
                      <div className="flex flex-wrap gap-2">
                        {career.requiredSubjects.map((subject, i) => (
                          <span key={i} className="bg-white px-3 py-1 rounded-full text-xs font-bold text-blue-700">
                            {subject}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Current Gaps */}
                    <div className="bg-orange-50 rounded-2xl p-4">
                      <h4 className="font-black uppercase text-sm text-orange-900 mb-3">⚠️ Areas to Improve</h4>
                      <ul className="space-y-1">
                        {career.currentGaps.length > 0 ? (
                          career.currentGaps.map((gap, i) => (
                            <li key={i} className="text-xs text-orange-700">• {gap}</li>
                          ))
                        ) : (
                          <li className="text-xs text-green-700">✓ No gaps! Ready to pursue this path</li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Universities */}
                  <div className="mt-6 grid md:grid-cols-2 gap-6">
                    <div className="bg-green-50 rounded-2xl p-4">
                      <h4 className="font-black uppercase text-sm text-green-900 mb-3">🇰🇪 Kenyan Universities</h4>
                      <ul className="space-y-1">
                        {career.kenyanUniversities.map((uni, i) => (
                          <li key={i} className="text-sm text-green-700">✓ {uni}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-purple-50 rounded-2xl p-4">
                      <h4 className="font-black uppercase text-sm text-purple-900 mb-3">🌍 International Options</h4>
                      <ul className="space-y-1">
                        {career.internationalOptions.map((uni, i) => (
                          <li key={i} className="text-sm text-purple-700">✓ {uni}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Career Path */}
                  <div className="mt-6 bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl p-4">
                    <h4 className="font-black uppercase text-sm text-slate-900 mb-3">🚀 Career Progression Path</h4>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                      {career.careerPath.map((step, i) => (
                        <div key={i} className="flex items-center gap-2 flex-shrink-0">
                          <span className="bg-white px-4 py-2 rounded-full text-sm font-bold text-slate-700 whitespace-nowrap">
                            {step}
                          </span>
                          {i < career.careerPath.length - 1 && (
                            <span className="text-slate-400">→</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="mt-12 flex gap-4">
              <Link
                href={`/dashboard/assessments/history?student=${studentId}`}
                className="flex-1 bg-slate-200 text-slate-900 p-6 rounded-full font-black uppercase text-center hover:bg-slate-300"
              >
                ← Back to History
              </Link>
              <button
                onClick={loadData}
                className="flex-1 bg-purple-600 text-white p-6 rounded-full font-black uppercase hover:bg-purple-700"
              >
                🔄 Regenerate Analysis
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}