// Single source of truth for AI model identifiers.
// Google retires Gemini models on a ~6-12 month cadence.
// When a model is retired, change ONLY this file.

export const GEMINI_PRIMARY = 'gemini-2.5-flash-lite';
export const GEMINI_FALLBACK = 'gemini-2.5-flash-lite'; // same tier, adjust if needed

// Next known retirement: gemini-2.5-flash retires Oct 16 2026
// Monitor: https://ai.google.dev/gemini-api/docs/deprecations
