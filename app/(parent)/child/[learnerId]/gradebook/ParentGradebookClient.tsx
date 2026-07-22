'use client'

// Sprint 5 (Parent Experience Convergence) — fetches
// /api/parent/gradebook?studentId=, which itself does nothing but resolve
// class roster and reuse app/api/teacher/gradebook's own buildGradebook()
// per class, filtered to this one learner's row. No grading logic here.

import { useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'
import type { ParentGradebookClass } from '@/app/api/parent/gradebook/route'

export default function ParentGradebookClient({ studentId }: { studentId: string }) {
  const [classes, setClasses] = useState<ParentGradebookClass[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/parent/gradebook?studentId=${studentId}`)
      .then(r => r.json())
      .then(json => { if (json.success) setClasses(json.data.classes) })
      .finally(() => setLoading(false))
  }, [studentId])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (classes.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
        <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-black text-gray-600">No grades recorded yet</h3>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {classes.map(cls => (
        <div key={cls.classId} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="text-xs text-gray-400">{cls.subject}</div>
            <div className="font-black text-gray-900">{cls.className}</div>
          </div>
          {cls.columns.length === 0 || !cls.row ? (
            <div className="px-5 py-6 text-sm text-gray-400">No assessments or assignments graded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                    {cls.columns.map(col => (
                      <th key={col.id} className="px-5 py-2 font-bold whitespace-nowrap">{col.title} (/{col.maxScore})</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {cls.columns.map(col => {
                      const score = cls.row!.scores[col.id]
                      return (
                        <td key={col.id} className="px-5 py-3 font-black text-gray-900 whitespace-nowrap">
                          {score === null || score === undefined ? <span className="text-gray-300 font-normal">—</span> : score}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
