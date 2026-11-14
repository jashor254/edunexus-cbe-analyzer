// Open-then-validate file access. The classic race is `stat(path)` followed by `read(path)`: the path can be
// swapped for a symlink, FIFO or other file in between. Here the file is opened ONCE and every decision (file
// type, size, containment) is made on the open descriptor, so what is checked is exactly what is read.
//
// Read-only. No writes, no network, no environment access.
import { closeSync, constants, fstatSync, openSync, readFileSync, realpathSync } from 'node:fs'
import { sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// O_NONBLOCK: opening a FIFO must not hang. It has no effect on regular files.
const READ_FLAGS = constants.O_RDONLY | constants.O_NONBLOCK

/**
 * Open `abs` for reading and validate the descriptor.
 * @param {string} abs absolute path
 * @param {{root?:string, maxBytes?:number, noFollow?:boolean, afterOpen?:(abs:string)=>void}} [opts]
 *   root: real (symlink-resolved) directory the OPEN FILE must live under; enforced from /proc/self/fd on Linux,
 *         which cannot be raced because it names the inode we hold. Elsewhere only the caller's path checks apply.
 *   noFollow: refuse a symlink as the final path component.
 *   afterOpen: test seam, runs between open and validation to simulate a concurrent swap.
 * @returns {{ok:true, fd:number, size:number} | {ok:false, reason:'missing'|'unreadable'|'not-regular'|'too-large'|'outside-root'}}
 */
export function openRegularFile(abs, opts = {}) {
  let fd
  try {
    fd = openSync(abs, READ_FLAGS | (opts.noFollow ? constants.O_NOFOLLOW : 0))
  } catch (err) {
    return { ok: false, reason: err?.code === 'ENOENT' || err?.code === 'ENOTDIR' ? 'missing' : 'unreadable' }
  }
  try {
    opts.afterOpen?.(abs)
    const st = fstatSync(fd)
    if (!st.isFile()) { closeSync(fd); return { ok: false, reason: 'not-regular' } }
    if (opts.maxBytes !== undefined && st.size > opts.maxBytes) { closeSync(fd); return { ok: false, reason: 'too-large' } }
    if (opts.root !== undefined) {
      let real
      try { real = realpathSync(`/proc/self/fd/${fd}`) } catch { closeSync(fd); return { ok: false, reason: 'unreadable' } }
      if (real !== opts.root && !real.startsWith(opts.root + sep)) { closeSync(fd); return { ok: false, reason: 'outside-root' } }
    }
    return { ok: true, fd, size: st.size }
  } catch {
    try { closeSync(fd) } catch { /* already closed */ }
    return { ok: false, reason: 'unreadable' }
  }
}

/** Read a regular file as UTF-8 through one descriptor. Returns {ok:false, reason} instead of throwing. */
export function readRegularFile(abs, opts = {}) {
  const o = openRegularFile(abs, opts)
  if (!o.ok) return o
  try { return { ok: true, text: readFileSync(o.fd, 'utf8') } } catch { return { ok: false, reason: 'unreadable' } } finally { closeSync(o.fd) }
}

/** Size in bytes of a regular file, from the open descriptor; null when missing or not a regular file. */
export function sizeOfRegularFile(abs, opts = {}) {
  const o = openRegularFile(abs, opts)
  if (!o.ok) return null
  closeSync(o.fd)
  return o.size
}

let cachedSupport
/**
 * Can this host enforce descriptor-based containment? It needs Linux and a usable procfs: /proc/self/fd/N must
 * resolve to the real location of the file we hold. Probed by DOING it once on this module's own file, not
 * assumed from the platform name. Callers must not treat "unsupported" as "fine": see createContext.
 * @param {{platform?:string}} [o] platform override for tests (bypasses the cache)
 * @returns {{supported:true} | {supported:false, reason:string}}
 */
export function descriptorContainmentSupport(o = {}) {
  const platform = o.platform ?? process.platform
  if (platform !== 'linux') return { supported: false, reason: `descriptor containment needs Linux /proc/self/fd (platform: ${platform})` }
  if (o.platform === undefined && cachedSupport) return cachedSupport
  let result
  try {
    const self = fileURLToPath(import.meta.url)
    const fd = openSync(self, READ_FLAGS)
    try { result = realpathSync(`/proc/self/fd/${fd}`) === realpathSync(self) ? { supported: true } : { supported: false, reason: '/proc/self/fd did not resolve to the opened file' } } finally { closeSync(fd) }
  } catch {
    result = { supported: false, reason: '/proc is not mounted or not readable (descriptor containment unavailable)' }
  }
  if (o.platform === undefined) cachedSupport = result
  return result
}
