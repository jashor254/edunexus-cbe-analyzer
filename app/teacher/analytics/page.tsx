'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts'
import Link from 'next/link'
import { BarChart3, ChevronDown, ChevronUp, GitCompareArrows } from 'lucide-react'
import type {
  AnalyticsData, ClassOverview, SubjectRow, LearnerRow,
  GradeLevel,
} from '@/lib/assessments/analytics'
import { friendlyMessage } from '@/lib/errors/friendlyMessage'
import { getTitleLabel, compareAssessmentTypes } from '@/lib/assessments/assessmentTypeCatalog'

// ── Grade helpers ─────────────────────────────────────────────────────────────
const GRADE_COLOR: Record<GradeLevel, string> = {
  EE: 'bg-green-100 text-green-700',
  ME: 'bg-blue-100 text-blue-700',
  AE: 'bg-amber-100 text-amber-700',
  BE: 'bg-red-100 text-red-700',
}

const GRADE_BAR_COLOR: Record<GradeLevel, string> = {
  EE: '#16a34a',
  ME: '#2563eb',
  AE: '#d97706',
  BE: '#dc2626',
}

const SUBJECT_SHORT: Record<string, string> = {
  'Mathematics':             'Maths',
  'English':                 'Eng',
  'Kiswahili':               'Kisw',
  'Integrated Science':      'Science',
  'Pre-Technical Studies':   'Pre-Tech',
  'Creative Arts':           'Creative',
  'Social Studies':          'Social',
  'CRE':                     'CRE',
  'Agriculture & Nutrition': 'Agri',
}

function gradeBadge(grade: string, large = false) {
  const cls = GRADE_COLOR[grade as GradeLevel] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center justify-center font-black rounded-lg ${large ? 'text-2xl px-4 py-1.5' : 'text-xs px-2 py-0.5'} ${cls}`}>
      {grade}
    </span>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-xl ${className ?? ''}`} />
}

function PageSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <Skeleton className="h-8 w-72" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-64" />
      <Skeleton className="h-80" />
    </div>
  )
}

