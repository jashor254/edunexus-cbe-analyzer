'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, type Student } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  PlusCircle, History, ChevronRight, Sparkles, GraduationCap, 
  Calendar, Users, BookOpen, CheckCircle2, AlertCircle, Heart, Zap 
} from 'lucide-react'

// ============================================
// ALL SUBJECTS DEFINED HERE
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

// Helper function to get electives based on pathway
function getPathwayElectives(pathway: string) {
  switch(pathway) {
    case 'STEM':
      return STEM_ELECTIVES
    case 'Social Sciences':
      return SOCIAL_SCIENCES_ELECTIVES
    case 'Arts & Sports Science':
      return ARTS_SPORTS_ELECTIVES
    default:
      return []
  }
}

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

// Available years (constant)
const AVAILABLE_YEARS = [2026, 2027, 2028]

// Terms (constant)
const TERMS = [1, 2, 3]

export default function AddAssessmentPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent] = useState<string>('')
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null)
  const [term, setTerm] = useState<number>(1)
  const [year, setYear] = useState<number>(2026)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [mathType, setMathType] = useState<'core' | 'essential'>('essential')
  const [selectedElectives, setSelectedElectives] = useState<string[]>([])
  const [selectedReligion, setSelectedReligion] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [newStudentName, setNewStudentName] = useState('')
  const [newStudentGrade, setNewStudentGrade] = useState<number>(7)
  const [newStudentPathway, setNewStudentPathway] = useState<string>('')
  const [addingStudent, setAddingStudent] = useState(false)
  
  const router = useRouter()

  // Load students on mount
  useEffect(() => {
    loadStudents()
  }, [])

  const loadStudents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', user.id)
        .order('name')

      if (data) setStudents(data)
    } catch (err) {
      console.error('Error loading students:', err)
    }
  }

  // Update current student when selected
  useEffect(() => {
    if (selectedStudent) {
      const student = students.find(s => s.id === selectedStudent)
      setCurrentStudent(student || null)
      setScores({})
      setSelectedElectives([])
      setSelectedReligion('')
      
      // Set default math type based on pathway
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
      alert('Maximum 3 electives! ⚠️')
    }
  }

  const handleAddStudent = async () => {
    if (!newStudentName.trim()) return
    
    setAddingStudent(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('students')
        .insert({
          name: newStudentName,
          grade: newStudentGrade,
          current_pathway: newStudentPathway || null,
          user_id: user.id
        })
        .select()
        .single()

      if (error) throw error

      // Refresh students list
      await loadStudents()
      
      // Select the new student
      if (data) {
        setSelectedStudent(data.id)
      }
      
      // Reset form
      setShowAddStudent(false)
      setNewStudentName('')
      setNewStudentGrade(7)
      setNewStudentPathway('')
      
    } catch (err) {
      console.error('Error adding student:', err)
      alert('Failed to add student')
    } finally {
      setAddingStudent(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedStudent || !currentStudent) {
      alert('Please select a student')
      return
    }

    // Validation
    if (isJunior) {
      if (!selectedReligion) {
        alert('Please select a Religious Education subject (CRE/IRE/HRE)')
        return
      }
      if (Object.keys(scores).length === 0) {
        alert('Please enter at least one subject score')
        return
      }
    }

    if (isSenior) {
      if (!currentStudent.current_pathway) {
        alert('Senior student needs a pathway. Please edit student profile.')
        return
      }
      if (selectedElectives.length !== 3) {
        alert('Please select exactly 3 elective subjects')
        return
      }
      
      // Check if all compulsory subjects are scored
      const compulsoryKeys = ['english', 'kiswahili_ksl', 'community_service']
      const mathKey = mathType === 'core' ? 'core_mathematics' : 'essential_mathematics'
      const allSubjects = [...compulsoryKeys, mathKey, ...selectedElectives]
      
      const missingSubjects = allSubjects.filter(subj => !scores[subj])
      if (missingSubjects.length > 0) {
        alert('Please score all compulsory subjects and selected electives')
        return
      }
    }

    setLoading(true)
    try {
      // Build subject scores including religion for junior
      let finalScores = { ...scores }
      if (isJunior && selectedReligion) {
        finalScores[selectedReligion] = scores[selectedReligion] || 0
      }

      const assessmentData = {
        student_id: selectedStudent,
        grade: currentStudent.grade,
        term,
        year,
        grade_level: isJunior ? 'junior' : 'senior',
        subject_scores: finalScores,
        mathematics_type: isSenior ? mathType : null,
        pathway_electives: isSenior ? selectedElectives : null
      }

      const { error } = await supabase
        .from('assessments')
        .insert(assessmentData)

      if (error) throw error

      alert('Assessment saved successfully! ✅')
      router.push(`/dashboard/assessments/history?student=${selectedStudent}`)
      
    } catch (err) {
      console.error('Error saving assessment:', err)
      alert('Failed to save assessment')
    } finally {
      setLoading(false)
    }
  }

  const ScoreButton = ({ subjectKey, label, emoji }: { subjectKey: string, label: string, emoji: string }) => (
    <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 hover:border-violet-300 transition-all">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{emoji}</span>
        <span className="font-bold text-sm text-slate-700">{label}</span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(score => (
          <button
            key={score}
            onClick={() => setScores(prev => ({ ...prev, [subjectKey]: score }))}
            className={`flex-1 py-2 rounded-lg font-bold transition-all ${
              scores[subjectKey] === score
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white scale-105 shadow-lg'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <div className="border-b-4 border-black bg-white sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="font-bold text-black hover:text-violet-600 transition-colors">
            ← Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-600" />
            <span className="font-black text-sm text-black">EDUNEXUS</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header with action buttons */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-black">
              New <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">Assessment</span>
            </h1>
            <p className="text-slate-600 mt-2 font-medium">Add performance scores for your student</p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddStudent(true)}
              className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-full font-bold hover:bg-violet-900 transition-all shadow-lg"
            >
              <PlusCircle className="w-5 h-5 text-white" />
              Add Student
            </button>
            
            {selectedStudent && (
              <Link
                href={`/dashboard/assessments/history?student=${selectedStudent}`}
                className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-slate-200 rounded-full font-bold text-black hover:border-violet-300 transition-all shadow-lg"
              >
                <History className="w-5 h-5 text-black" />
                View History
              </Link>
            )}
          </div>
        </div>

        {/* Student Selection */}
        <div className="mb-8 bg-white rounded-3xl border-4 border-slate-200 p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-violet-600" />
            <h2 className="font-black uppercase text-sm text-slate-500">STEP 1: SELECT STUDENT</h2>
          </div>
          
          {students.length === 0 ? (
            <div className="text-center py-8">
              <GraduationCap className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-black mb-2">No students yet</h3>
              <p className="text-slate-600 mb-6">Add your first student to start tracking assessments</p>
              <button
                onClick={() => setShowAddStudent(true)}
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-full font-bold hover:scale-105 transition-all shadow-xl"
              >
                <PlusCircle className="w-5 h-5 text-white" />
                Add Your First Student
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.map(student => (
                <button
                  key={student.id}
                  onClick={() => setSelectedStudent(student.id)}
                  className={`relative p-5 rounded-2xl border-3 text-left transition-all ${
                    selectedStudent === student.id
                      ? 'border-violet-600 bg-gradient-to-br from-violet-50 to-indigo-50 shadow-xl scale-105'
                      : 'border-slate-200 bg-white hover:border-violet-300 hover:shadow-lg'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-black text-lg text-black">{student.name}</div>
                      <div className="text-sm text-slate-600">Grade {student.grade}</div>
                    </div>
                    {student.current_pathway && (
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">
                        {student.current_pathway}
                      </span>
                    )}
                  </div>
                  
                  {selectedStudent === student.id && (
                    <div className="absolute top-2 right-2 w-3 h-3 bg-violet-600 rounded-full animate-pulse" />
                  )}
                  
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    <span>{student.grade >= 10 ? 'Senior' : 'Junior'} School</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Add Student Modal */}
        {showAddStudent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl">
              <h3 className="text-2xl font-black text-black mb-6">Add New Student</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-black mb-2">Student Name</label>
                  <input
                    type="text"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    placeholder="e.g., John Doe"
                    className="w-full p-4 border-2 border-slate-200 rounded-xl font-medium text-black placeholder:text-slate-400"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-black mb-2">Grade</label>
                  <select
                    value={newStudentGrade}
                    onChange={(e) => setNewStudentGrade(Number(e.target.value))}
                    className="w-full p-4 border-2 border-slate-200 rounded-xl font-medium text-black"
                  >
                    {[7,8,9,10,11,12].map(g => (
                      <option key={g} value={g} className="text-black">Grade {g}</option>
                    ))}
                  </select>
                </div>
                
                {newStudentGrade >= 10 && (
                  <div>
                    <label className="block text-sm font-bold text-black mb-2">Pathway</label>
                    <select
                      value={newStudentPathway}
                      onChange={(e) => setNewStudentPathway(e.target.value)}
                      className="w-full p-4 border-2 border-slate-200 rounded-xl font-medium text-black"
                    >
                      <option value="" className="text-black">Select Pathway</option>
                      <option value="STEM" className="text-black">STEM</option>
                      <option value="Social Sciences" className="text-black">Social Sciences</option>
                      <option value="Arts & Sports Science" className="text-black">Arts & Sports Science</option>
                    </select>
                  </div>
                )}
                
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowAddStudent(false)}
                    className="flex-1 py-4 border-2 border-slate-200 rounded-full font-bold text-black hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddStudent}
                    disabled={addingStudent}
                    className="flex-1 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-full font-bold disabled:opacity-50"
                  >
                    {addingStudent ? 'Adding...' : 'Add Student'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Assessment Form - Only show if student selected */}
        {selectedStudent && currentStudent && (
          <>
            {/* Step 2: Term & Year */}
            <div className="mb-8 bg-white rounded-3xl border-4 border-slate-200 p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-violet-600" />
                <h2 className="font-black uppercase text-sm text-slate-500">STEP 2: TERM & YEAR</h2>
              </div>
              
              <div className="grid grid-cols-2 gap-4 max-w-md">
                <div>
                  <label className="block text-sm font-bold text-black mb-2">Term</label>
                  <select
                    value={term}
                    onChange={(e) => setTerm(Number(e.target.value))}
                    className="w-full p-4 border-2 border-slate-200 rounded-xl font-bold text-black bg-white"
                  >
                    {TERMS.map(t => (
                      <option key={t} value={t} className="text-black">Term {t}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-black mb-2">Year</label>
                  <select
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full p-4 border-2 border-slate-200 rounded-xl font-bold text-black bg-white"
                  >
                    {AVAILABLE_YEARS.map(y => (
                      <option key={y} value={y} className="text-black">{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Step 3: Subject Scores */}
            <div className="bg-white rounded-3xl border-4 border-slate-200 p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5 text-violet-600" />
                <h2 className="font-black uppercase text-sm text-slate-500">
                  STEP 3: {currentStudent.grade >= 10 ? 'SENIOR SUBJECTS' : 'JUNIOR SUBJECTS'}
                </h2>
              </div>

              {/* Student Info Card */}
              <div className="mb-6 p-4 bg-gradient-to-r from-violet-50 to-indigo-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-violet-600 rounded-full flex items-center justify-center text-white font-black">
                    {currentStudent.grade}
                  </div>
                  <div>
                    <div className="font-black text-black">{currentStudent.name}</div>
                    <div className="text-sm text-slate-600">
                      {currentStudent.grade >= 10 ? 'Senior School' : 'Junior School'}
                      {currentStudent.current_pathway && ` • ${currentStudent.current_pathway}`}
                    </div>
                  </div>
                </div>
              </div>

              {/* JUNIOR SCHOOL */}
              {isJunior && (
                <>
                  {/* Core Subjects */}
                  <h3 className="font-black text-lg text-black mb-4">Core Subjects (8)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                    {JUNIOR_CORE.map(subject => (
                      <ScoreButton
                        key={subject.key}
                        subjectKey={subject.key}
                        label={subject.label}
                        emoji={subject.emoji}
                      />
                    ))}
                  </div>

                  {/* Religious Education - Choose 1 */}
                  <div className="mt-8 pt-6 border-t-4 border-slate-200">
                    <h3 className="font-black text-lg text-black mb-4 flex items-center gap-2">
                      <Heart className="w-5 h-5 text-red-500" />
                      Religious Education (Choose 1)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {JUNIOR_RELIGIOUS.map(religion => (
                        <button
                          key={religion.key}
                          onClick={() => {
                            setSelectedReligion(religion.key)
                            // Remove any other religion score
                            const newScores = { ...scores }
                            JUNIOR_RELIGIOUS.forEach(r => {
                              if (r.key !== religion.key) delete newScores[r.key]
                            })
                            setScores(newScores)
                          }}
                          className={`p-5 rounded-2xl border-3 text-center transition-all ${
                            selectedReligion === religion.key
                              ? 'bg-gradient-to-r from-red-600 to-pink-600 text-white border-transparent scale-105 shadow-xl'
                              : 'bg-white border-slate-200 text-black hover:border-red-300'
                          }`}
                        >
                          <div className="text-3xl mb-2">{religion.emoji}</div>
                          <div className="font-bold text-sm">{religion.label}</div>
                          {selectedReligion === religion.key && (
                            <div className="mt-2 text-xs text-white">
                              <CheckCircle2 className="w-4 h-4 inline mr-1" />
                              Selected
                            </div>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Show score buttons for selected religion */}
                    {selectedReligion && (
                      <div className="mt-6">
                        <h4 className="font-bold text-black mb-3">Score for {JUNIOR_RELIGIOUS.find(r => r.key === selectedReligion)?.label}</h4>
                        <div className="max-w-md">
                          <ScoreButton
                            subjectKey={selectedReligion}
                            label={JUNIOR_RELIGIOUS.find(r => r.key === selectedReligion)?.label || ''}
                            emoji={JUNIOR_RELIGIOUS.find(r => r.key === selectedReligion)?.emoji || '⛪'}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* SENIOR SCHOOL */}
              {isSenior && currentStudent.current_pathway && (
                <>
                  {/* Compulsory Subjects */}
                  <h3 className="font-black text-lg text-black mb-4">Compulsory Subjects (4)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    {SENIOR_COMPULSORY.map(subject => (
                      <ScoreButton
                        key={subject.key}
                        subjectKey={subject.key}
                        label={subject.label}
                        emoji={subject.emoji}
                      />
                    ))}
                  </div>

                  {/* Mathematics - Based on Pathway */}
                  <div className="mb-8 p-6 bg-blue-50 rounded-2xl border-2 border-blue-200">
                    <h4 className="font-bold text-black mb-3 flex items-center gap-2">
                      <span className="text-2xl">📐</span>
                      Mathematics Track
                    </h4>
                    <p className="text-sm text-slate-600 mb-4">
                      {currentStudent.current_pathway === 'STEM' 
                        ? 'STEM pathway requires Core Mathematics' 
                        : 'Social Sciences & Arts pathways require Essential Mathematics'}
                    </p>
                    
                    <div className="flex gap-4 mb-4">
                      <button
                        type="button"
                        onClick={() => setMathType('core')}
                        disabled={currentStudent.current_pathway !== 'STEM'}
                        className={`flex-1 p-4 rounded-2xl border-3 font-bold text-center transition-all ${
                          mathType === 'core'
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-transparent scale-105 shadow-xl'
                            : currentStudent.current_pathway === 'STEM'
                            ? 'bg-white border-purple-200 text-purple-700 hover:border-purple-400'
                            : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <div className="text-2xl mb-1">📐</div>
                        <div>Core Mathematics</div>
                        <div className="text-xs mt-1">(For STEM)</div>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setMathType('essential')}
                        disabled={currentStudent.current_pathway === 'STEM'}
                        className={`flex-1 p-4 rounded-2xl border-3 font-bold text-center transition-all ${
                          mathType === 'essential'
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-transparent scale-105 shadow-xl'
                            : currentStudent.current_pathway !== 'STEM'
                            ? 'bg-white border-purple-200 text-purple-700 hover:border-purple-400'
                            : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <div className="text-2xl mb-1">📊</div>
                        <div>Essential Mathematics</div>
                        <div className="text-xs mt-1">(For Social Sciences & Arts)</div>
                      </button>
                    </div>

                    {/* Mathematics Score */}
                    <ScoreButton 
                      subjectKey={mathType === 'core' ? 'core_mathematics' : 'essential_mathematics'}
                      label={mathType === 'core' ? 'Core Mathematics' : 'Essential Mathematics'}
                      emoji={mathType === 'core' ? '📐' : '📊'}
                    />
                  </div>

                  {/* Pathway Electives */}
                  <div className="mt-8 pt-6 border-t-4 border-slate-200">
                    <h3 className="font-black text-lg text-black mb-2">{currentStudent.current_pathway} Pathway Electives</h3>
                    <p className="text-sm text-slate-600 mb-4">Select exactly 3 electives</p>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                      {getPathwayElectives(currentStudent.current_pathway).map(elective => (
                        <button
                          key={elective.key}
                          onClick={() => toggleElective(elective.key)}
                          className={`p-4 rounded-xl border-2 text-center transition-all ${
                            selectedElectives.includes(elective.key)
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-transparent scale-105 shadow-lg'
                              : 'bg-white border-slate-200 text-black hover:border-purple-300'
                          }`}
                        >
                          <div className="text-2xl mb-1">{elective.emoji}</div>
                          <div className="text-xs font-bold">{elective.label}</div>
                          {selectedElectives.includes(elective.key) && (
                            <div className="mt-1 text-xs text-white">✓ Selected</div>
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 mb-4 text-sm font-bold text-purple-700">
                      <Zap className="w-4 h-4" />
                      Selected: {selectedElectives.length}/3
                    </div>

                    {/* Score buttons for selected electives */}
                    {selectedElectives.length > 0 && (
                      <div className="mt-6">
                        <h4 className="font-bold text-black mb-4">Score Your Selected Electives</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selectedElectives.map(electiveKey => {
                            const elective = getPathwayElectives(currentStudent.current_pathway)
                              .find(e => e.key === electiveKey)
                            if (!elective) return null
                            
                            return (
                              <ScoreButton
                                key={elective.key}
                                subjectKey={elective.key}
                                label={elective.label}
                                emoji={elective.emoji}
                              />
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Submit Button */}
              <div className="mt-8 pt-6 border-t-2 border-slate-200">
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full py-5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-full font-black text-lg hover:scale-105 transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    'Saving...'
                  ) : (
                    <>
                      Save Assessment
                      <ChevronRight className="w-5 h-5 text-white" />
                    </>
                  )}
                </button>
                
                <p className="text-center text-sm text-slate-500 mt-4">
                  Score guide: 1 = Emerging, 2 = Developing, 3 = Proficient, 4 = Exemplary
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}