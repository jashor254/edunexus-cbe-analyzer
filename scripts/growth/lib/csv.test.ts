// Run: npx tsx --test scripts/growth/lib/csv.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCsv, parseCsvRecords, writeCsv, readCsvTable, writeCsvTable } from './csv'

test('writeCsv quotes every field and escapes embedded quotes', () => {
  const csv = writeCsv(['name', 'notes'], [['St. Mary\'s', 'has a "great" ICT lab']])
  assert.equal(csv, '"name","notes"\n"St. Mary\'s","has a ""great"" ICT lab"')
})

test('parseCsv round-trips a value with a comma inside quotes', () => {
  const csv = writeCsv(['name', 'address'], [['Kerugoya High', 'Kerugoya, Kirinyaga County']])
  const rows = parseCsv(csv)
  assert.deepEqual(rows, [
    ['name', 'address'],
    ['Kerugoya High', 'Kerugoya, Kirinyaga County'],
  ])
})

test('parseCsv round-trips an escaped quote', () => {
  const csv = writeCsv(['name'], [['St. Mary\'s "Junior" Academy']])
  const rows = parseCsv(csv)
  assert.deepEqual(rows, [['name'], ['St. Mary\'s "Junior" Academy']])
})

test('parseCsvRecords keys rows by the header row', () => {
  const csv = writeCsv(['name', 'phone'], [['Kagio Academy', '0700000000']])
  const records = parseCsvRecords(csv)
  assert.deepEqual(records, [{ name: 'Kagio Academy', phone: '0700000000' }])
})

test('parseCsvRecords handles a blank optional field', () => {
  const csv = writeCsv(['name', 'phone'], [['Kagio Academy', '']])
  const records = parseCsvRecords(csv)
  assert.deepEqual(records, [{ name: 'Kagio Academy', phone: '' }])
})

test('parseCsv strips a leading UTF-8 BOM', () => {
  const rows = parseCsv('﻿"name"\n"Kagio Academy"')
  assert.deepEqual(rows, [['name'], ['Kagio Academy']])
})

test('readCsvTable: returns the header actually present, whatever it is (schema-agnostic)', () => {
  const csv = writeCsv(['name', 'flag_reason', 'ready_for_import'], [['Kagio Academy', 'missing phone', 'FALSE']])
  const { header, records } = readCsvTable(csv)
  assert.deepEqual(header, ['name', 'flag_reason', 'ready_for_import'])
  assert.deepEqual(records, [{ name: 'Kagio Academy', flag_reason: 'missing phone', ready_for_import: 'FALSE' }])
})

test('writeCsvTable + readCsvTable round-trip, and appending a new column preserves every original value untouched', () => {
  const original = writeCsv(['name', 'phone'], [['Kagio Academy', '0700000000']])
  const { header, records } = readCsvTable(original)
  const appendedHeader = [...header, 'official_email']
  const appendedRecords = records.map((r) => ({ ...r, official_email: 'info@kagio.ac.ke' }))
  const csv = writeCsvTable(appendedHeader, appendedRecords)
  const roundTripped = readCsvTable(csv)
  assert.deepEqual(roundTripped.header, ['name', 'phone', 'official_email'])
  assert.deepEqual(roundTripped.records, [{ name: 'Kagio Academy', phone: '0700000000', official_email: 'info@kagio.ac.ke' }])
})