// ── VIEW 1 — Class card ───────────────────────────────────────────────────────
function ClassCard({ cls }: { cls: ClassOverview }) {
  const { studentCount, meanScore, gradeDistribution: dist, highestTotal, lowestTotal } = cls
  const overallGrade: GradeLevel = meanScore >= 75 ? 'EE' : meanScore >= 50 ? 'ME' : meanScore >= 25 ? 'AE' : 'BE'
  const total = studentCount || 1

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-black text-gray-900">{cls.className}</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Grade {cls.grade}{cls.stream ? ` · Stream ${cls.stream}` : ''} · {cls.gradeCohort}
          </p>
        </div>
        {gradeBadge(overallGrade, true)}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-gray-900">{studentCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">Students</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-gray-900">{meanScore.toFixed(1)}</div>
          <div className="text-xs text-gray-500 mt-0.5">Class Mean</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-lg font-black text-green-600">{highestTotal}</div>
          <div className="text-xs text-gray-500">Highest</div>
          <div className="text-lg font-black text-red-600">{lowestTotal}</div>
          <div className="text-xs text-gray-500">Lowest</div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['EE', 'ME', 'AE', 'BE'] as GradeLevel[]).map(g => {
          const count = dist[g]
          const pct = Math.round((count / total) * 100)
          return (
            <div key={g} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${GRADE_COLOR[g]}`}>
              <span>{g}</span>
              <span className="opacity-70">{count} ({pct}%)</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── VIEW 2 — Subject performance table ────────────────────────────────────────
function SubjectTable({
  subjects, classes,
}: {
  subjects: SubjectRow[]
  classes: ClassOverview[]
}) {
  // Group classes by grade_cohort for combined columns
  const cohortMap = useMemo(() => {
    const map = new Map<string, ClassOverview[]>()
    for (const c of classes) {
      const key = c.gradeCohort
      map.set(key, [...(map.get(key) ?? []), c])
    }
    return map
  }, [classes])

  const multiStream = useMemo(
    () => [...cohortMap.entries()].some(([, cls]) => cls.length > 1),
    [cohortMap]
  )

  function combinedBg(mean: number) {
    if (mean < 25) return 'bg-red-100 text-red-700 font-bold'
    if (mean < 50) return 'bg-amber-50 text-amber-700'
    if (mean >= 75) return 'bg-green-50 text-green-700 font-bold'
    return 'text-gray-700'
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-black text-gray-900">Subject Performance</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-200 mr-1" />crisis &lt;25 &nbsp;
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-100 mr-1" />concern &lt;50 &nbsp;
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-100 mr-1" />strong ≥75
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-6 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Subject</th>
              {classes.map(c => (
                <th key={c.classId} className="px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide text-center">
                  {c.className}
                </th>
              ))}
              {/* Grade-combined columns when multiple streams in same grade */}
              {multiStream && [...cohortMap.entries()]
                .filter(([, cls]) => cls.length > 1)
                .map(([cohort]) => (
                  <th key={`combined-${cohort}`} className="px-4 py-3 font-bold text-teal-700 text-xs uppercase tracking-wide text-center bg-teal-50">
                    {cohort} Combined
                  </th>
                ))
              }
              <th className="px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide text-center">Overall</th>
              <th className="px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide text-center">Grade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {subjects.map(row => (
              <tr key={row.subject} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-3 font-semibold text-gray-900">{row.subject}</td>
                {classes.map(c => (
                  <td key={c.classId} className="px-4 py-3 text-center text-gray-700">
                    {row.classMeans[c.classId] != null
                      ? row.classMeans[c.classId].toFixed(1)
                      : '—'}
                  </td>
                ))}
                {multiStream && [...cohortMap.entries()]
                  .filter(([, cls]) => cls.length > 1)
                  .map(([cohort, cls]) => {
                    const scores = cls.flatMap(c =>
                      row.classMeans[c.classId] != null ? [row.classMeans[c.classId]] : []
                    )
                    const mean = scores.length
                      ? scores.reduce((a, b) => a + b, 0) / scores.length
                      : null
                    return (
                      <td key={`combined-${cohort}`} className={`px-4 py-3 text-center bg-teal-50 ${mean !== null ? combinedBg(mean) : 'text-gray-400'}`}>
                        {mean !== null ? mean.toFixed(1) : '—'}
                      </td>
                    )
                  })
                }
                <td className={`px-4 py-3 text-center ${combinedBg(row.combinedMean)}`}>
                  {row.combinedMean.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-center">
                  {gradeBadge(row.combinedGrade)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── VIEW 3 — Learner results table (ranked, with subject breakdown) ────────────
function LearnerTable({
  learners, classes, subjects,
}: {
  learners: LearnerRow[]
  classes: ClassOverview[]
  subjects: SubjectRow[]
}) {
  const [filter, setFilter] = useState<string>('all')
  const [showAll, setShowAll] = useState(false)

  const ranked = useMemo(() => {
    const base = filter === 'all'
      ? learners
      : learners.filter(l => l.classId === filter)

    const sorted = [...base].sort((a, b) => b.totalMarks - a.totalMarks)

    // Use DB position when filtering by a single class; recalculate for combined
    return sorted.map((l, i) => ({
      ...l,
      rank: filter !== 'all' && l.position != null ? l.position : i + 1,
    }))
  }, [learners, filter])

  const displayed = showAll ? ranked : ranked.slice(0, 15)

  // Subject list in order for column headers
  const subjectList = subjects.map(s => s.subject)

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-black text-gray-900">Learner Results</h2>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => { setFilter('all'); setShowAll(false) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            All ({learners.length})
          </button>
          {classes.map(c => (
            <button
              key={c.classId}
              onClick={() => { setFilter(c.classId); setShowAll(false) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filter === c.classId ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {c.className}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-3 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide text-center w-10 sticky left-0 bg-gray-50">#</th>
              <th className="px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide sticky left-8 bg-gray-50">Name</th>
              {filter === 'all' && (
                <th className="px-3 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide">Class</th>
              )}
              {subjectList.map(s => (
                <th key={s} className="px-3 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide text-center whitespace-nowrap">
                  {SUBJECT_SHORT[s] ?? s}
                </th>
              ))}
              <th className="px-3 py-3 font-bold text-gray-900 text-xs uppercase tracking-wide text-center bg-gray-100">Total</th>
              <th className="px-3 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide text-center">Mean</th>
              <th className="px-3 py-3 font-bold text-gray-600 text-xs uppercase tracking-wide text-center">Grade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayed.map((l) => (
              <tr key={`${l.classId}-${l.studentName}`} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2.5 text-center font-black text-gray-500 text-sm sticky left-0 bg-white">{l.rank}</td>
                <td className="px-4 py-2.5 font-semibold text-gray-900 sticky left-8 bg-white whitespace-nowrap">{l.studentName}</td>
                {filter === 'all' && (
                  <td className="px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                    {l.className}{l.stream ? ` (${l.stream})` : ''}
                  </td>
                )}
                {subjectList.map(s => {
                  const score = l.subjectScores[s] ?? l.subjectScores[s.toLowerCase()] ?? null
                  return (
                    <td key={s} className="px-3 py-2.5 text-center text-gray-700">
                      {score != null ? score : <span className="text-gray-300">—</span>}
                    </td>
                  )
                })}
                <td className="px-3 py-2.5 text-center font-black text-gray-900 bg-gray-50">{l.totalMarks}</td>
                <td className="px-3 py-2.5 text-center text-gray-600">{l.meanScore.toFixed(1)}</td>
                <td className="px-3 py-2.5 text-center">{gradeBadge(l.meanGrade)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ranked.length > 15 && (
        <div className="px-6 py-3 border-t border-gray-100 text-center">
          <button
            onClick={() => setShowAll(v => !v)}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-teal-600 hover:text-teal-700 transition-colors"
          >
            {showAll
              ? <><ChevronUp className="w-4 h-4" />Show top 15</>
              : <><ChevronDown className="w-4 h-4" />Show all {ranked.length} students</>
            }
          </button>
        </div>
      )}
    </div>
  )
}

// ── VIEW 4 — Subject distribution bar chart ───────────────────────────────────
function DistributionChart({
  subjectDistribution, classes,
}: {
  subjectDistribution: AnalyticsData['subjectDistribution']
  classes: ClassOverview[]
}) {
  const [filter, setFilter] = useState<string>('all')

  const chartData = useMemo(() => {
    return subjectDistribution.map(entry => {
      const dist: Record<GradeLevel, number> = { EE: 0, ME: 0, AE: 0, BE: 0 }
      const classIds = filter === 'all'
        ? classes.map(c => c.classId)
        : [filter]

      for (const classId of classIds) {
        const d = entry.distribution[classId]
        if (!d) continue
        dist.EE += d.EE
        dist.ME += d.ME
        dist.AE += d.AE
        dist.BE += d.BE
      }

      return {
        subject: SUBJECT_SHORT[entry.subject] ?? entry.subject,
        BE: dist.BE,
        AE: dist.AE,
        ME: dist.ME,
        EE: dist.EE,
      }
    })
  }, [subjectDistribution, classes, filter])

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-black text-gray-900">CBC Distribution by Subject</h2>
          <p className="text-sm text-gray-400 mt-0.5">Student count per performance level</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            All classes
          </button>
          {classes.map(c => (
            <button
              key={c.classId}
              onClick={() => setFilter(c.classId)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filter === c.classId ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {c.className}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <XAxis dataKey="subject" tick={{ fontSize: 11, fontWeight: 600 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              formatter={(value: number, name: string) => [value, name]}
              contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
            />
            <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
            <Bar dataKey="BE" stackId="a" fill={GRADE_BAR_COLOR.BE} name="BE">
              {chartData.map((_, i) => <Cell key={i} fill={GRADE_BAR_COLOR.BE} />)}
            </Bar>
            <Bar dataKey="AE" stackId="a" fill={GRADE_BAR_COLOR.AE} name="AE">
              {chartData.map((_, i) => <Cell key={i} fill={GRADE_BAR_COLOR.AE} />)}
            </Bar>
            <Bar dataKey="ME" stackId="a" fill={GRADE_BAR_COLOR.ME} name="ME">
              {chartData.map((_, i) => <Cell key={i} fill={GRADE_BAR_COLOR.ME} />)}
            </Bar>
            <Bar dataKey="EE" stackId="a" fill={GRADE_BAR_COLOR.EE} name="EE" radius={[4, 4, 0, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={GRADE_BAR_COLOR.EE} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Term / Year + Assessment Type selector ─────────────────────────────────────
function TermSelector({
  term, year, onChange,
}: {
  term: string
  year: number
  onChange: (term: string, year: number) => void
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Term</label>
        <div className="flex gap-1">
          {['1', '2', '3'].map(t => (
            <button
              key={t}
              onClick={() => onChange(t, year)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${term === t ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Year</label>
        <select
          value={year}
          onChange={e => onChange(term, Number(e.target.value))}
          className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm font-bold bg-white text-gray-900 focus:outline-none focus:border-teal-500"
        >
          {[2024, 2025, 2026, 2027].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const currentYear = new Date().getFullYear()
  const [term, setTerm] = useState('1')
  const [year, setYear] = useState(currentYear)
  const [availableTypes, setAvailableTypes] = useState<string[]>([])
  const [selectedType, setSelectedType] = useState<string>('')
  const [typesLoading, setTypesLoading] = useState(false)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cohorts, setCohorts] = useState<{ grade: number; gradeCohort: string; streamCount: number; classNames: string[] }[]>([])

  // Only relevant when a grade actually has 2+ streams worth comparing.
  useEffect(() => {
    fetch('/api/teacher/cohorts')
      .then((r) => r.json())
      .then((res) => { if (res.success) setCohorts(res.data.cohorts) })
  }, [])

  // Step 1: when term/year changes, fetch available assessment types
  useEffect(() => {
    setTypesLoading(true)
    setAvailableTypes([])
    setSelectedType('')
    setData(null)
    fetch(`/api/teacher/assessments?term=${term}&year=${year}`)
      .then(r => r.json())
      .then(res => {
        if (!res.success) return
        const types: string[] = [
          ...new Set((res.data.assessments as { assessment_type: string }[]).map(a => a.assessment_type))
        ].sort(compareAssessmentTypes)
        setAvailableTypes(types)
        if (types.length > 0) setSelectedType(types[0])
      })
      .finally(() => setTypesLoading(false))
  }, [term, year])

  // Step 2: when type is selected, fetch analytics
  useEffect(() => {
    if (!selectedType) return
    setLoading(true)
    setError(null)
    setData(null)
    fetch(`/api/teacher/analytics?term=${term}&year=${year}&type=${selectedType}`)
      .then(r => r.json())
      .then(res => {
        if (!res.success) throw new Error(res.error ?? 'Failed to load')
        setData(res.data.analytics)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [term, year, selectedType])

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Class Analytics</h1>
          <p className="text-gray-400 mt-1 font-medium">CBC Assessment Performance</p>
        </div>
        <TermSelector
          term={term}
          year={year}
          onChange={(t, y) => { setTerm(t); setYear(y) }}
        />
      </div>

      {/* Stream comparison — only shown when a grade actually has 2+ streams */}
      {cohorts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {cohorts.map((c) => (
            <Link
              key={c.gradeCohort}
              href={`/teacher/cohort?grade=${c.grade}&term=${term}&year=${year}`}
              className="flex items-center gap-2 bg-teal-50 border border-teal-100 text-teal-700 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-teal-100 transition"
            >
              <GitCompareArrows className="w-4 h-4" />
              Compare {c.classNames.join(' vs ')} ({c.gradeCohort})
            </Link>
          ))}
        </div>
      )}

      {/* Assessment type picker */}
      {typesLoading && (
        <div className="flex gap-2">
          {[1,2,3].map(i => <div key={i} className="h-9 w-24 animate-pulse bg-gray-200 rounded-xl" />)}
        </div>
      )}
      {!typesLoading && availableTypes.length === 0 && (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">No assessments for Term {term} · {year}.</p>
          <p className="text-gray-400 text-sm mt-1">Create and upload marks from a class page first.</p>
        </div>
      )}
      {!typesLoading && availableTypes.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wide mr-1">Assessment</span>
          {availableTypes.map(t => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors border ${
                selectedType === t
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {getTitleLabel(t)}
            </button>
          ))}
        </div>
      )}

      {loading && <PageSkeleton />}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
          <BarChart3 className="w-10 h-10 text-red-300 mx-auto mb-3" />
          <p className="text-red-700 font-bold">{friendlyMessage(error).message}</p>
        </div>
      )}

      {!loading && !error && selectedType && !data && (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">No marks entered yet for {getTitleLabel(selectedType)} · Term {term} · {year}.</p>
          <p className="text-gray-400 text-sm mt-1">Open the class → Enter Marks to add learner scores.</p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Assessment label */}
          <p className="text-sm text-gray-500 font-medium -mb-4">
            {data.title}
          </p>

          {/* VIEW 1 — Class cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.classes.map(cls => (
              <ClassCard key={cls.classId} cls={cls} />
            ))}
          </div>

          {/* VIEW 2 — Subject table */}
          <SubjectTable subjects={data.subjects} classes={data.classes} />

          {/* VIEW 3 — Learner results with subject breakdown */}
          <LearnerTable
            learners={data.learners}
            classes={data.classes}
            subjects={data.subjects}
          />

          {/* VIEW 4 — Distribution chart */}
          <DistributionChart
            subjectDistribution={data.subjectDistribution}
            classes={data.classes}
          />
        </>
      )}

    </div>
  )
}
