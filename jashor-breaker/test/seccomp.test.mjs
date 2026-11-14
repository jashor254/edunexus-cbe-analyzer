// Seccomp policy tests. Layer 1 evaluates the BPF program in JS (no kernel). Layer 2 loads the SAME program
// into a real bubblewrap with `--seccomp` and issues the syscalls with a first-party Python/ctypes probe (inline
// below; not third-party and not AI-generated at run time), comparing each against an unfiltered control run.
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, mkdtempSync, writeFileSync, openSync, closeSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  X86_64, buildSeccompProgram, evaluate, programDigest, deniedNames, seccompSupported,
  RET_ALLOW, RET_EPERM, RET_ENOSYS, RET_KILL_PROCESS, CLONE_NS_MASK, DENIED_SOCKET_DOMAINS, SECCOMP_POLICY_VERSION,
} from '../sandbox/seccomp.mjs'

const ARCH = X86_64.auditArch
const prog = buildSeccompProgram('x64')
const run = (nr, args = []) => evaluate(prog, { arch: ARCH, nr, args })

describe('policy program (evaluated in JS)', () => {
  test('every denied syscall returns EPERM, whatever its arguments', () => {
    for (const [name, nr] of Object.entries(X86_64.deny)) {
      assert.equal(run(nr), RET_EPERM, name)
      assert.equal(run(nr, [1, 2, 3, 4, 5, 6]), RET_EPERM, `${name} with args`)
    }
  })

  test('syscalls an ordinary Node process uses are allowed', () => {
    // read write close fstat mmap mprotect munmap brk rt_sigaction futex epoll_wait epoll_ctl openat getdents64 clock_gettime
    // getrandom eventfd2 pipe2 sched_yield prctl execve exit_group
    for (const nr of [0, 1, 3, 5, 9, 10, 11, 12, 13, 202, 232, 233, 257, 217, 228, 318, 290, 293, 24, 157, 59, 231]) {
      assert.equal(run(nr), RET_ALLOW, `syscall ${nr}`)
    }
  })

  test('clone: thread creation is allowed, any namespace flag is denied', () => {
    const threadFlags = 0x00100000 | 0x00080000 | 0x00000200 | 0x00000400 | 0x00010000 | 0x00040000 | 0x00000100 // VM|FS|FILES|SIGHAND|THREAD|SYSVSEM|SETTLS-ish
    assert.equal(run(X86_64.clone, [threadFlags]), RET_ALLOW)
    assert.equal(run(X86_64.clone, [0x11]), RET_ALLOW, 'plain fork (SIGCHLD)')
    for (const flag of [0x00020000, 0x02000000, 0x04000000, 0x08000000, 0x10000000, 0x20000000, 0x40000000]) {
      assert.equal(run(X86_64.clone, [flag]), RET_EPERM, `flag 0x${flag.toString(16)}`)
      assert.equal(run(X86_64.clone, [threadFlags | flag]), RET_EPERM, `thread flags + 0x${flag.toString(16)}`)
    }
    assert.equal(CLONE_NS_MASK, 0x7e020000)
  })

  test('clone3 returns ENOSYS so glibc falls back to clone, whose flags are inspected', () => {
    assert.equal(run(X86_64.clone3), RET_ENOSYS)
  })

  test('socket: unix and inet are allowed; netlink, packet, alg and vsock are denied', () => {
    assert.equal(run(X86_64.socket, [1]), RET_ALLOW)
    assert.equal(run(X86_64.socket, [2]), RET_ALLOW)
    assert.equal(run(X86_64.socket, [10]), RET_ALLOW)
    for (const d of DENIED_SOCKET_DOMAINS) assert.equal(run(X86_64.socket, [d]), RET_EPERM, `domain ${d}`)
  })

  test('the x32 syscall ABI and foreign architectures are killed, not allowed', () => {
    assert.equal(run(0x40000000 + 1), RET_KILL_PROCESS)
    assert.equal(run(0x40000000 + X86_64.deny.ptrace), RET_KILL_PROCESS, 'x32 ptrace cannot sidestep the table')
    assert.equal(evaluate(prog, { arch: 0x40000003, nr: 0 }), RET_KILL_PROCESS, 'i386 arch')
    assert.equal(evaluate(prog, { arch: 0xc00000b7, nr: 0 }), RET_KILL_PROCESS, 'aarch64 arch on an x86_64 program')
  })

  test('unsupported architectures refuse to build a policy (fail closed)', () => {
    assert.throws(() => buildSeccompProgram('arm64'), /refusing to run unfiltered/)
    assert.equal(seccompSupported('arm64'), false)
    assert.equal(seccompSupported('x64'), true)
  })

  test('syscall numbers match the system header (when installed)', (t) => {
    const header = '/usr/include/x86_64-linux-gnu/asm/unistd_64.h'
    if (!existsSync(header)) return t.skip(`${header} not installed`)
    const text = readFileSync(header, 'utf8')
    const num = (n) => Number((new RegExp(`#define __NR_${n}\\s+(\\d+)`).exec(text) ?? [])[1])
    for (const [name, nr] of Object.entries(X86_64.deny)) assert.equal(num(name), nr, name)
    for (const name of ['clone', 'clone3', 'socket']) assert.equal(num(name), X86_64[name], name)
  })

  test('the program is deterministic, bounded, and its digest is pinned (change the policy -> bump the version)', () => {
    assert.deepEqual(buildSeccompProgram('x64'), buildSeccompProgram('x64'))
    assert.ok(prog.length % 8 === 0 && prog.length / 8 < 200)
    assert.equal(SECCOMP_POLICY_VERSION, '1')
    assert.equal(programDigest(prog), PINNED_DIGEST, 'policy changed: update PINNED_DIGEST and SECCOMP_POLICY_VERSION together')
    assert.ok(deniedNames('x64').length > 50)
  })
})
const PINNED_DIGEST = '2ccfbd47e75b488d1c1891cf7329fa6db8eee3f2c0880582b17813db7c3e1563'

