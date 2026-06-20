// lib/career/lifeSimulator.ts
// Phase 5: Life Simulation Engine — deterministic age 18–35 financial preview per career.
import type { Career, LifeSimulation, LifeSimulationYear, CareerPhaseLabel } from './types'
import { COS_DISCLAIMER } from './types'

const START_AGE = 18
const END_AGE   = 35

export function buildLifeSimulation(career: Career): LifeSimulation | null {
  if (!career.salary_range_kes || !career.time_to_income_years) return null

  const { entry, mid, senior } = career.salary_range_kes
  const entryMonthly  = Math.round((entry.min  + entry.max)  / 2)
  const midMonthly    = Math.round((mid.min    + mid.max)    / 2)
  const seniorMonthly = Math.round((senior.min + senior.max) / 2)

  const timeToIncome   = career.time_to_income_years
  const incomeStartAge = START_AGE + timeToIncome

  const totalEduCost = career.cost_to_qualify
    ? Math.round((career.cost_to_qualify.min + career.cost_to_qualify.max) / 2)
    : fallbackEduCost(timeToIncome, career.difficulty)

  const annualCostDuringStudy = timeToIncome > 0
    ? Math.round(totalEduCost / timeToIncome)
    : 0

  const simulation: LifeSimulationYear[] = []
  let cumulative    = 0
  let breakevenAge: number | null = null

  for (let age = START_AGE; age <= END_AGE; age++) {
    const yearOffset       = age - START_AGE
    const yearsAfterIncome = age - incomeStartAge

    let phase: CareerPhaseLabel
    let monthlyIncome: number
    let annualCost: number

    if (age < incomeStartAge) {
      phase         = 'studying'
      monthlyIncome = 0
      annualCost    = annualCostDuringStudy
    } else if (yearsAfterIncome < 3) {
      phase         = 'entry'
      monthlyIncome = entryMonthly
      annualCost    = 0
    } else if (yearsAfterIncome < 8) {
      phase         = 'mid'
      monthlyIncome = midMonthly
      annualCost    = 0
    } else {
      phase         = 'senior'
      monthlyIncome = seniorMonthly
      annualCost    = 0
    }

    const netThisYear  = monthlyIncome * 12 - annualCost
    const prevCumul    = cumulative
    cumulative        += netThisYear

    if (breakevenAge === null && prevCumul < 0 && cumulative >= 0) {
      breakevenAge = age
    }

    simulation.push({
      age,
      year_offset:        yearOffset,
      phase,
      monthly_income_kes: monthlyIncome,
      annual_cost_kes:    annualCost,
      net_this_year_kes:  netThisYear,
      cumulative_net_kes: cumulative,
      ...buildMilestone(phase, yearsAfterIncome, age, career.title),
    })
  }

  return {
    career_slug:              career.slug,
    career_title:             career.title,
    education_start_age:      START_AGE,
    income_start_age:         incomeStartAge,
    breakeven_age:            breakevenAge,
    total_education_cost_kes: totalEduCost,
    peak_monthly_kes:         seniorMonthly,
    entry_monthly_kes:        entryMonthly,
    mid_monthly_kes:          midMonthly,
    senior_monthly_kes:       seniorMonthly,
    simulation,
    disclaimer: COS_DISCLAIMER,
  }
}

function fallbackEduCost(years: number, difficulty?: string): number {
  const perYear =
    difficulty === 'very_hard' ? 180_000 :
    difficulty === 'hard'      ? 120_000 :
    difficulty === 'moderate'  ?  90_000 :
    70_000
  return perYear * years
}

function buildMilestone(
  phase: CareerPhaseLabel,
  yearsAfterIncome: number,
  age: number,
  title: string
): { milestone?: string } {
  if (phase === 'studying' && age === START_AGE)     return { milestone: 'Begin training / university' }
  if (phase === 'entry'    && yearsAfterIncome === 0) return { milestone: `First ${title} role` }
  if (phase === 'mid'      && yearsAfterIncome === 3) return { milestone: 'Mid-career transition' }
  if (phase === 'senior'   && yearsAfterIncome === 8) return { milestone: 'Senior level reached' }
  return {}
}
