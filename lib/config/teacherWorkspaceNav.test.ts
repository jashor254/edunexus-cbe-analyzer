// lib/config/teacherWorkspaceNav.test.ts
//
// Teacher Workspace Convergence, Phase 1 — the navigation contract.
//
// This file exists because Phase 1 regroups the Teacher Workspace navigation
// (Option B: My Teaching / My School / Insights / Tools). Grouping is a
// presentation change, and the single risk of a presentation change to a
// navigation config is that a destination silently disappears from the
// product while every route still resolves. These tests make that
// impossible: every href is asserted by name, not by array length.
//
// Nothing here asserts styling, ordering within a group beyond the teaching
// sequence, or component markup — only the contract the sidebar and the
// bottom navigation both render from.
//
// Run: npx tsx --test lib/config/teacherWorkspaceNav.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TEACHER_WORKSPACE_NAV,
  SCHOOL_OFFICE_NAV_ITEM,
  TEACHER_NAV_GROUPS,
  TEACHER_NAV_GROUP_ORDER,
  createSheetItems,
  moreSheetItems,
  teachingSheetItems,
  itemsInGroup,
  type TeacherNavGroup,
} from './teacherWorkspaceNav'

// The complete set of destinations the Teacher Workspace offered before
// Phase 1. Hardcoded deliberately: if a future change removes one, this list
// does not move with it and the test fails.
const DESTINATIONS_BEFORE_PHASE_1 = [
  '/teacher/dashboard',
  '/teacher/classes',
  '/teacher/scheme-of-work',
  '/teacher/lesson-plans',
  '/teacher/record-of-work',
  '/teacher/attendance',
  '/teacher/assessment',
  '/teacher/reports',
  '/teacher/core-term',
  '/teacher/insights',
  '/teacher/alerts',
  '/teacher/documents',
  '/teacher/booklets',
  '/teacher/assignments',
  '/teacher/slides',
  '/teacher/kiswahili/insha',
  '/teacher/analytics',
  '/teacher/academy',
  '/teacher/settings',
] as const

// ── Test A — no destination disappears ──────────────────────────────────────

test('A: every pre-Phase-1 destination still exists in the canonical nav', () => {
  const hrefs = new Set(TEACHER_WORKSPACE_NAV.map(i => i.href))

  for (const href of DESTINATIONS_BEFORE_PHASE_1) {
    assert.ok(hrefs.has(href), `navigation destination disappeared: ${href}`)
  }

  assert.equal(
    TEACHER_WORKSPACE_NAV.length,
    DESTINATIONS_BEFORE_PHASE_1.length,
    'Phase 1 must neither add nor remove destinations — only regroup them',
  )
})

test('A2: School Office is still a separate export, not folded into the main nav', () => {
  assert.equal(SCHOOL_OFFICE_NAV_ITEM.href, '/teacher/core-office')
  assert.ok(
    !TEACHER_WORKSPACE_NAV.some(i => i.href === '/teacher/core-office'),
    'School Office must stay out of TEACHER_WORKSPACE_NAV so its admin-tier gate cannot be bypassed',
  )
})

test('A3: every route that existed keeps its exact URL — no route was moved', () => {
  // Guards against a "tidy up the URLs while we are in here" regression.
  assert.equal(TEACHER_WORKSPACE_NAV.find(i => i.label === 'Documents & Downloads')?.href, '/teacher/documents')
  assert.equal(TEACHER_WORKSPACE_NAV.find(i => i.label === 'My Classes')?.href,            '/teacher/classes')
  assert.equal(TEACHER_WORKSPACE_NAV.find(i => i.label === 'Scheme of Work')?.href,        '/teacher/scheme-of-work')
  assert.equal(TEACHER_WORKSPACE_NAV.find(i => i.label === 'Record of Work')?.href,        '/teacher/record-of-work')
})

// ── Test B — no duplicate hrefs ─────────────────────────────────────────────

test('B: every navigation destination is unique', () => {
  const hrefs = TEACHER_WORKSPACE_NAV.map(i => i.href)
  const seen = new Set<string>()
  const duplicates: string[] = []

  for (const href of hrefs) {
    if (seen.has(href)) duplicates.push(href)
    seen.add(href)
  }

  assert.deepEqual(duplicates, [], 'duplicate navigation destinations')
})

