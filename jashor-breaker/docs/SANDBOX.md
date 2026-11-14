# Sandbox S1 — passive, first-party-only confinement

`node cli.mjs run --config <targets.json> --target <id> --sandbox` runs the same passive checks as a normal run, but inside a Bubblewrap sandbox under a systemd user scope. `node cli.mjs sandbox-probe` proves the isolation works on this host (exit 3 if not).

## What is enforced

| Requirement | Mechanism | Proven by (test/sandbox.test.mjs) |
|---|---|---|
| Empty inherited environment | launcher env is built, not inherited; `bwrap --clearenv`; only PATH/HOME/TMPDIR/LANG (+ `JB_*`) set | env test plants secrets in the caller and finds none |
| No production credentials | none are ever passed in; target is a git snapshot of HEAD (untracked `.env*` absent) | env test; snapshot test |
| No home directory | only `/usr/lib`, `/usr/lib64`, the node binary, this package's subtrees, `/target`, `/meta`, `/proc`, `/dev` and two tmpfs are mounted; root is remounted read-only | root-listing + host-canary test |
| No Docker socket | `/run` and `/var` do not exist in the sandbox | exists + connect test |
| No network | new net namespace (loopback only, down); host loopback and host abstract sockets unreachable | listener-on-host test: zero connections seen |
| Read-only target | `/target` is `--ro-bind`; writes return EROFS | fs-write test |
| Dedicated scratch | per-run size-capped tmpfs at `/scratch` (+ `/tmp`); gone when the run ends | persistence + ENOSPC tests |
| CPU / memory / time | systemd scope: `MemoryMax`, `MemorySwapMax=0`, `CPUQuota`, `TasksMax`, `RuntimeMaxSec`, plus a host wall-clock kill and an output cap | five limit tests |
| Explicit target authorisation | `createSnapshot()` accepts only the object returned by `authorise()` | guard tests |
| No active attack capability | no network, read-only target, passive-only mode check, no write path out except stdout | lockdown + tripwire tests |
| Fail closed | static probe + in-sandbox canary before every run; no unconfined fallback | missing-tool and weakened-bwrap tests |
| No untrusted code | the program is the node binary running a first-party script under this package; the target contributes data only | argv/script validation tests |

Output from the worker is treated as untrusted data: schema-checked, secret-scanned and limited to the adapter's declared check ids before it enters a report.

## Requirements on the host

`/usr/bin/bwrap`, `/usr/bin/systemd-run`, `/usr/bin/systemctl`, a user systemd instance with cgroup v2 `cpu memory pids` delegated, unprivileged user namespaces. Absolute paths are used on purpose (no PATH lookup).

## Host-side snapshot boundary (S2)

The committed tree is read with `git ls-tree` + `git cat-file --batch` (raw blobs; no `git archive`, no `tar`, no attribute filters) and written by `sandbox/snapshot.mjs`. Every entry is validated **before** anything is written; one bad entry refuses the whole snapshot and leaves nothing behind.

| Hostile input | Behaviour | Test |
|---|---|---|
| `..`, `a/../..`, `.`/empty components, absolute path, control/NUL/DEL characters | refused | path validation |
| a `.git` component (any case) | refused (no nested repository configuration) | path validation |
| depth > 40, path > 1024 bytes, name > 255 bytes | refused | ceilings test |
| > 50,000 files, > 256 MiB total, > 16 MiB per file | refused from the `ls-tree -l` listing, before any blob is read | ceilings tests |
| odd modes, non-blob objects, duplicate paths, file/dir conflicts, unparseable records | refused | plan validation |
| symlink absolute or escaping the tree | dropped and reported (`stats.dropped`), never created | symlink tests |
| safe relative symlink | created, **last**, so no write can traverse a link | writePlan tests |
| pre-existing symlink at a destination | not followed (`O_EXCL`), outside file untouched | writePlan test |
| hard links | cannot occur (a tree has none); identical blobs become independent files (nlink 1) | writePlan test |
| setuid/setgid/odd permissions | impossible: files are 0644/0755 only | modes test |
| hostile `core.fsmonitor`, hooks, filter drivers, `export-subst`, `export-ignore`, replace refs, odd config | not executed / not applied; git runs with hardening flags and a built environment | real-git tests (with unhardened-git controls) |
| `git status` running a repo-configured `filter.*.clean` | every configured filter is blanked first; if a filter name cannot be overridden safely the working-tree state is reported **unknown** (never silently clean) | clean-filter test |

