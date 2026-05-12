'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import {
  Users, BookOpen, BarChart3, Sun, Copy, Check,
  AlertTriangle, ChevronRight, PlusCircle, Share2,
  TrendingDown, TrendingUp,
} from 'lucide-react'

type Tab = 'students' | 'gaps' | 'assignments' | 'holiday'

function levelBadge(avg: number) {
  if (avg >= 3.5) return { label: 'Exceeds', cls: 'bg-purple-100 text-purple-700' }
  if (avg >= 2.5) return { label: 'Meets', cls: 'bg-green-100 text-green-700' }
  if (avg >= 1.5) return { label: 'Approaching', cls: 'bg-amber-100 text-amber-700' }
  return { label: 'Below', cls: 'bg-red-100 text-red-700' }
}

function rowColor(avg: number | null) {
  if (avg === null) return 'border-l-gray-200'
  if (avg >= 3.5) return 'border-l-purple-400'
  if (avg >= 2.5) return 'border-l-green-400'
  if (avg >= 1.5) return 'border-l-amber-400'
  return 'border-l-red-400'
}

export default function ClassDetailPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params)
  const [tab, setTab] = useState<Tab>('students')
  const [data, setData] = useState<any>(null)
  const [insights, setInsights] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`/api/teacher/classes/${classId}`).then(r => r.json()),
      fetch(`/api/teacher/classes/${classId}/insights`).then(r => r.json()),
    ]).then(([classData, insightData]) => {
      if (classData.success) setData(classData.data)
      if (insightData.success) setInsights(insightData.data.insights)
    }).finally(() => setLoading(false))
  }, [classId])

  function copyCode() {
    navigator.clipboard.writeText(data?.class?.class_code || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function whatsappMessage() {
    if (!data?.class) return ''
    const cls = data.class
    return encodeURIComponent(
`Habari Wazazi! 👋

Mimi ni Mwalimu ${data.teacherName || ''} kutoka ${data.teacherSchool || ''}.

Nimeweka darasa lenu kwenye EduNexus —
platform ya AI inayosaidia watoto
wetu kujifunza vizuri zaidi.

Hatua za kujiunga (bure kabisa):
1️⃣ Nenda: edunexus.co.ke/signup
2️⃣ Ongeza mtoto wako
3️⃣ Dashboard → Settings → Join Class
4️⃣ Weka code hii: ${cls.class_code}

Nitaweza kuona maendeleo ya kila mtoto
na kuwasaidia vizuri zaidi darasani.

— Mwalimu 🎓`
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <span className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <p className="text-gray-500">Class not found.</p>
        <Link href="/teacher/classes" className="text-teal-600 font-bold mt-2 inline-block">← Back to Classes</Link>
      </div>
    )
  }

  const cls = data.class
  const students: any[] = data.students || []
  const subjectInsights: any[] = data.insights || []

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'students',    label: 'Students',        icon: Users      },
    { key: 'gaps',        label: 'Gap Radar',       icon: BarChart3  },
    { key: 'assignments', label: 'Assignments',     icon: BookOpen   },
    { key: 'holiday',     label: 'Holiday Bridge',  icon: Sun        },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

      {/* Header */}
      <div className="mb-6">
        <Link href="/teacher/classes" className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-3 font-medium">
          ← Back to Classes
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-900">{cls.name}</h1>
            <p className="text-gray-500 mt-1">Grade {cls.grade} · {cls.subject} · {cls.academic_year}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Class code + copy */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
              <span className="text-xs text-gray-500">Code:</span>
              <span className="font-mono font-black text-gray-800">{cls.class_code}</span>
              <button onClick={copyCode} className="text-gray-400 hover:text-teal-600">
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            {/* WhatsApp share */}
            <a
              href={`https://wa.me/?text=${whatsappMessage()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-green-600 transition"
            >
              <Share2 className="w-4 h-4" /> Send to Parents
            </a>
            <Link
              href={`/teacher/assignments/new?classId=${cls.id}`}
              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-teal-700 transition"
            >
              <PlusCircle className="w-4 h-4" /> New Assignment
            </Link>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center shadow-sm">
          <div className="text-2xl font-black text-gray-900">{students.length}</div>
          <div className="text-sm text-gray-500">Students</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center shadow-sm">
          <div className="text-2xl font-black text-teal-600">
            {insights?.activeStudents ?? '—'}
          </div>
          <div className="text-sm text-gray-500">Active This Week</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center shadow-sm">
          <div className={`text-2xl font-black ${(insights?.riskLevels?.high || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {insights?.riskLevels?.high ?? 0}
          </div>
          <div className="text-sm text-gray-500">High Risk</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl mb-6 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition flex-1 justify-center ${
              tab === t.key
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: Students */}
      {tab === 'students' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-black text-gray-500 uppercase tracking-wider">Student</th>
                  <th className="text-left px-5 py-3 text-xs font-black text-gray-500 uppercase tracking-wider">Level</th>
                  <th className="text-left px-5 py-3 text-xs font-black text-gray-500 uppercase tracking-wider">Last Active</th>
                  <th className="text-left px-5 py-3 text-xs font-black text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-gray-400">
                      No students yet. Share the class code with parents.
                    </td>
                  </tr>
                ) : students.map((s: any) => {
                  const badge = s.avgScore !== null ? levelBadge(s.avgScore) : null
                  return (
                    <tr key={s.id} className={`border-l-4 ${rowColor(s.avgScore)} hover:bg-gray-50`}>
                      <td className="px-5 py-4">
                        <div className="font-bold text-gray-900">{s.name}</div>
                        <div className="text-xs text-gray-400">Grade {s.grade}</div>
                      </td>
                      <td className="px-5 py-4">
                        {badge ? (
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${badge.cls}`}>
                            {badge.label}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">No data</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {s.daysInactive !== null ? (
                          <span className={`text-sm ${s.daysInactive > 7 ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                            {s.daysInactive === 0 ? 'Today' : `${s.daysInactive}d ago`}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Never</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <button className="text-xs text-teal-600 font-bold hover:underline">View</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: Gap Radar */}
      {tab === 'gaps' && (
        <div className="space-y-5">
          {subjectInsights.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
              <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400">No assessment data yet. Insights will appear once parents add assessments.</p>
            </div>
          ) : (
            <>
              {subjectInsights.map((si: any) => {
                const pct = (si.avg / 4) * 100
                const barColor = si.avg >= 3.5 ? 'bg-purple-500' : si.avg >= 2.5 ? 'bg-green-500' : si.avg >= 1.5 ? 'bg-amber-500' : 'bg-red-500'
                return (
                  <div key={si.subject} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-black text-gray-900 capitalize">{si.subject.replace(/_/g, ' ')}</h3>
                        <p className="text-sm text-gray-400">Class avg: {si.avg}/4</p>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${levelBadge(si.avg).cls}`}>
                        {si.level}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 mb-3">
                      <div className={`h-3 rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                      {[
                        { label: '🔴 Below',      val: si.distribution.below,      cls: 'text-red-600 bg-red-50' },
                        { label: '🟡 Approaching', val: si.distribution.approaching, cls: 'text-amber-600 bg-amber-50' },
                        { label: '🟢 Meets',       val: si.distribution.meets,       cls: 'text-green-600 bg-green-50' },
                        { label: '💜 Exceeds',     val: si.distribution.exceeds,     cls: 'text-purple-600 bg-purple-50' },
                      ].map(d => (
                        <div key={d.label} className={`rounded-xl p-2 ${d.cls}`}>
                          <div className="font-black text-lg">{d.val}</div>
                          <div className="font-semibold leading-tight">{d.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Recommendations */}
              {data.recommendations && data.recommendations.length > 0 && (
                <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5">
                  <h3 className="font-black text-teal-800 mb-3 flex items-center gap-2">
                    🎯 EduNexus Recommendations
                  </h3>
                  <ul className="space-y-2">
                    {data.recommendations.map((rec: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-teal-700">
                        <span className="font-black text-teal-500 mt-0.5">{i + 1}.</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB: Assignments */}
      {tab === 'assignments' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Link
              href={`/teacher/assignments/new?classId=${cls.id}`}
              className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-teal-700 transition"
            >
              <PlusCircle className="w-4 h-4" /> New Assignment
            </Link>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">
              Assignments for this class will appear here.{' '}
              <Link href="/teacher/assignments" className="text-teal-600 font-bold hover:underline">
                View all assignments →
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* TAB: Holiday Bridge */}
      {tab === 'holiday' && (
        <div className="space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <h3 className="font-black text-amber-800 mb-1 flex items-center gap-2">
              <Sun className="w-5 h-5" /> Holiday Bridge — {cls.name}
            </h3>
            <p className="text-sm text-amber-700">
              Unique to EduNexus — track which students are at risk going into the holiday, and send targeted reminders.
            </p>
          </div>

          {/* At-risk students */}
          {insights?.holidayRisk && insights.holidayRisk.length > 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-black text-gray-900">At-Risk Students</h3>
                <span className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full font-bold">
                  {insights.holidayRisk.length} students
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {insights.holidayRisk.map((s: any) => {
                  const msg = encodeURIComponent(
`Habari! 👋

Mimi ni mwalimu wa ${s.name}.

Nataka kukuarifa kwamba ${s.name} hajatumia EduNexus hivi karibuni.

Tafadhali mhimize atumie Learning Compass wakati wa likizo ili asibaki nyuma.

Asante! 🙏`
                  )
                  return (
                    <div key={s.id} className="px-5 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span>{s.riskLevel === 'high' ? '🔴' : '🟡'}</span>
                        <div>
                          <div className="font-bold text-gray-900">{s.name}</div>
                          <div className="text-xs text-gray-400">
                            Grade {s.grade} · {s.isActive ? 'Active recently' : 'Inactive'}
                          </div>
                        </div>
                      </div>
                      <a
                        href={`https://wa.me/?text=${msg}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-green-600 transition"
                      >
                        📱 Remind Parent
                      </a>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
              <TrendingUp className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="text-green-700 font-bold">Great news — no high-risk students identified.</p>
              <p className="text-sm text-green-600 mt-1">All students appear active or have solid performance.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
