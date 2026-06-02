// lib/academicClinic/pdfGenerator.tsx
// Premium 7-page Academic Clinic Report — EduNexus

import React from 'react'
import {
  Document, Page, Text, View, StyleSheet, Font,
} from '@react-pdf/renderer'
import type { AcademicClinicReport, SubjectProgress } from './reportGenerator'
import { getLevelLabel, getClinicalObservation } from './reportGenerator'

// ─── Color Palette ────────────────────────────────────────────────────────────

const C = {
  navy:        '#1a2744',
  navyLight:   '#243358',
  white:       '#ffffff',
  offWhite:    '#f8fafc',
  border:      '#e2e8f0',
  text:        '#1e293b',
  muted:       '#64748b',
  gold:        '#f59e0b',
  goldLight:   '#fef3c7',
  // Level colours
  l1:          '#dc2626',   // Red   — Emerging
  l1bg:        '#fee2e2',
  l2:          '#d97706',   // Amber — Developing
  l2bg:        '#fef3c7',
  l3:          '#16a34a',   // Green — Proficient
  l3bg:        '#dcfce7',
  l4:          '#7c3aed',   // Purple — Exemplary
  l4bg:        '#ede9fe',
  // Trajectory
  improving:   '#16a34a',
  stable:      '#3b82f6',
  attention:   '#d97706',
  critical:    '#dc2626',
}

