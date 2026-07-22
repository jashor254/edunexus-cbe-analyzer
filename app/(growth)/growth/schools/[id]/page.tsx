'use client'

import { useEffect, useMemo, useState, use as usePromise } from 'react'
import type {
  GrowthSchool, GrowthContact, GrowthActivity, GrowthFollowUp,
  GrowthPipelineStage, GrowthContactRole,
} from '@/lib/growth/types'
import { GROWTH_PIPELINE_STAGES } from '@/lib/growth/types'
import { QUICK_ACTIONS } from '@/lib/growth/quickActions'
import type { ApiResponse } from '@/lib/api/response'
import type { ChannelStrategy, GeneratedDraft, MessageChannel, MessageTemplate, FollowUpSuggestion } from '@/lib/growth/messaging/types'
import { buildWhatsAppLink, buildSmsLink, buildTelLink, buildMailtoLink } from '@/lib/growth/messaging/links'

// Sprint PE-8.1 — UX polish only, over Sprint PE-8's Communication
// Workspace (lib/growth/messaging/*) and Sprint PE-7's Contact Workspace/
// one-click logging. No new persistence, no new API routes, no logic
// changes — every handler below calls the exact same endpoints PE-7/PE-8
// already built and tested. The goal: open a school, understand everything,
// choose a channel, personalize, send, log, move on — in under 2 minutes.

type CommunicationWorkspaceData = {
  strategy: ChannelStrategy
  suggestedTemplate: MessageTemplate
  templates: MessageTemplate[]
  draft: GeneratedDraft
  followUpSuggestion: FollowUpSuggestion | null
}

const CHANNEL_LABELS: Record<MessageChannel, string> = {
  whatsapp: 'WhatsApp', sms: 'SMS', email: 'Email', call: 'Call', visit: 'Visit',
}

const CHANNEL_ICON: Record<MessageChannel, string> = {
  whatsapp: '🟢', sms: '💬', email: '✉️', call: '☎️', visit: '📍',
}

// A channel's expected turnaround — same values Sprint PE-6's Today's
// Route already uses (lib/growth/targeting/route.ts), repeated here rather
// than imported to keep this page free of a service-layer import for a
// purely cosmetic number.
const CHANNEL_MINUTES: Record<MessageChannel, number> = { whatsapp: 2, sms: 2, email: 3, call: 5, visit: 20 }

const STAGE_LABELS: Record<string, string> = {
  research: 'Research', contacted: 'Contacted', discovery: 'Discovery',
  demo_scheduled: 'Demo Scheduled', demo_completed: 'Demo Completed',
  pilot_offered: 'Pilot Offered', pilot_running: 'Pilot Running',
  pilot_won: 'Pilot Won', deferred: 'Deferred', lost: 'Lost',
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  called: 'Call', visited: 'Visit', whatsapp: 'WhatsApp Sent', email: 'Email Sent',
  meeting: 'Meeting', demo: 'Demo', training: 'Training', support: 'Support',
}

const CONTACT_ROLES: GrowthContactRole[] = ['principal', 'deputy', 'dos', 'ict_teacher', 'other']

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const json = (await res.json()) as ApiResponse<T>
  if (!json.success || !json.data) throw new Error(json.error ?? `Failed to load ${url}`)
  return json.data
}

