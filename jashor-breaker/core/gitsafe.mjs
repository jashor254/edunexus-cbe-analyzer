// Pure helpers for running git against a repository whose own configuration is untrusted input.
// No process or filesystem access here: callers supply `git config` output and run git themselves.

/** Settings that make a git command ignore repo-configured executables or redirected state. */
export const GIT_HARDENING_ARGS = Object.freeze([
  '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', '-c', 'core.attributesFile=/dev/null',
  '-c', 'core.untrackedCache=false', '-c', 'protocol.allow=never',
])

/** Environment for git subprocesses: built, never inherited. No global/system config, no replace refs, no locks. */
export const GIT_SAFE_ENV = Object.freeze({
  PATH: '/usr/bin:/bin', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0',
  GIT_ATTR_NOSYSTEM: '1', GIT_NO_REPLACE_OBJECTS: '1', GIT_OPTIONAL_LOCKS: '0', GIT_PAGER: 'cat',
})

/** `git config --includes --name-only --get-regexp '^filter\.'` arguments (read-only; executes nothing). */
export const FILTER_CONFIG_QUERY = Object.freeze(['config', '--includes', '--name-only', '--get-regexp', '^filter\\.'])

const FILTER_KEY = /^filter\.(.+)\.(clean|smudge|process|required)$/i
const SAFE_DRIVER = /^[A-Za-z0-9_+-][A-Za-z0-9_+.-]{0,99}$/

/**
 * `git status`/`diff` run a repository-configured `filter.<name>.clean` command for files whose attributes name
 * it. Build `-c` overrides that blank every configured filter. Returns null when a driver name cannot be
 * overridden safely (the caller must then NOT run status/diff and should report "unknown").
 * @param {string} configOutput output of the FILTER_CONFIG_QUERY git call (empty string when no filters exist)
 * @returns {string[]|null}
 */
export function filterNeutralisers(configOutput) {
  const names = new Set()
  for (const line of String(configOutput ?? '').split('\n')) {
    if (!line.trim()) continue
    const m = FILTER_KEY.exec(line.trim())
    if (!m) return null
    if (!SAFE_DRIVER.test(m[1])) return null
    names.add(m[1])
  }
  const args = []
  for (const n of names) args.push('-c', `filter.${n}.clean=`, '-c', `filter.${n}.smudge=`, '-c', `filter.${n}.process=`, '-c', `filter.${n}.required=false`)
  return args
}
