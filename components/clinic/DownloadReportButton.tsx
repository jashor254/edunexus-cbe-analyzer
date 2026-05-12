'use client'

import { Download } from 'lucide-react'

interface Props {
  studentId: string
  studentName: string
  assessments: unknown[]
  profile: {
    name: string
    grade: number
    pathway?: string | null
    dateOfBirth?: string | null
  }
}

export function DownloadReportButton({ studentId, studentName, assessments, profile }: Props) {
  const handleDownload = async () => {
    const response = await fetch('/api/clinic/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, assessments, profile }),
    })
    if (response.ok) {
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${studentName.replace(/\s+/g, '_')}_Report.pdf`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <button
      onClick={handleDownload}
      className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:scale-105 transition-all shadow-xl"
    >
      <Download className="w-5 h-5" />
      Download PDF Report
    </button>
  )
}
