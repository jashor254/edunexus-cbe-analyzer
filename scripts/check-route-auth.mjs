#!/usr/bin/env node
// scripts/check-route-auth.mjs
// Route-level security gate, run by CI on every push/PR. Every route under
// app/api must either call a recognised auth guard, or be registered in
// scripts/security/route-auth-registry.json as public / delegated / reexport
// with a reason. Cron routes must use CRON_SECRET only; webhooks must verify a
// signature; no test/debug routes. Rules: scripts/security/route-auth-rules.mjs.
//
// There is no baseline: every rule is a hard blocker, because the registry
// already records each reviewed exception explicitly.
//
// Usage: node scripts/check-route-auth.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkRouteAuth } from './security/route-auth-rules.mjs'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const API_DIR = join(ROOT, 'app', 'api')
const REGISTRY_PATH = join(ROOT, 'scripts', 'security', 'route-auth-registry.json')

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (entry === 'route.ts') out.push(full)
  }
  return out
}

const routes = walk(API_DIR).map(file => ({
  key: relative(API_DIR, file).split(sep).join('/').replace(/\/route\.ts$/, ''),
  source: readFileSync(file, 'utf8'),
}))
const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')).routes
// Reviewed learner-ownership exceptions (rule: learner-ownership-unreviewed).
const OWNERSHIP_REGISTRY_PATH = join(ROOT, 'scripts', 'security', 'route-ownership-registry.json')
const ownershipRegistry = JSON.parse(readFileSync(OWNERSHIP_REGISTRY_PATH, 'utf8')).routes

const { violations, warnings } = checkRouteAuth({ routes, registry, ownershipRegistry })

console.log('\nEduNexus Route Auth Check\n' + '─'.repeat(70))
console.log(`${routes.length} routes scanned, ${Object.keys(registry).length} registered exceptions`)

for (const w of warnings) console.log(`⚪  ${w.rule}  app/api/${w.route} — ${w.message}`)

if (violations.length > 0) {
  for (const v of violations) console.log(`❌  ${v.rule}  app/api/${v.route} — ${v.message}`)
  console.log('─'.repeat(70))
  console.log(`❌ Route auth check FAILED — ${violations.length} violation(s)\n`)
  process.exit(1)
}

console.log('─'.repeat(70))
console.log('✅ Route auth check passed\n')
