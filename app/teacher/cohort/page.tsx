'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  BarChart2, Users, TrendingUp, TrendingDown,
  Download, ChevronRight, AlertTriangle,
} from 'lucide-react'
import { GRADE_META } from '@/lib/assessments/gradeCalculator'
import type { MeanGrade } from '@/lib/assessments/gradeCalculator'
import type { CohortResult } from '@/lib/assessments/cohortQueries'
import { friendlyMessage } from '@/lib/errors/friendlyMessage'

// ── helpers ──────────────────────────────────────────────────────────────────
function GradeBadge({ grade }: { grade: string }) {
  const meta = GRADE_META[grade as MeanGrade]
  if (!meta) return <span className="font-bold">{grade}</span>
  return (
    <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${meta.cls}`}>
      {grade}
    </span>
  )
}

function BandBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-7 shrink-0 font-bold text-gray-600">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right font-bold text-gray-700">{value}</span>
    </div>
  )
}

const CURRENT_YEAR = new Date().getFullYear()
const CURRENT_TERM = (() => { const m = new Date().getMonth() + 1; return m <= 3 ? '1' : m <= 7 ? '2' : '3' })()

// ── inner component (uses useSearchParams) ───────────────────────────────────
function CohortInner() {
  const params  = useSearchParams()
  const router  = useRouter()

  const [gradeParam, setGradeParam] = useState(params.get('grade') ?? '9')
  const [term, setTerm]             = useState(params.get('term') ?? CURRENT_TERM)
  const [year, setYear]             = useState(params.get('year') ?? String(CURRENT_YEAR))
  const [data, setData]             = useState<CohortResult | null>(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  const fetchCohort = useCallback(async (g: string, t: string, y: string) => {
    setLoading(true)
    setError('')
    setData(null)
    try {
      const res  = await fetch(`/api/teacher/cohort/${g}?term=${t}&year=${y}`)
      const json = await res.json()
      if (!json.success) { setError(json.error || 'No data found'); return }
      setData(json.data.cohort)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const g = params.get('grade') ?? '9'
    const t = params.get('term')  ?? CURRENT_TERM
    const y = params.get('year')  ?? String(CURRENT_YEAR)
    setGradeParam(g); setTerm(t); setYear(y)
    fetchCohort(g, t, y)
  }, [params, fetchCohort])

  function applyFilters() {
    router.push(`/teacher/cohort?grade=${gradeParam}&term=${term}&year=${year}`)
  }

  // ── CSV download ─────────────────────────────────────────────────────────
  function downloadCSV() {
    if (!data) return
    const headers = ['Rank', 'Name', 'Stream', 'Total', 'Mean Score', 'Mean Grade']
    const rows = data.topLearners.map((r) =>
      [r.rank, r.studentName, r.stream ?? '', r.total, r.meanScore, r.meanGrade].join(',')
    )
    const csv  = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `Grade${gradeParam}_Term${term}_${year}_cohort.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── stream comparison ────────────────────────────────────────────────────
  const bestStream = data
    ? [...data.streams].sort((a, b) => b.overallMean - a.overallMean)[0]
    : null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

      {/* Header */}
      <div>
        <Link href="/teacher/dashboard" className="text-sm text-gray-400 hover:text-gray-600 font-medium flex items-center gap-1 mb-3">
          ← Dashboard
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Cohort Analysis</h1>
            {data && (
              <p className="text-gray-500 mt-1 text-sm">
                {data.gradeCohort} · Term {data.term} {data.year} ·{' '}
                <span className="font-bold">{data.streams.length} stream{data.streams.length !== 1 ? 's' : ''}</span>{' '}
                ({data.streams.map((s) => s.className).join(' + ')}) ·{' '}
                {data.totalLearners} learners total
              </p>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Grade</label>
              <select value={gradeParam} onChange={(e) => setGradeParam(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                {[7,8,9,10,11,12].map((g) => <option key={g} value={g}>Grade {g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Term</label>
              <select value={term} onChange={(e) => setTerm(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                {['1','2','3'].map((t) => <option key={t} value={t}>Term {t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Year</label>
              <input type="number" value={year} onChange={(e) => setYear(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <button onClick={applyFilters}
              className="bg-teal-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-teal-700 transition">
              Load
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <span className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-700 font-bold">{friendlyMessage(error).message}</p>
          <p className="text-sm text-red-500 mt-1">
            Make sure both streams have assessments saved for Term {term} {year}.
          </p>
        </div>
      )}

      {data && !loading && (
        <>
          {/* ── SECTION 1: Subject performance table ───────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-teal-600" />
                Subject Performance Summary
              </h2>
              <button onClick={downloadCSV}
                className="flex items-center gap-1.5 text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-xl hover:bg-gray-200 transition">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1e3a5f] text-white">
                    <th className="text-left px-4 py-3 font-bold">Subject</th>
                    {data.streams.map((s) => (
                      <th key={s.classId} className="text-center px-3 py-3 font-bold whitespace-nowrap">
                        {s.className}
                        {s.stream && <span className="block text-[10px] font-normal opacity-70">Stream {s.stream}</span>}
                      </th>
                    ))}
                    <th className="text-center px-3 py-3 font-bold bg-teal-700">Grade Mean</th>
                    <th className="text-center px-3 py-3 font-bold bg-teal-800">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {data.subjectStats.map((ss, i) => (
                    <tr key={ss.subject} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 font-semibold text-gray-800">{ss.subject}</td>
                      {data.streams.map((stream) => {
                        const key = stream.stream ?? stream.className
                        const val = ss.perStream[key]
                        return (
                          <td key={stream.classId} className="text-center px-3 py-3 font-mono">
                            {val !== undefined ? val.toFixed(1) : '—'}
                          </td>
                        )
                      })}
                      <td className="text-center px-3 py-3 font-black text-teal-700 bg-teal-50">
                        {ss.cohortMean.toFixed(1)}
                      </td>
                      <td className="text-center px-3 py-3 bg-teal-50/60">
                        <GradeBadge grade={ss.meanGrade} />
                      </td>
                    </tr>
                  ))}
                  {/* Overall row */}
                  <tr className="border-t-2 border-gray-300 bg-amber-50 font-black">
                    <td className="px-4 py-3 text-amber-800">OVERALL MEAN</td>
                    {data.streams.map((s) => (
                      <td key={s.classId} className="text-center px-3 py-3 text-amber-700">
                        {s.overallMean.toFixed(1)}
                      </td>
                    ))}
                    <td className="text-center px-3 py-3 text-teal-800 bg-teal-100">
                      {data.cohortMean.toFixed(1)}
                    </td>
                    <td className="text-center px-3 py-3 bg-teal-100">
                      <GradeBadge grade={data.cohortGrade} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── SECTION 2: Grade band distribution per subject ─────────── */}
          <div>
            <h2 className="text-base font-black text-gray-900 mb-4">Grade Band Distribution</h2>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.subjectStats.map((ss) => (
                <div key={ss.subject} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-black text-gray-900 text-sm">{ss.subject}</h3>
                    <GradeBadge grade={ss.meanGrade} />
                  </div>
                  <div className="space-y-1.5">
                    <BandBar label="EE" value={ss.bandCounts.EE} total={data.totalLearners} color="bg-purple-500" />
                    <BandBar label="ME" value={ss.bandCounts.ME} total={data.totalLearners} color="bg-green-500" />
                    <BandBar label="AE" value={ss.bandCounts.AE} total={data.totalLearners} color="bg-amber-500" />
                    <BandBar label="BE" value={ss.bandCounts.BE} total={data.totalLearners} color="bg-red-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── SECTION 3: Stream comparison ───────────────────────────── */}
          <div>
            <h2 className="text-base font-black text-gray-900 mb-4">Stream Comparison</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {data.streams.map((s) => (
                <div key={s.classId} className={`bg-white rounded-2xl border p-5 shadow-sm ${s === bestStream ? 'border-teal-400 ring-1 ring-teal-300' : 'border-gray-200'}`}>
                  {s === bestStream && (
                    <span className="text-[10px] font-black text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full block mb-2 w-fit">
                      Top Performer
                    </span>
                  )}
                  <div className="text-xl font-black text-gray-900">{s.className}</div>
                  {s.stream && <div className="text-xs text-gray-400 mb-3">Stream {s.stream}</div>}
                  <div className="text-3xl font-black text-teal-600 mb-1">
                    {s.overallMean.toFixed(1)}
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <GradeBadge grade={s.meanGrade} />
                    <span className="text-xs text-gray-400">{s.learnerCount} learners</span>
                  </div>
                  <div className="space-y-1">
                    <BandBar label="EE" value={s.bandCounts.EE} total={s.learnerCount} color="bg-purple-500" />
                    <BandBar label="ME" value={s.bandCounts.ME} total={s.learnerCount} color="bg-green-500" />
                    <BandBar label="AE" value={s.bandCounts.AE} total={s.learnerCount} color="bg-amber-500" />
                    <BandBar label="BE" value={s.bandCounts.BE} total={s.learnerCount} color="bg-red-500" />
                  </div>
                  <Link
                    href={`/teacher/classes/${s.classId}/assessments`}
                    className="mt-4 flex items-center justify-center gap-1 text-xs font-bold text-teal-600 hover:underline"
                  >
                    View Marksheet <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              ))}

              {/* Cohort card */}
              <div className="bg-[#1e3a5f] rounded-2xl p-5 text-white">
                <div className="text-xs font-bold text-teal-300 uppercase tracking-wide mb-2">
                  {data.gradeCohort} Combined
                </div>
                <div className="text-3xl font-black mb-1">{data.cohortMean.toFixed(1)}</div>
                <GradeBadge grade={data.cohortGrade} />
                <div className="mt-3 text-xs text-slate-400">{data.totalLearners} learners total</div>
                {bestStream && (
                  <div className="mt-3 text-xs text-teal-300 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {bestStream.className} leads by{' '}
                    {(bestStream.overallMean - data.cohortMean).toFixed(1)} pts
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── SECTION 4: Combined ranking (top 20) ───────────────────── */}
          <div>
            <h2 className="text-base font-black text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Combined Ranking — Top 20 Learners
            </h2>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-center px-3 py-3 text-xs font-black text-gray-500 uppercase w-12">Rank</th>
                      <th className="text-left px-4 py-3 text-xs font-black text-gray-500 uppercase">Name</th>
                      <th className="text-center px-3 py-3 text-xs font-black text-gray-500 uppercase">Stream</th>
                      <th className="text-center px-3 py-3 text-xs font-black text-gray-500 uppercase">Total</th>
                      <th className="text-center px-3 py-3 text-xs font-black text-gray-500 uppercase">Mean</th>
                      <th className="text-center px-3 py-3 text-xs font-black text-gray-500 uppercase">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.topLearners.map((r, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="text-center px-3 py-3 font-black text-gray-400 text-sm">{r.rank}</td>
                        <td className="px-4 py-3 font-bold text-gray-900">{r.studentName}</td>
                        <td className="text-center px-3 py-3">
                          <span className="text-xs bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-lg">
                            {r.stream ?? r.className}
                          </span>
                        </td>
                        <td className="text-center px-3 py-3 font-mono font-bold text-gray-800">{r.total}</td>
                        <td className="text-center px-3 py-3 font-mono text-teal-700 font-bold">{r.meanScore.toFixed(1)}</td>
                        <td className="text-center px-3 py-3"><GradeBadge grade={r.meanGrade} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── SECTION 5: Learners needing support (bottom 10) ────────── */}
          {data.lowLearners.length > 0 && (
            <div>
              <h2 className="text-base font-black text-gray-900 mb-4 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-500" />
                Learners Needing Support — Bottom 10
              </h2>
              <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-red-50 border-b border-red-100">
                        <th className="text-center px-3 py-3 text-xs font-black text-red-500 uppercase w-12">Rank</th>
                        <th className="text-left px-4 py-3 text-xs font-black text-red-500 uppercase">Name</th>
                        <th className="text-center px-3 py-3 text-xs font-black text-red-500 uppercase">Stream</th>
                        <th className="text-center px-3 py-3 text-xs font-black text-red-500 uppercase">Total</th>
                        <th className="text-center px-3 py-3 text-xs font-black text-red-500 uppercase">Mean</th>
                        <th className="text-center px-3 py-3 text-xs font-black text-red-500 uppercase">Grade</th>
                        <th className="text-center px-3 py-3 text-xs font-black text-red-500 uppercase">Alert</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-50">
                      {data.lowLearners.map((r, i) => {
                        const msg = encodeURIComponent(
                          `Habari!\n\nNataka kukuarifa kwamba ${r.studentName} alipata wastani wa ${r.meanScore.toFixed(1)} (${r.meanGrade}) katika tathmini ya hivi karibuni — Nafasi ${r.rank}.\n\nTuzungumze kuhusu jinsi ya kumsaidia.\n\n— Mwalimu`
                        )
                        return (
                          <tr key={i} className="bg-white hover:bg-red-50/40">
                            <td className="text-center px-3 py-3 font-black text-red-400">{r.rank}</td>
                            <td className="px-4 py-3 font-bold text-gray-900">{r.studentName}</td>
                            <td className="text-center px-3 py-3">
                              <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-lg">
                                {r.stream ?? r.className}
                              </span>
                            </td>
                            <td className="text-center px-3 py-3 font-mono text-red-700 font-bold">{r.total}</td>
                            <td className="text-center px-3 py-3 font-mono text-red-600 font-bold">{r.meanScore.toFixed(1)}</td>
                            <td className="text-center px-3 py-3"><GradeBadge grade={r.meanGrade} /></td>
                            <td className="text-center px-3 py-3">
                              <a href={`https://wa.me/?text=${msg}`} target="_blank" rel="noopener noreferrer"
                                className="text-xs bg-green-500 text-white px-2.5 py-1 rounded-lg font-bold hover:bg-green-600 transition">
                                📱 Parent
                              </a>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function CohortPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-96">
        <span className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CohortInner />
    </Suspense>
  )
}
