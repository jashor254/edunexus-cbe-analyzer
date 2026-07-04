# School / Organisation Setup Checklist

For onboarding a school (multiple teachers under one organisation) rather than a single pioneer teacher. EduNexus has two parallel org models — know which one applies before you start:

- **Legacy `school_users`** (`lib/core/school-users.ts`) — simple school → user → role mapping, used by the original teacher portal.
- **Newer multi-org system** (`lib/organizations/*`, backed by `organization_subscriptions`, `organization_members`) — used by the billing/quota/API-key platform (`app/organizations/*`).

Confirm with the school which flow they're being onboarded through before following this checklist — most schools in beta today still use the legacy flow.

## 1. Organisation record

- [ ] Create the `organizations` row (name, plan, quota) if using the newer multi-org system
- [ ] Or create the `schools` row + confirm `school_id` if using the legacy flow

## 2. Owner / admin account

- [ ] The school's designated admin signs up and is granted `owner` or `admin` role
  - Newer system: `repos.organizations.findMemberRole` must resolve `owner`/`admin` before they can invite others (`lib/organizations/invitations.ts` — `createInvitation` checks this)
  - Legacy system: `addSchoolUser(schoolId, userId, role, invitedBy)` — fires `organization.member.invited`

## 3. Invite teachers

- [ ] Admin sends invitations via `/organizations/[orgId]/members` (newer system) — each invite has a 1-time token and an expiry; accepting fires `organization.member.joined` (wired in Phase 13.5)
- [ ] Confirm each invited teacher's email matches exactly what they sign up with — `acceptInvitation` rejects on email mismatch (case-insensitive)
- [ ] For role changes after the fact, use `updateMemberRole` — this now fires `organization.member.role_changed` (Phase 13.5), so any downstream webhook subscribers get notified
- [ ] Removing a teacher from an org uses `removeMember` — cannot remove the org owner directly; use `transferOwnership` first

## 4. Subscription / plan

- [ ] Confirm the school's subscription plan via `getOrgSubscription(organizationId)`
- [ ] If upgrading a plan mid-beta, use `upgradePlan(organizationId, newPlanName)` (`lib/billing/plans.ts`) — this now fires `organization.subscription.upgraded` and updates org quotas atomically
- [ ] Trial expiry is handled automatically by the daily `billing-renewals` cron — no manual downgrade needed unless something goes wrong (see `docs/beta/rollback-guide.md`)

## 5. Quota sanity check

- [ ] Confirm `api_quota_daily` / `api_quota_monthly` on the organization match the plan (`subscription_plans` table)
- [ ] Watch `/api/cron/quota-alerts` (hourly) — it publishes `org.quota.warning` events at 80%/85% thresholds; if a school is hitting these early in beta, that's a signal to check in before they hit a hard limit

## 6. Verify

- [ ] Admin can see `/organizations/[orgId]/members`, `/organizations/[orgId]/billing`, `/organizations/[orgId]/settings` without errors
- [ ] At least one invited teacher has successfully accepted and appears in the members list
- [ ] Spot-check `platform_events` for the expected `organization.member.invited` / `.joined` events — if events are missing, check `PAYSTACK_WEBHOOK_SECRET`/`CRON_SECRET` env vars aren't blocking the dispatch cron (`/api/cron/events/dispatch`, runs every minute)
