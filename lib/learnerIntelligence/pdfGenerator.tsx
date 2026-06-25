// lib/learnerIntelligence/pdfGenerator.tsx
// 3-page Learner Intelligence Report PDF
// Design principle: intelligence document, not a report card.
// Answers one question per page:
//   Page 1 — Who is this learner?
//   Page 2 — How do they learn?
//   Page 3 — Where are they going?

import React from 'react'
import { Document, Page, Text, View, StyleSheet, Svg, Circle, Polygon } from '@react-pdf/renderer'
import type { LearnerIntelligenceReport, BehaviourLabel, GrowthStage } from './types'

// ─── Color Palette ────────────────────────────────────────────────────────────
// Distinct from Academic Clinic (pure navy/clinical) — warmer, more human.

const C = {
  navy:       '#0f2d4a',
  navyLight:  '#1a3f60',
  indigo:     '#4f46e5',
  indigoBg:   '#eef2ff',
  teal:       '#0d9488',
  tealBg:     '#f0fdfa',
  amber:      '#d97706',
  amberBg:    '#fffbeb',
  amberLight: '#fef3c7',
  rose:       '#e11d48',
  roseBg:     '#fff1f2',
  emerald:    '#059669',
  emeraldBg:  '#ecfdf5',
  white:      '#ffffff',
  offWhite:   '#f8fafc',
  bg:         '#f1f5f9',
  border:     '#e2e8f0',
  text:       '#0f172a',
  muted:      '#64748b',
  gold:       '#f59e0b',
  goldLight:  '#fef3c7',
  // Level colors (same as clinic for consistency)
  l1: '#dc2626', l1bg: '#fee2e2',
  l2: '#d97706', l2bg: '#fef3c7',
  l3: '#059669', l3bg: '#ecfdf5',
  l4: '#4f46e5', l4bg: '#eef2ff',
}

function levelColor(l: number)  { return [C.l1, C.l2, C.l3, C.l4][l - 1] ?? C.muted }
function levelBg(l: number)     { return [C.l1bg, C.l2bg, C.l3bg, C.l4bg][l - 1] ?? C.offWhite }
function levelLabel(l: number)  { return ['Emerging', 'Developing', 'Proficient', 'Exemplary'][l - 1] ?? '' }

const BEHAVIOUR_COLORS: Record<BehaviourLabel, string> = {
  'Strong':        C.emerald,
  'Developing':    C.teal,
  'Emerging':      C.amber,
  'Needs Support': C.rose,
}
const BEHAVIOUR_BGS: Record<BehaviourLabel, string> = {
  'Strong':        C.emeraldBg,
  'Developing':    C.tealBg,
  'Emerging':      C.amberBg,
  'Needs Support': C.roseBg,
}

const STAGE_COLORS: Record<GrowthStage, string> = {
  'Leading Edge':        C.indigo,
  'Strong Momentum':     C.emerald,
  'Active Growth':       C.teal,
  'Building Foundations':C.amber,
  'Early Foundations':   C.rose,
}

const FRS_COLORS: Record<string, string> = {
  'Leading':  C.indigo,
  'Strong':   C.emerald,
  'Growing':  C.teal,
  'Emerging': C.amber,
  'Building': C.rose,
}

