// app/dashboard/assessments/history/page.tsx
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
import { 
  ChevronLeft, 
  Download, 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Calendar,
  BookOpen,
  Award,
  AlertTriangle,
  Brain,
  FileText,
  MessageCircle,
  PlusCircle,
  BarChart3,
  Heart,
  Zap,
  Loader2
} from 'lucide-react'

// ============================================
// ALL SUBJECTS DEFINED HERE - NO EXTERNAL FILE
// ============================================

// JUNIOR SCHOOL (Grades 7-9) - 8 Core Subjects
const JUNIOR_CORE = [
  { key: 'mathematics', label: 'Mathematics', emoji: '🔢' },
  { key: 'english', label: 'English', emoji: '📚' },
  { key: 'kiswahili', label: 'Kiswahili', emoji: '🗣️' },
  { key: 'integrated_science', label: 'Integrated Science', emoji: '🔬' },
  { key: 'social_studies', label: 'Social Studies', emoji: '🌍' },
  { key: 'pre_technical', label: 'Pre-Technical Studies', emoji: '⚙️' },
  { key: 'creative_arts_sports', label: 'Creative Arts & Sports', emoji: '🎨' },
  { key: 'agriculture_nutrition', label: 'Agriculture & Nutrition', emoji: '🌾' }
]

// JUNIOR SCHOOL - Religious Education (Choose 1)
const JUNIOR_RELIGIOUS = [
  { key: 'cre', label: 'Christian Religious Education', emoji: '⛪' },
  { key: 'ire', label: 'Islamic Religious Education', emoji: '🕌' },
  { key: 'hre', label: 'Hindu Religious Education', emoji: '🕉️' }
]

// SENIOR SCHOOL - Compulsory Subjects (3 - Mathematics is separate)
const SENIOR_COMPULSORY = [
  { key: 'english', label: 'English', emoji: '📚' },
  { key: 'kiswahili_ksl', label: 'Kiswahili/KSL', emoji: '🗣️' },
  { key: 'community_service', label: 'Community Service Learning', emoji: '❤️' }
]

// SENIOR SCHOOL - STEM Pathway Electives
const STEM_ELECTIVES = [
  { key: 'biology', label: 'Biology', emoji: '🧬' },
  { key: 'chemistry', label: 'Chemistry', emoji: '⚗️' },
  { key: 'physics', label: 'Physics', emoji: '⚡' },
  { key: 'general_science', label: 'General Science', emoji: '🔬' },
  { key: 'agriculture', label: 'Agriculture', emoji: '🌱' },
  { key: 'computer_studies', label: 'Computer Studies', emoji: '💻' },
  { key: 'home_science', label: 'Home Science', emoji: '🏠' },
  { key: 'drawing_design', label: 'Drawing & Design', emoji: '✏️' },
  { key: 'aviation_technology', label: 'Aviation Technology', emoji: '✈️' },
  { key: 'building_construction', label: 'Building & Construction', emoji: '🏗️' },
  { key: 'electrical_technology', label: 'Electrical Technology', emoji: '⚡' },
  { key: 'metal_technology', label: 'Metal Technology', emoji: '🔧' },
  { key: 'power_machines', label: 'Power Machines', emoji: '⚙️' },
  { key: 'wood_technology', label: 'Wood Technology', emoji: '🪚' },
  { key: 'media_technology', label: 'Media Technology', emoji: '📹' },
  { key: 'marine_fisheries', label: 'Marine & Fisheries Technology', emoji: '🐟' }
]

