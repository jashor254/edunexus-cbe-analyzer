// lib/career/clinicPdfRenderer.tsx
// 3-page CBC Clinic Report PDF using @react-pdf/renderer
// Mirrors lib/academicClinic/pdfGenerator.tsx pattern exactly.
// Page 1: Learner snapshot  |  Page 2: Pathway/Career  |  Page 3: Skills + Parent Actions

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
  green:  '#16a34a',
  amber:  '#d97706',
  red:    '#dc2626',
  teal:   '#0d9488',
}

function levelColor(l: number) { return [C.l1, C.l2, C.l3, C.l4][l - 1] ?? C.muted }
function levelBg(l: number)    { return [C.l1bg, C.l2bg, C.l3bg, C.l4bg][l - 1] ?? C.offWhite }

// Fix 5: solid hex colors for score badges — PDF renderers drop opacity-based colors
function scoreBadgeBg(score: number): string {
  if (score >= 3.5) return '#7c3aed'   // violet — Exceeds
  if (score >= 2.5) return '#16a34a'   // green  — Meets
  if (score >= 1.5) return '#d97706'   // amber  — Approaching
  return '#dc2626'                     // red    — Below
}
function statusBadgeBg(s: SubjectScoreRow['status']): string {
  return s === 'strong' ? '#7c3aed' : s === 'meets' ? '#16a34a' : s === 'needs_work' ? '#d97706' : '#dc2626'
}
function statusColor(_s: SubjectScoreRow['status']) { return '#ffffff' }
function statusBg(s: SubjectScoreRow['status'])     { return statusBadgeBg(s) }

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page:        { backgroundColor: C.white, fontFamily: 'Helvetica', paddingBottom: 50 },
  coverPage:   { backgroundColor: C.navy, fontFamily: 'Helvetica' },

  // Cover
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
  content: { paddingHorizontal: 36, paddingTop: 22 },

  // Section headings
  sectionLabel: { fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 5 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 },
  divider:      { borderTopWidth: 1, borderTopColor: C.border, marginVertical: 14 },

  // Summary box
  summaryBox:  { backgroundColor: C.offWhite, borderRadius: 6, padding: 14, borderLeftWidth: 3, borderLeftColor: C.gold, marginBottom: 18 },
  summaryText: { fontSize: 10, color: C.text, lineHeight: 1.6 },

  // Vitals row
  vitalsRow: { flexDirection: 'row', marginBottom: 18 },
  vitalCard: { flex: 1, padding: 12, borderRadius: 6, marginRight: 8 },
  vitalLabel:{ fontSize: 8, color: C.muted, letterSpacing: 1, marginBottom: 4 },
  vitalValue:{ fontSize: 22, fontWeight: 700 },
  vitalSub:  { fontSize: 8, color: C.muted, marginTop: 2 },

  // Subject rows
  subjectRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  subjectName:  { fontSize: 10, color: C.text, flex: 1 },
  scoreBar:     { height: 10, borderRadius: 5, marginRight: 8 },
  scoreLabel:   { fontSize: 9, fontWeight: 700, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },

  // Pathway box
  pathwayBox:  { borderRadius: 8, padding: 20, marginBottom: 18 },
  pathwayHead: { fontSize: 20, fontWeight: 700, marginBottom: 6 },
  pathwayBody: { fontSize: 10, lineHeight: 1.6 },

  // Action card — compact to fit 4 on one page
  actionCard:  { marginBottom: 10, padding: 10, borderRadius: 6, borderLeftWidth: 3 },
  actionTitle: { fontSize: 10, fontWeight: 700, color: C.text, marginBottom: 3 },
  actionWhy:   { fontSize: 8.5, color: C.muted, marginBottom: 4, lineHeight: 1.4 },
  actionText:  { fontSize: 9.5, color: C.text, lineHeight: 1.5 },

  // Timeline item
  timelineItem: { marginBottom: 12, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: C.gold },
  timelineLabel:{ fontSize: 9, color: C.gold, fontWeight: 700, marginBottom: 3 },
  timelineText: { fontSize: 10, color: C.text, lineHeight: 1.5 },

  // Disclaimer
  disclaimerBox:  { backgroundColor: C.offWhite, borderRadius: 4, padding: 12, marginTop: 16, borderWidth: 1, borderColor: C.border },
  disclaimerText: { fontSize: 7.5, color: C.muted, lineHeight: 1.5 },
})

