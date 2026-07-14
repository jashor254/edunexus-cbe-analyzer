#!/usr/bin/env node
// scripts/check-architecture.mjs
// Enforces the architecture rules in CLAUDE.md that tsc/eslint can't see on
// their own — direct DB client construction, unsafe Postgrest chaining,
// console.log in production code, select('*'). Run by CI on every PR.
//
// Legacy debt: some rules already have pre-existing violations that are out
// of scope for the PR introducing this check. Those rules compare against a
// checked-in baseline count (scripts/architecture-baseline.json) and only
// fail when the count goes UP — so this gate stops new violations from
// landing without requiring a full-codebase fix-up first. Rules with a
// baseline of 0 are hard blockers: any match fails the build.
//
// Usage: node scripts/check-architecture.mjs [--update-baseline]

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdirSync, statSync } from 'node:fs'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const BASELINE_PATH = join(ROOT, 'scripts', 'architecture-baseline.json')
const UPDATE_BASELINE = process.argv.includes('--update-baseline')

// Directories that make up the deployed app — scripts/ is CLI tooling and is
// intentionally exempt (direct clients, console output, and one-off queries
// are normal there).
const SCAN_DIRS = ['app', 'lib', 'components', 'utils', 'proxy.ts']
const EXT = new Set(['.ts', '.tsx'])
const IGNORE_DIRS = new Set(['node_modules', '.next', '.git', '.claude'])

// Files that are allowed to construct a Supabase client directly — the
// factories themselves, and Next.js middleware (proxy.ts), which per
// Supabase's own SSR integration guide cannot reuse the shared server helper.
const APPROVED_CLIENT_FILES = [
  'utils/supabase/client.ts',
  'utils/supabase/server.ts',
  'utils/supabase/service.ts',
  'utils/supabase/middleware.ts',
  'proxy.ts',
]

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (EXT.has(extname(entry))) out.push(full)
  }
  return out
}

function listFiles() {
  const files = []
  for (const target of SCAN_DIRS) {
    const full = join(ROOT, target)
    if (!existsSync(full)) continue
    if (statSync(full).isDirectory()) walk(full, files)
    else files.push(full)
  }
  return files
}

function stripComments(src) {
  // Good enough for regex scanning: blank out // line comments and /* */ blocks
  // without disturbing line numbers (so reported line numbers stay accurate).
  return src
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, (m, p1) => p1 + ''.padEnd(m.length - p1.length, ' '))
}

// ── Rule 1: direct Supabase client construction outside approved factories ───
function checkDirectClientImports(files) {
  const violations = []
  for (const file of files) {
    const rel = relative(ROOT, file)
    if (APPROVED_CLIENT_FILES.some(a => rel.endsWith(a))) continue

    const raw = readFileSync(file, 'utf8')
    const src = stripComments(raw)
    const lines = src.split('\n')

    lines.forEach((line, i) => {
      // Only runtime imports — `import type { X } from '@supabase/...'` is fine.
      const isRuntimeImport = /^\s*import\s*\{[^}]*\}\s*from\s*['"]@supabase\/(supabase-js|ssr)['"]/.test(line)
        && !/^\s*import\s+type\b/.test(line)
      if (isRuntimeImport) {
        violations.push({ file: rel, line: i + 1, text: line.trim() })
      }
    })
  }
  return violations
}

