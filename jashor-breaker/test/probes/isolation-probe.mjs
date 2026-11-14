// TEST-ONLY first-party probe. Runs inside the sandbox and reports what it can and cannot do, as JSON.
// It is mounted only when a test passes extraMounts: ['test/probes']; it is never part of a normal run.
import { readFileSync, readdirSync, writeFileSync, statSync, existsSync, openSync, writeSync } from 'node:fs'
import net from 'node:net'
import dns from 'node:dns'
import { spawn } from 'node:child_process'

const mode = process.argv[2]
const arg = process.argv[3]
const out = (o) => process.stdout.write(JSON.stringify(o))
const code = (fn) => { try { fn(); return 'ALLOWED' } catch (e) { return e.code ?? e.name } }

if (mode === 'env') {
  out({ env: process.env, environKeys: readFileSync('/proc/self/environ', 'utf8').split('\0').filter(Boolean).map((kv) => kv.split('=')[0]) })
} else if (mode === 'fs-read') {
  const paths = JSON.parse(arg)
  out({ root: readdirSync('/'), results: Object.fromEntries(paths.map((p) => [p, code(() => readFileSync(p))])) })
} else if (mode === 'exists') {
  out(Object.fromEntries(JSON.parse(arg).map((p) => [p, existsSync(p)])))
} else if (mode === 'fs-write') {
  const targets = ['/x', '/opt/x', '/dev/x', '/target/x', '/meta/x', '/breaker/core/x', '/usr/lib/x', '/opt/node/x', '/lib/x', '/proc/x']
  const results = Object.fromEntries(targets.map((p) => [p, code(() => writeFileSync(p, 'x'))]))
  results['/scratch/ok'] = code(() => writeFileSync('/scratch/ok', 'x'))
  results['/tmp/ok'] = code(() => writeFileSync('/tmp/ok', 'x'))
  out(results)
} else if (mode === 'scratch-full') {
  let written = 0
  let err = 'NONE'
  try {
    const fd = openSync('/scratch/big', 'w')
    const chunk = Buffer.alloc(1024 * 1024, 7)
    for (let i = 0; i < 200; i++) { writeSync(fd, chunk); written += chunk.length }
  } catch (e) { err = e.code ?? e.name }
  out({ writtenMiB: Math.floor(written / 1048576), err })
} else if (mode === 'net') {
  const o = JSON.parse(arg)
  const ifaces = readFileSync('/proc/net/dev', 'utf8').split('\n').slice(2).map((l) => l.split(':')[0].trim()).filter(Boolean)
  const tryConnect = (opts) => new Promise((res) => {
    const s = net.connect({ ...opts })
    const t = setTimeout(() => { s.destroy(); res('TIMEOUT') }, 2500)
    s.on('connect', () => { clearTimeout(t); s.destroy(); res('CONNECTED') })
    s.on('error', (e) => { clearTimeout(t); res(e.code ?? e.name) })
  })
  const results = {
    hostLoopback: await tryConnect({ host: '127.0.0.1', port: o.port }),
    hostLoopback6: await tryConnect({ host: '::1', port: o.port }),
    abstractHostSocket: await tryConnect({ path: '\0' + o.abstract }),
    internetIp: await tryConnect({ host: '1.1.1.1', port: 53 }),
    dockerSock: await tryConnect({ path: '/var/run/docker.sock' }),
    dns: await new Promise((res) => dns.lookup('example.com', (e) => res(e ? (e.code ?? e.name) : 'RESOLVED'))),
  }
  out({ ifaces, results })
} else if (mode === 'procs') {
  const pids = readdirSync('/proc').filter((n) => /^\d+$/.test(n))
  out({ pids, rootOfInit: code(() => readdirSync('/proc/1/root/home')), cwdTarget: code(() => readdirSync('/proc/self/root/../home')) })
} else if (mode === 'mem') {
  const keep = []
  for (let i = 0; i < 64; i++) { keep.push(Buffer.alloc(16 * 1024 * 1024, 1)); process.stdout.write(`alloc ${(i + 1) * 16}\n`) }
  process.stdout.write('SURVIVED\n')
} else if (mode === 'cpu') {
  const wallStart = Date.now()
  const cpuStart = process.cpuUsage()
  while (Date.now() - wallStart < 2500) { /* spin */ }
  const c = process.cpuUsage(cpuStart)
  out({ cpuMs: (c.user + c.system) / 1000, wallMs: Date.now() - wallStart })
} else if (mode === 'tasks') {
  let spawned = 0
  let failed = 0
  const kids = []
  for (let i = 0; i < 80; i++) {
    const c = spawn('/opt/node/node', ['-e', 'setTimeout(()=>{},4000)'], { stdio: 'ignore' })
    c.on('spawn', () => { spawned++ })
    c.on('error', () => { failed++ })
    kids.push(c)
  }
  await new Promise((r) => setTimeout(r, 1500))
  out({ spawned, failed })
  for (const k of kids) { try { k.kill('SIGKILL') } catch { /* gone */ } }
} else if (mode === 'spin') {
  for (;;) { /* until killed */ }
} else if (mode === 'flood') {
  const line = 'x'.repeat(1024) + '\n'
  for (let i = 0; i < 200000; i++) process.stdout.write(line)
} else if (mode === 'child-process') {
  out({ spawn: await new Promise((res) => { try { const c = spawn('/opt/node/node', ['-v']); c.on('error', (e) => res(e.code ?? e.name)); c.on('close', () => res('RAN')) } catch (e) { res(e.code ?? e.name) } }) })
} else {
  process.exit(64)
}
