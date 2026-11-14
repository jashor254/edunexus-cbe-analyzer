# Jashor Breaker — safety rules (enforced where noted)

| Rule | Enforcement |
|---|---|
| Read-only discovery only | Checks get `ctx` (read + 3 read-only git subcommands). Non-passive modes are rejected by the guard and again by the runner. Tested. |
| No network | No network capability exists in `ctx`; config schema has no URL field; `scheme://` targets refused. Zero dependencies. (Code review keeps checks honest; see sandbox caveat in ARCHITECTURE.) |
| No production | `production` is not an allowed environment value; deny patterns on id/path; configurable denyList. |
| No real learner data | Fixtures are synthetic, built at runtime in temp dirs. The scanner reads tracked source only, never a database. |
| No credentials in reports | Redaction before Finding creation + fail-closed re-scan in `makeFinding`; tested end to end. `.env*` files are listed by name, never read. |
| No automatic remediation | The engine has no write path to the target. `remediationHint` is advice text. Reports are written only under `--out`. |
| No tool installs | Zero dependencies; nothing is installed or invoked beyond `git`. Third-party tools (gitleaks, OSV-Scanner, ZAP...) need separate approval. |
| Authorisation is explicit and expires | Human-filled block, placeholders refused, expiry enforced. |
| Active testing | Not implemented. Requires a new mode, a new gate and an isolated authorised environment. |

## IMPORTANT LIMITATION: in-process JavaScript checks are not a security sandbox

Checks are ordinary JavaScript modules loaded into the same Node process as the engine. The controls in this directory make **accidental** unsafe behaviour hard and **deliberate** unsafe behaviour visible in review; they do not contain a hostile or compromised check.

What a check can still do, because nothing prevents it:
- `import` any Node built-in (`node:fs`, `node:https`, `node:child_process`, ...) or any installed package, and use the process's full privileges: read any file the user can read, write anywhere, open sockets, spawn processes.
- Read `process.env` (including credentials in the calling shell), mutate `globalThis` or built-in prototypes, and monkey-patch other modules.
- Evade the source tripwire test by trivial obfuscation (string concatenation, indirect access). The tripwire is a review aid, not enforcement.
- Block or exhaust the event loop (infinite loop, huge allocation). There is no timeout, memory limit or isolation.

What the controls do give you: a narrow, frozen `ctx` (no write or network function is offered; root confinement including symlinks), up-front mode validation of every declared check, a frozen check list, fail-closed redaction of findings and error text, and tests that fail if core/adapters import network, dynamic-code, environment or write primitives.

Consequences:
1. **Only run checks you have reviewed**, from this repository, at a reviewed commit. Treat a new or modified check like any code that runs with your user's privileges.
2. **Do not run third-party, downloaded or AI-generated checks** with this engine. That is explicitly out of scope until a real isolation layer exists (separate low-privilege OS user, container or VM with no network and a read-only mount of the target, or a hardened runtime such as Node's permission model plus a process-level seccomp/network namespace). Node's permission model alone should not be relied on: the November 2026 Node security release itself fixes permission-model bypasses (CVE-2026-123829, CVE-2026-106071).
3. **Do not point it at an untrusted repository.** `git` is run with `core.fsmonitor` and hooks disabled, but git still parses the repository's configuration, and the scanner reads attacker-controlled file contents with regexes that have not been fuzzed for pathological input.
4. Reports are only as trustworthy as the checks that produced them. `evidenceDigest` detects accidental or casual alteration of a report; it is an unkeyed hash, not a signature, and does not prove who produced it.

**Update (Mission 005):** `--sandbox` now runs the passive checks inside a Bubblewrap + systemd-scope sandbox (see SANDBOX.md). That is isolation for FIRST-PARTY code only. The rule above still stands: third-party and AI-generated checks are not allowed, because the sandbox shares the host kernel and its seccomp policy is a denylist, not default-deny.

**Update (Mission 007):** the host-side snapshot no longer uses `git archive`/`tar` (hostile-fixture tests, SANDBOX.md), a seccomp denylist is loaded into every sandboxed run, and each sandboxed run appends to a hash-chained audit log (AUDIT.md). Still: no untrusted third-party repositories and no third-party or AI-generated checks.

Hold awareness: this directory lives on its own branch/worktree off `main`. It does not touch WhatsApp WIP, privacy-audit work, deployment settings or any production system.