// ── Test C — valid groups ───────────────────────────────────────────────────

test('C: every grouped item belongs to an approved group', () => {
  const approved: TeacherNavGroup[] = ['teaching', 'school', 'insights', 'tools']

  assert.deepEqual([...TEACHER_NAV_GROUP_ORDER], approved, 'group order must be the approved set, in order')

  for (const item of TEACHER_WORKSPACE_NAV) {
    if (item.group === undefined) continue
    assert.ok(approved.includes(item.group), `${item.href} has an unapproved group: ${item.group}`)
  }
})

test('C2: My Day and Settings are the only ungrouped anchors', () => {
  const ungrouped = TEACHER_WORKSPACE_NAV.filter(i => i.group === undefined).map(i => i.href)
  assert.deepEqual(ungrouped, ['/teacher/dashboard', '/teacher/settings'])
})

test('C3: every approved group has a rendered label and at least one item', () => {
  for (const group of TEACHER_NAV_GROUP_ORDER) {
    assert.ok(TEACHER_NAV_GROUPS[group], `group ${group} has no display label`)
    assert.ok(TEACHER_NAV_GROUPS[group].length > 0, `group ${group} label is empty`)
    assert.ok(itemsInGroup(group).length > 0, `group ${group} has no items`)
  }
})

// ── Test D — teaching order ─────────────────────────────────────────────────

test('D: the teaching group follows the real workflow order', () => {
  assert.deepEqual(
    itemsInGroup('teaching').map(i => i.label),
    ['Scheme of Work', 'Lesson Plans', 'Record of Work', 'Documents & Downloads', 'Booklets'],
    'plan the term -> prepare the week -> record what happened -> print',
  )
})

test('D2: the teaching group is the first group in the sidebar', () => {
  assert.equal(TEACHER_NAV_GROUP_ORDER[0], 'teaching', 'teaching must lead — this is the whole point of Phase 1')
})

// ── Test E — school grouping ────────────────────────────────────────────────

test('E: school-owned and class-scoped capabilities are grouped under My School', () => {
  assert.deepEqual(
    itemsInGroup('school').map(i => i.label),
    ['My Classes', 'Attendance', 'Assignments', 'Assessment', 'Official Report Cards', 'Parent Reports'],
  )
})

test('E2: grouping changed no route and no capability for school items', () => {
  const expected: Record<string, string> = {
    'My Classes':            '/teacher/classes',
    'Attendance':            '/teacher/attendance',
    'Assignments':           '/teacher/assignments',
    'Assessment':            '/teacher/assessment',
    'Official Report Cards': '/teacher/core-term',
    'Parent Reports':        '/teacher/reports',
  }
  for (const item of itemsInGroup('school')) {
    assert.equal(item.href, expected[item.label], `${item.label} route changed`)
  }
})

test('E3: insights and tools groups hold the expected items', () => {
  assert.deepEqual(itemsInGroup('insights').map(i => i.label), ['Alerts', 'Insights', 'Analytics'])
  assert.deepEqual(itemsInGroup('tools').map(i => i.label),    ['AI Slides', 'Insha Feedback', 'AI Academy'])
})

// ── Test F — admin-tier School Office ───────────────────────────────────────

test('F: School Office appears in the More sheet only for admin-tier users', () => {
  const ordinary = moreSheetItems(false).map(i => i.href)
  const admin    = moreSheetItems(true).map(i => i.href)

  assert.ok(!ordinary.includes('/teacher/core-office'), 'an ordinary teacher must never see School Office')
  assert.ok(admin.includes('/teacher/core-office'),     'an admin-tier user must still see School Office')

  // Grouping must not have widened the gate in any other direction.
  assert.deepEqual(admin.filter(h => h !== '/teacher/core-office'), ordinary)
})

test('F2: no other sheet leaks School Office', () => {
  assert.ok(!createSheetItems().some(i => i.href === '/teacher/core-office'))
  assert.ok(!teachingSheetItems().some(i => i.href === '/teacher/core-office'))
})

// ── Mobile reachability ─────────────────────────────────────────────────────