const PATHWAY_COLORS: Record<string, string> = {
  'STEM':                  C.indigo,
  'Social Sciences':       C.emerald,
  'Arts & Sports Science': C.amber,
}
const PATHWAY_BGS: Record<string, string> = {
  'STEM':                  C.indigoBg,
  'Social Sciences':       C.emeraldBg,
  'Arts & Sports Science': C.amberBg,
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page:    { backgroundColor: C.white, fontFamily: 'Helvetica', paddingBottom: 48 },
  content: { paddingHorizontal: 36, paddingTop: 18 },

  // Header
  header:       { backgroundColor: C.navy, paddingHorizontal: 36, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerBrand:  { fontSize: 8, color: C.gold, letterSpacing: 2 },
  headerSub:    { fontSize: 9, color: '#94a3b8', marginTop: 2 },
  headerRight:  { alignItems: 'flex-end' },
  headerPage:   { fontSize: 8, color: '#94a3b8' },
  headerId:     { fontSize: 7, color: '#475569', marginTop: 2 },
  goldLine:     { height: 2, backgroundColor: C.gold },

  // Footer
  footer:     { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 36, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText: { fontSize: 7, color: C.muted },

  // Section labels
  sectionLabel: { fontSize: 7.5, color: C.muted, letterSpacing: 2, marginBottom: 3, textTransform: 'uppercase' },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 12 },
  divider:      { borderTopWidth: 1, borderTopColor: C.border, marginVertical: 12 },
  dividerThin:  { borderTopWidth: 1, borderTopColor: C.border, marginVertical: 9 },

  // Badge
  badge:     { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 4 },
  badgeText: { fontSize: 8, fontWeight: 700, letterSpacing: 0.5 },

  // Story box
  storyBox:  { backgroundColor: C.offWhite, borderRadius: 6, padding: 14, borderLeftWidth: 3, borderLeftColor: C.gold },
  storyText: { fontSize: 9.5, color: C.text, lineHeight: 1.65 },

  // Strength card
  strengthCard: { borderRadius: 6, padding: 10, marginBottom: 6 },

  // Behaviour card
  behaviourCard:  { flex: 1, borderRadius: 5, padding: 8, marginRight: 5 },
  behaviourLabel: { fontSize: 7.5, fontWeight: 700, letterSpacing: 0.5, marginBottom: 3 },
  behaviourTitle: { fontSize: 8.5, fontWeight: 700, color: C.text, marginBottom: 2 },
  behaviourDesc:  { fontSize: 7.5, color: C.muted, lineHeight: 1.4 },

  // Parent action
  actionCard:      { borderRadius: 5, padding: 10, marginBottom: 7 },
  actionTimeframe: { fontSize: 7.5, fontWeight: 700, letterSpacing: 1, marginBottom: 4 },
  actionText:      { fontSize: 9, color: C.text, lineHeight: 1.5, marginBottom: 3 },
  actionRationale: { fontSize: 7.5, color: C.muted, lineHeight: 1.4 },

  // Career card
  careerCard:  { borderWidth: 1, borderColor: C.border, borderRadius: 5, padding: 8, marginBottom: 5 },
  careerHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  careerName:  { fontSize: 10, fontWeight: 700, color: C.text, flex: 1 },
  careerPct:   { fontSize: 13, fontWeight: 700 },
  careerRow:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 3 },
  careerKey:   { fontSize: 7.5, color: C.muted, width: 112 },
  careerVal:   { fontSize: 8, color: C.text, flex: 1, lineHeight: 1.4 },

  // Opportunity box
  opportunityBox: { backgroundColor: C.emeraldBg, borderRadius: 6, padding: 12, borderLeftWidth: 3, borderLeftColor: C.emerald },
  opportunityTitle:{ fontSize: 8.5, fontWeight: 700, color: C.emerald, letterSpacing: 0.5, marginBottom: 4 },
  opportunityBody: { fontSize: 9, color: C.text, lineHeight: 1.5, marginBottom: 8 },
  opportunityItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  opportunityDot:  { width: 5, height: 5, borderRadius: 3, backgroundColor: C.emerald, marginRight: 7 },
  opportunityText: { fontSize: 8.5, color: C.text },

  // CTA box
  ctaBox:    { backgroundColor: C.navy, borderRadius: 6, padding: 10 },
  ctaTitle:  { fontSize: 10, fontWeight: 700, color: C.gold, marginBottom: 4 },
  ctaBody:   { fontSize: 8.5, color: '#94a3b8', lineHeight: 1.5, marginBottom: 8 },
  ctaBullet: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 3 },
  ctaDot:    { fontSize: 9, color: C.gold, width: 12 },
  ctaText:   { fontSize: 8, color: '#cbd5e1', flex: 1 },
  ctaLink:   { backgroundColor: C.gold, borderRadius: 4, paddingVertical: 7, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  ctaLinkText: { fontSize: 9, fontWeight: 700, color: C.navy },
})

