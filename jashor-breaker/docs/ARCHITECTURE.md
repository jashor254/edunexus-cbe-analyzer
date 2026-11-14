# Jashor Breaker — architecture (v0, passive-only)

A reusable security testing system. The **core** knows nothing about any application. An **adapter** supplies an application's layout, policy and checks. EduNexus is the first adapter, not a special case.

```
jashor-breaker/
  cli.mjs                 thin entry: parse args -> core/runner -> report
  core/                   application-independent engine
    guard.mjs             default-deny target authorisation (the only way in)
    context.mjs           read-only capability surface handed to checks
    runner.mjs            guard -> adapter config -> checks -> findings -> digest
    finding.mjs           Finding model, classification, id, evidence digest
    redactor.mjs          secret patterns + redaction (fail-closed)
    schema.mjs            tiny JSON-Schema-subset validator
    report.mjs            Markdown/JSON rendering
    semver.mjs            minimal version helpers
    ai-port.mjs           model-independent AI interface (no model shipped)
  schemas/                JSON Schemas = single source of truth for config + findings
  config/                 targets.example.json (template, refuses to run), targets.edunexus-dev.json
  adapters/edunexus/      EduNexus layout, policy, 5 passive checks
  test/                   node:test suite on synthetic fixtures
  docs/
```

Zero runtime dependencies. Plain ESM (`.mjs`) so it runs on any supported Node with no build step and does not interact with the host repo's TypeScript/Next toolchain. It is extractable to its own repository by copying the directory.

## Core / adapter boundary
- Adapter = `{ id, configSchemaPath, loadConfig(), checks[] }`. Check = `{ id, title, mode, run(ctx) -> Finding[] }`.
- Checks receive only `ctx`: `read`, `exists`, `size`, `trackedFiles`, and `git` restricted to `ls-files | rev-parse | status`. No raw `fs`, no network, no arbitrary subprocess is offered. (Honest caveat: a malicious check file could still `import` Node modules; v0 relies on code review of checks, and the capability narrowing is a guard against mistakes, not a sandbox. A real sandbox is a prerequisite for any third-party or AI-written check.)
- To support a new application, add `adapters/<name>/` and register it in `cli.mjs`. Core is unchanged.

## Default-deny targeting
A run requires an explicit config file, an explicit `--target`, and every one of: target listed; mode in `allowedModes`; environment in `{development, isolated-test}` (`production` is not representable in the schema); authorisation block filled by a human (placeholders refused), effective and unexpired; path is a local directory (URLs refused; the schema has no URL field); id/path clear of built-in and configured denylists (`production`, `.env`, `service_role`, `scheme://`). Refusal exits with code 3. The template config deliberately cannot run.

## Findings
Classification (see `finding.mjs`): **confirmed** (deterministic observation that demonstrates the fact), **suspected** (strong deterministic signal, impact not demonstrated; e.g. secret-shaped string, liveness untested), **unverified** (outside what the check can see; e.g. the hosting runtime setting). Pattern-based secret hits can never be `confirmed`. Severity is separate from classification. IDs are stable hashes of check + location, so the same issue keeps its id across runs.

## Evidence
- Every finding carries location, redacted detail, and a reproduce command.
- `redactLine` replaces matches with `[REDACTED:<pattern>:<8-hex fingerprint>]` before a Finding exists; `makeFinding` then re-scans the whole finding and **throws** if any secret pattern survives (fail-closed).
- Reports record git HEAD, dirty flag, tool and Node versions. `evidenceDigest` is a SHA-256 over canonical findings only (no timestamps), so identical input yields an identical digest.
- `jashor-breaker verify <report.json>` recomputes the digest offline and reports MISMATCH if findings were altered.
- Known limitation: the generic assignment pattern redacts the whole `NAME = "value"` span, which hides the variable name; the location still identifies it.

## Secret-finding triage (false-positive handling)
Computed inside the redactor on the raw match, so raw values never leave it; the finding carries only `triage: {verdict, reasons[]}`. Rules: only the weak generic-assignment pattern can be `likely-false-positive` (reasons: `env-indirection`, `placeholder-value`, `low-entropy`); specific-prefix secrets (private keys, AWS, GitHub, Supabase, Paystack, JWT) are always `needs-review`, including in test and docs paths, because fixtures sometimes hold real keys. `test-path` and `docs-path` are recorded as reasons but never decide alone. A likely false positive is **demoted to info and listed in its own report section, never dropped**.

## Boundary and robustness behaviours (all tested)
Path confinement (NUL, absolute, `..`, symlink escape for files, directories and a symlinked root); tracked escaping symlinks become a finding and are never read; unknown `--check` ids, unregistered or prototype-colliding adapter names, malformed/empty/non-object configs and invalid `--fail-on` are refused; check errors are surfaced (never swallowed) with content redacted, and one failing check does not stop the others; every declared check (selected or not) must declare exactly `mode: "passive"`; check objects and `ctx` are frozen at run time.

## AI (future, local-first)
`ai-port.mjs` defines `ModelProvider.propose(AiSafeFinding[]) -> AiProposal[]`. A model sees only `toAiSafeView` (id, title, severity, classification, rationale, file locations) — never evidence detail or file contents. It can explain, prioritise, and propose test cases as data; proposals needing more than passive mode are filtered out. `NullProvider` is the default, so nothing depends on a model. Model choice (local Ollama-class, hosted, none) is a deployment decision outside the core. Learner data and secrets never reach a model by construction.

## Roadmap (each step needs its own approval gate)
1. More passive checks: route-auth static sweep, Supabase migration/RLS static analysis (parse SQL, no DB), webhook-handler signature-verification static check, AI prompt PII-flow check.
2. Adapter-side declarative policy files.
3. Isolated-stack active mode (new `mode: active`, own guard rules, requires a stack-fingerprint handshake proving non-production).
4. Local-model provider behind the AI port; proposal review queue.
