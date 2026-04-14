'use client'

import { useState, useEffect } from 'react'
import {
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  MessageSquare,
  Star,
  RefreshCw,
  AlertTriangle,
  Users,
  Download,
} from 'lucide-react'

interface FeedbackStats {
  total: number
  helpful: number
  notHelpful: number
  helpfulRate: number | null
  avgNPS: number | null
  npsCalculated: number | null
  promoters: number
  detractors: number
  cancelReasons: Record<string, number>
}

interface FeedbackEntry {
  id: string
  user_id: string
  trigger: string
  rating: string | null
  nps_score: number | null
  category: string | null
  message: string | null
  would_recommend: boolean | null
  created_at: string
}

const TRIGGER_LABELS: Record<string, string> = {
  after_analysis: '🎯 Post Analysis',
  after_7_days: '📅 Week 1',
  on_cancel: '😢 Cancellation',
  manual: '💬 Manual',
}

const CANCEL_LABELS: Record<string, string> = {
  too_expensive: '💸 Too expensive',
  not_useful: '😐 Not useful',
  child_finished: '🎓 Child finished',
  found_better: '🔍 Found better',
  too_complicated: '😵 Too complicated',
  missing_features: '🔧 Missing features',
  other: '💬 Other',
}

export default function FeedbackDashboard() {
  const [stats, setStats] = useState<FeedbackStats | null>(null)
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'negative' | 'positive' | 'cancel'>('all')

  // Admin guard — redirect non-admins
  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => {
        if (r.status === 403) {
          window.location.href = '/dashboard'
        }
      })
      .catch(() => {/* fail silently */})
  }, [])

  const fetchFeedback = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/feedback')
      const data = await res.json()
      setStats(data.stats)
      setFeedback(data.feedback || [])
    } catch (err) {
      console.error('Failed to fetch feedback:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFeedback()
  }, [])

  const exportToCSV = () => {
    const headers = ['Date', 'Trigger', 'Rating', 'NPS', 'Category', 'Message']
    const rows = feedback.map(f => [
      new Date(f.created_at).toLocaleDateString('en-KE'),
      f.trigger,
      f.rating || '',
      f.nps_score?.toString() || '',
      f.category || '',
      (f.message || '').replace(/,/g, ';').replace(/\n/g, ' '),
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `edunexus-feedback-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = feedback.filter((f) => {
    if (filter === 'negative') return f.rating === 'not_helpful' || (f.nps_score !== null && f.nps_score <= 6)
    if (filter === 'positive') return f.rating === 'helpful' || (f.nps_score !== null && f.nps_score >= 9)
    if (filter === 'cancel') return f.trigger === 'on_cancel'
    return true
  })

  const getNPSColor = (score: number | null) => {
    if (score === null) return 'text-slate-400'
    if (score >= 9) return 'text-green-600'
    if (score >= 7) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-black text-slate-900">User Feedback</h2>
          <p className="text-slate-500 mt-1">What your parents are saying</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            disabled={feedback.length === 0}
            className="flex items-center gap-2 px-4 py-2 border-2 border-slate-200 rounded-xl hover:bg-slate-50 font-bold text-sm disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
          <button
            onClick={fetchFeedback}
            className="flex items-center gap-2 px-4 py-2 border-2 border-slate-200 rounded-xl hover:bg-slate-50 font-bold text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

          {/* Total Responses */}
          <div className="bg-white border-2 border-slate-100 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-blue-100 rounded-xl">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-3xl font-black text-blue-600">{stats.total}</span>
            </div>
            <p className="font-black text-slate-900 text-sm">Total Responses</p>
            <p className="text-xs text-slate-500 mt-0.5">All time</p>
          </div>

          {/* Helpful Rate */}
          <div className="bg-white border-2 border-slate-100 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-green-100 rounded-xl">
                <ThumbsUp className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-3xl font-black text-green-600">
                {stats.helpfulRate ?? '--'}%
              </span>
            </div>
            <p className="font-black text-slate-900 text-sm">Helpful Rate</p>
            <p className="text-xs text-slate-500 mt-0.5">{stats.helpful} helpful / {stats.notHelpful} not</p>
          </div>

          {/* NPS Score */}
          <div className="bg-white border-2 border-slate-100 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-purple-100 rounded-xl">
                <Star className="w-5 h-5 text-purple-600" />
              </div>
              <span className={`text-3xl font-black ${stats.npsCalculated !== null && stats.npsCalculated >= 50 ? 'text-green-600' : stats.npsCalculated !== null && stats.npsCalculated >= 0 ? 'text-yellow-600' : 'text-slate-400'}`}>
                {stats.npsCalculated ?? '--'}
              </span>
            </div>
            <p className="font-black text-slate-900 text-sm">NPS Score</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {stats.promoters} promoters / {stats.detractors} detractors
            </p>
          </div>

          {/* Negative Alerts */}
          <div className="bg-white border-2 border-slate-100 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-red-100 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-3xl font-black text-red-600">{stats.notHelpful}</span>
            </div>
            <p className="font-black text-slate-900 text-sm">Need Attention</p>
            <p className="text-xs text-slate-500 mt-0.5">Unhappy users</p>
          </div>

        </div>
      )}

      {/* Cancel Reasons Breakdown */}
      {stats && Object.keys(stats.cancelReasons).length > 0 && (
        <div className="bg-white border-2 border-slate-100 rounded-2xl p-6">
          <h3 className="font-black text-slate-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-500" />
            Why Users Leave
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.cancelReasons)
              .sort(([, a], [, b]) => b - a)
              .map(([reason, count]) => {
                const total = Object.values(stats.cancelReasons).reduce((a, b) => a + b, 0)
                const pct = Math.round((count / total) * 100)
                return (
                  <div key={reason}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-bold text-slate-700">
                        {CANCEL_LABELS[reason] || reason}
                      </span>
                      <span className="text-sm font-black text-slate-900">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-400 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Feedback List */}
      <div className="bg-white border-2 border-slate-100 rounded-2xl overflow-hidden">

        {/* Filter Tabs */}
        <div className="border-b-2 border-slate-100 p-4 flex gap-2 flex-wrap">
          {(['all', 'negative', 'positive', 'cancel'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${
                filter === f
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f === 'all' && `All (${feedback.length})`}
              {f === 'negative' && `🔴 Negative`}
              {f === 'positive' && `🟢 Positive`}
              {f === 'cancel' && `😢 Cancellations`}
            </button>
          ))}
        </div>

        {/* Entries */}
        <div className="divide-y-2 divide-slate-50">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">📭</div>
              <p className="font-black text-slate-700 mb-1">
                {feedback.length === 0 ? 'No feedback yet' : 'No feedback in this category'}
              </p>
              <p className="text-slate-400 text-sm max-w-xs mx-auto">
                {feedback.length === 0
                  ? 'Feedback appears here when users rate their experience. Keep building — users are coming! 🚀'
                  : 'Try switching to a different filter above.'}
              </p>
            </div>
          ) : (
            filtered.map((entry) => (
              <div key={entry.id} className="p-5 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">

                    {/* Meta row */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-black px-2 py-1 bg-slate-100 rounded-lg text-slate-600">
                        {TRIGGER_LABELS[entry.trigger] || entry.trigger}
                      </span>

                      {entry.rating && (
                        <span className={`text-xs font-black px-2 py-1 rounded-lg ${
                          entry.rating === 'helpful'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {entry.rating === 'helpful' ? '👍 Helpful' : '👎 Not helpful'}
                        </span>
                      )}

                      {entry.nps_score !== null && (
                        <span className={`text-xs font-black px-2 py-1 rounded-lg bg-slate-100 ${getNPSColor(entry.nps_score)}`}>
                          NPS: {entry.nps_score}/10
                        </span>
                      )}

                      {entry.category && (
                        <span className="text-xs font-bold px-2 py-1 bg-orange-100 text-orange-700 rounded-lg">
                          {CANCEL_LABELS[entry.category] || entry.category}
                        </span>
                      )}
                    </div>

                    {/* Message */}
                    {entry.message && (
                      <p className="text-sm text-slate-700 font-semibold leading-relaxed bg-slate-50 px-3 py-2 rounded-xl">
                        "{entry.message}"
                      </p>
                    )}

                    {/* Footer */}
                    <p className="text-xs text-slate-400 mt-2 font-semibold">
                      {new Date(entry.created_at).toLocaleDateString('en-KE', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  )
}