// ─── Shared Components ────────────────────────────────────────────────────────

function PageHeader({ name, grade, pageNum, reportId }: {
  name: string; grade: number; pageNum: number; reportId: string
}) {
  return (
    <View>
      <View style={S.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Svg width={24} height={24} viewBox="0 0 64 64" style={{ marginRight: 10 }}>
            <Circle cx="32" cy="32" r="30" fill="#1a3f60" stroke={C.gold} strokeWidth="1.5" />
            <Polygon points="32,8 35.5,27 32,29 28.5,27"  fill={C.gold} />
            <Polygon points="32,56 35.5,37 32,35 28.5,37" fill="#818cf8" />
            <Polygon points="8,32 27,28.5 29,32 27,35.5"  fill="#10b981" />
            <Polygon points="56,32 37,28.5 35,32 37,35.5" fill="#f43f5e" />
            <Circle cx="32" cy="32" r="4" fill={C.navy} stroke={C.gold} strokeWidth="1" />
          </Svg>
          <View>
            <Text style={S.headerBrand}>EDUNEXUS LEARNER INTELLIGENCE</Text>
            <Text style={S.headerSub}>{name} · Grade {grade}</Text>
          </View>
        </View>
        <View style={S.headerRight}>
          <Text style={S.headerPage}>Page {pageNum} of 3</Text>
          <Text style={S.headerId}>{reportId}</Text>
        </View>
      </View>
      <View style={S.goldLine} />
    </View>
  )
}

function PageFooter({ reportId }: { reportId: string }) {
  return (
    <View style={S.footer}>
      <Text style={S.footerText}>{reportId}</Text>
      <Text style={S.footerText}>CONFIDENTIAL — For Parent Use Only</Text>
      <Text style={S.footerText}>edunexus.co.ke</Text>
    </View>
  )
}

function LevelPill({ level }: { level: number }) {
  return (
    <View style={[S.badge, { backgroundColor: levelBg(level) }]}>
      <Text style={[S.badgeText, { color: levelColor(level) }]}>{levelLabel(level).toUpperCase()}</Text>
    </View>
  )
}

function BulletRow({ text, color = C.navy }: { text: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 3 }}>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color, marginRight: 8, marginTop: 3.5 }} />
      <Text style={{ fontSize: 9, color: C.text, flex: 1, lineHeight: 1.4 }}>{text}</Text>
    </View>
  )
}

// ─── PAGE 1: LEARNER SNAPSHOT ─────────────────────────────────────────────────
// "Who is this learner?"

