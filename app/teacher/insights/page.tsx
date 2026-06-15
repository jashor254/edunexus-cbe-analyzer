'use client'

import { useState, useEffect } from 'react'
import { BarChart3, Users, TrendingUp, TrendingDown } from 'lucide-react'

interface TeacherClass { id: string; name: string; grade: number; subject: string }

function levelLabel(avg: number) {
  if (avg >= 3.5) return 'Exceeds'
  if (avg >= 2.5) return 'Meets'
  if (avg >= 1.5) return 'Approaching'
  return 'Below'
}

export default function InsightsPage() {
  const [classes, setClasses] = useState<TeacherClass[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [insights, setInsights] = useState<any>(null)
  const [classData, setClassData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

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

  useEffect(() => {
    if (!selectedClass) return
    setLoading(true)
    Promise.all([
      fetch(`/api/teacher/classes/${selectedClass}`).then(r => r.json()),
      fetch(`/api/teacher/classes/${selectedClass}/insights`).then(r => r.json()),
    ]).then(([cd, ins]) => {
      if (cd.success) setClassData(cd.data)
      if (ins.success) setInsights(ins.data.insights)
    }).finally(() => setLoading(false))
  }, [selectedClass])

  const subjectInsights: any[] = classData?.insights || []

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900">Class Insights</h1>
          <p className="text-gray-500 mt-1">Learning gap radar and performance analytics</p>
        </div>
        <select
          value={selectedClass}
          onChange={e => setSelectedClass(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 focus:border-teal-500 outline-none text-gray-900 bg-white font-medium text-sm"
        >
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <span className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Activity summary */}
          {insights && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Total Students',  value: insights.totalStudents,  icon: Users,         color: 'text-blue-600',   bg: 'bg-blue-50'   },
                { label: 'Active This Week', value: insights.activeStudents, icon: TrendingUp,    color: 'text-green-600',  bg: 'bg-green-50'  },
                { label: 'High Risk',        value: insights.riskLevels?.high   || 0, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
                { label: 'Medium Risk',      value: insights.riskLevels?.medium || 0, icon: BarChart3,    color: 'text-amber-600', bg: 'bg-amber-50' },
              ].map((s, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                  <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center mb-3`}>
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                  <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Subject gap radar */}
          <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-teal-600" /> Subject Performance Overview
          </h2>

          {subjectInsights.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
              <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400">No assessment data yet for this class.</p>
              <p className="text-sm text-gray-400 mt-1">Insights appear once parents add student assessments.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {subjectInsights.map((si: any) => {
                const pct = (si.avg / 4) * 100
                const barColor = si.avg >= 3.5 ? 'bg-purple-500' : si.avg >= 2.5 ? 'bg-green-500' : si.avg >= 1.5 ? 'bg-amber-500' : 'bg-red-500'
                const badgeColor = si.avg >= 3.5 ? 'bg-purple-100 text-purple-700' : si.avg >= 2.5 ? 'bg-green-100 text-green-700' : si.avg >= 1.5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                return (
                  <div key={si.subject} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-black text-gray-900 capitalize">{si.subject.replace(/_/g, ' ')}</h3>
                        <p className="text-sm text-gray-400">Class average: {si.avg}/4</p>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${badgeColor}`}>
                        {levelLabel(si.avg)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 mb-4">
                      <div className={`h-3 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                      {[
                        { label: 'Below',       val: si.distribution.below,       cls: 'text-red-600 bg-red-50' },
                        { label: 'Approaching', val: si.distribution.approaching,  cls: 'text-amber-600 bg-amber-50' },
                        { label: 'Meets',       val: si.distribution.meets,        cls: 'text-green-600 bg-green-50' },
                        { label: 'Exceeds',     val: si.distribution.exceeds,      cls: 'text-purple-600 bg-purple-50' },
                      ].map(d => (
                        <div key={d.label} className={`rounded-xl p-2 ${d.cls}`}>
                          <div className="font-black text-lg">{d.val}</div>
                          <div className="font-semibold">{d.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

              {classData?.recommendations?.length > 0 && (
                <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5">
                  <h3 className="font-black text-teal-800 mb-3">🎯 EduNexus Recommendations</h3>
                  <ul className="space-y-2">
                    {classData.recommendations.map((r: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-teal-700">
                        <span className="font-black text-teal-500 mt-0.5">{i + 1}.</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
