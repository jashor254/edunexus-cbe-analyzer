// lib/learnerIntelligence/pdfGenerator.tsx
// Renders a LearnerBlueprint (see ./types.ts) to a 3-page PDF.
// Every claim on the page is an Insight — Observation, Evidence, Confidence,
// Recommended Action — never bare narrative, matching the data it's built from.

import React from 'react'
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import type { LearnerBlueprint } from './types'
import type { Insight, ConfidenceLevel } from './insight'

const C = {
  navy:      '#0f2d4a',
  gold:      '#f59e0b',
  emerald:   '#059669',
  emeraldBg: '#ecfdf5',
  amber:     '#d97706',
  amberBg:   '#fffbeb',
  gray:      '#64748b',
  grayBg:    '#f8fafc',
  border:    '#e2e8f0',
  text:      '#0f172a',
  muted:     '#64748b',
  white:     '#ffffff',
}

const CONFIDENCE_COLOR: Record<ConfidenceLevel, string> = {
  High:   C.emerald,
  Medium: C.amber,
  Low:    C.gray,
}
const CONFIDENCE_BG: Record<ConfidenceLevel, string> = {
  High:   C.emeraldBg,
  Medium: C.amberBg,
  Low:    C.grayBg,
}

const S = StyleSheet.create({
  page:    { backgroundColor: C.white, fontFamily: 'Helvetica', paddingBottom: 40 },
  content: { paddingHorizontal: 36, paddingTop: 18 },

  header:      { backgroundColor: C.navy, paddingHorizontal: 36, paddingVertical: 14 },
  headerBrand: { fontSize: 8, color: C.gold, letterSpacing: 2 },
  headerTitle: { fontSize: 14, color: C.white, marginTop: 4, fontWeight: 700 },
  headerSub:   { fontSize: 9, color: '#94a3b8', marginTop: 2 },

  footer:     { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 36, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border },
  footerText: { fontSize: 7, color: C.muted },

  sectionTitle: { fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 10 },
  disclaimer:   { fontSize: 7.5, color: C.muted, fontStyle: 'italic', marginBottom: 14, lineHeight: 1.4 },

  card:       { borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 10, marginBottom: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  observation:{ fontSize: 9.5, fontWeight: 700, color: C.text, flex: 1, marginRight: 8, lineHeight: 1.4 },
  badge:      { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  badgeText:  { fontSize: 7, fontWeight: 700 },
  evidence:   { fontSize: 7.5, color: C.muted, marginBottom: 1.5, lineHeight: 1.3 },
  actionRow:  { marginTop: 5, paddingTop: 5, borderTopWidth: 1, borderTopColor: C.border },
  actionLabel:{ fontSize: 7, fontWeight: 700, color: C.text },
  action:     { fontSize: 8.5, color: C.text, lineHeight: 1.4 },

  subLabel: { fontSize: 8, fontWeight: 700, color: C.muted, letterSpacing: 0.5, marginBottom: 4, marginTop: 4 },
})

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <View style={S.card}>
      <View style={S.cardHeader}>
        <Text style={S.observation}>{insight.observation}</Text>
        <View style={[S.badge, { backgroundColor: CONFIDENCE_BG[insight.confidence] }]}>
          <Text style={[S.badgeText, { color: CONFIDENCE_COLOR[insight.confidence] }]}>{insight.confidence}</Text>
        </View>
      </View>
      {insight.evidence.map((line, i) => (
        <Text key={i} style={S.evidence}>• {line}</Text>
      ))}
      <View style={S.actionRow}>
        <Text style={S.action}><Text style={S.actionLabel}>Recommended: </Text>{insight.action}</Text>
      </View>
    </View>
  )
}

function PageHeader({ title, name, grade }: { title: string; name: string; grade: number }) {
  return (
    <View style={S.header}>
      <Text style={S.headerBrand}>EDUNEXUS · LEARNER BLUEPRINT</Text>
      <Text style={S.headerTitle}>{title}</Text>
      <Text style={S.headerSub}>{name} · Grade {grade}</Text>
    </View>
  )
}

function PageFooter({ pageNum }: { pageNum: number }) {
  return (
    <View style={S.footer}>
      <Text style={S.footerText}>Page {pageNum} of 3 — conclusions are provisional and improve as more evidence arrives.</Text>
    </View>
  )
}

export async function generateLearnerBlueprintPDF(blueprint: LearnerBlueprint): Promise<Blob> {
  const doc = (
    <Document>
      <Page size="A4" style={S.page}>
        <PageHeader title="Who is this learner becoming?" name={blueprint.studentName} grade={blueprint.grade} />
        <View style={S.content}>
          <Text style={S.disclaimer}>{blueprint.disclaimer}</Text>
          {blueprint.becoming.insights.length === 0
            ? <Text style={S.evidence}>Insufficient assessment data yet to speak to this.</Text>
            : blueprint.becoming.insights.map((insight, i) => <InsightCard key={i} insight={insight} />)}
        </View>
        <PageFooter pageNum={1} />
      </Page>

      <Page size="A4" style={S.page}>
        <PageHeader title="Greatest opportunity" name={blueprint.studentName} grade={blueprint.grade} />
        <View style={S.content}>
          <InsightCard insight={blueprint.opportunity.insight} />
        </View>
        <PageFooter pageNum={2} />
      </Page>

      <Page size="A4" style={S.page}>
        <PageHeader title="What should happen next?" name={blueprint.studentName} grade={blueprint.grade} />
        <View style={S.content}>
          <Text style={S.subLabel}>FOR PARENTS</Text>
          <InsightCard insight={blueprint.actions.parent} />
          <Text style={S.subLabel}>FOR TEACHERS</Text>
          <InsightCard insight={blueprint.actions.teacher} />
          <Text style={S.subLabel}>FOR THE LEARNER</Text>
          <InsightCard insight={blueprint.actions.learner} />
        </View>
        <PageFooter pageNum={3} />
      </Page>
    </Document>
  )

  return pdf(doc).toBlob()
}
