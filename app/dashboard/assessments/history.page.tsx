'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, type Student, type Assessment, COMPETENCY_LEVELS } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { 
  analyzePerformance, 
  calculateLearningVelocity,
  getTierConfig,
  type SubjectRecommendation,
  type LearningVelocity
} from '@/lib/adaptiveLearning'

export default function AssessmentHistoryPage() {
  const [student, setStudent] = useState<Student | null>(null)
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const studentId = searchParams.get('student')

  // ✅ FIX: Memoize loadStudentData with useCallback
  const loadStudentData = useCallback(async () => {
    if (!studentId) return

    try {
      const { data, error: fetchError } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single()

      if (fetchError) throw fetchError
      if (data) setStudent(data)
    } catch (err) {
      console.error('Error loading student:', err)
      setError('Failed to load student data')
    }
  }, [studentId])

  // ✅ FIX: Memoize loadAssessments with useCallback
  const loadAssessments = useCallback(async () => {
    if (!studentId) return

    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('assessments')
        .select('*')
        .eq('student_id', studentId)
        .eq('year', selectedYear)
        .order('term', { ascending: true })

      if (fetchError) throw fetchError
      if (data) setAssessments(data)
    } catch (err) {
      console.error('Error loading assessments:', err)
      setError('Failed to load assessments')
    } finally {
      setLoading(false)
    }
  }, [studentId, selectedYear])

  // ✅ FIX: Proper useEffect with all dependencies
  useEffect(() => {
    if (!studentId) {
      router.push('/dashboard')
      return
    }

    loadStudentData()
    loadAssessments()
  }, [studentId, loadStudentData, loadAssessments, router])

  const getCompetencyLevel = (score: number) => {
    return COMPETENCY_LEVELS.find(level => level.value === score)
  }

  const getSubjectProgress = useCallback((subjectKey: string) => {
    return assessments.map(assessment => ({
      term: assessment.term,
      score: assessment.subject_scores?.[subjectKey] || null
    }))
  }, [assessments])

  // ✅ FIX: Memoize getAllSubjects to avoid recalculation
  const allSubjects = useMemo(() => {
    const subjectsSet = new Set<string>()
    assessments.forEach(assessment => {
      if (assessment.subject_scores) {
        Object.keys(assessment.subject_scores).forEach(subject => {
          subjectsSet.add(subject)
        })
      }
    })
    return Array.from(subjectsSet).sort()
  }, [assessments])

  const formatSubjectName = (key: string) => {
    const specialNames: Record<string, string> = {
      'kiswahili_ksl': 'Kiswahili/KSL',
      'community_service_learning': 'Community Service Learning',
      'core_mathematics': 'Core Mathematics',
      'essential_mathematics': 'Essential Mathematics',
      'physical_education': 'Physical Education',
      'ict': 'ICT',
      'creative_arts_sports': 'Creative Arts & Sports',
      'pre_technical_studies': 'Pre-Technical Studies',
      'integrated_science': 'Integrated Science',
      'agriculture_nutrition': 'Agriculture & Nutrition',
      'christian_religious_education': 'Christian Religious Education',
      'islamic_religious_education': 'Islamic Religious Education',
      'christian_education': 'Christian Religious Education',
      'islamic_education': 'Islamic Religious Education',
      'hindu_education': 'Hindu Religious Education',
      'mathematics': 'Mathematics',
      'english': 'English',
      'kiswahili': 'Kiswahili',
      'social_studies': 'Social Studies'
    }

    if (specialNames[key]) return specialNames[key]

    return key.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  const calculateAverage = useCallback((subjectKey: string) => {
    const scores = assessments
      .map(a => a.subject_scores?.[subjectKey])
      .filter((score): score is number => score !== undefined && score !== null)
    
    if (scores.length === 0) return null
    return (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1)
  }, [assessments])

  const getProgressIndicator = useCallback((subjectKey: string) => {
    const progress = getSubjectProgress(subjectKey)
    if (progress.length < 2) return null

    const validScores = progress.filter(p => p.score !== null)
    if (validScores.length < 2) return null

    const first = validScores[0].score!
    const last = validScores[validScores.length - 1].score!

    if (last > first) return { direction: 'up', text: 'Improving', color: 'text-green-600', icon: '↗' }
    if (last < first) return { direction: 'down', text: 'Declining', color: 'text-red-600', icon: '↘' }
    return { direction: 'stable', text: 'Stable', color: 'text-blue-600', icon: '→' }
  }, [getSubjectProgress])

  // ✅ FIX: Memoize overall average calculation
  const overallAvg = useMemo(() => {
    if (assessments.length === 0) return null
    
    const latestAssessment = assessments[assessments.length - 1]
    if (!latestAssessment.subject_scores) return null

    const scores = Object.values(latestAssessment.subject_scores).filter(
      (s): s is number => s !== null && s !== undefined
    )
    
    if (scores.length === 0) return null
    return (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1)
  }, [assessments])

  // Show error state
  if (error && !student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-900 mb-2">Error Loading Data</h2>
          <p className="text-red-700 mb-4">{error}</p>
          <Link 
            href="/dashboard"
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  // Show loading state
  if (!student && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-xl font-semibold text-gray-700">Loading student data...</div>
          <div className="mt-2 text-gray-500">Please wait</div>
        </div>
      </div>
    )
  }

  // Student not found
  if (!student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-xl font-semibold text-gray-700 mb-4">Student not found</div>
          <Link 
            href="/dashboard"
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const isJuniorSchool = student.grade >= 7 && student.grade <= 9
  const availableYears = [2023, 2024, 2025, 2026, 2027, 2028]

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">
            ← Back to Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{student.name}</h1>
              <p className="text-gray-600 mt-1">
                Grade {student.grade} • Assessment History
              </p>
              {student.current_pathway && (
                <p className="text-sm text-purple-600 font-semibold mt-1">
                  Pathway: {student.current_pathway}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                View Year:
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-sm font-medium text-gray-600">Assessments</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">
              {assessments.length} / 3
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {assessments.length < 3 ? `${3 - assessments.length} term(s) remaining` : 'Year complete!'}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-sm font-medium text-gray-600">Subjects Tracked</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {allSubjects.length}
            </p>
            <p className="text-xs text-gray-500 mt-1">Across all terms</p>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-sm font-medium text-gray-600">Overall Average</h3>
            <p className="text-3xl font-bold text-purple-600 mt-2">
              {overallAvg || '—'}
            </p>
            <p className="text-xs text-gray-500 mt-1">Latest term</p>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-sm font-medium text-gray-600">Latest Assessment</h3>
            <p className="text-3xl font-bold text-orange-600 mt-2">
              {assessments.length > 0 ? `Term ${assessments[assessments.length - 1].term}` : 'None'}
            </p>
            <p className="text-xs text-gray-500 mt-1">{selectedYear}</p>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
            <p className="text-yellow-800">{error}</p>
          </div>
        )}

        {/* ADAPTIVE LEARNING ANALYTICS - NEW SECTION */}
        {assessments.length > 0 && (
          <>
            {/* Performance Analysis Dashboard */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl shadow-lg p-8 mb-8 border-2 border-indigo-200">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-4xl">🎯</span>
                <div>
                  <h2 className="text-2xl font-bold text-indigo-900">Adaptive Learning Analytics</h2>
                  <p className="text-indigo-700 text-sm">Personalized insights based on your performance</p>
                </div>
              </div>

              {(() => {
                const latestAssessment = assessments[assessments.length - 1]
                if (!latestAssessment.subject_scores) return null

                // Prepare historical data for velocity calculation
                const historicalData: Record<string, Array<{ term: number; score: number }>> = {}
                allSubjects.forEach(subject => {
                  historicalData[subject] = assessments
                    .map(a => ({
                      term: a.term,
                      score: a.subject_scores?.[subject] || 0
                    }))
                    .filter(d => d.score > 0)
                })

                const analysis = analyzePerformance(latestAssessment.subject_scores, historicalData)

                return (
                  <>
                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-white rounded-lg p-4 border-2 border-indigo-200">
                        <div className="text-sm text-gray-600 mb-1">Overall Performance</div>
                        <div className={`text-2xl font-bold ${getTierConfig(analysis.overallTier).textClass}`}>
                          {getTierConfig(analysis.overallTier).icon} {getTierConfig(analysis.overallTier).label}
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4 border-2 border-red-200">
                        <div className="text-sm text-gray-600 mb-1">Need Support</div>
                        <div className="text-2xl font-bold text-red-600">
                          {analysis.subjectsNeedingSupport} subject{analysis.subjectsNeedingSupport !== 1 ? 's' : ''}
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4 border-2 border-blue-200">
                        <div className="text-sm text-gray-600 mb-1">Excelling</div>
                        <div className="text-2xl font-bold text-blue-600">
                          {analysis.subjectsExcelling} subject{analysis.subjectsExcelling !== 1 ? 's' : ''}
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4 border-2 border-green-200">
                        <div className="text-sm text-gray-600 mb-1">Avg Velocity</div>
                        <div className={`text-2xl font-bold ${
                          analysis.averageVelocity > 0.3 ? 'text-green-600' : 
                          analysis.averageVelocity < -0.1 ? 'text-red-600' : 
                          'text-gray-600'
                        }`}>
                          {analysis.averageVelocity > 0 ? '+' : ''}{analysis.averageVelocity} /term
                        </div>
                      </div>
                    </div>

                    {/* Learning Velocity Analysis */}
                    {analysis.velocities.length > 0 && (
                      <div className="bg-white rounded-lg p-6 mb-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <span className="text-2xl">📈</span>
                          Learning Velocity Tracker
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Track how fast you&apos;re improving in each subject (change per term)
                        </p>

                        <div className="space-y-3">
                          {analysis.velocities.slice(0, 5).map((velocity) => {
                            const isPositive = velocity.velocity > 0
                            const isNegative = velocity.velocity < -0.1

                            return (
                              <div key={velocity.subject} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900">
                                    {formatSubjectName(velocity.subject)}
                                  </div>
                                  <div className="text-sm text-gray-600 mt-1">
                                    {velocity.prediction}
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className={`text-lg font-bold ${
                                    isPositive ? 'text-green-600' : 
                                    isNegative ? 'text-red-600' : 
                                    'text-gray-600'
                                  }`}>
                                    {isPositive ? '↗' : isNegative ? '↘' : '→'} 
                                    {velocity.velocity > 0 ? '+' : ''}{velocity.velocity}
                                  </div>

                                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                    velocity.trend === 'accelerating' ? 'bg-green-100 text-green-700' :
                                    velocity.trend === 'slowing' ? 'bg-orange-100 text-orange-700' :
                                    velocity.trend === 'steady' ? 'bg-blue-100 text-blue-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {velocity.trend === 'accelerating' ? '🚀 Accelerating' :
                                     velocity.trend === 'slowing' ? '⚠️ Slowing' :
                                     velocity.trend === 'steady' ? '➡️ Steady' :
                                     '📊 Tracking'}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Priority Subjects Needing Attention */}
                    {analysis.subjectsNeedingSupport > 0 && (
                      <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-6">
                        <h3 className="text-lg font-bold text-orange-900 mb-3 flex items-center gap-2">
                          <span className="text-2xl">⚠️</span>
                          Priority: Subjects Needing Support
                        </h3>
                        <p className="text-orange-800 text-sm mb-4">
                          These subjects need immediate attention. Click &quot;View Pathway Guidance&quot; below for detailed personalized plans.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {analysis.recommendations
                            .filter(rec => rec.currentLevel <= 2)
                            .slice(0, 4)
                            .map(rec => {
                              const config = getTierConfig(rec.tier)
                              return (
                                <div key={rec.subject} className={`${config.bgClass} border-2 ${config.borderClass} rounded-lg p-4`}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xl">{config.icon}</span>
                                    <div className="font-bold text-gray-900">
                                      {rec.subject}
                                    </div>
                                  </div>
                                  <div className={`text-xs ${config.badgeClass} px-2 py-1 rounded-full inline-block`}>
                                    Level {rec.currentLevel} - {rec.tierLabel}
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          </>
        )}

        {/* Progress Table */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <p className="text-gray-600">Loading assessments...</p>
          </div>
        ) : assessments.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <p className="text-gray-600 mb-4">No assessments recorded for {selectedYear}</p>
            <Link
              href={`/dashboard/assessments/add?student=${studentId}`}
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
            >
              Add First Assessment
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-6 border-b bg-gray-50">
              <h2 className="text-xl font-bold">Subject Performance Tracker</h2>
              <p className="text-sm text-gray-600 mt-1">
                Track progress across all terms in {selectedYear}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Subject
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                      Term 1
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                      Term 2
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                      Term 3
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                      Average
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                      Trend
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {allSubjects.map((subjectKey, index) => {
                    const progress = getSubjectProgress(subjectKey)
                    const average = calculateAverage(subjectKey)
                    const trend = getProgressIndicator(subjectKey)

                    return (
                      <tr key={subjectKey} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {formatSubjectName(subjectKey)}
                        </td>
                        
                        {[1, 2, 3].map(term => {
                          const termData = progress.find(p => p.term === term)
                          const score = termData?.score
                          const level = score ? getCompetencyLevel(score) : null

                          return (
                            <td key={term} className="px-6 py-4 text-center">
                              {level ? (
                                <div className="inline-flex flex-col items-center">
                                  <span className={`
                                    px-3 py-1 rounded-full text-sm font-semibold
                                    ${level.bgColor} ${level.textColor}
                                  `}>
                                    {level.value}
                                  </span>
                                  <span className="text-xs text-gray-500 mt-1">
                                    {level.short}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">—</span>
                              )}
                            </td>
                          )
                        })}

                        <td className="px-6 py-4 text-center">
                          {average ? (
                            <span className="font-bold text-lg text-gray-900">
                              {average}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-center">
                          {trend ? (
                            <div className="flex items-center justify-center gap-2">
                              <span className={`text-xl ${trend.color}`}>
                                {trend.icon}
                              </span>
                              <span className={`text-sm font-semibold ${trend.color}`}>
                                {trend.text}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href={`/dashboard/assessments/add?student=${studentId}`}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
          >
            + Add New Assessment
          </Link>
          
          {isJuniorSchool && assessments.length > 0 && (
            <Link
              href={`/dashboard/assessments/guidance?student=${studentId}`}
              className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700"
            >
              🎯 View Pathway Guidance
            </Link>
          )}

          {assessments.length >= 2 && (
            <button
              onClick={() => alert('AI Analysis coming in Phase 4! 🤖 This will provide deep insights, career recommendations, and personalized learning plans.')}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700"
            >
              🤖 AI Career Analysis (Coming Soon)
            </button>
          )}
        </div>
      </div>
    </div>
  )
}