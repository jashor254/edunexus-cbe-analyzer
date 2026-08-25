// lib/academicClinic/orphanedClinicPageClosure.test.ts
//
// Phase 2.3 (Learner Report Architecture — orphaned legacy Clinic surface
// closure). app/academic-clinic/page.tsx was confirmed, across Phases
// 0/1/2/2.1/2.2, to have zero inbound navigation links — reachable only by a
// hand-typed or historically-bookmarked URL, and the only remaining
// production path whose on-page preview called the legacy, non-canonical
// generateSeniorGuidance()/client-side CareerEngine engine.
//
// This is a source-level architecture guard, not a Next.js runtime test —
// calling next/navigation's redirect() outside a real request context throws
// (it relies on a request-scoped digest mechanism), so this asserts the
// closure at the file-content level instead, matching the existing
// convention in careerConvergence.architecture.test.ts.
//
// Guard A — the page redirects to the canonical, nav-reachable equivalent
//           surface, not a dead end.
// Guard B — the page no longer imports the legacy report engine at all.
// Guard C — no production (non-test, non-comment) call site anywhere in the
//           repo still invokes generateSeniorGuidance() — the one function
//           this closure was specifically about eliminating the last live
//           caller of.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/academicClinic/orphanedClinicPageClosure.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))
function read(relPath: string): string {
  return readFileSync(`${REPO_ROOT}${relPath}`, 'utf8')
}

test('Guard A — app/academic-clinic/page.tsx redirects to the canonical, nav-reachable equivalent surface', () => {
  const source = read('app/academic-clinic/page.tsx')
  assert.match(source, /from\s+'next\/navigation'/)
  assert.match(source, /redirect\(\s*['"]\/dashboard\/clinic['"]\s*\)/,
    'must redirect to /dashboard/clinic, the nav-reachable canonical equivalent (student list -> "View Report" -> the same canonical report path Phase 2.1/2.2 already secured)')
})

test('Guard B — app/academic-clinic/page.tsx no longer imports the legacy report engine', () => {
  const source = read('app/academic-clinic/page.tsx')
  const codeLines = source.split('\n').filter(l => {
    const t = l.trim()
    return t.length > 0 && !t.startsWith('//') && !t.startsWith('*')
  })
  const code = codeLines.join('\n')
  assert.doesNotMatch(code, /from\s+'@\/lib\/academicClinic\/reportGenerator'/)
  assert.doesNotMatch(code, /generateSeniorGuidance/)
  assert.doesNotMatch(code, /generateReport\(/)
})

// Walks app/, lib/, components/ (excluding node_modules, .claude worktrees,
// and test files) looking for an actual CALL to generateSeniorGuidance(),
// as opposed to its own definition or a comment referencing it by name.
function findProductionCallers(dir: string, hits: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.claude' || entry === '.git' || entry === '.next') continue
    const full = `${dir}/${entry}`
    const stat = statSync(full)
    if (stat.isDirectory()) {
      findProductionCallers(full, hits)
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry) || entry.includes('.test.')) continue
    const source = readFileSync(full, 'utf8')
    const isDefinition = /export function generateSeniorGuidance/.test(source)
    if (isDefinition) continue
    for (const line of source.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue
      if (/generateSeniorGuidance\(/.test(line)) hits.push(full.replace(REPO_ROOT, ''))
    }
  }
  return hits
}

test('Guard C — zero production (non-test, non-comment) callers of generateSeniorGuidance() remain anywhere in app/, lib/, components/', () => {
  const hits: string[] = []
  for (const dir of ['app', 'lib', 'components']) {
    findProductionCallers(`${REPO_ROOT}${dir}`, hits)
  }
  assert.deepEqual(hits, [], `expected zero production callers, found: ${hits.join(', ')}`)
})