// SENIOR SCHOOL - Social Sciences Pathway Electives
const SOCIAL_SCIENCES_ELECTIVES = [
  // Languages & Literature
  { key: 'advanced_english', label: 'Advanced English', emoji: '📖' },
  { key: 'literature_english', label: 'Literature in English', emoji: '📝' },
  { key: 'indigenous_language', label: 'Indigenous Language', emoji: '🗣️' },
  { key: 'kiswahili_kipevu', label: 'Kiswahili Kipevu', emoji: '📚' },
  { key: 'fasihi_kiswahili', label: 'Fasihi ya Kiswahili', emoji: '✍️' },
  { key: 'sign_language', label: 'Sign Language', emoji: '🤟' },
  
  // Foreign Languages
  { key: 'arabic', label: 'Arabic', emoji: '🕋' },
  { key: 'french', label: 'French', emoji: '🥖' },
  { key: 'german', label: 'German', emoji: '🍺' },
  { key: 'mandarin', label: 'Mandarin Chinese', emoji: '🥢' },
  
  // Humanities
  { key: 'history_citizenship', label: 'History & Citizenship', emoji: '📜' },
  { key: 'geography', label: 'Geography', emoji: '🗺️' },
  
  // Religious Education
  { key: 'cre', label: 'Christian Religious Education', emoji: '⛪' },
  { key: 'ire', label: 'Islamic Religious Education', emoji: '🕌' },
  { key: 'hre', label: 'Hindu Religious Education', emoji: '🕉️' },
  
  // Business
  { key: 'business_studies', label: 'Business Studies', emoji: '💼' }
]

// SENIOR SCHOOL - Arts & Sports Science Pathway Electives
const ARTS_SPORTS_ELECTIVES = [
  { key: 'sports_recreation', label: 'Sports and Recreation', emoji: '⚽' },
  { key: 'physical_education', label: 'Physical Education', emoji: '🏃' },
  { key: 'music_dance', label: 'Music and Dance', emoji: '🎵' },
  { key: 'theatre_film', label: 'Theatre and Film', emoji: '🎭' },
  { key: 'fine_arts', label: 'Fine Arts', emoji: '🎨' }
]

// Helper function to format subject names
function formatSubjectName(key: string): string {
  const allSubjects = [
    ...JUNIOR_CORE,
    ...JUNIOR_RELIGIOUS,
    ...SENIOR_COMPULSORY,
    ...STEM_ELECTIVES,
    ...SOCIAL_SCIENCES_ELECTIVES,
    ...ARTS_SPORTS_ELECTIVES,
    { key: 'core_mathematics', label: 'Core Mathematics' },
    { key: 'essential_mathematics', label: 'Essential Mathematics' }
  ]
  
  const subject = allSubjects.find(s => s.key === key)
  if (subject) return subject.label
  
  // Fallback
  return key.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
}

// ============================================
// END OF SUBJECTS DEFINITION
// ============================================

