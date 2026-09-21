import Decimal from 'decimal.js'
import { annualCostInputSchema, costProjectionInputSchema } from './schema'
import type { AnnualCostInput, CostProjectionInput, CostYearResult, PlanningMoney } from './types'

const valueAmount = (value: PlanningMoney) => value.status === 'unknown' ? null : value.value

export function resolveAnnualCost(input: AnnualCostInput) {
  const cost = annualCostInputSchema.parse(input)
  if (cost.mode === 'total') {
    if (cost.totalCostCents.status === 'unknown') return { status: 'requires_assumption' as const, knownSubtotalCents: 0, reasons: [cost.totalCostCents.reason] }
    return { status: 'complete' as const, amountCents: cost.totalCostCents.value, knownSubtotalCents: cost.totalCostCents.value, reasons: [] }
  }
  const values = Object.values(cost.components)
  const knownSubtotalCents = values.reduce((sum, value) => sum + (valueAmount(value) ?? 0), 0)
  const reasons = values.flatMap((value) => value.status === 'unknown' ? [value.reason] : [])
  return reasons.length > 0
    ? { status: 'requires_assumption' as const, knownSubtotalCents, reasons }
    : { status: 'complete' as const, amountCents: knownSubtotalCents, knownSubtotalCents, reasons: [] }
}

const roundCents = (amount: Decimal) => amount.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()

export function projectAnnualCosts(input: CostProjectionInput): CostYearResult[] {
  const plan = costProjectionInputSchema.parse(input)
  const base = resolveAnnualCost(plan.baseCost)
  return Array.from({ length: plan.horizonYears }, (_, index) => {
    const year = index + 1
    const override = plan.annualOverrides.find((candidate) => candidate.year === year)?.amountCents
    if (override?.status === 'unknown') return { year, status: 'requires_assumption', baseCost: plan.baseCost, growth: plan.growth, growthExponent: index, override, knownComponentSubtotalCents: base.knownSubtotalCents, reasons: [override.reason] }
    if (override) return { year, status: 'complete', baseCost: plan.baseCost, baseAmountCents: base.status === 'complete' ? base.amountCents : undefined, growth: plan.growth, growthExponent: index, override, projectedAmountCents: override.value, knownComponentSubtotalCents: base.knownSubtotalCents, reasons: [] }
    if (base.status !== 'complete') return { year, status: 'requires_assumption', baseCost: plan.baseCost, growth: plan.growth, growthExponent: index, knownComponentSubtotalCents: base.knownSubtotalCents, reasons: base.reasons }
    const multiplier = plan.growth.kind === 'flat' ? new Decimal(1) : new Decimal(1).plus(new Decimal(plan.growth.annualPercent).div(100)).pow(index)
    return { year, status: 'complete', baseCost: plan.baseCost, baseAmountCents: base.amountCents, growth: plan.growth, growthExponent: index, projectedAmountCents: roundCents(new Decimal(base.amountCents).times(multiplier)), knownComponentSubtotalCents: base.knownSubtotalCents, reasons: [] }
  })
}
