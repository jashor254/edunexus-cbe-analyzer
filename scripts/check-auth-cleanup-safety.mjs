#!/usr/bin/env node
// scripts/check-auth-cleanup-safety.mjs
//
// Static guard for Phase H4A-FIX (docs/architecture — OPS-TEST-002).
// `@supabase/auth-js`'s admin.deleteUser() never rejects on a server-side
// or FK error — it always resolves, with the failure only visible in an
// unchecked `.error` field. A raw `db.auth.admin.deleteUser(...)` call in
// a test file's cleanup is therefore a false-assurance pattern: it looks
// like cleanup happened, but a leftover FK-blocked auth user is silently
// left behind. lib/testing/deleteAuthUserOrThrow.ts exists precisely to
// throw (and fail the test loudly) in that case.
//
// This script reports every direct `.auth.admin.deleteUser(` call found
// in *.test.ts files that is NOT the wrapper's own implementation. It does
// not auto-fix anything — converting a call site requires judgment about
// surrounding cleanup order (see deleteAuthUserOrThrow.ts's header).
//
// Usage: node scripts/check-auth-cleanup-safety.mjs
// Exit code 1 if any unsafe pattern is found, 0 otherwise.

import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const PATTERN = /\.auth\.admin\.deleteUser\(/

const files = execSync('git ls-files "*.test.ts"', { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  .split('\n')
  .filter(Boolean)

const hits = []

for (const file of files) {
  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n')
  lines.forEach((line, i) => {
    if (PATTERN.test(line)) {
      hits.push({ file, line: i + 1, text: line.trim() })
    }
  })
}

if (hits.length === 0) {
  console.log('OK: no unchecked .auth.admin.deleteUser( calls found in *.test.ts files')
  process.exit(0)
}

console.log(`UNSAFE: ${hits.length} unchecked .auth.admin.deleteUser( call(s) found`)
console.log('(use deleteAuthUserOrThrow from lib/testing/deleteAuthUserOrThrow.ts instead — it throws on failure so the test fails visibly, per OPS-TEST-002)')
console.log('')
for (const hit of hits) {
  console.log(`  ${hit.file}:${hit.line}  ${hit.text}`)
}
process.exit(1)