// ---- Layer 2: the kernel really enforces it ---------------------------------------------------------------------

const BWRAP = '/usr/bin/bwrap'
const PY = '/usr/bin/python3'
let available = false
let why = ''
before(() => {
  available = existsSync(BWRAP) && existsSync(PY) && seccompSupported()
  if (!available) why = 'bwrap or python3 missing'
  if (!available && process.env.JB_REQUIRE_SANDBOX === '1') throw new Error(`JB_REQUIRE_SANDBOX=1 but ${why}`)
})
const kTest = (name, fn) => test(name, async (t) => (available ? fn(t) : t.skip(why)))

// First-party probe: issues raw syscalls with harmless arguments and prints {name: errno-or-"ok:<ret>"}.
const PROBE = String.raw`
import ctypes, json, threading, os, socket
libc = ctypes.CDLL(None, use_errno=True)
libc.syscall.restype = ctypes.c_long
def sc(nr, *a):
    ctypes.set_errno(0)
    r = libc.syscall(ctypes.c_long(nr), *[ctypes.c_long(x) for x in (list(a) + [0]*(6-len(a)))])
    return ctypes.get_errno() if r == -1 else 0
out = {}
for name, nr, args in json.loads(os.environ['CASES']):
    out[name] = sc(nr, *args)
# Legit behaviour that must keep working under the policy:
ok = {}
t = []; th = threading.Thread(target=lambda: t.append(1)); th.start(); th.join(); ok['thread'] = t == [1]
s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM); ok['af_unix'] = True; s.close()
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM); ok['af_inet'] = True; s.close()
except OSError as e:
    ok['af_inet'] = False
ok['getpid'] = os.getpid() > 0
ok['file_io'] = len(open('/proc/self/status').read()) > 0
print(json.dumps({'cases': out, 'ok': ok}))
`

