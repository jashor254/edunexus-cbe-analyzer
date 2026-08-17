#!/usr/bin/env node
// scripts/validate-intentional-residue.mjs
//
// Static guard for scripts/intentional-test-residue.json (H4A-FIX2 /
// OPS-TEST-003). This manifest is the ONLY thing allowed to excuse DEEP_MAIN
// synthetic residue from the reaper's zero-residual expectation — so it
// must itself be impossible to widen by accident. Checks, per entry:
//
//   - file exists in the repo
//   - file is actually part of scripts/deep-main-tests.json (never a
//     back door for a file that isn't even DEEP_MAIN)
//   - fixtureMarker appears literally in that file (not a copy-paste typo)
//   - table/invariant/reason-equivalent fields are present, non-empty
//   - maxSchools is a positive integer (never 0, never omitted, never a
//     stand-in for "unlimited")
//   - no duplicate (file, table) pair
//   - no wildcard-shaped fixtureMarker or table ("*", "SYNTHETIC_*", "all",
//     table name alone with no file scoping — this script's whole reason
//     to exist)
//
// Usage: node scripts/validate-intentional-residue.mjs
// Exit 1 on any violation.

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

const manifest = JSON.parse(readFileSync(join(__dirname, 'intentional-test-residue.json'), 'utf8'))
const deepMain = JSON.parse(readFileSync(join(__dirname, 'deep-main-tests.json'), 'utf8'))
const deepMainFiles = new Set(deepMain.files)

const WILDCARD_SHAPES = [/^\*$/, /\*/, /^all$/i, /^SYNTHETIC_?\*?$/i]

const errors = []
const seenPairs = new Set()

for (const [i, entry] of manifest.entries.entries()) {
  const label = `entries[${i}] (${entry.file ?? '?'})`

  if (!entry.file || !existsSync(join(repoRoot, entry.file))) {
    errors.push(`${label}: file does not exist`)
    continue
  }
  if (!deepMainFiles.has(entry.file)) {
    errors.push(`${label}: not part of scripts/deep-main-tests.json — intentional residue only applies to DEEP_MAIN`)
  }
  if (!entry.fixtureMarker || WILDCARD_SHAPES.some(re => re.test(entry.fixtureMarker))) {
    errors.push(`${label}: fixtureMarker missing or wildcard-shaped`)
  } else {
    const content = readFileSync(join(repoRoot, entry.file), 'utf8')
    if (!content.includes(entry.fixtureMarker)) {
      errors.push(`${label}: fixtureMarker "${entry.fixtureMarker}" not found literally in the file`)
    }
  }
  if (!entry.table || WILDCARD_SHAPES.some(re => re.test(entry.table))) {
    errors.push(`${label}: table missing or wildcard-shaped`)
  }
  if (!entry.invariant || entry.invariant.trim().length < 10) {
    errors.push(`${label}: invariant reason missing or too short to be a real citation`)
  }
  if (!Number.isInteger(entry.maxSchools) || entry.maxSchools < 1) {
    errors.push(`${label}: maxSchools must be a positive integer, got ${JSON.stringify(entry.maxSchools)}`)
  }

  const pairKey = `${entry.file}::${entry.table}`
  if (seenPairs.has(pairKey)) {
    errors.push(`${label}: duplicate (file, table) pair — merge into one entry`)
  }
  seenPairs.add(pairKey)
}

if (errors.length > 0) {
  console.log(`UNSAFE: ${errors.length} problem(s) in scripts/intentional-test-residue.json`)
  for (const e of errors) console.log(`  - ${e}`)
  process.exit(1)
}

console.log(`OK: intentional-test-residue.json — ${manifest.entries.length} entries, all scoped to a real DEEP_MAIN file, a real fixture marker, and a bounded, positive maxSchools`)
process.exit(0)
