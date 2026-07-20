// lib/config/teacherWorkspaceMemory.ts
//
// PRP-4 (Teacher Continuity & Session Recovery) — the one place the Teacher
// Workspace remembers anything across a browser refresh or a return visit.
// Everything stored here is navigation/selection context or a UI
// preference, never educational data: no marks, no scores, no report
// comments, no student names beyond a class label (which is not
// confidential — the same class name already appears in the nav).
//
// Storage is localStorage (survives a refresh/close, per-device) — this is
// deliberately NOT a sync mechanism (Forbidden: no offline sync, no
// background sync). It is read once on mount and cross-checked against
// real server data before ever being shown to a teacher (see
// TodayAtAGlance's use of getLastWorkingContext) — nothing here is ever
// trusted as true on its own, only as a hint of where to look.

const KEY_PREFIX = 'edunexus_teacher_workspace'

function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be full or disabled (private browsing) — losing a
    // convenience hint is never worth surfacing an error to the teacher.
  }
}

export type WorkingContextKind = 'attendance' | 'assessment' | 'teaching' | 'core-term'

export type LastWorkingContext = {
  kind: WorkingContextKind
  /** A stable identifier matching one of the Next Action Engine's fact keys, so it can be cross-checked against live data, never trusted alone. */
  matchKey: string
  classId: string
  className: string
  href: string
  /** ISO timestamp — used only to age out very old context, never to prove anything happened. */
  at: string
}

const LAST_WORKING_CONTEXT_KEY = `${KEY_PREFIX}_last_context`

// Context older than this is never surfaced — a "continue" prompt from
// three days ago is more likely to confuse than help (PRP-1's "never
// fabricate" principle applied to staleness, not just existence).
const MAX_CONTEXT_AGE_MS = 24 * 60 * 60 * 1000

export function setLastWorkingContext(ctx: Omit<LastWorkingContext, 'at'>): void {
  writeJson(LAST_WORKING_CONTEXT_KEY, { ...ctx, at: new Date().toISOString() })
}

export function getLastWorkingContext(now: Date = new Date()): LastWorkingContext | null {
  const ctx = readJson<LastWorkingContext>(LAST_WORKING_CONTEXT_KEY)
  if (!ctx) return null
  const ageMs = now.getTime() - new Date(ctx.at).getTime()
  if (ageMs < 0 || ageMs > MAX_CONTEXT_AGE_MS) return null
  return ctx
}

export function clearLastWorkingContext(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(LAST_WORKING_CONTEXT_KEY)
}

// A per-page "preferred class" — Phase 1's audit found /teacher/core-term
// resets its class picker on every visit even though a teacher usually
// works one class at a time across several visits in the same week. This
// stores only the class id/name, never anything about that class's data.
function preferredClassKey(pageKey: string): string {
  return `${KEY_PREFIX}_preferred_class_${pageKey}`
}

export function setPreferredClassId(pageKey: string, classId: string): void {
  writeJson(preferredClassKey(pageKey), classId)
}

export function getPreferredClassId(pageKey: string): string | null {
  return readJson<string>(preferredClassKey(pageKey))
}
