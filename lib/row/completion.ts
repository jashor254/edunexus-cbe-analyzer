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
 * The footer sentence under a Record of Work. States only what the teacher has
 * recorded: how many lessons carry a date taught, out of how many are in the
 * record — "recorded as taught", never "verified". A sentence about the lessons
 * that remain is added only while some remain.
 *
 * Kiswahili uses kipindi/vipindi (noun classes 7/8) for a lesson session, so
 * the verb agreement is ki-/vi-.
 */
export function progressStatement(lang: RecordOfWorkLanguage, confirmed: number, total: number): string {
  const remaining = Math.max(total - confirmed, 0)
  if (lang === 'sw') {
    if (total === 0) return 'Hakuna vipindi kwenye rekodi hii bado.'
    if (confirmed === 0) {
      const planned = total === 1 ? 'Kipindi 1 kimepangwa.' : `Vipindi ${total} vimepangwa.`
      return `Hakuna kipindi kilichorekodiwa kuwa kimefundishwa bado. ${planned}`
    }
    if (remaining === 0) {
      return total === 1
        ? 'Kipindi 1 kimerekodiwa kuwa kimefundishwa.'
        : `Vipindi vyote ${total} vimerekodiwa kuwa vimefundishwa.`
    }
    const done = confirmed === 1
      ? `Kipindi 1 kati ya ${total} kimerekodiwa kuwa kimefundishwa.`
      : `Vipindi ${confirmed} kati ya ${total} vimerekodiwa kuwa vimefundishwa.`
    const left = remaining === 1
      ? 'Kipindi 1 kilichobaki kimepangwa.'
      : `Vipindi ${remaining} vilivyobaki vimepangwa.`
    return `${done} ${left}`
  }
  if (total === 0) return 'No lessons in this record yet.'
  if (confirmed === 0) {
    return `No lessons recorded as taught yet. ${total} ${total === 1 ? 'lesson' : 'lessons'} planned.`
  }
  if (remaining === 0) {
    return total === 1 ? '1 lesson recorded as taught.' : `All ${total} lessons recorded as taught.`
  }
  const left = remaining === 1 ? '1 remaining lesson is planned.' : `${remaining} remaining lessons are planned.`
  return `${confirmed} of ${total} lessons recorded as taught. ${left}`
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
