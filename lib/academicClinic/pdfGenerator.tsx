// lib/academicClinic/pdfGenerator.tsx
// Junior School:  3-page parent decision-support report (Grades 7–9)
// Senior School:  3-page parent decision-support report (Grades 10–12)

import React from 'react'
import {
  Document, Page, Text, View, StyleSheet, Svg, Circle, Polygon,
} from '@react-pdf/renderer'
import type { AcademicClinicReport, SubjectProgress } from './reportGenerator'
import type {
  PathwayReadinessCard, PathwayGapRow,
  JuniorActionPriority, SeniorActionPriority,
  CareerInsightCard,
} from './types'
import type { RootCauseResult } from '@/lib/knowledgeGraph/types'
import { getLevelLabel, getClinicalObservation } from './reportGenerator'

// ─── Color Palette ────────────────────────────────────────────────────────────

const C = {
  navy:      '#1a2744',
  navyLight: '#243358',
  white:     '#ffffff',
  offWhite:  '#f8fafc',
  border:    '#e2e8f0',
  text:      '#1e293b',
  muted:     '#64748b',
  gold:      '#f59e0b',
  goldLight: '#fef3c7',
  l1: '#dc2626', l1bg: '#fee2e2',
  l2: '#d97706', l2bg: '#fef3c7',
  l3: '#16a34a', l3bg: '#dcfce7',
  l4: '#7c3aed', l4bg: '#ede9fe',
  improving: '#16a34a', stable: '#3b82f6', attention: '#d97706', critical: '#dc2626',
}

