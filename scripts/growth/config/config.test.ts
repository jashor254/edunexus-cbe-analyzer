// Run: npx tsx --test scripts/growth/config/config.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { COUNTY_CONFIGS, findCountyConfig, availableSlugs } from './index'

test('every county config has a non-empty county name, slug, town list, and search-term list', () => {
  for (const config of COUNTY_CONFIGS) {
    assert.ok(config.county.trim().length > 0, `${config.slug}: county name must not be blank`)
    assert.ok(config.slug.trim().length > 0)
    assert.ok(config.towns.length > 0, `${config.slug}: must list at least one town`)
    assert.ok(config.searchTerms.length > 0, `${config.slug}: must list at least one search term`)
  }
})

test('every slug is lowercase and unique', () => {
  const slugs = COUNTY_CONFIGS.map((c) => c.slug)
  assert.deepEqual(slugs, slugs.map((s) => s.toLowerCase()))
  assert.equal(new Set(slugs).size, slugs.length, 'slugs must be unique — the CLI dispatches on slug')
})

test('findCountyConfig is case-insensitive and returns undefined for an unknown slug', () => {
  const found = findCountyConfig('KIRINYAGA')
  assert.ok(found)
  assert.equal(found!.slug, 'kirinyaga')
  assert.equal(findCountyConfig('not-a-real-county'), undefined)
})

test('availableSlugs lists every registered county', () => {
  assert.deepEqual(availableSlugs(), COUNTY_CONFIGS.map((c) => c.slug))
})
