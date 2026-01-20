'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { 
  supabase, 
  type Student, 
  JUNIOR_SUBJECTS,
  SENIOR_CORE_SUBJECTS,
  MATHEMATICS_OPTIONS,
  SENIOR_LIFE_SKILLS,
  getPathwayElectives,
  COMPETENCY_LEVELS 
} from '@/lib/supabase'
import { calculateJuniorPathwayAffinity } from '@/lib/pathwayCalculator'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// Logic yako yote sasa iko ndani ya hii component
function AssessmentForm() {
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent] = useState<string>('')
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null)
  const [term, setTerm] = useState<number>(1)
  const [year, setYear] = useState<number>(new Date().getFullYear())
  
  const [scores, setScores] = useState<Record<string, number>>({})
  
  const [mathType, setMathType] = useState<'core' | 'essential'>('core')
  const [selectedElectives, setSelectedElectives] = useState<string[]>([])
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()
  const searchParams = useSearchParams()

  const loadStudents = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', user.id)
      .order('name')

    if (data) setStudents(data)
  }, [router])

  useEffect(() => {
    loadStudents()
    const studentId = searchParams.get('student')
    if (studentId) setSelectedStudent(studentId)
  }, [searchParams, loadStudents])

  useEffect(() => {
    if (selectedStudent) {
      const student = students.find(s => s.id === selectedStudent)
      setCurrentStudent(student || null)
      setScores({})
      setSelectedElectives([])
      
      if (student?.current_pathway === 'STEM') {
        setMathType('core')
      } else {
        setMathType('essential')
      }
    }
  }, [selectedStudent, students])

  const isJuniorSchool = currentStudent && currentStudent.grade >= 7 && currentStudent.grade <= 9
  const isSeniorSchool = currentStudent && currentStudent.grade >= 10 && currentStudent.grade <= 12

  const handleScoreChange = (subject: string, value: number) => {
    setScores(prev => ({ ...prev, [subject]: value }))
  }

  const toggleElective = (electiveKey: string) => {
    if (selectedElectives.includes(electiveKey)) {
      setSelectedElectives(prev => prev.filter(e => e !== electiveKey))
    } else {
      if (selectedElectives.length < 3) {
        setSelectedElectives(prev => [...prev, electiveKey])
      } else {
        alert('You can only select 3 pathway electives!')
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!selectedStudent) throw new Error('Please select a student')
      if (!currentStudent) throw new Error('Student not found')
      
      if (isSeniorSchool) {
        if (!currentStudent.current_pathway) {
          throw new Error('Student must have a pathway selected. Please edit student profile to add pathway.')
        }

        if (selectedElectives.length !== 3) {
          throw new Error('Please select exactly 3 pathway electives')
        }
        
        const availableElectives = getPathwayElectives(currentStudent.current_pathway)
        if (availableElectives.length === 0) {
          throw new Error('No electives available for this pathway. Please contact support.')
        }

        const requiredSubjects = [
          'english',
          'kiswahili_ksl',
          'community_service_learning',
          mathType === 'core' ? 'core_mathematics' : 'essential_mathematics',
          'physical_education',
          'ict',
          ...selectedElectives
        ]

        const missingSubjects = requiredSubjects.filter(subj => !scores[subj])
        if (missingSubjects.length > 0) {
          throw new Error(`Please enter scores for all subjects. Missing: ${missingSubjects.map(s => s.replace(/_/g, ' ')).join(', ')}`)
        }

      } else if (isJuniorSchool) {
        if (Object.keys(scores).length === 0) {
          throw new Error('Please enter at least one subject score')
        }
      }

      const assessmentData: any = {
        student_id: selectedStudent,
        term: term,
        year: year,
        grade_level: isJuniorSchool ? 'junior' : 'senior',
        subject_scores: scores,
        mathematics_type: isSeniorSchool ? mathType : null,
        pathway_electives: isSeniorSchool ? selectedElectives : null,
      }

      if (isJuniorSchool) {
        const recommendations = calculateJuniorPathwayAffinity(scores)
        assessmentData.pathway_recommendations = recommendations
      }

      const { error: insertError } = await supabase
        .from('assessments')
        .insert(assessmentData)

      if (insertError) throw insertError

      if (isJuniorSchool) {
        const viewGuidance = confirm('Assessment saved successfully! ✅\n\nView pathway guidance?')
        if (viewGuidance) {
          router.push(`/dashboard/assessments/guidance?student=${selectedStudent}`)
        } else {
          router.push('/dashboard')
        }
      } else {
        alert('Assessment saved successfully! ✅')
        router.push('/dashboard')
      }

    } catch (err) {
      console.error('Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to save assessment')
    } finally {
      setLoading(false)
    }
  }

  const ScoreButtons = ({ subjectKey, label }: { subjectKey: string, label: string }) => (
    <div className="border border-gray-200 rounded-lg p-4">
      <label className="block font-medium text-gray-900 mb-3">{label}</label>
      <div className="grid grid-cols-4 gap-2">
        {COMPETENCY_LEVELS.map((level) => (
          <button
            key={level.value}
            type="button"
            onClick={() => handleScoreChange(subjectKey, level.value)}
            className={`px-3 py-2 rounded-lg border-2 text-xs font-semibold transition ${
              scores[subjectKey] === level.value
                ? `${level.borderColor} ${level.bgColor} ${level.textColor}`
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="text-center">
              <div className="font-bold text-base">{level.value}</div>
              <div className="text-[10px] mt-1">{level.short}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">← Back to Dashboard</Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Add Assessment</h1>

          <form onSubmit={handleSubmit} className="space-y-8">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}

            <div className="bg-blue-50 p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-4">Assessment Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Select Student</label>
                  <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)} required className="w-full px-4 py-2 border rounded-lg">
                    <option value="">Choose a student</option>
                    {students.map((s) => (<option key={s.id} value={s.id}>{s.name} (Grade {s.grade})</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Term</label>
                  <select value={term} onChange={(e) => setTerm(Number(e.target.value))} required className="w-full px-4 py-2 border rounded-lg">
                    <option value={1}>Term 1</option><option value={2}>Term 2</option><option value={3}>Term 3</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Year</label>
                  <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} required min={2017} max={2030} className="w-full px-4 py-2 border rounded-lg"/>
                </div>
              </div>
            </div>

            {isJuniorSchool && currentStudent && (
              <div className="space-y-4">
                <div className="bg-green-50 p-4 rounded-lg"><h3 className="font-bold">Junior School Assessment</h3></div>
                {JUNIOR_SUBJECTS.map((s) => (<ScoreButtons key={s.key} subjectKey={s.key} label={s.label}/>))}
              </div>
            )}

            {isSeniorSchool && currentStudent && (
              <div className="space-y-8">
                {SENIOR_CORE_SUBJECTS.map((s) => (<ScoreButtons key={s.key} subjectKey={s.key} label={s.label}/>))}
                {/* Mathematics Logic... etc. */}
                <ScoreButtons subjectKey={mathType === 'core' ? 'core_mathematics' : 'essential_mathematics'} label="Mathematics"/>
                {SENIOR_LIFE_SKILLS.map((s) => (<ScoreButtons key={s.key} subjectKey={s.key} label={s.label}/>))}
                
                {/* Electives Logic... */}
                {currentStudent.current_pathway && getPathwayElectives(currentStudent.current_pathway).map((s) => (
                  selectedElectives.includes(s.key) && <ScoreButtons key={s.key} subjectKey={s.key} label={s.label}/>
                ))}
              </div>
            )}

            <div className="flex gap-4 pt-6 border-t">
              <button type="submit" disabled={loading} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700">
                {loading ? 'Saving...' : 'Save Assessment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Hapa ndipo tunasuluhisha ile Error ya Build!
export default function AddAssessmentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="ml-4">Fomu inapakuliwa...</p>
      </div>
    }>
      <AssessmentForm />
    </Suspense>
  )
}