// Calls with arguments that a NORMAL (unfiltered) kernel answers with something other than EPERM, so an EPERM
// under the policy can only come from the filter. Capability-gated calls are covered by the JS layer above.
const CASES = [
  ['ptrace', X86_64.deny.ptrace, [0xffff, 0, 0, 0]],
  ['process_vm_readv', X86_64.deny.process_vm_readv, [0, 0, 0, 0, 0, 0]],
  ['kcmp', X86_64.deny.kcmp, [0, 0, 99, 0, 0]],
  ['pidfd_getfd', X86_64.deny.pidfd_getfd, [0xffffffff, 0, 0]],
  ['unshare', X86_64.deny.unshare, [0]],
  ['setns', X86_64.deny.setns, [0xffffffff, 0]],
  ['bpf', X86_64.deny.bpf, [0xffffffff, 0, 0]],
  ['perf_event_open', X86_64.deny.perf_event_open, [0, 0, 0, 0, 0]],
  ['keyctl', X86_64.deny.keyctl, [0xffffffff, 0, 0, 0, 0]],
  ['io_uring_setup', X86_64.deny.io_uring_setup, [0, 0]],
  ['io_uring_enter', X86_64.deny.io_uring_enter, [0xffffffff, 0, 0, 0, 0, 0]],
  ['personality', X86_64.deny.personality, [0xffffffff]],
  ['modify_ldt', X86_64.deny.modify_ldt, [0, 0, 0]],
  ['socket(AF_NETLINK)', X86_64.socket, [16, 3, 0]],
]

function bwrapRun({ seccomp }) {
  const dir = mkdtempSync(join(tmpdir(), 'jb-sec-test-'))
  const f = join(dir, 'p.bpf')
  writeFileSync(f, buildSeccompProgram())
  const fd = openSync(f, 'r')
  try {
    const args = [
      '--unshare-user', '--unshare-ipc', '--unshare-pid', '--unshare-net', '--unshare-uts', '--die-with-parent', '--new-session', '--cap-drop', 'ALL',
      ...(seccomp ? ['--seccomp', '3'] : []),
      '--ro-bind', '/usr', '/usr', '--symlink', 'usr/bin', '/bin', '--symlink', 'usr/lib', '/lib', '--symlink', 'usr/lib64', '/lib64',
      '--proc', '/proc', '--dev', '/dev', '--clearenv', '--setenv', 'CASES', JSON.stringify(CASES), '--setenv', 'PATH', '/usr/bin',
      '--', PY, '-I', '-c', PROBE,
    ]
    const r = spawnSync(BWRAP, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe', fd], timeout: 30_000 })
    return { status: r.status, stderr: r.stderr, json: (() => { try { return JSON.parse(r.stdout) } catch { return null } })() }
  } finally { closeSync(fd); rmSync(dir, { recursive: true, force: true }) }
}

describe('kernel enforcement (bubblewrap --seccomp, first-party probe)', () => {
  kTest('each denied call returns EPERM under the policy and something else without it', () => {
    const control = bwrapRun({ seccomp: false })
    const policy = bwrapRun({ seccomp: true })
    assert.ok(control.json, `control run failed: ${control.stderr.slice(0, 200)}`)
    assert.ok(policy.json, `policy run failed: ${policy.stderr.slice(0, 200)}`)
    for (const [name] of CASES) {
      assert.equal(policy.json.cases[name], 1, `${name} under policy`)
      assert.notEqual(control.json.cases[name], 1, `${name} control (a native EPERM would make this case meaningless)`)
    }
  })

  kTest('required functionality still works under the policy: threads, unix and inet sockets, files, pids', () => {
    const policy = bwrapRun({ seccomp: true })
    assert.deepEqual(policy.json.ok, { thread: true, af_unix: true, af_inet: true, getpid: true, file_io: true })
  })

  kTest('the in-sandbox canary and the whole Node worker path run under the filter (Seccomp: 2, no capabilities)', async () => {
    const { probeSandbox } = await import('../sandbox/sandbox.mjs')
    const r = await probeSandbox()
    assert.equal(r.ok, true)
  })
})
