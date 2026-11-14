# Audit log (hash chain)

Every `--sandbox` run appends one record to an append-only JSONL log on the **host**, outside the sandbox (the sandbox cannot see it; a test asserts that). Default path: `~/.local/state/jashor-breaker/audit.jsonl`; override with `--audit-log <absolute path>`. The directory must be private (owned by you, not group/world writable) and the file mode `0600`, or the run is refused.

## Record

`format`, `seq`, `runId`, `time`, `targetFingerprint` (SHA-256 of the authorised target id, adapter, environment, mode and root; the path itself is never stored), `securityPolicyVersion`, `sandboxConfigDigest` (SHA-256 of the exact bwrap/systemd flags with per-run names removed, the seccomp program, node and bwrap versions and limits), `outcome` (`completed`, `failed` or `refused`), `testResults` (check ids and counts, category counts, evidence digest; never findings, paths or content), `reportDigest` (SHA-256 of the full report except its `audit` block), `prevHash`, `hash`.

`hash` is SHA-256 of the record's canonical JSON without `hash`; `prevHash` is the previous record's `hash` (64 zeros for the first). Refused and failed runs are recorded too.

## What a hash chain does and does not do

**Tamper evidence only, and only under conditions.** It shows that records were altered, removed from the middle, reordered or duplicated, **provided** the log and a trusted checkpoint are protected.

It does **not** prevent anything. Anyone who can write the file can:
* delete the entire log;
* cut records off the end (the shorter chain is still valid);
* rewrite every record and recompute every hash (the forged chain is internally consistent).

None of these is detectable from the log alone. The tests assert exactly this so nobody over-trusts it.

## Making it worth something

1. **Trusted checkpoint.** Each run prints `audit: record N, hash H` to stderr. Store `N` and `H` somewhere the log's writer cannot also edit (a separate machine, a signed commit, a ticket). Verify with `audit-verify <log> --expect-head H --expect-count N`; truncation and wholesale rewrites then fail.
2. **Protect the file.** Keep it owner-only; for stronger guarantees use append-only storage (`chattr +a` as root, WORM storage, or a remote log sink). Not done here: it needs privileges or a service.
3. **Verify regularly.** `jashor-breaker audit-verify <log>` exits 0 or 1 and warns when no checkpoint is supplied.

Appends take a lock file, verify the whole existing chain first and refuse to extend a broken one. A stale lock fails closed with a message.
