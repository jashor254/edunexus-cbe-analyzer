// lib/classes/classCode.ts
//
// Join codes for Solo Teacher (legacy `teacher_classes`) classes.
//
// The old generator built `<SUB><grade><yy>` — all guessable from the class
// itself — plus 2 characters from Math.random(): ~1,296 possibilities per
// subject/grade/year, and POST /api/student/join-class enrolls on the first
// correct guess. The readable prefix is kept (teachers recognise it), but the
// unpredictable part is now 8 characters drawn with crypto.randomInt from an
// unambiguous 32-character alphabet: 32^8 ≈ 1.1 × 10^12 per prefix.
//
// Existing codes are never rewritten — they stay valid exactly as issued.
// Core-bridged classes use their own deterministic `CORE-…` codes
// (lib/core/academicBridge.ts) and never pass through here.

import { randomInt } from 'node:crypto'

// Exactly 32 symbols (no 0/O or 1/I — codes are read aloud and typed by
// learners), so randomInt(32) is uniform with no modulo bias. Same alphabet
// as the Academy cohort join codes (lib/academy/cohorts.ts).
export const CLASS_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const CLASS_CODE_RANDOM_LENGTH = 8

export function generateClassCode(subject: string, grade: number, year: string): string {
  const prefix     = subject.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase()
  const yearSuffix = year.slice(-2)
  let random = ''
  for (let i = 0; i < CLASS_CODE_RANDOM_LENGTH; i++) {
    random += CLASS_CODE_ALPHABET[randomInt(CLASS_CODE_ALPHABET.length)]
  }
  return `${prefix}${grade}${yearSuffix}${random}`
}
