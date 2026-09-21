import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  annualCostInputSchema,
  applyNonLoanFunding,
  calculatePreLoanFundingPlan,
  costProjectionInputSchema,
  planningMoneySchema,
  projectAnnualCosts,
  resolveAnnualCost,
  type AnnualCostInput,
  type NonLoanFundingEntry,
  type PlanningMoney,
} from '.'

const known = (value: number, source = 'Published school cost'): PlanningMoney => ({ status: 'known', value, provenance: { source, asOf: '2026-09-21' } })
const assumed = (value: number, explanation = 'Planning assumption'): PlanningMoney => ({ status: 'assumed', value, explanation, provenance: { source: 'User planning input', createdFor: 'Four-year funding plan' } })
const unknown = (reason = 'Amount has not been established'): PlanningMoney => ({ status: 'unknown', reason })
const total = (amount: PlanningMoney = known(3_000_000)): AnnualCostInput => ({ mode: 'total', totalCostCents: amount })
const flat = { kind: 'flat' as const, explanation: 'Hold the entered base cost flat', provenance: { source: 'User planning input', createdFor: 'Four-year funding plan' } }
const growth = (annualPercent: number) => ({ kind: 'percentage' as const, annualPercent, explanation: 'User-selected annual cost growth', provenance: { source: 'User planning input', createdFor: 'Four-year funding plan' } })
const entry = (overrides: Partial<NonLoanFundingEntry> = {}): NonLoanFundingEntry => ({ id: 'pell-y1', category: 'pell', label: 'Pell Scheduled Award estimate', schedule: { kind: 'one_time', year: 1, amountCents: known(532_500, 'Verified 2026-27 aid calculation') }, ...overrides })

describe('annual cost model and projection', () => {
  it('supports total mode, including zero cost', () => {
    expect(resolveAnnualCost(total())).toMatchObject({ status: 'complete', amountCents: 3_000_000 })
    expect(resolveAnnualCost(total(known(0)))).toMatchObject({ status: 'complete', amountCents: 0 })
  })

  it('supports component mode without adding a separate total', () => {
    const input: AnnualCostInput = { mode: 'components', components: { tuitionAndRequiredFeesCents: known(2_000_000), housingAndFoodCents: known(1_000_000), booksAndSuppliesCents: assumed(100_000), transportationCents: known(50_000), otherEducationCostsCents: known(25_000) } }
    expect(resolveAnnualCost(input)).toMatchObject({ status: 'complete', amountCents: 3_175_000 })
  })

  it('rejects total-plus-components ambiguity and negative costs', () => {
    expect(annualCostInputSchema.safeParse({ mode: 'total', totalCostCents: known(100), components: {} }).success).toBe(false)
    expect(planningMoneySchema.safeParse(known(-1)).success).toBe(false)
  })

  it('projects a flat default four-year horizon', () => {
    const projected = projectAnnualCosts({ baseCost: total(), growth: flat })
    expect(projected).toHaveLength(4)
    expect(projected.map((year) => year.projectedAmountCents)).toEqual([3_000_000, 3_000_000, 3_000_000, 3_000_000])
  })

  it('projects percentage growth from the original base and exponent', () => {
    const projected = projectAnnualCosts({ baseCost: total(known(1_000_000)), growth: growth(5) })
    expect(projected.map((year) => year.projectedAmountCents)).toEqual([1_000_000, 1_050_000, 1_102_500, 1_157_625])
    expect(projected.map((year) => year.growthExponent)).toEqual([0, 1, 2, 3])
  })

  it('supports five years and an explicit annual override', () => {
    const projected = projectAnnualCosts({ baseCost: total(known(1_000_000)), horizonYears: 5, growth: growth(10), annualOverrides: [{ year: 3, amountCents: assumed(900_000, 'School-specific year-three override') }] })
    expect(projected).toHaveLength(5)
    expect(projected.map((year) => year.projectedAmountCents)).toEqual([1_000_000, 1_100_000, 900_000, 1_331_000, 1_464_100])
    expect(projected[2].override).toMatchObject({ status: 'assumed', explanation: 'School-specific year-three override' })
  })

  it('avoids recursive displayed-cent rounding drift', () => {
    expect(projectAnnualCosts({ baseCost: total(known(1)), growth: growth(50) }).map((year) => year.projectedAmountCents)).toEqual([1, 2, 2, 3])
  })

  it('keeps unknown cost components unknown while exposing a safe subtotal', () => {
    const input: AnnualCostInput = { mode: 'components', components: { tuitionAndRequiredFeesCents: known(2_000_000), housingAndFoodCents: unknown('Housing choice is unknown'), booksAndSuppliesCents: known(100_000), transportationCents: known(50_000), otherEducationCostsCents: known(25_000) } }
    expect(resolveAnnualCost(input)).toEqual({ status: 'requires_assumption', knownSubtotalCents: 2_175_000, reasons: ['Housing choice is unknown'] })
  })

  it('rejects duplicate or out-of-horizon overrides', () => {
    expect(costProjectionInputSchema.safeParse({ baseCost: total(), horizonYears: 4, growth: flat, annualOverrides: [{ year: 2, amountCents: known(1) }, { year: 2, amountCents: known(2) }] }).success).toBe(false)
    expect(costProjectionInputSchema.safeParse({ baseCost: total(), horizonYears: 4, growth: flat, annualOverrides: [{ year: 5, amountCents: known(1) }] }).success).toBe(false)
  })
})

