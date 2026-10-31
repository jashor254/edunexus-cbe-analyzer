# Staging Environment Readiness Report

**Date:** 2026-10-31  
**Role:** Senior Infrastructure Architect / DevOps Engineer  
**Trigger:** NO-GO from `whatsapp-controlled-staging-verification-2026-10-31.md`

---

## Final Decision

### DESIGN READY

The architecture is sound and documented. The infrastructure has not been created. Operator actions are required to provision the staging Supabase project, configure Vercel environment isolation, and register the Meta staging webhook.

---

## 1. Current Infrastructure Inventory

### 1.1 Repository

| Property | Value |
|----------|-------|
| Repository | `github.com/jashor254/edunexus-cbe-analyzer` |
| Branch | `main` |
| HEAD | `a9df2be` |
| Working tree | 12 modified + ~10 untracked (WhatsApp remediation, uncommitted) |
| Migrations | 132 total (130 committed, 2 new WhatsApp untracked) |
| Tests | 1,819 passing, 0 failures |
| Build | Next.js 16, succeeds |

### 1.2 Vercel

| Property | Value |
|----------|-------|
| Account | `dennis-projects-22a9213c` |
| Primary project | `edunexus-cbe-analyzer` |
| Production URL | `www.edunexus.co.ke` |
| Secondary project | `jashor-cbe-project` (duplicate, documented in project notes) |
| Framework | Next.js |
| Node.js | 24.x |
| Git integration | Connected to `jashor254/edunexus-cbe-analyzer` |
| CLI version | 54.20.1 |
| CLI auth | **Authenticated** as `kariukidennis092-2277` |

### 1.3 Vercel Environment Variables

| Variable | Environments | Code Reference |
|----------|-------------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Development, Preview, Production** | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Development, Preview, Production** | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | Yes |
| `WHATSAPP_ACCESS_TOKEN` | Production | Yes |
| `WHATSAPP_PHONE_NUMBER_ID` | Production | Yes |
| `WHATSAPP_APP_SECRET` | Production | Yes |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Production | Yes |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Preview, Production | **Not used in code** |
| `WHATSAPP_WEBHOOK_SECRET` | Production | **Not used in code** (legacy name) |
| `WHATSAPP_VERIFY_TOKEN` | Production | **Not used in code** (legacy name) |
| `OWNER_WHATSAPP_NUMBER` | Not in Vercel | Hardcoded fallback in `sender.ts` |
| `DEEPSEEK_AI_API_KEY` | Production | Yes |
| `CRON_SECRET` | Production | Yes |
| `ADMIN_SECRET` | Development, Preview, Production | Yes |
| `RESEND_API_KEY` | Development, Preview, Production | Yes |
| `GOOGLE_CLIENT_ID` | Production | Yes |
| `GOOGLE_CLIENT_SECRET` | Production | Yes |
| `PAYSTACK_SECRET_KEY` | Production | Yes |
| `FAL_AI_API_KEY` | Preview, Production | Yes |

#### CRITICAL: Preview deployments share production Supabase credentials

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are configured for **all environments** (Development, Preview, Production). This means any Vercel preview deployment currently connects to the production Supabase database. This MUST be fixed before staging can work safely.

#### Cleanup opportunity: 3 unused WhatsApp variables

`WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_WEBHOOK_SECRET`, and `WHATSAPP_VERIFY_TOKEN` are set in Vercel but not referenced in any application code. They appear to be legacy configuration from an earlier WhatsApp integration attempt.

### 1.4 Supabase

| Property | Value |
|----------|-------|
| Production project ref | `lpxrfbmzncaztpmyqzkc` |
| Production project URL | `https://lpxrfbmzncaztpmyqzkc.supabase.co` |
| Staging project | **Does not exist** |
| Local dev | Docker-based (`supabase_db_edunexus`), `192.x.x.x` |
| CLI version | 2.109.0 |
| CLI auth | **Not authenticated** |
| Linked project | `lpxrfbmzncaztpmyqzkc` (production) |

### 1.5 Database Schema Management

| Component | Description |
|-----------|-------------|
| `supabase/final_schema.sql` | 1,215-line baseline schema (pre-migration era) |
| `scripts/bootstrap-local-db/` | Deterministic local bootstrap (Docker-only, structurally safe) |
| `scripts/bootstrap-local-db/00-baseline/` | 20+ recovery SQL files for pre-migration schema objects |
| `scripts/bootstrap-local-db/01-security-hardening/` | 13 phases of security hardening |
| `supabase/migrations/` | 132 tracked migrations |
| Schema fingerprint | `0b8f67ee` (CI-pinned) |
| Bootstrap approach | `final_schema.sql` → recovery SQL → all 132 migrations, in order |

