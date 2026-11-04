#!/usr/bin/env node
// scripts/check-supabase-key-names.mjs
//
// Supabase disabled the legacy JWT keys (anon, service_role) on 2026-05-25. The
// only valid names are NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and
// SUPABASE_SECRET_KEY. This guard fails when a tracked source file reads or sets
// a RETIRED name, so the 2dd5c85 half-migration (proxy.ts kept reading the old
// name and answered 500 on every protected route without it) cannot recur.
//
// Allowed on purpose:
//   - lib/config/env.ts            parses the retired names ONLY to explain them
//   - scripts/check-standard-manifest.mjs   forbids credentials in the secret-free tier
//   - this file, markdown/docs     describe the retirement
//   - TEST_SUPABASE_SERVICE_ROLE_KEY   a separate, test-target-only variable
//   - `supabase status -o json` field names (SERVICE_ROLE_KEY / ANON_KEY), which
//     are the local CLI's own output keys, not environment variables we define.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export const RETIRED = [
  /(?<![A-Z_])NEXT_PUBLIC_SUPABASE_ANON_KEY\b/,
  /(?<![A-Z_])SUPABASE_SERVICE_ROLE_KEY\b/,
]

const ALLOW_FILES = new Set([
  'lib/config/env.ts',
  'lib/config/env.test.ts',
  'utils/supabase/service.test.ts',
  'utils/supabase/publishableKey.ts',
  'utils/supabase/publishableKey.test.ts',
  'scripts/check-standard-manifest.mjs',
  'scripts/check-supabase-key-names.mjs',
  'scripts/standard-tests.json',
])
const ALLOW_PREFIX = ['docs/', 'graphify-out/', 'node_modules/']
const SCAN = /\.(ts|tsx|js|mjs|cjs|json|sh|yml|yaml|toml|env|example)$/

export function findViolations(files, read = f => readFileSync(join(root, f), 'utf8')) {
  const out = []
  for (const f of files) {
    if (ALLOW_FILES.has(f) || ALLOW_PREFIX.some(p => f.startsWith(p)) || f.endsWith('.md') || !SCAN.test(f)) continue
    let text
    try { text = read(f) } catch { continue }
    text.split('\n').forEach((line, i) => {
      if (RETIRED.some(rx => rx.test(line))) out.push({ file: f, line: i + 1, text: line.trim().slice(0, 140) })
    })
  }
  return out
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean)
  const v = findViolations(files)
  if (v.length) {
    console.error(`FAIL: ${v.length} reference(s) to RETIRED Supabase key names (disabled 2026-05-25). Use NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY:`)
    for (const x of v.slice(0, 40)) console.error(`  ${x.file}:${x.line}  ${x.text}`)
    process.exit(1)
  }
  console.log(`Supabase key-name check passed: ${files.length} tracked files, no retired key names`)
}
