'use client'

import { useState, useEffect, useCallback } from 'react'
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
  generateSubjectRecommendation
} from '@/lib/adaptiveLearning'
import { analyzeSkillGaps } from '@/lib/competencyFramework'

export default function PathwayGuidancePage() {
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
    try {
      const { data: studentData, error: studentError } = await supabase
        .from('students').select('*').eq('id', studentId).single()

      if (studentError) throw studentError
      setStudent(studentData)

      const { data: assessmentData, error: assessmentError } = await supabase
        .from('assessments')
        .select('*')
        .eq('student_id', studentId)
        .eq('grade_level', 'junior')
        .not('pathway_recommendations', 'is', null)
        .order('year', { ascending: true })
        .order('term', { ascending: true })

      if (assessmentError) throw assessmentError
      setAssessments(assessmentData || [])
    } catch (err) {
      console.error('Error:', err)
      setError('Failed to load data')
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

  if (loading || !student) return <div className="p-10 text-center">Loading...</div>

  const latestAssessment = assessments.length > 0 ? assessments[assessments.length - 1] : null
  const latestRec = latestAssessment?.pathway_recommendations

  // Helper to render the recommendation cards to keep the main JSX clean
  const renderSubjectPlans = () => {
    if (!latestAssessment?.subject_scores) return null;
    
    const scores = Object.entries(latestAssessment.subject_scores);
    
    return (
      <div className="space-y-8">
        {/* Tier 1 & 2: Priority Areas */}
        {scores.some(([_, s]) => s <= 2) && (
          <section>
            <h3 className="text-xl font-bold text-red-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">🔴</span> Priority Foundation Building
            </h3>
            <div className="grid grid-cols-1 gap-6">
              {scores.filter(([_, s]) => s <= 2).map(([key, score]) => {
                const rec = generateSubjectRecommendation(formatSubjectName(key), score, key);
                const config = getTierConfig(rec.tier);
                const gaps = analyzeSkillGaps(key, score, rec.targetLevel);
                return (
                  <div key={key} className={`${config.bgClass} border-2 ${config.borderClass} rounded-xl p-6 shadow-sm`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{config.icon}</span>
                        <div>
                          <h4 className="text-xl font-bold">{rec.subject}</h4>
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${config.badgeClass}`}>
                            Level {score} → Target {rec.targetLevel}
                          </span>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-gray-500">Est. Improvement</p>
                        <p className="font-bold">{rec.estimatedTime}</p>
                      </div>
                    </div>
                    <p className="text-gray-700 mb-4 bg-white/50 p-3 rounded-lg italic">"{rec.description}"</p>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-lg shadow-inner">
                        <h5 className="font-bold text-sm mb-2 text-gray-900">Step-by-Step Plan:</h5>
                        <ul className="text-sm space-y-1">
                          {rec.actionSteps.map((step, i) => <li key={i} className="flex gap-2"><span>{i+1}.</span> {step}</li>)}
                        </ul>
                      </div>
                      <div className="bg-yellow-50 p-4 rounded-lg shadow-inner border border-yellow-100">
                        <h5 className="font-bold text-sm mb-2 text-yellow-900">Specific Skills to Master:</h5>
                        <ul className="text-xs space-y-1 text-yellow-800">
                          {gaps.gaps.slice(0, 3).map((g, i) => <li key={i}>• {g}</li>)}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header & Stats Sections similar to your code but using renderSubjectPlans() below */}
      <div className="max-w-7xl mx-auto px-4 pt-10">
        <header className="mb-8">
            <Link href="/dashboard" className="text-blue-600 mb-4 block">← Back</Link>
            <h1 className="text-4xl font-extrabold text-gray-900">{student.name}&apos;s Pathway</h1>
            <p className="text-gray-500">AI-Powered Career & Academic Guidance</p>
        </header>

        {latestRec && (
          <>
            {/* Top Score Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                {/* ... your STEM/Arts/Social cards ... */}
            </div>

            {/* AI Advisor Guidance Message */}
            <div className="bg-indigo-900 text-white rounded-2xl p-8 mb-10 shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                        <span className="animate-pulse text-3xl">🤖</span> AI Academic Advisor
                    </h2>
                    <p className="text-indigo-100 leading-relaxed text-lg italic">
                        &quot;{latestRec.guidance_message}&quot;
                    </p>
                </div>
                <div className="absolute top-0 right-0 p-4 opacity-20 text-8xl">🎓</div>
            </div>

            {/* Render the detailed plans */}
            {renderSubjectPlans()}
          </>
        )}
      </div>
    </div>
  )
}