**Important:** The bootstrap runner (`run.sh`) is structurally hardcoded to the local Docker container. It cannot target a remote database. For staging, `supabase db push` must be used instead — this applies all pending migrations against the linked remote project.

### 1.6 CI/CD Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Push/PR/nightly | typecheck, lint, architecture, standard tests, DEEP_PR, HTTP_PR, HTTP_MAIN, DEEP_NIGHTLY, build |
| `notification-crons.yml` | Scheduled | Parent Pulse (weekly), Term Readiness (weekly), Academy Nudge (daily) |
| `queue-cron.yml` | Scheduled | Background job processing |
| `security.yml` | Push/PR | Security scanning (CodeQL) |
| `codeql.yml` | Push/PR | Code quality analysis |

CI uses isolated local Supabase instances (Docker in GitHub Actions runners). It never touches production. The standard test suite runs secret-free.

### 1.7 WhatsApp Integration Configuration

**Environment variables actually used by code** (5):

| Variable | Used in | Purpose |
|----------|---------|---------|
| `WHATSAPP_ACCESS_TOKEN` | `lib/whatsapp/client.ts` | Meta Cloud API bearer token |
| `WHATSAPP_PHONE_NUMBER_ID` | `lib/whatsapp/client.ts` | Meta phone number ID for sending |
| `WHATSAPP_APP_SECRET` | `app/api/webhooks/whatsapp/route.ts` | HMAC-SHA256 signature verification |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | `app/api/webhooks/whatsapp/route.ts` | Webhook subscription verification |
| `OWNER_WHATSAPP_NUMBER` | `lib/whatsapp/sender.ts` | Fallback owner phone (hardcoded default) |

**Not used by code** (3 in Vercel):
- `WHATSAPP_BUSINESS_ACCOUNT_ID` — set for Preview + Production, never referenced
- `WHATSAPP_WEBHOOK_SECRET` — set for Production, never referenced (legacy)
- `WHATSAPP_VERIFY_TOKEN` — set for Production, never referenced (legacy)

### 1.8 Recent Deployment State

| Environment | Status |
|-------------|--------|
| Production | **Ready** (5h ago) |
| All recent Preview deployments | **Error** (all 12+ recent previews failed) |

Preview deployment failures are likely caused by missing environment variables that are Production-only (e.g., `SUPABASE_SERVICE_ROLE_KEY`).

---

## 2. Proposed Staging Architecture

```
Git: main branch
    │
    ├── Local Development
    │       └── Docker Supabase (192.x.x.x)
    │
    ├── Staging (Vercel Preview on `staging` branch)
    │       ├── Vercel Preview deployment
    │       │     └── Preview-specific env vars
    │       ├── Staging Supabase project (NEW)
    │       │     └── Full schema via `supabase db push`
    │       └── Meta WhatsApp test configuration
    │             └── Staging webhook URL
    │
    └── Production (Vercel Production on `main`)
            ├── Vercel Production deployment
            │     └── Production-only env vars
            ├── Production Supabase (lpxrfbmzncaztpmyqzkc)
            └── Production WhatsApp (when configured)
```

### Why this design

1. **Vercel Preview deployments** are free on the Hobby plan and triggered by any push to a non-production branch. A dedicated `staging` branch gets a stable preview URL.
2. **A separate Supabase project** provides complete database isolation. Supabase's free tier allows 2 active projects — production uses one; staging uses the other.
3. **Environment-scoped Vercel variables** ensure Preview deployments connect to staging Supabase, not production.
4. **Meta's test phone numbers** allow WhatsApp integration testing without real parents.

---

## 3. Supabase Staging Setup

### 3.1 Create staging project

**Operator action (Supabase Dashboard):**

1. Go to `app.supabase.com` → New Project.
2. Organization: same as production.
3. Project name: `edunexus-staging` (or similar).
4. Region: same as production for latency consistency.
5. Generate and securely record the database password.
6. Note the new project ref, URL, anon key, and service-role key.

### 3.2 Apply full schema to staging

The staging database must have the complete schema, not just the two WhatsApp migrations.

**Strategy: use `supabase db push`**