function relativeDay(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const dayMs = 24 * 60 * 60 * 1000
  const diffDays = Math.floor((new Date(today.toDateString()).getTime() - new Date(date.toDateString()).getTime()) / dayMs)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return date.toLocaleDateString(undefined, { weekday: 'long' })
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function SchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params)

  const [school, setSchool] = useState<GrowthSchool | null>(null)
  const [contacts, setContacts] = useState<GrowthContact[]>([])
  const [activities, setActivities] = useState<GrowthActivity[]>([])
  const [followUps, setFollowUps] = useState<GrowthFollowUp[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadAll = () => {
    getJson<{ school: GrowthSchool }>(`/api/growth/schools/${id}`).then((d) => setSchool(d.school)).catch((e) => setError(e.message))
    getJson<{ contacts: GrowthContact[] }>(`/api/growth/schools/${id}/contacts`).then((d) => setContacts(d.contacts)).catch((e) => setError(e.message))
    getJson<{ activities: GrowthActivity[] }>(`/api/growth/schools/${id}/activities`).then((d) => setActivities(d.activities)).catch((e) => setError(e.message))
    getJson<{ followUps: GrowthFollowUp[] }>(`/api/growth/schools/${id}/follow-ups`).then((d) => setFollowUps(d.followUps)).catch((e) => setError(e.message))
  }

  useEffect(loadAll, [id])

  async function changeStage(stage: GrowthPipelineStage) {
    const res = await fetch(`/api/growth/schools/${id}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    })
    const json = (await res.json()) as ApiResponse<{ school: GrowthSchool }>
    if (json.success && json.data) setSchool(json.data.school)
  }

  if (error) return <p className="p-6 text-red-600">{error}</p>
  if (!school) return <p className="p-6 text-neutral-500">Loading…</p>

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">{school.name}</h1>
        {school.county && <p className="mt-0.5 text-sm text-neutral-500">{school.county}{school.category ? ` · ${school.category}` : ''}</p>}
      </div>

      <SchoolSnapshot school={school} activities={activities} onChangeStage={changeStage} />
      <ContactCard school={school} />
      <MessageWorkspace schoolId={id} school={school} contacts={contacts} onLogged={loadAll} />
      <CommunicationTimeline schoolId={id} activities={activities} onLogged={loadAll} />
      <ContactsSection schoolId={id} contacts={contacts} onAdded={loadAll} />
      <FollowUpsSection schoolId={id} followUps={followUps} onChanged={loadAll} />
    </div>
  )
}

/**
 * Sprint PE-8.1 Part 6 — School Snapshot. Everything a founder needs to
 * know before saying a word: where this school is in the pipeline, when it
 * was last touched, how, how many times, and the three milestone flags.
 * All derived from data already loaded — no new query.
 */
function SchoolSnapshot({ school, activities, onChangeStage }: { school: GrowthSchool; activities: GrowthActivity[]; onChangeStage: (s: GrowthPipelineStage) => void }) {
  const stageIdx = GROWTH_PIPELINE_STAGES.indexOf(school.pipeline_stage)
  const discoveryDone = stageIdx >= GROWTH_PIPELINE_STAGES.indexOf('discovery') && school.pipeline_stage !== 'lost' && school.pipeline_stage !== 'deferred'
  const demoDone = stageIdx >= GROWTH_PIPELINE_STAGES.indexOf('demo_completed') && school.pipeline_stage !== 'lost' && school.pipeline_stage !== 'deferred'
  const pilotStage = ['pilot_offered', 'pilot_running', 'pilot_won'].includes(school.pipeline_stage)
  const lastActivity = activities[0] ?? null

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">School Snapshot</h2>
        <select
          value={school.pipeline_stage}
          onChange={(e) => onChangeStage(e.target.value as GrowthPipelineStage)}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium"
        >
          {GROWTH_PIPELINE_STAGES.map((s) => (
            <option key={s} value={s}>{STAGE_LABELS[s]}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Snapshot label="Last Contact" value={school.last_contact_at ? relativeDay(school.last_contact_at) : 'Never'} />
        <Snapshot label="Last Method" value={lastActivity ? ACTIVITY_TYPE_LABELS[lastActivity.type] ?? lastActivity.type : '—'} />
        <Snapshot label="Times Contacted" value={String(activities.length)} />
        <Snapshot label="Discovery Meeting" value={discoveryDone ? '✅ Yes' : '— Not yet'} />
        <Snapshot label="Demo Done" value={demoDone ? '✅ Yes' : '— Not yet'} />
        <Snapshot label="Pilot" value={pilotStage ? '✅ Yes' : '— Not yet'} />
      </div>
    </section>
  )
}

function Snapshot({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="text-base font-semibold text-neutral-900">{value}</p>
    </div>
  )
}

/**
 * Sprint PE-8.1 Part 1/9 — one obvious contact card, every field readable
 * in under 5 seconds, phone/WhatsApp/email/website/maps all clickable.
 */
function ContactCard({ school }: { school: GrowthSchool }) {
  const whatsappStatus: { label: string; tone: string } = school.whatsapp_number
    ? { label: 'Verified', tone: 'text-emerald-700' }
    : school.phone
      ? { label: 'Unknown', tone: 'text-amber-700' }
      : { label: 'Not Available', tone: 'text-neutral-400' }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">Contact Card</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ContactRow icon="☎️" label="Primary Phone" value={school.phone} href={school.phone ? `tel:${school.phone}` : undefined} />
        <ContactRow icon="🟢" label="WhatsApp" value={whatsappStatus.label} valueClassName={whatsappStatus.tone} href={school.whatsapp_number ? buildWhatsAppLink(school.whatsapp_number, '') : undefined} />
        <ContactRow icon="✉️" label="Email" value={school.email} href={school.email ? `mailto:${school.email}` : undefined} />
        <ContactRow icon="🌍" label="Website" value={school.website} href={school.website ?? undefined} />
        <ContactRow icon="📍" label="Location" value={school.google_maps_url ? 'Open Google Maps' : null} href={school.google_maps_url ?? undefined} />
        <ContactRow icon="⭐" label="Contact Quality" value={school.contact_quality} />
        <ContactRow icon="📊" label="Discovery Score" value={school.discovery_score !== null ? String(school.discovery_score) : null} />
      </div>
      {(school.selection_reason || school.existing_ict_activity || school.notes) && (
        <div className="mt-4 space-y-1.5 border-t border-neutral-100 pt-4 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Research Notes</p>
          {school.selection_reason && <p className="text-neutral-700"><span className="text-neutral-400">Why this school —</span> {school.selection_reason}</p>}
          {school.existing_ict_activity && <p className="text-neutral-700"><span className="text-neutral-400">Existing ICT activity —</span> {school.existing_ict_activity}</p>}
          {school.notes && <p className="text-neutral-700"><span className="text-neutral-400">Notes —</span> {school.notes}</p>}
        </div>
      )}
    </section>
  )
}

function ContactRow({ icon, label, value, href, valueClassName }: { icon: string; label: string; value: string | null; href?: string; valueClassName?: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-lg leading-none">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-neutral-400">{label}</p>
        {value ? (
          href ? (
            <a href={href} target="_blank" rel="noreferrer" className={`wrap-break-word text-base font-medium underline ${valueClassName ?? 'text-neutral-900'}`}>{value}</a>
          ) : (
            <p className={`wrap-break-word text-base font-medium ${valueClassName ?? 'text-neutral-900'}`}>{value}</p>
          )
        ) : (
          <p className="text-base text-neutral-300">Not Available</p>
        )}
      </div>
    </div>
  )
}

/**
 * Sprint PE-8.1 Parts 2-5 — the Recommended First Action, a clearer message
 * editor (labeled fields, character count, edit/preview toggle), and
 * professional, obvious action buttons. Every handler (openChannel,
 * copyDraft, markSent) is unchanged from Sprint PE-8 — this only changes
 * how they're presented.
 */
function MessageWorkspace({ schoolId, school, contacts, onLogged }: { schoolId: string; school: GrowthSchool; contacts: GrowthContact[]; onLogged: () => void }) {
  const [workspace, setWorkspace] = useState<CommunicationWorkspaceData | null>(null)
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [channel, setChannel] = useState<MessageChannel | null>(null)
  const [body, setBody] = useState('')
  const [subject, setSubject] = useState('')
  const [outcomeNote, setOutcomeNote] = useState('')
  const [logging, setLogging] = useState(false)
  const [copied, setCopied] = useState(false)
  const [preview, setPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const contact = contacts[0] ?? null

  useEffect(() => {
    const params = new URLSearchParams()
    if (templateId) params.set('templateId', templateId)
    if (channel) params.set('channel', channel)
    getJson<{ workspace: CommunicationWorkspaceData }>(`/api/growth/schools/${schoolId}/messages?${params.toString()}`)
      .then((d) => {
        setWorkspace(d.workspace)
        setTemplateId(d.workspace.draft.templateId)
        setChannel(d.workspace.draft.channel)
        setBody(d.workspace.draft.body)
        setSubject(d.workspace.draft.subject ?? '')
      })
      .catch((e) => setError(e.message))
  }, [schoolId, templateId, channel])

  if (error) return <section className="rounded-xl border border-neutral-200 bg-white p-5 text-sm text-red-600">{error}</section>
  if (!workspace) return <section className="rounded-xl border border-neutral-200 bg-white p-5 text-sm text-neutral-400">Preparing message…</section>

  const edited = body !== workspace.draft.body || subject !== (workspace.draft.subject ?? '')
  const recipientPhone = contact?.phone ?? school.whatsapp_number ?? school.phone
  const recipientEmail = contact?.email ?? school.email
  const activeChannel = channel ?? 'whatsapp'

  function openChannel() {
    if (channel === 'whatsapp' && recipientPhone) window.open(buildWhatsAppLink(recipientPhone, body), '_blank')
    else if (channel === 'sms' && recipientPhone) window.open(buildSmsLink(recipientPhone, body), '_blank')
    else if (channel === 'call' && recipientPhone) window.open(buildTelLink(recipientPhone), '_blank')
    else if (channel === 'email' && recipientEmail) window.open(buildMailtoLink(recipientEmail, subject || null, body), '_blank')
  }

  async function copyDraft() {
    await navigator.clipboard.writeText(subject ? `${subject}\n\n${body}` : body)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function markSent() {
    if (!channel || !templateId) return
    setLogging(true)
    try {
      await fetch(`/api/growth/schools/${schoolId}/messages/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: contact?.id ?? null,
          channel,
          templateId,
          edited,
          outcomeNote: outcomeNote || null,
        }),
      })
      setOutcomeNote('')
      onLogged()
    } finally {
      setLogging(false)
    }
  }

  const openLabel =
    activeChannel === 'whatsapp' ? '🟢 Open WhatsApp'
    : activeChannel === 'call' ? '☎ Call Now'
    : activeChannel === 'email' ? '✉ Open Email'
    : `Open ${CHANNEL_LABELS[activeChannel]}`

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Send a Message</h2>

      {/* Part 2 — Recommended First Action */}
      <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Recommended First Action</p>
        <p className="mt-1 text-lg font-bold text-neutral-900">{CHANNEL_ICON[workspace.strategy.channel]} {CHANNEL_LABELS[workspace.strategy.channel]}</p>
        <p className="mt-1 text-sm text-neutral-500">Reason</p>
        <ul className="mt-0.5 space-y-0.5 text-sm text-neutral-800">
          <li>• {workspace.strategy.reason}</li>
          <li>• {CHANNEL_LABELS[workspace.strategy.channel]} typically gets the fastest response.</li>
        </ul>
        <p className="mt-2 text-xs text-neutral-500">Estimated time: {CHANNEL_MINUTES[workspace.strategy.channel]} min.</p>
      </div>

      {/* Part 3 — editor */}
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Template</label>
          <select
            value={templateId ?? ''}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            {workspace.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Channel</label>
          <select
            value={channel ?? ''}
            onChange={(e) => setChannel(e.target.value as MessageChannel)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            {(['whatsapp', 'sms', 'email', 'call', 'visit'] as MessageChannel[]).map((c) => (
              <option key={c} value={c}>{CHANNEL_ICON[c]} {CHANNEL_LABELS[c]}</option>
            ))}
          </select>
        </div>
      </div>

      {workspace.draft.unresolvedVariables.length > 0 && (
        <p className="mb-2 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
          ⚠ Missing: {workspace.draft.unresolvedVariables.join(', ')} — fill these in below before sending.
        </p>
      )}

      {channel === 'email' && (
        <div className="mb-2">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      )}

      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Message</label>
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-400">{body.length} characters</span>
          <button onClick={() => setPreview((v) => !v)} className="text-xs font-medium text-violet-700 hover:underline">
            {preview ? 'Edit' : 'Preview'}
          </button>
        </div>
      </div>
      {preview ? (
        <div className="mb-3 min-h-24 whitespace-pre-wrap rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-800">
          {subject && <p className="mb-2 font-semibold">{subject}</p>}
          {body}
        </div>
      ) : (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={channel === 'call' ? 4 : 7}
          className="mb-3 w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm leading-relaxed"
        />
      )}

      {/* Part 4 — professional actions */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={openChannel} className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800">
          {openLabel}
        </button>
        <button onClick={copyDraft} className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
          {copied ? '✅ Copied' : '📋 Copy Message'}
        </button>
        <button
          onClick={markSent}
          disabled={logging}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          {logging ? '…' : '✅ Log as Sent'}
        </button>
      </div>
      <input
        placeholder="Outcome (optional)"
        value={outcomeNote}
        onChange={(e) => setOutcomeNote(e.target.value)}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />

      {workspace.followUpSuggestion && (
        <div className="mt-4">
          <FollowUpSuggestionBanner schoolId={schoolId} suggestion={workspace.followUpSuggestion} onAdded={onLogged} />
        </div>
      )}
    </section>
  )
}

/**
 * Sprint PE-8.1 Part 5 — "NEXT FOLLOW-UP" card. Suggests, never sends or
 * schedules a reminder itself — "Schedule Reminder" just creates a real
 * growth_follow_ups row (unchanged Sprint PE-8 behavior/endpoint), which the
 * founder still has to act on manually. No cron, no notification.
 */
function FollowUpSuggestionBanner({ schoolId, suggestion, onAdded }: { schoolId: string; suggestion: FollowUpSuggestion; onAdded: () => void }) {
  const [added, setAdded] = useState(false)

  async function addFollowUp() {
    await fetch(`/api/growth/schools/${schoolId}/follow-ups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: suggestion.task, dueDate: suggestion.dueDate, priority: suggestion.priority }),
    })
    setAdded(true)
    onAdded()
  }

  const dueLabel = suggestion.dueDate === new Date().toISOString().slice(0, 10) ? 'Due today' : `Due ${suggestion.dueDate}`

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Next Follow-up</p>
      <p className="mt-1 text-base font-bold text-neutral-900">📅 {dueLabel}</p>
      <p className="mt-1 text-sm text-neutral-700">{suggestion.task}</p>
      <p className="text-xs text-neutral-500">Reason — {suggestion.reason}</p>
      {!added ? (
        <button onClick={addFollowUp} className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
          Schedule Reminder
        </button>
      ) : (
        <p className="mt-3 text-sm font-medium text-emerald-700">✅ Reminder scheduled</p>
      )}
    </div>
  )
}

function ContactsSection({ schoolId, contacts, onAdded }: { schoolId: string; contacts: GrowthContact[]; onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<GrowthContactRole>('principal')
  const [phone, setPhone] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    await fetch(`/api/growth/schools/${schoolId}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, role, phone: phone || null }),
    })
    setFullName(''); setPhone(''); setOpen(false)
    onAdded()
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Contacts</h2>
        <button onClick={() => setOpen((v) => !v)} className="text-sm font-medium text-violet-700 hover:underline">
          {open ? 'Cancel' : '+ Add contact'}
        </button>
      </div>
      {open && (
        <form onSubmit={submit} className="mb-3 flex flex-wrap gap-2">
          <input required placeholder="Name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="min-w-32 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          <select value={role} onChange={(e) => setRole(e.target.value as GrowthContactRole)} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
            {CONTACT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="min-w-32 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          <button type="submit" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white">Add</button>
        </form>
      )}
      {contacts.length === 0 && <p className="text-sm text-neutral-400">No contacts recorded yet.</p>}
      <ul className="space-y-1.5">
        {contacts.map((c) => (
          <li key={c.id} className="text-sm text-neutral-700">
            <span className="font-medium">{c.full_name}</span>{c.role && <span className="ml-1 text-neutral-500">({c.role})</span>}
            {c.phone && <a href={`tel:${c.phone}`} className="ml-2 text-violet-700 underline">{c.phone}</a>}
          </li>
        ))}
      </ul>
    </section>
  )
}

