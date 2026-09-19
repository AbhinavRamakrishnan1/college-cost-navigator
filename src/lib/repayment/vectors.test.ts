import { describe, expect, it } from 'vitest'
import vectors from '../../../docs/calculation-test-vectors-v1.0.json'
import { calculateIbrPayment, calculateRapPayment, ibrInterestProtectionCents, loanScenarioSchema, projectRepayment, projectionAssumptionsSchema, rapAnnualBaseCents, tieredStandardTermMonths } from '.'

const cases = vectors.repayment
const loan = (overrides: object = {}, legacy = false) => loanScenarioSchema.parse({ ...(legacy ? cases.legacyDefaults : cases.defaults), ...overrides })
describe('canonical repayment fixture reconciliation', () => {
  it('uses the frozen contract version and validated complete defaults', () => {
    expect(cases.reconciliation.contractVersion).toBe(vectors.version)
    expect(loan().type).toBe('direct_subsidized_undergrad')
    expect(loan({}, true).ibrEnrollmentSnapshot?.cohort).toBe('new')
  })
  it.each(cases.rapAnnualTiers)('RAP annual tier $agiCents cents', c => expect(rapAnnualBaseCents(c.agiCents)).toBe(c.expectedAnnualBaseCents))
  it.each(cases.tieredBoundaries)('Tiered balance $balanceCents cents', c => expect(tieredStandardTermMonths(c.balanceCents)).toBe(c.expectedMonths))
  it.each(cases.rapPayments)('RAP: $name', c => expect(calculateRapPayment(loan(c.overrides))).toMatchObject({ status: 'eligible', monthlyPaymentCents: c.expectedMonthlyPaymentCents }))
  it.each(cases.ibrPayments)('IBR: $name', c => expect(calculateIbrPayment(loan(c.overrides, true))).toMatchObject({ status: 'eligible', monthlyPaymentCents: c.expectedMonthlyPaymentCents }))
  it.each(cases.ibrInterestProtection)('IBR protection: $name', c => expect(ibrInterestProtectionCents(loan(c.overrides, true), c.month, c.unpaidInterestCents, c.accruedThisMonthCents)).toBe(c.expectedCents))
  it('preserves the existing 360-payment RAP protection/match regression', () => {
    const c = cases.rapProjection
    expect(projectRepayment('rap', loan(c.overrides), projectionAssumptionsSchema.parse(c.assumptions))).toMatchObject(c.expected)
  })
})
