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

  // Action card
  actionCard:  { marginBottom: 14, padding: 14, borderRadius: 6, borderLeftWidth: 3 },
  actionTitle: { fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 4 },
  actionWhy:   { fontSize: 9, color: C.muted, marginBottom: 6, lineHeight: 1.5 },
  actionText:  { fontSize: 10, color: C.text, lineHeight: 1.6 },

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
            <Text style={S.sectionTitle}>Recommended Pathway: {report.recommended_pathway ?? 'Not yet determined'}</Text>
            <View style={S.divider} />

            {report.recommended_pathway && pw && (
              <View style={[S.pathwayBox, { backgroundColor: pw.bg, borderWidth: 1, borderColor: pw.color + '40' }]}>
                <Text style={[S.pathwayHead, { color: pw.color }]}>{report.recommended_pathway}</Text>
                <Text style={[S.pathwayBody, { color: C.text }]}>{pw.desc}</Text>
              </View>
            )}

            {/* All subject scores */}
            <Text style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 12 }}>
              Full Subject Performance
            </Text>
            {[...report.top_subjects, ...report.weak_subjects].map(s => (
              <View key={s.subject} style={S.subjectRow}>
                <Text style={S.subjectName}>{s.display_name}</Text>
                <View style={[S.scoreBar, { width: s.score * 40, backgroundColor: statusColor(s.status) }]} />
                <View style={[{ backgroundColor: statusBg(s.status), paddingHorizontal: 8, paddingVertical: 2, borderRadius: 3 }]}>
                  <Text style={[S.scoreLabel, { color: statusColor(s.status) }]}>
                    {s.score.toFixed(1)} — {s.status === 'strong' ? 'Exceeds' : s.status === 'meets' ? 'Meets' : s.status === 'needs_work' ? 'Approaching' : 'Below'}
                  </Text>
                </View>
              </View>
            ))}

            <View style={S.divider} />
            <Text style={{ fontSize: 9, color: C.muted, lineHeight: 1.5, marginBottom: 16 }}>
              CBC Grade {report.grade} — Pathway placement is based on current performance and is reviewed each term. Students can change pathways up to Grade 10.
            </Text>

            {/* Fix 2: Fill blank space with meaningful context box */}
            <View style={{ backgroundColor: '#eff6ff', borderRadius: 8, padding: 18, borderLeftWidth: 4, borderLeftColor: '#1d4ed8' }}>
              <Text style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', marginBottom: 8, letterSpacing: 0.5 }}>
                What This Means for {report.student_name.split(' ')[0]}
              </Text>
              <Text style={{ fontSize: 10, color: C.text, lineHeight: 1.7, marginBottom: 8 }}>
                {report.student_name.split(' ')[0]} is in Grade {report.grade} — {report.grade === 9 ? 'the final year of Junior Secondary' : 'Junior Secondary'}. The {report.recommended_pathway ?? 'recommended'} pathway recommendation will guide subject choices entering Grade 10.
              </Text>
              <Text style={{ fontSize: 10, color: C.text, lineHeight: 1.7, marginBottom: 8 }}>
                {report.recommended_pathway === 'STEM'
                  ? 'Strong performance in Sciences and Mathematics will open the most doors — including medicine, engineering, and technology. These subjects become harder in senior school, so every term of solid foundation counts.'
                  : report.recommended_pathway === 'Social Sciences'
                  ? 'Strong performance in English, History, and Social Studies builds the analytical and communication skills that define careers in law, education, and public service.'
                  : report.recommended_pathway === 'Arts & Sports Science'
                  ? 'Creative and physical excellence combined with academic performance opens unique opportunities in the growing arts and sports economy.'
                  : 'A strong overall performance at this level keeps all options open for Grade 10 subject selection.'}
              </Text>
              <Text style={{ fontSize: 9, color: C.muted, lineHeight: 1.5 }}>
                Pathway can be reviewed each term based on performance. Final selection happens at Grade 10 entry.
              </Text>
            </View>

            {/* STEM within reach — shown when Social Sciences but composite + science signal exists */}
            {report.recommended_pathway === 'Social Sciences' && report.stem_viable && (() => {
              const sciSubject = [...report.top_subjects, ...report.weak_subjects]
                .find(s => s.subject === 'integrated_science' || s.subject === 'mathematics')
              const strongSci = report.top_subjects.find(s => s.subject === 'integrated_science')
              const weakMath  = report.weak_subjects.find(s => s.subject === 'mathematics')
              if (!sciSubject) return null
              return (
                <View style={{ backgroundColor: '#f0fdf4', borderRadius: 6, padding: 14, borderLeftWidth: 3, borderLeftColor: '#16a34a', marginTop: 10 }}>
                  <Text style={{ fontSize: 10, fontWeight: 700, color: '#15803d', marginBottom: 6 }}>
                    STEM Pathway: Within Reach
                  </Text>
                  {weakMath && (
                    <Text style={{ fontSize: 9, color: C.text, lineHeight: 1.6, marginBottom: 4 }}>
                      {`Mathematics needs to reach Level 3 (currently Level ${weakMath.score.toFixed(0)}). One level of improvement unlocks the full STEM pathway.`}
                    </Text>
                  )}
                  {strongSci && (
                    <Text style={{ fontSize: 9, color: C.text, lineHeight: 1.6, marginBottom: 4 }}>
                      {`Integrated Science is already strong at Level ${strongSci.score.toFixed(0)} — this is a real STEM signal.`}
                    </Text>
                  )}
                  <Text style={{ fontSize: 9, color: C.muted, lineHeight: 1.5 }}>
                    {`KJSEA composite: ${report.kjsea_composite ?? '—'}/72 (threshold: 20). Social Sciences remains a strong pathway now.`}
                  </Text>
                </View>
              )
            })()}

            {/* KJSEA composite + disclaimer */}
            <View style={{ backgroundColor: '#f8f9fa', borderLeftWidth: 3, borderLeftColor: '#6b7280', paddingHorizontal: 12, paddingVertical: 8, marginTop: 12 }}>
              {report.kjsea_composite !== undefined && (
                <Text style={{ fontSize: 9, color: '#6b7280', fontStyle: 'italic', marginBottom: 4 }}>
                  {`KJSEA composite: ${report.kjsea_composite}/72 points (STEM threshold: 20 points)`}
                </Text>
              )}
              <Text style={{ fontSize: 9, color: '#6b7280', fontStyle: 'italic', marginBottom: 2 }}>
                {PATHWAY_DISCLAIMER.short}
              </Text>
              <Text style={{ fontSize: 9, color: '#6b7280', fontStyle: 'italic' }}>
                {PATHWAY_DISCLAIMER.source}
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
                {/* Truncated description — full description causes Page 2 overflow */}
                <View style={[S.summaryBox]}>
                  <Text style={S.summaryText}>
                    {(() => {
                      const desc = report.top_career.career.description ?? ''
                      return desc.length > 200 ? desc.slice(0, 200) + '…' : desc
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
          <View style={{ marginBottom: 16 }}>
            <View style={S.timelineItem}>
              <Text style={S.timelineLabel}>NOW — Ages {report.current_phase.age_range} ({report.current_phase.phase})</Text>
              <Text style={S.timelineText}>{report.current_phase.why}</Text>
              {report.current_phase.skills.slice(0, 4).map(sk => (
                <Text key={sk} style={{ fontSize: 9, color: C.muted, marginTop: 3 }}>• {sk}</Text>
              ))}
            </View>
          </View>
        ) : (
          <View style={[S.summaryBox, { marginBottom: 16 }]}>
            <Text style={S.summaryText}>
              Skill timeline will populate as career data is matched. Focus on broad exposure and curiosity at this stage.
            </Text>
          </View>
        )}

        {report.next_phase && (
          <View style={{ marginBottom: 16 }}>
            <View style={[S.timelineItem, { borderLeftColor: C.teal }]}>
              <Text style={[S.timelineLabel, { color: C.teal }]}>NEXT — Ages {report.next_phase.age_range} ({report.next_phase.phase})</Text>
              <Text style={S.timelineText}>{report.next_phase.why}</Text>
              {report.next_phase.skills.slice(0, 3).map(sk => (
                <Text key={sk} style={{ fontSize: 9, color: C.muted, marginTop: 3 }}>• {sk}</Text>
              ))}
            </View>
          </View>
        )}

        <View style={S.divider} />

        {/* Parent Actions */}
        <Text style={[S.sectionLabel, { marginBottom: 10 }]}>3 PARENT ACTIONS THIS TERM</Text>
        {report.parent_actions.slice(0, 3).map((act, i) => (
          <View key={i} style={[S.actionCard, { borderLeftColor: ACTION_COLORS[i]?.border ?? C.gold, backgroundColor: ACTION_COLORS[i]?.bg ?? C.goldLight }]}>
            <Text style={S.actionTitle}>{i + 1}. {act.title}</Text>
            <Text style={S.actionWhy}>{act.why}</Text>
            <Text style={S.actionText}>{act.action}</Text>
            {act.link && (
              <Text style={{ fontSize: 9, color: C.teal, marginTop: 4 }}>→ edunexus.co.ke{act.link}</Text>
            )}
          </View>
        ))}

        {/* Disclaimer */}
        <View style={S.disclaimerBox}>
          <Text style={[S.disclaimerText, { fontWeight: 700, marginBottom: 4 }]}>DISCLAIMER</Text>
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
