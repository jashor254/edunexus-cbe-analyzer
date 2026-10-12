# Security Early-Warning System

How EduNexus finds security problems early, without waiting for someone to remember to run an audit. Set up 2026-10-12. Today's baseline findings are in [findings.md](findings.md).

The repo is **public** and the platform holds **children's data**, so the bar is high. Anyone can read our code, routes and migrations.

## The four tripwires

Each layer catches something the others can't.

| When | Tripwire | Catches | Where |
|---|---|---|---|
| **Commit** (local) | Pre-commit secret scanner | Keys/tokens in added lines; root-level PDFs and `test-*.html` | `scripts/hooks/pre-commit`, activated by `npm install` |
| **Every push / PR** | Route-auth gate | An API route with no auth guard; a cron not using `CRON_SECRET`; a webhook without signature verification; test/debug routes | `scripts/check-route-auth.mjs` (ci.yml → Architecture) |
| | Dependency audit gate | A high/critical advisory in a production dependency | `scripts/check-dependency-audit.mjs` (security.yml) |
| | gitleaks | Secrets in the commits being pushed | security.yml |
| | CodeQL `security-extended` | Injection, SSRF, path traversal, open redirects in our TypeScript | codeql.yml (also weekly) |
| | GitHub push protection | Known provider keys, before they reach GitHub | repo settings |
| **Nightly** (03:00 UTC) | Dependency gate re-run on unchanged code | **Advisories published today** | security.yml |
| | Supabase security advisor gate | A migration that adds a table without RLS or an exposed `SECURITY DEFINER` function | `scripts/check-supabase-advisors.mjs` (security.yml) |
| | Dependabot alerts + security PRs | New CVEs, with a fix PR when one exists | repo settings + `.github/dependabot.yml` |
| **Monthly / before a big release** | Human review: `/security-review`, then `/code-review` on large diffs | Logic flaws (IDOR, broken ownership) that tools miss | write up in `docs/security/` |

A **nightly failure opens (or comments on) one GitHub issue labelled `security-nightly`**, so it reaches your inbox. Dependabot and CodeQL alerts appear under the repo's **Security** tab.

## The rule that keeps it quiet: only *new* things fail

Every gate compares against a **reviewed exception list**, so known, understood items don't make noise. Anything new fails immediately.

- **`docs/security/accepted-risks.json`** holds dependency advisories (`advisories`) and database advisor findings (`database`). Every entry has a `reason` and an **`expires` date**. When it expires the gate fails again, so each acceptance gets re-checked. **An acceptance is a dated decision, never a permanent mute.**
- **`scripts/security/route-auth-registry.json`** lists API routes that are genuinely public, delegate auth to a named `lib/` function, compare a shared secret, or re-export another route. CI re-checks delegated and shared-secret entries on every run: if the route stops calling the named guard, CI fails.

## When something fires

1. **Read the failing step's output.** It names the package/route/table and the rule.
2. **Fix it if you can.** Upgrade the dependency, add the guard, or write a migration.
   - **Any `next` bump must pass `npm run build`** (exit code, 275 pages, no font errors) before you commit. 16.3.7 once broke `next/font/google`. `next` stays pinned exactly.
3. **Accept it only if you can show it's unreachable or harmless.** Add a dated entry with the evidence in `reason` (for example, "no `addImage` call anywhere, so the parser never runs"). Never add an entry just to turn CI green.
4. **A leaked secret means rotate first.** The repo is public, so deleting the commit doesn't make the key safe.

## Adding a new API route

Call one of the guards in `DIRECT_GUARD_CALLS` (`scripts/security/route-auth-rules.mjs`), such as `requireAuthentication`, `requireSchoolMembership` or `checkFeatureAccess`. If you write a **new** guard helper, add it to that list after confirming it reaches `supabase.auth.getUser()`. That review is the point of the list.

## Setup still needed (founder)

- [ ] **`SUPABASE_ACCESS_TOKEN` repo secret.** Until it's set, the nightly database check shows a "not configured" warning. Create the token at supabase.com/dashboard/account/tokens, then add it under GitHub repo → Settings → Secrets → Actions.
- [ ] **Make `Security` and `CodeQL` required status checks** on `main` (branch protection), alongside the CI jobs.

## Running locally

```bash
node scripts/check-route-auth.mjs          # API route guards
node scripts/check-dependency-audit.mjs    # production dependency advisories
node scripts/check-supabase-advisors.mjs --input advisors.json   # saved advisor output
npx tsx --experimental-test-module-mocks --test scripts/security/*.test.ts   # the gates' own tests
# (they also run inside `npm test`, which always runs the full STANDARD manifest)
```
