'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Loader2, AlertCircle, FileText, ArrowLeft } from 'lucide-react'
import type { ReportCardWithSubjects } from '@/types/core'

type GuardianLearner = {
  learner_id:    string
  school_id:     string
  first_name:    string
  last_name:     string
  currentTermId: string | null
}

export default function ParentReportCardPage() {
  const [learners, setLearners] = useState<GuardianLearner[] | null>(null)
  const [selected, setSelected] = useState<GuardianLearner | null>(null)
  const [report, setReport]     = useState<ReportCardWithSubjects | null>(null)
  const [error, setError]       = useState('')
  const [loadingReport, setLoadingReport] = useState(false)

  useEffect(() => {
    fetch('/api/reports/report-card/mine', { credentials: 'include' })
      .then(async r => {
        const json = await r.json()
        if (!r.ok || !json.success) throw new Error(json.error ?? 'Failed to load your children')
        setLearners(json.data.learners)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load your children'))
  }, [])

  const loadReport = useCallback(async (learner: GuardianLearner) => {
    setSelected(learner)
    setReport(null)
    setError('')
    if (!learner.currentTermId) {
      setError('No current term is set for this school yet.')
      return
    }
    setLoadingReport(true)
    try {
      const res = await fetch(
        `/api/reports/report-card?learnerId=${learner.learner_id}&termId=${learner.currentTermId}`,
        { credentials: 'include' }
      )
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Report card not available')
      setReport(json.data.report)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Report card not available')
    } finally {
      setLoadingReport(false)
    }
  }, [])

  if (!learners && !error) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Link href="/dashboard" className="flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <header>
        <h1 className="text-xl font-semibold text-white">Report Card</h1>
        <p className="text-sm text-white/50">View your child&apos;s published school report card.</p>
      </header>

      {error && !selected && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {learners && learners.length === 0 && (
        <p className="text-sm text-white/50">No school-registered children found for your account yet.</p>
      )}

      {learners && learners.length > 0 && !selected && (
        <div className="grid gap-2">
          {learners.map(l => (
            <button
              key={l.learner_id}
              onClick={() => loadReport(l)}
              className="flex items-center gap-3 border border-white/10 rounded-xl p-4 bg-white/5 hover:bg-white/10 transition-colors text-left"
            >
              <FileText className="w-5 h-5 text-cyan-400" />
              <span className="text-sm font-medium text-white">{l.first_name} {l.last_name}</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="space-y-4">
          <button onClick={() => setSelected(null)} className="text-xs text-white/40 hover:text-white/70">
            ← Choose a different child
          </button>

          {loadingReport && (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
            </div>
          )}

          {!loadingReport && error && (
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          {!loadingReport && report && (
            <div className="border border-white/10 rounded-2xl bg-white/5 p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {report.learners.first_name} {report.learners.last_name}
                </h2>
                <p className="text-xs text-white/40">Admission No. {report.learners.admission_number}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-white/40 text-xs">Overall Score</p>
                  <p className="text-white font-medium">{report.overall_score ?? '—'}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs">Overall Level</p>
                  <p className="text-white font-medium">{report.overall_cbc_level ?? '—'}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs">Position in Class</p>
                  <p className="text-white font-medium">
                    {report.position_in_class ?? '—'}{report.total_learners ? ` of ${report.total_learners}` : ''}
                  </p>
                </div>
                <div>
                  <p className="text-white/40 text-xs">Attendance</p>
                  <p className="text-white font-medium">
                    {report.days_present ?? '—'} present / {report.days_absent ?? '—'} absent
                  </p>
                </div>
              </div>

              {report.term_subject_summaries.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wide">Subjects</h3>
                  <div className="divide-y divide-white/10">
                    {report.term_subject_summaries.map(s => (
                      <div key={s.id} className="flex items-center justify-between py-2 text-sm">
                        <span className="text-white/80">{s.subjects.name}</span>
                        <span className="text-white/50">
                          {s.weighted_score ?? '—'} {s.cbc_level ? `· ${s.cbc_level}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.class_teacher_comment && (
                <p className="text-sm text-white/70">
                  <span className="font-medium text-white/90">Class Teacher: </span>{report.class_teacher_comment}
                </p>
              )}
              {report.headteacher_comment && (
                <p className="text-sm text-white/70">
                  <span className="font-medium text-white/90">Headteacher: </span>{report.headteacher_comment}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
