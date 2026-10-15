// lib/career/careerEvolution.ts
//
// The Career Evolution lens. Careers evolve — they do not simply die. This
// composes a career's already-dated, already-sourced CareerSignals
// (lib/career/careerSignals.ts) into one honest view of HOW a role is
// changing over time: a chronological trajectory, the kinds of change
// present, how established the direction is, and — only when supplied — the
// durable human core vs the tasks that are shifting to tools.
//
// Honesty guardrail (§16 + ADR-0033): this TRACES documented, dated, sourced
// change and names the DIRECTION a role is moving. It never declares a career
// dead, never fabricates a future, never personalises to a learner. Durable
// and shifting task lists are passed in from a career's existing ai_impact —
// they are never invented here.
//
// Pure, deterministic, DB-free, token-free.

import type {
  CareerSignal,
  CareerSignalType,
  CareerSignalConfidence,
  CareerSignalSource,
  CareerSignalGeography,
} from './careerSignals'
import { getCareerSignalsForCareer } from './careerSignals'
import type { Career } from './types'

const CONFIDENCE_RANK: Record<CareerSignalConfidence, number> = {
  EARLY: 0,
  EMERGING: 1,
  ESTABLISHED: 2,
}

export type CareerEvolutionStage = {
  observedAt:    string
  title:         string
  signalType:    CareerSignalType
  confidence:    CareerSignalConfidence
  geography:     CareerSignalGeography
  whatsChanging: string
  whyItMatters:  string
  sources:       CareerSignalSource[]
}

export type ChangeTypeCount = {
  type:  CareerSignalType
  count: number
}

export type CareerEvolutionView = {
  careerSlug:   string
  signal_count: number
  /** Chronological, oldest → newest — the documented trajectory of the role. */
  trajectory:   CareerEvolutionStage[]
  /** Kinds of change present, most frequent first (ties broken by type name). */
  change_types: ChangeTypeCount[]
  /** The most-established confidence present, or null when there are no signals. */
  strongest_confidence: CareerSignalConfidence | null
  earliest_observed: string | null
  latest_observed:   string | null
  /** The durable human core — passed in from ai_impact, never invented. */
  durable_core:  string[]
  /** Tasks shifting to tools — passed in from ai_impact, never invented. */
  shifting_tasks: string[]
  /** One deterministic sentence: direction, never destiny; never "the job dies". */
  narrative: string
}

export type CareerEvolutionOptions = {
  /** Durable human tasks (from the career's ai_impact.tasks_humans_still_do). */
  durableTasks?:  readonly string[]
  /** Tasks shifting to tools (from the career's ai_impact.tasks_ai_will_automate). */
  shiftingTasks?: readonly string[]
}

const HUMAN_SIGNAL_LABEL: Record<CareerSignalType, string> = {
  EMERGING_SPECIALISATION:           'new specialisations',
  TECHNOLOGY_SHIFT:                  'new technology',
  SKILL_SHIFT:                       'shifting skills',
  INDUSTRY_CONVERGENCE:              'converging industries',
  NEW_WORK_PRACTICE:                 'new ways of working',
  EDUCATION_ROUTE_CHANGE:            'changing education routes',
  PROFESSIONAL_STANDARD_CHANGE:      'changing professional standards',
  REGIONAL_OPPORTUNITY:              'regional opportunities',
  SCIENTIFIC_TECHNICAL_DEVELOPMENT:  'scientific and technical developments',
}

function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

export function buildCareerEvolution(
  careerSlug: string,
  signals: readonly CareerSignal[],
  opts: CareerEvolutionOptions = {},
): CareerEvolutionView {
  const durable_core = [...(opts.durableTasks ?? [])]
  const shifting_tasks = [...(opts.shiftingTasks ?? [])]

  const trajectory: CareerEvolutionStage[] = [...signals]
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
    .map((s) => ({
      observedAt:    s.observedAt,
      title:         s.title,
      signalType:    s.signalType,
      confidence:    s.confidence,
      geography:     s.geography,
      whatsChanging: s.summary,
      whyItMatters:  s.learnerExplanation,
      sources:       s.sources,
    }))

  const typeCounts = new Map<CareerSignalType, number>()
  for (const s of signals) typeCounts.set(s.signalType, (typeCounts.get(s.signalType) ?? 0) + 1)
  const change_types: ChangeTypeCount[] = [...typeCounts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => (b.count - a.count) || a.type.localeCompare(b.type))

  let strongest_confidence: CareerSignalConfidence | null = null
  for (const s of signals) {
    if (strongest_confidence === null || CONFIDENCE_RANK[s.confidence] > CONFIDENCE_RANK[strongest_confidence]) {
      strongest_confidence = s.confidence
    }
  }

  const earliest_observed = trajectory.length ? trajectory[0].observedAt : null
  const latest_observed = trajectory.length ? trajectory[trajectory.length - 1].observedAt : null

  const narrative = buildNarrative(careerSlug, signals.length, change_types, earliest_observed, latest_observed, durable_core, shifting_tasks)

  return {
    careerSlug,
    signal_count: signals.length,
    trajectory,
    change_types,
    strongest_confidence,
    earliest_observed,
    latest_observed,
    durable_core,
    shifting_tasks,
    narrative,
  }
}

function buildNarrative(
  careerSlug: string,
  count: number,
  changeTypes: ChangeTypeCount[],
  earliest: string | null,
  latest: string | null,
  durable: string[],
  shifting: string[],
): string {
  if (count === 0) {
    return `No documented change signals for ${careerSlug} yet — its evolution is not yet traced. Absence of signals is not evidence the role is static.`
  }

  const topLabel = HUMAN_SIGNAL_LABEL[changeTypes[0].type]
  const span = earliest && latest && earliest !== latest ? `, observed between ${earliest} and ${latest}` : ''
  let out = `${count} documented ${count === 1 ? 'signal shows' : 'signals show'} how ${careerSlug} is changing — mostly ${topLabel}${span}. This traces the direction the role is moving; it is not a prediction that the role disappears.`

  if (durable.length > 0 && shifting.length > 0) {
    out += ` The durable human core — ${joinList(durable)} — endures, while ${joinList(shifting)} increasingly shift to tools.`
  } else if (durable.length > 0) {
    out += ` The durable human core — ${joinList(durable)} — endures.`
  } else if (shifting.length > 0) {
    out += ` Some tasks — ${joinList(shifting)} — are increasingly shifting to tools.`
  }
  return out
}

// Career Evolution for the Career Intelligence Report. Planning (Senior) mode
// only — Junior (exploration) and any case without a selected career get null,
// so the Junior experience is untouched. Pure: the signal corpus is in-memory,
// so no DB/AI call and no learner personalization. Durable/shifting task lists
// come only from the career's existing ai_impact fields, never invented. Lives
// here (not in the DB-bound report engine) so it stays importable in pure,
// env-free tests.
export function resolveCareerEvolutionForReport(
  mode: 'exploration' | 'planning',
  topCareerDetail: Career | null,
): CareerEvolutionView | null {
  if (mode !== 'planning' || !topCareerDetail) return null
  return buildCareerEvolution(
    topCareerDetail.slug,
    getCareerSignalsForCareer(topCareerDetail.slug),
    {
      durableTasks:  topCareerDetail.ai_impact.human_advantage,
      shiftingTasks: topCareerDetail.ai_impact.replacing,
    },
  )
}
