import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/** Build a throwaway git repo of synthetic files. Secrets are assembled at runtime so this file never contains one. */
export function makeRepo(files) {
  const dir = mkdtempSync(join(tmpdir(), 'jb-fixture-'))
  execFileSync('git', ['init', '-q'], { cwd: dir })
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }
  execFileSync('git', ['add', '-A'], { cwd: dir })
  return dir
}

export function writeConfig(dir, overrides = {}) {
  const cfg = {
    version: 1,
    defaultPolicy: 'deny',
    targets: [{
      id: 'fixture', adapter: 'edunexus', kind: 'repository', path: '.', environment: 'isolated-test',
      allowedModes: ['passive'],
      authorisation: { approvedBy: 'test-suite', approvedAt: '2026-01-01', expiresAt: '2099-01-01', scope: 'synthetic fixture only' },
      ...overrides,
    }],
  }
  const p = join(dir, 'targets.json')
  writeFileSync(p, JSON.stringify(cfg))
  return p
}

// Synthetic secrets (not real): built by concatenation so source scanners stay quiet.
export const FAKE = {
  aws: 'AK' + 'IA' + 'ABCDEFGHIJKLMNOP',
  github: 'gh' + 'p_' + 'a'.repeat(36),
  paystack: 'sk_' + 'live_' + 'b'.repeat(24),
  paystackTest: 'sk_' + 'test_' + 'd'.repeat(24),
  supabase: 'sb_' + 'secret_' + 'c'.repeat(24),
  jwt: 'eyJ' + 'hbGciOiJIUzI1NiJ9' + '.eyJ' + 'zdWIiOiIxMjM0NTY3ODkwIn0' + '.' + 'abcdefghijklmnopqrstuvwxyz0123',
  privateKey: '-----BEGIN ' + 'RSA PRIVATE KEY-----',
  generic: 'Zq8vK2mX9pLw4RtY7bNc3Hs',
}

/** Distinctive tail of each fake, to catch partial leaks as well as whole ones. */
export const FAKE_TAILS = Object.values(FAKE).map((v) => v.slice(-12))

/** Build `NAME = "value"` at runtime so no assignment-shaped literal sits in source (keeps repo secret scanners quiet). */
export const assign = (name, value) => [name, ' = ', JSON.stringify(value)].join('')