function levelColor(l: number)  { return [C.l1, C.l2, C.l3, C.l4][l - 1] ?? C.muted }
function levelBg(l: number)     { return [C.l1bg, C.l2bg, C.l3bg, C.l4bg][l - 1] ?? C.offWhite }
function trendArrow(t: string)  { return t === 'improving' ? '+' : t === 'declining' ? '-' : '=' }
function trendColor(t: string)  { return t === 'improving' ? C.l3 : t === 'declining' ? C.l1 : C.muted }

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page:     { backgroundColor: C.white, fontFamily: 'Helvetica', paddingBottom: 50 },

  // Page header
  pageHeader:      { backgroundColor: C.navy, paddingHorizontal: 36, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageHeaderBrand: { fontSize: 8, color: C.gold, letterSpacing: 2 },
  pageHeaderName:  { fontSize: 9, color: '#94a3b8', marginTop: 2 },
  pageHeaderProvenance: { fontSize: 6, color: '#64748b', marginTop: 2 },
  pageHeaderRight: { alignItems: 'flex-end' },
  pageHeaderPage:  { fontSize: 8, color: '#94a3b8' },
  pageHeaderId:    { fontSize: 7, color: '#475569', marginTop: 2 },
  pageGoldLine:    { height: 2, backgroundColor: C.gold },

  // Page footer
  pageFooter:     { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 36, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageFooterText: { fontSize: 7, color: C.muted },

  // Content
  content: { paddingHorizontal: 36, paddingTop: 20 },

  // Section labels
  sectionLabel: { fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 4 },
  sectionTitle: { fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 },
  divider:      { borderTopWidth: 1, borderTopColor: C.border, marginVertical: 14 },
  dividerThin:  { borderTopWidth: 1, borderTopColor: C.border, marginVertical: 10 },

  // Badges
  badge:        { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 4 },
  badgeText:    { fontSize: 9, fontWeight: 700, letterSpacing: 1 },
  levelCircle:  { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  levelCircleText: { fontSize: 11, fontWeight: 700 },

  // List rows
  listRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  listDot:  { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  listText: { fontSize: 9.5, color: C.text, flex: 1 },
  listLevel:{ fontSize: 8, color: C.muted },

  // Progress bar
  barTrack: { flex: 1, height: 8, backgroundColor: C.border, borderRadius: 4, marginHorizontal: 8, overflow: 'hidden' },
  barFill:  { height: 8, borderRadius: 4 },

  // Readiness track
  readinessTrack: { height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  readinessFill:  { height: 8, borderRadius: 4 },

  // Clinical paragraph
  clinBox:  { backgroundColor: C.offWhite, borderRadius: 6, padding: 14, borderLeftWidth: 3, borderLeftColor: C.gold, marginBottom: 14 },
  clinText: { fontSize: 9.5, color: C.text, lineHeight: 1.6 },

  // Subject row (compact grid)
  subjectGridRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.border },
  subjectDot:      { width: 8, height: 8, borderRadius: 2, marginRight: 6 },
  subjectGridName: { fontSize: 8.5, color: C.text, flex: 1 },

  // Gap table
  gapRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },

  // Compass Rx box
  rxBox:       { backgroundColor: C.navy, borderRadius: 6, padding: 14, marginBottom: 12 },
  rxTitle:     { fontSize: 9, color: C.gold, letterSpacing: 1, marginBottom: 6 },
  rxLabel:     { fontSize: 7.5, color: '#94a3b8', letterSpacing: 0.5, marginBottom: 2 },
  rxValue:     { fontSize: 10, color: C.white, marginBottom: 8 },
  rxDetailRow: { flexDirection: 'row', marginBottom: 5 },
  rxDetailKey: { fontSize: 8, color: '#94a3b8', width: 110 },
  rxDetailVal: { fontSize: 8.5, color: C.white, flex: 1, lineHeight: 1.4 },
  rxCTA:       { backgroundColor: C.gold, borderRadius: 4, paddingVertical: 6, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  rxCtaText:   { fontSize: 9, fontWeight: 700, color: C.navy, flex: 1 },
  rxCtaLink:   { fontSize: 9, fontWeight: 700, color: C.navy },

  // Priority blocks
  priorityBlock:   { borderLeftWidth: 3, borderRadius: 4, paddingLeft: 12, paddingRight: 10, paddingVertical: 10, marginBottom: 12 },
  priorityRankRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  priorityRankBadge: { width: 22, height: 22, borderRadius: 3, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  priorityRankText:  { fontSize: 10, fontWeight: 700 },
  prioritySubject:   { fontSize: 12, fontWeight: 700, color: C.text },
  priorityLevelRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  priorityDetailRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  priorityKey:       { fontSize: 8, color: C.muted, width: 100 },
  priorityVal:       { fontSize: 8.5, color: C.text, flex: 1, lineHeight: 1.4 },

  // Parent action
  parentActionBox: { borderWidth: 1.5, borderColor: C.gold, borderRadius: 6, padding: 12, marginBottom: 12, backgroundColor: C.goldLight },
  parentActionLabel:{ fontSize: 8, fontWeight: 700, color: '#92400e', letterSpacing: 1, marginBottom: 5 },
  parentActionText: { fontSize: 9.5, color: '#78350f', lineHeight: 1.5 },

  // Career directions (junior)
  careerDirBox:  { backgroundColor: C.offWhite, borderRadius: 6, padding: 12, marginBottom: 10 },
  careerDirTitle:{ fontSize: 9, fontWeight: 700, color: C.text, letterSpacing: 1, marginBottom: 6 },
  careerDirItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  careerDirDot:  { width: 5, height: 5, borderRadius: 3, backgroundColor: C.navy, marginRight: 8 },
  careerDirText: { fontSize: 9, color: C.text },

  // Senior readiness indicators
  indicatorRow:    { flexDirection: 'row', marginBottom: 14 },
  indicatorCard:   { flex: 1, borderRadius: 6, padding: 10, marginRight: 8 },
  indicatorLabel:  { fontSize: 7.5, color: C.muted, letterSpacing: 0.5, marginBottom: 4 },
  indicatorValue:  { fontSize: 11, fontWeight: 700, marginBottom: 4 },
  indicatorDetail: { fontSize: 8, lineHeight: 1.4 },

  // Career insight cards (senior)
  insightCard:      { borderWidth: 1, borderColor: C.border, borderRadius: 5, padding: 10, marginBottom: 8 },
  insightHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  insightName:      { fontSize: 10, fontWeight: 700, color: C.text, flex: 1 },
  insightAlignment: { fontSize: 12, fontWeight: 700, color: C.navy },
  insightMetaRow:   { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  insightMetaChip:  { flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 2 },
  insightMetaKey:   { fontSize: 7.5, color: C.muted, marginRight: 3 },
  insightMetaVal:   { fontSize: 7.5, fontWeight: 700, color: C.text },
  insightExamples:  { fontSize: 7.5, color: C.muted, lineHeight: 1.3 },

  // Future scenario
  scenarioRow: { flexDirection: 'row', marginTop: 8 },
  scenarioBox: { flex: 1, borderRadius: 6, padding: 12 },
  scenarioTitle: { fontSize: 8, fontWeight: 700, letterSpacing: 0.5, marginBottom: 6 },
  scenarioBody:  { fontSize: 8.5, lineHeight: 1.45 },
  scenarioCheck: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  scenarioCheckMark: { fontSize: 9, fontWeight: 700, width: 14 },
  scenarioCheckText: { fontSize: 8.5, flex: 1, lineHeight: 1.35 },

  // Senior pathway readiness score (page 1)
  snapshotScoreBlock: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  snapshotScoreCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 5, justifyContent: 'center', alignItems: 'center' },
  snapshotScoreValue:  { fontSize: 26, fontWeight: 700 },
  snapshotScoreLabel:  { fontSize: 8, color: C.muted, marginTop: 4, textAlign: 'center' },

  // Root cause chain section
  rcBox:        { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, padding: 10, marginBottom: 10, backgroundColor: '#f8fafc' },
  rcHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  rcTitle:      { fontSize: 8, fontWeight: 700, color: C.navy, letterSpacing: 1 },
  rcBadge:      { fontSize: 7, fontWeight: 700, color: '#6366f1', backgroundColor: '#ede9fe', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  rcChainRow:   { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 3 },
  rcNode:       { fontSize: 8, color: C.text, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#e2e8f0', borderRadius: 3, marginRight: 2 },
  rcNodeRoot:   { fontSize: 8, color: '#ffffff', paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#dc2626', borderRadius: 3, marginRight: 2 },
  rcArrow:      { fontSize: 8, color: C.muted, marginRight: 2 },
  rcRemedy:     { fontSize: 7.5, color: C.muted, marginTop: 3, lineHeight: 1.4 },
})

// ─── Shared Components ────────────────────────────────────────────────────────

// Phase 3 (Learner Report Architecture — document identity/provenance):
// "EduNexus Learner Blueprint" was stale branding that collided with the
// real, separate Blueprint product domain (lib/learnerBlueprint/) — see the
// Phase 3 closeout's naming decision. "Learner Intelligence Report" is the
// canonical user-facing name: it signals EduNexus's interpretation of
// learner evidence, distinct from both the official school Report Card
// (school-recorded fact) and Blueprint (the actionable-intervention domain).
function PageHeader({ name, grade, pageNum, totalPages, reportId }: {
  name: string; grade: number; pageNum: number; totalPages: number; reportId: string
}) {
  return (
    <View>
      <View style={S.pageHeader}>
        <View>
          <Text style={S.pageHeaderBrand}>EDUNEXUS LEARNER INTELLIGENCE REPORT</Text>
          <Text style={S.pageHeaderName}>{name} · Grade {grade}</Text>
          <Text style={S.pageHeaderProvenance}>
            Generated by EduNexus from available learner evidence — not a substitute for teacher judgment
          </Text>
        </View>
        <View style={S.pageHeaderRight}>
          {/* P1 pilot fix (Pilot Artifact Acceptance phase): the authored
              layout targets 3 logical pages, but page 3's content can
              overflow onto an auto-generated physical page in
              @react-pdf/renderer — a static "Page X of 3" then lies to the
              reader on every page. render() reports the true physical
              pageNumber/totalPages for the actual rendered PDF, so this
              stays honest regardless of overflow. Do not revert to a
              static totalPages prop. */}
          <Text style={S.pageHeaderPage} render={({ pageNumber, totalPages: actualTotal }) => `Page ${pageNumber} of ${actualTotal}`} />
          <Text style={S.pageHeaderId}>{reportId}</Text>
        </View>
      </View>
      <View style={S.pageGoldLine} />
    </View>
  )
}

function PageFooter({ reportId }: { reportId: string }) {
  return (
    <View style={S.pageFooter}>
      <Text style={S.pageFooterText}>{reportId}</Text>
      <Text style={S.pageFooterText}>CONFIDENTIAL — For Parent and Teacher Use Only</Text>
      <Text style={S.pageFooterText}>edunexus.co.ke</Text>
    </View>
  )
}

// ─── Root Cause Chain Box ─────────────────────────────────────────────────────
// Shows the top 2 root cause chains from the knowledge graph when data is available

function RootCauseChainBox({ causes }: { causes: RootCauseResult[] }) {
  if (!causes || causes.length === 0) return null

  // Take the 2 most critical failing topics (biggest gap = lowest performance)
  const top2 = [...causes]
    .sort((a, b) => (3 - a.performance) - (3 - b.performance))
    .slice(0, 2)

  return (
    <View style={S.rcBox}>
      <View style={S.rcHeader}>
        <Text style={S.rcTitle}>ROOT CAUSE ANALYSIS — KNOWLEDGE GRAPH</Text>
        <Text style={S.rcBadge}>AI-Free · Graph Traversal</Text>
      </View>
      {top2.map((result, i) => {
        const deepestCause = result.root_causes[0]
        return (
          <View key={i} style={{ marginBottom: i < top2.length - 1 ? 8 : 0 }}>
            <View style={S.rcChainRow}>
              {/* Root cause node (deepest blocker) */}
              {deepestCause && (
                <>
                  <Text style={S.rcNodeRoot}>{deepestCause.name}</Text>
                  <Text style={S.rcArrow}>{'->'}</Text>
                </>
              )}
              {/* Middle nodes in the chain (up to 2 more) */}
              {result.root_causes.slice(1, 3).map((c, j) => (
                <React.Fragment key={j}>
                  <Text style={S.rcNode}>{c.name}</Text>
                  <Text style={S.rcArrow}>{'->'}</Text>
                </React.Fragment>
              ))}
              {/* Failing topic at the end */}
              <Text style={[S.rcNode, { backgroundColor: '#fef3c7', color: '#92400e' }]}>{result.failing_topic_name}</Text>
            </View>
            {deepestCause?.top_remediation && (
              <Text style={S.rcRemedy}>Intervention: {deepestCause.top_remediation}</Text>
            )}
          </View>
        )
      })}
    </View>
  )
}

function LevelBadge({ level }: { level: number }) {
  // P0 pilot fix (Pilot Artifact Acceptance phase): with zero subject
  // evidence, overallCompetencyLevel arrives as NaN (0/0 in
  // calculateVitals) and this badge used to render the literal text
  // "LEVEL NaN — UNKNOWN" to a parent/teacher. Never show a raw NaN in the
  // artifact — fall back to an honest "insufficient evidence" label.
  if (!Number.isFinite(level) || level < 1) {
    return (
      <View style={[S.badge, { backgroundColor: C.offWhite }]}>
        <Text style={[S.badgeText, { color: C.muted }]}>INSUFFICIENT EVIDENCE</Text>
      </View>
    )
  }
  return (
    <View style={[S.badge, { backgroundColor: levelBg(level) }]}>
      <Text style={[S.badgeText, { color: levelColor(level) }]}>
        LEVEL {level} — {getLevelLabel(level).toUpperCase()}
      </Text>
    </View>
  )
}

function TrajectoryBadge({ t }: { t: 'IMPROVING' | 'STABLE' | 'NEEDS ATTENTION' | 'CRITICAL' }) {
  const colors: Record<string, string> = { IMPROVING: C.l3, STABLE: '#3b82f6', 'NEEDS ATTENTION': C.l2, CRITICAL: C.l1 }
  const bgs:    Record<string, string> = { IMPROVING: C.l3bg, STABLE: '#dbeafe', 'NEEDS ATTENTION': C.l2bg, CRITICAL: C.l1bg }
  return (
    <View style={[S.badge, { backgroundColor: bgs[t] ?? C.offWhite }]}>
      <Text style={[S.badgeText, { color: colors[t] ?? C.muted }]}>{t}</Text>
    </View>
  )
}

function ProgressBar({ pct, color, height = 8 }: { pct: number; color: string; height?: number }) {
  return (
    <View style={[S.barTrack, { height }]}>
      <View style={[S.barFill, { width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color, height }]} />
    </View>
  )
}

function statusDot(color: string) {
  return <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color, marginRight: 4 }} />
}

function SubjectGrid({ subjects }: { subjects: SubjectProgress[] }) {
  const half   = Math.ceil(subjects.length / 2)
  const left   = subjects.slice(0, half)
  const right  = subjects.slice(half)
  const cols   = [left, right]
  return (
    <View style={{ flexDirection: 'row' }}>
      {cols.map((col, ci) => (
        <View key={ci} style={{ flex: 1, marginRight: ci === 0 ? 14 : 0 }}>
          {col.map((s, i) => (
            <View key={i} style={S.subjectGridRow}>
              <View style={[S.subjectDot, { backgroundColor: levelColor(s.level) }]} />
              <Text style={S.subjectGridName}>{s.displayName}</Text>
              <View style={[S.badge, { backgroundColor: levelBg(s.level), paddingVertical: 1, paddingHorizontal: 5 }]}>
                <Text style={[S.badgeText, { color: levelColor(s.level), fontSize: 7.5 }]}>L{s.level}</Text>
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

function GapTable({ rows }: { rows: PathwayGapRow[] }) {
  const gapColor = (r: PathwayGapRow) => r.status === 'met' ? C.l3 : r.status === 'one_step' ? C.l2 : C.l1
  return (
    <View style={{ marginTop: 4 }}>
      <View style={{ flexDirection: 'row', paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <Text style={{ fontSize: 7, color: C.muted, flex: 1 }}>SUBJECT</Text>
        <Text style={{ fontSize: 7, color: C.muted, width: 44, textAlign: 'center' }}>CURRENT</Text>
        <Text style={{ fontSize: 7, color: C.muted, width: 44, textAlign: 'center' }}>REQUIRED</Text>
        <Text style={{ fontSize: 7, color: C.muted, width: 50, textAlign: 'center' }}>STATUS</Text>
      </View>
      {rows.map((row, i) => (
        <View key={i} style={[S.gapRow]}>
          <Text style={{ fontSize: 8, color: C.text, flex: 1 }}>{row.displayName}</Text>
          <View style={{ width: 44, alignItems: 'center' }}>
            <View style={[S.badge, { backgroundColor: levelBg(row.currentLevel), paddingVertical: 1, paddingHorizontal: 4 }]}>
              <Text style={[S.badgeText, { color: levelColor(row.currentLevel), fontSize: 7 }]}>L{row.currentLevel}</Text>
            </View>
          </View>
          <View style={{ width: 44, alignItems: 'center' }}>
            <View style={[S.badge, { backgroundColor: levelBg(row.requiredLevel), paddingVertical: 1, paddingHorizontal: 4 }]}>
              <Text style={[S.badgeText, { color: levelColor(row.requiredLevel), fontSize: 7 }]}>L{row.requiredLevel}</Text>
            </View>
          </View>
          <View style={{ width: 50, alignItems: 'center' }}>
            {row.status === 'met'
              ? <Text style={{ fontSize: 8, color: C.l3, fontWeight: 700 }}>MET ✓</Text>
              : <Text style={{ fontSize: 7.5, color: gapColor(row), fontWeight: 700 }}>{row.gap === 1 ? '+1 LEVEL' : '+2 LEVELS'}</Text>
            }
          </View>
        </View>
      ))}
    </View>
  )
}

function PriorityBlock({ p, colors }: {
  p: JuniorActionPriority | SeniorActionPriority
  colors: { border: string; rankBg: string; blockBg: string; rankText: string }
}) {
  return (
    <View style={[S.priorityBlock, { borderLeftColor: colors.border, backgroundColor: colors.blockBg }]}>
      <View style={S.priorityRankRow}>
        <View style={[S.priorityRankBadge, { backgroundColor: colors.rankBg }]}>
          <Text style={[S.priorityRankText, { color: colors.rankText }]}>{p.rank}</Text>
        </View>
        <Text style={S.prioritySubject}>{p.subject}</Text>
      </View>
      <View style={S.priorityLevelRow}>
        <LevelBadge level={p.currentLevel} />
        {/* P1 pilot fix (Pilot Artifact Acceptance phase): the Unicode
            arrow (U+2192) has no glyph in @react-pdf's base Helvetica font
            and rendered as a stray apostrophe with a collapsed following
            space, on every single action-plan page in every fixture
            generated. Use the ASCII arrow everywhere in this file instead —
            do not reintroduce "→" here or in RootCauseChainBox / the
            cascade / future-scenario transition text below. */}
        <Text style={{ fontSize: 12, color: C.muted, marginHorizontal: 8 }}>{'->'}</Text>
        <LevelBadge level={p.targetLevel} />
      </View>
      <View style={S.priorityDetailRow}>
        <Text style={S.priorityKey}>Why it matters:</Text>
        <Text style={S.priorityVal}>{p.whyItMatters}</Text>
      </View>
      {'expectedBenefit' in p && (
        <View style={S.priorityDetailRow}>
          <Text style={S.priorityKey}>Expected benefit:</Text>
          <Text style={S.priorityVal}>{(p as SeniorActionPriority).expectedBenefit}</Text>
        </View>
      )}
      {'intervention' in p && (
        <View style={S.priorityDetailRow}>
          <Text style={S.priorityKey}>Intervention:</Text>
          <Text style={S.priorityVal}>{(p as JuniorActionPriority).intervention} · {p.timeline}</Text>
        </View>
      )}
      {'estimatedSessions' in p && !('intervention' in p) && (
        <View style={S.priorityDetailRow}>
          <Text style={S.priorityKey}>Compass:</Text>
          <Text style={S.priorityVal}>{p.estimatedSessions} sessions · {p.timeline}</Text>
        </View>
      )}
    </View>
  )
}

const PRIORITY_COLORS = [
  { border: C.l1, rankBg: C.l1, blockBg: '#fff5f5', rankText: C.white },
  { border: C.l2, rankBg: C.l2, blockBg: '#fffbeb', rankText: C.white },
  { border: '#3b82f6', rankBg: '#3b82f6', blockBg: '#eff6ff', rankText: C.white },
]

function RxBox({ subject, reason, outcome, sessions, timeline }: {
  subject: string; reason: string; outcome: string; sessions: number; timeline: string
}) {
  return (
    <View style={S.rxBox}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <View style={{ width: 32, height: 32, borderRadius: 5, backgroundColor: C.gold, justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
          <Text style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>Rx</Text>
        </View>
        <View>
          <Text style={S.rxTitle}>LEARNING COMPASS PRESCRIPTION</Text>
          <Text style={{ fontSize: 7.5, color: '#94a3b8' }}>edunexus.co.ke/learn</Text>
        </View>
      </View>
      <View style={S.rxDetailRow}><Text style={S.rxDetailKey}>Subject:</Text><Text style={S.rxDetailVal}>{subject}</Text></View>
      <View style={S.rxDetailRow}><Text style={S.rxDetailKey}>Reason:</Text><Text style={S.rxDetailVal}>{reason}</Text></View>
      <View style={S.rxDetailRow}><Text style={S.rxDetailKey}>Expected outcome:</Text><Text style={S.rxDetailVal}>{outcome}</Text></View>
      <View style={S.rxDetailRow}><Text style={S.rxDetailKey}>Estimated sessions:</Text><Text style={S.rxDetailVal}>{sessions}</Text></View>
      <View style={S.rxDetailRow}><Text style={S.rxDetailKey}>Expected timeline:</Text><Text style={S.rxDetailVal}>{timeline}</Text></View>
      <View style={S.rxCTA}>
        <Text style={S.rxCtaText}>Start your first session now</Text>
        <Text style={S.rxCtaLink}>edunexus.co.ke/learn</Text>
      </View>
    </View>
  )
}

// ─── JUNIOR PAGE 1: CURRENT POSITION ─────────────────────────────────────────

const PATHWAY_CAREER_DIRECTIONS: Record<string, string[]> = {
  'STEM':                  ['Medicine & Health Sciences', 'Engineering', 'Computing & Technology', 'Applied Sciences'],
  'Social Sciences':       ['Law', 'Education', 'Public Administration', 'Business & Finance', 'Community Development'],
  'Arts & Sports Science': ['Sports Science & Coaching', 'Creative Arts & Design', 'Media & Performing Arts', 'Physical Education'],
}

function JuniorCurrentPositionPage({ report }: { report: AcademicClinicReport }) {
  const sp      = report.studentProfile
  const co      = report.clinicalOverview
  const byDesc  = [...report.subjectBreakdown].sort((a, b) => b.level - a.level)
  const byAsc   = [...report.subjectBreakdown].sort((a, b) => a.level - b.level)
  const strengths = byDesc.filter(s => s.level >= 3).slice(0, 3)
  const priority  = byAsc.filter(s => s.level <= 2).slice(0, 3)
  const cards     = report.pathwayReadinessCards ?? []
  const pa        = report.pathwayAnalysis

  const STATUS_COLORS: Record<string, string> = {
    'Strongly Ready': C.l3, 'Within Reach': C.l2,
    'Requires Improvement': '#ea580c', 'Significant Preparation Needed': C.l1,
  }
  const STATUS_BG: Record<string, string> = {
    'Strongly Ready': C.l3bg, 'Within Reach': C.l2bg,
    'Requires Improvement': '#fff7ed', 'Significant Preparation Needed': C.l1bg,
  }

  return (
    <Page size="A4" style={S.page}>
      <PageHeader name={sp.name} grade={sp.grade} pageNum={1} totalPages={3} reportId={report.reportId} />
      <View style={S.content}>
        <Text style={S.sectionLabel}>JUNIOR SCHOOL · GRADES 7–9</Text>
        <Text style={S.sectionTitle}>Current Position</Text>

        {/* Identity + overall */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{sp.name}</Text>
            <Text style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
              Grade {sp.grade} · {sp.level} · Term {sp.term}, {sp.year}
              {sp.school ? ` · ${sp.school}` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 8 }}>
            <LevelBadge level={co.overallCompetencyLevel} />
            <TrajectoryBadge t={co.trajectory} />
          </View>
        </View>

        <View style={S.dividerThin} />

        {/* Pathway Readiness — pilot gate fix (2026-08-25): a zero-evidence
            learner has no cards (pathwayReadinessCards is never built when
            pathwayAnalysis.insufficientEvidence is true) and must not see an
            empty "CURRENT PATHWAY READINESS" heading over a blank row. */}
        {cards.length > 0 && (
          <>
            <Text style={{ fontSize: 9, fontWeight: 700, color: C.text, letterSpacing: 1, marginBottom: 8 }}>
              CURRENT PATHWAY READINESS
            </Text>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              {cards.map((card, i) => {
                const isRec   = card.pathway === pa?.recommendedPathway && !pa?.insufficientEvidence
                const statClr = STATUS_COLORS[card.statusLabel] ?? C.muted
                const statBg  = STATUS_BG[card.statusLabel] ?? C.offWhite
                return (
                  <View key={i} style={{
                    flex: 1, marginRight: i < cards.length - 1 ? 8 : 0,
                    borderRadius: 6, padding: 10,
                    backgroundColor: isRec ? C.navyLight : C.offWhite,
                    // P0 pilot fix (Pilot Artifact Acceptance phase): a literal
                    // `borderWidth: 0` here crashes every Junior School (Grade
                    // 7-9) PDF render — @react-pdf/stylesheet's border-shorthand
                    // resolver treats a falsy width (0) as "no shorthand match",
                    // falls through to `undefined`, and throws "Invalid border
                    // width: undefined". Always use a non-zero width and make it
                    // invisible via a border color matching the fill instead of
                    // via a zero width. Do not reintroduce `borderWidth: 0`
                    // anywhere in this renderer.
                    borderWidth: 1, borderColor: isRec ? C.navyLight : C.border,
                  }}>
                    {isRec && (
                      <Text style={{ fontSize: 6.5, color: C.gold, letterSpacing: 1, marginBottom: 2 }}>RECOMMENDED</Text>
                    )}
                    <Text style={{ fontSize: 9, fontWeight: 700, color: isRec ? C.white : C.text, marginBottom: 4 }}>
                      {card.pathway}
                    </Text>
                    <Text style={{ fontSize: 18, fontWeight: 700, color: isRec ? C.gold : statClr, marginBottom: 2 }}>
                      {card.score}%
                    </Text>
                    <View style={[S.badge, { backgroundColor: isRec ? '#ffffff22' : statBg, paddingHorizontal: 6, paddingVertical: 2 }]}>
                      <Text style={[S.badgeText, { color: isRec ? C.gold : statClr, fontSize: 7 }]}>
                        {card.statusLabel.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                )
              })}
            </View>
          </>
        )}

        {/* WHY explanation — honest zero-evidence state never falls back to
            co.clinicalParagraph (that text assumes real subject data). */}
        {pa && !pa.insufficientEvidence && (
          <View style={[S.clinBox, { marginBottom: 12 }]}>
            <Text style={{ fontSize: 7.5, color: C.gold, letterSpacing: 1, marginBottom: 4 }}>WHY</Text>
            <Text style={[S.clinText, { fontSize: 9 }]}>
              {cards.find(c => c.pathway === pa.recommendedPathway)?.diagnosis ?? co.clinicalParagraph}
            </Text>
          </View>
        )}
        {pa && pa.insufficientEvidence && (
          <View style={[S.clinBox, { marginBottom: 12 }]}>
            <Text style={{ fontSize: 7.5, color: C.gold, letterSpacing: 1, marginBottom: 4 }}>PATHWAY READINESS</Text>
            <Text style={[S.clinText, { fontSize: 9 }]}>
              No subject assessments are on record for this learner yet, so a pathway readiness signal is
              not available. Once at least one subject assessment is recorded, this section will show
              pathway readiness and a recommendation.
            </Text>
          </View>
        )}

        <View style={S.dividerThin} />

        {/* Strengths + Needs Attention */}
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          <View style={{ flex: 1, marginRight: 20 }}>
            <Text style={{ fontSize: 9, fontWeight: 700, color: C.l3, letterSpacing: 1, marginBottom: 7 }}>
              STRONGEST SUBJECTS
            </Text>
            {strengths.length > 0
              ? strengths.map((s, i) => (
                  <View key={i} style={S.listRow}>
                    <View style={[S.listDot, { backgroundColor: C.l3 }]} />
                    <Text style={[S.listText, { fontSize: 9 }]}>{s.displayName}</Text>
                    <View style={[S.badge, { backgroundColor: levelBg(s.level), paddingVertical: 1, paddingHorizontal: 6 }]}>
                      <Text style={[S.badgeText, { color: levelColor(s.level), fontSize: 7.5 }]}>L{s.level}</Text>
                    </View>
                  </View>
                ))
              : <Text style={{ fontSize: 9, color: C.muted }}>Building across all subjects</Text>
            }
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 9, fontWeight: 700, color: C.l1, letterSpacing: 1, marginBottom: 7 }}>
              NEEDS ATTENTION
            </Text>
            {priority.length > 0
              ? priority.map((s, i) => (
                  <View key={i} style={S.listRow}>
                    <View style={[S.listDot, { backgroundColor: C.l1 }]} />
                    <Text style={[S.listText, { fontSize: 9 }]}>{s.displayName}</Text>
                    <View style={[S.badge, { backgroundColor: levelBg(s.level), paddingVertical: 1, paddingHorizontal: 6 }]}>
                      <Text style={[S.badgeText, { color: levelColor(s.level), fontSize: 7.5 }]}>L{s.level}</Text>
                    </View>
                  </View>
                ))
              : <Text style={{ fontSize: 9, color: C.muted }}>No critical areas identified</Text>
            }
          </View>
        </View>

        <View style={S.dividerThin} />

        {/* Subject Performance Grid */}
        <Text style={{ fontSize: 9, fontWeight: 700, color: C.text, letterSpacing: 1, marginBottom: 7 }}>
          SUBJECT PERFORMANCE
        </Text>
        <SubjectGrid subjects={report.subjectBreakdown} />
      </View>
      <PageFooter reportId={report.reportId} />
    </Page>
  )
}

// ─── JUNIOR PAGE 2: PATHWAY OPPORTUNITY ANALYSIS ─────────────────────────────

function JuniorOpportunityPage({ report }: { report: AcademicClinicReport }) {
  const sp      = report.studentProfile
  const cards   = report.pathwayReadinessCards ?? []
  const pa      = report.pathwayAnalysis
  const cascade = report.juniorImprovementCascade

  const recCard = cards.find(c => c.pathway === pa?.recommendedPathway)

  const STATUS_LEGEND = [
    { label: 'Strongly Ready', color: '#16a34a' },
    { label: 'Within Reach',   color: '#d97706' },
    { label: 'Requires Improvement', color: '#ea580c' },
    { label: 'Significant Preparation Needed', color: '#dc2626' },
  ]

  const probColor = (p: string) => p === 'High' ? C.l3 : p === 'Medium' ? C.l2 : C.muted
  const probBg    = (p: string) => p === 'High' ? C.l3bg : p === 'Medium' ? C.l2bg : C.offWhite

  return (
    <Page size="A4" style={S.page}>
      <PageHeader name={sp.name} grade={sp.grade} pageNum={2} totalPages={3} reportId={report.reportId} />
      <View style={S.content}>
        <Text style={S.sectionLabel}>PATHWAY ANALYSIS · GRADES 7–9</Text>
        <Text style={S.sectionTitle}>Pathway Opportunity Analysis</Text>
        <View style={S.divider} />

        {/* CURRENT PATHWAY */}
        {recCard && (
          <View style={{ backgroundColor: C.navyLight, borderRadius: 6, padding: 14, marginBottom: 14 }}>
            <Text style={{ fontSize: 8, color: C.gold, letterSpacing: 1, marginBottom: 4 }}>CURRENT PATHWAY</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: 700, color: C.white, flex: 1 }}>{recCard.pathway}</Text>
              <Text style={{ fontSize: 20, fontWeight: 700, color: C.gold }}>{recCard.score}%</Text>
              <View style={[S.badge, { backgroundColor: '#ffffff22', marginLeft: 8 }]}>
                <Text style={[S.badgeText, { color: C.gold, fontSize: 7 }]}>{recCard.statusLabel.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 8.5, color: '#94a3b8', lineHeight: 1.45 }}>{recCard.diagnosis}</Text>
          </View>
        )}

        {/* NEXT DOOR OPPORTUNITY */}
        {cascade && cascade.subjectKey && (
          <View style={{ borderWidth: 1.5, borderColor: C.gold, borderRadius: 6, padding: 14, marginBottom: 14, backgroundColor: C.goldLight }}>
            <Text style={{ fontSize: 8, color: '#92400e', fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
              NEXT DOOR OPPORTUNITY
            </Text>
            <Text style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 10 }}>
              {cascade.targetPathway} Pathway
            </Text>

            {/* Requirements table */}
            <Text style={{ fontSize: 8, color: '#78350f', fontWeight: 700, letterSpacing: 0.5, marginBottom: 5 }}>REQUIREMENTS</Text>
            <View style={{ flexDirection: 'row', marginBottom: 8, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#d97706' }}>
              <Text style={{ fontSize: 7, color: '#78350f', flex: 1 }}>SUBJECT</Text>
              <Text style={{ fontSize: 7, color: '#78350f', width: 56, textAlign: 'center' }}>CURRENT</Text>
              <Text style={{ fontSize: 7, color: '#78350f', width: 56, textAlign: 'center' }}>REQUIRED</Text>
              <Text style={{ fontSize: 7, color: '#78350f', width: 36, textAlign: 'center' }}>GAP</Text>
              <Text style={{ fontSize: 7, color: '#78350f', width: 56, textAlign: 'center' }}>TIMELINE</Text>
              <Text style={{ fontSize: 7, color: '#78350f', width: 50, textAlign: 'center' }}>PROB.</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontSize: 8.5, fontWeight: 700, color: C.navy, flex: 1 }}>{cascade.displayName}</Text>
              <View style={{ width: 56, alignItems: 'center' }}>
                <View style={[S.badge, { backgroundColor: levelBg(cascade.currentLevel), paddingVertical: 1, paddingHorizontal: 4 }]}>
                  <Text style={[S.badgeText, { color: levelColor(cascade.currentLevel), fontSize: 7 }]}>L{cascade.currentLevel}</Text>
                </View>
              </View>
              <View style={{ width: 56, alignItems: 'center' }}>
                <View style={[S.badge, { backgroundColor: levelBg(cascade.targetLevel), paddingVertical: 1, paddingHorizontal: 4 }]}>
                  <Text style={[S.badgeText, { color: levelColor(cascade.targetLevel), fontSize: 7 }]}>L{cascade.targetLevel}</Text>
                </View>
              </View>
              <Text style={{ width: 36, fontSize: 8, fontWeight: 700, color: C.l1, textAlign: 'center' }}>
                +{cascade.gap}
              </Text>
              <Text style={{ width: 56, fontSize: 8, color: '#78350f', textAlign: 'center' }}>
                {cascade.estimatedTimeline}
              </Text>
              <View style={{ width: 50, alignItems: 'center' }}>
                <View style={[S.badge, { backgroundColor: probBg(cascade.probability), paddingVertical: 1, paddingHorizontal: 4 }]}>
                  <Text style={[S.badgeText, { color: probColor(cascade.probability), fontSize: 7 }]}>{cascade.probability.toUpperCase()}</Text>
                </View>
              </View>
            </View>

            {/* What happens if this improves */}
            <View style={{ backgroundColor: C.white, borderRadius: 5, padding: 10 }}>
              <Text style={{ fontSize: 8, fontWeight: 700, color: '#92400e', letterSpacing: 0.5, marginBottom: 4 }}>
                WHAT HAPPENS IF {cascade.displayName.toUpperCase()} IMPROVES?
              </Text>
              <Text style={{ fontSize: 8.5, color: '#78350f', marginBottom: 8 }}>
                {cascade.displayName} Level {cascade.currentLevel} {'->'} Level {cascade.targetLevel}
              </Text>
              <Text style={{ fontSize: 8, color: C.muted, letterSpacing: 0.5, marginBottom: 5 }}>Result:</Text>
              {cascade.unlocks.map((item, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 9, fontWeight: 700, color: C.l3, marginRight: 6 }}>✓</Text>
                  <Text style={{ fontSize: 8.5, color: C.text }}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Pilot gate fix (2026-08-25): "ALL PATHWAYS WITHIN REACH" is a
            claim ABOUT real evidence (every pathway is reachable given what
            we know) — it must never render for a learner we have no
            evidence for at all. `cascade` is also null in that case, so
            without this guard the zero-evidence report used to show this
            same falsely-reassuring banner. */}
        {!cascade && !pa?.insufficientEvidence && (
          <View style={{ backgroundColor: C.l3bg, borderRadius: 6, padding: 12, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: C.l3 }}>
            <Text style={{ fontSize: 9, fontWeight: 700, color: C.l3, marginBottom: 4 }}>ALL PATHWAYS WITHIN REACH</Text>
            <Text style={{ fontSize: 8.5, color: C.text }}>
              This learner's performance profile opens more than one pathway option. Focus on maintaining strong performance across all subjects to keep all options open before Grade 10.
            </Text>
          </View>
        )}
        {!cascade && pa?.insufficientEvidence && (
          <View style={{ backgroundColor: C.offWhite, borderRadius: 6, padding: 12, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: C.muted }}>
            <Text style={{ fontSize: 9, fontWeight: 700, color: C.muted, marginBottom: 4 }}>NOT ENOUGH EVIDENCE YET</Text>
            <Text style={{ fontSize: 8.5, color: C.text }}>
              This learner has no subject assessments on record for this term. Once the class teacher records at
              least one assessment, this page will show real pathway readiness and opportunity analysis.
            </Text>
          </View>
        )}

        {/* Status legend */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
          {STATUS_LEGEND.map((s, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 2 }}>
              {statusDot(s.color)}
              <Text style={{ fontSize: 7.5, color: C.muted }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* All pathway cards */}
        {cards.map((card, ci) => {
          const isRec = card.pathway === pa?.recommendedPathway && !pa?.insufficientEvidence
          return (
            <View key={ci} style={{
              borderLeftWidth: 3, borderLeftColor: card.statusColor,
              backgroundColor: isRec ? '#f0f7ff' : C.offWhite,
              paddingLeft: 10, paddingRight: 10, paddingVertical: 8,
              marginBottom: 8, borderRadius: 3,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                {statusDot(card.statusColor)}
                <Text style={{ fontSize: 10, fontWeight: 700, color: C.text, flex: 1 }}>{card.pathway}</Text>
                {isRec && (
                  <View style={[S.badge, { backgroundColor: C.navy, marginRight: 8 }]}>
                    <Text style={[S.badgeText, { color: C.gold, fontSize: 7 }]}>RECOMMENDED</Text>
                  </View>
                )}
                <Text style={{ fontSize: 9, fontWeight: 700, color: card.statusColor }}>{card.score}%</Text>
              </View>
              <View style={[S.readinessTrack, { marginBottom: 4, marginRight: 4 }]}>
                {/* P1 pilot fix (Pilot Artifact Acceptance phase): a raw
                    negative card.score (seen at zero/near-zero evidence)
                    produced an unclamped negative CSS width, which renders
                    as a near-FULL bar — the visual opposite of what a
                    negative/near-zero readiness score should show. Clamp to
                    [0, 100] for display only, matching the existing
                    ProgressBar helper's own clamp. */}
                <View style={[S.readinessFill, { width: `${Math.max(0, Math.min(100, card.score))}%`, backgroundColor: card.statusColor }]} />
              </View>
              <Text style={{ fontSize: 7.5, fontWeight: 700, color: card.statusColor, marginBottom: 2 }}>{card.statusLabel.toUpperCase()}</Text>
              {card.gapRows.length > 0 && <GapTable rows={card.gapRows} />}
            </View>
          )
        })}
      </View>
      <PageFooter reportId={report.reportId} />
    </Page>
  )
}

// ─── JUNIOR PAGE 3: ACTION PLAN ───────────────────────────────────────────────

function JuniorActionPlanPage({ report }: { report: AcademicClinicReport }) {
  const sp         = report.studentProfile
  const priorities = report.juniorActionPriorities ?? []
  const parentAct  = report.parentAction
  const pa         = report.pathwayAnalysis
  // Pilot gate fix (2026-08-25): this used to default to `'STEM'` whenever
  // `pa` was absent — which included the zero-evidence case — and then
  // unconditionally rendered "POSSIBLE FUTURE DIRECTIONS ... If the STEM
  // pathway continues: Medicine & Health Sciences, Engineering, ...", the
  // exact fabricated-career-families defect this phase closes. There is no
  // safe default pathway to fall back to; only compute one when there is a
  // real, evidence-backed recommendation.
  const hasPathwaySignal = !!pa && !pa.insufficientEvidence
  const recPathway = hasPathwaySignal ? pa!.recommendedPathway : null
  const directions = recPathway ? (PATHWAY_CAREER_DIRECTIONS[recPathway] ?? []) : []
  const top        = priorities[0]
  const dateStr    = new Date(report.generatedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <Page size="A4" style={S.page}>
      <PageHeader name={sp.name} grade={sp.grade} pageNum={3} totalPages={3} reportId={report.reportId} />
      <View style={S.content}>
        <Text style={S.sectionLabel}>ACTION PLAN · PATHWAY PREPARATION</Text>
        <Text style={S.sectionTitle}>Recommended Action Plan</Text>
        <View style={S.divider} />

        {/* 3 Priority Interventions */}
        {priorities.slice(0, 3).map((p, i) => (
          <PriorityBlock key={i} p={p} colors={PRIORITY_COLORS[i]} />
        ))}

        <View style={S.dividerThin} />

        {/* Parent Action */}
        {parentAct && (
          <View style={S.parentActionBox}>
            <Text style={S.parentActionLabel}>PARENT ACTION</Text>
            <Text style={S.parentActionText}>{parentAct.action}</Text>
          </View>
        )}
        {!parentAct && pa?.insufficientEvidence && (
          <View style={S.parentActionBox}>
            <Text style={S.parentActionLabel}>PARENT ACTION</Text>
            <Text style={S.parentActionText}>
              Ask your child's class teacher to record this term's subject assessments. Once at least one is
              on file, this report will show real pathway readiness, action priorities, and future directions.
            </Text>
          </View>
        )}

        {/* Rx Prescription */}
        {top && (
          <RxBox
            subject={top.subject}
            reason={top.compassReason}
            outcome={`Move from Level ${top.currentLevel} to Level ${top.targetLevel}`}
            sessions={top.estimatedSessions}
            timeline={top.timeline}
          />
        )}

        <View style={S.dividerThin} />

        {/* Root Cause Analysis (when strand assessment data is available) */}
        {(report.knowledgeRootCauses?.length ?? 0) > 0 && (
          <RootCauseChainBox causes={report.knowledgeRootCauses!} />
        )}

        {/* Junior Career Section — pilot gate fix (2026-08-25): never shown
            for a zero-evidence learner. Naming specific career families
            ("If the STEM pathway continues: Medicine & Health Sciences,
            Engineering...") when there is no evidence behind the pathway
            claim is the exact fabricated-career-families defect this phase
            closes. */}
        {hasPathwaySignal && recPathway && (
          <View style={S.careerDirBox}>
            <Text style={S.careerDirTitle}>POSSIBLE FUTURE DIRECTIONS</Text>
            <Text style={{ fontSize: 8, color: C.muted, marginBottom: 6 }}>
              If the {recPathway} pathway continues:
            </Text>
            {directions.map((dir, i) => (
              <View key={i} style={S.careerDirItem}>
                <View style={S.careerDirDot} />
                <Text style={S.careerDirText}>{dir}</Text>
              </View>
            ))}
            <View style={{ backgroundColor: C.navy + '12', borderRadius: 4, padding: 7, marginTop: 8 }}>
              <Text style={{ fontSize: 8, color: C.navy, fontWeight: 700, marginBottom: 2 }}>
                For your child's full Career Intelligence profile:
              </Text>
              <Text style={{ fontSize: 8, color: C.muted }}>
                Visit Career Intelligence in your EduNexus parent dashboard — or go to{' '}
              </Text>
              <Text style={{ fontSize: 8, fontWeight: 700, color: C.navy }}>
                edunexus.co.ke/parent/career-intelligence
              </Text>
            </View>
          </View>
        )}
        {!hasPathwaySignal && (
          <View style={S.careerDirBox}>
            <Text style={S.careerDirTitle}>POSSIBLE FUTURE DIRECTIONS</Text>
            <Text style={{ fontSize: 8.5, color: C.text, marginBottom: 6 }}>
              This section will show possible future directions once this learner has at least one subject
              assessment on record. EduNexus does not guess a pathway or career direction from no evidence.
            </Text>
          </View>
        )}
      </View>

      <View style={[S.pageFooter, { flexDirection: 'column', alignItems: 'center' }]}>
        <Text style={[S.pageFooterText, { marginBottom: 2 }]}>
          EduNexus Learner Intelligence Report · {dateStr} · Report ID: {report.reportId}
        </Text>
        <Text style={S.pageFooterText}>
          This report is an academic readiness guide. Results reflect current performance and will change with consistent effort.
        </Text>
      </View>
    </Page>
  )
}

// ─── SENIOR PAGE 1: ACADEMIC SNAPSHOT ────────────────────────────────────────

function SeniorSnapshotPage({ report }: { report: AcademicClinicReport }) {
  const sp         = report.studentProfile
  const co         = report.clinicalOverview
  const indicators = report.seniorReadinessIndicators
  const byDesc     = [...report.subjectBreakdown].sort((a, b) => b.level - a.level)
  const byAsc      = [...report.subjectBreakdown].sort((a, b) => a.level - b.level)
  const strong     = byDesc.filter(s => s.level >= 3).slice(0, 4)
  const needs      = byAsc.filter(s => s.level <= 2).slice(0, 4)
  // Pilot gate fix (2026-08-25): a zero-evidence learner used to render a
  // literal "NaN%" here — `co.overallCompetencyLevel` is `NaN` with no
  // subjects, and `indicators?.pathwayReadinessScore` was itself `NaN` for
  // the same reason before buildSeniorReadinessIndicators was guarded.
  // `hasReadinessSignal` is false whenever there is genuinely no score to
  // show, and the badge renders "—" instead of a fabricated/broken number.
  const hasReadinessSignal = !!indicators && !indicators.insufficientEvidence
  const score      = hasReadinessSignal ? indicators!.pathwayReadinessScore : null
  const scoreClr   = score === null ? C.muted : score >= 75 ? C.l3 : score >= 60 ? C.l2 : score >= 45 ? '#ea580c' : C.l1
  const pathway    = sp.pathway ?? 'Senior School'

  return (
    <Page size="A4" style={S.page}>
      {/* Branded header */}
      <View>
        <View style={[S.pageHeader, { paddingVertical: 18 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Svg width={32} height={32} viewBox="0 0 64 64" style={{ marginRight: 10 }}>
              <Circle cx="32" cy="32" r="30" fill="#243358" stroke="#4f46e5" strokeWidth="1.5" />
              <Polygon points="32,4 36.5,28.5 32,30 27.5,28.5" fill="#f59e0b" />
              <Polygon points="32,60 36.5,35.5 32,34 27.5,35.5" fill="#818cf8" />
              <Polygon points="4,32 28.5,27.5 30,32 28.5,36.5" fill="#10b981" />
              <Polygon points="60,32 35.5,27.5 34,32 35.5,36.5" fill="#f43f5e" />
              <Circle cx="32" cy="32" r="4" fill="#0f0e2a" stroke="#f59e0b" strokeWidth="1.5" />
            </Svg>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={{ fontSize: 16, fontWeight: 700, color: C.white }}>Edu</Text>
                <Text style={{ fontSize: 16, fontWeight: 700, color: C.gold }}>Nexus</Text>
                <Text style={{ fontSize: 9, color: '#94a3b8', marginLeft: 8, letterSpacing: 1 }}>LEARNER INTELLIGENCE REPORT</Text>
              </View>
              <Text style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>SENIOR SCHOOL · GRADES 10–12</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {/* P1 pilot fix — see PageHeader's identical comment: a static
                "Page 1 of 3" lies whenever page 3 overflows to a physical
                4th page. Use the true rendered pageNumber/totalPages. */}
            <Text style={{ fontSize: 8, color: '#94a3b8' }} render={({ pageNumber, totalPages: actualTotal }) => `Page ${pageNumber} of ${actualTotal}`} />
            <Text style={{ fontSize: 7, color: '#475569', marginTop: 2 }}>{report.reportId}</Text>
          </View>
        </View>
        <View style={S.pageGoldLine} />
      </View>

      <View style={S.content}>
        <Text style={S.sectionLabel}>ACADEMIC SNAPSHOT</Text>

        {/* Student identity + pathway readiness score */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{sp.name}</Text>
            <Text style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
              Grade {sp.grade} · {pathway}
            </Text>
            <Text style={{ fontSize: 10, color: C.muted }}>
              Term {sp.term}, {sp.year}{sp.school ? ` · ${sp.school}` : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <LevelBadge level={co.overallCompetencyLevel} />
              <TrajectoryBadge t={co.trajectory} />
            </View>
          </View>
          <View style={S.snapshotScoreBlock}>
            <View style={[S.snapshotScoreCircle, { borderColor: scoreClr }]}>
              <Text style={[S.snapshotScoreValue, { color: scoreClr }]}>{score === null ? '—' : `${score}%`}</Text>
            </View>
            <Text style={S.snapshotScoreLabel}>PATHWAY READINESS</Text>
            <Text style={{ fontSize: 8, color: C.muted, textAlign: 'center', maxWidth: 90 }}>
              {score === null ? 'Not enough evidence yet' : score >= 75 ? 'Strong' : score >= 60 ? 'Developing' : score >= 45 ? 'Emerging' : 'Needs Work'}
            </Text>
          </View>
        </View>

        <View style={S.dividerThin} />

        {/* Strong Subjects + Requires Intervention */}
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          <View style={{ flex: 1, marginRight: 20 }}>
            <Text style={{ fontSize: 9, fontWeight: 700, color: C.l3, letterSpacing: 1, marginBottom: 7 }}>
              STRONG SUBJECTS
            </Text>
            {strong.length > 0
              ? strong.map((s, i) => (
                  <View key={i} style={S.listRow}>
                    <View style={[S.listDot, { backgroundColor: C.l3 }]} />
                    <Text style={[S.listText, { fontSize: 9 }]}>{s.displayName}</Text>
                    <View style={[S.badge, { backgroundColor: levelBg(s.level), paddingVertical: 1, paddingHorizontal: 6 }]}>
                      <Text style={[S.badgeText, { color: levelColor(s.level), fontSize: 7.5 }]}>L{s.level}</Text>
                    </View>
                  </View>
                ))
              : <Text style={{ fontSize: 9, color: C.muted }}>Building toward strengths</Text>
            }
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 9, fontWeight: 700, color: C.l1, letterSpacing: 1, marginBottom: 7 }}>
              REQUIRES INTERVENTION
            </Text>
            {needs.length > 0
              ? needs.map((s, i) => (
                  <View key={i} style={S.listRow}>
                    <View style={[S.listDot, { backgroundColor: C.l1 }]} />
                    <Text style={[S.listText, { fontSize: 9 }]}>{s.displayName}</Text>
                    <View style={[S.badge, { backgroundColor: levelBg(s.level), paddingVertical: 1, paddingHorizontal: 6 }]}>
                      <Text style={[S.badgeText, { color: levelColor(s.level), fontSize: 7.5 }]}>L{s.level}</Text>
                    </View>
                  </View>
                ))
              : <Text style={{ fontSize: 9, color: C.muted }}>No critical areas identified</Text>
            }
          </View>
        </View>

        <View style={S.dividerThin} />

        {/* Academic diagnosis */}
        <Text style={{ fontSize: 9, fontWeight: 700, color: C.text, letterSpacing: 1, marginBottom: 6 }}>
          ACADEMIC ASSESSMENT
        </Text>
        <View style={[S.clinBox, { marginBottom: 12 }]}>
          <Text style={S.clinText}>{co.clinicalParagraph}</Text>
        </View>

        <View style={S.dividerThin} />

        {/* Subject performance grid */}
        <Text style={{ fontSize: 9, fontWeight: 700, color: C.text, letterSpacing: 1, marginBottom: 7 }}>
          SUBJECT PERFORMANCE
        </Text>
        <SubjectGrid subjects={report.subjectBreakdown} />
      </View>
      <PageFooter reportId={report.reportId} />
    </Page>
  )
}

// ─── SENIOR PAGE 2: FUTURE READINESS ─────────────────────────────────────────

function SeniorFutureReadinessPage({ report }: { report: AcademicClinicReport }) {
  const sp         = report.studentProfile
  const indicators = report.seniorReadinessIndicators
  const careers    = report.careerInsightCards ?? []
  const scenario   = report.futureScenario

  const readinessLabelColor: Record<string, string> = {
    'Strong': C.l3, 'Developing': C.l2, 'Emerging': '#ea580c', 'Needs Work': C.l1,
  }
  const readinessLabelBg: Record<string, string> = {
    'Strong': C.l3bg, 'Developing': C.l2bg, 'Emerging': '#fff7ed', 'Needs Work': C.l1bg,
  }
  const progressColor: Record<string, string> = {
    'On Track': C.l3, 'Needs Attention': C.l2, 'Critical': C.l1,
  }
  const progressBg: Record<string, string> = {
    'On Track': C.l3bg, 'Needs Attention': C.l2bg, 'Critical': C.l1bg,
  }

  const alignmentColor = (a: number) => a >= 75 ? C.l3 : a >= 55 ? C.l2 : C.muted

  return (
    <Page size="A4" style={S.page}>
      <PageHeader name={sp.name} grade={sp.grade} pageNum={2} totalPages={3} reportId={report.reportId} />
      <View style={S.content}>
        <Text style={S.sectionLabel}>FUTURE READINESS ANALYSIS</Text>
        <Text style={S.sectionTitle}>Future Readiness</Text>
        <View style={S.divider} />

        {/* Three readiness indicators — pilot gate fix (2026-08-25): a
            zero-evidence learner must not see a red/orange "Needs Work" /
            "Needs Attention" badge, which reads as an assessed judgment
            ("we looked and it's poor") rather than the true state ("we have
            no evidence at all"). Neutral label + the already-honest detail
            text (buildSeniorReadinessIndicators' insufficientEvidence
            branch) instead. */}
        {indicators && (
          <View style={S.indicatorRow}>
            {/* University Readiness */}
            <View style={[S.indicatorCard, { backgroundColor: indicators.insufficientEvidence ? C.offWhite : readinessLabelBg[indicators.universityReadiness] ?? C.offWhite }]}>
              <Text style={S.indicatorLabel}>UNIVERSITY READINESS</Text>
              <Text style={[S.indicatorValue, { color: indicators.insufficientEvidence ? C.muted : readinessLabelColor[indicators.universityReadiness] ?? C.muted }]}>
                {indicators.insufficientEvidence ? 'Not Yet Available' : indicators.universityReadiness}
              </Text>
              <Text style={[S.indicatorDetail, { color: C.text }]}>{indicators.universityReadinessDetail}</Text>
            </View>
            {/* Career Readiness */}
            <View style={[S.indicatorCard, { backgroundColor: indicators.insufficientEvidence ? C.offWhite : readinessLabelBg[indicators.careerReadiness] ?? C.offWhite }]}>
              <Text style={S.indicatorLabel}>CAREER READINESS</Text>
              <Text style={[S.indicatorValue, { color: indicators.insufficientEvidence ? C.muted : readinessLabelColor[indicators.careerReadiness] ?? C.muted }]}>
                {indicators.insufficientEvidence ? 'Not Yet Available' : indicators.careerReadiness}
              </Text>
              <Text style={[S.indicatorDetail, { color: C.text }]}>{indicators.careerReadinessDetail}</Text>
            </View>
            {/* Pathway Progress */}
            <View style={[S.indicatorCard, { backgroundColor: indicators.insufficientEvidence ? C.offWhite : progressBg[indicators.pathwayProgress] ?? C.offWhite, marginRight: 0 }]}>
              <Text style={S.indicatorLabel}>PATHWAY PROGRESS</Text>
              <Text style={[S.indicatorValue, { color: indicators.insufficientEvidence ? C.muted : progressColor[indicators.pathwayProgress] ?? C.muted }]}>
                {indicators.insufficientEvidence ? 'Not Yet Available' : indicators.pathwayProgress}
              </Text>
              <Text style={[S.indicatorDetail, { color: C.text }]}>{indicators.pathwayProgressDetail}</Text>
            </View>
          </View>
        )}

        <View style={S.dividerThin} />

        {/* Career Snapshot — brief, full analysis at career-intelligence page */}
        {careers.length > 0 && (
          <>
            <Text style={{ fontSize: 9, fontWeight: 700, color: C.text, letterSpacing: 1, marginBottom: 6 }}>
              CAREER DIRECTION SNAPSHOT
            </Text>
            {/* Top 2 careers as compact rows only */}
            {careers.slice(0, 2).map((c, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.offWhite, borderRadius: 5, padding: 8, marginBottom: 5 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 9, fontWeight: 700, color: C.text }}>{i + 1}. {c.name}</Text>
                  <Text style={{ fontSize: 8, color: C.muted, marginTop: 1 }}>Outlook: {c.futureOutlook} · AI Impact: {c.aiImpact}</Text>
                </View>
                <View style={{ alignItems: 'center', marginLeft: 10 }}>
                  <Text style={{ fontSize: 13, fontWeight: 700, color: alignmentColor(c.alignment) }}>{c.alignment}%</Text>
                  <Text style={{ fontSize: 7, color: C.muted }}>match</Text>
                </View>
              </View>
            ))}
            {/* Deep-dive callout */}
            <View style={{ backgroundColor: C.navy + '12', borderRadius: 5, padding: 9, marginTop: 4 }}>
              <Text style={{ fontSize: 8.5, fontWeight: 700, color: C.navy, marginBottom: 2 }}>
                See the full Career Intelligence profile:
              </Text>
              <Text style={{ fontSize: 8, color: C.muted, lineHeight: 1.5 }}>
                Full match analysis, future outlook, AI impact ratings, salary data, and self-employment pathways are available in your parent dashboard.
              </Text>
              <Text style={{ fontSize: 8, fontWeight: 700, color: C.navy, marginTop: 3 }}>
                edunexus.co.ke/parent/career-intelligence
              </Text>
            </View>
          </>
        )}

        <View style={S.dividerThin} />

        {/* Future Scenario Analysis */}
        {scenario && (
          <>
            <Text style={{ fontSize: 9, fontWeight: 700, color: C.text, letterSpacing: 1, marginBottom: 8 }}>
              FUTURE SCENARIO ANALYSIS
            </Text>
            <View style={S.scenarioRow}>
              {/* If nothing changes */}
              <View style={[S.scenarioBox, { backgroundColor: C.l1bg, marginRight: 8 }]}>
                <Text style={[S.scenarioTitle, { color: C.l1 }]}>IF NOTHING CHANGES</Text>
                <Text style={{ fontSize: 8.5, color: C.text, marginBottom: 4 }}>
                  {scenario.subject} remains at Level {scenario.currentLevel}
                </Text>
                <Text style={[S.scenarioBody, { color: '#7f1d1d' }]}>{scenario.currentTrajectory}</Text>
              </View>
              {/* If scores improve */}
              <View style={[S.scenarioBox, { backgroundColor: C.l3bg }]}>
                <Text style={[S.scenarioTitle, { color: C.l3 }]}>IF SCORES IMPROVE BY ONE LEVEL</Text>
                <Text style={{ fontSize: 8.5, fontWeight: 700, color: C.text, marginBottom: 6 }}>
                  {scenario.subject} Level {scenario.currentLevel} {'->'} Level {scenario.improvedLevel}
                </Text>
                {scenario.improvedImpacts.map((impact, i) => (
                  <View key={i} style={S.scenarioCheck}>
                    <Text style={[S.scenarioCheckMark, { color: C.l3 }]}>✓</Text>
                    <Text style={[S.scenarioCheckText, { color: '#14532d' }]}>{impact}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={{ backgroundColor: C.offWhite, borderRadius: 4, padding: 8, marginTop: 8 }}>
              <Text style={{ fontSize: 8, color: C.muted, lineHeight: 1.4 }}>
                Parents should clearly see the value of improvement. One level change in {scenario.subject} creates a meaningful difference in available options.
              </Text>
            </View>
          </>
        )}
      </View>
      <PageFooter reportId={report.reportId} />
    </Page>
  )
}

// ─── SENIOR PAGE 3: PRIORITY ACTION PLAN ─────────────────────────────────────

function SeniorActionPage({ report }: { report: AcademicClinicReport }) {
  const sp         = report.studentProfile
  const priorities = report.seniorActionPriorities ?? []
  const top        = priorities[0]
  const dateStr    = new Date(report.generatedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <Page size="A4" style={S.page}>
      <PageHeader name={sp.name} grade={sp.grade} pageNum={3} totalPages={3} reportId={report.reportId} />
      <View style={S.content}>
        <Text style={S.sectionLabel}>PRIORITY ACTION PLAN</Text>
        <Text style={S.sectionTitle}>Top 3 Interventions — Ranked by Impact</Text>
        <View style={S.divider} />

        {priorities.slice(0, 3).map((p, i) => (
          <PriorityBlock key={i} p={p} colors={PRIORITY_COLORS[i]} />
        ))}

        {/* Pilot gate fix (2026-08-25): a zero-evidence Senior learner has
            no priorities and no Rx box below — without this, the page was
            just a heading over blank space (Step 20: no blank broken
            boxes). Reuse the honest next step already computed by the
            canonical zero-evidence career adapter rather than inventing a
            new message. */}
        {priorities.length === 0 && (
          <View style={S.parentActionBox}>
            <Text style={S.parentActionLabel}>NEXT STEP</Text>
            <Text style={S.parentActionText}>
              {report.seniorGuidance?.nextSteps?.[0] ?? 'Complete or confirm at least one assessment for this term.'}
            </Text>
          </View>
        )}

        <View style={S.dividerThin} />

        {top && (
          <RxBox
            subject={top.compassSubject}
            reason={top.compassReason}
            outcome={`Move from Level ${top.currentLevel} to Level ${top.targetLevel}`}
            sessions={top.estimatedSessions}
            timeline={top.timeline}
          />
        )}

        {/* Root Cause Analysis (when strand assessment data is available) */}
        {(report.knowledgeRootCauses?.length ?? 0) > 0 && (
          <RootCauseChainBox causes={report.knowledgeRootCauses!} />
        )}
      </View>

      <View style={[S.pageFooter, { flexDirection: 'column', alignItems: 'center' }]}>
        <Text style={[S.pageFooterText, { marginBottom: 2 }]}>
          EduNexus Learner Intelligence Report · {dateStr} · Report ID: {report.reportId}
        </Text>
        <Text style={S.pageFooterText}>CONFIDENTIAL — For Parent and Teacher Use Only · edunexus.co.ke</Text>
      </View>
    </Page>
  )
}

// ─── Root PDF Component ───────────────────────────────────────────────────────

export const AcademicClinicPDF = ({ report }: { report: AcademicClinicReport }) => {
  const isJunior = report.studentProfile.grade >= 7 && report.studentProfile.grade <= 9

  if (isJunior) {
    return (
      <Document
        title={`EduNexus Learner Intelligence Report — ${report.studentProfile.name}`}
        author="EduNexus"
        subject="Junior School Parent Decision-Support Report"
      >
        <JuniorCurrentPositionPage report={report} />
        <JuniorOpportunityPage     report={report} />
        <JuniorActionPlanPage      report={report} />
      </Document>
    )
  }

  return (
    <Document
      title={`EduNexus Learner Intelligence Report — ${report.studentProfile.name}`}
      author="EduNexus"
      subject="Senior School Parent Decision-Support Report"
    >
      <SeniorSnapshotPage       report={report} />
      <SeniorFutureReadinessPage report={report} />
      <SeniorActionPage          report={report} />
    </Document>
  )
}

// ─── PDF Generator Function ───────────────────────────────────────────────────

export async function generateAcademicClinicPDF(report: AcademicClinicReport): Promise<Blob> {
  try {
    const { renderToBuffer } = await import('@react-pdf/renderer')
    const buffer         = await renderToBuffer(<AcademicClinicPDF report={report} />)
    const standardBuffer = Buffer.from(buffer)
    return new Blob([standardBuffer], { type: 'application/pdf' })
  } catch (error) {
    console.error('PDF generation failed:', error)
    throw new Error('PDF generation failed')
  }
}
