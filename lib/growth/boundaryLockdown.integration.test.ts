// lib/growth/boundaryLockdown.integration.test.ts
//
// Data-API (PostgREST) regression for the Growth Engine boundary: no client role can
// create, change, delete or read Growth membership or CRM data, and the membership
// guard still holds if client grants are deliberately re-introduced.
//
// ISOLATED STACK ONLY. Needs a throwaway local Supabase stack (run with the env below);
// createTestServiceClient() refuses anything that resolves to the production project.
//
//   TEST_SUPABASE_URL=http://127.0.0.1:54621 TEST_SUPABASE_PROJECT_REF=local-docker \
//   TEST_SUPABASE_SERVICE_ROLE_KEY=<local secret key> \
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54621 \
//   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local publishable key> \
//   TEST_DB_CONTAINER=supabase_db_fi03 \
//   npx tsx --test lib/growth/boundaryLockdown.integration.test.ts
//
// All identities are synthetic (example.invalid-style addresses created and deleted by
// this file). Nothing here touches a hosted project.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createTestServiceClient } from '@/utils/supabase/test-service'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
const CONTAINER = process.env.TEST_DB_CONTAINER
const MARKER = 'synthetic-fi03-boundary'
const password = 'Synthetic-Test-Password-1!'
const svc = createTestServiceClient()

if (!CONTAINER || !/^supabase_db_[a-z0-9]+$/.test(CONTAINER) || CONTAINER === 'supabase_db_edunexus') {
  throw new Error('TEST_DB_CONTAINER must name a throwaway isolated stack container (not the dev stack)')
}