function SnapshotPage({ r }: { r: LearnerIntelligenceReport }) {
  const { snapshot: snap, reportId } = r
  const stageColor  = STAGE_COLORS[snap.growthStage]
  const frsColor    = FRS_COLORS[snap.futureReadinessLabel]
  const pathwayColor = PATHWAY_COLORS[snap.pathwayDirection.pathway] ?? C.indigo
  const pathwayBg    = PATHWAY_BGS[snap.pathwayDirection.pathway]    ?? C.indigoBg

  const dateStr = new Date(r.generatedAt).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <Page size="A4" style={S.page}>
      <PageHeader name={snap.name} grade={snap.grade} pageNum={1} reportId={reportId} />
      <View style={S.content}>

        {/* Page title */}
        <Text style={[S.sectionLabel, { marginTop: 6 }]}>LEARNER INTELLIGENCE REPORT · {snap.level.toUpperCase()}</Text>

        {/* Identity row */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 2 }}>{snap.name}</Text>
            <Text style={{ fontSize: 9.5, color: C.muted }}>
              Grade {snap.grade}{snap.school ? ` · ${snap.school}` : ''} · Term {snap.term}, {snap.year}
            </Text>
            <View style={{ flexDirection: 'row', marginTop: 8, gap: 6 }}>
              {/* Growth stage badge */}
              <View style={[S.badge, { backgroundColor: stageColor + '18', borderWidth: 1, borderColor: stageColor + '44' }]}>
                <Text style={[S.badgeText, { color: stageColor, fontSize: 7.5 }]}>{snap.growthStage.toUpperCase()}</Text>
              </View>
              {/* Pathway badge */}
              <View style={[S.badge, { backgroundColor: pathwayBg }]}>
                <Text style={[S.badgeText, { color: pathwayColor, fontSize: 7.5 }]}>{snap.pathwayDirection.pathway.toUpperCase()}</Text>
              </View>
            </View>
          </View>
          {/* FRS Score Circle */}
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingLeft: 16 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 5, borderColor: frsColor, justifyContent: 'center', alignItems: 'center', backgroundColor: frsColor + '10' }}>
              <Text style={{ fontSize: 22, fontWeight: 700, color: frsColor }}>{snap.futureReadinessScore}</Text>
            </View>
            <Text style={{ fontSize: 7, color: C.muted, marginTop: 4, textAlign: 'center', letterSpacing: 0.5 }}>FUTURE READINESS</Text>
            <Text style={{ fontSize: 8, fontWeight: 700, color: frsColor, textAlign: 'center' }}>{snap.futureReadinessLabel.toUpperCase()}</Text>
          </View>
        </View>

        <View style={S.dividerThin} />

        {/* Learner Story */}
        <Text style={[S.sectionLabel, { marginBottom: 6 }]}>LEARNER STORY</Text>
        <View style={S.storyBox}>
          <Text style={S.storyText}>{snap.learnerStory}</Text>
        </View>

        <View style={S.divider} />

        {/* Strengths + Growth Area */}
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          {/* Top Strengths */}
          <View style={{ flex: 1, marginRight: 14 }}>
            <Text style={[S.sectionLabel, { color: C.emerald, marginBottom: 7 }]}>TOP STRENGTHS</Text>
            {snap.topStrengths.length > 0
              ? snap.topStrengths.map((s, i) => (
                  <View key={i} style={[S.strengthCard, { backgroundColor: levelBg(s.level) }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                      <Text style={{ fontSize: 9.5, fontWeight: 700, color: C.text, flex: 1 }}>{s.subjectName}</Text>
                      <LevelPill level={s.level} />
                    </View>
                    <Text style={{ fontSize: 8, color: C.muted, lineHeight: 1.35 }}>{s.observation}</Text>
                  </View>
                ))
              : <Text style={{ fontSize: 9, color: C.muted }}>Strengths are currently building across subjects.</Text>
            }
          </View>
          {/* Biggest Growth Area */}
          <View style={{ width: 160 }}>
            <Text style={[S.sectionLabel, { color: C.amber, marginBottom: 7 }]}>GROWTH AREA</Text>
            <View style={{ borderWidth: 1.5, borderColor: C.amber, borderRadius: 6, padding: 10, backgroundColor: C.amberBg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                <Text style={{ fontSize: 10, fontWeight: 700, color: C.text, flex: 1 }}>{snap.biggestGrowthArea.subjectName}</Text>
                <LevelPill level={snap.biggestGrowthArea.level} />
              </View>
              <Text style={{ fontSize: 7.5, fontWeight: 700, color: '#92400e', marginBottom: 3 }}>Why it matters:</Text>
              <Text style={{ fontSize: 7.5, color: '#78350f', lineHeight: 1.4, marginBottom: 6 }}>{snap.biggestGrowthArea.whyItMatters}</Text>
              <Text style={{ fontSize: 7.5, color: C.emerald, fontWeight: 700 }}>If improved:</Text>
              <Text style={{ fontSize: 7.5, color: C.text, lineHeight: 1.4 }}>{snap.biggestGrowthArea.unlockStatement}</Text>
            </View>
          </View>
        </View>

        <View style={S.dividerThin} />

        {/* Pathway Direction */}
        <Text style={[S.sectionLabel, { marginBottom: 6 }]}>EMERGING PATHWAY DIRECTION</Text>
        <View style={{ backgroundColor: pathwayBg, borderRadius: 6, padding: 12, borderLeftWidth: 3, borderLeftColor: pathwayColor, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: 700, color: pathwayColor, flex: 1 }}>{snap.pathwayDirection.pathway}</Text>
            <Text style={{ fontSize: 14, fontWeight: 700, color: pathwayColor }}>{snap.pathwayDirection.readinessScore}%</Text>
            <View style={[S.badge, { backgroundColor: pathwayColor + '18', marginLeft: 8, borderWidth: 1, borderColor: pathwayColor + '44' }]}>
              <Text style={[S.badgeText, { color: pathwayColor, fontSize: 7 }]}>{snap.pathwayDirection.readinessLabel.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 8.5, color: C.text, lineHeight: 1.5 }}>{snap.pathwayDirection.directionStatement}</Text>
        </View>

        {/* Emerging Opportunities */}
        <Text style={[S.sectionLabel, { marginBottom: 6 }]}>EMERGING FUTURE OPPORTUNITIES</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {snap.emergingOpportunities.map((opp, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 5 }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.indigo, marginRight: 6 }} />
              <Text style={{ fontSize: 9, color: C.text }}>{opp}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[S.footer, { flexDirection: 'column', alignItems: 'center' }]}>
        <Text style={[S.footerText, { marginBottom: 2 }]}>
          EduNexus Learner Intelligence · {dateStr} · {reportId}
        </Text>
        <Text style={S.footerText}>CONFIDENTIAL — For Parent and Teacher Use Only · edunexus.co.ke</Text>
      </View>
    </Page>
  )
}

