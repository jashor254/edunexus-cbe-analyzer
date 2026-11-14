import { execFileSync } from 'node:child_process'
import { GIT_HARDENING_ARGS, GIT_SAFE_ENV, FILTER_CONFIG_QUERY, filterNeutralisers } from './gitsafe.mjs'
import { readFileSync, realpathSync, statSync } from 'node:fs'
import { resolve, relative, isAbsolute, sep } from 'node:path'

// The ONLY subprocess capability a check gets: read-only git queries.
const GIT_READONLY = new Set(['ls-files', 'rev-parse', 'status'])

/**
 * Read-only view of a target. Checks receive this, never raw fs/child_process,
 * so the capability surface is auditable in one file. This narrows what a
 * well-behaved check can do by accident; it is NOT a sandbox (see docs/SAFETY.md).
 * @param {string} rootDir
 * @param {Record<string, any>} adapterConfig
 * @param {{ now?: Date, git?: (args:string[]) => string|null }} [opts]
 *   now: the run's clock (checks must not call Date.now(), so reports stay reproducible).
 *   git: replaces the host git binary (used inside the sandbox, where there is no git and no .git).
 */
export function createContext(rootDir, adapterConfig, opts = {}) {
  const root = resolve(rootDir)
  const realRoot = realpathSync(root)

  /**
   * Resolve a repo-relative path. Refuses: NUL bytes, absolute paths, `..` escapes,
   * and symlinks whose real target lies outside the root.
   * @returns {string|null} absolute path, or null if it does not exist
   */
  function safe(rel) {
    if (typeof rel !== 'string' || rel.length === 0) throw new Error('Path must be a non-empty string')
    if (rel.includes('\0')) throw new Error('Path contains a NUL byte')
    if (isAbsolute(rel)) throw new Error(`Absolute paths are not permitted: ${rel}`)
    const abs = resolve(root, rel)
    const lexical = relative(root, abs)
    if (lexical.startsWith('..') || isAbsolute(lexical)) throw new Error(`Path escapes target root: ${rel}`)
    let real
    try {
      real = realpathSync(abs)
    } catch {
      return null // does not exist (or dangling symlink): nothing to read
    }
    const back = relative(realRoot, real)
    if (back.startsWith('..') || isAbsolute(back)) throw new Error(`Symlink escapes target root: ${rel}`)
    return real
  }

  const api = {
    root,
    adapterConfig,
    exists: (rel) => safe(rel) !== null,
    /** @returns {number} size in bytes; 0 if missing or not a regular file */
    size(rel) {
      const abs = safe(rel)
      return abs && statSync(abs).isFile() ? statSync(abs).size : 0
    },
    /** @returns {string|null} null when missing or not a regular file (e.g. directory/submodule) */
    read(rel) {
      const abs = safe(rel)
      if (!abs || !statSync(abs).isFile()) return null
      return readFileSync(abs, 'utf8')
    },
    now: opts.now ?? new Date(),
    git(args) {
      if (!Array.isArray(args) || !GIT_READONLY.has(args[0])) throw new Error(`git subcommand not permitted: ${args?.[0]}`)
      if (typeof opts.git === 'function') return opts.git(args)
      const runGit = (a) => execFileSync('git', [...GIT_HARDENING_ARGS, ...a], { cwd: root, env: GIT_SAFE_ENV, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
      try {
        if (args[0] !== 'status') return runGit(args)
        // `status` can run a repo-configured filter.<name>.clean command. Blank every configured filter first;
        // if that is not possible, report "unknown" (null) rather than run it.
        let configured = ''
        try { configured = runGit(FILTER_CONFIG_QUERY) } catch { /* exit 1 = no filters configured */ }
        const neutral = filterNeutralisers(configured)
        return neutral === null ? null : runGit([...neutral, ...args])
      } catch {
        return null
      }
    },
    /** Tracked files (what is actually committed/staged), forward-slash paths. */
    trackedFiles() {
      const out = api.git(['ls-files', '-z'])
      return out ? out.split('\0').filter(Boolean).map((p) => p.split(sep).join('/')) : []
    },
  }
  return Object.freeze(api)
}
