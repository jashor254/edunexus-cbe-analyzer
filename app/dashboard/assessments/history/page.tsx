'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, type Student, type Assessment, COMPETENCY_LEVELS } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { 
  analyzePerformance, 
  getTierConfig,
  type SubjectRecommendation 
} from '@/lib/adaptiveLearning'
import { formatSubjectName } from '@/lib/pathwayCalculator'

export default function CompleteHistoryPage() {
  const [student, setStudent] = useState<Student | null>(null)
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(new Date().getFullYear())
  const [showLearningPlan, setShowLearningPlan] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'yearly' | 'journey'>('yearly')
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const studentId = searchParams.get('student')

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

  const loadAssessments = useCallback(async () => {
    if (!studentId) return

    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('assessments')
        .select('*')
        .eq('student_id', studentId)

      if (selectedYear !== 'all') {
        query = query.eq('year', selectedYear)
      }

      const { data, error: fetchError } = await query
        .order('year', { ascending: true })
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
      year: assessment.year,
      term: assessment.term,
      grade: assessment.grade,
      score: assessment.subject_scores?.[subjectKey] || null
    }))
  }, [assessments])

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

    if (last > first) return { direction: 'up', text: 'Rising', color: 'text-green-600', icon: '↗' }
    if (last < first) return { direction: 'down', text: 'Dipping', color: 'text-red-600', icon: '↘' }
    return { direction: 'stable', text: 'Stable', color: 'text-blue-600', icon: '→' }
  }, [getSubjectProgress])

  const overallAvg = useMemo(() => {
    if (allSubjects.length === 0) return null
    
    const subjectAverages = allSubjects
      .map(subject => calculateAverage(subject))
      .filter((avg): avg is string => avg !== null)
      .map(avg => parseFloat(avg))
    
    if (subjectAverages.length === 0) return null
    return (subjectAverages.reduce((sum, avg) => sum + avg, 0) / subjectAverages.length).toFixed(1)
  }, [allSubjects, calculateAverage])

  const availableYears = useMemo(() => {
    const years = new Set(assessments.map(a => a.year))
    return ['all' as const, ...Array.from(years).sort()]
  }, [assessments])

  const performanceAnalysis = useMemo(() => {
    if (assessments.length === 0) return null

    const latestAssessment = assessments[assessments.length - 1]
    if (!latestAssessment.subject_scores) return null

    const historicalData: Record<string, Array<{ term: number; score: number }>> = {}
    assessments.forEach(assessment => {
      Object.entries(assessment.subject_scores || {}).forEach(([subject, score]) => {
        if (!historicalData[subject]) {
          historicalData[subject] = []
        }
        historicalData[subject].push({
          term: assessment.term,
          score: score as number
        })
      })
    })

    return analyzePerformance(latestAssessment.subject_scores, historicalData)
  }, [assessments])

  const persistentStruggles = useMemo(() => {
    const struggles: Array<{subject: string, avgScore: number, assessmentCount: number}> = []
    
    allSubjects.forEach(subject => {
      const avg = calculateAverage(subject)
      const subjectAssessments = assessments.filter(a => 
        a.subject_scores?.[subject] !== undefined && a.subject_scores?.[subject] !== null
      )
      
      if (avg && parseFloat(avg) < 2.5 && subjectAssessments.length >= 3) {
        struggles.push({
          subject,
          avgScore: parseFloat(avg),
          assessmentCount: subjectAssessments.length
        })
      }
    })
    
    return struggles.sort((a, b) => a.avgScore - b.avgScore)
  }, [allSubjects, calculateAverage, assessments])

  const handleAIAnalysis = async () => {
    setAiLoading(true)
    try {
      router.push(`/dashboard/ai-career?student=${studentId}`)
    } catch (err) {
      console.error('AI Analysis error:', err)
      alert('AI Analysis feature coming soon!')
    } finally {
      setAiLoading(false)
    }
  }

  const handlePDFDownload = async () => {
    if (assessments.length === 0) {
      alert('No assessments to generate report. Please add an assessment first.')
      return
    }

    setPdfLoading(true)
    try {
      const latestAssessment = assessments[assessments.length - 1]
      
      const payload = {
        studentId: student!.id,
        scores: latestAssessment.subject_scores,
        profile: {
          name: student!.name,
          grade: student!.grade,
          pathway: student!.current_pathway,
          dateOfBirth: student!.date_of_birth
        }
      }

      const response = await fetch('/api/clinic/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate report')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${student!.name.replace(/\s+/g, '_')}_Academic_Clinic_Report.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      alert('✅ Report downloaded successfully!')
    } catch (err) {
      console.error('PDF Download error:', err)
      alert(`Failed to download report: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setPdfLoading(false)
    }
  }

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
            Back
          </Link>
        </div>
      </div>
    )
  }

  if (!student && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">📊</div>
          <div className="text-2xl font-black uppercase animate-pulse">Loading...</div>
        </div>
      </div>
    )
  }

  if (!student) return null

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b-4 border-black bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <Link href="/dashboard" className="text-sm font-black uppercase tracking-wider hover:underline">
            ← Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-12">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6">
            <div>
              <h1 className="text-6xl font-black uppercase tracking-tighter mb-3">{student.name}</h1>
              <div className="flex gap-3 flex-wrap">
                <span className="bg-black text-white px-5 py-2 text-sm font-black uppercase rounded-full">
                  Grade {student.grade}
                </span>
                {student.current_pathway && (
                  <span className="bg-purple-100 text-purple-700 px-5 py-2 text-sm font-black uppercase rounded-full border-2 border-purple-300">
                    {student.current_pathway}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex gap-3">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="px-6 py-3 border-2 border-slate-200 rounded-xl font-bold bg-white"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>
                    {year === 'all' ? 'ALL YEARS' : year}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setViewMode(viewMode === 'yearly' ? 'journey' : 'yearly')}
                className="px-6 py-3 border-2 border-purple-300 bg-purple-50 text-purple-700 rounded-xl font-black uppercase text-sm hover:bg-purple-100"
              >
                {viewMode === 'yearly' ? '📊 Journey' : '📅 Year'}
              </button>
            </div>
          </div>
          <div className="h-2 w-32 bg-black mt-6"></div>
        </div>

        {persistentStruggles.length > 0 && selectedYear === 'all' && (
          <div className="mb-8 bg-gradient-to-r from-red-50 to-orange-50 border-4 border-red-300 rounded-3xl p-8">
            <div className="flex items-start gap-4">
              <div className="text-5xl">🚨</div>
              <div className="flex-1">
                <h3 className="text-2xl font-black uppercase text-red-900 mb-3">
                  Long-Term Learning Challenges Detected
                </h3>
                <p className="text-red-800 mb-4">
                  {student.name} has consistently struggled in these subjects across multiple assessments:
                </p>
                <div className="grid md:grid-cols-2 gap-3">
                  {persistentStruggles.map(struggle => (
                    <div key={struggle.subject} className="bg-white rounded-2xl p-4 border-2 border-red-200">
                      <div className="font-black uppercase text-sm text-red-900 mb-1">
                        {formatSubjectName(struggle.subject)}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-red-600 text-xs">
                          Average: <span className="font-black text-lg">{struggle.avgScore.toFixed(1)}</span>
                        </span>
                        <span className="text-slate-500 text-xs">
                          {struggle.assessmentCount} assessments
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="bg-blue-50 border-2 border-blue-200 rounded-3xl p-6">
            <div className="text-xs font-black text-blue-400 uppercase mb-2">Assessments</div>
            <div className="text-5xl font-black text-blue-600">{assessments.length}</div>
            {selectedYear === 'all' && (
              <div className="text-xs text-blue-500 mt-1">All years</div>
            )}
          </div>
          
          <div className="bg-green-50 border-2 border-green-200 rounded-3xl p-6">
            <div className="text-xs font-black text-green-400 uppercase mb-2">Subjects</div>
            <div className="text-5xl font-black text-green-600">{allSubjects.length}</div>
          </div>
          
          <div className="bg-purple-50 border-2 border-purple-200 rounded-3xl p-6">
            <div className="text-xs font-black text-purple-400 uppercase mb-2">Average</div>
            <div className="text-5xl font-black text-purple-600">{overallAvg || '—'}</div>
          </div>
          
          <div className="bg-orange-50 border-2 border-orange-200 rounded-3xl p-6">
            <div className="text-xs font-black text-orange-400 uppercase mb-2">Latest</div>
            <div className="text-5xl font-black text-orange-600">
              {assessments.length > 0 ? `T${assessments[assessments.length - 1].term}` : '—'}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-slate-50 p-20 text-center rounded-3xl">
            <div className="animate-pulse font-black uppercase">Loading...</div>
          </div>
        ) : assessments.length === 0 ? (
          <div className="bg-slate-50 border-4 border-dashed p-20 text-center rounded-[50px]">
            <div className="text-6xl mb-6">📋</div>
            <h3 className="text-3xl font-black uppercase mb-4">No Records</h3>
            <Link
              href={`/dashboard/assessments/add?student=${studentId}`}
              className="inline-block bg-black text-white px-8 py-4 rounded-full font-black uppercase"
            >
              + Add Assessment
            </Link>
          </div>
        ) : (
          <>
            {viewMode === 'journey' && selectedYear === 'all' ? (
              <div className="bg-white border-2 rounded-3xl overflow-hidden mb-8">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-6 py-5 text-left text-xs font-black uppercase sticky left-0 bg-slate-100 z-10">Subject</th>
                        {assessments.map((assessment, idx) => (
                          <th key={idx} className="px-4 py-5 text-center text-xs font-black uppercase whitespace-nowrap">
                            <div>G{assessment.grade}</div>
                            <div>{assessment.year}</div>
                            <div>T{assessment.term}</div>
                          </th>
                        ))}
                        <th className="px-6 py-5 text-center text-xs font-black uppercase">Avg</th>
                        <th className="px-6 py-5 text-center text-xs font-black uppercase">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSubjects.map((subjectKey, index) => {
                        const average = calculateAverage(subjectKey)
                        const trend = getProgressIndicator(subjectKey)

                        return (
                          <tr key={subjectKey} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-6 py-5 font-black uppercase text-sm sticky left-0 bg-inherit z-10">{formatSubjectName(subjectKey)}</td>
                            
                            {assessments.map((assessment, idx) => {
                              const score = assessment.subject_scores?.[subjectKey]
                              const level = score ? getCompetencyLevel(score as number) : null

                              return (
                                <td key={idx} className="px-4 py-5 text-center">
                                  {level ? (
                                    <span className={`px-3 py-1 rounded-full text-sm font-black ${level.bgColor} ${level.textColor} border-2 ${level.borderColor}`}>
                                      {level.value}
                                    </span>
                                  ) : (
                                    <span className="text-xl font-black text-slate-300">—</span>
                                  )}
                                </td>
                              )
                            })}

                            <td className="px-6 py-5 text-center font-black text-2xl">{average || '—'}</td>

                            <td className="px-6 py-5 text-center">
                              {trend ? (
                                <div className="flex items-center justify-center gap-2">
                                  <span className={`text-3xl ${trend.color}`}>{trend.icon}</span>
                                </div>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white border-2 rounded-3xl overflow-hidden mb-8">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-6 py-5 text-left text-xs font-black uppercase">Subject</th>
                        <th className="px-6 py-5 text-center text-xs font-black uppercase">T1</th>
                        <th className="px-6 py-5 text-center text-xs font-black uppercase">T2</th>
                        <th className="px-6 py-5 text-center text-xs font-black uppercase">T3</th>
                        <th className="px-6 py-5 text-center text-xs font-black uppercase">Avg</th>
                        <th className="px-6 py-5 text-center text-xs font-black uppercase">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSubjects.map((subjectKey, index) => {
                        const progress = getSubjectProgress(subjectKey)
                        const average = calculateAverage(subjectKey)
                        const trend = getProgressIndicator(subjectKey)

                        return (
                          <tr key={subjectKey} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-6 py-5 font-black uppercase text-sm">{formatSubjectName(subjectKey)}</td>
                            
                            {[1, 2, 3].map(term => {
                              const termData = progress.find(p => p.term === term)
                              const score = termData?.score
                              const level = score ? getCompetencyLevel(score) : null

                              return (
                                <td key={term} className="px-6 py-5 text-center">
                                  {level ? (
                                    <span className={`px-4 py-2 rounded-full text-base font-black ${level.bgColor} ${level.textColor} border-2 ${level.borderColor}`}>
                                      {level.value}
                                    </span>
                                  ) : (
                                    <span className="text-2xl font-black text-slate-300">—</span>
                                  )}
                                </td>
                              )
                            })}

                            <td className="px-6 py-5 text-center font-black text-2xl">{average || '—'}</td>

                            <td className="px-6 py-5 text-center">
                              {trend ? (
                                <div className="flex items-center justify-center gap-2">
                                  <span className={`text-3xl ${trend.color}`}>{trend.icon}</span>
                                </div>
                              ) : (
                                <span className="text-slate-300">—</span>
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

            {performanceAnalysis && (
              <div className="mb-8">
                <button
                  onClick={() => setShowLearningPlan(!showLearningPlan)}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 rounded-3xl font-black uppercase text-xl flex items-center justify-between hover:from-green-700 hover:to-emerald-700 transition-all"
                >
                  <span>🎓 Guardian/Tutor Teaching Plan</span>
                  <span className="text-3xl">{showLearningPlan ? '▼' : '▶'}</span>
                </button>

                {showLearningPlan && (
                  <div className="mt-4 space-y-4">
                    {performanceAnalysis.recommendations.map((rec: SubjectRecommendation, idx: number) => {
                      const config = getTierConfig(rec.tier)
                      
                      return (
                        <div key={idx} className={`border-2 ${config.borderClass} rounded-3xl p-6 ${config.bgClass}`}>
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-2xl font-black uppercase">{formatSubjectName(rec.subject)}</h3>
                            <span className={`px-4 py-2 rounded-full font-black ${config.badgeClass}`}>
                              {config.icon} {rec.tierLabel}
                            </span>
                          </div>

                          <p className="text-sm mb-4">{rec.description}</p>

                          <div className="bg-white rounded-2xl p-4 mb-4">
                            <h4 className="font-black uppercase text-sm mb-3">📋 What To Teach:</h4>
                            <ol className="space-y-2">
                              {rec.actionSteps.map((step, i) => (
                                <li key={i} className="flex gap-2 text-sm">
                                  <span className="font-black">{i + 1}.</span>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ol>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div className="bg-white rounded-xl p-3">
                              <div className="font-black mb-1">⏱️ Timeline:</div>
                              <div>{rec.estimatedTime}</div>
                            </div>
                            <div className="bg-white rounded-xl p-3">
                              <div className="font-black mb-1">🎯 Target:</div>
                              <div>Level {rec.targetLevel}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href={`/dashboard/assessments/add?student=${studentId}`}
                className="bg-black text-white p-6 rounded-full font-black uppercase text-center hover:scale-105 transition-all"
              >
                + New Assessment
              </Link>

              <button
                onClick={handleAIAnalysis}
                disabled={aiLoading}
                className="bg-purple-600 text-white p-6 rounded-full font-black uppercase hover:scale-105 transition-all disabled:opacity-50"
              >
                {aiLoading ? '⏳ Loading...' : '🤖 Career Analysis'}
              </button>

              <Link
                href="/chat"
                className="bg-green-600 text-white p-6 rounded-full font-black uppercase text-center hover:scale-105 transition-all"
              >
                💬 Ask Tutor
              </Link>

              <button
                onClick={handlePDFDownload}
                disabled={pdfLoading}
                className="bg-blue-600 text-white p-6 rounded-full font-black uppercase hover:scale-105 transition-all disabled:opacity-50"
              >
                {pdfLoading ? '⏳ Generating...' : '📥 Download'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}