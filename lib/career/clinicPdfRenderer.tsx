// lib/career/clinicPdfRenderer.tsx
// CBC Clinic Report PDF using @react-pdf/renderer
// Junior (Grade 7–9): CoverPage → PathwayCareerPage → SkillsParentPage
// Senior (Grade 10–12): HealthCheckPage → PathwayReadinessPage → ParentPlanPage

import React from 'react'
import {
  Document, Page, Text, View, StyleSheet,
} from '@react-pdf/renderer'
import type { ClinicReport, SubjectScoreRow } from './types'
import { PATHWAY_DISCLAIMER } from '@/lib/pathwayCalculator'

// ─── Palette ──────────────────────────────────────────────────────────────────

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
  teal:      '#0d9488',
  tealLight: '#f0fdfa',
  blue:      '#3b82f6',
  blueLight: '#eff6ff',
  green:     '#16a34a',
  amber:     '#d97706',
  red:       '#dc2626',
}

function levelColor(l: number) { return [C.l1, C.l2, C.l3, C.l4][l - 1] ?? C.muted }
function levelBg(l: number)    { return [C.l1bg, C.l2bg, C.l3bg, C.l4bg][l - 1] ?? C.offWhite }

function scoreBadgeBg(score: number): string {
  if (score >= 3.5) return '#7c3aed'
  if (score >= 2.5) return '#16a34a'
  if (score >= 1.5) return '#d97706'
  return '#dc2626'
}

function statusBadgeBg(s: SubjectScoreRow['status']): string {
  return s === 'strong' ? '#7c3aed' : s === 'meets' ? '#16a34a' : s === 'needs_work' ? '#d97706' : '#dc2626'
}

function readinessBg(label: string | undefined) {
  if (label === 'Strong')     return { bg: C.l4bg, fg: C.l4 }
  if (label === 'On Track')   return { bg: C.l3bg, fg: C.l3 }
  return                             { bg: C.l2bg, fg: C.l2 }
}

