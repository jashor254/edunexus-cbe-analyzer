// lib/config/teacherWorkspaceNav.ts
//
// PRP-2 (Teacher Workspace Foundation Implementation, per ADR-0019 §4/§7) —
// the single canonical nav taxonomy for every /teacher/* surface. Before
// this file, TeacherSidebar and TeacherBottomNav each maintained their own
// item list, which had drifted into two different groupings for the same
// shell (PRP-1 audit finding). This file is the one source of truth both
// components now render from — CLAUDE.md's "no duplicate constant
// definitions across files" applied to navigation, not just payments/costs.
//
// ── Teacher Workspace Convergence, Phase 1 (Option B) ───────────────────────
//
// The nineteen destinations below were previously one flat list in which
// "My Classes" sat at position 2 and the three stages of the actual teaching
// workflow sat at 3, 4 and 5 — visually identical to Attendance, Analytics
// and Settings. The Phase 0 audit proved (by grep, across lib/sow,
// lib/lessonPlan, lib/row and their API routes) that the teaching chain has
// *zero* coupling to teacher_classes, Core classes or school membership: an
// independent teacher can run the entire professional workflow. The
// navigation said the opposite.
//
// This sprint adds a `group` to each item and orders the groups so teaching
// leads. That is the whole change. It is presentation only:
//
//   * No href changed. Every route, page and API is untouched.
//   * No capability was removed. "My Classes" keeps its route, its page and
//     its Create Class button — it moves from position 2 into My School and
//     gives up its mobile bottom-tab slot, nothing more.
//   * School Office keeps its separate export and its admin-tier gate
//     (ADR-0019 §4), and is deliberately not given a group.
//
// The contract is enforced by lib/config/teacherWorkspaceNav.test.ts, which
// asserts every destination by name rather than by array length.

import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, BookOpen, FileText, BarChart3,
  AlertTriangle, ClipboardList, Settings,
  Scroll, NotebookPen, Sparkles, FolderOpen, GraduationCap, BookMarked,
  Languages, Presentation, CalendarCheck, UserCheck, PieChart, Building2,
} from 'lucide-react'

/**
 * The four sections of the Teacher Workspace.
 *
 *  teaching — the professional teaching cycle. Works with no class and no
 *             school; this is the product's centre.
 *  school   — capabilities scoped to a class or owned by an institution.
 *  insights — read-only intelligence over teaching and learners.
 *  tools    — teacher-owned utilities outside the document chain.
 */
export type TeacherNavGroup = 'teaching' | 'school' | 'insights' | 'tools'

export type TeacherNavItem = {
  href: string
  icon: LucideIcon
  label: string
  /** One-line disambiguation shown only where the label alone could be confused with a sibling item (PRP-1's "Reports" vs "End of Term" finding). */
  hint?: string
  /**
   * Section this item belongs to. `undefined` marks a top-level anchor
   * (My Day, Settings) that sits outside the grouped sections.
   */
  group?: TeacherNavGroup
  /**
   * Which mobile bottom-nav sheet this item belongs to. `undefined` means
   * the item is one of the bottom-nav's own primary tabs (My Day / Alerts),
   * rendered directly by TeacherBottomNav rather than pulled from a sheet.
   */
  mobileGroup?: 'teaching' | 'create' | 'more'
}

/** Rendered section headers. Sidebar reads these; nothing else defines them. */
export const TEACHER_NAV_GROUPS: Record<TeacherNavGroup, string> = {
  teaching: 'My Teaching',
  school:   'My School',
  insights: 'Insights',
  tools:    'Tools',
}

/** Display order of the sections. Teaching leads — that is the point of Phase 1. */
export const TEACHER_NAV_GROUP_ORDER: readonly TeacherNavGroup[] = [
  'teaching', 'school', 'insights', 'tools',
] as const

