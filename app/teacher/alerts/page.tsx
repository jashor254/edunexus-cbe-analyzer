'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle2, Share2, Compass } from 'lucide-react'

type AlertType = 'inactive' | 'declining_scores' | 'assignment_overdue' | 'repeated_struggles' | 'holiday_inactive'

function alertSeverity(type: AlertType): 'critical' | 'warning' | 'info' {
  if (type === 'inactive' || type === 'holiday_inactive') return 'critical'
  if (type === 'declining_scores' || type === 'repeated_struggles') return 'warning'
  return 'info'
}

function severityStyle(sev: string) {
  if (sev === 'critical') return {
    border: 'border-red-200', bg: 'bg-red-50', dot: '🔴', badge: 'bg-red-100 text-red-700',
  }
  if (sev === 'warning') return {
    border: 'border-amber-200', bg: 'bg-amber-50', dot: '🟡', badge: 'bg-amber-100 text-amber-700',
  }
  return {
    border: 'border-blue-200', bg: 'bg-blue-50', dot: '🔵', badge: 'bg-blue-100 text-blue-700',
  }
}

interface Alert {
  id: string
  alert_type: AlertType
  message: string
  is_resolved: boolean
  created_at: string
  students: { name: string; grade: number } | null
}

// PRP-3 (Teacher Workflow Engine, Phase 5) — the WhatsApp deep-link opens
// a real conversation with no delivery receipt EduNexus can ever see (no
// notification engine, no new communication channel per this sprint's own
// Forbidden list). What this sprint CAN honestly confirm is that the
// teacher themselves clicked "send" — recorded client-side only, per
// session, so a teacher who re-opens Alerts later in the same session
// sees they already acted rather than wondering if they did. This is
// deliberately not a delivery claim (the false-promise pattern PRP-1/
// pilot-readiness audits already flagged elsewhere) — the label says
// "You sent this", not "Delivered" or "Read".
const SENT_STORAGE_KEY = 'edunexus_alert_whatsapp_sent'

function loadSentMap(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(sessionStorage.getItem(SENT_STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState<string | null>(null)
  const [sentAt, setSentAt] = useState<Record<string, string>>({})

  useEffect(() => {
    setSentAt(loadSentMap())
    fetch('/api/teacher/alerts')
      .then(r => r.json())
      .then(d => { if (d.success) setAlerts(d.data.alerts) })
      .finally(() => setLoading(false))
  }, [])

  function markSent(alertId: string) {
    const iso = new Date().toISOString()
    setSentAt(prev => {
      const next = { ...prev, [alertId]: iso }
      if (typeof window !== 'undefined') sessionStorage.setItem(SENT_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  async function resolveAlert(alertId: string) {
    setResolving(alertId)
    try {
      const res = await fetch('/api/teacher/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, action: 'resolve' }),
      })
      const d = await res.json()
      if (d.success) {
        setAlerts(prev => prev.filter(a => a.id !== alertId))
      }
    } finally {
      setResolving(null)
    }
  }

  function whatsappMsg(student: Alert['students'], message: string) {
    if (!student) return ''
    return encodeURIComponent(
`Habari! 👋

Kuhusu ${student.name} (Grade ${student.grade}):

${message}

Tafadhali mhimize atumie EduNexus Learning Compass ili asibaki nyuma.

Asante! 🙏`
    )
  }

  const critical = alerts.filter(a => alertSeverity(a.alert_type) === 'critical')
  const warning = alerts.filter(a => alertSeverity(a.alert_type) === 'warning')
  const info = alerts.filter(a => alertSeverity(a.alert_type) === 'info')

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-red-500 shrink-0" />
          Early Warning Alerts
        </h1>
        <p className="text-gray-500 mt-1">Students who may need your attention</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <span className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h3 className="text-xl font-black text-gray-600 mb-2">All Clear! 🎉</h3>
          <p className="text-gray-400">No alerts at this time. Your students are on track.</p>
        </div>
      ) : (
        <div className="space-y-8">

          {/* Critical */}
          {critical.length > 0 && (
            <section>
              <h2 className="text-lg font-black text-red-700 mb-3 flex items-center gap-2">
                🔴 Critical ({critical.length})
                <span className="text-xs font-normal text-red-500 bg-red-100 px-2 py-0.5 rounded-full">
                  Inactive or very low performance
                </span>
              </h2>
              <div className="space-y-3">
                {critical.map(alert => <AlertCard key={alert.id} alert={alert} onResolve={resolveAlert} resolving={resolving} whatsappMsg={whatsappMsg} sentAt={sentAt[alert.id]} onSent={() => markSent(alert.id)} />)}
              </div>
            </section>
          )}

          {/* Warning */}
          {warning.length > 0 && (
            <section>
              <h2 className="text-lg font-black text-amber-700 mb-3 flex items-center gap-2">
                🟡 Warning ({warning.length})
                <span className="text-xs font-normal text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                  Declining or struggling
                </span>
              </h2>
              <div className="space-y-3">
                {warning.map(alert => <AlertCard key={alert.id} alert={alert} onResolve={resolveAlert} resolving={resolving} whatsappMsg={whatsappMsg} sentAt={sentAt[alert.id]} onSent={() => markSent(alert.id)} />)}
              </div>
            </section>
          )}

          {/* Info */}
          {info.length > 0 && (
            <section>
              <h2 className="text-lg font-black text-blue-700 mb-3 flex items-center gap-2">
                🔵 Info ({info.length})
              </h2>
              <div className="space-y-3">
                {info.map(alert => <AlertCard key={alert.id} alert={alert} onResolve={resolveAlert} resolving={resolving} whatsappMsg={whatsappMsg} sentAt={sentAt[alert.id]} onSent={() => markSent(alert.id)} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function AlertCard({
  alert,
  onResolve,
  resolving,
  whatsappMsg,
  sentAt,
  onSent,
}: {
  alert: Alert
  onResolve: (id: string) => void
  resolving: string | null
  whatsappMsg: (student: Alert['students'], message: string) => string
  sentAt?: string
  onSent: () => void
}) {
  const sev = alertSeverity(alert.alert_type)
  const style = severityStyle(sev)
  const student = alert.students

  return (
    <div className={`bg-white border ${style.border} rounded-2xl p-5 shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="text-xl mt-0.5">{style.dot}</span>
          <div className="flex-1">
            <div className="font-black text-gray-900">
              {student?.name} {student ? `— Grade ${student.grade}` : ''}
            </div>
            <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <a
                href={`https://wa.me/?text=${whatsappMsg(student, alert.message)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onSent}
                className="flex items-center gap-1.5 text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-green-600 transition"
              >
                <Share2 className="w-3 h-3" /> {sentAt ? 'Send Again' : 'Send Parent WhatsApp'}
              </a>
              {sentAt && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                  <CheckCircle2 className="w-3 h-3" />
                  You sent this at {new Date(sentAt).toLocaleTimeString('en-KE', { hour: 'numeric', minute: '2-digit' })}
                </span>
              )}
              <a
                href="/chat"
                className="flex items-center gap-1.5 text-xs bg-teal-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-teal-700 transition"
              >
                <Compass className="w-3 h-3" /> Open Compass
              </a>
              <button
                onClick={() => onResolve(alert.id)}
                disabled={resolving === alert.id}
                className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg font-bold hover:bg-gray-50 transition disabled:opacity-60"
              >
                {resolving === alert.id
                  ? <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                  : <CheckCircle2 className="w-3 h-3" />
                }
                Mark Resolved
              </button>
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-400">
          {new Date(alert.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
        </div>
      </div>
    </div>
  )
}
