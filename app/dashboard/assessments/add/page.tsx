'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, type Student, getPathwayElectives } from '@/lib/supabase'
import { calculateJuniorPathwayAffinity } from '@/lib/pathwayCalculator'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// Core 3 compulsory subjects (same for ALL pathways)
const CORE_COMPULSORY = [
  { key: 'english', label: 'English' },
  { key: 'kiswahili_ksl', label: 'Kiswahili/KSL' },
  { key: 'community_service_learning', label: 'Community Service Learning' }
]

// Junior school subjects
const JUNIOR_SUBJECTS = [
  { key: 'mathematics', label: 'Mathematics' },
  { key: 'english', label: 'English' },
  { key: 'kiswahili', label: 'Kiswahili' },
  { key: 'social_studies', label: 'Social Studies' },
  { key: 'integrated_science', label: 'Integrated Science' },
  { key: 'pre_technical_studies', label: 'Pre-Technical Studies' },
  { key: 'creative_arts_sports', label: 'Creative Arts & Sports' },
  { key: 'agriculture_nutrition', label: 'Agriculture & Nutrition' }
]

// ✨ NEW: Available interests for tracking
const AVAILABLE_INTERESTS = [
  { key: 'technology', label: 'Technology', emoji: '💻' },
  { key: 'science', label: 'Science', emoji: '🔬' },
  { key: 'mathematics', label: 'Mathematics', emoji: '🔢' },
  { key: 'art_design', label: 'Art & Design', emoji: '🎨' },
  { key: 'music', label: 'Music', emoji: '🎵' },
  { key: 'sports', label: 'Sports', emoji: '⚽' },
  { key: 'business', label: 'Business', emoji: '💼' },
  { key: 'languages', label: 'Languages', emoji: '🗣️' },
  { key: 'helping_people', label: 'Helping People', emoji: '❤️' },
  { key: 'writing', label: 'Writing', emoji: '✍️' },
  { key: 'engineering', label: 'Engineering', emoji: '⚙️' },
  { key: 'public_speaking', label: 'Public Speaking', emoji: '🎤' },
]

