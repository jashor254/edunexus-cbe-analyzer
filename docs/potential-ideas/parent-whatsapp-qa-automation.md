# Parent WhatsApp Q&A automation

**Status:** idea

## What it is

A parent texts EduNexus's WhatsApp number a question and gets an automated reply, instead of only ever receiving outbound Parent Pulse prompts and structured-reply acknowledgements (the only thing that exists today — see `lib/parentPulse/observationPipeline.ts`). Free-form replies currently get logged and nothing else happens.

## Why it might matter

Parents already message the number (a reply from a parent opens Meta's 24-hour freeform session window, so responding doesn't need an approved template — confirmed working per memory `project-whatsapp-production-send-verified`). If the GTM focus ever moves toward parents/teachers as direct channel rather than school procurement, this is a low-friction surface that's already half-built.

## What evidence would justify building it (beyond the STOP-handling gap, see below)

- Parents are actually free-texting the number with real questions, visible in `whatsapp_inbound_log`'s `free_form` rows, in volume worth automating.
- A specific recurring question shows up often enough that a canned answer would save real time (teacher or founder currently answering it manually).

## One thing worth fixing regardless of the above

Right now any free-form reply — including a parent texting "STOP" — gets logged and silently ignored forever; there is no opt-out handling anywhere in `whatsapp_opt_ins`. That's closer to a compliance gap in what's already shipped than a new feature, and doesn't need evidence to justify — it needs fixing whenever WhatsApp pipeline work is next touched.

## If we ever build the Q&A part — layered path

1. **STOP handling** (do regardless of the rest). Detect stop/unsubscribe keywords in `parseReplyBody`, flip `whatsapp_opt_ins.active = false`, send one static confirmation. No AI, no cost.
2. **Canned FAQ** — keyword-match a small fixed set of real recurring parent questions against pre-written static answers. No DeepSeek call, fully deterministic and auditable. Safest place to prove the "parent → automated reply" plumbing before any AI is involved.
3. **Grounded platform/curriculum Q&A (AI, no child data)** — routed through `lib/ai/`, narrow system prompt, explicit `max_tokens`, a new `TokenFeature` entry in `TOKEN_COSTS`/`DAILY_CALL_LIMITS` (conservative cap, same pattern as `career_knowledge_request`). No learner-specific context in the prompt, so no evidence-layer read and no per-child leakage risk yet.
4. **Grounded per-child Q&A** ("how's my child doing in Maths") — only after 3 has run against real usage. Must read the child's state through `recomputeLearnerProjection`/`getLearnerTimeline`, never ad hoc. System prompt must forbid stating anything not present in that projection, with a mandatory "I don't have enough information yet" fallback rather than a guess. This is where real trust risk lives — deliberately last.
5. **Multi-turn conversation** — deferred indefinitely, needs a bounded per-thread history store. Not worth building until 1-4 have real usage data.

Cross-cutting for any AI layer: escalate to a teacher instead of guessing on anything sensitive (reuse the existing `notifyTeacherOfStruggle` → real `student_alerts` pattern, never invent a new channel); never claim an action happened unless it really did; log every inbound + AI reply pair for audit; rate-limit per parent phone.
