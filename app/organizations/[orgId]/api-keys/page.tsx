'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Key, Plus, Trash2, Copy, Check, Loader2,
  AlertTriangle, Shield,
} from 'lucide-react'
import { SandboxBadge } from '@/components/organizations/sandbox-badge'

type ApiKeyEnvironment = 'live' | 'sandbox'

type ApiKey = {
  id: string
  name: string
  description: string | null
  key_prefix: string
  scopes: string[]
  status: string
  environment: ApiKeyEnvironment
  last_used_at: string | null
  expires_at: string | null
  rate_limit_rpm: number
  created_at: string
}

export default function ApiKeysPage() {
  const params = useParams()
  const orgId  = params.orgId as string

  const [keys,    setKeys]    = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const [showCreate,  setShowCreate]  = useState(false)
  const [form,        setForm]        = useState({
    name:        '',
    description: '',
    scopes:      ['api:read'],
    environment: 'live' as ApiKeyEnvironment,
  })
  const [creating,   setCreating]   = useState(false)
  const [newRawKey,  setNewRawKey]  = useState<string | null>(null)
  const [copiedKey,  setCopiedKey]  = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/organizations/${orgId}/api-keys`)
      const data = await res.json()
      setKeys(data.api_keys ?? [])
    } catch {
      setError('Failed to load API keys')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { load() }, [load])

  async function createKey() {
    if (!form.name.trim()) return
    setCreating(true)
    try {
      const res = await fetch(`/api/organizations/${orgId}/api-keys`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setNewRawKey(data.raw_key)
      setShowCreate(false)
      setForm({ name: '', description: '', scopes: ['api:read'], environment: 'live' })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setCreating(false)
    }
  }

  async function revokeKey(id: string) {
    setRevokingId(id)
    try {
      await fetch(`/api/organizations/${orgId}/api-keys?key_id=${id}`, { method: 'DELETE' })
      setKeys(prev => prev.filter(k => k.id !== id))
    } finally {
      setRevokingId(null)
    }
  }

  function copyKey() {
    if (!newRawKey) return
    navigator.clipboard.writeText(newRawKey)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
    </div>
  )

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">API Keys</h1>
          <p className="text-white/50 text-sm mt-1">Authenticate your applications with the EduNexus API</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Key
        </button>
      </div>

      {/* Newly created key — show once */}
      {newRawKey && (
        <div className="mb-6 bg-teal-500/10 border border-teal-500/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <p className="text-white font-semibold text-sm">Copy your API key now — it won't be shown again</p>
          </div>
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-black/30 rounded-lg px-4 py-2.5 text-teal-300 text-sm font-mono break-all">
              {newRawKey}
            </code>
            <button onClick={copyKey} className="flex-shrink-0 bg-teal-500 hover:bg-teal-400 text-white px-3 py-2.5 rounded-lg transition-colors">
              {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <button onClick={() => setNewRawKey(null)} className="mt-3 text-xs text-white/40 hover:text-white/60 transition-colors">
            I've saved the key — dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
          <h2 className="text-white font-semibold text-sm">New API Key</h2>

          {/* Environment toggle */}
          <div>
            <label className="block text-white/50 text-xs mb-2">Environment</label>
            <div className="flex gap-2">
              {(['live', 'sandbox'] as ApiKeyEnvironment[]).map(env => (
                <button
                  key={env}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, environment: env }))}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.environment === env
                      ? env === 'sandbox'
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                        : 'bg-teal-500/20 border-teal-500/50 text-teal-300'
                      : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                  }`}
                >
                  {env === 'sandbox' && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                  {env === 'live'    && <span className="w-2 h-2 rounded-full bg-green-400" />}
                  {env.charAt(0).toUpperCase() + env.slice(1)}
                </button>
              ))}
            </div>
            {form.environment === 'sandbox' && (
              <p className="mt-2 text-xs text-amber-400/70">
                Sandbox keys have higher rate limits, no billing, and webhooks disabled.
              </p>
            )}
          </div>

          <div>
            <label className="block text-white/50 text-xs mb-1.5">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={form.environment === 'sandbox' ? 'e.g. Local Dev' : 'e.g. Production App'}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-teal-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-white/50 text-xs mb-1.5">Description (optional)</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What this key is used for"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-teal-500 transition-colors"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowCreate(false)}
              className="flex-1 bg-white/5 hover:bg-white/10 text-white/70 py-2.5 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={createKey}
              disabled={creating || !form.name.trim()}
              className="flex-1 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              {creating ? 'Creating…' : 'Create Key'}
            </button>
          </div>
        </div>
      )}

      {/* Keys list */}
      {keys.length === 0 && !showCreate ? (
        <div className="text-center py-16 border border-white/10 rounded-xl">
          <Key className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/50 text-sm">No API keys yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map(k => (
            <div
              key={k.id}
              className={`p-4 bg-white/5 border rounded-xl ${
                k.status !== 'active'
                  ? 'border-red-500/20 opacity-60'
                  : k.environment === 'sandbox'
                    ? 'border-amber-500/20'
                    : 'border-white/10'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    k.status !== 'active'
                      ? 'bg-red-500/20'
                      : k.environment === 'sandbox'
                        ? 'bg-amber-500/20'
                        : 'bg-teal-500/20'
                  }`}>
                    <Key className={`w-4 h-4 ${
                      k.status !== 'active'
                        ? 'text-red-400'
                        : k.environment === 'sandbox'
                          ? 'text-amber-400'
                          : 'text-teal-400'
                    }`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium text-sm">{k.name}</p>
                      {k.environment === 'sandbox' && <SandboxBadge />}
                    </div>
                    <code className="text-white/40 text-xs font-mono">{k.key_prefix}••••••••</code>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    k.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {k.status}
                  </span>
                  {k.status === 'active' && (
                    <button
                      onClick={() => revokeKey(k.id)}
                      disabled={revokingId === k.id}
                      className="text-white/30 hover:text-red-400 transition-colors"
                    >
                      {revokingId === k.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 mt-3 pl-12">
                <div className="flex items-center gap-1.5 text-xs text-white/40">
                  <Shield className="w-3 h-3" />
                  {k.scopes.join(', ')}
                </div>
                <span className="text-xs text-white/30">
                  {k.rate_limit_rpm} rpm
                </span>
                {k.last_used_at && (
                  <span className="text-xs text-white/30">
                    Last used: {new Date(k.last_used_at).toLocaleDateString('en-KE')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-4 text-red-400 text-sm">{error}</p>
      )}
    </div>
  )
}
