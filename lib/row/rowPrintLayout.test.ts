// lib/row/rowPrintLayout.test.ts
//
// Regression tests for the printed Record of Work layout (single download).
//
// Defects fixed:
//  1. The table ran past the page margin. The columns were fixed millimetres
//     totalling 180mm, but the print area was only 150mm (15mm @page margin
//     plus 15mm of inline wrapper padding on each side).
//  2. A long unbroken word ran across the neighbouring columns.
//  3. "Reflection" and "Signature" headers touched each other.
//  4. The new status sentence was 8pt pale grey.
//
// Layout itself was inspected on real rendered PDFs; these tests pin the
// stylesheet facts that produced the fix. No network, no database, no AI.
//
// Run: npx tsx --test lib/row/rowPrintLayout.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateROWHTML } from './pdfRenderer'

const html = generateROWHTML({
  teacher_name: 'T', school: 'Example School', grade: 'Grade 8', learning_area: 'Integrated Science', term: 2, year: 2026,
  entries: [{ week_number: 1, lesson_number: 1, date_taught: null, strand: 'S', sub_strand: 'SS', work_done: 'plan', reflection: '' }],
})

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // the selector must start its own line (so `td` does not match `.meta-table td`)
  const m = html.match(new RegExp(`(?:^|\\n)[ \\t]*${escaped}[ \\t]*\\{([^}]*)\\}`))
  assert.ok(m, `rule for ${selector} present`)
  return m[1]
}

test('ROW-LAYOUT-001 column widths are percentages that total exactly 100%', () => {
  const cols = ['.col-date', '.col-strand', '.col-sub', '.col-work', '.col-ref', '.col-sig']
  let total = 0
  for (const c of cols) {
    const w = rule(c).match(/width:\s*([\d.]+)(%|mm|px)/)
    assert.ok(w, `${c} has a width`)
    assert.equal(w[2], '%', `${c} must be a percentage (millimetre widths overflowed the print area)`)
    total += Number(w[1])
  }
  assert.equal(total, 100)
})

test('ROW-LAYOUT-002 the page margin is not applied twice in print', () => {
  assert.match(html, /@page\s*\{[^}]*margin:\s*15mm/, 'the page margin comes from @page')
  assert.match(html, /@media print\s*\{[\s\S]*\.page-wrap\s*\{\s*padding:\s*0/, 'wrapper padding is removed in print')
  assert.doesNotMatch(html, /<div style="padding:15mm;?">/, 'no inline wrapper padding that survives print')
  assert.match(html, /<div class="page-wrap">/)
})

test('ROW-LAYOUT-003 long unbroken words wrap inside their cell', () => {
  assert.match(rule('td'), /overflow-wrap:\s*anywhere/)
  assert.match(rule('td'), /word-break:\s*break-word/)
  assert.match(rule('th'), /overflow-wrap:\s*anywhere/)
})

test('ROW-LAYOUT-004 table header text is small enough for the narrowest header columns', () => {
  const th = rule('th')
  const size = Number(th.match(/font-size:\s*([\d.]+)pt/)?.[1])
  assert.ok(size <= 8.5, `header font ${size}pt`)
  const spacing = Number(th.match(/letter-spacing:\s*([\d.]+)px/)?.[1])
  assert.ok(spacing <= 0.3, `header letter-spacing ${spacing}px`)
})

test('ROW-LAYOUT-005 the status sentence is readable: at least 9pt and a dark grey', () => {
  const r = rule('.row-status')
  assert.ok(Number(r.match(/font-size:\s*([\d.]+)pt/)?.[1]) >= 9)
  assert.match(r, /color:\s*#4B5563/i)
})

test('ROW-LAYOUT-006 the table still uses a fixed layout at 100% width and avoids splitting rows', () => {
  assert.match(rule('.row-table'), /table-layout:\s*fixed/)
  assert.match(rule('.row-table'), /width:\s*100%/)
  assert.match(html, /tr\s*\{\s*page-break-inside:\s*avoid/)
})
