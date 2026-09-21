export type KnownProvenance = { source: string; asOf?: string }
export type AssumptionProvenance = { source: string; createdFor: string }

export type PlanningValue<T> =
  | { status: 'known'; value: T; provenance: KnownProvenance }
  | { status: 'assumed'; value: T; explanation: string; provenance: AssumptionProvenance }
  | { status: 'unknown'; reason: string }

export type PlanningMoney = PlanningValue<number>

export type AnnualCostInput =
  | { mode: 'total'; totalCostCents: PlanningMoney }
  | {
      mode: 'components'
      components: {
        tuitionAndRequiredFeesCents: PlanningMoney
        housingAndFoodCents: PlanningMoney
        booksAndSuppliesCents: PlanningMoney
        transportationCents: PlanningMoney
        otherEducationCostsCents: PlanningMoney
      }
    }

export type GrowthAssumption =
  | { kind: 'flat'; explanation: string; provenance: AssumptionProvenance }
  | { kind: 'percentage'; annualPercent: number; explanation: string; provenance: AssumptionProvenance }

export type CostProjectionInput = {
  baseCost: AnnualCostInput
  horizonYears?: number
  growth: GrowthAssumption
  annualOverrides?: Array<{ year: number; amountCents: PlanningMoney }>
}

export type FundingCategory = 'pell' | 'institutional_grant' | 'outside_scholarship' | 'other_grant' | 'family_cash'
export type FundingSchedule =
  | { kind: 'one_time'; year: number; amountCents: PlanningMoney }
  | { kind: 'recurring'; startYear: number; endYear?: number; amountCents: PlanningMoney }
  | { kind: 'custom_yearly'; amounts: Array<{ year: number; amountCents: PlanningMoney }> }

export type NonLoanFundingEntry = {
  id: string
  category: FundingCategory
  label: string
  schedule: FundingSchedule
}

export type CostYearResult = {
  year: number
  status: 'complete' | 'requires_assumption'
  baseCost: AnnualCostInput
  baseAmountCents?: number
  growth: GrowthAssumption
  growthExponent: number
  override?: PlanningMoney
  projectedAmountCents?: number
  knownComponentSubtotalCents?: number
  reasons: string[]
}

export type FundingYearResult = {
  year: number
  status: 'complete' | 'requires_assumption'
  knownFundingCents: number
  applied: Array<{ entryId: string; category: FundingCategory; label: string; amountCents: number; valueStatus: 'known' | 'assumed'; provenance: KnownProvenance | AssumptionProvenance; explanation?: string }>
  unknown: Array<{ entryId: string; category: FundingCategory; label: string; reason: string }>
}

export type AnnualGapResult =
  | { year: number; status: 'complete'; projectedCostCents: number; nonLoanFundingCents: number; signedGapCents: number; remainingPreLoanGapCents: number; excessNonLoanFundingCents: number }
  | { year: number; status: 'requires_assumption'; projectedCostCents?: number; knownNonLoanFundingCents: number; partialKnownGapCents?: number; reasons: string[] }
