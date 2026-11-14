# Jashor Breaker

Model-independent, default-deny security testing framework. v0: passive static checks only. First adapter: EduNexus.

```
npm test                                  # synthetic-fixture test suite (no network, no repo secrets)
node cli.mjs verify <report.json>              # offline digest check of a saved report
node cli.mjs run --config config/targets.edunexus-dev.json --target edunexus-repo [--check <id>] [--out <dir>] [--json] [--fail-on <severity>]
```
Exit codes: 0 ok · 1 findings at/above `--fail-on` (confirmed or suspected only) · 2 engine/check error · 3 guard refusal.

**Read `docs/SAFETY.md` first: in-process JavaScript checks are not a security sandbox.**

Start with `docs/ARCHITECTURE.md`, `docs/SAFETY.md`, and `docs/NODE-22-UPGRADE-PROCEDURE.md`.
To scan another application: copy `config/targets.example.json`, have a human fill the authorisation block, and add an adapter under `adapters/`.
