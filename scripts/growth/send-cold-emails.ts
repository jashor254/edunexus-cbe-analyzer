/**
 * One-off Growth Engine tool — sends the founder's universal cold-intro
 * email (Dennis, EduNexus Kenya) to every school in an email-list CSV
 * (scripts/growth/output/email-list-*.csv), via Resend.
 *
 * Safety:
 *   - Dry run by default. Nothing is sent unless --send is passed.
 *   - A sent-log CSV tracks every successful send by email address, so a
 *     re-run (dry or real) never sends the same school twice.
 *   - --limit=N caps how many NEW (not-yet-sent) emails go out in one run.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/growth/send-cold-emails.ts --list=<path>            (dry run, shows what would be sent)
 *   npx tsx --env-file=.env.local scripts/growth/send-cold-emails.ts --list=<path> --send --limit=1   (real send, capped)
 *   npx tsx --env-file=.env.local scripts/growth/send-cold-emails.ts --list=<path> --send           (real send, all remaining)
 */
import { Resend } from 'resend'
import { parseCsvRecords, writeCsvTable } from './lib/csv'
import { readFile, writeFile } from 'node:fs/promises'

const API_KEY = process.env.RESEND_API_KEY
const FROM = process.env.RESEND_FROM_EMAIL ? `EduNexus <${process.env.RESEND_FROM_EMAIL}>` : 'EduNexus <hello@edunexus.co.ke>'

type Row = { county: string; name: string; town: string; email: string; phone: string; website: string }

const SENT_LOG_PATH = `${__dirname}/output/cold-email-sent-log.csv`
const SENT_LOG_HEADER = ['email', 'school_name', 'county', 'sent_at', 'resend_id', 'status', 'error']

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function parseArgs() {
  const listArg = process.argv.find((a) => a.startsWith('--list='))
  const limitArg = process.argv.find((a) => a.startsWith('--limit='))
  return {
    list: listArg?.split('=')[1] ?? '',
    send: process.argv.includes('--send'),
    limit: limitArg ? Number(limitArg.split('=')[1]) : Infinity,
  }
}

function buildEmail(schoolName: string) {
  const subject = `A quick question for ${schoolName}`
  const html = `
    <p>Good day Principal,</p>
    <p>My name is Dennis, from EduNexus Kenya. I'm reaching out to a few schools directly to introduce a platform we've built that helps teachers save time on planning while giving schools a clearer, evidence-based picture of how each learner is really progressing.</p>
    <p>Would you have 10 minutes this week to share how <strong>${schoolName}</strong> currently approaches this? I'd value the chance to listen first, then show you what we've built &mdash; and if it's not a fit, that's completely fine.</p>
    <p>Looking forward to hearing from you.</p>
    <p>
      Dennis<br>
      EduNexus Kenya<br>
      <a href="https://www.edunexus.co.ke">www.edunexus.co.ke</a>
    </p>
  `.trim()
  return { subject, html }
}

async function loadSentLog(): Promise<Set<string>> {
  try {
    const text = await readFile(SENT_LOG_PATH, 'utf-8')
    const rows = parseCsvRecords(text)
    return new Set(rows.filter((r) => r.status === 'sent').map((r) => r.email.toLowerCase()))
  } catch {
    return new Set()
  }
}

async function appendSentLog(entries: string[][]) {
  let existingRecords: Record<string, string>[] = []
  try {
    const text = await readFile(SENT_LOG_PATH, 'utf-8')
    existingRecords = parseCsvRecords(text)
  } catch {
    // no log yet
  }
  const newRecords = entries.map((row) => Object.fromEntries(SENT_LOG_HEADER.map((h, i) => [h, row[i]])))
  const csv = writeCsvTable(SENT_LOG_HEADER, [...existingRecords, ...newRecords])
  await writeFile(SENT_LOG_PATH, csv)
}

async function main() {
  const { list, send, limit } = parseArgs()
  if (!list) {
    console.error('Usage: --list=<path-to-email-list-csv> [--send] [--limit=N]')
    process.exit(1)
  }
  if (send && !API_KEY) {
    console.error('Missing RESEND_API_KEY — cannot --send (dry run works without it).')
    process.exit(1)
  }

  const listText = await readFile(list, 'utf-8')
  const rows = parseCsvRecords(listText) as unknown as Row[]
  const alreadySent = await loadSentLog()
  const pending = rows.filter((r) => r.email && !alreadySent.has(r.email.toLowerCase()))

  console.log(`List: ${rows.length} schools total, ${alreadySent.size} already sent, ${pending.length} pending.`)
  console.log(send ? `MODE: LIVE SEND (limit ${limit === Infinity ? 'none' : limit})` : 'MODE: DRY RUN (no emails sent — pass --send to actually send)')

  const toProcess = pending.slice(0, limit)
  const resend = send ? new Resend(API_KEY) : null
  const logEntries: string[][] = []

  for (const row of toProcess) {
    const { subject, html } = buildEmail(row.name)
    if (!send) {
      console.log(`  [dry-run] would send to ${row.email} (${row.name}, ${row.county}) — subject: "${subject}"`)
      continue
    }
    try {
      const { data, error } = await resend!.emails.send({ from: FROM, to: row.email, subject, html })
      const now = new Date().toISOString()
      if (error) {
        console.log(`  [fail] ${row.email} (${row.name}) — ${error.message}`)
        logEntries.push([row.email, row.name, row.county, now, '', 'failed', error.message])
      } else {
        console.log(`  [sent] ${row.email} (${row.name}) — id ${data?.id ?? ''}`)
        logEntries.push([row.email, row.name, row.county, now, data?.id ?? '', 'sent', ''])
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.log(`  [fail] ${row.email} (${row.name}) — ${message}`)
      logEntries.push([row.email, row.name, row.county, new Date().toISOString(), '', 'failed', message])
    }
    await sleep(400)
  }

  if (send && logEntries.length > 0) {
    await appendSentLog(logEntries)
    console.log(`\nLogged ${logEntries.length} attempt(s) to ${SENT_LOG_PATH}`)
  }
}

main()
