'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AddStudentPage() {
  const [name, setName] = useState('')
  const [grade, setGrade] = useState<number>(4)
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [currentPathway, setCurrentPathway] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const router = useRouter()

  // 🔐 Auth guard
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
      }
    }
    checkAuth()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      if (grade < 4 || grade > 12) {
        throw new Error('Grade must be between 4 and 12')
      }

      if (grade >= 10 && !currentPathway) {
        throw new Error('Select pathway for Grade 10+')
      }

      const studentData: any = {
        user_id: user.id,
        name: name.trim(),
        grade,
        date_of_birth: dateOfBirth
      }

      if (grade >= 10) {
        studentData.current_pathway = currentPathway
      }

      const { error: insertError } = await supabase
        .from('students')
        .insert(studentData)

      if (insertError) throw insertError

      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Failed to add student')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link href="/dashboard" className="text-blue-600 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="bg-white rounded-xl shadow p-8">
          <h1 className="text-2xl font-bold mb-6">Add Student</h1>

          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label>Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full border p-3 rounded"
              />
            </div>

            <div>
              <label>Grade</label>
              <select
                value={grade}
                onChange={e => setGrade(Number(e.target.value))}
                className="w-full border p-3 rounded"
              >
                {[4,5,6,7,8,9,10,11,12].map(g => (
                  <option key={g} value={g}>Grade {g}</option>
                ))}
              </select>
            </div>

            <div>
              <label>Date of Birth</label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={e => setDateOfBirth(e.target.value)}
                required
                className="w-full border p-3 rounded"
              />
            </div>

            {grade >= 10 && (
              <div>
                <label>Pathway</label>
                <select
                  value={currentPathway}
                  onChange={e => setCurrentPathway(e.target.value)}
                  className="w-full border p-3 rounded"
                >
                  <option value="">Select Pathway</option>
                  <option value="STEM">STEM</option>
                  <option value="Arts & Sports">Arts & Sports</option>
                  <option value="Social Sciences">Social Sciences</option>
                </select>
              </div>
            )}

            <button
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded font-semibold"
            >
              {loading ? 'Saving...' : 'Add Student'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
