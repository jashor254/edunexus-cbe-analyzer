// Runs INSIDE the sandbox. Reports every isolation property it can observe from within; the host refuses to
// proceed unless `ok` is true. Plain reads only: no network attempts beyond local interface inspection.
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'

const violations = []
const check = (cond, msg) => { if (!cond) violations.push(msg) }

const ALLOWED_ROOT = new Set(['breaker', 'dev', 'lib', 'lib64', 'meta', 'opt', 'proc', 'scratch', 'target', 'tmp', 'usr'])
for (const name of readdirSync('/')) check(ALLOWED_ROOT.has(name), `unexpected path at root: /${name}`)

const ifaces = readFileSync('/proc/net/dev', 'utf8').split('\n').slice(2).map((l) => l.split(':')[0].trim()).filter(Boolean)
check(ifaces.every((n) => n === 'lo'), `network interfaces other than lo: ${ifaces.join(',')}`)

const allowedEnv = new Set(['PATH', 'HOME', 'TMPDIR', 'LANG', 'PWD'])
for (const k of Object.keys(process.env)) check(allowedEnv.has(k) || k.startsWith('JB_'), `unexpected environment variable: ${k}`)

for (const p of ['/home', '/root', '/run', '/var', '/etc', '/sys', '/mnt', '/media']) check(!existsSync(p), `host path visible: ${p}`)

try { writeFileSync('/usr/lib/jb-canary', 'x'); violations.push('/usr/lib is writable') } catch { /* expected: read-only */ }

const pids = readdirSync('/proc').filter((n) => /^\d+$/.test(n))
check(pids.length <= 5, `host processes visible in /proc (${pids.length})`)

console.log(JSON.stringify({ ok: violations.length === 0, violations, interfaces: ifaces }))
process.exit(violations.length === 0 ? 0 : 1)
