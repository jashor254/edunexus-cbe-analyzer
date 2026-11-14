// Seccomp policy for the Bubblewrap runner, built here as a classic-BPF program (struct sock_filter array)
// that bwrap loads with `--seccomp FD`. Pure module: no process spawning, no filesystem, no environment.
//
// WHAT THIS IS: a DENYLIST of kernel interfaces that a passive, first-party Node worker never needs and that
// widen the escape surface of a shared-kernel sandbox (kernel module/mount/namespace manipulation, ptrace and
// cross-process memory access, bpf/perf/keyring, io_uring, userfaultfd, clock and hostname changes, ...).
// WHAT IT IS NOT: an allowlist. A default-deny policy needs the complete Node syscall set per kernel/glibc and
// was not attempted blind; see docs/SANDBOX.md ("Seccomp: why a denylist, and the path to an allowlist").
// Denied calls return EPERM (clone3: ENOSYS so glibc falls back to clone, which we can inspect).
// Unsupported architectures are refused (fail closed) rather than run without the filter.
import { createHash } from 'node:crypto'

export const SECCOMP_POLICY_VERSION = '1'

// x86_64 numbers, taken from /usr/include/x86_64-linux-gnu/asm/unistd_64.h (a test re-checks them when the header exists).
export const X86_64 = Object.freeze({
  auditArch: 0xc000003e,
  // Denied with EPERM.
  deny: Object.freeze({
    ptrace: 101, process_vm_readv: 310, process_vm_writev: 311, kcmp: 312, pidfd_getfd: 438,
    mount: 165, umount2: 166, pivot_root: 155, chroot: 161, mount_setattr: 442, move_mount: 429, open_tree: 428,
    fsopen: 430, fsconfig: 431, fsmount: 432, fspick: 433,
    setns: 308, unshare: 272,
    init_module: 175, finit_module: 313, delete_module: 176, kexec_load: 246, kexec_file_load: 320, reboot: 169,
    swapon: 167, swapoff: 168, acct: 163, quotactl: 179, lookup_dcookie: 212, syslog: 103, _sysctl: 156, uselib: 134,
    bpf: 321, perf_event_open: 298, userfaultfd: 323,
    keyctl: 250, add_key: 248, request_key: 249, memfd_secret: 447,
    open_by_handle_at: 304, name_to_handle_at: 303,
    settimeofday: 164, clock_settime: 227, clock_adjtime: 305, adjtimex: 159, sethostname: 170, setdomainname: 171,
    iopl: 172, ioperm: 173, modify_ldt: 154, vhangup: 153, personality: 135,
    io_uring_setup: 425, io_uring_enter: 426, io_uring_register: 427,
    mbind: 237, set_mempolicy: 238, migrate_pages: 256, move_pages: 279,
  }),
  clone: 56, clone3: 435, socket: 41,
})

const AF_NETLINK = 16, AF_PACKET = 17, AF_ALG = 38, AF_VSOCK = 40
export const DENIED_SOCKET_DOMAINS = Object.freeze([AF_NETLINK, AF_PACKET, AF_ALG, AF_VSOCK])
// CLONE_NEWNS|NEWCGROUP|NEWUTS|NEWIPC|NEWUSER|NEWPID|NEWNET
export const CLONE_NS_MASK = 0x00020000 | 0x02000000 | 0x04000000 | 0x08000000 | 0x10000000 | 0x20000000 | 0x40000000

export const RET_KILL_PROCESS = 0x80000000
export const RET_ALLOW = 0x7fff0000
const errno = (n) => 0x00050000 | n
export const RET_EPERM = errno(1)
export const RET_ENOSYS = errno(38)

const LD_W_ABS = 0x20, JEQ_K = 0x15, JGE_K = 0x35, JSET_K = 0x45, RET_K = 0x06
const OFF_NR = 0, OFF_ARCH = 4, OFF_ARG0_LO = 16

/** Tiny label-resolving assembler for the handful of BPF ops used here. */
function assemble(items) {
  const labels = new Map()
  let idx = 0
  for (const it of items) { if (it.label) labels.set(it.label, idx); else idx++ }
  const ins = []
  for (const it of items) {
    if (it.label) continue
    const here = ins.length
    const rel = (l) => {
      if (l === undefined) return 0
      const t = labels.get(l)
      if (t === undefined) throw new Error(`seccomp assembler: unknown label ${l}`)
      const d = t - (here + 1)
      if (d < 0 || d > 255) throw new Error(`seccomp assembler: jump out of range to ${l}`)
      return d
    }
    ins.push({ code: it.code, jt: rel(it.jt), jf: rel(it.jf), k: it.k >>> 0 })
  }
  return ins
}

