'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, type Student } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function DashboardPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  
  // Form state
  const [name, setName] = useState('')
  const [grade, setGrade] = useState<number>(7)
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [currentPathway, setCurrentPathway] = useState<'STEM' | 'Arts & Sports' | 'Social Sciences' | ''>('')
  const [formLoading, setFormLoading] = useState(false)
  
  const router = useRouter()

  // Load students
  const loadStudents = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error: fetchError } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', user.id)
        .order('grade', { ascending: true })
        .order('name', { ascending: true })

      if (fetchError) throw fetchError
      if (data) setStudents(data)
    } catch (err) {
      console.error('Error loading students:', err)
      setError('Failed to load students')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    loadStudents()
  }, [loadStudents])

  // Reset form
  const resetForm = () => {
    setName('')
    setGrade(7)
    setDateOfBirth('')
    setCurrentPathway('')
    setEditingStudent(null)
    setShowAddStudent(false)
  }

  // Open edit form
  const openEditForm = (student: Student) => {
    setEditingStudent(student)
    setName(student.name)
    setGrade(student.grade)
    setDateOfBirth(student.date_of_birth)
    setCurrentPathway(student.current_pathway || '')
    setShowAddStudent(true)
  }

  // Add or update student
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const isSenior = grade >= 10 && grade <= 12
      const pathwayValue = isSenior && currentPathway ? currentPathway : null

      if (editingStudent) {
        // Update existing student
        const { error: updateError } = await supabase
          .from('students')
          .update({
            name,
            grade,
            date_of_birth: dateOfBirth,
            current_pathway: pathwayValue,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingStudent.id)

        if (updateError) throw updateError
      } else {
        // Add new student
        const { error: insertError } = await supabase
          .from('students')
          .insert({
            user_id: user.id,
            name,
            grade,
            date_of_birth: dateOfBirth,
            current_pathway: pathwayValue
          })

        if (insertError) throw insertError
      }

      await loadStudents()
      resetForm()
    } catch (err) {
      console.error('Error saving student:', err)
      setError(err instanceof Error ? err.message : 'Failed to save student')
    } finally {
      setFormLoading(false)
    }
  }

  // Delete student
  const handleDelete = async (studentId: string, studentName: string) => {
    if (!confirm(`Are you sure you want to delete ${studentName}? This will also delete all their assessments.`)) {
      return
    }

    try {
      const { error: deleteError } = await supabase
        .from('students')
        .delete()
        .eq('id', studentId)

      if (deleteError) throw deleteError
      
      await loadStudents()
    } catch (err) {
      console.error('Error deleting student:', err)
      setError('Failed to delete student')
    }
  }

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Get grade level label
  const getGradeLevel = (grade: number) => {
    if (grade >= 7 && grade <= 9) return 'Junior School'
    if (grade >= 10 && grade <= 12) return 'Senior School'
    return 'Unknown'
  }

  // Get pathway badge color
  const getPathwayColor = (pathway: string | null) => {
    if (!pathway) return 'bg-gray-100 text-gray-600'
    switch (pathway) {
      case 'STEM':
        return 'bg-blue-100 text-blue-700 border-blue-300'
      case 'Arts & Sports':
        return 'bg-purple-100 text-purple-700 border-purple-300'
      case 'Social Sciences':
        return 'bg-green-100 text-green-700 border-green-300'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">CBC Pathway Analyzer</h1>
              <p className="text-sm text-gray-600">Track student progress & pathway guidance</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Error display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Add Student Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowAddStudent(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 flex items-center gap-2"
          >
            <span className="text-xl">+</span>
            Add New Student
          </button>
        </div>

        {/* Add/Edit Student Form */}
        {showAddStudent && (
          <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">
                {editingStudent ? 'Edit Student' : 'Add New Student'}
              </h2>
              <button
                onClick={resetForm}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Student Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter student name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Grade *
                  </label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(Number(e.target.value))}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={7}>Grade 7 (Junior)</option>
                    <option value={8}>Grade 8 (Junior)</option>
                    <option value={9}>Grade 9 (Junior)</option>
                    <option value={10}>Grade 10 (Senior)</option>
                    <option value={11}>Grade 11 (Senior)</option>
                    <option value={12}>Grade 12 (Senior)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {grade >= 10 && grade <= 12 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Pathway (Senior School Only)
                    </label>
                    <select
                      value={currentPathway}
                      onChange={(e) => setCurrentPathway(e.target.value as any)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Not selected</option>
                      <option value="STEM">STEM</option>
                      <option value="Arts & Sports">Arts & Sports</option>
                      <option value="Social Sciences">Social Sciences</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {formLoading ? 'Saving...' : editingStudent ? 'Update Student' : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Students List */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-xl text-gray-600">Loading students...</div>
          </div>
        ) : students.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">👨‍🎓</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Students Yet</h3>
            <p className="text-gray-600 mb-6">
              Add your first student to start tracking their CBC assessment progress
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {students.map((student) => (
              <div
                key={student.id}
                className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{student.name}</h3>
                      <p className="text-sm text-gray-600">Grade {student.grade}</p>
                      <p className="text-xs text-gray-500">{getGradeLevel(student.grade)}</p>
                    </div>
                    {student.current_pathway && (
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPathwayColor(student.current_pathway)}`}>
                        {student.current_pathway}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 mb-6">
                    <Link
                      href={`/dashboard/assessments/add?student=${student.id}`}
                      className="block w-full bg-blue-600 text-white text-center py-2 rounded-lg font-semibold hover:bg-blue-700"
                    >
                      + Add Assessment
                    </Link>
                    
                    <Link
                      href={`/dashboard/assessments/history?student=${student.id}`}
                      className="block w-full bg-purple-600 text-white text-center py-2 rounded-lg font-semibold hover:bg-purple-700"
                    >
                      📊 View History
                    </Link>

                    {student.grade >= 7 && student.grade <= 9 && (
                      <Link
                        href={`/dashboard/assessments/guidance?student=${student.id}`}
                        className="block w-full bg-green-600 text-white text-center py-2 rounded-lg font-semibold hover:bg-green-700"
                      >
                        🎯 Pathway Guidance
                      </Link>
                    )}
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    <button
                      onClick={() => openEditForm(student)}
                      className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(student.id, student.name)}
                      className="flex-1 px-4 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Footer */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-bold text-blue-900 mb-2">📚 About CBC Pathway Analyzer</h3>
          <p className="text-blue-800 text-sm">
            Track student performance using CBC competency levels (1-4). Junior school students (Grades 7-9) receive 
            pathway guidance based on performance patterns. Senior school students (Grades 10-12) track progress in 
            their chosen pathway with electives.
          </p>
        </div>
      </div>
    </div>
  )
}