function levelColor(l: number)   { return [C.l1, C.l2, C.l3, C.l4][l - 1] ?? C.muted }
function levelBg(l: number)      { return [C.l1bg, C.l2bg, C.l3bg, C.l4bg][l - 1] ?? C.offWhite }
function trendArrow(t: string)   { return t === 'improving' ? '+' : t === 'declining' ? '-' : '=' }
function trendColor(t: string)   { return t === 'improving' ? C.l3 : t === 'declining' ? C.l1 : C.muted }

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  // ── Pages
  coverPage: { backgroundColor: C.navy, padding: 0, fontFamily: 'Helvetica' },
  page:      { backgroundColor: C.white, fontFamily: 'Helvetica', paddingBottom: 50 },

  // ── Cover elements
  coverHeader: { backgroundColor: C.navyLight, paddingHorizontal: 48, paddingVertical: 36, borderBottomWidth: 3, borderBottomColor: C.gold },
  coverBrand:  { fontSize: 11, color: C.gold, letterSpacing: 3, marginBottom: 4 },
  coverTitle:  { fontSize: 30, fontWeight: 700, color: C.white },
  coverBody:   { paddingHorizontal: 48, paddingTop: 52 },
  coverName:   { fontSize: 38, fontWeight: 700, color: C.gold, marginBottom: 10 },
  coverMeta:   { fontSize: 13, color: '#94a3b8', marginBottom: 6 },
  coverDivider:{ borderTopWidth: 1, borderTopColor: '#2d4070', marginVertical: 36 },
  coverConfidential: { fontSize: 9, color: '#64748b', letterSpacing: 2, marginBottom: 6 },
  coverReportId:     { fontSize: 9, color: '#475569' },
  coverFooter: { position: 'absolute', bottom: 48, left: 48, right: 48 },

  // ── Page header band
  pageHeader:     { backgroundColor: C.navy, paddingHorizontal: 36, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageHeaderBrand:{ fontSize: 8, color: C.gold, letterSpacing: 2 },
  pageHeaderName: { fontSize: 9, color: '#94a3b8', marginTop: 2 },
  pageHeaderRight:{ alignItems: 'flex-end' },
  pageHeaderPage: { fontSize: 8, color: '#94a3b8' },
  pageHeaderId:   { fontSize: 7, color: '#475569', marginTop: 2 },
  pageGoldLine:   { height: 2, backgroundColor: C.gold },

  // ── Page footer
  pageFooter:     { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 36, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageFooterText: { fontSize: 7, color: C.muted },

  // ── Content
  content: { paddingHorizontal: 36, paddingTop: 24 },

  // ── Section headers
  sectionLabel: { fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 6 },
  sectionTitle: { fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 },
  divider:      { borderTopWidth: 1, borderTopColor: C.border, marginVertical: 16 },
  dividerThin:  { borderTopWidth: 1, borderTopColor: C.border, marginVertical: 10 },

  // ── Badges
  badge:        { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 4 },
  badgeText:    { fontSize: 9, fontWeight: 700, letterSpacing: 1 },
  levelCircle:  { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  levelCircleText: { fontSize: 11, fontWeight: 700 },

  // ── Vitals row
  vitalsRow: { flexDirection: 'row', marginBottom: 20 },
  vitalCard: { flex: 1, padding: 12, borderRadius: 6, marginRight: 8 },
  vitalLabel:{ fontSize: 8, color: C.muted, letterSpacing: 1, marginBottom: 4 },
  vitalValue:{ fontSize: 22, fontWeight: 700 },
  vitalSub:  { fontSize: 8, color: C.muted, marginTop: 2 },

  // ── Clinical paragraph box
  clinBox:   { backgroundColor: C.offWhite, borderRadius: 6, padding: 16, borderLeftWidth: 3, borderLeftColor: C.gold, marginBottom: 20 },
  clinText:  { fontSize: 10, color: C.text, lineHeight: 1.6 },

  // ── Strength / priority rows
  listRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  listDot:   { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  listText:  { fontSize: 10, color: C.text, flex: 1 },
  listLevel: { fontSize: 8, color: C.muted },

  // ── Subject matrix row
  subjectRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.border },
  subjectEmoji:{ fontSize: 11, width: 22 },
  subjectName: { fontSize: 9, fontWeight: 700, color: C.text, width: 120 },
  subjectLabel:{ fontSize: 8, color: C.muted, width: 62 },
  // progress bar
  barTrack:    { flex: 1, height: 8, backgroundColor: C.border, borderRadius: 4, marginHorizontal: 8, overflow: 'hidden' },
  barFill:     { height: 8, borderRadius: 4 },
  subjectTrend:{ fontSize: 11, width: 16, textAlign: 'center' },
  subjectObs:  { fontSize: 7.5, color: C.muted, marginTop: 3, marginLeft: 22, width: 390 },

  // ── Pathway readiness bars
  readinessTrack: { height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  readinessFill:  { height: 8, borderRadius: 4 },
  // ── STEM potential box
  stemPotentialBox:   { backgroundColor: '#FEF3C7', borderLeftWidth: 3, borderLeftColor: '#D97706', borderRadius: 4, padding: 10, marginTop: 10, marginBottom: 0 },
  stemPotentialTitle: { fontSize: 9, fontWeight: 700, color: '#92400E', marginBottom: 4, letterSpacing: 0.5 },
  stemPotentialBody:  { fontSize: 8, color: '#78350F', marginBottom: 6 },
  stemGapItem:        { fontSize: 8, color: '#92400E', marginBottom: 2 },
  // ── Unlock / maintain boxes
  unlockBox:    { borderLeftWidth: 2, borderLeftColor: '#1D9E75', backgroundColor: '#F0FDF4', borderRadius: 4, padding: 8 },
  unlockTitle:  { fontSize: 8, fontWeight: 700, color: '#065F46', letterSpacing: 0.5, marginBottom: 5 },
  maintainBox:  { borderLeftWidth: 2, borderLeftColor: '#378ADD', backgroundColor: '#EFF6FF', borderRadius: 4, padding: 8 },
  maintainTitle:{ fontSize: 8, fontWeight: 700, color: '#1E40AF', letterSpacing: 0.5, marginBottom: 5 },
  recommendedBg: { backgroundColor: C.navyLight, borderRadius: 6, padding: 14, marginTop: 12 },

  // ── Career cards
  careerCard:    { borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 12, marginBottom: 10 },
  careerHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  careerName:    { fontSize: 11, fontWeight: 700, color: C.text },
  careerDetail:  { fontSize: 9, color: C.muted, marginBottom: 3 },
  honestBox:     { backgroundColor: C.offWhite, borderRadius: 6, padding: 14, borderLeftWidth: 3, borderLeftColor: C.l1 },

  // ── Week cards
  weekCard:      { borderLeftWidth: 3, paddingLeft: 12, marginBottom: 14 },
  weekTitle:     { fontSize: 10, fontWeight: 700, color: C.text, marginBottom: 2 },
  weekMeta:      { fontSize: 8, color: C.muted, marginBottom: 6 },
  weekActivity:  { fontSize: 8.5, color: C.text, marginBottom: 3 },
  weekBullet:    { fontSize: 8.5, color: C.muted },

  // ── Daily schedule
  scheduleRow:   { flexDirection: 'row', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.border, alignItems: 'center' },
  scheduleTime:  { fontSize: 8.5, fontWeight: 700, color: C.text, width: 80 },
  scheduleText:  { fontSize: 8.5, color: C.text, flex: 1 },

  // ── Compass
  compassHighlight: { backgroundColor: C.navy, borderRadius: 8, padding: 18, marginBottom: 16 },
  compassTitle:     { fontSize: 10, color: C.gold, letterSpacing: 1, marginBottom: 6 },
  compassSubject:   { fontSize: 18, fontWeight: 700, color: C.white },
  topicRow:         { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  topicNum:         { fontSize: 9, fontWeight: 700, color: C.gold, width: 20 },
  topicText:        { fontSize: 9.5, color: C.text, flex: 1, lineHeight: 1.5 },

  // ── Teacher page
  teacherBox:    { borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 14, marginBottom: 14 },
  teacherLabel:  { fontSize: 8, color: C.muted, letterSpacing: 1, marginBottom: 6 },
  teacherLine:   { borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 10, height: 18 },
  sigRow:        { flexDirection: 'row', marginTop: 8 },
  sigBlock:      { flex: 1, marginRight: 16 },
  sigLine:       { borderBottomWidth: 1, borderBottomColor: C.text, marginBottom: 4, height: 24 },
  sigLabel:      { fontSize: 8, color: C.muted },
})

// ─── Reusable: Page Header ────────────────────────────────────────────────────

function PageHeader({ name, grade, pageNum, totalPages, reportId }: {
  name: string; grade: number; pageNum: number; totalPages: number; reportId: string
}) {
  return (
    <View>
      <View style={S.pageHeader}>
        <View>
          <Text style={S.pageHeaderBrand}>EDUNEXUS ACADEMIC CLINIC</Text>
          <Text style={S.pageHeaderName}>{name} · Grade {grade}</Text>
        </View>
        <View style={S.pageHeaderRight}>
          <Text style={S.pageHeaderPage}>Page {pageNum} of {totalPages}</Text>
          <Text style={S.pageHeaderId}>{reportId}</Text>
        </View>
      </View>
      <View style={S.pageGoldLine} />
    </View>
  )
}

// ─── Reusable: Page Footer ────────────────────────────────────────────────────

function PageFooter({ reportId }: { reportId: string }) {
  return (
    <View style={S.pageFooter}>
      <Text style={S.pageFooterText}>{reportId}</Text>
      <Text style={S.pageFooterText}>CONFIDENTIAL — For Parent and Teacher Use Only</Text>
      <Text style={S.pageFooterText}>edunexus.co.ke</Text>
    </View>
  )
}

// ─── Reusable: Trajectory Badge ───────────────────────────────────────────────

function TrajectoryBadge({ t }: { t: 'IMPROVING' | 'STABLE' | 'NEEDS ATTENTION' | 'CRITICAL' }) {
  const colors: Record<string, string> = {
    IMPROVING: C.l3, STABLE: '#3b82f6', 'NEEDS ATTENTION': C.l2, CRITICAL: C.l1,
  }
  const bgs: Record<string, string> = {
    IMPROVING: C.l3bg, STABLE: '#dbeafe', 'NEEDS ATTENTION': C.l2bg, CRITICAL: C.l1bg,
  }
  return (
    <View style={[S.badge, { backgroundColor: bgs[t] ?? C.offWhite }]}>
      <Text style={[S.badgeText, { color: colors[t] ?? C.muted }]}>{t}</Text>
    </View>
  )
}

// ─── Reusable: Level Badge ────────────────────────────────────────────────────

function LevelBadge({ level }: { level: number }) {
  return (
    <View style={[S.badge, { backgroundColor: levelBg(level) }]}>
      <Text style={[S.badgeText, { color: levelColor(level) }]}>
        LEVEL {level} — {getLevelLabel(level).toUpperCase()}
      </Text>
    </View>
  )
}

// ─── Reusable: Progress Bar (View-based) ─────────────────────────────────────

function ProgressBar({ pct, color, height = 8 }: { pct: number; color: string; height?: number }) {
  const safePct = Math.max(0, Math.min(100, pct))
  return (
    <View style={[S.barTrack, { height }]}>
      <View style={[S.barFill, { width: `${safePct}%`, backgroundColor: color, height }]} />
    </View>
  )
}

// ─── PAGE 1: COVER ────────────────────────────────────────────────────────────

function CoverPage({ report }: { report: AcademicClinicReport }) {
  const sp      = report.studentProfile
  const dateStr = new Date(report.generatedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <Page size="A4" style={S.coverPage}>
      {/* Header band */}
      <View style={S.coverHeader}>
        <Text style={S.coverBrand}>EDUNEXUS</Text>
        <Text style={S.coverTitle}>Academic Clinic</Text>
        <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>Personalised Clinical Learning Report</Text>
      </View>

      {/* Body */}
      <View style={S.coverBody}>
        <Text style={S.coverName}>{sp.name}</Text>
        <Text style={S.coverMeta}>Grade {sp.grade} · {sp.level}</Text>
        {sp.school && <Text style={S.coverMeta}>{sp.school}</Text>}
        <Text style={S.coverMeta}>Term {sp.term}, {sp.year}</Text>

        <View style={S.coverDivider} />

        {/* Key stats */}
        <View style={{ flexDirection: 'row', marginBottom: 40 }}>
          <View style={{ marginRight: 36 }}>
            <Text style={{ fontSize: 9, color: C.gold, letterSpacing: 2, marginBottom: 4 }}>OVERALL COMPETENCY</Text>
            <Text style={{ fontSize: 28, fontWeight: 700, color: C.white }}>
              {report.clinicalOverview.overallCompetencyLabel}
            </Text>
            <Text style={{ fontSize: 10, color: '#94a3b8' }}>Level {report.clinicalOverview.overallCompetencyLevel} of 4</Text>
          </View>
          <View>
            <Text style={{ fontSize: 9, color: C.gold, letterSpacing: 2, marginBottom: 4 }}>TRAJECTORY</Text>
            <Text style={{ fontSize: 14, fontWeight: 700, color: C.white }}>{report.clinicalOverview.trajectory}</Text>
            <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
              {report.subjectBreakdown.length} subjects assessed
            </Text>
          </View>
        </View>

        <View style={{ borderTopWidth: 1, borderTopColor: '#2d4070', paddingTop: 24 }}>
          <Text style={S.coverConfidential}>CONFIDENTIAL — FOR PARENT AND TEACHER USE ONLY</Text>
          <Text style={S.coverReportId}>Report ID: {report.reportId}</Text>
          <Text style={[S.coverReportId, { marginTop: 4 }]}>Generated: {dateStr}</Text>
        </View>
      </View>

      {/* Gold accent bar at bottom */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, backgroundColor: C.gold }} />
    </Page>
  )
}

// ─── PAGE 2: CLINICAL OVERVIEW ────────────────────────────────────────────────

function ClinicalOverviewPage({ report }: { report: AcademicClinicReport }) {
  const co = report.clinicalOverview
  const sp = report.studentProfile

  return (
    <Page size="A4" style={S.page}>
      <PageHeader name={sp.name} grade={sp.grade} pageNum={2} totalPages={7} reportId={report.reportId} />
      <View style={S.content}>
        <Text style={S.sectionLabel}>CLINICAL OVERVIEW</Text>
        <Text style={S.sectionTitle}>Academic Performance Assessment</Text>
        <View style={S.divider} />

        {/* Overall competency + trajectory row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ marginRight: 16 }}>
            <Text style={{ fontSize: 8, color: C.muted, letterSpacing: 1, marginBottom: 4 }}>OVERALL COMPETENCY</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[S.levelCircle, { backgroundColor: levelBg(co.overallCompetencyLevel), marginRight: 8 }]}>
                <Text style={[S.levelCircleText, { color: levelColor(co.overallCompetencyLevel) }]}>
                  {co.overallCompetencyLevel}
                </Text>
              </View>
              <LevelBadge level={co.overallCompetencyLevel} />
            </View>
          </View>
          <View style={{ flex: 1 }} />
          <View>
            <Text style={{ fontSize: 8, color: C.muted, letterSpacing: 1, marginBottom: 4 }}>TRAJECTORY</Text>
            <TrajectoryBadge t={co.trajectory} />
          </View>
        </View>

        {/* Vitals */}
        <View style={S.vitalsRow}>
          <View style={[S.vitalCard, { backgroundColor: '#dbeafe', marginRight: 8 }]}>
            <Text style={S.vitalLabel}>SUBJECTS</Text>
            <Text style={[S.vitalValue, { color: '#3b82f6' }]}>{report.subjectBreakdown.length}</Text>
            <Text style={S.vitalSub}>assessed</Text>
          </View>
          <View style={[S.vitalCard, { backgroundColor: C.l3bg, marginRight: 8 }]}>
            <Text style={S.vitalLabel}>STRENGTHS</Text>
            <Text style={[S.vitalValue, { color: C.l3 }]}>{report.vitals.strengths}</Text>
            <Text style={S.vitalSub}>Level 3–4</Text>
          </View>
          <View style={[S.vitalCard, { backgroundColor: C.l2bg, marginRight: 8 }]}>
            <Text style={S.vitalLabel}>DEVELOPING</Text>
            <Text style={[S.vitalValue, { color: C.l2 }]}>{report.vitals.needsWork}</Text>
            <Text style={S.vitalSub}>Level 2</Text>
          </View>
          <View style={[S.vitalCard, { backgroundColor: C.l1bg, marginRight: 0 }]}>
            <Text style={S.vitalLabel}>PRIORITY</Text>
            <Text style={[S.vitalValue, { color: C.l1 }]}>{report.vitals.urgent}</Text>
            <Text style={S.vitalSub}>Level 1</Text>
          </View>
        </View>

        {/* Clinical paragraph */}
        <View style={S.clinBox}>
          <Text style={{ fontSize: 8, color: C.gold, letterSpacing: 1, marginBottom: 8 }}>CLINICAL ASSESSMENT</Text>
          <Text style={S.clinText}>{co.clinicalParagraph}</Text>
        </View>

        {/* Strengths + Priority side by side */}
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginRight: 20 }}>
            <Text style={{ fontSize: 9, fontWeight: 700, color: C.l3, letterSpacing: 1, marginBottom: 8 }}>
              CLINICAL STRENGTHS
            </Text>
            {co.clinicalStrengths.length > 0
              ? co.clinicalStrengths.map((s, i) => (
                  <View key={i} style={S.listRow}>
                    <View style={[S.listDot, { backgroundColor: C.l3 }]} />
                    <Text style={S.listText}>{s.displayName}</Text>
                    <Text style={[S.listLevel, { color: levelColor(s.level) }]}>Level {s.level}</Text>
                  </View>
                ))
              : <Text style={{ fontSize: 9, color: C.muted }}>Building across all subjects</Text>
            }
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 9, fontWeight: 700, color: C.l1, letterSpacing: 1, marginBottom: 8 }}>
              PRIORITY INTERVENTION AREAS
            </Text>
            {co.priorityAreas.length > 0
              ? co.priorityAreas.map((s, i) => (
                  <View key={i} style={S.listRow}>
                    <View style={[S.listDot, { backgroundColor: C.l1 }]} />
                    <Text style={S.listText}>{s.displayName}</Text>
                    <Text style={[S.listLevel, { color: levelColor(s.level) }]}>Level {s.level}</Text>
                  </View>
                ))
              : <Text style={{ fontSize: 9, color: C.muted }}>No critical priority areas identified</Text>
            }
          </View>
        </View>
      </View>
      <PageFooter reportId={report.reportId} />
    </Page>
  )
}

