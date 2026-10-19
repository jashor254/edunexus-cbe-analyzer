'use client'

// Mark Papers — quick-create a paper so the teacher can start marking
// immediately: class, title, subject, out of. Nothing else. The paper is a
// draft assignment learners never see. Class source mirrors the New
// Assignment form: a school teacher picks from their School → My Teaching
// assignments (class_subject_id); a solo teacher from their own classes
// (class_id). UI only — POST /api/teacher/paper-intelligence/papers.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera } from 'lucide-react'

type ClassOption = { key: string; label: string; subject: string; payload: { class_id: string } | { class_subject_id: string } }

// Mirrors GET /api/teacher/teaching-assignments (lib/core/teachingAssignments.ts).
type TeachingContext =
  | { kind: 'school'; assignments: Array<{ assignmentId: string; className: string; streamName: string | null; subjectName: string }> }
  | { kind: 'school_unassigned' | 'solo' }

async function loadClassOptions(): Promise<ClassOption[]> {
  const ctxRes = await fetch('/api/teacher/teaching-assignments')
  const ctx = (await ctxRes.json().catch(() => null))?.data as TeachingContext | undefined
  if (ctx?.kind === 'school') {
    return ctx.assignments.map(a => ({
      key: a.assignmentId,
      label: `${a.className}${a.streamName ? ` ${a.streamName}` : ''} · ${a.subjectName}`,
      subject: a.subjectName,
      payload: { class_subject_id: a.assignmentId },
    }))
  }
  const res = await fetch('/api/teacher/classes')
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.success) throw new Error(body?.error ?? 'Could not load your classes')
  return (body.data.classes as Array<{ id: string; name: string; grade: number; subject: string }>).map(c => ({
    key: c.id,
    label: `${c.name} · G${c.grade} · ${c.subject}`,
    subject: c.subject,
    payload: { class_id: c.id },
  }))
}

export default function QuickPaperForm() {
  const router = useRouter()
  const [options, setOptions] = useState<ClassOption[] | null>(null)
  const [classKey, setClassKey] = useState('')
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [maxScore, setMaxScore] = useState('50')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadClassOptions()
      .then(opts => {
        setOptions(opts)
        if (opts.length === 1) { setClassKey(opts[0].key); setSubject(opts[0].subject) }
      })
      .catch((e: unknown) => { setOptions([]); setError(e instanceof Error ? e.message : 'Could not load your classes') })
  }, [])

  function pickClass(key: string) {
    setClassKey(key)
    const opt = options?.find(o => o.key === key)
    if (opt) setSubject(opt.subject)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const opt = options?.find(o => o.key === classKey)
    const outOf = Number(maxScore)
    if (!opt) { setError('Choose the class this paper is for.'); return }
    if (!title.trim()) { setError('Give the paper a name, e.g. "Fractions test".'); return }
    if (!Number.isInteger(outOf) || outOf <= 0) { setError('"Marked out of" must be a whole number above 0.'); return }
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/teacher/paper-intelligence/papers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...opt.payload, title: title.trim(), subject: subject.trim() || opt.subject, max_score: outOf }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) { setError(body?.error ?? 'Could not create the paper — try again.'); return }
      router.push(`/teacher/assignments/${body.data.paperId}/paper-intelligence`)
    } finally {
      setBusy(false)
    }
  }

  if (options === null) {
    return <div className="text-sm text-gray-400 py-4">Loading your classes…</div>
  }
  if (options.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-2">
        {error ?? 'You have no class yet. Create a class first, then come back to mark its papers.'}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="text-xs font-bold text-gray-600">Class</span>
        <select value={classKey} onChange={e => pickClass(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white">
          <option value="">Choose a class…</option>
          {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="text-xs font-bold text-gray-600">Paper name</span>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Fractions test, Mid-Term Paper 1" className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-bold text-gray-600">Subject</span>
          <input value={subject} onChange={e => setSubject(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-gray-600">Marked out of</span>
          <input value={maxScore} onChange={e => setMaxScore(e.target.value)} inputMode="numeric" className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
        </label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-bold px-4 py-3 rounded-xl transition">
        <Camera className="w-4 h-4" /> {busy ? 'Creating…' : 'Start marking'}
      </button>
      <p className="text-xs text-gray-400">Learners never see this paper. You choose where the marks go — topical or a termly assessment — after marking.</p>
    </form>
  )
}
