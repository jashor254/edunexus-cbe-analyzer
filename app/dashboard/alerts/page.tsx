'use client'

import { useEffect, useState } from 'react'
import { Bell, CheckCircle2, AlertTriangle, TrendingDown, Clock, BookOpen, Sun } from 'lucide-react'

type AlertType =
  | 'inactive'
  | 'declining_scores'
  | 'assignment_overdue'
  | 'repeated_struggles'
  | 'holiday_inactive'

type Alert = {
  id: string
  alert_type: AlertType
  message: string
  is_resolved: boolean
  created_at: string
  student_id: string
  student_name: string
  student_grade: number
  teacher_name: string
  teacher_school: string
}

// ---------------------------------------------------------------------------
// Config maps
// ---------------------------------------------------------------------------

const ALERT_CONFIG: Record<AlertType, {
  label: string
  icon: React.ComponentType<{ className?: string }>
  badgeCls: string
}> = {
  inactive: {
    label:     'Inactive',
    icon:      Clock,
    badgeCls:  'bg-red-100 text-red-700',
  },
  declining_scores: {
    label:     'Declining Scores',
    icon:      TrendingDown,
    badgeCls:  'bg-amber-100 text-amber-700',
  },
  assignment_overdue: {
    label:     'Overdue Assignment',
    icon:      BookOpen,
    badgeCls:  'bg-amber-100 text-amber-700',
  },
  repeated_struggles: {
    label:     'Needs Support',
    icon:      AlertTriangle,
    badgeCls:  'bg-blue-100 text-blue-700',
  },
  holiday_inactive: {
    label:     'Holiday Reminder',
    icon:      Sun,
    badgeCls:  'bg-amber-100 text-amber-700',
  },
}

function safeConfig(type: string) {
  return ALERT_CONFIG[type as AlertType] ?? {
    label:    type,
    icon:     Bell,
    badgeCls: 'bg-gray-100 text-gray-600',
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)  return 'Just now'
  if (hours < 1)  return `${mins}m ago`
  if (days  < 1)  return `${hours}h ago`
  return `${days}d ago`
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function AlertSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-24 h-5 bg-gray-200 rounded-full" />
        <div className="w-16 h-5 bg-gray-100 rounded-full ml-auto" />
      </div>
      <div className="w-full h-4 bg-gray-100 rounded" />
      <div className="w-3/4 h-4 bg-gray-100 rounded" />
      <div className="flex gap-2 mt-1">
        <div className="w-20 h-3 bg-gray-100 rounded" />
        <div className="w-32 h-3 bg-gray-100 rounded" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Alert card
// ---------------------------------------------------------------------------

function AlertCard({ alert }: { alert: Alert }) {
  const cfg  = safeConfig(alert.alert_type)
  const Icon = cfg.icon

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden shadow-sm transition ${
      alert.is_resolved ? 'border-gray-100 opacity-60' : 'border-gray-200'
    }`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${cfg.badgeCls}`}>
              <Icon className="w-3 h-3" />
              {cfg.label}
            </span>
            {alert.is_resolved && (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                <CheckCircle2 className="w-3 h-3" /> Resolved
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
            {timeAgo(alert.created_at)}
          </span>
        </div>

        <p className="text-sm text-gray-700 leading-relaxed mb-3">{alert.message}</p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
          <span>
            <span className="font-semibold text-gray-600">{alert.student_name}</span>
            {' '}· Grade {alert.student_grade}
          </span>
          <span>
            From <span className="font-semibold text-gray-600">{alert.teacher_name}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ParentAlertsPage() {
  const [alerts, setAlerts]   = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/parent/alerts')
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setAlerts(res.data.alerts)
        } else {
          setError(res.error ?? 'Failed to load alerts')
        }
      })
      .catch(() => setError('Could not connect. Please try again.'))
      .finally(() => setLoading(false))
  }, [])

  // Group by student
  const byStudent = alerts.reduce<Record<string, { name: string; grade: number; alerts: Alert[] }>>(
    (acc, alert) => {
      if (!acc[alert.student_id]) {
        acc[alert.student_id] = {
          name:   alert.student_name,
          grade:  alert.student_grade,
          alerts: [],
        }
      }
      acc[alert.student_id].alerts.push(alert)
      return acc
    },
    {}
  )

  const unresolved = alerts.filter(a => !a.is_resolved).length

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-black text-gray-900">Alerts</h1>
          {unresolved > 0 && (
            <span className="bg-red-500 text-white text-xs font-black px-2.5 py-1 rounded-full">
              {unresolved}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500">Messages from your child's teacher about their progress.</p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6">
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-4">
          <AlertSkeleton />
          <AlertSkeleton />
          <AlertSkeleton />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && alerts.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <Bell className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="font-bold text-gray-500 mb-1">No alerts from your child's teacher.</p>
          <p className="text-sm text-gray-400">All is well! 🎉</p>
        </div>
      )}

      {/* Alerts grouped by student */}
      {!loading && !error && Object.keys(byStudent).length > 0 && (
        <div className="space-y-8">
          {Object.entries(byStudent).map(([studentId, group]) => (
            <section key={studentId}>
              {Object.keys(byStudent).length > 1 && (
                <h2 className="text-sm font-black text-gray-400 uppercase tracking-wider mb-3">
                  {group.name} · Grade {group.grade}
                </h2>
              )}
              <div className="space-y-3">
                {group.alerts.map(alert => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