// ─── PAGE 3: SUBJECT PERFORMANCE MATRIX ──────────────────────────────────────

function SubjectMatrixPage({ report }: { report: AcademicClinicReport }) {
  const sp = report.studentProfile

  return (
    <Page size="A4" style={S.page}>
      <PageHeader name={sp.name} grade={sp.grade} pageNum={3} totalPages={7} reportId={report.reportId} />
      <View style={S.content}>
        <Text style={S.sectionLabel}>SUBJECT ANALYSIS</Text>
        <Text style={S.sectionTitle}>Performance Matrix</Text>
        <View style={S.divider} />

        {/* Column headers */}
        <View style={{ flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 2, borderBottomColor: C.navy, marginBottom: 4 }}>
          <Text style={{ fontSize: 7, color: C.muted, letterSpacing: 1, width: 22 }}> </Text>
          <Text style={{ fontSize: 7, color: C.muted, letterSpacing: 1, width: 120 }}>SUBJECT</Text>
          <Text style={{ fontSize: 7, color: C.muted, letterSpacing: 1, width: 62 }}>LEVEL</Text>
          <Text style={{ fontSize: 7, color: C.muted, letterSpacing: 1, flex: 1, marginHorizontal: 8 }}>COMPETENCY</Text>
          <Text style={{ fontSize: 7, color: C.muted, letterSpacing: 1, width: 16 }}>TRD</Text>
        </View>

        {report.subjectBreakdown.map((s, i) => {
          const pct   = (s.level / 4) * 100
          const color = levelColor(s.level)
          const obs   = getClinicalObservation(s.subject, s.level)
          return (
            <View key={i}>
              <View style={S.subjectRow}>
                <View style={{ width: 22, justifyContent: 'center', alignItems: 'center' }}>
                  <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: levelColor(s.level) }} />
                </View>
                <Text style={S.subjectName}>{s.displayName}</Text>
                <View style={{ width: 62 }}>
                  <View style={[S.badge, { backgroundColor: levelBg(s.level), paddingVertical: 2, paddingHorizontal: 5 }]}>
                    <Text style={[S.badgeText, { color, fontSize: 7 }]}>
                      {s.level} · {getLevelLabel(s.level).toUpperCase()}
                    </Text>
                  </View>
                </View>
                <ProgressBar pct={pct} color={color} height={8} />
                <Text style={[S.subjectTrend, { color: trendColor(s.trend) }]}>{trendArrow(s.trend)}</Text>
              </View>
              <Text style={S.subjectObs}>{obs}</Text>
              {i < report.subjectBreakdown.length - 1 && (
                <View style={{ borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9', marginBottom: 2 }} />
              )}
            </View>
          )
        })}
      </View>
      <PageFooter reportId={report.reportId} />
    </Page>
  )
}

