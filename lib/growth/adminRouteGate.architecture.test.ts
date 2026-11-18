// Architecture guard: platform-admin routes must use requirePlatformAdmin(),
// never the CRM-membership gate requireGrowthUser(). Growth membership is not
// administrative authority (lib/growth/auth.ts). A new route under
// app/api/admin/ that reaches for requireGrowthUser fails here, and the set of routes on
// requirePlatformAdmin is pinned at ten so a silent downgrade of any of them is caught.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

function routeFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...routeFiles(p))
    else if (name === 'route.ts') out.push(p)
  }
  return out
}

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const routes = routeFiles('app/api/admin')

const usesPlatformAdmin = (file: string) => /requirePlatformAdmin\s*\(/.test(stripComments(readFileSync(file, 'utf8')))

test('exactly ten admin routes are gated by requirePlatformAdmin', () => {
  const gated = routes.filter(usesPlatformAdmin)
  assert.equal(gated.length, 10, `expected 10, found ${gated.length}: ${gated.join(', ')}`)
})

// Guard *presence* on every other admin route (email allow-list, profiles.role, ADMIN_SECRET)
// is enforced by scripts/check-route-auth.mjs; this file only pins the Growth-gate contract.
for (const file of routes) {
  test(`${file} does not use the CRM membership gate as administrative authority`, () => {
    const code = stripComments(readFileSync(file, 'utf8'))
    assert.doesNotMatch(code, /requireGrowthUser\s*\(/, 'use requirePlatformAdmin() — Growth membership is not admin authority')
  })
}
