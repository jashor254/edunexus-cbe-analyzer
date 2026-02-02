'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { 
  supabase, 
  type Student, 
  JUNIOR_SUBJECTS,
  SENIOR_CORE_SUBJECTS,
  getPathwayElectives,
  COMPETENCY_LEVELS 
} from '@/lib/supabase'
import { calculateJuniorPathwayAffinity } from '@/lib/pathwayCalculator'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

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
    if (!user) { router.push('/login'); return; }
    const { data } = await supabase.from('students').select('*').eq('user_id', user.id).order('name')
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
      setMathType(student?.current_pathway === 'STEM' ? 'core' : 'essential')
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
    } else if (selectedElectives.length < 3) {
      setSelectedElectives(prev => [...prev, electiveKey])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!currentStudent) throw new Error('Please select a student')
      
      if (isSeniorSchool) {
        if (selectedElectives.length !== 3) throw new Error('Please select exactly 3 pathway electives')
        
        // VALIDATION FOR 7 SUBJECTS ONLY
        const requiredKeys = [
          'english', 'kiswahili_ksl', 'community_service_learning',
          mathType === 'core' ? 'core_mathematics' : 'essential_mathematics',
          ...selectedElectives
        ]

        const missing = requiredKeys.filter(k => !scores[k])
        if (missing.length > 0) throw new Error(`Missing scores for: ${missing.join(', ')}`)
      }

      const { error: insertError } = await supabase.from('assessments').insert([{
        student_id: selectedStudent,
        term, year,
        grade_level: isJuniorSchool ? 'junior' : 'senior',
        subject_scores: scores,
        mathematics_type: isSeniorSchool ? mathType : null,
        pathway_electives: isSeniorSchool ? selectedElectives : null,
      }])

      if (insertError) throw insertError
      alert('Assessment saved successfully! ✅')
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message)
    } finally { setLoading(false) }
  }

  const ScoreButtons = ({ subjectKey, label }: { subjectKey: string, label: string }) => (
    <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
      <label className="block font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide">{label}</label>
      <div className="grid grid-cols-4 gap-2">
        {COMPETENCY_LEVELS.map((level) => (
          <button key={level.value} type="button" onClick={() => handleScoreChange(subjectKey, level.value)}
            className={`py-3 rounded-lg border-2 transition-all ${scores[subjectKey] === level.value ? `${level.borderColor} ${level.bgColor} ${level.textColor} scale-105 shadow-md` : 'border-gray-100 hover:border-gray-300 text-gray-400'}`}>
            <span className="block text-lg font-black">{level.value}</span>
            <span className="text-[9px] font-bold uppercase">{level.short}</span>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h1 className="text-2xl font-black text-slate-800 mb-2">New Assessment</h1>
            <p className="text-slate-500 text-sm mb-6 font-medium">Phase 2: Rationalized 7-Subject Entry</p>
            
            {error && <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm font-bold">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               {/* Student, Term, Year Selectors here (Same as before) */}
               <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)} className="p-3 border rounded-xl font-medium">
                  <option value="">Select Student</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name} (G{s.grade})</option>)}
               </select>
            </div>
          </div>

          {isSeniorSchool && currentStudent && (
            <div className="space-y-6">
              <div className="bg-blue-600 text-white p-4 rounded-xl shadow-md">
                <p className="font-black text-xs uppercase tracking-widest mb-1">Current Pathway</p>
                <p className="text-xl font-bold">{currentStudent.current_pathway}</p>
              </div>

              {/* Step 1: Core (3) */}
              <div className="grid grid-cols-1 gap-4">
                <h2 className="font-black text-slate-400 text-xs uppercase">Step 1: Compulsory Core</h2>
                {SENIOR_CORE_SUBJECTS.map(s => <ScoreButtons key={s.key} subjectKey={s.key} label={s.label}/>)}
                <ScoreButtons subjectKey={mathType === 'core' ? 'core_mathematics' : 'essential_mathematics'} label={`Mathematics (${mathType})`}/>
              </div>

              {/* Step 2: Choose 3 Electives */}
              <div className="bg-white p-6 rounded-2xl border-2 border-dashed border-slate-200">
                <h2 className="font-black text-slate-800 text-sm uppercase mb-4 text-center">Step 2: Choose 3 Electives</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {getPathwayElectives(currentStudent.current_pathway!).map(e => (
                    <button key={e.key} type="button" onClick={() => toggleElective(e.key)}
                      className={`p-3 rounded-xl text-[10px] font-bold border-2 transition-all ${selectedElectives.includes(e.key) ? 'bg-green-600 border-green-700 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300'}`}>
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 3: Enter Scores for 3 Electives */}
              {selectedElectives.length === 3 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                   <h2 className="font-black text-slate-400 text-xs uppercase">Step 3: Elective Scores</h2>
                   {selectedElectives.map(key => {
                     const label = getPathwayElectives(currentStudent.current_pathway!).find(e => e.key === key)?.label || key
                     return <ScoreButtons key={key} subjectKey={key} label={label}/>
                   })}
                </div>
              )}
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black hover:bg-black transition-all shadow-xl">
            {loading ? 'PROCESSING...' : 'SAVE 7-SUBJECT ASSESSMENT'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function AddAssessmentPage() {
  return (
    <Suspense fallback={<div className="p-20 text-center font-bold">Loading...</div>}>
      <AssessmentForm />
    </Suspense>
  )
}