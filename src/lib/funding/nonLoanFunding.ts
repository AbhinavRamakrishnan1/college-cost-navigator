import { nonLoanFundingEntrySchema } from './schema'
import type { FundingYearResult, NonLoanFundingEntry, PlanningMoney } from './types'

function amountForYear(entry: NonLoanFundingEntry, year: number): PlanningMoney | null {
  if (entry.schedule.kind === 'one_time') return entry.schedule.year === year ? entry.schedule.amountCents : null
  if (entry.schedule.kind === 'recurring') return year >= entry.schedule.startYear && year <= (entry.schedule.endYear ?? 5) ? entry.schedule.amountCents : null
  return entry.schedule.amounts.find((amount) => amount.year === year)?.amountCents ?? null
}

export function applyNonLoanFunding(entriesInput: NonLoanFundingEntry[], horizonYears: number): FundingYearResult[] {
  const entries = entriesInput.map((entry) => nonLoanFundingEntrySchema.parse(entry))
  return Array.from({ length: horizonYears }, (_, index) => {
    const year = index + 1
    const applied: FundingYearResult['applied'] = []
    const unknown: FundingYearResult['unknown'] = []
    for (const entry of entries) {
      const amount = amountForYear(entry, year)
      if (amount === null) continue
      if (amount.status === 'unknown') unknown.push({ entryId: entry.id, category: entry.category, label: entry.label, reason: amount.reason })
      else applied.push({ entryId: entry.id, category: entry.category, label: entry.label, amountCents: amount.value, valueStatus: amount.status, provenance: amount.provenance, ...(amount.status === 'assumed' ? { explanation: amount.explanation } : {}) })
    }
    return { year, status: unknown.length > 0 ? 'requires_assumption' : 'complete', knownFundingCents: applied.reduce((sum, item) => sum + item.amountCents, 0), applied, unknown }
  })
}

