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

## Known limits (do not oversell)

- Shares the host kernel. A kernel or Bubblewrap vulnerability is an escape. Keep the kernel patched; use a VM (S3) before any untrusted code.
- No seccomp filter yet: syscalls are not restricted beyond capabilities and namespaces.
- `node --permission` is defence in depth only; the November 2026 Node release fixed permission-model bypasses.
- The snapshot is the committed tree: uncommitted work is not scanned in sandbox mode (by design), and `git archive` honours `export-ignore`/`export-subst` attributes.
- Host-side code (snapshot, launcher) runs unconfined with your privileges. It runs `git archive` and `tar` on the target, so a hostile repository is still out of scope.
- The scratch tmpfs and root tmpfs are memory-backed and count against `MemoryMax`.
- Local-only proof: not run in CI, not tested on other distributions or kernels.
- `Resource limits` use systemd user scopes; if the user manager is degraded or lacks delegation the probe refuses to run.