describe('non-loan funding schedules and provenance', () => {
  it('preserves known Pell provenance and does not recalculate Pell', () => {
    const result = applyNonLoanFunding([entry()], 4)
    expect(result[0]).toMatchObject({ status: 'complete', knownFundingCents: 532_500, applied: [{ category: 'pell', valueStatus: 'known', provenance: { source: 'Verified 2026-27 aid calculation' } }] })
    expect(result.slice(1).map((year) => year.knownFundingCents)).toEqual([0, 0, 0])
  })

  it('keeps assumed future Pell distinct from known current Pell', () => {
    const future = entry({ id: 'pell-future', schedule: { kind: 'custom_yearly', amounts: [{ year: 1, amountCents: known(532_500, 'Verified 2026-27 aid calculation') }, { year: 2, amountCents: assumed(500_000, 'User assumes a future Pell amount') }] } })
    expect(applyNonLoanFunding([future], 2)[1].applied[0]).toMatchObject({ valueStatus: 'assumed', explanation: 'User assumes a future Pell amount', provenance: { source: 'User planning input' } })
  })

  it('does not turn unknown future Pell into zero', () => {
    const future = entry({ id: 'pell-future', schedule: { kind: 'custom_yearly', amounts: [{ year: 1, amountCents: known(532_500) }, { year: 2, amountCents: unknown('Future Pell is unknown') }] } })
    expect(applyNonLoanFunding([future], 2)[1]).toMatchObject({ status: 'requires_assumption', knownFundingCents: 0, unknown: [{ reason: 'Future Pell is unknown' }] })
  })

  it('supports one-time, recurring, and custom annual grants', () => {
    const entries: NonLoanFundingEntry[] = [
      entry({ id: 'institutional', category: 'institutional_grant', label: 'Institutional grant', schedule: { kind: 'recurring', startYear: 1, endYear: 3, amountCents: assumed(200_000, 'Assumed renewable grant') } }),
      entry({ id: 'other', category: 'other_grant', label: 'Other grant', schedule: { kind: 'one_time', year: 2, amountCents: known(100_000) } }),
      entry({ id: 'custom', category: 'other_grant', label: 'Custom grant', schedule: { kind: 'custom_yearly', amounts: [{ year: 1, amountCents: known(50_000) }, { year: 3, amountCents: known(75_000) }] } }),
    ]
    expect(applyNonLoanFunding(entries, 4).map((year) => year.knownFundingCents)).toEqual([250_000, 300_000, 275_000, 0])
  })

  it('supports outside scholarships and explicit family cash without inferring either from SAI', () => {
    const entries: NonLoanFundingEntry[] = [
      entry({ id: 'scholarship', category: 'outside_scholarship', label: 'Outside scholarship', schedule: { kind: 'one_time', year: 1, amountCents: known(150_000) } }),
      entry({ id: 'cash', category: 'family_cash', label: 'Planned family cash', schedule: { kind: 'recurring', startYear: 1, amountCents: assumed(300_000, 'Family-selected cash budget') } }),
    ]
    expect(applyNonLoanFunding(entries, 2).map((year) => year.knownFundingCents)).toEqual([450_000, 300_000])
  })

  it('never automatically reduces Pell because of another award', () => {
    const entries = [entry(), entry({ id: 'scholarship', category: 'outside_scholarship', label: 'Scholarship', schedule: { kind: 'one_time', year: 1, amountCents: known(100_000) } })]
    expect(applyNonLoanFunding(entries, 1)[0]).toMatchObject({ knownFundingCents: 632_500, applied: [{ amountCents: 532_500 }, { amountCents: 100_000 }] })
  })

  it('rejects negative grants, scholarships, and family cash', () => {
    for (const category of ['institutional_grant', 'outside_scholarship', 'other_grant', 'family_cash'] as const) {
      expect(() => applyNonLoanFunding([entry({ id: category, category, schedule: { kind: 'one_time', year: 1, amountCents: known(-1) } })], 1)).toThrow()
    }
  })
})