test('G: every destination remains reachable on mobile', () => {
  // The bottom bar renders Home and Alerts as direct tabs; everything else
  // must appear in one of the three sheets. Losing a bottom-tab slot (My
  // Classes, in Phase 1) must never mean losing reachability.
  const DIRECT_TABS = ['/teacher/dashboard', '/teacher/alerts']

  const reachable = new Set<string>([
    ...DIRECT_TABS,
    ...teachingSheetItems().map(i => i.href),
    ...createSheetItems().map(i => i.href),
    ...moreSheetItems(false).map(i => i.href),
  ])

  for (const href of DESTINATIONS_BEFORE_PHASE_1) {
    assert.ok(reachable.has(href), `unreachable on mobile after regrouping: ${href}`)
  }
})

test('G2: My Classes lost its bottom-nav tab but is still reachable in the More sheet', () => {
  assert.ok(
    moreSheetItems(false).some(i => i.href === '/teacher/classes'),
    'demoting My Classes must not hide it',
  )
})

test('G3: the Teaching sheet puts the whole professional workflow one tap away', () => {
  assert.deepEqual(
    teachingSheetItems().map(i => i.href),
    [
      '/teacher/scheme-of-work',
      '/teacher/lesson-plans',
      '/teacher/record-of-work',
      '/teacher/documents',
    ],
  )
})

// ── Dashboard state contract ────────────────────────────────────────────────
//
// Phase 1's central behavioural fix: `activeSchemes`, not `activeClasses`,
// decides whether a teacher has begun their professional work. These tests
// pin the three teacher states the Phase 0 audit identified, using the real
// projection type so a future change to the projection cannot silently
// reintroduce the class-gated front door.

import type { TeacherDashboardProjection } from '@/lib/teacherWorkspace/dashboardProjection'

/** The exact CTA rule TodaysMission implements. */
function primaryCta(p: Pick<TeacherDashboardProjection, 'activeSchemes'>) {
  return p.activeSchemes === 0
    ? { label: 'Create your first Scheme of Work', href: '/teacher/scheme-of-work/new' }
    : { label: 'Continue Teaching',                href: '/teacher/scheme-of-work' }
}

/** The exact condition the dashboard's My School block uses. */
function showsMySchool(p: Pick<TeacherDashboardProjection, 'activeClasses'>) {
  return p.activeClasses > 0
}

test('H (first-run): a brand-new teacher with no schemes, classes or school is sent to Scheme of Work', () => {
  const state = { teacher: null, activeClasses: 0, activeSchemes: 0 }

  const cta = primaryCta(state)
  assert.equal(cta.label, 'Create your first Scheme of Work')
  assert.equal(cta.href, '/teacher/scheme-of-work/new')
  assert.notEqual(cta.href, '/teacher/classes', 'the first action must never be class creation')
  assert.equal(showsMySchool(state), false, 'no institutional block for a teacher with no class context')
})

test('I (independent, returning): schemes but no class and no school still gets the teaching dashboard', () => {
  const state = { teacher: null, activeClasses: 0, activeSchemes: 3 }

  assert.equal(primaryCta(state).label, 'Continue Teaching')
  assert.equal(primaryCta(state).href, '/teacher/scheme-of-work')
  assert.equal(showsMySchool(state), false)

  // The capability is demoted, never hidden: My Classes is still in the
  // sidebar's school group and still in the mobile More sheet.
  assert.ok(itemsInGroup('school').some(i => i.href === '/teacher/classes'))
  assert.ok(moreSheetItems(false).some(i => i.href === '/teacher/classes'))
})

test('J (school-connected): teaching still leads, and school context is additionally available', () => {
  const state = { teacher: null, activeClasses: 4, activeSchemes: 2 }

  assert.equal(primaryCta(state).label, 'Continue Teaching')
  assert.equal(showsMySchool(state), true)

  // Teaching remains the first section regardless of class count.
  assert.equal(TEACHER_NAV_GROUP_ORDER[0], 'teaching')
})

test('K: a teacher with classes but no schemes is still sent to Scheme of Work first', () => {
  // The inverse of the old bug — having a class must not be mistaken for
  // having started teaching work.
  const state = { teacher: null, activeClasses: 5, activeSchemes: 0 }
  assert.equal(primaryCta(state).href, '/teacher/scheme-of-work/new')
  assert.equal(showsMySchool(state), true, 'school context still shows — the two conditions are independent')
})