This command applies all local migrations (in `supabase/migrations/`) that haven't been applied to the target project. On a fresh project, it applies all 132 migrations in order.

**Prerequisites:**
- Supabase CLI authenticated (`supabase login`)
- Link to the STAGING project (`supabase link --project-ref <STAGING_REF>`)

**Critical safety check:** Before running `supabase db push`, verify the linked project ref is the STAGING project, not production:

```bash
cat supabase/.temp/project-ref
# Must show the STAGING ref, NOT lpxrfbmzncaztpmyqzkc
```

**Operator commands:**

```bash
# 1. Authenticate
supabase login

# 2. Link to STAGING project (NOT production)
supabase link --project-ref <STAGING_PROJECT_REF>

# 3. Verify link target
cat supabase/.temp/project-ref
# MUST be <STAGING_PROJECT_REF>, NOT lpxrfbmzncaztpmyqzkc

# 4. Push all migrations
supabase db push

# 5. Verify migration count
supabase migration list
# Should show 132 migrations applied (or 130 if WhatsApp
# migrations haven't been committed yet — see Git section)
```

**Important:** The bootstrap scripts (`scripts/bootstrap-local-db/`) are Docker-only and structurally cannot target a remote database. `supabase db push` is the correct remote migration tool.

### 3.3 Known complication: `final_schema.sql` history

The bootstrap uses `final_schema.sql` as a baseline before applying migrations. The first migration (`20260520000000_whatsapp_layer.sql`) alters `notification_log`, which only exists after `final_schema.sql` has been applied.

For a remote project, `supabase db push` applies migrations in order against a bare Supabase schema (which includes standard Supabase tables). If the first migration assumes tables from `final_schema.sql` exist, the push will fail.

**Mitigation options:**

1. **Apply `final_schema.sql` manually first** — run it against the staging project via Supabase SQL Editor or `psql` before `db push`.
2. **Consolidate** — create a single initial migration that includes `final_schema.sql` + recovery SQL. This is a structural improvement but not required for immediate staging.

**Recommended:** Option 1 for speed. Apply `final_schema.sql` via SQL Editor, then `supabase db push` for the 132 migrations.

### 3.4 Synthetic test data

After schema setup, insert synthetic test records:

- 1 test school
- 1 test teacher (with auth user)
- 2-3 test students with parent phones (use Meta's test numbers)
- Consent records (`whatsapp_opt_ins` + `students.notification_whatsapp` + `students.whatsapp_opted_in`)
- 1-2 test assignments with submissions (for marking triggers)

Use the seed pattern from `scripts/bootstrap-local-db/seed-test-content.sql` as a reference, adapted for WhatsApp-specific fixtures.

Never copy production data.

---

## 4. Vercel Staging Setup

### 4.1 Fix environment variable isolation (CRITICAL)

**Current problem:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set for Development + Preview + Production. Preview deployments hit the production database.

**Required changes:**

| Variable | Current | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Dev + Preview + Production | **Production only** (remove Dev + Preview) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dev + Preview + Production | **Production only** (remove Dev + Preview) |

Then add staging-specific values:

| Variable | Environment | Value |
|----------|-------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Preview | `https://<STAGING_REF>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Preview | Staging anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Preview | Staging service-role key |

**Operator commands:**

```bash
# Remove shared Supabase URL from Preview (keep Production)
npx vercel env rm NEXT_PUBLIC_SUPABASE_URL preview
npx vercel env rm NEXT_PUBLIC_SUPABASE_ANON_KEY preview

# Add staging-specific values for Preview
npx vercel env add NEXT_PUBLIC_SUPABASE_URL preview
# Enter: https://<STAGING_REF>.supabase.co

npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
# Enter: <staging anon key>

npx vercel env add SUPABASE_SERVICE_ROLE_KEY preview
# Enter: <staging service-role key>
```

### 4.2 Add WhatsApp staging variables for Preview

| Variable | Environment | Source |
|----------|-------------|--------|
| `WHATSAPP_ACCESS_TOKEN` | Preview | Meta test app token |
| `WHATSAPP_PHONE_NUMBER_ID` | Preview | Meta test phone number ID |
| `WHATSAPP_APP_SECRET` | Preview | Meta test app secret |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Preview | Operator-chosen random string |

**Operator commands:**

```bash
npx vercel env add WHATSAPP_ACCESS_TOKEN preview
npx vercel env add WHATSAPP_PHONE_NUMBER_ID preview
npx vercel env add WHATSAPP_APP_SECRET preview
npx vercel env add WHATSAPP_WEBHOOK_VERIFY_TOKEN preview
```

### 4.3 Add other required Preview variables

Variables that are currently Production-only but needed for the app to start:

```bash
npx vercel env add DEEPSEEK_AI_API_KEY preview      # Or a test/free-tier key
npx vercel env add CRON_SECRET preview               # Separate staging secret
npx vercel env add NEXT_PUBLIC_APP_URL preview        # Staging URL
npx vercel env add GOOGLE_CLIENT_ID preview           # If Google auth needed
npx vercel env add GOOGLE_CLIENT_SECRET preview       # If Google auth needed
```

For variables not needed in staging (Paystack, Resend), the app should handle their absence gracefully. If it doesn't, add placeholder values.

### 4.4 Staging branch and stable URL

```bash
# Create staging branch from main + WhatsApp work (after committing)
git checkout -b staging
git push -u origin staging
```

Vercel automatically deploys preview builds for non-production branches. The URL pattern is:
`edunexus-cbe-analyzer-<hash>-dennis-projects-22a9213c.vercel.app`

For a **stable staging URL**, assign a custom domain alias or use Vercel's branch preview configuration in the dashboard to assign a fixed subdomain to the `staging` branch.

### 4.5 No additional Vercel project needed

The existing `edunexus-cbe-analyzer` project supports environment-scoped variables natively. A second Vercel project would be unnecessary overhead.

---

## 5. WhatsApp Meta Staging Configuration

### 5.1 Meta test environment

Meta's WhatsApp Cloud API provides test capabilities:

1. **Test phone numbers** — Meta Business Manager → WhatsApp → API Setup provides a test phone number ID and allows adding up to 5 recipient test numbers.
2. **Test message templates** — Templates can be submitted for the test app. Alternatively, use the `hello_world` default template.
3. **Webhook subscriptions** — Can point to the staging URL.

### 5.2 Isolation approach

**Option A (recommended): Same Meta App, staging webhook URL**

- Use the SAME Meta App (same access token, same phone number ID)
- Register the STAGING deployment URL as the webhook callback
- The staging webhook processes callbacks; production does not receive them
- **Limitation:** Only one webhook URL per app. During staging testing, production webhook callbacks stop.

**Option B: Separate Meta App**

- Create a second Meta App for staging
- Separate phone number ID, access token, app secret
- Both webhooks active simultaneously
- **Cost:** More setup, requires Meta Business verification for the second app

**Option C (simplest): Use test mode with existing credentials**

- Meta's test mode sends messages only to verified test numbers (added in API Setup)
- Use the SAME credentials as production but different phone number ID (test number)
- Register staging webhook URL
- **Safety:** Test mode messages never reach unverified numbers

**Recommendation:** Option C for a solo founder with limited capital. Use Meta's test phone number with the existing app. Register the staging webhook URL temporarily during testing, then restore the production URL afterward. This avoids creating a second app.

### 5.3 Operator actions for Meta configuration

1. **In Meta Business Manager → WhatsApp → API Setup:**
   - Note the Test Phone Number ID (different from production phone number ID)
   - Add operator's personal phone as a test recipient
   - Note the temporary access token (or generate a system user token)

2. **In Meta Business Manager → WhatsApp → Configuration → Webhooks:**
   - Set Callback URL to staging deployment URL: `https://<staging-url>/api/webhooks/whatsapp`
   - Set Verify Token to the `WHATSAPP_WEBHOOK_VERIFY_TOKEN` value configured in Vercel Preview
   - Subscribe to fields: `messages`, `message_status` (for delivery callbacks)

3. **After staging testing is complete:**
   - Restore the production webhook URL
   - Or leave unset if production WhatsApp is not yet live

### 5.4 Variables to configure

| Variable | Source | Notes |
|----------|--------|-------|
| `WHATSAPP_ACCESS_TOKEN` | Meta API Setup → Temporary token, or System User token | 24h expiry for temporary; permanent for system user |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta API Setup → Test Phone Number | Different from production |
| `WHATSAPP_APP_SECRET` | Meta App Settings → App Secret | Same app = same secret |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Operator-chosen | Random string, must match Meta webhook config |

---

## 6. Environment Variable Inventory (Complete)

### Required for staging (Preview environment)

| Variable | Source | Critical |
|----------|--------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Staging Supabase project | **Yes** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Staging Supabase project | **Yes** |
| `SUPABASE_SERVICE_ROLE_KEY` | Staging Supabase project | **Yes** |
| `WHATSAPP_ACCESS_TOKEN` | Meta test credentials | **Yes** |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta test phone number | **Yes** |
| `WHATSAPP_APP_SECRET` | Meta app secret | **Yes** |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Operator-chosen | **Yes** |
| `NEXT_PUBLIC_APP_URL` | Staging deployment URL | **Yes** |
| `DEEPSEEK_AI_API_KEY` | Existing key or test key | Needed for AI features |
| `CRON_SECRET` | Operator-chosen | Needed for cron endpoints |
| `ADMIN_SECRET` | Already set for Preview | Already configured |
| `RESEND_API_KEY` | Already set for Preview | Already configured |

### Production-only (must NOT leak to Preview)

| Variable | Reason |
|----------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` (production) | Bypasses RLS on production DB |
| `PAYSTACK_SECRET_KEY` | Real payment processing |
| `PAYSTACK_WEBHOOK_SECRET` | Payment webhook verification |
| `GOOGLE_CLIENT_SECRET` | OAuth (if separate staging OAuth not configured) |

---

## 7. Git Release Plan

### 7.1 Uncommitted changes classification

**WhatsApp remediation (implementation):**

| File | Type |
|------|------|
| `lib/whatsapp/client.ts` | Transport error normalization |
| `lib/whatsapp/sender.ts` | D-02 fix: `logAttempt` + message ID propagation |
| `lib/whatsapp/reportNotify.ts` | D-02 fix: message ID propagation |
| `app/api/cron/parent-pulse/route.ts` | D-02 fix: message ID propagation |
| `lib/holiday/notify.ts` | D-02 fix: message ID + consent gate |
| `app/api/webhooks/whatsapp/route.ts` | Delivery status + STOP handling + idempotency |
| `lib/repositories/notification.repository.ts` | `updateDeliveryStatus` + `DeliveryStatusEvent` type |
| `lib/parentPulse/observationPipeline.ts` | Inbound reply processing + idempotency |

**Database migrations:**

| File | Type |
|------|------|
| `supabase/migrations/20261031120000_whatsapp_inbound_idempotency.sql` | Inbound dedup |
| `supabase/migrations/20261031120001_whatsapp_delivery_status.sql` | Delivery tracking columns |

**Tests:**

| File | Type |
|------|------|
| `app/api/webhooks/whatsapp/route.test.ts` | Webhook handler tests |
| `lib/whatsapp/client.test.ts` | Client transport tests |
| `lib/whatsapp/senderMessageId.test.ts` | D-02 regression tests (NEW) |
| `scripts/standard-tests.json` | Test manifest update |

**Documentation:**

| File | Type |
|------|------|
| `docs/whatsapp-setup.md` | Template documentation |

### 7.2 Proposed commit structure

**Commit 1 — WhatsApp remediation and D-02 fix:**
```
feat: WhatsApp remediation — consent gates, transport safety, delivery tracking, D-02 message ID fix 🎯
```
Files: all 12 modified implementation files + `senderMessageId.test.ts` + `scripts/standard-tests.json`

**Commit 2 — Database migrations:**
```
feat: WhatsApp inbound idempotency and delivery status migrations 🎯
```
Files: both migration SQL files

**Commit 3 — Documentation:**
```
docs: WhatsApp setup, audit reports, and staging infrastructure 📋
```
Files: `docs/whatsapp-setup.md` + all audit docs + this infrastructure doc

### 7.3 Branch strategy

**Option A (recommended): Direct to `main`, then branch `staging` from it**

Per project practice (direct-to-main discipline), commit to `main`, then create `staging` branch:

```bash
# After approval:
git add <files>
git commit  # Per proposed structure above
git checkout -b staging
git push -u origin staging  # Triggers Vercel preview deployment
git checkout main
git push origin main        # Triggers Vercel production deployment
```

**Option B: Feature branch first**

```bash
git checkout -b feat/whatsapp-remediation
git add <files>
git commit
git push -u origin feat/whatsapp-remediation
# Creates PR, triggers CI, then merge to main
```

**Recommendation:** Option A aligns with established project practice. The code has been thoroughly audited and all 1,819 tests pass.

### 7.4 DO NOT COMMIT OR PUSH

This plan awaits explicit operator approval. No commits or pushes will be made without confirmation.

---

## 8. CLI Authentication Requirements

### 8.1 Tool availability

| Tool | Installed | Version | Auth Status |
|------|-----------|---------|-------------|
| Git | Yes | 2.53.0 | Configured (Codex user) |
| Vercel CLI | Yes | 54.20.1 | **Authenticated** (`kariukidennis092-2277`) |
| Supabase CLI | Yes | 2.109.0 | **Not authenticated** |

### 8.2 Required operator actions

**Supabase CLI authentication:**

```bash
supabase login
# Opens browser for Supabase dashboard login
# Stores access token locally
```

Or set the environment variable:

```bash
export SUPABASE_ACCESS_TOKEN="<token from Supabase dashboard>"
```

To obtain the access token: Supabase Dashboard → Account → Access Tokens → Generate new token.

**After authentication:**

```bash
# Verify authentication
supabase projects list

# Link to STAGING project (NOT production)
supabase link --project-ref <STAGING_PROJECT_REF>

# Verify link
cat supabase/.temp/project-ref
```

**Safety:** After staging work is complete, re-link to production:

```bash
supabase link --project-ref lpxrfbmzncaztpmyqzkc
```

---

## 9. Security Assessment

### 9.1 Environment separation

| Check | Status | Action |
|-------|--------|--------|
| Preview deployments isolated from production DB | **FAIL** | Fix Vercel env vars (§4.1) |
| Production secrets not in Preview | **PARTIAL** | `SUPABASE_SERVICE_ROLE_KEY` is Production-only (good); Supabase URL/anon key leak to Preview (bad) |
| Staging WhatsApp separate from production | **N/A** | Not yet configured |
| RLS enabled | **PASS** | All tables have RLS; staging will inherit via migrations |
| Webhook signature verification | **PASS** | Code verifies HMAC-SHA256 on every inbound webhook |

### 9.2 Secret exposure risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| `.env.local` in git | Low | `.gitignore` includes `.env.local` |
| `.env.production` in git | **Medium** | File IS tracked — contains production keys. Not ideal but existing state. |
| Vercel env vars in logs | Low | Vercel redacts env vars from build logs |
| Migration files expose schema | Low | Schema is not secret |
| Audit reports expose architecture | Low | Architecture documentation, not credentials |

**Recommendation:** `.env.production` should be added to `.gitignore` in a future cleanup. It currently contains production keys in the tracked repository.

### 9.3 Test data safety

| Check | Status |
|-------|--------|
| Synthetic data only in staging | Enforced by design (fresh empty project) |
| Meta test numbers only | Enforced by Meta's test mode |
| No real parent phones in staging | Operator responsibility during seed |
| No production data copied | Structural (fresh project, no `pg_dump`) |

### 9.4 Staging-specific risks

| Risk | Mitigation |
|------|------------|
| Staging webhook overrides production webhook | Document webhook URL swap procedure; restore after testing |
| Staging access token expires | Use system user token (permanent) instead of temporary token |
| Staging Supabase accidentally linked for production push | Always verify `cat supabase/.temp/project-ref` before `db push` |
| Preview deployment accidentally uses production DB | Fix env var scoping (§4.1) FIRST |

---

## 10. Estimated Infrastructure Costs

### Mandatory costs: **$0/month**

| Resource | Plan | Cost |
|----------|------|------|
| Supabase staging project | Free tier (2 projects allowed) | $0 |
| Vercel preview deployments | Included in Hobby plan | $0 |
| Meta WhatsApp test messages | Free (test mode, up to 1,000/month) | $0 |
| GitHub Actions CI | Free tier (2,000 min/month) | $0 |

### Potential costs

| Resource | Trigger | Estimated cost |
|----------|---------|---------------|
| Supabase Pro upgrade | If free tier limits hit (500MB DB, 1GB storage) | $25/month per project |
| Vercel Pro | If concurrent builds or team features needed | $20/month |
| Meta WhatsApp beyond test mode | Production messaging (per-conversation pricing) | ~$0.005–$0.08 per conversation |
| DeepSeek API calls via staging | If AI features are tested in staging | Variable, per-token |

### Recommendation

The free tier is sufficient for controlled staging testing of the WhatsApp integration. No purchases are required.

---

## 11. Operator Actions Required (Ordered)

### Phase A: Fix current security issue

1. **Remove shared Supabase credentials from Preview environment** in Vercel (§4.1).

### Phase B: Provision staging infrastructure

2. **Authenticate Supabase CLI** — `supabase login` (§8.2).
3. **Create staging Supabase project** via dashboard (§3.1).
4. **Link Supabase CLI to staging project** — `supabase link --project-ref <STAGING_REF>` (§3.2).
5. **Apply `final_schema.sql` to staging** via SQL Editor (§3.3).
6. **Apply all migrations to staging** — `supabase db push` (§3.2).
7. **Verify staging schema** — check tables, indexes, RLS policies exist.

### Phase C: Configure Vercel for staging

8. **Add staging Supabase credentials to Vercel Preview** (§4.1, §4.2).
9. **Add WhatsApp staging credentials to Vercel Preview** (§4.2).
10. **Add other required Preview env vars** (§4.3).

### Phase D: Commit and deploy

11. **Review and approve the Git release plan** (§7).
12. **Commit WhatsApp changes** (after approval).
13. **Create and push `staging` branch** — triggers Vercel preview deployment.
14. **Verify staging deployment succeeds** (check Vercel dashboard).
15. **Verify staging app connects to staging Supabase** (NOT production).

### Phase E: Configure Meta WhatsApp

16. **Configure Meta webhook** to point to staging URL (§5.3).
17. **Verify webhook subscription** — check GET verification succeeds.
18. **Add test recipient phone numbers** in Meta API Setup.

### Phase F: Insert synthetic test data

19. **Insert synthetic test records** into staging Supabase (§3.4).

### Phase G: Execute staging verification

20. **Re-run the controlled staging release procedure** from `whatsapp-controlled-staging-verification-2026-10-31.md`.
21. **Execute the 12-scenario test matrix** from `whatsapp-staging-release-2026-10-31.md`.

### Phase H: Restore production state

22. **Re-link Supabase CLI to production** — `supabase link --project-ref lpxrfbmzncaztpmyqzkc`.
23. **Restore production webhook URL** in Meta (if changed).

---

## 12. Remaining Blockers

| Blocker | Owner | Status |
|---------|-------|--------|
| Supabase CLI not authenticated | Operator | Blocked — needs `supabase login` |
| No staging Supabase project | Operator | Blocked — needs dashboard creation |
| Preview env vars share production DB | Operator | **CRITICAL** — must fix before ANY preview deployment |
| WhatsApp changes uncommitted | Operator (approval) | Blocked — needs commit approval |
| `final_schema.sql` must be applied before migrations | Operator | Manual step — SQL Editor |
| Meta webhook URL configuration | Operator | Manual — Meta Business Manager |
| Synthetic test data | Operator | Manual — SQL or seed script |

### Unresolved decisions

1. **Commit strategy:** Direct to `main` (Option A) or feature branch (Option B)? Recommend A per project practice.
2. **Meta isolation:** Same app with test numbers (Option C) or separate app (Option B)? Recommend C for cost.
3. **`.env.production` in git:** Should it be gitignored? Not blocking staging, but a security improvement.
4. **Legacy Vercel WhatsApp vars:** Remove `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_WEBHOOK_SECRET`, `WHATSAPP_VERIFY_TOKEN`? Not blocking staging, but cleanup.

---

## Executive Summary

**Decision: DESIGN READY.**

The staging architecture is fully designed and documented. The infrastructure itself has not been created because it requires operator actions (Supabase project creation, Vercel env var reconfiguration, Meta webhook registration) that cannot be performed programmatically without authorization.

**One critical security finding:** Preview deployments currently share production Supabase credentials. This must be fixed (Phase A) regardless of whether staging proceeds.

**Cost:** $0/month using free tiers.

**Estimated operator time:** 1-2 hours for Phases A through F, including:
- 10 min: Supabase CLI auth + project creation
- 20 min: Schema setup (`final_schema.sql` + `db push`)
- 15 min: Vercel env var reconfiguration
- 15 min: Meta webhook configuration
- 10 min: Git commit + branch creation + push
- 15 min: Synthetic data insertion
- Remaining: Verification

**What is ready now:**
- Complete architecture design
- All code changes (audited, tested, 1,819 tests passing)
- Migration SQL (reviewed, additive, safe)
- 12-scenario test matrix
- Rollback procedures
- Cost analysis

**What requires operator action:**
- Supabase staging project provisioning
- Vercel environment variable isolation
- Meta WhatsApp test configuration
- Git commit approval
- Synthetic test data
