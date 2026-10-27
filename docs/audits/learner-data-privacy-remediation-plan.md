# Learner Data Privacy — Remediation Plan (staged, reversible)

**Date:** 2026-10-17 · Companion to [learner-data-privacy-deep-audit.md](./learner-data-privacy-deep-audit.md).
**Status:** Plan only. **No code written yet** — awaiting owner approval per CLAUDE.md ("get approval at each step before writing any code"). Each stage is independently committable and reversible. No migrations will run, nothing deploys, without explicit authorization.

All code touches canonical domains (`lib/`, `app/api/`), so each coding stage should be opened with `/assess` first.

---

## Design principle: one AI egress boundary

Rather than patch 16 call sites, introduce (or extend `lib/ai-orchestration/`) a single server-side function every feature must call:

```
feature → buildRequest() → [egress boundary] → provider
                              │
                              ├─ minimize payload (feature-declared fields only)
                              ├─ pseudonymize (reuse learnerPseudonym.ts)
                              ├─ provider allowlist check (reject unapproved; fallback obeys same rules)
                              ├─ safe logging (metadata only; content off by default)
                              └─ execute + validate output shape
```

Fallbacks run **through the same boundary**, so a DeepSeek→Gemini (or reverse) fallback can never bypass minimization or the allowlist. This directly closes finding **N4** and the fallback-bypass threat.

---

## Stage A — Baseline & audit ✅ DONE (this pass)
Inventory, threat model, policy discrepancy matrix, vendor register. No code.

## Stage B — Highest-risk technical protections (propose first)
Smallest changes with the largest risk reduction. Each is its own commit.

1. **Stop logging raw content by default.**
   - `lib/ai/logger.ts` / `analytics.repository.ts`: store content only behind an explicit `AI_LOG_CONTENT=true` dev flag; default to metadata (feature, model, tokens, latency, success).
   - Remove `prompt.substring(0,500)` from error logs in `aiJudge.ts`, `inshaEvaluator.ts`, `rootCauseClassifier.ts`, `weeklyGenerator.ts` → log a content hash or length instead.
   - *Addresses #12, N1.* Reversible, no schema change. (Optional follow-up: shorten `ai_call_logs` retention from 90d, or null content on write.)

2. **Pseudonymize Compass.**
   - `app/api/learn/route.ts` + `lib/compass/prompt.ts`: send `LEARNER_NAME_TOKEN` instead of real first name; restore locally in the streamed output. Keep grade/level/pathway (pedagogically needed) but confirm that's the minimum.
   - *Addresses #7.* Must cover system prompt, opener, history, **and both providers.**

3. **Pseudonymize/guard Insha + academy + teaching-intelligence.**
   - Route essays/reflections through the boundary. Name-token where names appear; keep linguistic content intact for fair marking (do **not** scrub essays destructively).
   - *Addresses #8, #9.*

4. **Paper Intelligence containment.**
   - Strip EXIF/metadata before upload; ensure filenames/storage paths carry no learner identifiers.
   - Since reliable name-redaction *inside* handwriting isn't feasible without risking the mark, **document residual risk** and add a school-level config gate (feature off unless enabled) rather than claiming images are anonymized.
   - *Addresses #6.* Needs a short design note; no silent change to original evidence.

## Stage C — Centralization
Migrate remaining call sites (SOW, lesson, slides, study-group, remedial, career, holiday) to the boundary; add provider allowlist + unconditional-fallback fix in `lib/ai/deepseek.ts` and `lib/ai-orchestration/`. Rename/clarify `streamDeepSeek` (finding N3).

## Stage D — Tests (Phase 8)
Synthetic fixtures only. Assert: names absent from external payloads where unnecessary; fallback path pseudonymizes; streaming == non-streaming safeguards; raw essays not in logs; unapproved provider rejected; image metadata stripped; existing feature + RLS tests still pass. Produce `docs/security/privacy-regression-test-report.md` with real `npm test` / `next build` output.

## Stage E — Docs, policy, external
- Draft privacy-policy revision (marked DRAFT-PENDING-VERIFICATION): correct DeepSeek/China, add Gemini + Resend, qualify no-training claim, add script-image processing. **Publish only after vendor register cells are filled.**
- Hand owner the vendor/legal action list.

---

## Before-next-school-onboarding — go / no-go checklist

**Blocking (must be contained before a new school's real learners are processed):**
- [x] B1 — Raw learner content no longer logged by default. **DONE 2026-10-17** (code, tests; one-time NULL-out of existing <90d rows still pending owner go — production write).
- [x] B2 — Compass no longer sends real learner names to external AI. **DONE 2026-10-17** (token + split-safe restorer, tests).
- [x] B3 — Insha/academy free-text. **DONE 2026-10-17** — verified no wrapper adds a learner identifier (academy = teacher data; teaching-intelligence = aggregate); fixed insha stdout raw-output leak. Essays NOT destructively scrubbed (marking fairness) — residual → consent/vendor.
- [x] B4 — Paper Intelligence metadata-stripped (EXIF/PNG-text, pixel-preserving, fail-open) + UUID-only paths verified. **DONE 2026-10-17** (code, tests). **Still needs** a school-level on/off gate before onboarding a school that hasn't accepted it (Phase 5); handwriting-name residual documented.
- [x] B5 — Supabase region **confirmed eu-north-1 (Stockholm, EU)** by owner 2026-10-17 → GDPR adequacy holds. (Policy says "Frankfurt" — correct city to Stockholm.) DeepSeek + Gemini both **paid tiers** (owner-confirmed): Gemini paid = no training; DeepSeek paid still needs its written retention/training terms confirmed 🔶.
- [ ] B6 — Privacy policy corrected re: DeepSeek/China + Gemini + Resend + Stockholm city. **Draft ready** → `privacy-policy-revision-draft.md`; most facts now confirmed — **OWNER to approve publishing** (DeepSeek training wording stays soft until its terms are confirmed).

**Strongly recommended (not strictly blocking a single pilot, but near-term):**
- [ ] R1 — ODPC registration confirmed `[LEGAL]`.
- [ ] R2 — Vendor DPAs executed (DeepSeek, Google, Supabase, Resend, Meta, Paystack) `[CONTRACT]`.
- [ ] R3 — DPIA for AI processing of children's data `[LEGAL]`.
- [ ] R4 — Gemini billing tier confirmed as no-training `[DASHBOARD]`.
- [ ] R5 — Central egress boundary complete (Stage C) + regression tests (Stage D).

**Current recommendation (updated 2026-10-17):** B1–B5 ✅ green (B1–B4 code shipped; B5 confirmed EU + paid tiers). **The only remaining blocker is B6** — publish the corrected privacy policy (or hand an onboarding school an accurate written processor list). Once B6 is done, a pilot is defensible, with these still open as near-term (non-blocking for a single informed pilot): DeepSeek paid-tier retention/training terms 🔶, vendor DPAs, ODPC registration, DPIA, Paper-Intelligence school gate, Stage C central boundary.
