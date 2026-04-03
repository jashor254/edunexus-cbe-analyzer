'use client'

import { useState, useEffect } from 'react'
import { Download, FileText, BarChart3, ClipboardList, GraduationCap, Loader2 } from 'lucide-react'

interface TeacherClass { id: string; name: string; grade: number; subject: string; academic_year: string }

const REPORT_TYPES = [
  { id: 'class',       icon: BarChart3,     label: 'Class Performance',   desc: 'All students across all subjects for a term' },
  { id: 'subject',     icon: FileText,      label: 'Subject Gap Report',  desc: 'Concept-by-concept breakdown per subject'     },
  { id: 'assignment',  icon: ClipboardList, label: 'Assignment Summary',  desc: 'Submission rates, scores and common mistakes' },
  { id: 'knec',        icon: GraduationCap, label: 'KNEC CBA Export',     desc: 'CSV ready to upload to KNEC CBA portal'       },
]

const TERMS = ['1', '2', '3']
const YEARS = ['2024', '2025', '2026']

export default function ReportsPage() {
  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('2')
  const [selectedYear, setSelectedYear] = useState('2025')
  const [activeReport, setActiveReport] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    fetch('/api/teacher/classes')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data.classes.length > 0) {
          setClasses(d.data.classes)
          setSelectedClass(d.data.classes[0].id)
        }
      })
  }, [])

  async function downloadKNEC() {
    if (!selectedClass) return
    setDownloading(true)
    try {
      const url = `/api/teacher/reports/knec-export?classId=${selectedClass}&term=${selectedTerm}&year=${selectedYear}`
      const res = await fetch(url)
      if (!res.ok) { alert('Failed to generate export. Please try again.'); return }
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `KNEC_CBA_Term${selectedTerm}_${selectedYear}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      alert('Download failed. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  const selectedClassObj = classes.find(c => c.id === selectedClass)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900">Reports</h1>
        <p className="text-gray-500 mt-1">Generate class reports and export data for KNEC</p>
      </div>

      {/* Report type selector */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {REPORT_TYPES.map(rt => (
          <button
            key={rt.id}
            onClick={() => setActiveReport(activeReport === rt.id ? null : rt.id)}
            className={`text-left p-5 rounded-2xl border-2 transition-all ${
              activeReport === rt.id
                ? 'border-teal-500 bg-teal-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                activeReport === rt.id ? 'bg-teal-600' : 'bg-gray-100'
              }`}>
                <rt.icon className={`w-5 h-5 ${activeReport === rt.id ? 'text-white' : 'text-gray-500'}`} />
              </div>
              <div>
                <div className="font-black text-gray-900">{rt.label}</div>
                {rt.id === 'knec' && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                    🆕 KNEC Ready
                  </span>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-500">{rt.desc}</p>
          </button>
        ))}
      </div>

      {/* Config panel */}
      {activeReport && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-xl font-black text-gray-900 mb-5">
            {REPORT_TYPES.find(r => r.id === activeReport)?.label}
          </h2>

          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Class</label>
              <select
                value={selectedClass}
                onChange={e => setSelectedClass(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
              >
                {classes.length === 0 && <option value="">No classes yet</option>}
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} (G{c.grade})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Term</label>
              <select
                value={selectedTerm}
                onChange={e => setSelectedTerm(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
              >
                {TERMS.map(t => <option key={t} value={t}>Term {t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Year</label>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white"
              >
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* KNEC specific UI */}
          {activeReport === 'knec' && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-5">
              <h3 className="font-black text-amber-800 mb-2">📋 KNEC CBA Export</h3>
              <p className="text-sm text-amber-700 mb-3">
                Generates a CSV file in KNEC CBA format. Download and upload directly to{' '}
                <strong>knec.ac.ke/cba</strong> — saves hours of manual entry.
              </p>
              <div className="text-xs text-amber-600 font-medium space-y-1">
                <div>✅ Columns: Student Name, Adm No, Subject, Strand, Assessment Level (1-4), Comments</div>
                <div>✅ One row per student per subject</div>
                <div>✅ Ready for direct upload to KNEC portal</div>
              </div>
              {selectedClassObj && (
                <p className="text-xs text-amber-500 mt-2 font-bold">
                  Class: {selectedClassObj.name} · Term {selectedTerm} · {selectedYear}
                </p>
              )}
            </div>
          )}

          {activeReport !== 'knec' && (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-5 text-center">
              <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                PDF generation coming soon. KNEC CSV export is available now.
              </p>
            </div>
          )}

          <button
            onClick={activeReport === 'knec' ? downloadKNEC : undefined}
            disabled={downloading || !selectedClass || activeReport !== 'knec'}
            className="flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
              : <><Download className="w-4 h-4" /> {activeReport === 'knec' ? 'Download KNEC CSV' : 'Download PDF (coming soon)'}</>
            }
          </button>
        </div>
      )}

      {/* Info box about KNEC */}
      {!activeReport && (
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5 mt-4">
          <p className="text-sm text-teal-700">
            💡 <strong>Tip:</strong> Start with the <strong>KNEC CBA Export</strong> to download class assessment data
            in a format ready for the KNEC portal — eliminating hours of manual entry.
          </p>
        </div>
      )}
    </div>
  )
}
