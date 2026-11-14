import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkDisposableDb, type DisposableDbInput } from './disposableDbGuard'

const good: DisposableDbInput = {
  container: 'supabase_db_pifp',
  optIn: 'yes',
  ci: undefined,
  apiUrl: 'http://127.0.0.1:5521',
  stackApiPort: '5521',
}

test('the throwaway pifp stack with explicit opt-in and matching API port is accepted', () => {
  assert.deepEqual(checkDisposableDb(good), { ok: true, stack: 'pifp' })
})

test('no opt-in, no default target', () => {
  assert.equal(checkDisposableDb({ ...good, optIn: undefined }).ok, false)
  assert.equal(checkDisposableDb({ ...good, optIn: 'true' }).ok, false)
  assert.equal(checkDisposableDb({ ...good, container: undefined }).ok, false)
  assert.equal(checkDisposableDb({ ...good, container: '' }).ok, false)
})

test('the development database is refused on a developer machine, with or without opt-in', () => {
  const dev = { ...good, container: 'supabase_db_edunexus', apiUrl: 'http://127.0.0.1:54321', stackApiPort: '54321' }
  const r = checkDisposableDb(dev)
  assert.equal(r.ok, false)
  assert.match(r.ok ? '' : r.reason, /development database/)
  assert.equal(checkDisposableDb({ ...dev, ci: 'false' }).ok, false)
})

test('the default stack is accepted only on a CI runner', () => {
  const dev = { ...good, container: 'supabase_db_edunexus', apiUrl: 'http://127.0.0.1:54321', stackApiPort: '54321' }
  assert.equal(checkDisposableDb({ ...dev, ci: 'true' }).ok, true)
})

test('unknown containers (including anything resembling production) are refused', () => {
  for (const c of ['supabase_db_prod', 'postgres', 'supabase_db_remote', 'edunexus-db']) {
    assert.equal(checkDisposableDb({ ...good, container: c }).ok, false, c)
  }
})

test('the app must talk to the same stack as the database container (the 2026-11-11 mix-up)', () => {
  // App on the throwaway stack (5521) but the SQL would go to a different stack's port.
  assert.equal(checkDisposableDb({ ...good, stackApiPort: '54321' }).ok, false)
  assert.equal(checkDisposableDb({ ...good, stackApiPort: undefined }).ok, false)
})

test('non-local or malformed API URLs are refused', () => {
  assert.equal(checkDisposableDb({ ...good, apiUrl: 'https://example.supabase.co' }).ok, false)
  assert.equal(checkDisposableDb({ ...good, apiUrl: undefined }).ok, false)
  assert.equal(checkDisposableDb({ ...good, apiUrl: 'not a url' }).ok, false)
})
