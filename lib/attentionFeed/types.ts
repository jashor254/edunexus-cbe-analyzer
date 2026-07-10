export type AttentionSeverity = 'critical' | 'at_risk' | 'watch' | 'info'

export type AttentionSource = 'eils' | 'monday_panel' | 'weekly_intelligence' | 'student_alert' | 'knowledge_graph'

export type AttentionItem = {
  itemKey:          string
  source:           AttentionSource
  severity:         AttentionSeverity
  studentId:        string | null
  studentName:      string | null
  classId:          string | null
  title:            string
  detail:           string
  suggestedAction:  string | null
  actionLink:       string
  generatedAt:      string
  // Prerequisite-chain warnings are the flagship insight — they always sort
  // to the top of the feed regardless of severity.
  flagship:         boolean
}