Finding fixed in this increment: in Mission 005 the snapshot called plain `git status`, which executes a repository-configured `core.fsmonitor` command (confirmed with a benign canary against a synthetic repository) and, for stat-dirty files, a configured clean filter. Both are now neutralised in the sandbox path and in the in-process path (`core/context.mjs`).

## Seccomp (S2)

`bwrap --seccomp 3` loads a classic-BPF program built in `sandbox/seccomp.mjs` (no libseccomp, no new dependency). Policy version `1`, x86_64 only; other architectures refuse to run.

* **Denylist, not allowlist.** Denied with EPERM: ptrace and cross-process memory (`process_vm_*`, `kcmp`, `pidfd_getfd`), mount API and `chroot`/`pivot_root`, `setns`/`unshare`, kernel modules/kexec/reboot/swap, `bpf`, `perf_event_open`, `userfaultfd`, keyring calls, `io_uring_*`, `open_by_handle_at`, clock/hostname changes, `modify_ldt`/`iopl`/`ioperm`, `personality`, NUMA policy calls. `clone` with any `CLONE_NEW*` flag is denied; `clone3` returns ENOSYS (glibc falls back to `clone`, which can be inspected); `socket()` for `AF_NETLINK`, `AF_PACKET`, `AF_ALG` and `AF_VSOCK` is denied. The x32 ABI and foreign architectures are killed.
* **Why a denylist.** An allowlist needs the complete Node syscall set per kernel and glibc; guessing it breaks Node or silently allows too much. The denylist was applied only after the whole existing suite (Node startup, `--permission`, worker, resource probes) ran under it. Path to an allowlist: record real syscalls with `strace -f -c` on the worker across hosts, review, then flip the default.
* **Evidence.** The program is evaluated in JS for every denied call, allowed calls, flag and domain conditions; the same program is loaded into a real bubblewrap and 14 denied calls are issued from a first-party probe, each compared with an unfiltered control run; the in-sandbox canary requires `Seccomp: 2` and empty capability sets before any run proceeds. The program digest is pinned in the tests and recorded in every report and audit record.

## Audit log (S2)

See `docs/AUDIT.md`.

## Known limits (do not oversell)

- Shares the host kernel. A kernel or Bubblewrap vulnerability is an escape. Keep the kernel patched; use a VM (S3) before any untrusted code.
- The seccomp policy is a **denylist** (see above): anything not listed is still allowed. It narrows the kernel attack surface; it is not default-deny.
- `node --permission` is defence in depth only; the November 2026 Node release fixed permission-model bypasses.
- The snapshot is the committed tree: uncommitted work is not scanned in sandbox mode (by design).
- Host-side git (`rev-parse`, `ls-tree`, `cat-file`, `status`) still runs unconfined with your privileges against the target's repository, with hardening flags and a built environment. The remaining exposure is a git vulnerability parsing a hostile object database or index; a hostile third-party repository is still out of scope. Do not point it at one.
- Snapshot ceilings (50,000 files, 256 MiB, 16 MiB per file) refuse very large repositories; the EduNexus repository is about 2,900 files / 135 MB.
- The scratch tmpfs and root tmpfs are memory-backed and count against `MemoryMax`.
- Local-only proof: not run in CI, not tested on other distributions or kernels.
- `Resource limits` use systemd user scopes; if the user manager is degraded or lacks delegation the probe refuses to run.
