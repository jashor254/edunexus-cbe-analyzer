'use client'

import { useEffect, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import LearnerBlueprint from '@/components/teacher/LearnerBlueprint'

export default function StudentBlueprint() {
  const [studentId, setStudentId] = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/learn/student', { credentials: 'include' })
      .then(async r => {
        const json = await r.json()
        if (!r.ok || !json.success) throw new Error(json.error ?? 'Could not load your student record')
        if ('picker' in json.data && json.data.picker) {
          throw new Error('Multiple student profiles found — open Compass to choose one first')
        }
        setStudentId(json.data.id)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load your Blueprint'))
  }, [])

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-400 p-6">
        <AlertCircle className="w-4 h-4" /> {error}
      </div>
    )
  }

  if (!studentId) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        <LearnerBlueprint studentId={studentId} />
      </div>
    </div>
  )
}
