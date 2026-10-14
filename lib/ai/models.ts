// Single source of truth for AI model identifiers.
// Google retires Gemini models on a ~6-12 month cadence.
// When a model is retired, change ONLY this file.

export const GEMINI_PRIMARY = 'gemini-2.5-flash-lite';
export const GEMINI_FALLBACK = 'gemini-2.5-flash-lite'; // same tier, adjust if needed

// Paper Intelligence whole-script marking (lib/paperIntelligence/scriptMarking.ts).
// Chosen 2026-10-14 on the Phase 0 scripts (2 learners × 8 questions, teacher
// double-marked): the teacher's mark was reachable by accept/reject on 13/16
// questions and within 1 mark on 15/16, ~11s per script. gemini-2.5-flash-lite
// read too poorly (5/16 reachable); 3.5-flash matched it at ~4x the latency.
export const GEMINI_SCRIPT_MARKING = 'gemini-3.5-flash-lite';

// Next known retirement: gemini-2.5-flash retires Oct 16 2026
// Monitor: https://ai.google.dev/gemini-api/docs/deprecations
