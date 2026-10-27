# Privacy Regression Test Report

**Date:** 2026-10-17 · Covers Stage B1–B4 of the learner-data privacy remediation.
All tests use **synthetic fixtures only** — no real learner names, essays, or images.

## Commands run and outcomes

| Command | Result |
|---|---|
| `npm test` (full STANDARD suite) | **1683 pass / 0 fail** (was 1664 before this work; +19 new privacy tests). Manifest rot-guard: "STANDARD manifest OK — 194 files verified, zero privileged-infrastructure signals". |
| `npx tsc --noEmit` | **0 errors**. |
| `npx eslint <touched files>` | **clean** (exit 0). |
| `npx next build` | **succeeds** (full route table emitted, no compile error). |

## New tests added (all STANDARD-safe, pure)

| File | Property proven |
|---|---|
| `lib/repositories/analytics.aiCallLog.privacy.test.ts` (4) | `buildAICallLogRow` NULLs prompt/response by default; keeps operational metadata; captures content only when `AI_LOG_CONTENT=true`; only the exact string `"true"` enables it. |
| `lib/compass/namePseudonym.test.ts` (9) | `scrubLearnerName` replaces whole-word names, ignores substrings, no-ops for ''/'there'; `makeNameRestorer` restores a token whole, split across two chunks, split char-by-char, never emits a half-restored token, passes lone braces, handles multiple tokens. |
| `lib/paperIntelligence/imageMetadata.test.ts` (6) | JPEG EXIF/COM removed, structure+pixels preserved, malformed fails open; PNG tEXt/eXIf removed, critical chunks preserved; webp/unknown pass through. |

## Coverage vs. the brief's required test matrix (Phase 8)

| Required property | Covered? | Where |
|---|---|---|
| 1. Names not in external prompts where unnecessary | ✅ Compass | `namePseudonym.test.ts` + route uses `LEARNER_NAME_TOKEN` |
| 5. Provider fallbacks cannot bypass transforms | ⚠ Partial | Compass scrubs the payload *before* `streamDeepSeek`, so both Gemini (primary) and DeepSeek (fallback) receive the scrubbed payload. A central allowlist/boundary test is Stage C. |
| 6. Streaming == non-streaming safeguards | ✅ Compass streaming | split-safe restorer tested |
| 7. Raw essays not in operational logs | ✅ | `analytics.aiCallLog.privacy.test.ts` + insha stdout fix |
| 8. Image metadata not exposed | ✅ JPEG/PNG | `imageMetadata.test.ts` |
| 9. Image redaction tested on synthetic examples | ✅ | `imageMetadata.test.ts` |
| 13. Tenant isolation / RLS intact | ✅ (unchanged) | no auth/RLS code touched; full suite green |
| 17. Existing feature tests still pass | ✅ | 1683/1683 |

## Limitations (honest)
- **DEEP integration tests were not run this session** (no `TEST_SUPABASE_*` configured here) — they run in CI. The Compass route change is exercised by the pure `namePseudonym` tests + `next build`, not by a live streaming integration test in this session.
- Properties 2–4, 10–12, 14–16 (full identifier set, provider allowlist rejection, unsafe-fallback block, server-side opt-out enforcement) depend on the **Stage C central boundary** and **Phase 5 consent**, which are not yet built.
