'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Download, FileText, BarChart3, ClipboardList, GraduationCap,
  Loader2, Scroll, FlaskConical, Search, CheckCircle2,
  Mail, Phone, Eye, ExternalLink,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeacherClass { id: string; name: string; grade: number; subject: string; academic_year: string }

interface ReportRow {
  studentId:    string
  studentName:  string
  grade:        number
  hasEmail:     boolean
  hasPhone:     boolean
  reportId:     string | null
  generatedAt:  string | null
  term:         number | null
  year:         number | null
  pdfUrl:       string | null
  whatsappSent: boolean
  emailSent:    boolean
  parentOpened: boolean
}

interface ClassReportData {
  reports:   ReportRow[]
  stats:     { total: number; whatsappSent: number; emailSent: number; parentOpened: number }
  className: string
  grade:     number
}

// ─── KNEC / legacy report types ───────────────────────────────────────────────

const REPORT_TYPES = [
  { id: 'class',       icon: BarChart3,     label: 'Class Performance',   desc: 'All students across all subjects for a term' },
  { id: 'subject',     icon: FileText,      label: 'Subject Gap Report',  desc: 'Concept-by-concept breakdown per subject'     },
  { id: 'assignment',  icon: ClipboardList, label: 'Assignment Summary',  desc: 'Submission rates, scores and common mistakes' },
  { id: 'knec',        icon: GraduationCap, label: 'KNEC CBA Export',     desc: 'CSV ready to upload to KNEC CBA portal'       },
  { id: 'sow',         icon: Scroll,        label: 'Scheme of Work',       desc: 'KICD-aligned SOW · CBC & 8-4-4'  },
]

const TERMS = ['1', '2', '3']
const YEARS = ['2024', '2025', '2026']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Clinic Reports Section ───────────────────────────────────────────────────

