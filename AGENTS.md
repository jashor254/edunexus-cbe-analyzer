# AGENTS.md

Instructions for AI coding agents (Codex, Cursor, Aider, etc.) working in this repo.

## Read this first

`CLAUDE.md` is the source of truth for this project's engineering standards — architecture rules, folder structure, naming conventions, TypeScript rules, database rules, security rules, AI/DeepSeek rules, payments rules, error handling, and commit message format. Read it in full before writing any code and follow it exactly; it is not Claude-specific, it's the project's standard regardless of which agent is doing the work.

`CODEX.md` holds a short set of hard invariants (canonical composer, evidence-first intelligence, no silencing TypeScript errors, minimal diffs) — also load it; it's shorter and worth re-reading before touching intelligence/Blueprint code specifically.

Do not duplicate either file's rules here. If a rule needs to change, edit it in `CLAUDE.md` (or `CODEX.md`) — not here.

This is Next.js 16, not the Next.js in your training data. Before writing any code, read the relevant guide under `node_modules/next/dist/docs/` and heed deprecation notices — APIs and conventions have changed from what you know.

## Setup / commands

```
npm run dev              # dev server
npm run build            # production build — the real correctness check; tsc/eslint miss Next's static-render rules
npm run lint              # eslint
npm test -- <path>        # run one test file — never `npx tsx --test <path>` directly, see below
npm run test:deep         # deep/slow test suite
npm run db:types          # regenerate lib/database.types.ts from linked Supabase project
```

Always run tests via the `npm test` script, never bare `npx tsx --test`. The script carries `--experimental-test-module-mocks` (required on Node 22+ for `node:test`'s `mock.module`, or it throws `mock.module is not a function` at import and silently reports zero coverage) and loads `.env.local`, which the integration tests need.

Never claim a test or build passed unless you actually ran it and saw it pass. If blocked from running one, say exactly why.