export default function CompleteHistoryPage() {
  const [student, setStudent] = useState<Student | null>(null)
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(new Date().getFullYear())
  const [showLearningPlan, setShowLearningPlan] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [selectedSubject, setSelectedSubject] = useState<string | 'all'>('all')
  const [expandedSubjects, setExpandedSubjects] = useState<string[]>([])
  const [downloadError, setDownloadError] = useState<string | null>(null)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const studentId = searchParams.get('student')

  // Available years (matches add page)
  const AVAILABLE_YEARS = [2026, 2027, 2028]

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
        .order('grade', { ascending: true })
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

  const getCompetencyBadge = (score: number) => {
    const level = getCompetencyLevel(score)
    if (!level) return null
    
    const colors = {
      1: 'bg-red-100 text-red-700 border-red-200',
      2: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      3: 'bg-green-100 text-green-700 border-green-200',
      4: 'bg-purple-100 text-purple-700 border-purple-200'
    }
    
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${colors[score as keyof typeof colors]}`}>
        Level {score} • {level.label}
      </span>
    )
  }

  const getMathTypeBadge = (type: string | null) => {
    if (!type) return null
    return type === 'core' 
      ? <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">📐 Core</span>
      : <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">📊 Essential</span>
  }

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

  const getSubjectProgress = useCallback((subjectKey: string) => {
    return assessments.map(assessment => ({
      grade: assessment.grade,
      year: assessment.year,
      term: assessment.term,
      score: assessment.subject_scores?.[subjectKey] || null,
      date: `${assessment.year} T${assessment.term}`,
      mathType: assessment.mathematics_type
    }))
  }, [assessments])

  const getTrendIcon = useCallback((subjectKey: string) => {
    const progress = getSubjectProgress(subjectKey)
    const validScores = progress.filter(p => p.score !== null)
    
    if (validScores.length < 2) return null

    const first = validScores[0].score!
    const last = validScores[validScores.length - 1].score!

    if (last > first) {
      return { icon: TrendingUp, color: 'text-green-600', text: 'Improving' }
    }
    if (last < first) {
      return { icon: TrendingDown, color: 'text-red-600', text: 'Declining' }
    }
    return { icon: Minus, color: 'text-blue-600', text: 'Stable' }
  }, [getSubjectProgress])

  const persistentStruggles = useMemo(() => {
    return allSubjects.filter(subject => {
      const scores = assessments
        .map(a => a.subject_scores?.[subject])
        .filter((s): s is number => s !== null && s !== undefined)
      
      if (scores.length < 2) return false
      
      const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length
      const strugglingCount = scores.filter(s => s < 2.5).length
      
      return avgScore < 2.5 && strugglingCount >= Math.ceil(scores.length / 2)
    })
  }, [assessments, allSubjects])

  const overallStats = useMemo(() => {
    if (assessments.length === 0) return null
    
    const allScores = assessments.flatMap(a => 
      Object.values(a.subject_scores || {}) as number[]
    )
    
    if (allScores.length === 0) return null
    
    const avg = allScores.reduce((sum, s) => sum + s, 0) / allScores.length
    const highest = Math.max(...allScores)
    const lowest = Math.min(...allScores)
    
    return {
      average: avg.toFixed(1),
      highest,
      lowest,
      totalAssessments: assessments.length,
      totalSubjects: allSubjects.length
    }
  }, [assessments, allSubjects])

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

  const toggleSubjectExpand = (subject: string) => {
    setExpandedSubjects(prev =>
      prev.includes(subject)
        ? prev.filter(s => s !== subject)
        : [...prev, subject]
    )
  }

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
      alert('No assessments to generate report')
      return
    }

    setPdfLoading(true)
    setDownloadError(null)
    
    try {
      // Send ALL assessments for historical data
      const payload = {
        studentId: student!.id,
        assessments: assessments,
        profile: {
          name: student!.name,
          grade: student!.grade,
          pathway: student!.current_pathway,
          dateOfBirth: student!.date_of_birth
          // REMOVED: school property completely since it doesn't exist in Student type
        }
      }

      console.log('Sending payload with', assessments.length, 'assessments')

      const response = await fetch('/api/clinic/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('PDF generation failed:', errorData)
        throw new Error(errorData.error || 'Failed to generate report')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${student!.name.replace(/\s+/g, '_')}_Academic_Report_${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      alert('Report downloaded successfully! ✅')
    } catch (err) {
      console.error('PDF Download error:', err)
      setDownloadError(err instanceof Error ? err.message : 'Failed to download report')
      alert('Failed to download report. Please try again.')
    } finally {
      setPdfLoading(false)
    }
  }

  if (error && !student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="bg-red-50 border-4 border-red-200 rounded-3xl p-12 max-w-md text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-red-900 mb-2">Error</h2>
          <p className="text-red-700 mb-6">{error}</p>
          <Link 
            href="/dashboard"
            className="inline-block bg-red-600 text-white px-8 py-3 rounded-full font-bold hover:bg-red-700 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (!student && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <div className="text-xl font-bold animate-pulse">Loading...</div>
        </div>
      </div>
    )
  }

  if (!student) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <div className="border-b-4 border-black bg-white sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="font-bold hover:text-violet-600 transition-colors flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-600" />
            <span className="font-black text-sm">EDUNEXUS</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Student Header */}
        <div className="mb-8 bg-white rounded-3xl border-4 border-slate-200 p-6 shadow-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight">
                {student.name}
              </h1>
              <div className="flex flex-wrap gap-3 mt-3">
                <span className="px-4 py-2 bg-slate-100 rounded-full text-sm font-bold">
                  Grade {student.grade}
                </span>
                <span className="px-4 py-2 bg-slate-100 rounded-full text-sm font-bold">
                  {student.grade >= 10 ? 'Senior School' : 'Junior School'}
                </span>
                {student.current_pathway && (
                  <span className="px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-bold">
                    {student.current_pathway}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex gap-3">
              <Link
                href={`/dashboard/assessments/add?student=${student.id}`}
                className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-full font-bold hover:bg-violet-900 transition-all shadow-lg"
              >
                <PlusCircle className="w-5 h-5" />
                Add Assessment
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {overallStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl p-6 border-2 border-violet-200">
              <div className="text-sm font-bold text-violet-600 mb-2">Average Score</div>
              <div className="text-4xl font-black text-violet-900">{overallStats.average}</div>
            </div>
            
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border-2 border-green-200">
              <div className="text-sm font-bold text-green-600 mb-2">Highest</div>
              <div className="text-4xl font-black text-green-900">{overallStats.highest}</div>
            </div>
            
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-6 border-2 border-orange-200">
              <div className="text-sm font-bold text-orange-600 mb-2">Lowest</div>
              <div className="text-4xl font-black text-orange-900">{overallStats.lowest}</div>
            </div>
            
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border-2 border-blue-200">
              <div className="text-sm font-bold text-blue-600 mb-2">Assessments</div>
              <div className="text-4xl font-black text-blue-900">{overallStats.totalAssessments}</div>
            </div>
          </div>
        )}

        {/* Persistent Struggles Alert */}
        {persistentStruggles.length > 0 && (
          <div className="mb-8 bg-gradient-to-r from-red-50 to-orange-50 border-4 border-red-200 rounded-3xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-red-900 mb-2">Attention Needed</h3>
                <p className="text-red-800 mb-3">
                  {student.name} needs extra support in: {persistentStruggles.map(s => formatSubjectName(s)).join(', ')}
                </p>
                <button
                  onClick={() => setShowLearningPlan(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-full text-sm font-bold hover:bg-red-700 transition-colors"
                >
                  View Learning Plan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Download Error Alert */}
        {downloadError && (
          <div className="mb-8 bg-red-50 border-4 border-red-200 rounded-3xl p-4">
            <p className="text-red-700 font-bold">Download Error: {downloadError}</p>
          </div>
        )}

        {/* Filters */}
        <div className="mb-8 flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-slate-500 mb-2">FILTER BY YEAR</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="w-full p-4 bg-white border-2 border-slate-200 rounded-xl font-bold focus:border-violet-600 focus:outline-none"
            >
              <option value="all">All Years</option>
              {AVAILABLE_YEARS.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-slate-500 mb-2">FILTER BY SUBJECT</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full p-4 bg-white border-2 border-slate-200 rounded-xl font-bold focus:border-violet-600 focus:outline-none"
            >
              <option value="all">All Subjects</option>
              {allSubjects.map(subject => (
                <option key={subject} value={subject}>{formatSubjectName(subject)}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')}
              className="px-6 py-4 bg-white border-2 border-slate-200 rounded-xl font-bold hover:border-violet-300 transition-colors flex items-center gap-2"
            >
              <BarChart3 className="w-5 h-5" />
              {viewMode === 'table' ? 'Card View' : 'Table View'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-3xl border-4 border-slate-200 p-20 text-center">
            <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <div className="text-lg font-bold">Loading assessments...</div>
          </div>
        ) : assessments.length === 0 ? (
          <div className="bg-white rounded-3xl border-4 border-slate-200 p-20 text-center">
            <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-2xl font-black mb-2">No Assessments Yet</h3>
            <p className="text-slate-600 mb-6">Add your first assessment to start tracking progress</p>
            <Link
              href={`/dashboard/assessments/add?student=${studentId}`}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-full font-bold hover:scale-105 transition-all shadow-xl"
            >
              <PlusCircle className="w-5 h-5" />
              Add First Assessment
            </Link>
          </div>
        ) : (
          <>
            {/* Table View */}
            {viewMode === 'table' ? (
              <div className="bg-white rounded-3xl border-4 border-slate-200 overflow-hidden mb-8">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-6 py-5 text-left text-xs font-black uppercase">Subject</th>
                        {assessments.map((assessment, idx) => (
                          <th key={idx} className="px-4 py-5 text-center text-xs font-black uppercase whitespace-nowrap">
                            <div>G{assessment.grade}</div>
                            <div className="text-slate-500">{assessment.year}</div>
                            <div>T{assessment.term}</div>
                            {assessment.mathematics_type && (
                              <div className="mt-1">
                                {getMathTypeBadge(assessment.mathematics_type)}
                              </div>
                            )}
                          </th>
                        ))}
                        <th className="px-6 py-5 text-center text-xs font-black uppercase">Avg</th>
                        <th className="px-6 py-5 text-center text-xs font-black uppercase">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSubjects
                        .filter(s => selectedSubject === 'all' || s === selectedSubject)
                        .map((subjectKey, index) => {
                          const average = calculateAverage(subjectKey)
                          const trend = getTrendIcon(subjectKey)
                          const TrendIcon = trend?.icon

                          return (
                            <tr key={subjectKey} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="px-6 py-5 font-black uppercase text-sm">
                                {formatSubjectName(subjectKey)}
                                {(subjectKey === 'core_mathematics' || subjectKey === 'essential_mathematics') && (
                                  <div className="mt-1">
                                    {getMathTypeBadge(subjectKey === 'core_mathematics' ? 'core' : 'essential')}
                                  </div>
                                )}
                              </td>
                              
                              {assessments.map((assessment, idx) => {
                                const score = assessment.subject_scores?.[subjectKey] as number | undefined
                                
                                return (
                                  <td key={idx} className="px-4 py-5 text-center">
                                    {score ? (
                                      <span className={`inline-block w-8 h-8 rounded-full font-bold flex items-center justify-center mx-auto ${
                                        score === 1 ? 'bg-red-100 text-red-700' :
                                        score === 2 ? 'bg-yellow-100 text-yellow-700' :
                                        score === 3 ? 'bg-green-100 text-green-700' :
                                        'bg-purple-100 text-purple-700'
                                      }`}>
                                        {score}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </td>
                                )
                              })}

                              <td className="px-6 py-5 text-center font-black text-xl">{average || '—'}</td>

                              <td className="px-6 py-5 text-center">
                                {trend && TrendIcon ? (
                                  <TrendIcon className={`w-5 h-5 mx-auto ${trend.color}`} />
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
              /* Card View */
              <div className="space-y-4 mb-8">
                {allSubjects
                  .filter(s => selectedSubject === 'all' || s === selectedSubject)
                  .map(subject => {
                    const progress = getSubjectProgress(subject)
                    const average = calculateAverage(subject)
                    const trend = getTrendIcon(subject)
                    const TrendIcon = trend?.icon
                    const isExpanded = expandedSubjects.includes(subject)
                    
                    return (
                      <div key={subject} className="bg-white rounded-3xl border-4 border-slate-200 overflow-hidden">
                        {/* Subject Header */}
                        <div 
                          onClick={() => toggleSubjectExpand(subject)}
                          className="p-6 cursor-pointer hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl flex items-center justify-center">
                                <BookOpen className="w-6 h-6 text-white" />
                              </div>
                              <div>
                                <h3 className="text-xl font-black">{formatSubjectName(subject)}</h3>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-sm text-slate-600">Avg: {average || '—'}</span>
                                  {trend && TrendIcon && (
                                    <span className={`flex items-center gap-1 text-sm ${trend.color}`}>
                                      <TrendIcon className="w-4 h-4" />
                                      {trend.text}
                                    </span>
                                  )}
                                </div>
                                {(subject === 'core_mathematics' || subject === 'essential_mathematics') && (
                                  <div className="mt-1">
                                    {getMathTypeBadge(subject === 'core_mathematics' ? 'core' : 'essential')}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-slate-400">
                                {progress.filter(p => p.score).length} assessments
                              </span>
                              <ChevronLeft className={`w-5 h-5 transform transition-transform ${isExpanded ? '-rotate-90' : ''}`} />
                            </div>
                          </div>
                        </div>
                        
                        {/* Expanded Content */}
                        {isExpanded && (
                          <div className="px-6 pb-6 border-t-2 border-slate-200">
                            <div className="pt-4 space-y-3">
                              {progress.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-4">
                                  <div className="w-24 text-sm font-bold text-slate-500">
                                    {item.date}
                                    {item.mathType && (
                                      <div className="text-xs mt-1">
                                        {getMathTypeBadge(item.mathType)}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    {item.score ? (
                                      <div className="flex items-center gap-3">
                                        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                                          <div 
                                            className={`h-full ${
                                              item.score === 1 ? 'bg-red-500' :
                                              item.score === 2 ? 'bg-yellow-500' :
                                              item.score === 3 ? 'bg-green-500' :
                                              'bg-purple-500'
                                            }`}
                                            style={{ width: `${(item.score / 4) * 100}%` }}
                                          />
                                        </div>
                                        {getCompetencyBadge(item.score)}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400">No score</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            )}

            {/* Learning Plan Section */}
            {performanceAnalysis && (
              <div className="mb-8">
                <button
                  onClick={() => setShowLearningPlan(!showLearningPlan)}
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white p-6 rounded-3xl font-black text-xl flex items-center justify-between hover:from-violet-700 hover:to-indigo-700 transition-all shadow-xl"
                >
                  <span className="flex items-center gap-3">
                    <Brain className="w-6 h-6" />
                    Personalized Learning Plan
                  </span>
                  <span className="text-2xl">{showLearningPlan ? '▼' : '▶'}</span>
                </button>

                {showLearningPlan && (
                  <div className="mt-4 space-y-4">
                    {performanceAnalysis.recommendations.map((rec: SubjectRecommendation, idx: number) => {
                      const config = getTierConfig(rec.tier)
                      
                      return (
                        <div key={idx} className={`border-4 ${config.borderClass} rounded-3xl p-6 ${config.bgClass} shadow-xl`}>
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-black uppercase">{formatSubjectName(rec.subject)}</h3>
                            <span className={`px-4 py-2 rounded-full font-bold ${config.badgeClass}`}>
                              {config.icon} {rec.tierLabel}
                            </span>
                          </div>

                          <p className="mb-4 font-medium">{rec.description}</p>

                          <div className="bg-white rounded-2xl p-4 mb-4">
                            <h4 className="font-black uppercase text-sm mb-3 flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              Action Steps
                            </h4>
                            <ol className="space-y-2">
                              {rec.actionSteps.map((step, i) => (
                                <li key={i} className="flex gap-2 text-sm">
                                  <span className="font-black">{i + 1}.</span>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ol>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white rounded-xl p-3">
                              <div className="font-black text-xs mb-1">⏱️ Timeline</div>
                              <div className="text-sm">{rec.estimatedTime}</div>
                            </div>
                            <div className="bg-white rounded-xl p-3">
                              <div className="font-black text-xs mb-1">🎯 Target</div>
                              <div className="text-sm">Level {rec.targetLevel}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={handleAIAnalysis}
                disabled={aiLoading}
                className="flex items-center justify-center gap-2 p-5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-bold hover:scale-105 transition-all shadow-xl disabled:opacity-50"
              >
                {aiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                {aiLoading ? 'Loading...' : 'Career Analysis'}
              </button>

              <Link
                href={`/chat?student=${studentId}`}
                className="flex items-center justify-center gap-2 p-5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-full font-bold hover:scale-105 transition-all shadow-xl"
              >
                <MessageCircle className="w-5 h-5" />
                Ask Tutor
              </Link>

              <button
                onClick={handlePDFDownload}
                disabled={pdfLoading}
                className="flex items-center justify-center gap-2 p-5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-full font-bold hover:scale-105 transition-all shadow-xl disabled:opacity-50"
              >
                {pdfLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                {pdfLoading ? 'Generating...' : 'Download Report'}
              </button>

              <Link
                href={`/dashboard/assessments/add?student=${studentId}`}
                className="flex items-center justify-center gap-2 p-5 bg-black text-white rounded-full font-bold hover:bg-violet-900 transition-all shadow-xl"
              >
                <PlusCircle className="w-5 h-5" />
                New Assessment
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}