const toBuffer = (ins) => {
  const b = Buffer.alloc(ins.length * 8)
  ins.forEach((i, n) => { b.writeUInt16LE(i.code, n * 8); b.writeUInt8(i.jt, n * 8 + 2); b.writeUInt8(i.jf, n * 8 + 3); b.writeUInt32LE(i.k, n * 8 + 4) })
  return b
}

const ARCHES = { x64: X86_64 }

/** Does this host architecture have a policy? Unsupported architectures must refuse to run (fail closed). */
export const seccompSupported = (arch = process.arch) => arch in ARCHES

/** Build the BPF program for an architecture. Throws on unsupported architectures. */
export function buildSeccompProgram(arch = process.arch) {
  const A = ARCHES[arch]
  if (!A) throw new Error(`no seccomp policy for architecture ${arch}; refusing to run unfiltered`)
  const prog = [
    { code: LD_W_ABS, k: OFF_ARCH },
    { code: JEQ_K, k: A.auditArch, jt: 'arch_ok' },
    { code: RET_K, k: RET_KILL_PROCESS },
    { label: 'arch_ok' },
    { code: LD_W_ABS, k: OFF_NR },
    { code: JGE_K, k: 0x40000000, jt: 'kill' }, // x32 / other ABI bits: no way around the table
    { code: JEQ_K, k: A.clone, jt: 'clone' },
    { code: JEQ_K, k: A.clone3, jt: 'enosys' },
    { code: JEQ_K, k: A.socket, jt: 'socket' },
    ...Object.values(A.deny).map((nr) => ({ code: JEQ_K, k: nr, jt: 'eperm' })),
    { code: RET_K, k: RET_ALLOW }, // nothing matched
    // BPF jumps are forward-only, so every terminal action lives at the end.
    { label: 'clone' }, { code: LD_W_ABS, k: OFF_ARG0_LO }, { code: JSET_K, k: CLONE_NS_MASK, jt: 'eperm', jf: 'allow' },
    { label: 'socket' }, { code: LD_W_ABS, k: OFF_ARG0_LO },
    ...DENIED_SOCKET_DOMAINS.map((d) => ({ code: JEQ_K, k: d, jt: 'eperm' })),
    { code: RET_K, k: RET_ALLOW },
    { label: 'eperm' }, { code: RET_K, k: RET_EPERM },
    { label: 'enosys' }, { code: RET_K, k: RET_ENOSYS },
    { label: 'kill' }, { code: RET_K, k: RET_KILL_PROCESS },
    { label: 'allow' }, { code: RET_K, k: RET_ALLOW },
  ]
  const buf = toBuffer(assemble(prog))
  if (buf.length / 8 > 4096) throw new Error('seccomp program exceeds the kernel instruction limit')
  return buf
}

export const programDigest = (program) => createHash('sha256').update(program).digest('hex')

/** Names of everything the policy denies, for reports and docs. */
export const deniedNames = (arch = process.arch) => Object.keys(ARCHES[arch]?.deny ?? {}).concat(['clone3(ENOSYS)', 'clone(NEW* flags)', 'socket(AF_NETLINK|AF_PACKET|AF_ALG|AF_VSOCK)'])

/**
 * Evaluate a program the way the kernel would, for tests (no kernel needed).
 * @param {Buffer} program
 * @param {{arch:number, nr:number, args?:number[]}} data args are the LOW 32 bits of each argument
 * @returns {number} seccomp return value
 */
export function evaluate(program, { arch, nr, args = [] }) {
  const word = (off) => {
    if (off === OFF_NR) return nr >>> 0
    if (off === OFF_ARCH) return arch >>> 0
    if (off >= 16 && off < 64 && (off - 16) % 8 === 0) return (args[(off - 16) / 8] ?? 0) >>> 0
    throw new Error(`unsupported seccomp_data offset ${off}`)
  }
  let a = 0
  let pc = 0
  for (let steps = 0; steps < 10_000; steps++) {
    const code = program.readUInt16LE(pc * 8), jt = program.readUInt8(pc * 8 + 2), jf = program.readUInt8(pc * 8 + 3), k = program.readUInt32LE(pc * 8 + 4)
    pc++
    if (code === LD_W_ABS) a = word(k)
    else if (code === JEQ_K) pc += a === k ? jt : jf
    else if (code === JGE_K) pc += a >= k ? jt : jf
    else if (code === JSET_K) pc += (a & k) !== 0 ? jt : jf
    else if (code === RET_K) return k >>> 0
    else throw new Error(`unsupported BPF opcode 0x${code.toString(16)}`)
  }
  throw new Error('BPF program did not terminate')
}
