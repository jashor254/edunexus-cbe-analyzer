// lib/row/completion.ts
//
// What a Record of Work may truthfully claim about a lesson.
//
// A Record of Work records teaching that HAPPENED. Its "Work Done" text is
// seeded from the lesson plan's steps (lib/row/recordOfWork.ts), which is a
// PLAN, not evidence of delivery. The only teacher-owned evidence that a
// lesson was taught is `date_taught` (set by the teacher marking a lesson
// taught, by the teacher editing the record, or converged from the teacher's
// own `taught_date` — never by a machine). So:
//
//   confirmed  = the teacher has recorded a date_taught
//   planned    = everything else; its Work Done text is shown but labelled
//
// `row_entries.status` is deliberately NOT consulted: it is machine-owned,
// always rewritten to 'planned' on sync, and legacy rows may carry the old
// default 'completed' without any teacher input.
//
// Pure: no DB, no AI, no I/O. Shared by every surface that prints or shows a
// Record of Work so they cannot disagree.

export type RecordOfWorkLanguage = 'en' | 'sw'

type DatedEntry = { date_taught?: string | null }

/** True only when the teacher has recorded a (non-blank) date taught. */
export function isTeacherConfirmed(entry: DatedEntry | null | undefined): boolean {
  const date = entry?.date_taught
  return typeof date === 'string' && date.trim() !== ''
}

/** Number of entries the teacher has confirmed as taught. */
export function countConfirmed(entries: readonly DatedEntry[]): number {
  return entries.filter(isTeacherConfirmed).length
}

const PLANNED_PREFIX: Record<RecordOfWorkLanguage, string> = {
  en: 'Planned: ',
  sw: 'Imepangwa: ',
}

/** The label placed in front of a Work Done text that is only a plan. */
export function plannedPrefix(lang: RecordOfWorkLanguage): string {
  return PLANNED_PREFIX[lang]
}

/**
 * The footer sentence under a Record of Work. States only what is known:
 * how many lessons the teacher has confirmed, out of how many are planned.
 * (Kiswahili wording needs native-speaker review before relying on it.)
 */
export function progressStatement(lang: RecordOfWorkLanguage, confirmed: number, total: number): string {
  if (lang === 'sw') {
    if (total === 0) return 'Hakuna masomo kwenye rekodi hii bado'
    if (confirmed === 0) {
      return `Hakuna somo lililorekodiwa bado — masomo ${total} yamepangwa. Tarehe huandikwa masomo yanapofunzwa.`
    }
    return `Masomo ${confirmed} kati ya ${total} yamefundishwa na kurekodiwa — mengine yamepangwa`
  }
  if (total === 0) return 'No lessons in this record yet'
  if (confirmed === 0) {
    return `No lessons taught and recorded yet — ${total} planned. Dates are filled in as lessons are taught.`
  }
  return `${confirmed} of ${total} lessons taught and recorded — the rest are planned`
}

/**
 * How one Work Done cell should read: the text, and whether it is only a plan.
 * An empty text stays empty (never a bare "Planned: ").
 */
export function describeWorkDone(
  workDone: string | null | undefined,
  confirmed: boolean,
  lang: RecordOfWorkLanguage,
): { text: string; planned: boolean; prefix: string } {
  const text = (workDone ?? '').trim()
  if (confirmed || text === '') return { text, planned: false, prefix: '' }
  return { text, planned: true, prefix: plannedPrefix(lang) }
}
