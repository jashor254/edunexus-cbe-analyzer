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
// This is a navigation/labeling change only. It does not move any route,
// does not change any page's authorization, and does not introduce any new
// canonical domain — per ADR-0019 §5, the Workspace owns navigation,
// presentation, and composition, never educational truth.

import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, BookOpen, FileText, BarChart3,
  AlertTriangle, ClipboardList, Settings,
  Scroll, NotebookPen, Sparkles, FolderOpen, GraduationCap, BookMarked,
  Languages, Presentation, CalendarCheck, UserCheck, PieChart, Building2,
} from 'lucide-react'

export type TeacherNavItem = {
  href: string
  icon: LucideIcon
  label: string
  /** One-line disambiguation shown only where the label alone could be confused with a sibling item (PRP-1's "Reports" vs "End of Term" finding). */
  hint?: string
  /**
   * Which mobile bottom-nav sheet this item belongs to. `undefined` means
   * the item is one of the bottom-nav's own primary tabs (My Day / My
   * Classes / Alerts), rendered directly by TeacherBottomNav rather than
   * pulled from either sheet.
   */
  mobileGroup?: 'create' | 'more'
}

// ADR-0019 §4 — the nine permanent Teacher Workspace sections. Order here
// is the desktop sidebar's order; mobileGroup decides bottom-nav placement.
export const TEACHER_WORKSPACE_NAV: TeacherNavItem[] = [
  { href: '/teacher/dashboard',      icon: LayoutDashboard, label: 'My Day' },
  { href: '/teacher/classes',        icon: BookOpen,        label: 'My Classes' },

  // Teaching — Scheme of Work / Lesson Plans / Record of Work remain three
  // routes (the underlying sow_id-chained pipeline isn't changed by this
  // sprint), grouped under one taxonomy label per ADR-0019 §4 rather than
  // presented as three unrelated peers.
  { href: '/teacher/scheme-of-work', icon: Scroll,          label: 'Scheme of Work',  mobileGroup: 'create' },
  { href: '/teacher/lesson-plans',   icon: NotebookPen,     label: 'Lesson Plans',    mobileGroup: 'create' },
  { href: '/teacher/record-of-work', icon: ClipboardList,   label: 'Record of Work',  mobileGroup: 'create' },

  { href: '/teacher/attendance',     icon: UserCheck,       label: 'Attendance',      mobileGroup: 'more' },

  // Assessment — PRP-1 found no unifying nav entry existed; marks entry and
  // end-of-term lock/publish are two steps of one job a teacher couldn't
  // previously reach from one place.
  { href: '/teacher/assessment',     icon: PieChart,        label: 'Assessment',      mobileGroup: 'more' },

  // Reports — PRP-1's sharpest finding: "Reports" and "End of Term" shared
  // an ambiguous label for two different artifacts. Relabeled so the name
  // itself discloses which is which.
  { href: '/teacher/reports',        icon: ClipboardList,   label: 'Parent Reports',         hint: 'WhatsApp / email / clinic PDF', mobileGroup: 'more' },
  { href: '/teacher/core-term',      icon: CalendarCheck,   label: 'Official Report Cards',  hint: 'Lock, generate, publish',       mobileGroup: 'more' },

  // Insights — PRP-1 found this had zero nav entry despite being fully
  // built (backend + UI). Presentation only; no new computation.
  { href: '/teacher/insights',       icon: Sparkles,        label: 'Insights',       mobileGroup: 'more' },

  { href: '/teacher/alerts',         icon: AlertTriangle,   label: 'Alerts' },

  // Teaching Tools — secondary grouping so these don't compete with the
  // sections above for primary nav weight (ADR-0019 §4).
  { href: '/teacher/documents',      icon: FolderOpen,      label: 'Documents',      hint: 'Progress & downloads', mobileGroup: 'create' },
  { href: '/teacher/booklets',       icon: BookMarked,      label: 'Booklets',       mobileGroup: 'more' },
  { href: '/teacher/assignments',    icon: FileText,        label: 'Assignments',    mobileGroup: 'more' },
  { href: '/teacher/slides',         icon: Presentation,    label: 'AI Slides',      mobileGroup: 'create' },
  { href: '/teacher/kiswahili/insha',icon: Languages,       label: 'Insha Feedback', mobileGroup: 'more' },
  { href: '/teacher/analytics',      icon: BarChart3,       label: 'Analytics',      mobileGroup: 'more' },
  { href: '/teacher/academy',        icon: GraduationCap,   label: 'AI Academy',     mobileGroup: 'more' },

  { href: '/teacher/settings',       icon: Settings,        label: 'Settings',       mobileGroup: 'more' },
]

// School Office — deliberately NOT part of TEACHER_WORKSPACE_NAV (ADR-0019
// §4: explicitly excluded from the Workspace's identity). Kept as a
// separate export, appended only for admin-tier users, exactly as before
// this sprint — this sprint moves labeling/grouping, never who can reach it.
export const SCHOOL_OFFICE_NAV_ITEM: TeacherNavItem = {
  href: '/teacher/core-office',
  icon: Building2,
  label: 'School Office',
}

export function createSheetItems(): TeacherNavItem[] {
  return TEACHER_WORKSPACE_NAV.filter(item => item.mobileGroup === 'create')
}

export function moreSheetItems(isAdminTier?: boolean): TeacherNavItem[] {
  const items = TEACHER_WORKSPACE_NAV.filter(item => item.mobileGroup === 'more')
  return isAdminTier ? [...items, SCHOOL_OFFICE_NAV_ITEM] : items
}