// ─── PAGE 2: LEARNING INTELLIGENCE ───────────────────────────────────────────
// "How does this learner learn?"

function IntelligencePage({ r }: { r: LearnerIntelligenceReport }) {
  const { intelligence: intel, snapshot: snap, reportId } = r
  const firstName = snap.name.split(' ')[0]

  const ACTION_COLORS = [C.indigoBg, C.tealBg, C.emeraldBg]
  const ACTION_BORDER = [C.indigo, C.teal, C.emerald]
  const ACTION_LABEL_COLORS = [C.indigo, C.teal, C.emerald]

  return (
    <Page size="A4" style={S.page}>
      <PageHeader name={snap.name} grade={snap.grade} pageNum={2} reportId={reportId} />
      <View style={S.content}>

        <Text style={[S.sectionLabel, { marginTop: 6 }]}>LEARNING INTELLIGENCE · PAGE 2 OF 3</Text>
        <Text style={[S.sectionTitle, { marginBottom: 8 }]}>How {firstName} Learns</Text>

        {/* Academic Strengths + Growth Areas: two columns */}
        <View style={{ flexDirection: 'row', marginBottom: 8 }}>
          {/* Left: Academic Strengths */}
          <View style={{ flex: 1, marginRight: 14 }}>
            <Text style={{ fontSize: 8.5, fontWeight: 700, color: C.emerald, letterSpacing: 1, marginBottom: 5 }}>
              ACADEMIC STRENGTHS
            </Text>
            {intel.academicStrengths.length > 0
              ? intel.academicStrengths.map((s, i) => (
                  <View key={i} style={{ marginBottom: 5, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: levelColor(s.level) }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                      <Text style={{ fontSize: 9, fontWeight: 700, color: C.text, flex: 1 }}>{s.subjectName}</Text>
                      <LevelPill level={s.level} />
                    </View>
                    <Text style={{ fontSize: 8, color: C.muted, lineHeight: 1.35 }}>{s.competencyNote}</Text>
                    {s.trendNote && (
                      <Text style={{ fontSize: 7.5, color: s.trendNote.includes('dipped') ? C.amber : C.emerald, marginTop: 2 }}>
                        {s.trendNote}
                      </Text>
                    )}
                  </View>
                ))
              : (
                  <View style={{ padding: 10, backgroundColor: C.offWhite, borderRadius: 5 }}>
                    <Text style={{ fontSize: 8.5, color: C.muted }}>
                      Strengths are actively building. As performance grows across subjects, clear academic strengths will become visible.
                    </Text>
                  </View>
                )
            }
          </View>

          {/* Right: Growth Areas */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 8.5, fontWeight: 700, color: C.amber, letterSpacing: 1, marginBottom: 5 }}>
              GROWTH AREAS
            </Text>
            {intel.growthAreas.length > 0
              ? intel.growthAreas.map((g, i) => (
                  <View key={i} style={{ marginBottom: 5, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: levelColor(g.level) }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                      <Text style={{ fontSize: 9, fontWeight: 700, color: C.text, flex: 1 }}>{g.subjectName}</Text>
                      <LevelPill level={g.level} />
                    </View>
                    <Text style={{ fontSize: 8, color: C.muted, lineHeight: 1.35 }}>{g.gapExplanation}</Text>
                    <Text style={{ fontSize: 7.5, color: C.emerald, marginTop: 2 }}>
                      ✓ {g.unlockMessage}
                    </Text>
                  </View>
                ))
              : (
                  <View style={{ padding: 10, backgroundColor: C.emeraldBg, borderRadius: 5 }}>
                    <Text style={{ fontSize: 8.5, color: C.emerald, fontWeight: 700, marginBottom: 2 }}>No critical gaps identified</Text>
                    <Text style={{ fontSize: 8, color: C.text }}>
                      All subjects are currently performing at or above the expected level. Focus shifts to reaching exemplary levels.
                    </Text>
                  </View>
                )
            }
          </View>
        </View>

        <View style={S.dividerThin} />

        {/* Learning Behaviour Profile */}
        <Text style={{ fontSize: 8.5, fontWeight: 700, color: C.text, letterSpacing: 1, marginBottom: 6 }}>
          HOW {firstName.toUpperCase()} LEARNS — BEHAVIOUR PROFILE
        </Text>

        {/* 5 behaviour dimension cards */}
        <View style={{ flexDirection: 'row', marginBottom: 6 }}>
          {[
            intel.learningBehaviour.consistency,
            intel.learningBehaviour.engagement,
            intel.learningBehaviour.persistence,
            intel.learningBehaviour.confidence,
            intel.learningBehaviour.velocity,
          ].map((dim, i) => {
            const bc = BEHAVIOUR_COLORS[dim.label]
            const bb = BEHAVIOUR_BGS[dim.label]
            return (
              <View key={i} style={[S.behaviourCard, { backgroundColor: bb, marginRight: i < 4 ? 5 : 0 }]}>
                <View style={[S.badge, { backgroundColor: bc + '22', marginBottom: 4, paddingHorizontal: 6, paddingVertical: 2 }]}>
                  <Text style={[S.behaviourLabel, { color: bc, fontSize: 7 }]}>{dim.label.toUpperCase()}</Text>
                </View>
                <Text style={[S.behaviourTitle, { fontSize: 8 }]}>{dim.title}</Text>
                <Text style={S.behaviourDesc}>{dim.description.substring(0, 100)}{dim.description.length > 100 ? '…' : ''}</Text>
              </View>
            )
          })}
        </View>

        {/* Behaviour summary */}
        <View style={{ backgroundColor: C.offWhite, borderRadius: 5, padding: 10, marginBottom: 2 }}>
          <Text style={{ fontSize: 9, color: C.text, lineHeight: 1.55 }}>
            {intel.learningBehaviour.behaviourSummary}
          </Text>
        </View>

        <View style={S.divider} />

        {/* Parent Action Plan */}
        <Text style={{ fontSize: 8.5, fontWeight: 700, color: C.text, letterSpacing: 1, marginBottom: 6 }}>
          PARENT ACTION PLAN
        </Text>

        {intel.parentActionPlan.map((action, i) => (
          <View key={i} style={[S.actionCard, { backgroundColor: ACTION_COLORS[i], borderLeftWidth: 2, borderLeftColor: ACTION_BORDER[i] }]}>
            <Text style={[S.actionTimeframe, { color: ACTION_LABEL_COLORS[i] }]}>{action.timeframe}</Text>
            <Text style={S.actionText}>{action.action}</Text>
            <Text style={S.actionRationale}>{action.rationale}</Text>
          </View>
        ))}
      </View>
      <PageFooter reportId={reportId} />
    </Page>
  )
}

// ─── PAGE 3: FUTURE READINESS & CAREER INTELLIGENCE ──────────────────────────
// "Where is this learner going?"

function FutureReadinessPage({ r }: { r: LearnerIntelligenceReport }) {
  const { futureReadiness: fr, snapshot: snap, reportId } = r
  const firstName   = snap.name.split(' ')[0]
  const dateStr     = new Date(r.generatedAt).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const alignColor = (pct: number) => pct >= 75 ? C.emerald : pct >= 55 ? C.teal : C.muted

  return (
    <Page size="A4" style={S.page}>
      <PageHeader name={snap.name} grade={snap.grade} pageNum={3} reportId={reportId} />
      <View style={S.content}>

        <Text style={[S.sectionLabel, { marginTop: 6 }]}>FUTURE READINESS & CAREER INTELLIGENCE · PAGE 3 OF 3</Text>
        <Text style={[S.sectionTitle, { marginBottom: 8 }]}>Where {firstName} Is Going</Text>

        {/* Pathway Readiness — 3 cards */}
        <Text style={{ fontSize: 8.5, fontWeight: 700, color: C.text, letterSpacing: 1, marginBottom: 7 }}>
          PATHWAY READINESS
        </Text>
        <View style={{ flexDirection: 'row', marginBottom: 8 }}>
          {fr.pathwayReadiness.slice(0, 3).map((pw, i) => {
            const pc = PATHWAY_COLORS[pw.pathway] ?? C.indigo
            const pb = PATHWAY_BGS[pw.pathway]    ?? C.indigoBg
            const isRec = pw.isRecommended
            return (
              <View key={i} style={{
                flex: 1, marginRight: i < 2 ? 8 : 0, borderRadius: 6, padding: 10,
                backgroundColor: isRec ? C.navyLight : pb,
                ...(isRec ? {} : { borderWidth: 1, borderColor: pc + '44' }),
              }}>
                {isRec && (
                  <Text style={{ fontSize: 6.5, color: C.gold, letterSpacing: 1, marginBottom: 2 }}>RECOMMENDED</Text>
                )}
                <Text style={{ fontSize: 8.5, fontWeight: 700, color: isRec ? C.white : C.text, marginBottom: 2 }}>
                  {pw.pathway}
                </Text>
                <Text style={{ fontSize: 18, fontWeight: 700, color: isRec ? C.gold : pc, marginBottom: 3 }}>
                  {pw.score}%
                </Text>
                {/* Readiness bar */}
                <View style={{ height: 4, backgroundColor: isRec ? '#ffffff22' : C.border, borderRadius: 2, marginBottom: 5, overflow: 'hidden' }}>
                  <View style={{ height: 4, width: `${Math.max(0, Math.min(100, pw.score))}%`, backgroundColor: isRec ? C.gold : pc, borderRadius: 2 }} />
                </View>
                <View style={[S.badge, { backgroundColor: isRec ? '#ffffff18' : pc + '18', paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4 }]}>
                  <Text style={[S.badgeText, { color: isRec ? C.gold : pc, fontSize: 7 }]}>
                    {pw.readinessLabel.toUpperCase()}
                  </Text>
                </View>
                <Text style={{ fontSize: 7.5, color: isRec ? '#94a3b8' : C.muted, lineHeight: 1.4 }}>
                  {pw.explanation}
                </Text>
              </View>
            )
          })}
        </View>

        <View style={S.dividerThin} />

        {/* Career Directions */}
        <Text style={{ fontSize: 8.5, fontWeight: 700, color: C.text, letterSpacing: 1, marginBottom: 7 }}>
          TOP 3 EMERGING CAREER DIRECTIONS
        </Text>

        {fr.careerDirections.slice(0, 3).map((career, i) => {
          const ac = alignColor(career.alignmentPct)
          return (
            <View key={i} style={S.careerCard}>
              <View style={S.careerHeader}>
                <Text style={S.careerName}>{career.rank}. {career.name}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[S.careerPct, { color: ac }]}>{career.alignmentPct}%</Text>
                  <Text style={{ fontSize: 7, color: C.muted }}>alignment</Text>
                </View>
              </View>
              <View style={S.careerRow}>
                <Text style={S.careerKey}>Why it currently matches:</Text>
                <Text style={S.careerVal}>{career.whyItMatches}</Text>
              </View>
              <View style={S.careerRow}>
                <Text style={S.careerKey}>Supporting strengths:</Text>
                <Text style={S.careerVal}>{career.supportingStrengths.join(', ')}</Text>
              </View>
              <View style={S.careerRow}>
                <Text style={S.careerKey}>Gap to watch:</Text>
                <Text style={[S.careerVal, { color: C.amber }]}>{career.gapToImprove}</Text>
              </View>
            </View>
          )
        })}

        <View style={S.dividerThin} />

        {/* Opportunity Insight */}
        <View style={S.opportunityBox}>
          <Text style={S.opportunityTitle}>FUTURE OPPORTUNITY INSIGHT</Text>
          <Text style={S.opportunityBody}>{fr.opportunityInsight.ifImprovesMessage}</Text>
          {fr.opportunityInsight.unlockedOpportunities.map((opp, i) => (
            <View key={i} style={S.opportunityItem}>
              <View style={S.opportunityDot} />
              <Text style={S.opportunityText}>{opp}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 6 }}>
          {/* Career Explorer CTA */}
          <View style={S.ctaBox}>
            <Text style={S.ctaTitle}>Explore Your Learner's Future</Text>
            <Text style={S.ctaBody}>
              This report gives you a starting point. A more detailed analysis is available inside EduNexus Career Intelligence, including:
            </Text>
            {[
              'Full career pathway profiles with subject requirements',
              'Salary journeys and employment outlook in Kenya',
              'AI-era opportunities and which careers are growing',
              'University pathways, cut-off points, and alternatives',
              'Entrepreneurship and self-employment routes',
              'Future skill roadmaps tailored to your learner\'s profile',
            ].map((item, i) => (
              <View key={i} style={S.ctaBullet}>
                <Text style={S.ctaDot}>›</Text>
                <Text style={S.ctaText}>{item}</Text>
              </View>
            ))}
            <View style={S.ctaLink}>
              <Text style={S.ctaLinkText}>Open Career Intelligence in your parent dashboard</Text>
              <Text style={[S.ctaLinkText, { opacity: 0.7 }]}>edunexus.co.ke/parent/career-intelligence</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={[S.footer, { flexDirection: 'column', alignItems: 'center' }]}>
        <Text style={[S.footerText, { marginBottom: 2 }]}>
          EduNexus Learner Intelligence · {dateStr} · {reportId}
        </Text>
        <Text style={S.footerText}>
          Results reflect current evidence and will evolve with effort and support. This is a guide to who this learner is becoming — not a final verdict.
        </Text>
      </View>
    </Page>
  )
}

// ─── Root PDF Component ───────────────────────────────────────────────────────

export function LearnerIntelligencePDF({ report }: { report: LearnerIntelligenceReport }) {
  return (
    <Document
      title={`EduNexus Learner Intelligence — ${report.snapshot.name}`}
      author="EduNexus"
      subject="Learner Intelligence Report"
    >
      <SnapshotPage       r={report} />
      <IntelligencePage   r={report} />
      <FutureReadinessPage r={report} />
    </Document>
  )
}

// ─── PDF Generator Function ───────────────────────────────────────────────────

export async function generateLearnerIntelligencePDF(
  report: LearnerIntelligenceReport
): Promise<Blob> {
  const { renderToBuffer } = await import('@react-pdf/renderer')
  const buffer = await renderToBuffer(<LearnerIntelligencePDF report={report} />)
  return new Blob([Buffer.from(buffer)], { type: 'application/pdf' })
}