function healthStatusColors(level: number) {
  if (level === 4) return { bg: C.l4bg, fg: C.l4 }
  if (level === 3) return { bg: C.l3bg, fg: C.l3 }
  if (level === 2) return { bg: C.l2bg, fg: C.l2 }
  return                  { bg: C.l1bg, fg: C.l1 }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page:        { backgroundColor: C.white, fontFamily: 'Helvetica', paddingBottom: 50 },
  coverPage:   { backgroundColor: C.navy, fontFamily: 'Helvetica' },

  // Cover (used for junior)
  coverHeader: { backgroundColor: C.navyLight, paddingHorizontal: 48, paddingVertical: 36, borderBottomWidth: 3, borderBottomColor: C.gold },
  coverBrand:  { fontSize: 10, color: C.gold, letterSpacing: 3, marginBottom: 4 },
  coverTitle:  { fontSize: 26, fontWeight: 700, color: C.white },
  coverBody:   { paddingHorizontal: 48, paddingTop: 48 },
  coverName:   { fontSize: 34, fontWeight: 700, color: C.gold, marginBottom: 10 },
  coverMeta:   { fontSize: 13, color: '#94a3b8', marginBottom: 5 },
  coverDivider:{ borderTopWidth: 1, borderTopColor: '#2d4070', marginVertical: 32 },
  coverFooter: { position: 'absolute', bottom: 40, left: 48, right: 48 },
  coverFooterText: { fontSize: 8, color: '#64748b' },

  // Page header band
  pageHeader:      { backgroundColor: C.navy, paddingHorizontal: 36, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageHeaderBrand: { fontSize: 8, color: C.gold, letterSpacing: 2 },
  pageHeaderName:  { fontSize: 9, color: '#94a3b8', marginTop: 2 },
  pageHeaderRight: { alignItems: 'flex-end' },
  pageHeaderPage:  { fontSize: 8, color: '#94a3b8' },
  goldLine:        { height: 2, backgroundColor: C.gold },

  // Page footer
  pageFooter:     { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 36, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageFooterText: { fontSize: 7, color: C.muted },

  // Content area
  content: { paddingHorizontal: 36, paddingTop: 20 },

  // Section headings
  sectionLabel: { fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 5 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 },
  divider:      { borderTopWidth: 1, borderTopColor: C.border, marginVertical: 12 },

  // Summary box
  summaryBox:  { backgroundColor: C.offWhite, borderRadius: 6, padding: 14, borderLeftWidth: 3, borderLeftColor: C.gold, marginBottom: 16 },
  summaryText: { fontSize: 10, color: C.text, lineHeight: 1.6 },

  // Subject rows
  subjectRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  subjectName: { fontSize: 10, color: C.text, flex: 1 },

  // Action card
  actionCard:  { marginBottom: 9, padding: 10, borderRadius: 6, borderLeftWidth: 3 },
  actionTitle: { fontSize: 10, fontWeight: 700, color: C.text, marginBottom: 3 },
  actionText:  { fontSize: 9.5, color: C.text, lineHeight: 1.5 },

  // Timeline item (junior)
  timelineItem:  { marginBottom: 12, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: C.gold },
  timelineLabel: { fontSize: 9, color: C.gold, fontWeight: 700, marginBottom: 3 },
  timelineText:  { fontSize: 10, color: C.text, lineHeight: 1.5 },

  // Disclaimer
  disclaimerBox:  { backgroundColor: C.offWhite, borderRadius: 4, padding: 10, marginTop: 12, borderWidth: 1, borderColor: C.border },
  disclaimerText: { fontSize: 7.5, color: C.muted, lineHeight: 1.5 },

  // Pathway box (junior)
  pathwayBox:  { borderRadius: 8, padding: 20, marginBottom: 18 },
  pathwayHead: { fontSize: 20, fontWeight: 700, marginBottom: 6 },
  pathwayBody: { fontSize: 10, lineHeight: 1.6 },
})

// ─── Shared components ────────────────────────────────────────────────────────

function PageHeader({ name, pageLabel }: { name: string; pageLabel: string }) {
  return (
    <>
      <View style={S.pageHeader}>
        <View>
          <Text style={S.pageHeaderBrand}>EDUNEXUS · ACADEMIC CLINIC</Text>
          <Text style={S.pageHeaderName}>{name} — Learner Intelligence Report</Text>
        </View>
        <View style={S.pageHeaderRight}>
          <Text style={S.pageHeaderPage}>{pageLabel}</Text>
        </View>
      </View>
      <View style={S.goldLine} />
    </>
  )
}

function PageFooter({ date }: { date: string }) {
  return (
    <View style={S.pageFooter} fixed>
      <Text style={S.pageFooterText}>EduNexus Learner Intelligence Report · Generated {date}</Text>
      <Text style={S.pageFooterText}>edunexus.co.ke · CONFIDENTIAL</Text>
    </View>
  )
}

// ─── SENIOR — Page 1: Academic Health Check ───────────────────────────────────

function SeniorHealthCheckPage({ report }: { report: ClinicReport }) {
  const date = new Date(report.generated_at).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const gradeLabel   = report.curriculumLabel
  const statusColors = healthStatusColors(report.overall_level)
  const firstName    = report.student_name.split(' ')[0]

  return (
    <Page size="A4" style={S.page}>
      {/* Navy cover header */}
      <View style={{ backgroundColor: C.navy, paddingHorizontal: 36, paddingVertical: 24, borderBottomWidth: 3, borderBottomColor: C.gold }}>
        <Text style={{ fontSize: 9, color: C.gold, letterSpacing: 3, marginBottom: 4 }}>EDUNEXUS · ACADEMIC CLINIC</Text>
        <Text style={{ fontSize: 22, fontWeight: 700, color: C.white }}>Learner Intelligence Report</Text>
      </View>
      <View style={S.goldLine} />

      <View style={S.content}>
        {/* Student identity row */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 28, fontWeight: 700, color: C.navy, marginBottom: 4 }}>{report.student_name}</Text>
            <Text style={{ fontSize: 11, color: C.muted }}>{gradeLabel}</Text>
            {report.recommended_pathway && (
              <Text style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                Pathway: {report.recommended_pathway}
              </Text>
            )}
            <Text style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{date}</Text>
          </View>

          {/* Overall level badge */}
          <View style={{ backgroundColor: scoreBadgeBg(report.overall_score), paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignItems: 'center', minWidth: 80 }}>
            <Text style={{ fontSize: 11, color: '#ffffff', letterSpacing: 1, marginBottom: 2 }}>OVERALL</Text>
            <Text style={{ fontSize: 30, fontWeight: 700, color: '#ffffff' }}>L{report.overall_level}</Text>
            <Text style={{ fontSize: 9, color: '#ffffff', marginTop: 2 }}>{report.overall_label}</Text>
          </View>
        </View>

        {/* Academic Health Status */}
        <View style={{ backgroundColor: statusColors.bg, borderRadius: 6, padding: 12, marginBottom: 18, borderLeftWidth: 4, borderLeftColor: statusColors.fg }}>
          <Text style={{ fontSize: 8, color: statusColors.fg, letterSpacing: 2, marginBottom: 3 }}>ACADEMIC HEALTH STATUS</Text>
          <Text style={{ fontSize: 17, fontWeight: 700, color: statusColors.fg }}>
            {report.academicHealthStatus ?? 'Developing Foundation'}
          </Text>
        </View>

        <View style={S.divider} />

        {/* Top Strengths / Development Areas — two columns */}
        <View style={{ flexDirection: 'row', marginBottom: 16 }}>
          {/* Strengths */}
          <View style={{ flex: 1, marginRight: 10, backgroundColor: C.l3bg, borderRadius: 6, padding: 12 }}>
            <Text style={{ fontSize: 8, color: C.l3, letterSpacing: 2, marginBottom: 8, fontWeight: 700 }}>TOP STRENGTHS</Text>
            {(report.strongContributors && report.strongContributors.length > 0
              ? report.strongContributors
              : report.top_subjects
            ).map(s => (
              <View key={s.subject} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                <Text style={{ fontSize: 9.5, color: C.text, flex: 1 }}>{s.display_name}</Text>
                <View style={{ backgroundColor: scoreBadgeBg(s.score), paddingHorizontal: 7, paddingVertical: 2, borderRadius: 3 }}>
                  <Text style={{ fontSize: 9, fontWeight: 700, color: '#ffffff' }}>L{s.score.toFixed(0)}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Development Areas */}
          <View style={{ flex: 1, backgroundColor: C.l1bg, borderRadius: 6, padding: 12 }}>
            <Text style={{ fontSize: 8, color: C.l1, letterSpacing: 2, marginBottom: 8, fontWeight: 700 }}>TOP DEVELOPMENT AREAS</Text>
            {(report.currentConstraints && report.currentConstraints.length > 0
              ? report.currentConstraints
              : report.weak_subjects
            ).map(s => (
              <View key={s.subject} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                <Text style={{ fontSize: 9.5, color: C.text, flex: 1 }}>{s.display_name}</Text>
                <View style={{ backgroundColor: scoreBadgeBg(s.score), paddingHorizontal: 7, paddingVertical: 2, borderRadius: 3 }}>
                  <Text style={{ fontSize: 9, fontWeight: 700, color: '#ffffff' }}>L{s.score.toFixed(0)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={S.divider} />

        {/* Academic Diagnosis */}
        <Text style={{ fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 6 }}>ACADEMIC DIAGNOSIS</Text>
        <View style={{ backgroundColor: C.offWhite, borderRadius: 6, padding: 14, borderLeftWidth: 3, borderLeftColor: C.gold }}>
          <Text style={{ fontSize: 10.5, color: C.text, lineHeight: 1.7 }}>
            {report.academicDiagnosis ?? report.summary_sentence}
          </Text>
        </View>

        {/* All subject scores — compact grid */}
        <View style={{ marginTop: 14 }}>
          <Text style={{ fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 8 }}>SUBJECT PERFORMANCE</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {[...report.top_subjects, ...report.weak_subjects].map(s => (
              <View key={s.subject} style={{ flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 4 }}>
                <Text style={{ fontSize: 9, color: C.text, flex: 1 }}>{s.display_name}</Text>
                <View style={{ backgroundColor: statusBadgeBg(s.status), paddingHorizontal: 6, paddingVertical: 1, borderRadius: 3, marginRight: 8 }}>
                  <Text style={{ fontSize: 8, color: '#ffffff', fontWeight: 700 }}>L{s.score.toFixed(0)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      <PageFooter date={date} />
    </Page>
  )
}

// ─── SENIOR — Page 2: Pathway Readiness Analysis ─────────────────────────────

function SeniorPathwayReadinessPage({ report }: { report: ClinicReport }) {
  const date        = new Date(report.generated_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })
  const readiness   = readinessBg(report.pathwayReadinessLabel)
  const pw          = report.recommended_pathway ?? 'Not specified'
  const roadmap     = report.nextLevelRoadmap ?? []
  const opps        = report.futureOpportunities ?? []
  const contributors = report.strongContributors ?? report.top_subjects
  const constraints  = report.currentConstraints ?? report.weak_subjects
  const score        = report.readinessScore ?? 0

  const TIMELINE_ESTIMATE = roadmap.length === 0
    ? 'Continue current trajectory to deepen pathway readiness.'
    : roadmap.every(r => r.fromLevel >= 2)
      ? '4–8 weeks of consistent intervention'
      : '8–12 weeks of intensive intervention'

  return (
    <Page size="A4" style={S.page}>
      <PageHeader name={report.student_name} pageLabel="Page 2 of 3" />

      <View style={S.content}>
        {/* ── PATHWAY READINESS ANALYSIS ── */}
        <Text style={S.sectionLabel}>SECTION 2 — PATHWAY READINESS ANALYSIS</Text>
        <View style={S.divider} />

        {/* Current Pathway + Readiness Score row */}
        <View style={{ flexDirection: 'row', marginBottom: 14, alignItems: 'stretch' }}>
          {/* Pathway box */}
          <View style={{ flex: 1, marginRight: 10, backgroundColor: C.navyLight, borderRadius: 6, padding: 14 }}>
            <Text style={{ fontSize: 8, color: C.gold, letterSpacing: 2, marginBottom: 4 }}>CURRENT PATHWAY</Text>
            <Text style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 6 }}>{pw}</Text>
            <Text style={{ fontSize: 8.5, color: '#94a3b8', lineHeight: 1.5 }}>
              {pw === 'STEM'
                ? 'Science, Technology, Engineering & Mathematics'
                : pw === 'Social Sciences'
                ? 'Humanities, social sciences, law, education, and community-focused careers'
                : pw === 'Arts & Sports Science'
                ? 'Creative arts, performing arts, sports science, and design-based careers'
                : pw === 'Business'
                ? 'Business, finance, entrepreneurship, and commerce careers'
                : 'Senior school chosen pathway'}
            </Text>
          </View>

          {/* Readiness badge */}
          <View style={{ width: 130, backgroundColor: readiness.bg, borderRadius: 6, padding: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: readiness.fg + '40' }}>
            <Text style={{ fontSize: 8, color: readiness.fg, letterSpacing: 2, marginBottom: 4 }}>PATHWAY READINESS</Text>
            <Text style={{ fontSize: 18, fontWeight: 700, color: readiness.fg, marginBottom: 4 }}>
              {report.pathwayReadinessLabel ?? 'Developing'}
            </Text>
            <View style={{ backgroundColor: readiness.fg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>{score}<Text style={{ fontSize: 9 }}>/100</Text></Text>
            </View>
          </View>
        </View>

        {/* Strong Contributors / Current Constraints */}
        <View style={{ flexDirection: 'row', marginBottom: 14 }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={{ fontSize: 8, color: C.l3, letterSpacing: 2, marginBottom: 6, fontWeight: 700 }}>STRONG CONTRIBUTORS</Text>
            {contributors.length > 0 ? contributors.map(s => (
              <View key={s.subject} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontSize: 9, color: C.l3, marginRight: 5 }}>✓</Text>
                <Text style={{ fontSize: 9.5, color: C.text, flex: 1 }}>{s.display_name}</Text>
                <View style={{ backgroundColor: scoreBadgeBg(s.score), paddingHorizontal: 6, paddingVertical: 1, borderRadius: 3 }}>
                  <Text style={{ fontSize: 8, color: '#ffffff', fontWeight: 700 }}>L{s.score.toFixed(0)}</Text>
                </View>
              </View>
            )) : (
              <Text style={{ fontSize: 9, color: C.muted }}>Build subject strengths through consistent study.</Text>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 8, color: C.l1, letterSpacing: 2, marginBottom: 6, fontWeight: 700 }}>CURRENT CONSTRAINTS</Text>
            {constraints.length > 0 ? constraints.map(s => (
              <View key={s.subject} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontSize: 9, color: C.l1, marginRight: 5 }}>!</Text>
                <Text style={{ fontSize: 9.5, color: C.text, flex: 1 }}>{s.display_name}</Text>
                <View style={{ backgroundColor: scoreBadgeBg(s.score), paddingHorizontal: 6, paddingVertical: 1, borderRadius: 3 }}>
                  <Text style={{ fontSize: 8, color: '#ffffff', fontWeight: 700 }}>L{s.score.toFixed(0)}</Text>
                </View>
              </View>
            )) : (
              <Text style={{ fontSize: 9, color: C.l3 }}>No significant constraints identified.</Text>
            )}
          </View>
        </View>

        {/* Next Level Roadmap */}
        <View style={{ backgroundColor: C.offWhite, borderRadius: 6, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ fontSize: 8, color: C.navy, letterSpacing: 2, marginBottom: 8, fontWeight: 700 }}>NEXT LEVEL ROADMAP</Text>
          {roadmap.length > 0 ? (
            <>
              {roadmap.map((step, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                  <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                    <Text style={{ fontSize: 8, color: '#ffffff', fontWeight: 700 }}>✓</Text>
                  </View>
                  <Text style={{ fontSize: 9.5, color: C.text, flex: 1 }}>
                    Improve <Text style={{ fontWeight: 700 }}>{step.subject}</Text> from Level {step.fromLevel} → Level {step.toLevel}
                  </Text>
                </View>
              ))}
              <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 8, color: C.muted, marginRight: 4 }}>Estimated timeline:</Text>
                <Text style={{ fontSize: 9, color: C.navy, fontWeight: 700 }}>{TIMELINE_ESTIMATE}</Text>
              </View>
            </>
          ) : (
            <Text style={{ fontSize: 9.5, color: C.l3, lineHeight: 1.5 }}>
              Strong pathway readiness. Focus on maintaining performance and deepening engagement with advanced topics.
            </Text>
          )}
        </View>

        <View style={[S.divider, { marginVertical: 10 }]} />

        {/* Future Opportunities — compact (15-20% of page) */}
        <Text style={{ fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 6 }}>FUTURE OPPORTUNITIES WORTH EXPLORING</Text>

        {opps.slice(0, 3).map((opp, i) => (
          <View key={i} style={{ marginBottom: 8, padding: 10, backgroundColor: C.offWhite, borderRadius: 5, borderLeftWidth: 3, borderLeftColor: i === 0 ? C.l4 : i === 1 ? C.teal : C.gold }}>
            <Text style={{ fontSize: 10, fontWeight: 700, color: C.text, marginBottom: 4 }}>{opp.name}</Text>
            <Text style={{ fontSize: 8.5, color: C.muted, lineHeight: 1.45, marginBottom: 3 }}>
              <Text style={{ fontWeight: 700 }}>Alignment: </Text>{opp.alignment}
            </Text>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={{ fontSize: 8, color: C.teal, fontWeight: 700, marginBottom: 2 }}>Future Trend</Text>
                <Text style={{ fontSize: 8, color: C.muted, lineHeight: 1.4 }}>{opp.futureTrend}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 8, color: C.l4, fontWeight: 700, marginBottom: 2 }}>AI Reality</Text>
                <Text style={{ fontSize: 8, color: C.muted, lineHeight: 1.4 }}>{opp.aiReality}</Text>
              </View>
            </View>
          </View>
        ))}

        {/* Career Explorer CTA */}
        <View style={{ backgroundColor: '#f5f3ff', borderRadius: 6, padding: 10, borderLeftWidth: 3, borderLeftColor: C.l4 }}>
          <Text style={{ fontSize: 9, fontWeight: 700, color: '#5b21b6', marginBottom: 3 }}>
            Go deeper — EduNexus Career Explorer
          </Text>
          <Text style={{ fontSize: 8.5, color: '#3b0764', lineHeight: 1.55 }}>
            {report.top_career
              ? `${report.student_name.split(' ')[0]}'s top match is ${report.top_career.career.title} (${report.top_career.match_score}% match). See the full profile — salary tiers, entrepreneurship opportunities, honest AI disruption analysis, and pathway planning — in the Career Explorer.`
              : 'For detailed career analysis, future trends, salary data, entrepreneurship opportunities, AI disruption analysis, and pathway planning, visit the Career Explorer.'}
          </Text>
          <Text style={{ fontSize: 9, color: '#6d28d9', fontWeight: 700, marginTop: 4 }}>
            {report.top_career ? `edunexus.co.ke/career/${report.top_career.career.slug}` : 'edunexus.co.ke/career'}
          </Text>
        </View>
      </View>

      <PageFooter date={date} />
    </Page>
  )
}

// ─── SENIOR — Page 3: Parent Action Plan ─────────────────────────────────────

function SeniorParentPlanPage({ report }: { report: ClinicReport }) {
  const date        = new Date(report.generated_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })
  const plan        = report.parentPlan
  const outcomes    = report.expectedOutcome ?? []
  const prescription = report.compassPrescription
  const firstName   = report.student_name.split(' ')[0]

  const PLAN_SECTIONS = [
    { key: 'thisWeek',  label: 'THIS WEEK',  color: C.gold,  bg: C.goldLight  },
    { key: 'thisMonth', label: 'THIS MONTH', color: C.teal,  bg: C.tealLight  },
    { key: 'thisTerm',  label: 'THIS TERM',  color: C.blue,  bg: C.blueLight  },
  ] as const

  return (
    <Page size="A4" style={S.page}>
      <PageHeader name={report.student_name} pageLabel="Page 3 of 3" />

      <View style={S.content}>
        {/* ── PARENT ACTION PLAN ── */}
        <Text style={S.sectionLabel}>SECTION 3 — PARENT ACTION PLAN</Text>
        <Text style={{ fontSize: 8.5, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
          These actions are specific, measurable, and realistic. Follow them consistently and the expected outcomes below become achievable.
        </Text>
        <View style={S.divider} />

        {plan ? (
          PLAN_SECTIONS.map(({ key, label, color, bg }) => {
            const actions = plan[key] ?? []
            return (
              <View key={key} style={{ marginBottom: 10 }}>
                <View style={{ backgroundColor: color, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 6 }}>
                  <Text style={{ fontSize: 8, color: '#ffffff', fontWeight: 700, letterSpacing: 1 }}>{label}</Text>
                </View>
                {actions.map((a, i) => (
                  <View key={i} style={{ backgroundColor: bg, borderRadius: 5, padding: 9, marginBottom: 5, borderLeftWidth: 3, borderLeftColor: color }}>
                    <Text style={{ fontSize: 9.5, color: C.text, lineHeight: 1.5 }}>{a.action}</Text>
                  </View>
                ))}
              </View>
            )
          })
        ) : (
          report.parent_actions.slice(0, 4).map((act, i) => {
            const colors = [{ border: C.gold, bg: C.goldLight }, { border: C.teal, bg: C.tealLight }, { border: C.l4, bg: C.l4bg }, { border: C.green, bg: C.l3bg }]
            return (
              <View key={i} style={[S.actionCard, { borderLeftColor: colors[i]?.border ?? C.gold, backgroundColor: colors[i]?.bg ?? C.goldLight }]}>
                <Text style={S.actionTitle}>{i + 1}. {act.title}</Text>
                <Text style={{ fontSize: 8.5, color: C.muted, marginBottom: 4, lineHeight: 1.4 }}>{act.why}</Text>
                <Text style={S.actionText}>{act.action}</Text>
              </View>
            )
          })
        )}

        {/* Expected Outcome */}
        {outcomes.length > 0 && (
          <View style={{ marginTop: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 6 }}>EXPECTED OUTCOME</Text>
            <View style={{ backgroundColor: C.l3bg, borderRadius: 5, padding: 10, borderLeftWidth: 3, borderLeftColor: C.l3 }}>
              <Text style={{ fontSize: 8.5, color: C.navy, marginBottom: 6, lineHeight: 1.5 }}>
                If these actions are followed consistently:
              </Text>
              {outcomes.map((o, i) => (
                <View key={i} style={{ flexDirection: 'row', marginBottom: 3 }}>
                  <Text style={{ fontSize: 9, color: C.l3, marginRight: 5, fontWeight: 700 }}>•</Text>
                  <Text style={{ fontSize: 9, color: C.text, flex: 1, lineHeight: 1.4 }}>{o}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={[S.divider, { marginVertical: 10 }]} />

        {/* Learning Compass Prescription */}
        <View style={{ backgroundColor: C.navy, borderRadius: 7, padding: 14 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <View style={{ backgroundColor: C.gold, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, marginRight: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>Rx</Text>
            </View>
            <View>
              <Text style={{ fontSize: 11, fontWeight: 700, color: C.white }}>Learning Compass Prescription</Text>
              <Text style={{ fontSize: 8, color: '#94a3b8', marginTop: 1 }}>Prescribed intervention — follow as directed</Text>
            </View>
          </View>

          <View style={{ borderTopWidth: 1, borderTopColor: '#2d4070', marginBottom: 10 }} />

          {/* Focus topics */}
          <Text style={{ fontSize: 8, color: C.gold, letterSpacing: 2, marginBottom: 6 }}>PRESCRIBED FOCUS AREAS</Text>
          {(prescription?.focusTopics ?? []).map((t, i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 4 }}>
              <Text style={{ fontSize: 9, color: C.gold, marginRight: 6, fontWeight: 700 }}>{i + 1}.</Text>
              <Text style={{ fontSize: 9, color: '#cbd5e1', flex: 1, lineHeight: 1.4 }}>{t}</Text>
            </View>
          ))}

          {/* Frequency + Window */}
          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ fontSize: 8, color: C.gold, letterSpacing: 1, marginBottom: 3 }}>SESSION FREQUENCY</Text>
              <Text style={{ fontSize: 10, fontWeight: 700, color: C.white }}>{prescription?.sessionFrequency ?? '3 sessions per week'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 8, color: C.gold, letterSpacing: 1, marginBottom: 3 }}>IMPROVEMENT WINDOW</Text>
              <Text style={{ fontSize: 10, fontWeight: 700, color: C.white }}>{prescription?.estimatedWindow ?? '4–6 weeks'}</Text>
            </View>
          </View>

          <View style={{ borderTopWidth: 1, borderTopColor: '#2d4070', marginTop: 10, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 8.5, color: '#94a3b8' }}>
              Open the Learning Compass with {firstName} — it starts exactly where they are.
            </Text>
            <Text style={{ fontSize: 9, color: C.gold, fontWeight: 700 }}>edunexus.co.ke/learn</Text>
          </View>
        </View>

        {/* Disclaimer */}
        <View style={S.disclaimerBox}>
          <Text style={S.disclaimerText}>{report.disclaimer}</Text>
        </View>
      </View>

      <PageFooter date={date} />
    </Page>
  )
}

// ─── JUNIOR — Page 1: Cover ───────────────────────────────────────────────────

function CoverPage({ report }: { report: ClinicReport }) {
  const date = new Date(report.generated_at).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const gradeLabel = report.curriculumLabel

  return (
    <Page size="A4" style={S.coverPage}>
      <View style={S.coverHeader}>
        <Text style={S.coverBrand}>EDUNEXUS · ACADEMIC CLINIC</Text>
        <Text style={S.coverTitle}>Learner Intelligence Report</Text>
      </View>

      <View style={S.coverBody}>
        <Text style={S.coverMeta}>PREPARED FOR</Text>
        <Text style={S.coverName}>{report.student_name}</Text>
        <Text style={S.coverMeta}>{gradeLabel} · {report.curriculum_type.toUpperCase()}</Text>
        <Text style={S.coverMeta}>Age: {report.age}</Text>
        <View style={S.coverDivider} />

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
          <View style={{ backgroundColor: scoreBadgeBg(report.overall_score), paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, marginRight: 16 }}>
            <Text style={{ fontSize: 28, fontWeight: 700, color: '#ffffff' }}>Level {report.overall_level}</Text>
            <Text style={{ fontSize: 11, color: '#ffffff', marginTop: 2 }}>{report.overall_label}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.6 }}>{report.summary_sentence}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', marginBottom: 24 }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontSize: 9, color: C.gold, letterSpacing: 2, marginBottom: 8 }}>TOP SUBJECTS</Text>
            {report.top_subjects.map(s => (
              <View key={s.subject} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                <Text style={{ fontSize: 10, color: '#94a3b8', flex: 1 }}>{s.display_name}</Text>
                <View style={{ backgroundColor: scoreBadgeBg(s.score), paddingHorizontal: 8, paddingVertical: 2, borderRadius: 3 }}>
                  <Text style={{ fontSize: 9, fontWeight: 700, color: '#ffffff' }}>{s.score.toFixed(1)}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 9, color: '#f87171', letterSpacing: 2, marginBottom: 8 }}>AREAS TO GROW</Text>
            {report.weak_subjects.map(s => (
              <View key={s.subject} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                <Text style={{ fontSize: 10, color: '#94a3b8', flex: 1 }}>{s.display_name}</Text>
                <View style={{ backgroundColor: scoreBadgeBg(s.score), paddingHorizontal: 8, paddingVertical: 2, borderRadius: 3 }}>
                  <Text style={{ fontSize: 9, fontWeight: 700, color: '#ffffff' }}>{s.score.toFixed(1)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {report.recommended_pathway && (
          <View style={{ backgroundColor: '#243358', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 6 }}>
            <Text style={{ fontSize: 9, color: C.gold, letterSpacing: 2, marginBottom: 3 }}>RECOMMENDED PATHWAY</Text>
            <Text style={{ fontSize: 15, fontWeight: 700, color: C.white }}>{report.recommended_pathway}</Text>
          </View>
        )}
      </View>

      <View style={S.coverFooter}>
        <Text style={S.coverFooterText}>Generated {date} · EduNexus Learner Intelligence Report · CONFIDENTIAL</Text>
      </View>
    </Page>
  )
}

// ─── JUNIOR — Page 2: Pathway or Career ──────────────────────────────────────

function PathwayCareerPage({ report }: { report: ClinicReport }) {
  const date = new Date(report.generated_at).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const PATHWAY_COLORS: Record<string, { bg: string; color: string; desc: string }> = {
    'STEM':           { bg: '#eff6ff', color: '#1d4ed8', desc: 'Science, Technology, Engineering & Mathematics. Opens doors to medicine, engineering, data science, and tech careers.' },
    'Social Sciences':{ bg: '#f0fdf4', color: '#15803d', desc: 'Humanities, social sciences, law, education, and community-focused careers.' },
    'Arts & Sports Science':{ bg: '#fdf4ff', color: '#7e22ce', desc: 'Creative arts, performing arts, sports science, and design-based careers.' },
    'Business':       { bg: '#fff7ed', color: '#c2410c', desc: 'Business, finance, entrepreneurship, and commerce careers.' },
  }
  const pw = PATHWAY_COLORS[report.recommended_pathway ?? ''] ?? { bg: C.offWhite, color: C.teal, desc: '' }

  return (
    <Page size="A4" style={S.page}>
      <PageHeader name={report.student_name} pageLabel="Page 2 of 3" />

      <View style={S.content}>
        <Text style={S.sectionLabel}>SECTION 2 — PATHWAY ANALYSIS</Text>
        <Text style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>Grade 10 Pathway Placement</Text>
        <View style={S.divider} />

        {(() => {
          const gap       = report.pathwayGapAnalysis
          const firstName = report.student_name.split(' ')[0]
          const composite = gap?.compositeScore ?? report.kjsea_composite
          const maxScore  = gap?.kjseaMaxScore ?? 72
          const qualFor   = gap?.qualifiesFor ?? (report.recommended_pathway ? [report.recommended_pathway] : [])
          const alsoFor   = qualFor.filter(p => p !== report.recommended_pathway)
          const partial   = gap?.isPartialComposite ?? false
          const entered   = gap?.subjectsEntered ?? 9

          return (
            <View style={{ flexDirection: 'row', marginBottom: 14 }}>
              <View style={{ flex: 1, marginRight: 8, backgroundColor: pw.bg, borderRadius: 8, padding: 16, borderWidth: 1, borderColor: pw.color + '40' }}>
                <Text style={{ fontSize: 8, color: pw.color, letterSpacing: 2, marginBottom: 4 }}>YOUR PATHWAY NOW</Text>
                <Text style={{ fontSize: 16, fontWeight: 700, color: pw.color, marginBottom: 6 }}>
                  {report.recommended_pathway ?? 'Not yet determined'}
                </Text>
                {composite !== undefined && (
                  <Text style={{ fontSize: 10, color: partial ? C.amber : C.text, marginTop: 4 }}>
                    {partial
                      ? `KJSEA composite: ${composite} / ${maxScore} points (${entered} of 9 subjects)`
                      : `KJSEA composite: ${composite} / ${maxScore} points`}
                  </Text>
                )}
                <Text style={{ fontSize: 9, color: C.muted, marginTop: 6 }}>
                  {`Qualifies for: ${qualFor.join(', ')}`}
                </Text>
                {alsoFor.length > 0 && (
                  <View style={{ backgroundColor: '#dcfce7', borderRadius: 3, paddingHorizontal: 6, paddingVertical: 3, marginTop: 6, alignSelf: 'flex-start' }}>
                    <Text style={{ fontSize: 8, color: '#15803d', fontWeight: 700 }}>
                      {`Also qualifies for: ${alsoFor.join(', ')}`}
                    </Text>
                  </View>
                )}
                <Text style={{ fontSize: 9, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
                  {firstName} is in Grade {report.grade}{report.grade === 9 ? ' — final year of Junior Secondary.' : ' — Junior Secondary.'}
                  {' '}Pathway selection confirmed at Grade 10 entry.
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 8, color: C.muted, letterSpacing: 1, marginBottom: 6 }}>SUBJECT SCORES</Text>
                {[...report.top_subjects, ...report.weak_subjects].map(s => (
                  <View key={s.subject} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                    <Text style={{ fontSize: 8, color: C.text, flex: 1 }}>{s.display_name}</Text>
                    <View style={{ backgroundColor: statusBadgeBg(s.status), paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 }}>
                      <Text style={{ fontSize: 8, color: '#ffffff', fontWeight: 700 }}>L{s.score.toFixed(0)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )
        })()}

        <View style={S.divider} />

        {report.pathwayGapAnalysis?.nextPathway && (() => {
          const next  = report.pathwayGapAnalysis!.nextPathway!
          const lever = next.keyLever
          return (
            <View style={{ backgroundColor: '#eff6ff', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#bfdbfe', marginBottom: 12 }}>
              <Text style={{ fontSize: 8, color: '#1d4ed8', letterSpacing: 2, marginBottom: 4 }}>NEXT DOOR</Text>
              <Text style={{ fontSize: 13, fontWeight: 700, color: '#1e3a8a', marginBottom: 8 }}>{`The ${next.name} Door`}</Text>
              <Text style={{ fontSize: 10, color: C.text, lineHeight: 1.65, marginBottom: 10 }}>{next.unlockMessage}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 4, borderWidth: 1, borderColor: '#d97706' }}>
                  <Text style={{ fontSize: 8, color: '#92400e', fontWeight: 700 }}>{`${lever.subject} L${lever.currentLevel}`}</Text>
                </View>
                <Text style={{ fontSize: 11, color: C.muted, marginHorizontal: 5 }}>-{'>'}</Text>
                <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 4, borderWidth: 1, borderColor: '#16a34a' }}>
                  <Text style={{ fontSize: 8, color: '#14532d', fontWeight: 700 }}>{`${lever.subject} L${lever.targetLevel}`}</Text>
                </View>
                <Text style={{ fontSize: 11, color: C.muted, marginHorizontal: 5 }}>-{'>'}</Text>
                <View style={{ backgroundColor: '#1d4ed8', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 4 }}>
                  <Text style={{ fontSize: 8, color: '#ffffff', fontWeight: 700 }}>{next.name} Open</Text>
                </View>
              </View>
              <Text style={{ fontSize: 9, color: '#3b82f6', fontStyle: 'italic' }}>One subject. One level. One term.</Text>
            </View>
          )
        })()}

        <View style={{ backgroundColor: C.offWhite, borderRadius: 4, padding: 10, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ fontSize: 7.5, color: C.muted, lineHeight: 1.5 }}>
            {report.pathwayGapAnalysis?.disclaimer ?? PATHWAY_DISCLAIMER.short}
          </Text>
          <Text style={{ fontSize: 7.5, color: C.muted, lineHeight: 1.5, marginTop: 2 }}>
            {PATHWAY_DISCLAIMER.source}
          </Text>
        </View>

        <View style={{ backgroundColor: '#f5f3ff', borderRadius: 8, padding: 14, borderLeftWidth: 4, borderLeftColor: '#7c3aed', marginTop: 12 }}>
          <Text style={{ fontSize: 10, fontWeight: 700, color: '#5b21b6', marginBottom: 6 }}>
            Explore Careers in This Pathway
          </Text>
          <Text style={{ fontSize: 9.5, color: '#3b0764', lineHeight: 1.65, marginBottom: 6 }}>
            {`Visit edunexus.co.ke/career to see every career in the ${report.recommended_pathway ?? 'recommended'} pathway — including employment salaries, business opportunities, and what AI makes possible in each field.`}
          </Text>
          <Text style={{ fontSize: 9, color: '#6d28d9', fontWeight: 600 }}>edunexus.co.ke/career</Text>
        </View>
      </View>

      <PageFooter date={date} />
    </Page>
  )
}

// ─── JUNIOR — Page 3: Skills + Parent Actions ────────────────────────────────

function SkillsParentPage({ report }: { report: ClinicReport }) {
  const date = new Date(report.generated_at).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const ACTION_COLORS = [
    { border: C.gold,  bg: C.goldLight },
    { border: C.teal,  bg: '#f0fdfa'  },
    { border: C.l4,    bg: C.l4bg    },
    { border: C.green, bg: '#f0fdf4'  },
  ]

  return (
    <Page size="A4" style={S.page}>
      <PageHeader name={report.student_name} pageLabel="Page 3 of 3" />

      <View style={S.content}>
        <Text style={S.sectionLabel}>SECTION 3 — SKILL DEVELOPMENT TIMELINE</Text>
        <Text style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>Age {report.age} — {report.current_age_range}</Text>
        <View style={S.divider} />

        {report.current_phase ? (
          <View style={{ marginBottom: 10 }}>
            <View style={S.timelineItem}>
              <Text style={S.timelineLabel}>NOW — Ages {report.current_phase.age_range} ({report.current_phase.phase})</Text>
              <Text style={S.timelineText}>{report.current_phase.why}</Text>
              {report.current_phase.skills.slice(0, 3).map(sk => (
                <Text key={sk} style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>• {sk}</Text>
              ))}
            </View>
          </View>
        ) : (
          <View style={[S.summaryBox, { marginBottom: 10 }]}>
            <Text style={S.summaryText}>
              Skill timeline will populate as career data is matched. Focus on broad exposure and curiosity at this stage.
            </Text>
          </View>
        )}

        {report.next_phase && (
          <View style={{ marginBottom: 10 }}>
            <View style={[S.timelineItem, { borderLeftColor: C.teal }]}>
              <Text style={[S.timelineLabel, { color: C.teal }]}>NEXT — Ages {report.next_phase.age_range} ({report.next_phase.phase})</Text>
              <Text style={S.timelineText}>{report.next_phase.why}</Text>
              {report.next_phase.skills.slice(0, 3).map(sk => (
                <Text key={sk} style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>• {sk}</Text>
              ))}
            </View>
          </View>
        )}

        <View style={[S.divider, { marginVertical: 8 }]} />

        <Text style={[S.sectionLabel, { marginBottom: 8 }]}>{report.parent_actions.length} PARENT ACTIONS THIS TERM</Text>
        {report.parent_actions.slice(0, 4).map((act, i) => (
          <View key={i} style={[S.actionCard, { borderLeftColor: ACTION_COLORS[i]?.border ?? C.gold, backgroundColor: ACTION_COLORS[i]?.bg ?? C.goldLight }]}>
            <Text style={S.actionTitle}>{i + 1}. {act.title}</Text>
            <Text style={{ fontSize: 8.5, color: C.muted, marginBottom: 4, lineHeight: 1.4 }}>{act.why}</Text>
            <Text style={S.actionText}>{act.action}</Text>
            {act.link && (
              <Text style={{ fontSize: 9, color: C.teal, marginTop: 4 }}>edunexus.co.ke{act.link}</Text>
            )}
          </View>
        ))}

        <View style={S.disclaimerBox}>
          <Text style={S.disclaimerText}>{report.disclaimer}</Text>
        </View>
      </View>

      <PageFooter date={date} />
    </Page>
  )
}

// ─── Root PDF document ────────────────────────────────────────────────────────

export const ClinicReportPDF = ({ report }: { report: ClinicReport }) => (
  <Document
    title={`EduNexus Learner Intelligence Report — ${report.student_name}`}
    author="EduNexus Learner Intelligence Report"
    subject="CBC Learner Intelligence Report"
  >
    {report.section === 'senior' ? (
      <>
        <SeniorHealthCheckPage report={report} />
        <SeniorPathwayReadinessPage report={report} />
        <SeniorParentPlanPage report={report} />
      </>
    ) : (
      <>
        <CoverPage report={report} />
        <PathwayCareerPage report={report} />
        <SkillsParentPage report={report} />
      </>
    )}
  </Document>
)

// ─── Generator function ───────────────────────────────────────────────────────

export async function generateClinicReportPDF(report: ClinicReport): Promise<Buffer> {
  const { renderToBuffer } = await import('@react-pdf/renderer')
  const buffer = await renderToBuffer(<ClinicReportPDF report={report} />)
  return Buffer.from(buffer)
}
