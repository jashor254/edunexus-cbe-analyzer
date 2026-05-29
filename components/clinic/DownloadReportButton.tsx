'use client'

import { useState } from 'react'
import { Download, Loader2, AlertCircle } from 'lucide-react'

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
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const handleDownload = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/clinic/download', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ studentId, assessments, profile }),
      })

      if (!response.ok) {
        if (response.status === 403) {
          setError('You need tokens or an active subscription to download reports. Go to Pricing to top up.')
        } else if (response.status === 401) {
          setError('Please log in to download reports.')
        } else {
          const json = await response.json().catch(() => ({}))
          setError((json as { error?: string }).error || 'Report generation failed. Please try again.')
        }
        return
      }

      const blob = await response.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${studentName.replace(/\s+/g, '_')}_Report.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handleDownload}
        disabled={loading}
        className="flex items-center gap-2 px-8 py-4 bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:scale-105 transition-all shadow-xl disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {loading
          ? <Loader2 className="w-5 h-5 animate-spin" />
          : <Download className="w-5 h-5" />
        }
        {loading ? 'Generating PDF…' : 'Download PDF Report'}
      </button>

      {error && (
        <div className="flex items-start gap-2 max-w-sm bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
