// scripts/reference-school/shared.ts
//
// Shared constants and helpers for seeding the EduNexus Reference School
// (Mwatate Ridge Senior School) into the real, existing Core schema
// (schools/learners/school_users/classes/...). See docs/reference-school/
// for the full frozen business-context design this seed data implements.
//
// ⚠️  SYNTHETIC DATA. Every row this seed creates is reachable by following
// FK cascades from one `schools` row. To wipe everything:
//   delete from schools where school_name = 'Mwatate Ridge Senior School';
// (schools → academic_years/terms/streams/school_users/classes/learners/
//  learner_guardians/learner_enrollments/class_subjects/grade_subjects all
//  cascade via ON DELETE CASCADE). Auth users created for teachers are NOT
// cascaded automatically — run cleanup.ts to remove those too.

import { createServiceClient } from '@/utils/supabase/service'
import { REFERENCE_SCHOOL_NAME } from '@/lib/config/referenceSchool'

export const SCHOOL_NAME = REFERENCE_SCHOOL_NAME
export const AUTH_EMAIL_DOMAIN = 'mwatateridge.ac.ke.example'

export function db() {
  return createServiceClient()
}

export function rand<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export const KENYAN_MALE_FIRST_NAMES = [
  'Brian', 'Kevin', 'Dennis', 'Collins', 'Felix', 'Victor', 'Kelvin', 'Antony',
  'Mutuku', 'Odhiambo', 'Otieno', 'Mwangi', 'Kiplagat', 'Kamau', 'Njoroge',
  'Wafula', 'Barasa', 'Kiptoo', 'Cheruiyot', 'Wekesa', 'Onyango', 'Njuguna',
  'Simiyu', 'Kariuki', 'Muriithi', 'Omondi', 'Were', 'Mbugua', 'Gitau', 'Kiprop',
]

export const KENYAN_FEMALE_FIRST_NAMES = [
  'Faith', 'Mercy', 'Joy', 'Ann', 'Grace', 'Winnie', 'Sharon', 'Brenda',
  'Achieng', 'Wanjiru', 'Nyambura', 'Chebet', 'Jepkoech', 'Nafula', 'Auma',
  'Njeri', 'Wairimu', 'Akinyi', 'Cherotich', 'Nasimiyu', 'Waweru', 'Muthoni',
  'Adhiambo', 'Kemunto', 'Moraa', 'Nyokabi', 'Wangari', 'Chepkorir', 'Nekesa',
]

export const KENYAN_SURNAMES = [
  'Mwangi', 'Kamau', 'Otieno', 'Ochieng', 'Wanjiru', 'Njoroge', 'Kiplagat',
  'Barasa', 'Wafula', 'Cheruiyot', 'Omondi', 'Kariuki', 'Muriithi', 'Gitau',
  'Kiptoo', 'Wekesa', 'Simiyu', 'Onyango', 'Mbugua', 'Njuguna', 'Were',
  'Chebet', 'Jepkoech', 'Nafula', 'Auma', 'Akinyi', 'Cherotich', 'Nasimiyu',
  'Kemunto', 'Moraa', 'Nyokabi', 'Chepkorir', 'Nekesa', 'Kiprop', 'Rotich',
]

export function randomFullName(gender: 'male' | 'female'): { first: string; last: string } {
  const first = gender === 'male' ? rand(KENYAN_MALE_FIRST_NAMES) : rand(KENYAN_FEMALE_FIRST_NAMES)
  const last = rand(KENYAN_SURNAMES)
  return { first, last }
}

export function randomPhone(): string {
  return `07${randInt(10000000, 99999999)}`
}

export function randomDob(minAge: number, maxAge: number): string {
  const age = randInt(minAge, maxAge)
  const year = 2026 - age
  const month = randInt(1, 12)
  const day = randInt(1, 28)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// ── Deterministic RNG ────────────────────────────────────────────────────────
//
// `rand`/`randInt`/`shuffle` above wrap Math.random() and are intentionally
// non-deterministic — fine for one-shot population seeding where "some
// realistic name" is all that matters. Anything that must produce
// byte-identical output across repeated runs (e.g. sampled subsets used by
// idempotent bridge scripts) must NOT use those helpers. Use
// `createSeededRng(seed)` instead: a small mulberry32 PRNG that returns the
// same sequence of floats in [0, 1) every time for the same seed.

export function createSeededRng(seed: number): () => number {
  let a = seed >>> 0
  return function mulberry32(): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seededPick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

export function seededInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

// ── Key-based deterministic sampling ────────────────────────────────────────
//
// A single mutable `createSeededRng()` stream is only safe when every run
// consumes it in the exact same order. Idempotent scripts violate that: a
// re-run may skip earlier draws for rows that already exist, shifting the
// stream position for every draw after it. These helpers instead derive a
// value purely from a stable string key (e.g. an entity id) — the result
// never depends on how many other draws happened before it, so it's safe to
// call from idempotent, conditionally-skipping seed logic.

function hashStringToUint32(key: string): number {
  let h = 0x811c9dc5 // FNV-1a 32-bit
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function keyedUnit(key: string): number {
  return createSeededRng(hashStringToUint32(key))()
}

export function keyedInt(key: string, min: number, max: number): number {
  return Math.floor(keyedUnit(key) * (max - min + 1)) + min
}

export function keyedPick<T>(key: string, arr: readonly T[]): T {
  return arr[Math.floor(keyedUnit(key) * arr.length)]
}
