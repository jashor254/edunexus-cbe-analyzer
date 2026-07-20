import { test } from 'node:test'
import assert from 'node:assert/strict'

// Minimal in-memory localStorage + window polyfill so this pure-logic
// module's guards (readJson/writeJson's `typeof window === 'undefined'`
// checks) exercise their real browser-storage path under node:test.
class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null }
  setItem(key: string, value: string) { this.store.set(key, value) }
  removeItem(key: string) { this.store.delete(key) }
}

;(globalThis as unknown as { window: { localStorage: MemoryStorage } }).window = { localStorage: new MemoryStorage() }

async function mod() {
  return import('./teacherWorkspaceMemory')
}

test('no context stored -> null', async () => {
  const { getLastWorkingContext } = await mod()
  assert.equal(getLastWorkingContext(), null)
})

test('stored context is returned when fresh', async () => {
  const { setLastWorkingContext, getLastWorkingContext, clearLastWorkingContext } = await mod()
  setLastWorkingContext({ kind: 'attendance', matchKey: 'attendance-c1', classId: 'c1', className: 'Grade 8 North', href: '/teacher/attendance' })
  const ctx = getLastWorkingContext()
  assert.equal(ctx?.classId, 'c1')
  assert.equal(ctx?.kind, 'attendance')
  clearLastWorkingContext()
})

test('context older than 24h is not surfaced', async () => {
  const { setLastWorkingContext, getLastWorkingContext, clearLastWorkingContext } = await mod()
  setLastWorkingContext({ kind: 'assessment', matchKey: 'assessment-a1', classId: 'c1', className: 'Grade 8 North', href: '/teacher/assessment' })
  const farFuture = new Date(Date.now() + 25 * 60 * 60 * 1000)
  assert.equal(getLastWorkingContext(farFuture), null)
  clearLastWorkingContext()
})

test('clearLastWorkingContext removes it', async () => {
  const { setLastWorkingContext, getLastWorkingContext, clearLastWorkingContext } = await mod()
  setLastWorkingContext({ kind: 'teaching', matchKey: 'teaching-s1-lp', classId: 'c1', className: 'Grade 8 North', href: '/teacher/lesson-plans' })
  clearLastWorkingContext()
  assert.equal(getLastWorkingContext(), null)
})

test('preferred class id round-trips per page key, independently', async () => {
  const { setPreferredClassId, getPreferredClassId } = await mod()
  assert.equal(getPreferredClassId('core-term'), null)
  setPreferredClassId('core-term', 'c1')
  setPreferredClassId('attendance', 'c2')
  assert.equal(getPreferredClassId('core-term'), 'c1')
  assert.equal(getPreferredClassId('attendance'), 'c2')
})
