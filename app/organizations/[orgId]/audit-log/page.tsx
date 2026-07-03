'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { ScrollText, Loader2, ChevronDown, User, Calendar } from 'lucide-react'

type AuditEntry = {
  id: string
  actor_id: string | null
  actor_email: string | null
  action: string
  resource_type: string
  resource_id: string | null
  changes: Record<string, unknown> | null
  metadata: Record<string, unknown>
  ip_address: string | null
  created_at: string
}

const ACTION_COLOR: Record<string, string> = {
  create:        'bg-green-500/20 text-green-400',
  update:        'bg-blue-500/20 text-blue-400',
  delete:        'bg-red-500/20 text-red-400',
  invite:        'bg-purple-500/20 text-purple-400',
  accept:        'bg-teal-500/20 text-teal-400',
  revoke:        'bg-amber-500/20 text-amber-400',
  role_change:   'bg-indigo-500/20 text-indigo-400',
  login:         'bg-white/10 text-white/50',
}

function getColor(action: string): string {
  const key = Object.keys(ACTION_COLOR).find(k => action.toLowerCase().includes(k))
  return key ? ACTION_COLOR[key] : 'bg-white/10 text-white/50'
}

export default function AuditLogPage() {
  const params = useParams()
  const orgId  = params.orgId as string

  const [entries,   setEntries]   = useState<AuditEntry[]>([])
  const [loading,   setLoading]   = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page,      setPage]      = useState(0)
  const [hasMore,   setHasMore]   = useState(true)
  const [expanded,  setExpanded]  = useState<string | null>(null)

  const PAGE_SIZE = 25

  const load = useCallback(async (pageNum: number, append = false) => {
    if (append) setLoadingMore(true)
    else        setLoading(true)

    try {
      const res  = await fetch(`/api/organizations/${orgId}/audit-log?limit=${PAGE_SIZE}&offset=${pageNum * PAGE_SIZE}`)
      const data = await res.json()
      const rows: AuditEntry[] = data.entries ?? []
      setEntries(prev => append ? [...prev, ...rows] : rows)
      setHasMore(rows.length === PAGE_SIZE)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [orgId])

  useEffect(() => { load(0) }, [load])

  function loadMore() {
    const next = page + 1
    setPage(next)
    load(next, true)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
    </div>
  )

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        <p className="text-white/50 text-sm mt-1">All actions taken in this organization</p>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16 border border-white/10 rounded-xl">
          <ScrollText className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/50 text-sm">No audit entries yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(e => (
            <div key={e.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center gap-4 p-4 text-left"
                onClick={() => setExpanded(prev => prev === e.id ? null : e.id)}
              >
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${getColor(e.action)}`}>
                  {e.action}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {e.resource_type}
                    {e.resource_id && <span className="text-white/30 font-mono text-xs ml-2">{e.resource_id.slice(0, 8)}</span>}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-white/40 text-xs flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {e.actor_email ?? 'System'}
                    </span>
                    <span className="text-white/30 text-xs flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(e.created_at).toLocaleString('en-KE')}
                    </span>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-white/30 flex-shrink-0 transition-transform ${expanded === e.id ? 'rotate-180' : ''}`} />
              </button>

              {expanded === e.id && e.changes && (
                <div className="px-4 pb-4 border-t border-white/5">
                  <p className="text-white/40 text-xs mb-2 mt-3">Changes</p>
                  <pre className="text-xs text-white/60 bg-black/20 rounded-lg p-3 overflow-x-auto">
                    {JSON.stringify(e.changes, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white px-6 py-2.5 rounded-lg text-sm transition-all disabled:opacity-40 flex items-center gap-2 mx-auto"
          >
            {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
            Load more
          </button>
        </div>
      )}
    </div>
  )
}
