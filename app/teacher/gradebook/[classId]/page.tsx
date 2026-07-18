'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { Download } from 'lucide-react'
import { friendlyMessage } from '@/lib/errors/friendlyMessage'

type GradebookColumn = {
  id: string
  kind: 'assessment' | 'assignment'
  title: string
  maxScore: number
  date: string | null
}

type GradebookRow = {
  studentId: string
  studentName: string
  scores: Record<string, number | null>
}

type Gradebook = {
  columns: GradebookColumn[]
  rows: GradebookRow[]
}

function toCSV(gradebook: Gradebook): string {
  const header = ['Student', ...gradebook.columns.map(c => `${c.title} (/${c.maxScore})`)]
  const lines = [header.join(',')]
  for (const row of gradebook.rows) {
    const cells = [row.studentName, ...gradebook.columns.map(c => row.scores[c.id] ?? '')]
    lines.push(cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
  }
  return lines.join('\n')
}

export default function GradebookPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params)
  const [gradebook, setGradebook] = useState<Gradebook | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/teacher/gradebook/${classId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setGradebook(d.data.gradebook)
        else setError(d.error || 'Failed to load gradebook')
      })
      .catch(() => setError('Failed to load gradebook'))
      .finally(() => setLoading(false))
  }, [classId])

  function handleExport() {
    if (!gradebook) return
    const csv = toCSV(gradebook)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gradebook-${classId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <Link href="/teacher/classes" className="text-sm text-gray-400 hover:text-gray-600 font-medium">
          ← My Classes
        </Link>
        <div className="flex items-center justify-between mt-3">
          <h1 className="text-3xl font-black text-gray-900">Gradebook</h1>
          {gradebook && gradebook.rows.length > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2.5 rounded-xl font-black text-sm hover:bg-teal-700 transition"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          )}
        </div>
        <p className="text-gray-500 mt-1">Every assessment and assignment score, in one table</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <span className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {friendlyMessage(error).message}
        </div>
      ) : !gradebook || gradebook.rows.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <h3 className="text-xl font-black text-gray-600 mb-2">No students in this class yet</h3>
        </div>
      ) : gradebook.columns.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <h3 className="text-xl font-black text-gray-600 mb-2">No assessments or assignments yet</h3>
          <p className="text-gray-400">Enter marks or create an assignment to populate the gradebook.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-black text-gray-700 sticky left-0 bg-gray-50">Student</th>
                {gradebook.columns.map(c => (
                  <th key={c.id} className="text-left px-4 py-3 font-black text-gray-700 whitespace-nowrap">
                    {c.title}
                    <span className="block text-xs font-medium text-gray-400">
                      {c.kind === 'assessment' ? 'Assessment' : 'Assignment'} · /{c.maxScore}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gradebook.rows.map(row => (
                <tr key={row.studentId} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-bold text-gray-900 sticky left-0 bg-white">{row.studentName}</td>
                  {gradebook.columns.map(c => {
                    const score = row.scores[c.id]
                    return (
                      <td key={c.id} className="px-4 py-3 text-gray-700">
                        {score === null || score === undefined
                          ? <span className="text-gray-300">—</span>
                          : score}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
