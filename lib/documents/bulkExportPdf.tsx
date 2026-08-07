// lib/documents/bulkExportPdf.tsx
// Server-side bulk PDF generator using @react-pdf/renderer.
// Mirrors the pattern used in lib/academicClinic/pdfGenerator.tsx.

import React from 'react'
import {
  Document, Page, Text, View, StyleSheet,
} from '@react-pdf/renderer'
import type { LessonPlanRecord } from '@/lib/lessonPlan/types'
import { workDoneFor, type StoredRecordOfWork } from '@/lib/row/recordOfWork'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SchemeMeta {
  id: string
  school: string
  grade: string
  learning_area: string
  term: number
  year: number
  curriculum_mode: string
  total_lessons: number
  total_weeks: number
  teacher_name: string
  tsc_number: string
  lessons: unknown[]
}

export interface ExportScheme {
  meta: SchemeMeta
  lessonPlans: LessonPlanRecord[]
  /**
   * Phase 3 — the canonical stored Record of Work for this scheme, read via
   * `getRecordOfWorkForScheme()`. The Record of Work page renders from this,
   * never from `lessonPlans`, so a bulk export and a single ROW download are
   * the same document (ADR-0032 §12). Null when the scheme has no Record of
   * Work, in which case the page is skipped.
   */
  recordOfWork: StoredRecordOfWork | null
}

export interface BulkExportOptions {
  sow: boolean
  lessonPlans: boolean
  recordOfWork: boolean
}

// ─── Colours ──────────────────────────────────────────────────────────────────

