#!/usr/bin/env node
// scripts/check-supabase-advisors.mjs
// Database security gate. Fetches the Supabase security advisor for the
// production project and blocks on any WARN/ERROR finding (missing RLS,
// anon-callable SECURITY DEFINER functions, auth settings, …) that isn't a
// reviewed, unexpired entry in docs/security/accepted-risks.json → 'database'.
// Run nightly by .github/workflows/security.yml — it catches a migration that
// weakened the database, which no code scanner can see.
// Policy: scripts/security/db-advisor-rules.mjs.
//
// Source (one of):
//   --input <file.json>   a saved advisor response (e.g. from the Supabase MCP
//                         get_advisors tool) — for local runs, no token needed
//   SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF env — Management API
//                         GET /v1/projects/{ref}/advisors/security (experimental
//                         endpoint: an unexpected response FAILS, never passes)
//
// Without either, it exits 0 with a visible GitHub warning annotation so the
// nightly workflow shows the gate is not yet configured, rather than failing
// every night before the founder has added the token.
//
// Usage: node scripts/check-supabase-advisors.mjs [--input file.json]

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluateAdvisors } from './security/db-advisor-rules.mjs'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const REGISTER_PATH = join(ROOT, 'docs', 'security', 'accepted-risks.json')

async function loadResponse() {
  const inputIdx = process.argv.indexOf('--input')
  if (inputIdx !== -1) return JSON.parse(readFileSync(process.argv[inputIdx + 1], 'utf8'))

  const token = process.env.SUPABASE_ACCESS_TOKEN
  const ref = process.env.SUPABASE_PROJECT_REF
  if (!token || !ref) return null

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/advisors/security`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    console.error(`❌ Supabase advisor request failed: HTTP ${res.status} ${(await res.text()).slice(0, 500)}`)
    process.exit(1)
  }
  return res.json()
}

const response = await loadResponse()
if (response === null) {
  console.log('::warning title=Supabase advisor gate not configured::Set the SUPABASE_ACCESS_TOKEN secret (and SUPABASE_PROJECT_REF) to enable the nightly database security check. See docs/security/README.md.')
  process.exit(0)
}

const accepted = JSON.parse(readFileSync(REGISTER_PATH, 'utf8')).database
const today = new Date().toISOString().slice(0, 10)
const { blocking, warnings } = evaluateAdvisors({ response, accepted, today })

console.log('\nEduNexus Supabase Security Advisors\n' + '─'.repeat(70))
for (const w of warnings) console.log(`⚪  ${w.rule}  ${w.key}`)

if (blocking.length > 0) {
  for (const b of blocking) console.log(`❌  ${b.rule}  ${b.message}`)
  console.log('─'.repeat(70))
  console.log(`❌ Supabase advisor check FAILED — ${blocking.length} blocking finding(s).`)
  console.log('   Fix with a migration, or — only after reviewing the impact — add a dated')
  console.log("   entry to docs/security/accepted-risks.json → 'database'.\n")
  process.exit(1)
}

console.log('─'.repeat(70))
console.log('✅ Supabase advisor check passed\n')
