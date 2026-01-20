'use client'

import { useState, useEffect, useCallback } from 'react'
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

export default function AddAssessmentPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent] = useState<string>('')
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null)
  const [term, setTerm] = useState<number>(1)
  const [year, setYear] = useState<number>(new Date().getFullYear())
  
  const [scores, setScores] = useState<Record<string, number>>({})
  
  // Senior school specific
  const [mathType, setMathType] = useState<'core' | 'essential'>('core')
  const [selectedElectives, setSelectedElectives] = useState<string[]>([])
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()
  const searchParams = useSearchParams()

  // ✅ FIX: Use useCallback to memoize loadStudents
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

  // ✅ FIX: Added loadStudents to dependencies
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
        
        // ✅ FIX: Validate that pathway has electives available
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

      // Build assessment data
      const assessmentData: any = {
        student_id: selectedStudent,
        term: term,
        year: year,
        grade_level: isJuniorSchool ? 'junior' : 'senior',
        subject_scores: scores,
        mathematics_type: isSeniorSchool ? mathType : null,
        pathway_electives: isSeniorSchool ? selectedElectives : null,
      }

      // 🎯 CALCULATE PATHWAY RECOMMENDATIONS FOR JUNIOR SCHOOL
      if (isJuniorSchool) {
        const recommendations = calculateJuniorPathwayAffinity(scores)
        assessmentData.pathway_recommendations = recommendations
      }

      const { data, error: insertError } = await supabase
        .from('assessments')
        .insert(assessmentData)
        .select()

      if (insertError) {
        console.error('Database error:', insertError)
        throw insertError
      }

      // Show success with pathway guidance link for junior school
      if (isJuniorSchool) {
        const viewGuidance = confirm(
          'Assessment saved successfully! ✅\n\nWould you like to view pathway guidance now?'
        )
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
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to save assessment')
      }
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
            className={`
              px-3 py-2 rounded-lg border-2 text-xs font-semibold transition
              ${scores[subjectKey] === level.value
                ? `${level.borderColor} ${level.bgColor} ${level.textColor}`
                : 'border-gray-300 hover:border-gray-400'
              }
            `}
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
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">
            ← Back to Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Add Assessment
          </h1>

          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Assessment Details */}
            <div className="bg-blue-50 p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-4">Assessment Details</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Student
                  </label>
                  <select
                    value={selectedStudent}
                    onChange={(e) => setSelectedStudent(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Choose a student</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name} (Grade {student.grade})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Term
                  </label>
                  <select
                    value={term}
                    onChange={(e) => setTerm(Number(e.target.value))}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value={1}>Term 1</option>
                    <option value={2}>Term 2</option>
                    <option value={3}>Term 3</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Year
                  </label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    required
                    min={2017}
                    max={2030}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Junior School Info Banner */}
            {isJuniorSchool && (
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🎯</span>
                  <div>
                    <h3 className="font-bold text-green-900">Pathway Guidance Enabled!</h3>
                    <p className="text-sm text-green-700">
                      After saving, you&apos;ll receive pathway recommendations based on performance patterns
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Progress Indicator for Senior School */}
            {isSeniorSchool && currentStudent && (
              <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-purple-900">Senior School Progress</h3>
                  <span className="text-sm text-purple-700">
                    Total subjects: 9 (3 core + 1 math + 2 life skills + 3 electives)
                  </span>
                </div>
                <div className="text-sm text-purple-800">
                  <strong>Pathway:</strong> {currentStudent.current_pathway || '❌ Not set'}
                </div>
                <div className="text-sm text-purple-800">
                  <strong>Electives selected:</strong> {selectedElectives.length}/3
                </div>
                <div className="text-sm text-purple-800">
                  <strong>Scores entered:</strong> {Object.keys(scores).length}/9
                </div>
              </div>
            )}

            {/* JUNIOR SCHOOL */}
            {isJuniorSchool && currentStudent && (
              <div>
                <div className="bg-green-50 p-4 rounded-lg mb-6">
                  <h2 className="text-xl font-bold text-green-900">
                    Junior School Assessment (Grade {currentStudent.grade})
                  </h2>
                  <p className="text-green-700 mt-1 text-sm">
                    Rate competency level for each learning area
                  </p>
                </div>

                <div className="space-y-4">
                  {JUNIOR_SUBJECTS.map((subject) => (
                    <ScoreButtons 
                      key={subject.key}
                      subjectKey={subject.key}
                      label={subject.label}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* SENIOR SCHOOL */}
            {isSeniorSchool && currentStudent && (
              <div className="space-y-8">
                {/* SECTION 1: CORE SUBJECTS */}
                <div>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span className="bg-blue-600 text-white px-3 py-1 rounded text-sm">1</span>
                    Core/Compulsory Subjects (3 subjects)
                  </h3>
                  <div className="space-y-4">
                    {SENIOR_CORE_SUBJECTS.map((subject) => (
                      <ScoreButtons 
                        key={subject.key}
                        subjectKey={subject.key}
                        label={subject.label}
                      />
                    ))}
                  </div>
                </div>

                {/* SECTION 2: MATHEMATICS */}
                <div>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span className="bg-blue-600 text-white px-3 py-1 rounded text-sm">2</span>
                    Mathematics (1 subject)
                  </h3>
                  
                  <div className="bg-yellow-50 p-4 rounded-lg mb-4">
                    <label className="block text-sm font-medium mb-2">Select Mathematics Type:</label>
                    <div className="flex gap-4">
                      {MATHEMATICS_OPTIONS.map((math) => (
                        <button
                          key={math.key}
                          type="button"
                          onClick={() => setMathType(math.key === 'core_mathematics' ? 'core' : 'essential')}
                          className={`
                            px-4 py-2 rounded-lg border-2 text-sm font-semibold
                            ${(math.key === 'core_mathematics' && mathType === 'core') ||
                              (math.key === 'essential_mathematics' && mathType === 'essential')
                              ? 'border-blue-600 bg-blue-50 text-blue-700'
                              : 'border-gray-300 hover:border-gray-400'
                            }
                          `}
                        >
                          {math.label}
                          <div className="text-xs text-gray-600 mt-1">{math.pathway}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <ScoreButtons 
                    subjectKey={mathType === 'core' ? 'core_mathematics' : 'essential_mathematics'}
                    label={mathType === 'core' ? 'Core Mathematics' : 'Essential Mathematics'}
                  />
                </div>

                {/* SECTION 3: LIFE SKILLS */}
                <div>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span className="bg-blue-600 text-white px-3 py-1 rounded text-sm">3</span>
                    Life Skills Subjects (2 subjects)
                  </h3>
                  <div className="space-y-4">
                    {SENIOR_LIFE_SKILLS.map((subject) => (
                      <ScoreButtons 
                        key={subject.key}
                        subjectKey={subject.key}
                        label={subject.label}
                      />
                    ))}
                  </div>
                </div>

                {/* SECTION 4: PATHWAY ELECTIVES */}
                <div>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span className="bg-blue-600 text-white px-3 py-1 rounded text-sm">4</span>
                    Pathway Electives (3 subjects)
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Note: Religious Education (CRE/IRE/HRE) is included as one of the elective options
                  </p>

                  {currentStudent.current_pathway ? (
                    <>
                      <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-6 mb-6">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-bold">Select 3 Electives from {currentStudent.current_pathway} pathway</h4>
                          <span className="text-sm font-semibold text-purple-700">
                            {selectedElectives.length}/3 selected
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {getPathwayElectives(currentStudent.current_pathway).map((elective) => {
                            const isSelected = selectedElectives.includes(elective.key)
                            
                            return (
                              <button
                                key={elective.key}
                                type="button"
                                onClick={() => toggleElective(elective.key)}
                                className={`
                                  text-left px-4 py-3 rounded-lg border-2 text-sm transition
                                  ${isSelected 
                                    ? 'border-purple-600 bg-purple-100 font-semibold text-purple-900' 
                                    : 'border-gray-300 hover:border-purple-300 hover:bg-purple-50'
                                  }
                                `}
                              >
                                {elective.label}
                                {isSelected && <span className="ml-2">✓</span>}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {selectedElectives.length > 0 && (
                        <div className="space-y-4">
                          <p className="text-sm text-gray-600 mb-4">
                            Now rate the performance in your selected electives:
                          </p>
                          {selectedElectives.map(electiveKey => {
                            const elective = getPathwayElectives(currentStudent.current_pathway!).find(e => e.key === electiveKey)
                            if (!elective) return null
                            
                            return (
                              <ScoreButtons 
                                key={elective.key}
                                subjectKey={elective.key}
                                label={elective.label}
                              />
                            )
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                      <p className="text-red-700 font-semibold">
                        ⚠️ Student pathway not set
                      </p>
                      <p className="text-red-600 text-sm mt-2">
                        Please go back to dashboard and edit this student to select a pathway
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Submit */}
            {currentStudent && (
              <div className="flex gap-4 pt-6 border-t">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving Assessment...' : 'Save Assessment'}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}