const C = {
  navy:    '#0f172a',
  teal:    '#0d9488',
  tealBg:  '#f0fdfa',
  white:   '#ffffff',
  slate:   '#64748b',
  border:  '#e2e8f0',
  text:    '#1e293b',
  lp:      '#2563eb',
  lpBg:    '#eff6ff',
  row:     '#d97706',
  rowBg:   '#fffbeb',
  green:   '#16a34a',
  muted:   '#94a3b8',
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  coverPage:    { backgroundColor: C.navy, padding: 0, fontFamily: 'Helvetica' },
  page:         { backgroundColor: C.white, fontFamily: 'Helvetica', padding: 32, paddingBottom: 50 },
  coverInner:   { padding: 48 },
  coverTitle:   { fontSize: 28, fontWeight: 'bold', color: C.white, marginBottom: 4 },
  coverSub:     { fontSize: 12, color: '#94a3b8', marginBottom: 8 },
  coverScheme:  { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: 12, marginBottom: 8 },
  coverSchemeName: { fontSize: 11, fontWeight: 'bold', color: C.white },
  coverSchemeMeta: { fontSize: 9, color: '#94a3b8', marginTop: 2 },
  sectionDivider:  { backgroundColor: C.navy, padding: 32, fontFamily: 'Helvetica' },
  dividerTitle:  { fontSize: 22, fontWeight: 'bold', color: C.white, marginBottom: 6, marginTop: 48 },
  dividerSub:    { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  dividerBadge:  {
    backgroundColor: C.teal, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3,
    marginTop: 16, alignSelf: 'flex-start',
  },
  dividerBadgeText: { fontSize: 9, fontWeight: 'bold', color: C.white },
  sectionHeader: {
    backgroundColor: C.tealBg, borderLeftColor: C.teal, borderLeftWidth: 3,
    padding: 10, marginBottom: 12,
  },
  sectionTitle:  { fontSize: 12, fontWeight: 'bold', color: C.teal },
  table:         { marginBottom: 16 },
  tableHeader:   { flexDirection: 'row', backgroundColor: C.navy, padding: 6 },
  tableRow:      { flexDirection: 'row', borderBottomColor: C.border, borderBottomWidth: 1, padding: 5 },
  tableRowAlt:   {
    flexDirection: 'row', backgroundColor: '#f8fafc',
    borderBottomColor: C.border, borderBottomWidth: 1, padding: 5,
  },
  th:   { fontSize: 7, fontWeight: 'bold', color: C.white },
  td:   { fontSize: 7, color: C.text },
  colWk:  { width: '6%' },
  colLes: { width: '6%' },
  colStr: { width: '18%' },
  colSub: { width: '18%' },
  colOut: { width: '30%' },
  colRes: { width: '22%' },
  lpCard:  { border: 1, borderColor: C.border, borderRadius: 6, padding: 14, marginBottom: 12 },
  lpMeta:      { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  lpMetaItem:  { marginRight: 20, marginBottom: 4 },
  lpMetaLabel: { fontSize: 7, color: C.slate, fontWeight: 'bold' },
  lpMetaValue: { fontSize: 9, color: C.text, marginTop: 1 },
  lpSection:       { marginBottom: 8 },
  lpSectionLabel:  { fontSize: 7, fontWeight: 'bold', color: C.lp, marginBottom: 3 },
  lpSectionText:   { fontSize: 8, color: C.text, lineHeight: 1.4 },
  bullet:          { fontSize: 8, color: C.text, lineHeight: 1.4, marginLeft: 8 },
  footer: {
    position: 'absolute', bottom: 20, left: 32, right: 32,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopColor: C.border, borderTopWidth: 1, paddingTop: 6,
  },
  footerText: { fontSize: 7, color: C.muted },
  pageNum:    { fontSize: 7, color: C.muted },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function termLabel(term: number, year: number) { return `Term ${term} ${year}` }

function curriculumLabel(mode: string) {
  if (mode?.startsWith('cbc')) return 'CBC'
  if (mode?.startsWith('844')) return '8-4-4'
  return mode?.toUpperCase() ?? '—'
}

function joinBullets(val: string | string[] | null | undefined): string {
  if (!val) return '—'
  if (Array.isArray(val)) return val.filter(Boolean).join(', ') || '—'
  return val
}

// ─── Components ───────────────────────────────────────────────────────────────

function CoverPage({
  schemes, include,
}: {
  schemes: ExportScheme[]
  include: BulkExportOptions
}) {
  const included = [
    include.sow && 'Schemes of Work',
    include.lessonPlans && 'Lesson Plans',
    include.recordOfWork && 'Records of Work',
  ].filter(Boolean).join(' · ')

  return (
    <Page size="A4" style={S.coverPage}>
      <View style={S.coverInner}>
        <Text style={S.coverTitle}>EduNexus</Text>
        <Text style={S.coverTitle}>Document Bundle</Text>
        <Text style={S.coverSub}>{included}</Text>
        <Text style={[S.coverSub, { fontSize: 10, marginBottom: 32 }]}>
          {new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}
        </Text>

        <Text style={{ fontSize: 9, color: C.muted, marginBottom: 10 }}>
          INCLUDED SCHEMES — {schemes.length}
        </Text>

        {schemes.map(({ meta }) => (
          <View key={meta.id} style={S.coverScheme}>
            <Text style={S.coverSchemeName}>{meta.learning_area} · {meta.grade}</Text>
            <Text style={S.coverSchemeMeta}>
              {meta.school}  ·  {termLabel(meta.term, meta.year)}  ·  {curriculumLabel(meta.curriculum_mode)}  ·  {meta.total_lessons} lessons
            </Text>
          </View>
        ))}
      </View>
    </Page>
  )
}

function SchemeDivider({ meta }: { meta: SchemeMeta }) {
  return (
    <Page size="A4" style={S.sectionDivider}>
      <Text style={S.dividerTitle}>{meta.learning_area}</Text>
      <Text style={{ fontSize: 16, color: '#94a3b8', marginBottom: 8 }}>{meta.grade}</Text>
      <Text style={S.dividerSub}>{meta.school}</Text>
      <Text style={S.dividerSub}>
        {termLabel(meta.term, meta.year)}  ·  {meta.total_lessons} lessons / {meta.total_weeks} weeks
      </Text>
      {meta.teacher_name ? (
        <Text style={S.dividerSub}>
          Teacher: {meta.teacher_name}{meta.tsc_number ? `  ·  TSC: ${meta.tsc_number}` : ''}
        </Text>
      ) : null}
      <View style={S.dividerBadge}>
        <Text style={S.dividerBadgeText}>{curriculumLabel(meta.curriculum_mode)}</Text>
      </View>
    </Page>
  )
}

function SOWPage({ meta }: { meta: SchemeMeta }) {
  type RawLesson = {
    week: number; lesson: number; strand: string; substrand: string;
    learningOutcomes?: string[]; learningResources?: string[]; isBreak?: boolean;
  }
  const lessons = ((meta.lessons ?? []) as RawLesson[]).filter(l => !l.isBreak)

  return (
    <Page size="A4" orientation="landscape" style={S.page}>
      <View style={S.sectionHeader}>
        <Text style={S.sectionTitle}>
          Scheme of Work — {meta.learning_area} · {meta.grade} · {termLabel(meta.term, meta.year)}
        </Text>
      </View>

      <View style={S.table}>
        <View style={S.tableHeader}>
          <Text style={[S.th, S.colWk]}>Wk</Text>
          <Text style={[S.th, S.colLes]}>Les</Text>
          <Text style={[S.th, S.colStr]}>Strand</Text>
          <Text style={[S.th, S.colSub]}>Sub-strand</Text>
          <Text style={[S.th, S.colOut]}>Learning Outcomes</Text>
          <Text style={[S.th, S.colRes]}>Resources</Text>
        </View>
        {lessons.map((l, i) => (
          <View key={i} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
            <Text style={[S.td, S.colWk]}>{l.week}</Text>
            <Text style={[S.td, S.colLes]}>{l.lesson}</Text>
            <Text style={[S.td, S.colStr]}>{l.strand ?? '—'}</Text>
            <Text style={[S.td, S.colSub]}>{l.substrand ?? '—'}</Text>
            <Text style={[S.td, S.colOut]}>{joinBullets(l.learningOutcomes)}</Text>
            <Text style={[S.td, S.colRes]}>{joinBullets(l.learningResources)}</Text>
          </View>
        ))}
      </View>

      <View style={S.footer} fixed>
        <Text style={S.footerText}>EduNexus  ·  {meta.school}</Text>
        <Text style={S.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  )
}

function LPPages({ meta, plans }: { meta: SchemeMeta; plans: LessonPlanRecord[] }) {
  if (!plans.length) return null
  return (
    <>
      {plans.map(p => (
        <Page key={p.id} size="A4" style={S.page}>
          <View style={[S.sectionHeader, { borderLeftColor: C.lp, backgroundColor: C.lpBg }]}>
            <Text style={[S.sectionTitle, { color: C.lp }]}>
              Lesson Plan — {meta.learning_area} · {meta.grade} · Wk {p.week_number} Les {p.lesson_number}
            </Text>
          </View>

          <View style={S.lpCard}>
            <View style={S.lpMeta}>
              {([
                ['School', meta.school],
                ['Grade', meta.grade],
                ['Subject', meta.learning_area],
                ['Term', String(meta.term)],
                ['Year', String(meta.year)],
                ['Week', String(p.week_number)],
                ['Lesson', String(p.lesson_number)],
                ['Teacher', meta.teacher_name || '—'],
              ] as [string, string][]).map(([label, value]) => (
                <View key={label} style={S.lpMetaItem}>
                  <Text style={S.lpMetaLabel}>{label}</Text>
                  <Text style={S.lpMetaValue}>{value}</Text>
                </View>
              ))}
            </View>

            <View style={S.lpSection}>
              <Text style={S.lpSectionLabel}>STRAND / SUB-STRAND</Text>
              <Text style={S.lpSectionText}>{p.strand} / {p.sub_strand}</Text>
            </View>

            {p.learning_outcomes?.length > 0 && (
              <View style={S.lpSection}>
                <Text style={S.lpSectionLabel}>LEARNING OUTCOMES</Text>
                {p.learning_outcomes.map((o, i) => (
                  <Text key={i} style={S.bullet}>• {o}</Text>
                ))}
              </View>
            )}

            {p.introduction ? (
              <View style={S.lpSection}>
                <Text style={S.lpSectionLabel}>INTRODUCTION</Text>
                <Text style={S.lpSectionText}>{p.introduction}</Text>
              </View>
            ) : null}

            {(p.step_1 || p.step_2 || p.step_3) ? (
              <View style={S.lpSection}>
                <Text style={S.lpSectionLabel}>LESSON DEVELOPMENT</Text>
                {p.step_1 ? <Text style={S.bullet}>Step 1: {p.step_1}</Text> : null}
                {p.step_2 ? <Text style={S.bullet}>Step 2: {p.step_2}</Text> : null}
                {p.step_3 ? <Text style={S.bullet}>Step 3: {p.step_3}</Text> : null}
              </View>
            ) : null}

            {p.conclusion ? (
              <View style={S.lpSection}>
                <Text style={S.lpSectionLabel}>CONCLUSION</Text>
                <Text style={S.lpSectionText}>{p.conclusion}</Text>
              </View>
            ) : null}

            {p.learning_resources?.length > 0 && (
              <View style={S.lpSection}>
                <Text style={S.lpSectionLabel}>LEARNING RESOURCES</Text>
                <Text style={S.lpSectionText}>{joinBullets(p.learning_resources)}</Text>
              </View>
            )}
          </View>

          <View style={S.footer} fixed>
            <Text style={S.footerText}>EduNexus  ·  {meta.school}</Text>
            <Text style={S.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          </View>
        </Page>
      ))}
    </>
  )
}

function ROWPage({ meta, row }: { meta: SchemeMeta; row: StoredRecordOfWork | null }) {
  if (!row || !row.entries.length) return null

  // Phase 3 — every cell below reads the canonical stored Record of Work.
  // Two columns changed, both deliberately:
  //   * Reflection previously printed `lesson_plans.reflection`, which is the
  //     AI-authored guiding-question template when a teacher has not
  //     completed their evaluation. It now prints the teacher's stored
  //     Record of Work reflection.
  //   * "Status" previously derived Taught/Pending from the Lesson Plan.
  //     `row_entries.status` is structural ('planned') and would print the
  //     same word on every row, so the column is replaced by Date — which is
  //     the actual evidence of teaching and gives this page parity with the
  //     single ROW download.
  return (
    <Page size="A4" orientation="landscape" style={S.page}>
      <View style={[S.sectionHeader, { borderLeftColor: C.row, backgroundColor: C.rowBg }]}>
        <Text style={[S.sectionTitle, { color: C.row }]}>
          Record of Work — {meta.learning_area} · {meta.grade} · {termLabel(meta.term, meta.year)}
        </Text>
      </View>

      <View style={S.table}>
        <View style={S.tableHeader}>
          <Text style={[S.th, S.colWk]}>Wk</Text>
          <Text style={[S.th, S.colLes]}>Les</Text>
          <Text style={[S.th, { width: '10%' }]}>Date</Text>
          <Text style={[S.th, S.colStr]}>Strand</Text>
          <Text style={[S.th, S.colSub]}>Sub-strand</Text>
          <Text style={[S.th, { width: '24%' }]}>Learning Outcomes</Text>
          <Text style={[S.th, { width: '16%' }]}>Work Done</Text>
          <Text style={[S.th, { width: '14%' }]}>Reflection</Text>
        </View>
        {row.entries.map((e, i) => (
          <View key={`${e.week}:${e.lesson}`} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
            <Text style={[S.td, S.colWk]}>{e.week}</Text>
            <Text style={[S.td, S.colLes]}>{e.lesson}</Text>
            <Text style={[S.td, { width: '10%', color: e.date_taught ? C.green : C.muted }]}>
              {e.date_taught ?? '—'}
            </Text>
            <Text style={[S.td, S.colStr]}>{e.strand}</Text>
            <Text style={[S.td, S.colSub]}>{e.substrand}</Text>
            <Text style={[S.td, { width: '24%' }]}>{joinBullets(e.learning_outcomes)}</Text>
            <Text style={[S.td, { width: '16%' }]}>{workDoneFor(e).slice(0, 80) || '—'}</Text>
            <Text style={[S.td, { width: '14%' }]}>{e.reflection}</Text>
          </View>
        ))}
      </View>

      <View style={S.footer} fixed>
        <Text style={S.footerText}>EduNexus  ·  {meta.school}</Text>
        <Text style={S.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  )
}

function BulkExportDocument({
  schemes,
  include,
}: {
  schemes: ExportScheme[]
  include: BulkExportOptions
}) {
  return (
    <Document title="EduNexus Document Bundle" author="EduNexus">
      <CoverPage schemes={schemes} include={include} />
      {schemes.map(({ meta, lessonPlans, recordOfWork }) => (
        <React.Fragment key={meta.id}>
          <SchemeDivider meta={meta} />
          {include.sow ? <SOWPage meta={meta} /> : null}
          {include.lessonPlans ? <LPPages meta={meta} plans={lessonPlans} /> : null}
          {include.recordOfWork ? <ROWPage meta={meta} row={recordOfWork} /> : null}
        </React.Fragment>
      ))}
    </Document>
  )
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateBulkExportPDF(
  schemes: ExportScheme[],
  include: BulkExportOptions
): Promise<Buffer> {
  const { renderToBuffer } = await import('@react-pdf/renderer')
  return renderToBuffer(<BulkExportDocument schemes={schemes} include={include} />) as Promise<Buffer>
}
