import type { Confidence } from './types'

export type EnrichedRowSummary = {
  name: string
  hadEmailBefore: boolean
  hasEmailAfter: boolean
  hadPhoneBefore: boolean
  hasPhoneAfter: boolean
  hasWhatsapp: boolean
  hasFacebook: boolean
  hasPrincipal: boolean
  hasIctContact: boolean
  contactConfidence: Confidence
  contactChannelCount: number
}

export type EnrichmentReport = {
  schoolsProcessed: number
  schoolsEnriched: number
  emailsAdded: number
  phonesAdded: number
  whatsappFound: number
  facebookFound: number
  principalsFound: number
  ictContactsFound: number
  manualReviewRequired: number
  zeroContactMethods: number
  beforeEmailCount: number
  afterEmailCount: number
  beforePhoneCount: number
  afterPhoneCount: number
  top50: EnrichedRowSummary[]
  zeroContactSchools: string[]
}

const CONFIDENCE_RANK: Record<Confidence, number> = { Verified: 0, High: 1, Medium: 2, Low: 3, Unknown: 4 }

/** Computed purely from per-row before/after facts — no network, no side effects, so this is directly unit-testable. */
export function buildEnrichmentReport(rows: EnrichedRowSummary[]): EnrichmentReport {
  let schoolsEnriched = 0
  let emailsAdded = 0
  let phonesAdded = 0
  let whatsappFound = 0
  let facebookFound = 0
  let principalsFound = 0
  let ictContactsFound = 0
  let manualReviewRequired = 0
  let zeroContactMethods = 0
  let beforeEmailCount = 0
  let afterEmailCount = 0
  let beforePhoneCount = 0
  let afterPhoneCount = 0
  const zeroContactSchools: string[] = []

  for (const r of rows) {
    const emailGained = !r.hadEmailBefore && r.hasEmailAfter
    const phoneGained = !r.hadPhoneBefore && r.hasPhoneAfter
    if (emailGained) emailsAdded += 1
    if (phoneGained) phonesAdded += 1
    if (r.hasWhatsapp) whatsappFound += 1
    if (r.hasFacebook) facebookFound += 1
    if (r.hasPrincipal) principalsFound += 1
    if (r.hasIctContact) ictContactsFound += 1
    if (emailGained || phoneGained || r.hasWhatsapp || r.hasFacebook || r.hasPrincipal || r.hasIctContact) schoolsEnriched += 1

    if (r.hadEmailBefore) beforeEmailCount += 1
    if (r.hasEmailAfter) afterEmailCount += 1
    if (r.hadPhoneBefore) beforePhoneCount += 1
    if (r.hasPhoneAfter) afterPhoneCount += 1

    const hasAnyContact = r.hasEmailAfter || r.hasPhoneAfter || r.hasWhatsapp
    if (!hasAnyContact) {
      zeroContactMethods += 1
      zeroContactSchools.push(r.name)
    } else if (r.contactConfidence === 'Low' || r.contactConfidence === 'Unknown') {
      manualReviewRequired += 1
    }
  }

  const top50 = [...rows]
    .sort((a, b) => b.contactChannelCount - a.contactChannelCount || CONFIDENCE_RANK[a.contactConfidence] - CONFIDENCE_RANK[b.contactConfidence])
    .slice(0, 50)

  return {
    schoolsProcessed: rows.length,
    schoolsEnriched,
    emailsAdded,
    phonesAdded,
    whatsappFound,
    facebookFound,
    principalsFound,
    ictContactsFound,
    manualReviewRequired,
    zeroContactMethods,
    beforeEmailCount,
    afterEmailCount,
    beforePhoneCount,
    afterPhoneCount,
    top50,
    zeroContactSchools,
  }
}

export function formatEnrichmentReport(report: EnrichmentReport, csvPath?: string): string {
  const lines: string[] = []
  lines.push('# Contact Enrichment Report')
  lines.push('')
  lines.push(`Schools processed: ${report.schoolsProcessed}`)
  lines.push(`Schools enriched (gained at least one new contact fact): ${report.schoolsEnriched}`)
  lines.push(`Emails added: ${report.emailsAdded}`)
  lines.push(`Phones added: ${report.phonesAdded}`)
  lines.push(`WhatsApp numbers found: ${report.whatsappFound}`)
  lines.push(`Facebook pages found: ${report.facebookFound}`)
  lines.push(`Principal names found: ${report.principalsFound}`)
  lines.push(`ICT contacts found: ${report.ictContactsFound}`)
  lines.push(`Manual review required (some contact info, but low/unknown confidence): ${report.manualReviewRequired}`)
  lines.push(`Still missing all contact methods: ${report.zeroContactMethods}`)
  if (csvPath) lines.push(`CSV path: ${csvPath}`)

  lines.push('', '## Before vs After')
  lines.push(`Email coverage: ${report.beforeEmailCount}/${report.schoolsProcessed} -> ${report.afterEmailCount}/${report.schoolsProcessed}`)
  lines.push(`Phone coverage: ${report.beforePhoneCount}/${report.schoolsProcessed} -> ${report.afterPhoneCount}/${report.schoolsProcessed}`)

  lines.push('', '## Top 50 Most Contactable Schools')
  lines.push('| School | Channels | Confidence |')
  lines.push('|---|---|---|')
  for (const r of report.top50) {
    lines.push(`| ${r.name} | ${r.contactChannelCount} | ${r.contactConfidence} |`)
  }

  if (report.zeroContactSchools.length > 0) {
    lines.push('', '## Schools With Zero Usable Contact Methods')
    for (const name of report.zeroContactSchools) lines.push(`- ${name}`)
  }

  return lines.join('\n')
}