export default function BrutalistAddAssessment() {
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
  
  // ✨ NEW: Interests tracking state
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [customInterests, setCustomInterests] = useState<string>('') // ✨ NEW: Custom interests
  const [dreamCareer, setDreamCareer] = useState<string>('')
  
  const router = useRouter()
  const searchParams = useSearchParams()

  // Load students
  const loadStudents = useCallback(async () => {
    try {
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
    } catch (err) {
      console.error('Error loading students:', err)
      setError('Failed to load students')
    }
  }, [router])

  useEffect(() => {
    loadStudents()
    const studentId = searchParams.get('student')
    if (studentId) setSelectedStudent(studentId)
  }, [searchParams, loadStudents])

  // When student selected
  useEffect(() => {
    if (selectedStudent) {
      const student = students.find(s => s.id === selectedStudent)
      setCurrentStudent(student || null)
      setScores({})
      setSelectedElectives([])
      
      // ✨ NEW: Reset interests
      setSelectedInterests([])
      setCustomInterests('') // ✨ Reset custom interests too
      setDreamCareer('')
      
      // Auto-set math type based on pathway
      if (student?.current_pathway === 'STEM') {
        setMathType('core')
      } else {
        setMathType('essential')
      }
    }
  }, [selectedStudent, students])

  const isJunior = currentStudent && currentStudent.grade >= 7 && currentStudent.grade <= 9
  const isSenior = currentStudent && currentStudent.grade >= 10 && currentStudent.grade <= 12

  const toggleElective = (key: string) => {
    if (selectedElectives.includes(key)) {
      setSelectedElectives(p => p.filter(e => e !== key))
    } else if (selectedElectives.length < 3) {
      setSelectedElectives(p => [...p, key])
    } else {
      alert('Maximum 3 electives only! ⚠️')
    }
  }

  // ✨ NEW: Toggle interest function
  const toggleInterest = (key: string) => {
    if (selectedInterests.includes(key)) {
      setSelectedInterests(p => p.filter(i => i !== key))
    } else if (selectedInterests.length < 6) {
      setSelectedInterests(p => [...p, key])
    } else {
      alert('Maximum 6 interests only! ⚠️')
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
      if (!selectedStudent) throw new Error('Select a student first')
      if (!currentStudent) throw new Error('Student not found')

      if (isSenior) {
        if (!currentStudent.current_pathway) {
          throw new Error('Student must have a pathway! Edit student to set pathway.')
        }

        if (selectedElectives.length !== 3) {
          throw new Error('Select exactly 3 electives')
        }

        // Check all 7 required subjects are scored
        const requiredSubjects = [
          'english',
          'kiswahili_ksl',
          'community_service_learning',
          mathType === 'core' ? 'core_mathematics' : 'essential_mathematics',
          ...selectedElectives
        ]

        const missingSubjects = requiredSubjects.filter(subj => !scores[subj])
        if (missingSubjects.length > 0) {
          throw new Error(`Score all 7 subjects! Missing: ${missingSubjects.join(', ')}`)
        }
      } else if (isJunior) {
        if (Object.keys(scores).length === 0) {
          throw new Error('Enter at least one subject score')
        }
      }

      // Build assessment data
      const assessmentData: any = {
        student_id: selectedStudent,
        term,
        year,
        grade_level: isJunior ? 'junior' : 'senior',
        subject_scores: scores,
        mathematics_type: isSenior ? mathType : null,
        pathway_electives: isSenior ? selectedElectives : null,
      }

      // Calculate pathway recommendations for junior
      if (isJunior) {
        const recommendations = calculateJuniorPathwayAffinity(scores)
        assessmentData.pathway_recommendations = recommendations
      }

      const { error: insertError } = await supabase
        .from('assessments')
        .insert(assessmentData)

      if (insertError) throw insertError

      // ✨ NEW: Save interests if any selected
      if (selectedInterests.length > 0 || customInterests.trim() || dreamCareer.trim()) {
        // Combine preset interests with custom ones
        const customInterestsList = customInterests
          .split(',')
          .map(i => i.trim())
          .filter(i => i.length > 0)
        
        const allInterests = [...selectedInterests, ...customInterestsList]
        
        const interestsData = {
          student_id: selectedStudent,
          interests: allInterests.length > 0 ? allInterests : null,
          dream_career: dreamCareer.trim() || null,
          created_at: new Date().toISOString()
        }

        const { error: interestsError } = await supabase
          .from('student_interests')
          .insert(interestsData)

        if (interestsError) {
          console.error('Failed to save interests:', interestsError)
          // Don't fail the whole assessment, just log it
        }
      }

      // Success!
      if (isJunior) {
        const viewGuidance = confirm('Assessment saved! ✅\n\nView pathway guidance now?')
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
    <div className="p-4 rounded-2xl bg-white border-2 border-slate-100">
      <div className="text-xs font-black text-slate-400 mb-3 uppercase">{label}</div>
      <div className="flex gap-2">
        {[1, 2, 3, 4].map(v => (
          <button
            key={v}
            type="button"
            onClick={() => setScores(p => ({ ...p, [subjectKey]: v }))}
            className={`w-12 h-12 rounded-full font-black text-sm transition-all ${
              scores[subjectKey] === v
                ? 'bg-black text-white scale-110 shadow-lg'
                : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <nav className="border-b-4 border-black bg-white sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <Link href="/dashboard" className="text-sm font-black uppercase tracking-wider hover:underline">
            ← Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-5xl font-black mb-2 uppercase">New Assessment</h1>
        <div className="h-2 w-32 bg-black mb-12"></div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 border-4 border-red-600 text-red-900 p-6 rounded-3xl mb-8 font-black">
            ⚠️ {error}
          </div>
        )}

        {/* Assessment Details */}
        <section className="mb-10 p-8 bg-slate-50 rounded-3xl border-2 border-slate-200">
          <h2 className="text-xl font-black mb-6 uppercase text-slate-700">Assessment Info</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Student */}
            <div>
              <label className="block text-xs font-black text-slate-400 mb-2 uppercase">Student</label>
              <select
                value={selectedStudent}
                onChange={e => setSelectedStudent(e.target.value)}
                className="w-full p-4 bg-white rounded-xl font-bold border-2 border-slate-200 focus:border-black focus:outline-none"
              >
                <option value="">-- Choose --</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} (Grade {s.grade})
                  </option>
                ))}
              </select>
            </div>

            {/* Term */}
            <div>
              <label className="block text-xs font-black text-slate-400 mb-2 uppercase">Term</label>
              <select
                value={term}
                onChange={e => setTerm(Number(e.target.value))}
                className="w-full p-4 bg-white rounded-xl font-bold border-2 border-slate-200 focus:border-black focus:outline-none"
              >
                <option value={1}>Term 1</option>
                <option value={2}>Term 2</option>
                <option value={3}>Term 3</option>
              </select>
            </div>

            {/* Year */}
            <div>
              <label className="block text-xs font-black text-slate-400 mb-2 uppercase">Year</label>
              <input
                type="number"
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                min={2017}
                max={2030}
                className="w-full p-4 bg-white rounded-xl font-bold border-2 border-slate-200 focus:border-black focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* ✨ NEW: INTERESTS & ASPIRATIONS SECTION */}
        {currentStudent && (
          <section className="mb-10 p-8 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-3xl border-2 border-yellow-200">
            <div className="flex items-start gap-4 mb-6">
              <span className="text-4xl">✨</span>
              <div className="flex-1">
                <h2 className="text-xl font-black mb-2 uppercase text-yellow-900">
                  Interests & Aspirations
                </h2>
                <p className="text-sm text-yellow-700 leading-relaxed">
                  Help us understand what {currentStudent.name} enjoys. This tracks interests over time and helps with career recommendations!
                </p>
              </div>
              <span className="text-xs font-black text-yellow-600 bg-yellow-100 px-3 py-1.5 rounded-full">
                Optional ✨
              </span>
            </div>

            {/* Interest Selection */}
            <div className="mb-6">
              <label className="block text-sm font-black text-yellow-800 mb-3 uppercase">
                What are they interested in? (Select up to 6)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {AVAILABLE_INTERESTS.map(interest => (
                  <button
                    key={interest.key}
                    type="button"
                    onClick={() => toggleInterest(interest.key)}
                    className={`p-4 rounded-2xl text-left font-bold border-2 transition-all ${
                      selectedInterests.includes(interest.key)
                        ? 'bg-yellow-600 text-white border-yellow-600 scale-105 shadow-lg'
                        : 'bg-white text-yellow-700 border-yellow-200 hover:border-yellow-400'
                    }`}
                  >
                    <div className="text-3xl mb-2">{interest.emoji}</div>
                    <div className="text-xs font-black uppercase">
                      {interest.label}
                    </div>
                    {selectedInterests.includes(interest.key) && (
                      <div className="text-xs mt-1">✓ Selected</div>
                    )}
                  </button>
                ))}
              </div>
              <div className="mt-3 text-xs text-yellow-600 font-semibold">
                📊 Selected: {selectedInterests.length}/6
              </div>
            </div>

            {/* ✨ NEW: Custom Interests Field */}
            <div className="mb-6">
              <label className="block text-sm font-black text-yellow-800 mb-3 uppercase">
                Other Interests (Optional)
              </label>
              <input
                type="text"
                value={customInterests}
                onChange={e => setCustomInterests(e.target.value)}
                placeholder="e.g., Photography, Cooking, Gaming, Robotics (separate with commas)"
                className="w-full p-4 bg-white rounded-xl font-medium border-2 border-yellow-200 focus:border-yellow-500 focus:outline-none placeholder:text-slate-400"
              />
              <p className="mt-2 text-xs text-yellow-600 leading-relaxed">
                💡 <strong>Don't see an interest above?</strong> Type it here! Separate multiple interests with commas.
              </p>
            </div>

            {/* Dream Career (Optional) */}
            <div>
              <label className="block text-sm font-black text-yellow-800 mb-3 uppercase">
                Dream Career (Optional)
              </label>
              <input
                type="text"
                value={dreamCareer}
                onChange={e => setDreamCareer(e.target.value)}
                placeholder="e.g., Software Engineer, Doctor, Teacher, Artist..."
                className="w-full p-4 bg-white rounded-xl font-medium border-2 border-yellow-200 focus:border-yellow-500 focus:outline-none placeholder:text-slate-400"
              />
              <p className="mt-2 text-xs text-yellow-600 leading-relaxed">
                💡 <strong>Why track this?</strong> We'll show you if their interests align with their career goals over time, helping you guide them better!
              </p>
            </div>
          </section>
        )}

        {/* JUNIOR SCHOOL */}
        {isJunior && currentStudent && (
          <div className="space-y-8">
            <div className="p-6 bg-green-50 rounded-3xl border-4 border-green-200">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">🎯</span>
                <div>
                  <h2 className="text-2xl font-black uppercase text-green-900">Junior School</h2>
                  <p className="text-sm font-bold text-green-600">Grade {currentStudent.grade} • Pathway Guidance Enabled</p>
                </div>
              </div>
            </div>

            <section className="p-8 bg-blue-50 rounded-3xl border-2 border-blue-200">
              <h2 className="text-xl font-black mb-6 uppercase text-blue-900">Learning Areas</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {JUNIOR_SUBJECTS.map(subject => (
                  <ScoreButtons 
                    key={subject.key}
                    subjectKey={subject.key}
                    label={subject.label}
                  />
                ))}
              </div>
            </section>
          </div>
        )}

        {/* SENIOR SCHOOL */}
        {isSenior && currentStudent && (
          <div className="space-y-8">
            {/* Pathway Badge */}
            <div className="p-6 bg-purple-50 rounded-3xl border-4 border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black uppercase text-purple-900">Senior School</h2>
                  <p className="text-sm font-bold text-purple-600">Grade {currentStudent.grade} • Total: 7 Subjects</p>
                </div>
                {currentStudent.current_pathway ? (
                  <div className="px-6 py-3 bg-purple-900 text-white rounded-full font-black uppercase text-sm">
                    {currentStudent.current_pathway}
                  </div>
                ) : (
                  <div className="px-6 py-3 bg-red-600 text-white rounded-full font-black uppercase text-sm">
                    ⚠️ No Pathway Set
                  </div>
                )}
              </div>
            </div>

            {!currentStudent.current_pathway ? (
              <div className="p-8 bg-red-50 rounded-3xl border-4 border-red-300 text-center">
                <div className="text-6xl mb-4">🚫</div>
                <h3 className="text-2xl font-black text-red-900 mb-2">Pathway Required!</h3>
                <p className="text-red-700 font-bold mb-6">
                  This student needs a pathway before adding assessments.
                </p>
                <Link
                  href="/dashboard"
                  className="inline-block px-8 py-4 bg-red-600 text-white rounded-full font-black uppercase"
                >
                  Go to Dashboard
                </Link>
              </div>
            ) : (
              <>
                {/* Compulsory Core (4 subjects: English, Kisw, CSL, Math) */}
                <section className="p-8 bg-green-50 rounded-3xl border-2 border-green-200">
                  <h2 className="text-xl font-black mb-2 uppercase text-green-900">
                    <span className="bg-green-900 text-white px-4 py-2 rounded-full text-sm mr-3">PART 1</span>
                    Compulsory Subjects (4)
                  </h2>
                  <p className="text-xs font-bold text-green-600 mb-6">
                    These are required for ALL students regardless of pathway
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Core 3 subjects */}
                    {CORE_COMPULSORY.map(subject => (
                      <ScoreButtons 
                        key={subject.key}
                        subjectKey={subject.key}
                        label={subject.label}
                      />
                    ))}

                    {/* Mathematics - auto-determined by pathway */}
                    <div className="md:col-span-2">
                      <div className="p-4 bg-yellow-100 rounded-2xl mb-4 border-2 border-yellow-300">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-black text-yellow-900 uppercase">Mathematics Type</div>
                            <div className="text-sm font-bold text-yellow-700 mt-1">
                              {currentStudent.current_pathway === 'STEM' ? (
                                <>✅ Core Mathematics (STEM Pathway)</>
                              ) : (
                                <>✅ Essential Mathematics (Non-STEM Pathway)</>
                              )}
                            </div>
                          </div>
                          <div className="text-2xl">
                            {currentStudent.current_pathway === 'STEM' ? '🔬' : '🎨'}
                          </div>
                        </div>
                      </div>
                      
                      <ScoreButtons 
                        subjectKey={mathType === 'core' ? 'core_mathematics' : 'essential_mathematics'}
                        label={mathType === 'core' ? 'Core Mathematics' : 'Essential Mathematics'}
                      />
                    </div>
                  </div>
                </section>

                {/* Pathway Electives (3 subjects) */}
                <section className="p-8 bg-purple-50 rounded-3xl border-2 border-purple-200">
                  <h2 className="text-xl font-black mb-2 uppercase text-purple-900">
                    <span className="bg-purple-900 text-white px-4 py-2 rounded-full text-sm mr-3">PART 2</span>
                    {currentStudent.current_pathway} Electives (3)
                  </h2>
                  <p className="text-xs font-black text-purple-400 mb-6 uppercase">
                    Choose exactly 3 from your pathway • Selected: {selectedElectives.length}/3
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                    {getPathwayElectives(currentStudent.current_pathway).map(elective => (
                      <button
                        key={elective.key}
                        type="button"
                        onClick={() => toggleElective(elective.key)}
                        className={`p-4 rounded-2xl text-left text-xs font-black border-2 transition-all ${
                          selectedElectives.includes(elective.key)
                            ? 'bg-purple-900 text-white border-purple-900 scale-105 shadow-lg'
                            : 'bg-white text-purple-400 border-purple-200 hover:border-purple-400'
                        }`}
                      >
                        {elective.label}
                        {selectedElectives.includes(elective.key) && <span className="ml-2">✓</span>}
                      </button>
                    ))}
                  </div>

                  {/* Score Selected Electives */}
                  {selectedElectives.length > 0 && (
                    <div className="space-y-4 pt-6 border-t-2 border-purple-200">
                      <h3 className="text-sm font-black text-purple-900 uppercase flex items-center gap-2">
                        <span className="text-xl">📝</span> 
                        Score Your {selectedElectives.length} Selected Elective{selectedElectives.length > 1 ? 's' : ''}:
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    </div>
                  )}
                </section>

                {/* Summary */}
                <div className="p-6 bg-blue-50 rounded-3xl border-2 border-blue-200">
                  <h3 className="text-sm font-black text-blue-900 uppercase mb-3">📊 Assessment Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="p-4 bg-white rounded-xl">
                      <div className="text-3xl font-black text-blue-600">4</div>
                      <div className="text-xs font-bold text-slate-600 mt-1">Compulsory</div>
                    </div>
                    <div className="p-4 bg-white rounded-xl">
                      <div className="text-3xl font-black text-purple-600">{selectedElectives.length}</div>
                      <div className="text-xs font-bold text-slate-600 mt-1">Electives</div>
                    </div>
                    <div className="p-4 bg-white rounded-xl">
                      <div className="text-3xl font-black text-green-600">{Object.keys(scores).length}</div>
                      <div className="text-xs font-bold text-slate-600 mt-1">Scored</div>
                    </div>
                    <div className="p-4 bg-white rounded-xl">
                      <div className="text-3xl font-black text-orange-600">7</div>
                      <div className="text-xs font-bold text-slate-600 mt-1">Total Required</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Submit Button */}
        {currentStudent && (isSenior ? currentStudent.current_pathway : true) && (
          <div className="mt-12 flex gap-4">
            <Link
              href="/dashboard"
              className="px-8 py-6 bg-slate-200 text-slate-700 rounded-full font-black uppercase tracking-widest hover:bg-slate-300 transition-all"
            >
              Cancel
            </Link>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 p-6 bg-black text-white rounded-full font-black uppercase tracking-widest shadow-2xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Saving...' : '💾 Save Assessment'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}