// ─── Shared sub-components ────────────────────────────────────────────────────

function PageHeader({ name, pageLabel }: { name: string; pageLabel: string }) {
  return (
    <>
      <View style={S.pageHeader}>
        <View>
          <Text style={S.pageHeaderBrand}>EDUNEXUS</Text>
          <Text style={S.pageHeaderName}>{name} — Clinic Report</Text>
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
      <Text style={S.pageFooterText}>EduNexus Clinic Report · Generated {date}</Text>
      <Text style={S.pageFooterText}>edunexus.co.ke · CONFIDENTIAL</Text>
    </View>
  )
}

// ─── Page 1: Cover ───────────────────────────────────────────────────────────

function CoverPage({ report }: { report: ClinicReport }) {
  const date = new Date(report.generated_at).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const gradeLabel = report.grade <= 9
    ? `Grade ${report.grade} — CBC Junior`
    : `Grade ${report.grade} — CBC Senior`

  return (
    <Page size="A4" style={S.coverPage}>
      <View style={S.coverHeader}>
        <Text style={S.coverBrand}>EDUNEXUS · ACADEMIC CLINIC</Text>
        <Text style={S.coverTitle}>Student Clinic Report</Text>
      </View>

      <View style={S.coverBody}>
        <Text style={S.coverMeta}>PREPARED FOR</Text>
        <Text style={S.coverName}>{report.student_name}</Text>
        <Text style={S.coverMeta}>{gradeLabel} · {report.curriculum_type.toUpperCase()}</Text>
        <Text style={S.coverMeta}>Age: {report.age}</Text>
        <View style={S.coverDivider} />

        {/* Overall level badge — solid colors */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
          <View style={{ backgroundColor: scoreBadgeBg(report.overall_score), paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, marginRight: 16 }}>
            <Text style={{ fontSize: 28, fontWeight: 700, color: '#ffffff' }}>
              Level {report.overall_level}
            </Text>
            <Text style={{ fontSize: 11, color: '#ffffff', marginTop: 2 }}>
              {report.overall_label}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.6 }}>
              {report.summary_sentence}
            </Text>
          </View>
        </View>

        {/* Subject highlights */}
        <View style={{ flexDirection: 'row', marginBottom: 24 }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontSize: 9, color: C.gold, letterSpacing: 2, marginBottom: 8 }}>TOP SUBJECTS</Text>
            {report.top_subjects.map(s => (
              <View key={s.subject} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                <Text style={{ fontSize: 10, color: '#94a3b8', flex: 1 }}>{s.display_name}</Text>
                <View style={{ backgroundColor: scoreBadgeBg(s.score), paddingHorizontal: 8, paddingVertical: 2, borderRadius: 3 }}>
                  <Text style={{ fontSize: 9, fontWeight: 700, color: '#ffffff' }}>
                    {s.score.toFixed(1)}
                  </Text>
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
                  <Text style={{ fontSize: 9, fontWeight: 700, color: '#ffffff' }}>
                    {s.score.toFixed(1)}
                  </Text>
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
        <Text style={S.coverFooterText}>Generated {date} · EduNexus Academic Clinic · CONFIDENTIAL</Text>
      </View>
    </Page>
  )
}

// ─── Page 2: Pathway or Career ────────────────────────────────────────────────

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
  const pw = report.section === 'junior'
    ? (PATHWAY_COLORS[report.recommended_pathway ?? ''] ?? { bg: C.offWhite, color: C.teal, desc: '' })
    : null

  return (
    <Page size="A4" style={S.page}>
      <PageHeader name={report.student_name} pageLabel="Page 2 of 3" />

      <View style={S.content}>
        {report.section === 'junior' ? (
          <>
            <Text style={S.sectionLabel}>SECTION 2 — PATHWAY ANALYSIS</Text>
            <Text style={S.sectionTitle}>Grade 10 Pathway Placement</Text>
            <View style={S.divider} />

            {/* ── BLOCK A: Your Pathway Now ─────────────────────────────── */}
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
                  {/* Left: pathway pill */}
                  <View style={[S.pathwayBox, { flex: 1, marginRight: 8, backgroundColor: pw?.bg ?? C.offWhite, borderWidth: 1, borderColor: (pw?.color ?? C.teal) + '40' }]}>
                    <Text style={{ fontSize: 8, color: pw?.color ?? C.teal, letterSpacing: 2, marginBottom: 4 }}>YOUR PATHWAY NOW</Text>
                    <Text style={[S.pathwayHead, { color: pw?.color ?? C.teal, fontSize: 16 }]}>
                      {report.recommended_pathway ?? 'Not yet determined'}
                    </Text>
                    {composite !== undefined && (
                      <Text style={{ fontSize: 10, color: partial ? C.amber : C.text, marginTop: 4 }}>
                        {partial
                          ? `KJSEA composite: ${composite} / ${maxScore} points (${entered} of 9 subjects)`
                          : `KJSEA composite: ${composite} / ${maxScore} points`}
                      </Text>
                    )}
                    {partial && (
                      <Text style={{ fontSize: 8, color: C.amber, marginTop: 3, lineHeight: 1.4 }}>
                        Add remaining subjects for complete KJSEA composite analysis.
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
                      {firstName} is in Grade {report.grade}
                      {report.grade === 9 ? ' — final year of Junior Secondary.' : ' — Junior Secondary.'}
                      {' '}Pathway selection confirmed at Grade 10 entry.
                    </Text>
                  </View>

                  {/* Right: subject scores */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 8, color: C.muted, letterSpacing: 1, marginBottom: 6 }}>SUBJECT SCORES</Text>
                    {[...report.top_subjects, ...report.weak_subjects].map(s => (
                      <View key={s.subject} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                        <Text style={{ fontSize: 8, color: C.text, flex: 1 }}>{s.display_name}</Text>
                        <View style={{ backgroundColor: statusBg(s.status), paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 }}>
                          <Text style={{ fontSize: 8, color: '#ffffff', fontWeight: 700 }}>L{s.score.toFixed(0)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )
            })()}

            <View style={S.divider} />

            {/* ── BLOCK B: Next Door (STEM) ─────────────────────────────── */}
            {report.pathwayGapAnalysis?.nextPathway && (() => {
              const next      = report.pathwayGapAnalysis!.nextPathway!
              const lever     = next.keyLever
              const firstName = report.student_name.split(' ')[0]
              return (
                <View style={{ backgroundColor: '#eff6ff', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#bfdbfe', marginBottom: 12 }}>
                  <Text style={{ fontSize: 8, color: '#1d4ed8', letterSpacing: 2, marginBottom: 4 }}>NEXT DOOR</Text>
                  <Text style={{ fontSize: 13, fontWeight: 700, color: '#1e3a8a', marginBottom: 8 }}>
                    {`The ${next.name} Door`}
                  </Text>

                  {/* Unlock message */}
                  <Text style={{ fontSize: 10, color: C.text, lineHeight: 1.65, marginBottom: 10 }}>
                    {next.unlockMessage}
                  </Text>

                  {/* Visual: [Current] → [Target] → [STEM] */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 4, borderWidth: 1, borderColor: '#d97706' }}>
                      <Text style={{ fontSize: 8, color: '#92400e', fontWeight: 700 }}>
                        {`${lever.subject} L${lever.currentLevel}`}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: C.muted, marginHorizontal: 5 }}>{'->'}</Text>
                    <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 4, borderWidth: 1, borderColor: '#16a34a' }}>
                      <Text style={{ fontSize: 8, color: '#14532d', fontWeight: 700 }}>
                        {`${lever.subject} L${lever.targetLevel}`}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: C.muted, marginHorizontal: 5 }}>{'->'}</Text>
                    <View style={{ backgroundColor: '#1d4ed8', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 4 }}>
                      <Text style={{ fontSize: 8, color: '#ffffff', fontWeight: 700 }}>{next.name} Open</Text>
                    </View>
                  </View>

                  <Text style={{ fontSize: 9, color: '#3b82f6', fontStyle: 'italic', marginBottom: 6 }}>
                    One subject. One level. One term.
                  </Text>

                  {lever.wouldUnlock ? (
                    <Text style={{ fontSize: 9, color: '#15803d', fontWeight: 700 }}>
                      This single improvement is enough to open {next.name}.
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 9, color: C.muted }}>
                      {next.currentGap > 0
                        ? `This brings ${firstName} within ${next.currentGap} points of ${next.name}.`
                        : `The composite qualifies. Focus is on the subject requirements above.`}
                    </Text>
                  )}
                </View>
              )
            })()}

            {/* ── BLOCK C: Disclaimer ───────────────────────────────────── */}
            <View style={{ backgroundColor: C.offWhite, borderRadius: 4, padding: 10, borderWidth: 1, borderColor: C.border }}>
              <Text style={{ fontSize: 7.5, color: C.muted, lineHeight: 1.5 }}>
                {report.pathwayGapAnalysis?.disclaimer ?? PATHWAY_DISCLAIMER.short}
              </Text>
              <Text style={{ fontSize: 7.5, color: C.muted, lineHeight: 1.5, marginTop: 2 }}>
                {PATHWAY_DISCLAIMER.source}
              </Text>
            </View>

            {/* Career exploration CTA */}
            <View style={{ backgroundColor: '#f5f3ff', borderRadius: 8, padding: 14, borderLeftWidth: 4, borderLeftColor: '#7c3aed', marginTop: 12 }}>
              <Text style={{ fontSize: 10, fontWeight: 700, color: '#5b21b6', marginBottom: 6 }}>
                Explore Careers in This Pathway
              </Text>
              <Text style={{ fontSize: 9.5, color: '#3b0764', lineHeight: 1.65, marginBottom: 6 }}>
                {`Visit edunexus.co.ke/career to see every career in the ${report.recommended_pathway ?? 'recommended'} pathway — including employment salaries, business opportunities, and what AI makes possible in each field.`}
              </Text>
              <Text style={{ fontSize: 9, color: '#6d28d9', fontWeight: 600 }}>
                edunexus.co.ke/career
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text style={S.sectionLabel}>SECTION 2 — CAREER MATCH</Text>
            <Text style={S.sectionTitle}>
              {report.top_career
                ? `Best Match: ${report.top_career.career.title}`
                : 'Career Planning'}
            </Text>
            <View style={S.divider} />

            {report.top_career ? (
              <>
                {/* Description — capped to prevent Page 2 overflow */}
                <View style={[S.summaryBox]}>
                  <Text style={S.summaryText}>
                    {(() => {
                      const desc = report.top_career.career.description ?? ''
                      return desc.length > 320 ? desc.slice(0, 320) + '…' : desc
                    })()}
                  </Text>
                </View>

                {/* Career-relevant gap table — only required subjects */}
                <Text style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 8 }}>
                  Subject Gap Analysis
                </Text>
                {(report.career_gap_rows ?? [...report.top_subjects, ...report.weak_subjects]).map(s => {
                  const badgeBg  = s.status === 'strong'     ? C.l3bg
                                 : s.status === 'meets'      ? '#dbeafe'
                                 : s.status === 'critical'   ? C.l1bg
                                 : C.l2bg
                  const badgeFg  = s.status === 'strong'     ? C.l3
                                 : s.status === 'meets'      ? '#1d4ed8'
                                 : s.status === 'critical'   ? C.l1
                                 : C.l2
                  const badgeTxt = s.status === 'strong'     ? 'Strong'
                                 : s.status === 'meets'      ? 'Meets'
                                 : s.gap                     ? `Needs +${s.gap}`
                                 : 'Review'
                  return (
                    <View key={s.subject} style={S.subjectRow}>
                      <Text style={S.subjectName}>{s.display_name}</Text>
                      <Text style={{ fontSize: 9, color: C.muted, marginRight: 8 }}>
                        {s.score > 0 ? `Level ${s.score.toFixed(0)}` : 'Not studied'}{s.required ? ` / Need ${s.required}` : ''}
                      </Text>
                      <View style={{ backgroundColor: badgeBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 }}>
                        <Text style={{ fontSize: 8, color: badgeFg, fontWeight: 700 }}>{badgeTxt}</Text>
                      </View>
                    </View>
                  )
                })}
              </>
            ) : (
              <View style={S.summaryBox}>
                <Text style={S.summaryText}>
                  Career matching requires updated assessment data. Please complete a full assessment to see personalised career matches.
                </Text>
              </View>
            )}

            {/* Career Explorer CTA */}
            <View style={{ backgroundColor: '#f5f3ff', borderRadius: 8, padding: 14, borderLeftWidth: 4, borderLeftColor: '#7c3aed', marginTop: 14 }}>
              <Text style={{ fontSize: 10, fontWeight: 700, color: '#5b21b6', marginBottom: 5 }}>
                Go Deeper — Career Explorer
              </Text>
              <Text style={{ fontSize: 9.5, color: '#3b0764', lineHeight: 1.65, marginBottom: 6 }}>
                For detailed career analysis, salary data, and pathway planning, visit the Career Explorer at edunexus.co.ke/careers
              </Text>
              <Text style={{ fontSize: 9, color: '#6d28d9', fontWeight: 600 }}>
                edunexus.co.ke/careers
              </Text>
            </View>
          </>
        )}
      </View>

      <PageFooter date={new Date(report.generated_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })} />
    </Page>
  )
}

