#!/usr/bin/env node
// scripts/install-git-hooks.mjs
// Points git at the versioned hooks in scripts/hooks/ (core.hooksPath), so
// the pre-commit secret scanner travels with the repo instead of living only
// in one machine's untracked .git/hooks/. Runs from `npm install` (prepare).
//
// Skips — loudly, never silently — where there is no git checkout to
// configure: Vercel builds from a tarball with no .git directory.
//
// Usage: node scripts/install-git-hooks.mjs

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const HOOKS_PATH = 'scripts/hooks'

if (!existsSync(join(ROOT, '.git'))) {
  console.log(`[install-git-hooks] no .git directory — skipping (expected on Vercel builds)`)
  process.exit(0)
}

const result = spawnSync('git', ['config', 'core.hooksPath', HOOKS_PATH], { cwd: ROOT, stdio: 'inherit' })
if (result.status !== 0) {
  console.error(`[install-git-hooks] failed to set core.hooksPath=${HOOKS_PATH} (exit ${result.status})`)
  process.exit(result.status ?? 1)
}

console.log(`[install-git-hooks] core.hooksPath=${HOOKS_PATH} — pre-commit secret scanner active`)