function FollowUpsSection({ schoolId, followUps, onChanged }: { schoolId: string; followUps: GrowthFollowUp[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [task, setTask] = useState('')
  const [dueDate, setDueDate] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    await fetch(`/api/growth/schools/${schoolId}/follow-ups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, dueDate }),
    })
    setTask(''); setDueDate(''); setOpen(false)
    onChanged()
  }

  async function complete(id: string) {
    await fetch(`/api/growth/follow-ups/${id}/complete`, { method: 'PATCH' })
    onChanged()
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Follow-ups</h2>
        <button onClick={() => setOpen((v) => !v)} className="text-sm font-medium text-violet-700 hover:underline">
          {open ? 'Cancel' : '+ Add follow-up'}
        </button>
      </div>
      {open && (
        <form onSubmit={submit} className="mb-3 flex flex-wrap gap-2">
          <input required placeholder="What needs to happen" value={task} onChange={(e) => setTask(e.target.value)} className="min-w-40 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          <input required type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          <button type="submit" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white">Add</button>
        </form>
      )}
      {followUps.filter((f) => !f.completed).length === 0 && <p className="text-sm text-neutral-400">Nothing open.</p>}
      <ul className="space-y-1.5">
        {followUps.filter((f) => !f.completed).map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-2 text-sm text-neutral-700">
            <span>{f.task} <span className="text-neutral-500">— due {f.due_date}</span></span>
            <button onClick={() => complete(f.id)} className="shrink-0 text-sm font-medium text-emerald-700 hover:underline">Done</button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Sprint PE-8.1 Part 7 — Communication Timeline: newest first, grouped by
 * relative day, plus the same one-click quick-log buttons Sprint PE-7 built
 * (unchanged endpoint/logic) for logging an interaction that didn't go
 * through the message editor above.
 */
function CommunicationTimeline({ schoolId, activities, onLogged }: { schoolId: string; activities: GrowthActivity[]; onLogged: () => void }) {
  const [extraNotes, setExtraNotes] = useState('')
  const [gotReply, setGotReply] = useState(false)
  const [logging, setLogging] = useState<string | null>(null)

  async function logAction(actionKey: string) {
    setLogging(actionKey)
    try {
      await fetch(`/api/growth/schools/${schoolId}/quick-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionKey, extraNotes: extraNotes || null, gotReply }),
      })
      setExtraNotes('')
      setGotReply(false)
      onLogged()
    } finally {
      setLogging(null)
    }
  }

  const grouped = useMemo(() => {
    const groups: { label: string; items: GrowthActivity[] }[] = []
    for (const a of activities) {
      const label = relativeDay(a.occurred_at)
      const group = groups.find((g) => g.label === label)
      if (group) group.items.push(a)
      else groups.push({ label, items: [a] })
    }
    return groups
  }, [activities])

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Log an Interaction</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.key}
            onClick={() => logAction(action.key)}
            disabled={logging !== null}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
          >
            {logging === action.key ? '…' : action.label}
          </button>
        ))}
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <input
          placeholder="Optional note"
          value={extraNotes}
          onChange={(e) => setExtraNotes(e.target.value)}
          className="min-w-40 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <label className="flex shrink-0 items-center gap-1.5 text-sm text-neutral-600">
          <input type="checkbox" checked={gotReply} onChange={(e) => setGotReply(e.target.checked)} />
          They replied
        </label>
      </div>

      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Communication History</h3>
      {activities.length === 0 && <p className="text-sm text-neutral-400">No activity logged yet.</p>}
      <div className="space-y-4">
        {grouped.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">{group.label}</p>
            <ul className="space-y-2">
              {group.items.map((a) => (
                <li key={a.id} className="border-l-2 border-neutral-200 py-0.5 pl-3 text-sm">
                  <span className="font-medium text-neutral-900">{ACTIVITY_TYPE_LABELS[a.type] ?? a.type}</span>
                  <span className="ml-2 text-neutral-400">{new Date(a.occurred_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
                  {a.notes && <p className="text-neutral-600">{a.notes}</p>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