describe('pre-loan funding gap', () => {
  it('computes a complete positive annual gap from grants, scholarship, and family cash', () => {
    const result = calculatePreLoanFundingPlan({ costProjection: { baseCost: total(known(3_000_000)), horizonYears: 1, growth: flat }, nonLoanFunding: [entry(), entry({ id: 'grant', category: 'institutional_grant', label: 'Institutional grant', schedule: { kind: 'one_time', year: 1, amountCents: known(500_000) } }), entry({ id: 'scholarship', category: 'outside_scholarship', label: 'Scholarship', schedule: { kind: 'one_time', year: 1, amountCents: known(200_000) } }), entry({ id: 'cash', category: 'family_cash', label: 'Family cash', schedule: { kind: 'one_time', year: 1, amountCents: assumed(300_000) } })] })
    expect(result.annual[0]).toEqual({ year: 1, status: 'complete', projectedCostCents: 3_000_000, nonLoanFundingCents: 1_532_500, signedGapCents: 1_467_500, remainingPreLoanGapCents: 1_467_500, excessNonLoanFundingCents: 0 })
  })

  it('represents zero gap and excess funding without hiding signed information', () => {
    const zero = calculatePreLoanFundingPlan({ costProjection: { baseCost: total(known(100_000)), horizonYears: 1, growth: flat }, nonLoanFunding: [entry({ schedule: { kind: 'one_time', year: 1, amountCents: known(100_000) } })] })
    expect(zero.annual[0]).toMatchObject({ signedGapCents: 0, remainingPreLoanGapCents: 0, excessNonLoanFundingCents: 0 })
    const excess = calculatePreLoanFundingPlan({ costProjection: { baseCost: total(known(100_000)), horizonYears: 1, growth: flat }, nonLoanFunding: [entry({ schedule: { kind: 'one_time', year: 1, amountCents: known(125_000) } })] })
    expect(excess.annual[0]).toMatchObject({ signedGapCents: -25_000, remainingPreLoanGapCents: 0, excessNonLoanFundingCents: 25_000 })
  })

  it('blocks a definitive gap for unknown funding while preserving a safe partial result', () => {
    const result = calculatePreLoanFundingPlan({ costProjection: { baseCost: total(known(1_000_000)), horizonYears: 1, growth: flat }, nonLoanFunding: [entry({ schedule: { kind: 'one_time', year: 1, amountCents: known(200_000) } }), entry({ id: 'unknown-grant', category: 'institutional_grant', label: 'Institutional grant', schedule: { kind: 'one_time', year: 1, amountCents: unknown('Award not received') } })] })
    expect(result).toMatchObject({ status: 'requires_assumption', annual: [{ status: 'requires_assumption', projectedCostCents: 1_000_000, knownNonLoanFundingCents: 200_000, partialKnownGapCents: 800_000, reasons: ['Institutional grant: Award not received'] }] })
  })
})

describe('pure architecture boundaries', () => {
  it('contains no networking, browser storage, database, or analytics calls', () => {
    const directory = resolve('src/lib/funding')
    const source = readdirSync(directory).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts')).map((file) => readFileSync(resolve(directory, file), 'utf8')).join('\n')
    for (const forbidden of ['fetch(', 'XMLHttpRequest', 'indexedDB', 'localStorage', 'sessionStorage', 'navigator.sendBeacon', 'analytics']) expect(source).not.toContain(forbidden)
  })

  it('does not mutate policy or Scorecard data while calculating', () => {
    const files = ['src/data/policy/direct-loan-origination-limits-2026-07-01.v1.json', 'src/data/scorecard/production-metadata.json']
    const digest = () => files.map((file) => createHash('sha256').update(readFileSync(file)).digest('hex'))
    const before = digest()
    calculatePreLoanFundingPlan({ costProjection: { baseCost: total(), growth: flat }, nonLoanFunding: [entry()] })
    expect(digest()).toEqual(before)
  })
})