function ClinicReportsSection({ classes }: { classes: TeacherClass[] }) {
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id ?? '')
  const [data, setData]                   = useState<ClassReportData | null>(null)
  const [loading, setLoading]             = useState(false)
  const [search, setSearch]               = useState('')
  const [filterTerm, setFilterTerm]       = useState('')

  useEffect(() => {
    if (!selectedClass) return
    setLoading(true)
    fetch(`/api/teacher/classes/${selectedClass}/reports`)
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.data) })
      .finally(() => setLoading(false))
  }, [selectedClass])

  const rows = (data?.reports ?? []).filter(r => {
    const matchSearch = !search || r.studentName.toLowerCase().includes(search.toLowerCase())
    const matchTerm   = !filterTerm || String(r.term) === filterTerm
    return matchSearch && matchTerm
  })

  const stats = data?.stats

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Reports Generated', value: stats.total,        color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200'  },
            { label: 'WhatsApp Sent',      value: stats.whatsappSent, color: 'text-green-700',  bg: 'bg-green-50 border-green-200'    },
            { label: 'Emails Sent',        value: stats.emailSent,    color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200'      },
            { label: 'Parents Opened',     value: stats.parentOpened, color: 'text-teal-700',   bg: 'bg-teal-50 border-teal-200'      },
          ].map(s => (
            <div key={s.label} className={`border rounded-2xl p-4 text-center ${s.bg}`}>
              <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-sm text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={selectedClass}
          onChange={e => setSelectedClass(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 font-medium text-sm focus:border-violet-400 outline-none"
        >
          {classes.length === 0 && <option value="">No classes</option>}
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name} — Grade {c.grade}</option>
          ))}
        </select>

        <select
          value={filterTerm}
          onChange={e => setFilterTerm(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 font-medium text-sm focus:border-violet-400 outline-none"
        >
          <option value="">All Terms</option>
          {TERMS.map(t => <option key={t} value={t}>Term {t}</option>)}
        </select>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search student…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-violet-400 outline-none"
          />
        </div>

        <Link
          href={`/teacher/classes/${selectedClass}?tab=clinic`}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl font-bold text-sm hover:bg-violet-700 transition"
        >
          <FlaskConical className="w-4 h-4" /> Generate New Reports
        </Link>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <FlaskConical className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          {data?.reports?.length === 0 ? (
            <>
              <p className="text-gray-500 font-medium">No reports generated yet for this class.</p>
              <Link
                href={`/teacher/classes/${selectedClass}?tab=clinic`}
                className="mt-3 inline-flex items-center gap-2 text-sm text-violet-600 font-bold hover:underline"
              >
                <FlaskConical className="w-4 h-4" /> Go to Clinic Reports tab →
              </Link>
            </>
          ) : (
            <p className="text-gray-400">No results match your search.</p>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Student</th>
                  <th className="text-left px-5 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Class</th>
                  <th className="text-left px-5 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Generated</th>
                  <th className="text-left px-5 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">WhatsApp</th>
                  <th className="text-left px-5 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Email</th>
                  <th className="text-left px-5 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Parent Opened</th>
                  <th className="text-left px-5 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(r => (
                  <tr key={r.studentId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-bold text-gray-900">{r.studentName}</div>
                      <div className="text-xs text-gray-400">Grade {r.grade}</div>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{data?.className}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {r.generatedAt ? (
                        <div>
                          <div>{fmtDate(r.generatedAt)}</div>
                          {r.term && <div className="text-xs text-gray-400">Term {r.term}, {r.year}</div>}
                        </div>
                      ) : (
                        <span className="text-gray-300">Never</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {r.whatsappSent ? (
                        <span className="inline-flex items-center gap-1 text-green-600 font-bold text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                        </span>
                      ) : r.hasPhone ? (
                        <span className="text-gray-400 text-xs flex items-center gap-1">
                          <Phone className="w-3 h-3" /> Not sent
                        </span>
                      ) : (
                        <span className="text-amber-500 text-xs">⚠️ No phone</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {r.emailSent ? (
                        <span className="inline-flex items-center gap-1 text-blue-600 font-bold text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                        </span>
                      ) : r.hasEmail ? (
                        <span className="text-gray-400 text-xs flex items-center gap-1">
                          <Mail className="w-3 h-3" /> Not sent
                        </span>
                      ) : (
                        <span className="text-amber-500 text-xs">⚠️ No email</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {r.parentOpened ? (
                        <span className="inline-flex items-center gap-1 text-teal-600 font-bold text-xs">
                          <Eye className="w-3.5 h-3.5" /> Opened
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">Not yet</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {r.pdfUrl ? (
                        <a
                          href={r.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-violet-600 font-bold hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" /> View PDF
                        </a>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [classes, setClasses]           = useState<TeacherClass[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('2')
  const [selectedYear, setSelectedYear] = useState('2025')
  const [activeReport, setActiveReport] = useState<string | null>(null)
  const [downloading, setDownloading]   = useState(false)
  const [activeTab, setActiveTab]       = useState<'clinic' | 'other'>('clinic')

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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900">Reports</h1>
        <p className="text-gray-500 mt-1">Academic Clinic Reports and class data exports</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl mb-7 overflow-x-auto">
        <button
          onClick={() => setActiveTab('clinic')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition ${
            activeTab === 'clinic' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FlaskConical className="w-4 h-4" /> Academic Clinic
        </button>
        <button
          onClick={() => setActiveTab('other')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition ${
            activeTab === 'other' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Download className="w-4 h-4" /> Other Reports
        </button>
      </div>

      {/* Academic Clinic Reports */}
      {activeTab === 'clinic' && (
        classes.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-12 text-center">
            <FlaskConical className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500">No classes yet. Create a class to generate clinic reports.</p>
            <Link href="/teacher/classes" className="mt-3 inline-block text-sm text-violet-600 font-bold hover:underline">
              Go to Classes →
            </Link>
          </div>
        ) : (
          <ClinicReportsSection classes={classes} />
        )
      )}

      {/* Other reports (KNEC, SOW, etc.) */}
      {activeTab === 'other' && (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            {REPORT_TYPES.map(rt => (
              <button
                key={rt.id}
                onClick={() => setActiveReport(activeReport === rt.id ? null : rt.id)}
                className={`text-left p-5 rounded-2xl border-2 transition-all ${
                  activeReport === rt.id ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeReport === rt.id ? 'bg-teal-600' : 'bg-gray-100'}`}>
                    <rt.icon className={`w-5 h-5 ${activeReport === rt.id ? 'text-white' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <div className="font-black text-gray-900">{rt.label}</div>
                    {rt.id === 'knec' && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">🆕 KNEC Ready</span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-500">{rt.desc}</p>
              </button>
            ))}
          </div>

          {activeReport && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-xl font-black text-gray-900 mb-5">
                {REPORT_TYPES.find(r => r.id === activeReport)?.label}
              </h2>
              <div className="grid sm:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Class</label>
                  <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white">
                    {classes.length === 0 && <option value="">No classes yet</option>}
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name} (G{c.grade})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Term</label>
                  <select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white">
                    {TERMS.map(t => <option key={t} value={t}>Term {t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Year</label>
                  <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white">
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              {activeReport === 'knec' && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-5">
                  <h3 className="font-black text-amber-800 mb-2">📋 KNEC CBA Export</h3>
                  <p className="text-sm text-amber-700 mb-3">
                    Generates a CSV file in KNEC CBA format. Download and upload directly to <strong>knec.ac.ke/cba</strong>.
                  </p>
                  {selectedClassObj && (
                    <p className="text-xs text-amber-500 font-bold">
                      Class: {selectedClassObj.name} · Term {selectedTerm} · {selectedYear}
                    </p>
                  )}
                </div>
              )}

              {activeReport === 'sow' && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 mb-5">
                  <h3 className="font-black text-indigo-800 mb-2 flex items-center gap-2">
                    <Scroll className="w-4 h-4" /> AI Scheme of Work Generator
                  </h3>
                  <p className="text-sm text-indigo-700 mb-4">
                    Generate a KICD-aligned Scheme of Work in minutes. Supports CBC and 8-4-4 curricula.
                  </p>
                  <Link href="/teacher/scheme-of-work"
                    className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-indigo-700 transition text-sm">
                    <Scroll className="w-4 h-4" /> Go to SOW Generator →
                  </Link>
                </div>
              )}

              {activeReport !== 'knec' && activeReport !== 'sow' && (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-5 text-center">
                  <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">PDF generation coming soon. KNEC CSV export is available now.</p>
                </div>
              )}

              {activeReport !== 'sow' && (
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
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