// ─── PAGE 4A: PATHWAY ANALYSIS (JUNIOR) ──────────────────────────────────────

const REC_COLOR  = '#1D9E75'
const ALT_COLOR  = '#378ADD'
const GREY_COLOR = '#CBD5E1'

function PathwayPage({ report }: { report: AcademicClinicReport }) {
  const sp = report.studentProfile
  const pa = report.pathwayAnalysis!
  const pr = pa.pathway_readiness

  const confColor = pa.confidenceLevel === 'HIGH' ? C.l3 : pa.confidenceLevel === 'MEDIUM' ? C.l2 : C.l1
  const confBg    = pa.confidenceLevel === 'HIGH' ? C.l3bg : pa.confidenceLevel === 'MEDIUM' ? C.l2bg : C.l1bg

  const READINESS_BARS = [
    { label: 'STEM',                  score: pr?.stem            ?? 0 },
    { label: 'Social Sciences',       score: pr?.social_sciences ?? 0 },
    { label: 'Arts & Sports Science', score: pr?.arts            ?? 0 },
  ]

  function barColor(label: string): string {
    if (label === pa.recommendedPathway)  return REC_COLOR
    if (label === pa.alternative_pathway) return ALT_COLOR
    return GREY_COLOR
  }

  const unlockItems = pa.alternative_pathway === 'STEM'
    ? (pa.to_unlock_stem   ?? [])
    : (pa.to_unlock_social ?? [])

  return (
    <Page size="A4" style={S.page}>
      <PageHeader name={sp.name} grade={sp.grade} pageNum={4} totalPages={7} reportId={report.reportId} />
      <View style={S.content}>
        <Text style={S.sectionLabel}>PATHWAY ANALYSIS · GRADES 7–9</Text>
        <Text style={S.sectionTitle}>Senior School Pathway Recommendation</Text>
        <View style={S.divider} />

        {/* ── Pathway Readiness bars ── */}
        <Text style={{ fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 10 }}>PATHWAY READINESS</Text>
        {READINESS_BARS.map((bar, i) => {
          const color = barColor(bar.label)
          const isRec = bar.label === pa.recommendedPathway
          return (
            <View key={i} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {isRec && (
                    <View style={[S.badge, { backgroundColor: color, marginRight: 8, paddingVertical: 2 }]}>
                      <Text style={[S.badgeText, { color: C.white, fontSize: 7 }]}>RECOMMENDED</Text>
                    </View>
                  )}
                  <Text style={{ fontSize: 10, fontWeight: 700, color: isRec ? color : C.text }}>{bar.label}</Text>
                </View>
                <Text style={{ fontSize: 10, fontWeight: 700, color }}>{bar.score}%</Text>
              </View>
              <View style={S.readinessTrack}>
                <View style={[S.readinessFill, { width: `${bar.score}%`, backgroundColor: color }]} />
              </View>
            </View>
          )
        })}

        {/* ── Recommended / Alternative / Confidence ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 12 }}>
          <View style={{ marginRight: 24 }}>
            <Text style={{ fontSize: 8, color: C.muted, letterSpacing: 1 }}>RECOMMENDED</Text>
            <Text style={{ fontSize: 11, fontWeight: 700, color: REC_COLOR, marginTop: 2 }}>{pa.recommendedPathway}</Text>
          </View>
          {pa.alternative_pathway && (
            <View style={{ marginRight: 24 }}>
              <Text style={{ fontSize: 8, color: C.muted, letterSpacing: 1 }}>ALTERNATIVE</Text>
              <Text style={{ fontSize: 11, fontWeight: 700, color: ALT_COLOR, marginTop: 2 }}>{pa.alternative_pathway}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' }}>
            <Text style={{ fontSize: 8, color: C.muted, marginRight: 6 }}>Confidence:</Text>
            <View style={[S.badge, { backgroundColor: confBg }]}>
              <Text style={[S.badgeText, { color: confColor }]}>{pa.confidenceLevel}</Text>
            </View>
          </View>
        </View>

        <View style={S.dividerThin} />

        {/* ── STEM potential gold box ── */}
        {pa.stem_viable && pa.stem_gap_subjects && pa.stem_gap_subjects.length > 0 && (
          <View style={S.stemPotentialBox}>
            <Text style={S.stemPotentialTitle}>STEM PATHWAY POTENTIAL</Text>
            <Text style={S.stemPotentialBody}>
              This learner is one step away from STEM. Improve the following before Grade 10:
            </Text>
            {pa.stem_gap_subjects.map((subject, i) => (
              <Text key={i} style={S.stemGapItem}>
                {'• '}{subject.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}{' — currently Level 2, needs Level 3'}
              </Text>
            ))}
          </View>
        )}

        {/* ── TO UNLOCK / TO MAINTAIN ── */}
        <View style={{ flexDirection: 'row', marginTop: 12, marginBottom: 12 }}>
          <View style={[S.unlockBox, { flex: 1, marginRight: 10 }]}>
            <Text style={S.unlockTitle}>TO UNLOCK {(pa.alternative_pathway ?? 'STEM').toUpperCase()}</Text>
            {unlockItems.length > 0
              ? unlockItems.map((item, i) => (
                  <View key={i} style={{ flexDirection: 'row', marginBottom: 3 }}>
                    <Text style={{ fontSize: 7.5, color: '#475569', width: 10 }}>•</Text>
                    <Text style={{ fontSize: 7.5, color: '#475569', flex: 1 }}>{item}</Text>
                  </View>
                ))
              : <Text style={{ fontSize: 7.5, color: C.muted }}>No additional requirements</Text>
            }
          </View>
          <View style={[S.maintainBox, { flex: 1 }]}>
            <Text style={S.maintainTitle}>TO MAINTAIN {pa.recommendedPathway.toUpperCase()}</Text>
            {(pa.to_maintain_recommended ?? []).map((item, i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 3 }}>
                <Text style={{ fontSize: 7.5, color: '#475569', width: 10 }}>•</Text>
                <Text style={{ fontSize: 7.5, color: '#475569', flex: 1 }}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={S.dividerThin} />

        {/* ── Why this pathway / Subjects to strengthen ── */}
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          <View style={{ flex: 1, marginRight: 20 }}>
            <Text style={{ fontSize: 9, fontWeight: 700, color: C.text, letterSpacing: 1, marginBottom: 8 }}>WHY THIS PATHWAY FITS</Text>
            {pa.reasons.map((r, i) => (
              <View key={i} style={[S.listRow, { marginBottom: 5 }]}>
                <View style={[S.listDot, { backgroundColor: C.navy }]} />
                <Text style={[S.listText, { fontSize: 8.5 }]}>{r}</Text>
              </View>
            ))}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 9, fontWeight: 700, color: C.text, letterSpacing: 1, marginBottom: 8 }}>SUBJECTS TO STRENGTHEN BEFORE GRADE 10</Text>
            {pa.subjectsToStrengthen.map((s, i) => (
              <View key={i} style={[S.listRow, { marginBottom: 5 }]}>
                <View style={[S.listDot, { backgroundColor: C.gold }]} />
                <Text style={[S.listText, { fontSize: 8.5 }]}>{s}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={S.dividerThin} />

        {/* ── Future message ── */}
        <View style={{ backgroundColor: C.navyLight, borderRadius: 6, padding: 14 }}>
          <Text style={{ fontSize: 8, color: C.gold, letterSpacing: 1, marginBottom: 6 }}>WHAT THIS MEANS FOR YOUR CHILD'S FUTURE</Text>
          <Text style={{ fontSize: 9.5, color: C.white, lineHeight: 1.6 }}>{pa.futureMessage}</Text>
        </View>
      </View>
      <PageFooter reportId={report.reportId} />
    </Page>
  )
}

// ─── PAGE 4B: CAREER INTELLIGENCE (SENIOR) ───────────────────────────────────

function CareerPage({ report }: { report: AcademicClinicReport }) {
  const sp = report.studentProfile
  const sg = report.seniorGuidance!

  const strengthColor = (m?: string) =>
    m === 'STRONG' ? C.l3 : m === 'GOOD' ? C.l2 : C.muted
  const strengthBg = (m?: string) =>
    m === 'STRONG' ? C.l3bg : m === 'GOOD' ? C.l2bg : C.offWhite

  return (
    <Page size="A4" style={S.page}>
      <PageHeader name={sp.name} grade={sp.grade} pageNum={4} totalPages={7} reportId={report.reportId} />
      <View style={S.content}>
        <Text style={S.sectionLabel}>CAREER ANALYSIS · GRADES 10–12</Text>
        <Text style={S.sectionTitle}>Career Intelligence Report</Text>
        <View style={S.divider} />

        {sg.topCareers.map((c, i) => (
          <View key={i} style={S.careerCard}>
            <View style={S.careerHeader}>
              <Text style={S.careerName}>{i + 1}. {c.name}</Text>
              <View style={[S.badge, { backgroundColor: strengthBg(c.matchStrength) }]}>
                <Text style={[S.badgeText, { color: strengthColor(c.matchStrength) }]}>
                  {c.matchStrength ?? 'POSSIBLE'} MATCH
                </Text>
              </View>
            </View>
            {c.whyItFits && (
              <Text style={[S.careerDetail, { marginBottom: 5 }]}>
                <Text style={{ fontWeight: 700, color: C.text }}>Why it fits: </Text>
                {c.whyItFits}
              </Text>
            )}
            {c.keyGap && (
              <Text style={[S.careerDetail, { marginBottom: 5 }]}>
                <Text style={{ fontWeight: 700, color: C.l1 }}>Key gap: </Text>
                {c.keyGap}
              </Text>
            )}
            {c.kenyanPathway && (
              <Text style={[S.careerDetail, { marginBottom: 0, color: C.navy }]}>
                <Text style={{ fontWeight: 700 }}>Kenyan pathway: </Text>
                {c.kenyanPathway}
              </Text>
            )}
          </View>
        ))}

        <View style={S.dividerThin} />

        {/* Honest assessment */}
        <View style={S.honestBox}>
          <Text style={{ fontSize: 8, color: C.l1, letterSpacing: 1, marginBottom: 8 }}>HONEST ASSESSMENT</Text>
          <Text style={{ fontSize: 10, color: C.text, lineHeight: 1.6 }}>
            {sg.honestAssessment ?? sg.reasoning}
          </Text>
        </View>

        <View style={S.dividerThin} />

        {/* Next steps */}
        <Text style={{ fontSize: 9, fontWeight: 700, color: C.text, letterSpacing: 1, marginBottom: 8 }}>RECOMMENDED NEXT STEPS</Text>
        {sg.nextSteps.map((step, i) => (
          <View key={i} style={[S.listRow, { marginBottom: 6 }]}>
            <View style={[S.listDot, { backgroundColor: C.navy }]} />
            <Text style={[S.listText, { fontSize: 9 }]}>{step}</Text>
          </View>
        ))}
      </View>
      <PageFooter reportId={report.reportId} />
    </Page>
  )
}

// ─── PAGE 5: HOLIDAY ACTION PLAN ─────────────────────────────────────────────

function HolidayPlanPage({ report }: { report: AcademicClinicReport }) {
  const sp = report.studentProfile
  const hp = report.holidayPlan

  const weekColors = [C.l1, C.l2, C.l3]
  const weekBgs    = [C.l1bg, C.l2bg, C.l3bg]
  const weekMinutes = [45, 30, 20]

  return (
    <Page size="A4" style={S.page}>
      <PageHeader name={sp.name} grade={sp.grade} pageNum={5} totalPages={7} reportId={report.reportId} />
      <View style={S.content}>
        <Text style={S.sectionLabel}>HOLIDAY STUDY PROGRAMME</Text>
        <Text style={S.sectionTitle}>3-Week Holiday Action Plan</Text>
        <Text style={{ fontSize: 9, color: C.muted, marginTop: 2, marginBottom: 14 }}>Designed for boarding school students · Starts Day 1 of the holiday</Text>
        <View style={S.divider} />

        {/* Three week cards */}
        {hp.weeks.map((week, wi) => (
          <View key={wi} style={[S.weekCard, { borderLeftColor: weekColors[wi], marginBottom: 16 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <View style={[S.badge, { backgroundColor: weekBgs[wi], marginRight: 8 }]}>
                <Text style={[S.badgeText, { color: weekColors[wi], fontSize: 8 }]}>
                  WEEK {week.weekNumber} · DAYS {wi * 7 + 1}–{(wi + 1) * 7}
                </Text>
              </View>
              <Text style={{ fontSize: 8, color: C.muted }}>{weekMinutes[wi]} min/day · {week.focusSubjects.join(', ')}</Text>
            </View>
            <Text style={S.weekTitle}>{week.title} — {week.theme}</Text>
            <Text style={[S.weekMeta, { marginBottom: 6 }]}>Goal: {week.goal}</Text>
            {week.activities.slice(0, 3).map((act, ai) => (
              <View key={ai} style={{ flexDirection: 'row', marginBottom: 3 }}>
                <Text style={{ fontSize: 8, color: weekColors[wi], width: 12 }}>▸</Text>
                <Text style={{ fontSize: 8.5, color: C.text, flex: 1 }}>{act}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={S.dividerThin} />

        {/* Daily schedule template */}
        <Text style={{ fontSize: 9, fontWeight: 700, color: C.text, letterSpacing: 1, marginBottom: 8 }}>RECOMMENDED DAILY SCHEDULE</Text>
        <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 6, overflow: 'hidden' }}>
          <View style={[S.scheduleRow, { backgroundColor: C.offWhite, paddingHorizontal: 12 }]}>
            <Text style={S.scheduleTime}>MORNING</Text>
            <Text style={S.scheduleText}>{hp.morningRoutine}</Text>
          </View>
          <View style={[S.scheduleRow, { paddingHorizontal: 12 }]}>
            <Text style={S.scheduleTime}>AFTERNOON</Text>
            <Text style={S.scheduleText}>{hp.afternoonRoutine}</Text>
          </View>
          <View style={[S.scheduleRow, { backgroundColor: C.offWhite, paddingHorizontal: 12, borderBottomWidth: 0 }]}>
            <Text style={S.scheduleTime}>EVENING</Text>
            <Text style={S.scheduleText}>{hp.eveningRoutine}</Text>
          </View>
        </View>
      </View>
      <PageFooter reportId={report.reportId} />
    </Page>
  )
}

// ─── PAGE 6: LEARNING COMPASS ─────────────────────────────────────────────────

function CompassPage({ report }: { report: AcademicClinicReport }) {
  const sp  = report.studentProfile
  const rec = report.learningCompassRec

  return (
    <Page size="A4" style={S.page}>
      <PageHeader name={sp.name} grade={sp.grade} pageNum={6} totalPages={7} reportId={report.reportId} />
      <View style={S.content}>
        <Text style={S.sectionLabel}>AI TUTORING GUIDANCE</Text>
        <Text style={S.sectionTitle}>Learning Compass Recommendations</Text>
        <View style={S.divider} />

        {/* First session highlight */}
        <View style={S.compassHighlight}>
          <Text style={S.compassTitle}>START YOUR FIRST SESSION WITH</Text>
          <Text style={S.compassSubject}>{rec.firstSessionSubject}</Text>
          <Text style={{ fontSize: 9, color: '#94a3b8', marginTop: 6 }}>
            This is your highest-priority intervention area based on this assessment.
          </Text>
        </View>

        {/* Session frequency */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 4 }}>RECOMMENDED SESSION FREQUENCY</Text>
            <Text style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{rec.sessionFrequency}</Text>
          </View>
          <View style={[S.badge, { backgroundColor: C.navy }]}>
            <Text style={[S.badgeText, { color: C.gold }]}>HOLIDAY GOAL</Text>
          </View>
        </View>

        {/* Session goal */}
        <View style={[S.clinBox, { marginBottom: 20 }]}>
          <Text style={S.clinText}>{rec.sessionGoal}</Text>
        </View>

        <View style={S.dividerThin} />

        {/* Topics to ask */}
        <Text style={{ fontSize: 9, fontWeight: 700, color: C.text, letterSpacing: 1, marginBottom: 12 }}>
          3 SPECIFIC TOPICS TO ASK YOUR LEARNING COMPASS TUTOR
        </Text>
        {rec.topicsToAsk.map((topic, i) => (
          <View key={i} style={[S.topicRow, { marginBottom: 12 }]}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.navy, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
              <Text style={{ fontSize: 10, fontWeight: 700, color: C.gold }}>{i + 1}</Text>
            </View>
            <Text style={[S.topicText, { flex: 1 }]}>{topic}</Text>
          </View>
        ))}

        <View style={S.dividerThin} />

        {/* CTA */}
        <View style={{ backgroundColor: C.gold, borderRadius: 6, padding: 14, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, fontWeight: 700, color: C.navy }}>Start your first session now</Text>
            <Text style={{ fontSize: 9, color: C.navy, marginTop: 4 }}>
              Open your browser and visit edunexus.co.ke/chat to begin
            </Text>
          </View>
          <Text style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>edunexus.co.ke/chat</Text>
        </View>
      </View>
      <PageFooter reportId={report.reportId} />
    </Page>
  )
}

// ─── PAGE 7: TEACHER COLLABORATION ───────────────────────────────────────────

function TeacherPage({ report }: { report: AcademicClinicReport }) {
  const sp = report.studentProfile
  const co = report.clinicalOverview
  const byDesc = [...report.subjectBreakdown].sort((a, b) => b.level - a.level)
  const byAsc  = [...report.subjectBreakdown].sort((a, b) => a.level - b.level)
  const strengths = byDesc.filter(s => s.level >= 3).slice(0, 3)
  const supports  = byAsc.filter(s => s.level <= 2).slice(0, 3)
  const dateStr   = new Date(report.generatedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <Page size="A4" style={S.page}>
      <PageHeader name={sp.name} grade={sp.grade} pageNum={7} totalPages={7} reportId={report.reportId} />
      <View style={S.content}>
        <Text style={S.sectionLabel}>TEACHER REFERENCE PAGE</Text>
        <Text style={S.sectionTitle}>For the Class Teacher</Text>
        <View style={S.divider} />

        {/* Summary box */}
        <View style={S.teacherBox}>
          <Text style={S.teacherLabel}>STUDENT PERFORMANCE SUMMARY</Text>
          <Text style={{ fontSize: 10, color: C.text, lineHeight: 1.6, marginBottom: 6 }}>
            {sp.name} (Grade {sp.grade}) has completed an EduNexus Academic Clinic assessment for Term {sp.term}, {sp.year}.
            Overall competency is rated <Text style={{ fontWeight: 700 }}>{co.overallCompetencyLabel} (Level {co.overallCompetencyLevel})</Text> with a trajectory of <Text style={{ fontWeight: 700 }}>{co.trajectory}</Text>.
          </Text>
          <Text style={{ fontSize: 10, color: C.text, lineHeight: 1.6 }}>
            {report.subjectBreakdown.length} subjects were assessed.
            {report.vitals.strengths > 0 ? ` ${report.vitals.strengths} subject(s) are at Proficient or Exemplary level.` : ''}
            {report.vitals.urgent > 0 ? ` ${report.vitals.urgent} subject(s) require urgent intervention.` : ''}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', marginBottom: 14 }}>
          {/* Classroom support areas */}
          <View style={[S.teacherBox, { flex: 1, marginRight: 10, marginBottom: 0 }]}>
            <Text style={S.teacherLabel}>SUGGESTED CLASSROOM SUPPORT AREAS</Text>
            {supports.length > 0
              ? supports.map((s, i) => (
                  <View key={i} style={[S.listRow, { marginBottom: 5 }]}>
                    <View style={[S.listDot, { backgroundColor: C.l1 }]} />
                    <Text style={{ fontSize: 9, color: C.text, flex: 1 }}>{s.displayName}</Text>
                    <Text style={{ fontSize: 8, color: C.l1 }}>Level {s.level}</Text>
                  </View>
                ))
              : <Text style={{ fontSize: 9, color: C.muted }}>No critical support areas identified</Text>
            }
          </View>
          {/* Leadership opportunities */}
          <View style={[S.teacherBox, { flex: 1, marginBottom: 0 }]}>
            <Text style={[S.teacherLabel, { color: C.l3 }]}>AREAS WHERE THIS STUDENT EXCELS — CONSIDER LEADERSHIP OPPORTUNITIES</Text>
            {strengths.length > 0
              ? strengths.map((s, i) => (
                  <View key={i} style={[S.listRow, { marginBottom: 5 }]}>
                    <View style={[S.listDot, { backgroundColor: C.l3 }]} />
                    <Text style={{ fontSize: 9, color: C.text, flex: 1 }}>{s.displayName}</Text>
                    <Text style={{ fontSize: 8, color: C.l3 }}>Level {s.level}</Text>
                  </View>
                ))
              : <Text style={{ fontSize: 9, color: C.muted }}>Building toward strengths</Text>
            }
          </View>
        </View>

        {/* Teacher observations */}
        <View style={S.teacherBox}>
          <Text style={S.teacherLabel}>TEACHER'S OBSERVATIONS</Text>
          {[1, 2, 3].map(i => (
            <View key={i} style={S.teacherLine} />
          ))}
        </View>

        {/* Action agreed */}
        <View style={[S.teacherBox, { marginBottom: 0 }]}>
          <Text style={S.teacherLabel}>ACTION AGREED WITH PARENT</Text>
          {[1, 2].map(i => (
            <View key={i} style={S.teacherLine} />
          ))}
        </View>

        {/* Signature row — fixed to bottom of this page */}
        <View style={{ marginTop: 40 }} />
        <View style={S.sigRow} wrap={false}>
          <View style={S.sigBlock}>
            <View style={S.sigLine} />
            <Text style={S.sigLabel}>Teacher's Signature</Text>
          </View>
          <View style={S.sigBlock}>
            <View style={S.sigLine} />
            <Text style={S.sigLabel}>Parent's Signature</Text>
          </View>
          <View style={[S.sigBlock, { marginRight: 0, flex: 0.6 }]}>
            <View style={S.sigLine} />
            <Text style={S.sigLabel}>Date</Text>
          </View>
        </View>
      </View>

      {/* Override footer with custom teacher footer */}
      <View style={[S.pageFooter, { flexDirection: 'column', alignItems: 'center' }]}>
        <Text style={[S.pageFooterText, { marginBottom: 2 }]}>
          This report was generated by EduNexus Academic Clinic · {dateStr} · Report ID: {report.reportId}
        </Text>
        <Text style={S.pageFooterText}>edunexus.co.ke · CONFIDENTIAL — For Parent and Teacher Use Only</Text>
      </View>
    </Page>
  )
}

// ─── Root PDF Component ───────────────────────────────────────────────────────

export const AcademicClinicPDF = ({ report }: { report: AcademicClinicReport }) => {
  const isJunior = report.studentProfile.grade >= 7 && report.studentProfile.grade <= 9

  return (
    <Document
      title={`EduNexus Academic Clinic — ${report.studentProfile.name}`}
      author="EduNexus Academic Clinic"
      subject="Academic Performance Report"
    >
      <CoverPage report={report} />
      <ClinicalOverviewPage report={report} />
      <SubjectMatrixPage report={report} />

      {isJunior && report.pathwayAnalysis
        ? <PathwayPage report={report} />
        : report.seniorGuidance
          ? <CareerPage report={report} />
          : <PathwayPage report={report} />
      }

      <HolidayPlanPage report={report} />
      <CompassPage report={report} />
      <TeacherPage report={report} />
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