// ─── Page 3: Skills + Parent Actions ─────────────────────────────────────────

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
        {/* Skill timeline */}
        <Text style={S.sectionLabel}>SECTION 3 — SKILL DEVELOPMENT TIMELINE</Text>
        <Text style={S.sectionTitle}>Age {report.age} — {report.current_age_range}</Text>
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

        {/* Parent Actions */}
        <Text style={[S.sectionLabel, { marginBottom: 8 }]}>{report.parent_actions.length} PARENT ACTIONS THIS TERM</Text>
        {report.parent_actions.slice(0, 4).map((act, i) => (
          <View key={i} style={[S.actionCard, { borderLeftColor: ACTION_COLORS[i]?.border ?? C.gold, backgroundColor: ACTION_COLORS[i]?.bg ?? C.goldLight }]}>
            <Text style={S.actionTitle}>{i + 1}. {act.title}</Text>
            <Text style={S.actionWhy}>{act.why}</Text>
            <Text style={S.actionText}>{act.action}</Text>
            {act.link && (
              <Text style={{ fontSize: 9, color: C.teal, marginTop: 4 }}>edunexus.co.ke{act.link}</Text>
            )}
          </View>
        ))}

        {/* Disclaimer */}
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
    title={`EduNexus Clinic Report — ${report.student_name}`}
    author="EduNexus Academic Clinic"
    subject="CBC Student Clinic Report"
  >
    <CoverPage report={report} />
    <PathwayCareerPage report={report} />
    <SkillsParentPage report={report} />
  </Document>
)

// ─── Generator function (mirrors academicClinic pattern exactly) ─────────────

export async function generateClinicReportPDF(report: ClinicReport): Promise<Buffer> {
  const { renderToBuffer } = await import('@react-pdf/renderer')
  const buffer = await renderToBuffer(<ClinicReportPDF report={report} />)
  return Buffer.from(buffer)
}