// ADR-0019 §4 — the permanent Teacher Workspace sections. Order here is the
// desktop sidebar's order; `group` decides the section, `mobileGroup` decides
// bottom-nav placement.
export const TEACHER_WORKSPACE_NAV: TeacherNavItem[] = [
  // ── Anchor ────────────────────────────────────────────────────────────────
  { href: '/teacher/dashboard', icon: LayoutDashboard, label: 'My Day' },

  // ── My Teaching ───────────────────────────────────────────────────────────
  // The proven chain, in workflow order: plan the term, prepare the week,
  // record what happened, print it. These four are the mobile Teaching sheet.
  { href: '/teacher/scheme-of-work', icon: Scroll,        label: 'Scheme of Work',        group: 'teaching', mobileGroup: 'teaching' },
  { href: '/teacher/lesson-plans',   icon: NotebookPen,   label: 'Lesson Plans',          group: 'teaching', mobileGroup: 'teaching' },
  { href: '/teacher/record-of-work', icon: ClipboardList, label: 'Record of Work',        group: 'teaching', mobileGroup: 'teaching' },
  // Relabelled from "Documents" — the page is the document library and export
  // surface, not a progress dashboard. Route unchanged.
  { href: '/teacher/documents',      icon: FolderOpen,    label: 'Documents & Downloads', group: 'teaching', mobileGroup: 'teaching', hint: 'Print & export' },
  { href: '/teacher/booklets',       icon: BookMarked,    label: 'Booklets',              group: 'teaching', mobileGroup: 'more' },

  // ── My School ─────────────────────────────────────────────────────────────
  // Class-scoped and institution-owned capabilities. My Classes keeps its
  // route and its Create Class button; it is demoted in prominence only.
  { href: '/teacher/classes',    icon: BookOpen,      label: 'My Classes',            group: 'school', mobileGroup: 'more' },
  { href: '/teacher/attendance', icon: UserCheck,     label: 'Attendance',            group: 'school', mobileGroup: 'more' },
  { href: '/teacher/assignments',icon: FileText,      label: 'Assignments',           group: 'school', mobileGroup: 'more' },
  // Assessment — PRP-1 found no unifying nav entry existed; marks entry and
  // end-of-term lock/publish are two steps of one job.
  { href: '/teacher/assessment', icon: PieChart,      label: 'Assessment',            group: 'school', mobileGroup: 'more' },
  // PRP-1's sharpest finding: "Reports" and "End of Term" shared an ambiguous
  // label for two different artifacts. The names now disclose which is which.
  { href: '/teacher/core-term',  icon: CalendarCheck, label: 'Official Report Cards', group: 'school', hint: 'Lock, generate, publish',       mobileGroup: 'more' },
  { href: '/teacher/reports',    icon: ClipboardList, label: 'Parent Reports',        group: 'school', hint: 'WhatsApp / email / clinic PDF', mobileGroup: 'more' },

  // ── Insights ──────────────────────────────────────────────────────────────
  { href: '/teacher/alerts',    icon: AlertTriangle, label: 'Alerts',    group: 'insights' },
  { href: '/teacher/insights',  icon: Sparkles,      label: 'Insights',  group: 'insights', mobileGroup: 'more' },
  { href: '/teacher/analytics', icon: BarChart3,     label: 'Analytics', group: 'insights', mobileGroup: 'more' },

  // ── Tools ─────────────────────────────────────────────────────────────────
  { href: '/teacher/slides',          icon: Presentation,  label: 'AI Slides',      group: 'tools', mobileGroup: 'create' },
  { href: '/teacher/kiswahili/insha', icon: Languages,     label: 'Insha Feedback', group: 'tools', mobileGroup: 'more' },
  { href: '/teacher/academy',         icon: GraduationCap, label: 'AI Academy',     group: 'tools', mobileGroup: 'more' },

  // ── Anchor ────────────────────────────────────────────────────────────────
  { href: '/teacher/settings', icon: Settings, label: 'Settings', mobileGroup: 'more' },
]

// School Office — deliberately NOT part of TEACHER_WORKSPACE_NAV (ADR-0019
// §4: explicitly excluded from the Workspace's identity) and deliberately
// ungrouped. Kept as a separate export, appended only for admin-tier users,
// exactly as before — Phase 1 moves labelling and grouping, never who can
// reach it.
export const SCHOOL_OFFICE_NAV_ITEM: TeacherNavItem = {
  href: '/teacher/core-office',
  icon: Building2,
  label: 'School Office',
}

/** Items in a section, in declaration order. Sidebar renders section by section. */
export function itemsInGroup(group: TeacherNavGroup): TeacherNavItem[] {
  return TEACHER_WORKSPACE_NAV.filter(item => item.group === group)
}

/** Top-level anchors (My Day, Settings) — rendered outside the sections. */
export function ungroupedItems(): TeacherNavItem[] {
  return TEACHER_WORKSPACE_NAV.filter(item => item.group === undefined)
}

/**
 * Mobile "Teaching" sheet — the professional workflow, one tap from the
 * bottom bar. This tab replaced "Classes", whose slot was permanently empty
 * for independent teachers and second-class for everyone else.
 */
export function teachingSheetItems(): TeacherNavItem[] {
  return TEACHER_WORKSPACE_NAV.filter(item => item.mobileGroup === 'teaching')
}

/** Mobile "Create" sheet — genuinely generative actions only. */
export function createSheetItems(): TeacherNavItem[] {
  return TEACHER_WORKSPACE_NAV.filter(item => item.mobileGroup === 'create')
}

/** Mobile "More" sheet — everything else, School Office only for admin-tier. */
export function moreSheetItems(isAdminTier?: boolean): TeacherNavItem[] {
  const items = TEACHER_WORKSPACE_NAV.filter(item => item.mobileGroup === 'more')
  return isAdminTier ? [...items, SCHOOL_OFFICE_NAV_ITEM] : items
}