function psql(sql: string): string {
  return execFileSync('docker', ['exec', '-i', CONTAINER!, 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim()
}

// Cleanup must never change the baseline it found: only undo grants this file added, and only
// if the lockdown was already in place when the file started.
const LOCKED_DOWN = psql("select not has_table_privilege('authenticated','public.growth_users','INSERT')") === 't'
const userIds: string[] = []
let ordinary: { id: string; client: SupabaseClient }
let other: { id: string; client: SupabaseClient }
let founder: { id: string }
let anon: SupabaseClient
const schoolIds: string[] = []

async function mk(label: string): Promise<{ id: string; email: string }> {
  const email = `${MARKER}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw new Error(`setup ${label}: ${error?.message}`)
  userIds.push(data.user.id)
  return { id: data.user.id, email }
}
async function signedIn(email: string): Promise<SupabaseClient> {
  const c = createClient(URL_, PUBLISHABLE, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`sign-in ${email}: ${error.message}`)
  return c
}
const memberRow = async (id: string) => (await svc.from('growth_users').select('id, full_name').eq('id', id).maybeSingle()).data

before(async () => {
  anon = createClient(URL_, PUBLISHABLE, { auth: { persistSession: false, autoRefreshToken: false } })
  const o = await mk('ordinary'); ordinary = { id: o.id, client: await signedIn(o.email) }
  const t = await mk('other'); other = { id: t.id, client: await signedIn(t.email) }
  const f = await mk('founder'); founder = { id: f.id }
  const { error } = await svc.from('growth_users').insert({ id: f.id, full_name: 'Synthetic Founder' })
  if (error) throw new Error(`setup founder membership: ${error.message}`)
  const { data: s } = await svc.from('growth_schools').insert({ name: `${MARKER} school` }).select('id').single()
  schoolIds.push(s!.id)
})

after(async () => {
  // Always restore the lockdown, even if a test failed mid-way.
  try { psql(`drop policy if exists tmp_reopen on public.growth_users;` + (LOCKED_DOWN ? ` revoke all on public.growth_users from anon, authenticated;` : '')) } catch { /* best effort */ }
  for (const id of schoolIds) await svc.from('growth_schools').delete().eq('id', id)
  await svc.from('growth_users').delete().in('id', [...userIds])
  for (const id of userIds) await deleteAuthUserOrThrow(svc, id)
})

// ── anonymous ───────────────────────────────────────────────────────────────
test('anon cannot insert a growth_users row', async () => {
  const id = ordinary.id
  const { error } = await anon.from('growth_users').insert({ id, full_name: 'x' })
  assert.ok(error, 'insert must be rejected')
  assert.equal(await memberRow(id), null)
})
test('anon cannot read any Growth table', async () => {
  for (const t of ['growth_users', 'growth_schools', 'growth_contacts', 'growth_activities', 'growth_follow_ups']) {
    const { data, error } = await anon.from(t).select('*').limit(1)
    assert.ok(error || (data ?? []).length === 0, `${t} leaked to anon`)
    assert.ok(error, `${t}: expected an explicit permission error for anon`)
  }
})

// ── ordinary authenticated user ─────────────────────────────────────────────
test('authenticated user cannot create a membership (insert)', async () => {
  const { error } = await ordinary.client.from('growth_users').insert({ id: ordinary.id, full_name: 'test-member' })
  assert.ok(error, 'membership insert must be rejected')
  assert.equal(await memberRow(ordinary.id), null, 'no membership row may exist')
})
test('authenticated user cannot create membership via upsert', async () => {
  const { error } = await ordinary.client.from('growth_users').upsert({ id: ordinary.id, full_name: 'test-member' })
  assert.ok(error)
  assert.equal(await memberRow(ordinary.id), null)
})
test('authenticated user cannot create membership for a different user (insert with another id)', async () => {
  const { error } = await ordinary.client.from('growth_users').insert({ id: other.id, full_name: 'test-member-2' })
  assert.ok(error)
  assert.equal(await memberRow(other.id), null)
})
test('authenticated user cannot modify or delete the existing founder membership', async () => {
  const upd = await ordinary.client.from('growth_users').update({ full_name: 'changed' }).eq('id', founder.id)
  const del = await ordinary.client.from('growth_users').delete().eq('id', founder.id)
  void upd; void del // outcome (error vs zero rows) is irrelevant; the unchanged row below is the assertion
  const row = await memberRow(founder.id)
  assert.ok(row, 'founder membership must still exist')
  assert.equal(row!.full_name, 'Synthetic Founder', 'founder membership must be unchanged')
})
test('authenticated user cannot read Growth tables or call the membership predicate', async () => {
  for (const t of ['growth_users', 'growth_schools', 'growth_contacts', 'growth_activities', 'growth_follow_ups']) {
    const { data, error } = await ordinary.client.from(t).select('*').limit(1)
    assert.ok(error, `${t}: expected a permission error, got ${JSON.stringify(data)}`)
  }
  const rpc = await ordinary.client.rpc('is_growth_user')
  assert.ok(rpc.error, 'is_growth_user() must not be callable by clients')
})
test('authenticated user cannot write CRM tables', async () => {
  const a = await ordinary.client.from('growth_schools').insert({ name: 'x' })
  const b = await ordinary.client.from('growth_contacts').insert({ school_id: schoolIds[0], full_name: 'x' })
  const c = await ordinary.client.from('growth_activities').insert({ school_id: schoolIds[0], type: 'called' })
  const d = await ordinary.client.from('growth_follow_ups').insert({ school_id: schoolIds[0], task: 'x', due_date: '2030-01-01' })
  for (const r of [a, b, c, d]) assert.ok(r.error, 'CRM write must be rejected')
})

// ── existing founder and service role ───────────────────────────────────────
test('existing founder membership is intact and service role keeps full operational access', async () => {
  assert.ok(await memberRow(founder.id))
  const p = await mk('provisioned')
  const ins = await svc.from('growth_users').insert({ id: p.id, full_name: 'Provisioned' })
  assert.equal(ins.error, null, 'service role must still provision membership')
  const upd = await svc.from('growth_users').update({ full_name: 'Renamed' }).eq('id', p.id)
  assert.equal(upd.error, null, 'service role must still update membership')
  const del = await svc.from('growth_users').delete().eq('id', p.id)
  assert.equal(del.error, null, 'service role must still delete membership')
})
test('legitimate Growth CRM workflow through the service-role path still works end to end', async () => {
  const { data: school, error: e1 } = await svc.from('growth_schools').insert({ name: `${MARKER} wf` }).select('id').single()
  assert.equal(e1, null); schoolIds.push(school!.id)
  assert.equal((await svc.from('growth_contacts').insert({ school_id: school!.id, full_name: 'Synthetic Contact' })).error, null)
  assert.equal((await svc.from('growth_activities').insert({ school_id: school!.id, type: 'called', created_by: founder.id })).error, null)
  assert.equal((await svc.from('growth_follow_ups').insert({ school_id: school!.id, task: 't', due_date: '2030-01-01' })).error, null)
  const { data } = await svc.from('growth_schools').select('id, name').eq('id', school!.id).single()
  assert.equal(data!.name, `${MARKER} wf`)
})

// ── indirect membership paths (catalog) ─────────────────────────────────────
test('no client-executable SECURITY DEFINER function can create or alter growth_users', () => {
  const rows = psql(`
    select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and (has_function_privilege('authenticated', p.oid, 'EXECUTE') or has_function_privilege('anon', p.oid, 'EXECUTE'))
      and p.prosrc ~* 'growth_users|is_growth_user'`)
  assert.equal(rows, '', `unexpected client-callable definer functions: ${rows}`)
})
test('only the lockdown trigger function and the server-only predicate reference growth_users', () => {
  const rows = psql(`select string_agg(p.proname, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname='public' and p.prosrc ~* 'growth_users'`)
  assert.equal(rows, 'growth_users_server_only,is_growth_user')
})
test('no view or foreign table exposes Growth data to client roles', () => {
  const rows = psql(`select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('v','m','f') and pg_get_viewdef(c.oid) ~* 'growth_' `)
  assert.equal(rows, '0')
})
test('client roles hold no privilege on any Growth table or the predicate', () => {
  const rows = psql(`
    select count(*) from (values ('growth_users'),('growth_schools'),('growth_contacts'),('growth_activities'),('growth_follow_ups')) t(n),
         (values ('anon'),('authenticated')) r(role)
    where has_table_privilege(r.role, 'public.'||t.n, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       or has_any_column_privilege(r.role, 'public.'||t.n, 'SELECT,INSERT,UPDATE,REFERENCES')`)
  assert.equal(rows, '0')
  assert.equal(psql(`select has_function_privilege('authenticated','public.is_growth_user()','EXECUTE')`), 'f')
  assert.equal(psql(`select has_function_privilege('anon','public.is_growth_user()','EXECUTE')`), 'f')
})

// ── deliberately re-introduced client grants (defence in depth) ─────────────
test('membership is STILL not self-service if grants and a permissive policy are deliberately re-introduced', async () => {
  psql(`grant all on public.growth_users to anon, authenticated; create policy tmp_reopen on public.growth_users for all using (true) with check (true);`)
  try {
    const ins = await ordinary.client.from('growth_users').insert({ id: ordinary.id, full_name: 'test-member' })
    assert.ok(ins.error, 'trigger must reject the insert')
    assert.match(ins.error!.message, /only be provisioned by the server|permission denied|row-level security/i)
    assert.equal(await memberRow(ordinary.id), null)
    const upd = await ordinary.client.from('growth_users').update({ full_name: 'changed' }).eq('id', founder.id)
    assert.ok(upd.error, 'trigger must reject the update')
    const del = await ordinary.client.from('growth_users').delete().eq('id', founder.id)
    assert.ok(del.error, 'trigger must reject the delete')
    const anonIns = await anon.from('growth_users').insert({ id: other.id, full_name: 'x' })
    assert.ok(anonIns.error)
    const row = await memberRow(founder.id)
    assert.equal(row?.full_name, 'Synthetic Founder')
    // and the server path is unaffected while the hole is "open"
    const p = await mk('provisioned-2')
    assert.equal((await svc.from('growth_users').insert({ id: p.id, full_name: 'ok' })).error, null)
    await svc.from('growth_users').delete().eq('id', p.id)
  } finally {
    psql(`drop policy if exists tmp_reopen on public.growth_users;` + (LOCKED_DOWN ? ` revoke all on public.growth_users from anon, authenticated;` : ''))
  }
})
