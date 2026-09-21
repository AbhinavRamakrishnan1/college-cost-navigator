import { fundingPlanInputSchema } from './schema'
import { projectAnnualCosts } from './costs'
import { applyNonLoanFunding } from './nonLoanFunding'
import type { AnnualGapResult, CostProjectionInput, NonLoanFundingEntry } from './types'

export type FundingPlanInput = { costProjection: CostProjectionInput; nonLoanFunding: NonLoanFundingEntry[] }

export function calculatePreLoanFundingPlan(input: FundingPlanInput) {
  const parsed = fundingPlanInputSchema.parse(input)
  const costs = projectAnnualCosts(parsed.costProjection)
  const funding = applyNonLoanFunding(parsed.nonLoanFunding, parsed.costProjection.horizonYears)
  const annual: AnnualGapResult[] = costs.map((cost, index) => {
    const support = funding[index]
    const reasons = [...cost.reasons, ...support.unknown.map((item) => `${item.label}: ${item.reason}`)]
    if (cost.status !== 'complete' || support.status !== 'complete') return { year: cost.year, status: 'requires_assumption', ...(cost.projectedAmountCents !== undefined ? { projectedCostCents: cost.projectedAmountCents, partialKnownGapCents: cost.projectedAmountCents - support.knownFundingCents } : {}), knownNonLoanFundingCents: support.knownFundingCents, reasons }
    const signedGapCents = cost.projectedAmountCents! - support.knownFundingCents
    return { year: cost.year, status: 'complete', projectedCostCents: cost.projectedAmountCents!, nonLoanFundingCents: support.knownFundingCents, signedGapCents, remainingPreLoanGapCents: Math.max(0, signedGapCents), excessNonLoanFundingCents: Math.max(0, -signedGapCents) }
  })
  return { status: annual.some((year) => year.status !== 'complete') ? 'requires_assumption' as const : 'complete' as const, costs, funding, annual }
}

