// lib/assignments/assignmentPdfRenderer.tsx
//
// PHASE 3 — the learner-facing assignment PDF document, using the same
// canonical @react-pdf/renderer stack already proven learner-facing by
// lib/career/clinicPdfRenderer.tsx (Step 7 — reuse the existing PDF stack,
// no new dependency, no headless-browser/window.print() path). Server-
// rendered PDF bytes only — never HTML-for-window.print (that pattern
// stays teacher-only, see lib/assignments/printRoutePdf.ts).
//
// STEP 2 — CONTENT INCLUDED: school/class/teacher context, title, subject,
// instructions, questions/work items (quiz — text + choices, never
// correct_index), due date, answer space for non-quiz work, a
// human-readable assignment reference, generated timestamp.
// STEP 2 — CONTENT EXCLUDED: any internal id (assignment uuid is shown
// only as a short human reference, never used for lookup by the reader),
// learner_identity_id, students.id, teacher_classes.id, quiz correct_index/
// scoring key, adaptive/route/evidence-band language, evidence/projection
// internals.
// STEP 25 — PRIVACY: no learner PII at all — this is deliberately the
// GENERIC canonical assignment (see assignmentPdfContent.ts's header for
// why), so it carries no name, DOB, admission number, or guardian contact.

import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { AssignmentPdfContent } from './assignmentPdfContent'

const C = {
  navy: '#1a2744',
  gold: '#f59e0b',
  white: '#ffffff',
  text: '#1e293b',
  muted: '#64748b',
  border: '#e2e8f0',
  offWhite: '#f8fafc',
}

const S = StyleSheet.create({
  page: { backgroundColor: C.white, fontFamily: 'Helvetica', paddingBottom: 40 },
  header: { backgroundColor: C.navy, paddingHorizontal: 36, paddingVertical: 20, borderBottomWidth: 3, borderBottomColor: C.gold },
  brand: { fontSize: 9, color: C.gold, letterSpacing: 2, marginBottom: 4 },
  titleText: { fontSize: 18, fontWeight: 700, color: C.white },
  schoolText: { fontSize: 9.5, color: '#cbd5e1', marginTop: 4 },
  content: { paddingHorizontal: 36, paddingTop: 18 },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 12 },
  infoCell: { minWidth: 130, marginRight: 18, marginBottom: 6 },
  infoLabel: { fontSize: 7.5, color: C.muted, letterSpacing: 1, marginBottom: 2 },
  infoVal: { fontSize: 10.5, fontWeight: 700, color: C.text },
  sectionLabel: { fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 6, marginTop: 10 },
  instructionsBox: { backgroundColor: C.offWhite, borderLeftWidth: 3, borderLeftColor: C.gold, padding: 12, marginBottom: 10 },
  instructionsText: { fontSize: 10.5, color: C.text, lineHeight: 1.6 },
  questionBlock: { marginBottom: 14 },
  questionText: { fontSize: 10.5, color: C.text, marginBottom: 6, lineHeight: 1.5 },
  choiceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingLeft: 8 },
  choiceMark: { width: 12, height: 12, borderWidth: 1, borderColor: C.muted, borderRadius: 2, marginRight: 6 },
  choiceText: { fontSize: 9.5, color: C.text },
  answerLine: { borderBottomWidth: 1, borderBottomColor: '#ccc', height: 22, marginBottom: 4 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 36, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: C.muted },
})

/** First 8 characters of the assignment id, uppercased — a short human reference (Step 2), never used for lookup, never the full internal id. */
function shortReference(assignmentId: string): string {
  return assignmentId.replace(/-/g, '').slice(0, 8).toUpperCase()
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return iso
  }
}

export function AssignmentPdfDocument({ content, generatedAt }: { content: AssignmentPdfContent; generatedAt: string }) {
  const ref = shortReference(content.assignmentId)

  return (
    <Document title={`EduNexus Assignment — ${content.title}`} author="EduNexus" subject={content.subject}>
      <Page size="A4" style={S.page}>
        <View style={S.header}>
          <Text style={S.brand}>EDUNEXUS · ASSIGNMENT</Text>
          <Text style={S.titleText}>{content.title}</Text>
          {(content.schoolName || content.className) && (
            <Text style={S.schoolText}>
              {[content.schoolName, content.className, content.grade ? `Grade ${content.grade}` : null].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>

        <View style={S.content}>
          <View style={S.infoRow}>
            <View style={S.infoCell}>
              <Text style={S.infoLabel}>SUBJECT</Text>
              <Text style={S.infoVal}>{content.subject}</Text>
            </View>
            <View style={S.infoCell}>
              <Text style={S.infoLabel}>TOPIC</Text>
              <Text style={S.infoVal}>{content.topic}</Text>
            </View>
            <View style={S.infoCell}>
              <Text style={S.infoLabel}>DUE DATE</Text>
              <Text style={S.infoVal}>{formatDate(content.dueDate)}</Text>
            </View>
            {content.teacherName && (
              <View style={S.infoCell}>
                <Text style={S.infoLabel}>TEACHER</Text>
                <Text style={S.infoVal}>{content.teacherName}</Text>
              </View>
            )}
            <View style={S.infoCell}>
              <Text style={S.infoLabel}>REFERENCE</Text>
              <Text style={S.infoVal}>{ref}</Text>
            </View>
          </View>

          <Text style={S.sectionLabel}>INSTRUCTIONS</Text>
          <View style={S.instructionsBox}>
            <Text style={S.instructionsText}>{content.instructions}</Text>
          </View>

          {content.isQuiz ? (
            <>
              <Text style={S.sectionLabel}>QUESTIONS</Text>
              {content.questions.map((q, i) => (
                <View key={q.id} style={S.questionBlock} wrap={false}>
                  <Text style={S.questionText}>{i + 1}. {q.question_text}</Text>
                  {q.choices.map((choice, ci) => (
                    <View key={ci} style={S.choiceRow}>
                      <View style={S.choiceMark} />
                      <Text style={S.choiceText}>{String.fromCharCode(65 + ci)}. {choice}</Text>
                    </View>
                  ))}
                </View>
              ))}
              {content.questions.length === 0 && (
                <Text style={S.instructionsText}>No questions have been set for this assignment yet.</Text>
              )}
            </>
          ) : (
            <>
              <Text style={S.sectionLabel}>YOUR WORK</Text>
              <Text style={{ fontSize: 8.5, color: C.muted, marginBottom: 8 }}>
                Write your answers below, or on separate paper if you need more space. Return this
                work — typed, photographed, or on paper — once you reconnect.
              </Text>
              {Array.from({ length: 12 }).map((_, i) => (
                <View key={i} style={S.answerLine} />
              ))}
            </>
          )}
        </View>

        <View style={S.footer} fixed>
          <Text style={S.footerText}>EduNexus · {ref} · Generated {generatedAt}</Text>
          <Text style={S.footerText}>edunexus.co.ke</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateAssignmentPdf(content: AssignmentPdfContent, generatedAt: string): Promise<Buffer> {
  const { renderToBuffer } = await import('@react-pdf/renderer')
  const buffer = await renderToBuffer(<AssignmentPdfDocument content={content} generatedAt={generatedAt} />)
  return Buffer.from(buffer)
}
