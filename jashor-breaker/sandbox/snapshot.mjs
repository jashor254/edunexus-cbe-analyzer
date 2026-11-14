// Host-side snapshot planning and writing. PURE: no child_process, no network, no environment.
// Git is invoked only from sandbox.mjs; this module validates what git reported and writes it.
//
// Why not `git archive | tar -x` (Mission 005): archive applies .gitattributes (export-ignore, export-subst,
// filters) and tar must then be trusted to refuse hostile members. Here the committed tree is read as raw
// blobs, EVERY entry is validated BEFORE anything is written, and files are created by this code only:
//   * regular files (0644/0755) and directories only; nothing can set ownership, setuid/setgid or devices;
//   * symlinks are created LAST and only if relative and resolving inside the tree, so no write can ever
//     traverse a symlink; escaping links are dropped and reported, never materialised;
//   * hard links cannot occur (a git tree has no such entry type; duplicate blobs become independent files);
//   * any path containing '.', '..', empty parts, control characters, or a `.git` component is refused;
//   * count, depth, path length and size ceilings are enforced from `ls-tree -l` sizes BEFORE reading blobs.
// A refusal throws SnapshotRefused and leaves nothing outside the designated scratch directory.
import { lstatSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { posix, resolve, sep } from 'node:path'

export class SnapshotRefused extends Error {
  constructor(message) { super(message); this.name = 'SnapshotRefused' }
}

export const SNAPSHOT_LIMITS = Object.freeze({
  maxFiles: 50_000,
  maxTotalBytes: 256 * 1024 * 1024,
  maxFileBytes: 16 * 1024 * 1024,
  maxDepth: 40,
  maxPathBytes: 1024,
  maxNameBytes: 255,
  maxSymlinkTargetBytes: 1024,
})

const ALLOWED_MODES = new Set(['100644', '100755', '120000', '160000'])
const refuse = (msg) => { throw new SnapshotRefused(msg) }
/** True if the string has a C0 control character or DEL. */
const hasControl = (s) => { for (const ch of s) { const c = ch.codePointAt(0); if (c < 0x20 || c === 0x7f) return true } return false }
const safeShow = (s) => JSON.stringify(String(s).slice(0, 80))

/** Parse `git ls-tree -r -z -l` output into entries. Anything unparseable is refused (fail closed). */
export function parseLsTree(text) {
  const out = []
  for (const rec of text.split('\0')) {
    if (rec === '') continue
    const m = /^(\d{6}) (blob|commit|tree) ([0-9a-f]{40}|[0-9a-f]{64}) +(-|\d+)\t([\s\S]+)$/.exec(rec)
    if (!m) refuse(`unparseable tree entry: ${safeShow(rec)}`)
    out.push({ mode: m[1], type: m[2], oid: m[3], size: m[4] === '-' ? 0 : Number(m[4]), path: m[5] })
  }
  return out
}

/** Validate one repository-relative path. Returns its components. */
export function checkPath(path, limits = SNAPSHOT_LIMITS) {
  if (typeof path !== 'string' || path.length === 0) refuse('empty path')
  if (Buffer.byteLength(path) > limits.maxPathBytes) refuse(`path too long: ${safeShow(path)}`)
  if (path.startsWith('/')) refuse(`absolute path: ${safeShow(path)}`)
  if (hasControl(path)) refuse(`control character in path: ${safeShow(path)}`)
  const parts = path.split('/')
  if (parts.length > limits.maxDepth) refuse(`path too deep: ${safeShow(path)}`)
  for (const p of parts) {
    if (p === '' || p === '.' || p === '..') refuse(`unsafe path component: ${safeShow(path)}`)
    if (Buffer.byteLength(p) > limits.maxNameBytes) refuse(`path component too long: ${safeShow(path)}`)
    if (p.toLowerCase() === '.git') refuse(`.git component refused (nested repository configuration): ${safeShow(path)}`)
  }
  return parts
}

/** Is this symlink target relative and does it stay inside the tree when resolved from the link's directory? */
export function symlinkTargetIsSafe(linkPath, target, limits = SNAPSHOT_LIMITS) {
  if (typeof target !== 'string' || target.length === 0) return false
  if (Buffer.byteLength(target) > limits.maxSymlinkTargetBytes || hasControl(target)) return false
  if (target.startsWith('/')) return false
  const resolved = posix.normalize(posix.join(posix.dirname(linkPath), target))
  return !(resolved === '..' || resolved.startsWith('../') || resolved.startsWith('/'))
}

/**
 * Validate the whole entry list and produce a plan. Throws SnapshotRefused on ANY unsafe or over-limit input;
 * nothing has touched the filesystem at this point.
 */
export function planSnapshot(entries, limitsIn = {}) {
  const limits = { ...SNAPSHOT_LIMITS, ...limitsIn }
  const files = []
  const symlinkEntries = []
  const dropped = []
  const seen = new Set()
  const dirs = new Set()
  let total = 0
  for (const e of entries) {
    if (!ALLOWED_MODES.has(e.mode)) refuse(`unexpected entry mode ${safeShow(e.mode)} at ${safeShow(e.path)}`)
    const parts = checkPath(e.path, limits)
    if (seen.has(e.path)) refuse(`duplicate path: ${safeShow(e.path)}`)
    seen.add(e.path)
    if (e.mode === '160000') { dropped.push({ path: e.path, reason: 'submodule' }); continue }
    if (e.type !== 'blob') refuse(`unexpected object type ${safeShow(e.type)} at ${safeShow(e.path)}`)
    if (!Number.isSafeInteger(e.size) || e.size < 0) refuse(`bad size at ${safeShow(e.path)}`)
    if (e.mode === '120000') {
      if (e.size > limits.maxSymlinkTargetBytes) { dropped.push({ path: e.path, reason: 'symlink-target-too-long' }); continue }
      symlinkEntries.push(e)
    } else {
      if (e.size > limits.maxFileBytes) refuse(`file exceeds ${limits.maxFileBytes} bytes: ${safeShow(e.path)}`)
      files.push(e)
    }
    total += e.size
    if (total > limits.maxTotalBytes) refuse(`snapshot exceeds ${limits.maxTotalBytes} bytes`)
    if (files.length + symlinkEntries.length > limits.maxFiles) refuse(`snapshot exceeds ${limits.maxFiles} files`)
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'))
  }
  // A path may not be both a file/link and a directory prefix of another entry.
  for (const e of [...files, ...symlinkEntries]) if (dirs.has(e.path)) refuse(`path is both a file and a directory: ${safeShow(e.path)}`)
  return { limits, files, symlinkEntries, dirs: [...dirs].sort(), dropped, totalBytes: total }
}

/** Ordered, deterministic list of the blob object ids the plan needs (for git cat-file --batch). */
export const blobIds = (plan) => [...new Set([...plan.files, ...plan.symlinkEntries].map((e) => e.oid))]

/**
 * Split `git cat-file --batch` output into a Map(oid -> Buffer). Verifies each header against the requested id
 * and against the size reported by ls-tree.
 */
export function parseCatBatch(buf, expected /* Map oid -> size */) {
  const out = new Map()
  let pos = 0
  while (pos < buf.length) {
    const nl = buf.indexOf(0x0a, pos)
    if (nl < 0) refuse('truncated cat-file output')
    const m = /^([0-9a-f]{40}|[0-9a-f]{64}) blob (\d+)$/.exec(buf.toString('latin1', pos, nl))
    if (!m) refuse('unexpected cat-file header')
    const size = Number(m[2])
    if (!expected.has(m[1])) refuse('cat-file returned an object that was not requested')
    if (expected.get(m[1]) !== size) refuse('object size differs from the tree listing')
    const start = nl + 1
    if (start + size > buf.length) refuse('truncated cat-file object')
    out.set(m[1], buf.subarray(start, start + size))
    pos = start + size + 1 // trailing newline
  }
  for (const id of expected.keys()) if (!out.has(id)) refuse('missing object in cat-file output')
  return out
}

const within = (root, p) => { const r = resolve(p); return r === root || r.startsWith(root + sep) }

/**
 * Write a validated plan under `treeDir` (an empty directory the caller just created inside its scratch area).
 * Containment is re-asserted on every path. Symlinks are written last and only if safe.
 */
export function writePlan(plan, contents, treeDir) {
  const root = resolve(treeDir)
  const target = (rel) => { const p = resolve(root, rel); if (!within(root, p) || p === root) refuse(`path escapes snapshot: ${safeShow(rel)}`); return p }
  for (const d of plan.dirs) mkdirSync(target(d), { recursive: false, mode: 0o755 })
  for (const e of plan.files) {
    // 'wx': never overwrite, never follow a pre-existing link at the destination.
    writeFileSync(target(e.path), contents.get(e.oid), { flag: 'wx', mode: e.mode === '100755' ? 0o755 : 0o644 })
  }
  const written = { files: plan.files.length, symlinks: 0 }
  const dropped = [...plan.dropped]
  for (const e of plan.symlinkEntries) {
    const linkTarget = contents.get(e.oid).toString('utf8')
    if (!symlinkTargetIsSafe(e.path, linkTarget, plan.limits)) { dropped.push({ path: e.path, reason: 'symlink-escapes-tree' }); continue }
    const p = target(e.path)
    try { lstatSync(p); refuse(`symlink destination already exists: ${safeShow(e.path)}`) } catch (err) { if (err instanceof SnapshotRefused) throw err }
    symlinkSync(linkTarget, p)
    written.symlinks++
  }
  return { ...written, dropped }
}