// ── Rule 2: createServiceClient() outside lib/repositories (warn-only) ───────
function checkServiceClientOutsideRepos(files) {
  const violations = []
  for (const file of files) {
    const rel = relative(ROOT, file)
    if (rel.startsWith('lib/repositories/')) continue
    if (rel.includes('auth') && rel.includes('admin')) continue // auth.admin exception

    const raw = readFileSync(file, 'utf8')
    const src = stripComments(raw)
    const lines = src.split('\n')

    lines.forEach((line, i) => {
      if (/createServiceClient\s*\(/.test(line)) {
        violations.push({ file: rel, line: i + 1, text: line.trim() })
      }
    })
  }
  return violations
}

// ── Rule 3: .catch() chained directly on a Postgrest builder ─────────────────
// Postgrest query builders are thenable but not real Promises — `.catch()`
// only works after `.then()` has produced a real Promise, or inside try/catch
// on an awaited call. Heuristic: for each `.catch(`, look back to the start
// of its statement; if that span contains `.from(` or `.rpc(` and does NOT
// contain `.then(`, flag it.
function checkPostgrestCatch(files) {
  const violations = []
  for (const file of files) {
    const raw = readFileSync(file, 'utf8')
    const src = stripComments(raw)

    const lineStarts = [0]
    for (let i = 0; i < src.length; i++) if (src[i] === '\n') lineStarts.push(i + 1)
    const lineOf = idx => lineStarts.filter(s => s <= idx).length

    const catchRe = /\.catch\(/g
    let m
    while ((m = catchRe.exec(src))) {
      const dotIdx = m.index // index of the '.' in '.catch('

      // Walk backward through the method chain, one `.method(...)` hop at a
      // time, by balancing parens. Stops at the first call that isn't
      // preceded by a '.' — that's the root of the expression (e.g. a bare
      // function call like `sendWelcomeMessage(...)`, or a variable like `db`).
      let cursor = dotIdx
      let sawFromOrRpc = false
      let sawThen = false
      let safety = 0

      while (safety++ < 50) {
        let j = cursor - 1
        while (j >= 0 && /\s/.test(src[j])) j--
        if (src[j] !== ')') break // chain doesn't extend further back

        let depth = 1
        let k = j - 1
        while (k >= 0 && depth > 0) {
          if (src[k] === ')') depth++
          else if (src[k] === '(') depth--
          k--
        }
        const openParenIdx = k + 1

        let nameStart = openParenIdx
        while (nameStart > 0 && /[A-Za-z0-9_$]/.test(src[nameStart - 1])) nameStart--
        const methodName = src.slice(nameStart, openParenIdx)

        if (methodName === 'then') sawThen = true
        if (methodName === 'from' || methodName === 'rpc') sawFromOrRpc = true

        if (src[nameStart - 1] === '.') {
          cursor = nameStart - 1 // hop back over the '.' and keep walking
        } else {
          break // this call is the chain's root — stop
        }
      }

      if (sawFromOrRpc && !sawThen) {
        violations.push({ file: relative(ROOT, file), line: lineOf(dotIdx), text: src.slice(dotIdx, dotIdx + 40).split('\n')[0].trim() })
      }
    }
  }
  return violations
}

// ── Rule 4: console.log in production code ───────────────────────────────────
function checkConsoleLog(files) {
  const violations = []
  for (const file of files) {
    const raw = readFileSync(file, 'utf8')
    const src = stripComments(raw)
    const lines = src.split('\n')
    lines.forEach((line, i) => {
      if (/console\.log\(/.test(line)) {
        violations.push({ file: relative(ROOT, file), line: i + 1, text: line.trim() })
      }
    })
  }
  return violations
}

// ── Rule 5: select('*') ───────────────────────────────────────────────────────
function checkSelectStar(files) {
  const violations = []
  for (const file of files) {
    const raw = readFileSync(file, 'utf8')
    const src = stripComments(raw)
    const lines = src.split('\n')
    lines.forEach((line, i) => {
      if (/\.select\(\s*['"]\*['"]\s*\)/.test(line)) {
        violations.push({ file: relative(ROOT, file), line: i + 1, text: line.trim() })
      }
    })
  }
  return violations
}

// ── Runner ────────────────────────────────────────────────────────────────────

const RULES = [
  { key: 'directClientImports',       label: 'Direct Supabase client imports outside approved factories', blocking: true,  check: checkDirectClientImports },
  { key: 'serviceClientOutsideRepos', label: 'createServiceClient() used outside lib/repositories',        blocking: false, check: checkServiceClientOutsideRepos },
  { key: 'postgrestCatch',            label: '.catch() chained directly on a Postgrest builder',           blocking: true,  check: checkPostgrestCatch },
  { key: 'consoleLog',                label: 'console.log in production code',                             blocking: true,  check: checkConsoleLog },
  { key: 'selectStar',                label: "select('*') usage",                                          blocking: true,  check: checkSelectStar },
]

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return {}
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
}

function main() {
  const files = listFiles()
  const baseline = loadBaseline()
  const nextBaseline = {}
  let failed = false

  console.log('\nEduNexus Architecture Check\n' + '─'.repeat(70))

  for (const rule of RULES) {
    const violations = rule.check(files)
    const count = violations.length
    nextBaseline[rule.key] = count

    if (!rule.blocking) {
      const marker = count > 0 ? '⚪' : '✅'
      console.log(`${marker}  ${rule.label}: ${count} (warn-only, never blocks)`)
      if (count > 0) {
        for (const v of violations.slice(0, 10)) console.log(`     ${v.file}:${v.line}`)
        if (count > 10) console.log(`     … and ${count - 10} more`)
      }
      continue
    }

    const allowed = baseline[rule.key] ?? 0
    const isNewViolation = count > allowed

    if (isNewViolation) {
      failed = true
      console.log(`❌  ${rule.label}: ${count} (baseline: ${allowed}) — NEW VIOLATIONS INTRODUCED`)
      for (const v of violations.slice(0, 20)) console.log(`     ${v.file}:${v.line}  ${v.text}`)
      if (count > 20) console.log(`     … and ${count - 20} more`)
    } else {
      console.log(`✅  ${rule.label}: ${count} (baseline: ${allowed})`)
    }
  }

  console.log('─'.repeat(70))

  if (UPDATE_BASELINE) {
    writeFileSync(BASELINE_PATH, JSON.stringify(nextBaseline, null, 2) + '\n')
    console.log(`Baseline updated → ${relative(ROOT, BASELINE_PATH)}`)
    process.exit(0)
  }

  if (failed) {
    console.log('❌ Architecture check FAILED — new violations were introduced.')
    console.log('   If a violation is pre-existing and out of scope for this PR, it should')
    console.log('   already be in the baseline. If you just fixed some, re-run with')
    console.log('   --update-baseline to lower the count — do not raise it to hide new debt.\n')
    process.exit(1)
  }

  console.log('✅ Architecture check passed\n')
  process.exit(0)
}

main()
