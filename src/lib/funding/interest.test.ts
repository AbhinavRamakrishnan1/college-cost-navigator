import Decimal from 'decimal.js'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildLoanLedgerEntry, calculateGraduationDebt, elapsedInterestDays, type GraduationDebtInput, type LoanLedgerEntry, type LoanKind } from '.'

function loan(loanId: string, loanType: LoanKind, borrowerId: string, disbursements: Array<{ date: string; grossPrincipalCents: number }>): LoanLedgerEntry {
  const built = buildLoanLedgerEntry({ loanId, borrowerId, borrowerRole: loanType === 'parent_plus' ? 'parent' : 'student', studentBeneficiaryId: 'student-1', loanType, academicYear: '2026-27', schedule: { disbursements } })
  if ('status' in built) throw new Error(built.reasons.join(' '))
  return built
}
const base = (ledger: LoanLedgerEntry[], overrides: Partial<GraduationDebtInput> = {}): GraduationDebtInput => ({ ledger, graduationDate: '2028-05-15', subsidyEnrollment: { status: 'qualifying_in_school', explanation: 'Full-time qualifying undergraduate enrollment through the planning end date' }, inSchoolPayments: { status: 'none_assumed', explanation: 'No voluntary in-school payments are modeled', source: 'Planner assumption' }, futureRateResolutions: [], ...overrides })
const interest = (principal: number, percent: number, days: number) => new Decimal(principal).times(new Decimal(percent).div(100)).times(days).div('365.25').toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()

describe('rate selection and provenance', () => {
  it('uses the known federal cohort selected by first disbursement', () => {
    const result = calculateGraduationDebt(base([loan('u1', 'direct_unsubsidized', 'student-1', [{ date: '2026-08-15', grossPrincipalCents: 100_000 }])]))
    expect(result).toMatchObject({ status: 'complete', loans: [{ rate: { status: 'known', annualRatePercent: 6.52, provenance: { source: 'federal-direct-loan-rates-2026-27' } } }] })
  })
  it('keeps the first-disbursement cohort when a later installment crosses the cohort boundary', () => {
    const result = calculateGraduationDebt(base([loan('u1', 'direct_unsubsidized', 'student-1', [{ date: '2027-06-30', grossPrincipalCents: 100_000 }, { date: '2027-07-01', grossPrincipalCents: 100_000 }])]))
    expect(result).toMatchObject({ status: 'complete', loans: [{ rate: { annualRatePercent: 6.52 } }] })
  })
  it('keeps principal visible but requires an assumption for an unknown future cohort', () => {
    const future = loan('future', 'direct_unsubsidized', 'student-1', [{ date: '2027-08-15', grossPrincipalCents: 100_000 }])
    expect(calculateGraduationDebt(base([future]))).toMatchObject({ status: 'requires_assumption', loans: [{ status: 'incomplete', principalCents: 100_000, rate: { status: 'unknown' } }], summaries: { student: { principalCents: 100_000, status: 'incomplete' } } })
  })
  it('accepts and preserves an explicit assumed future rate', () => {
    const future = loan('future', 'direct_unsubsidized', 'student-1', [{ date: '2027-08-15', grossPrincipalCents: 100_000 }])
    const rate = { status: 'assumed' as const, annualRatePercent: 7.25, explanation: 'User-selected planning rate', provenance: { source: 'User assumption', createdFor: 'Graduation debt plan' } }
    expect(calculateGraduationDebt(base([future], { futureRateResolutions: [{ loanId: 'future', rate }] }))).toMatchObject({ status: 'complete', loans: [{ rate }] })
  })
  it('preserves known future-rate provenance separately from assumptions', () => {
    const future = loan('future', 'parent_plus', 'parent-a', [{ date: '2027-08-15', grossPrincipalCents: 100_000 }])
    const rate = { status: 'known' as const, annualRatePercent: 9.1, provenance: { source: 'School-confirmed cohort notice', asOf: '2027-07-01' } }
    expect(calculateGraduationDebt(base([future], { futureRateResolutions: [{ loanId: 'future', rate }] }))).toMatchObject({ status: 'complete', loans: [{ rate }] })
  })
})

describe('subsidized in-school treatment', () => {
  it('sets qualifying in-school borrower interest to zero and preserves principal', () => {
    expect(calculateGraduationDebt(base([loan('s1', 'direct_subsidized', 'student-1', [{ date: '2026-08-15', grossPrincipalCents: 350_000 }])]))).toMatchObject({ status: 'complete', loans: [{ principalCents: 350_000, accruedInterestCents: 0, informationalPrincipalPlusInterestCents: 350_000 }] })
  })
  it('fails the subsidized result closed for unresolved or unsupported enrollment facts', () => {
    const ledger = [loan('s1', 'direct_subsidized', 'student-1', [{ date: '2026-08-15', grossPrincipalCents: 350_000 }])]
    expect(calculateGraduationDebt(base(ledger, { subsidyEnrollment: { status: 'unresolved', reason: 'Enrollment treatment is not confirmed' } }))).toMatchObject({ status: 'requires_assumption', loans: [{ status: 'incomplete' }] })
    expect(calculateGraduationDebt(base(ledger, { subsidyEnrollment: { status: 'unsupported', reason: 'Enrollment pattern is outside scope' } }))).toMatchObject({ status: 'unsupported', loans: [{ status: 'unsupported' }] })
  })
})

describe('unsubsidized and Parent PLUS simple interest', () => {
  it('calculates one disbursement without daily rounding or compounding', () => {
    const l = loan('u1', 'direct_unsubsidized', 'student-1', [{ date: '2026-08-15', grossPrincipalCents: 200_000 }])
    const days = elapsedInterestDays('2026-08-15', '2028-05-15')
    expect(calculateGraduationDebt(base([l])).loans[0]).toMatchObject({ accruedInterestCents: interest(200_000, 6.52, days), principalCents: 200_000 })
  })
  it('calculates multiple disbursements over their different elapsed periods', () => {
    const l = loan('u1', 'direct_unsubsidized', 'student-1', [{ date: '2026-08-15', grossPrincipalCents: 300_000 }, { date: '2027-01-10', grossPrincipalCents: 300_000 }])
    const expected = new Decimal(300_000).times(.0652).times(elapsedInterestDays('2026-08-15', '2028-05-15')).div('365.25').plus(new Decimal(300_000).times(.0652).times(elapsedInterestDays('2027-01-10', '2028-05-15')).div('365.25')).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()
    expect(calculateGraduationDebt(base([l])).loans[0]).toMatchObject({ principalCents: 600_000, accruedInterestCents: expected, informationalPrincipalPlusInterestCents: 600_000 + expected })
  })
  it('does not charge interest on accrued interest or mutate principal', () => {
    const l = loan('u1', 'direct_unsubsidized', 'student-1', [{ date: '2026-08-15', grossPrincipalCents: 100_000 }])
    const result = calculateGraduationDebt(base([l]))
    expect(result).toMatchObject({ capitalizationApplied: false, loans: [{ principalCents: 100_000 }] })
    expect(l.grossPrincipalCents).toBe(100_000)
  })
  it('accrues Parent PLUS from disbursement and preserves parent ownership without grace-period accrual', () => {
    const result = calculateGraduationDebt(base([loan('p1', 'parent_plus', 'parent-a', [{ date: '2026-08-15', grossPrincipalCents: 500_000 }])]))
    expect(result).toMatchObject({ status: 'complete', parentPlusGracePeriodIncluded: false, loans: [{ borrowerId: 'parent-a', borrowerRole: 'parent', rate: { annualRatePercent: 9.07 } }], inSchoolPaymentAssumption: { status: 'none_assumed' } })
  })
  it('keeps multiple parent borrowers separate', () => {
    const result = calculateGraduationDebt(base([loan('p1', 'parent_plus', 'parent-a', [{ date: '2026-08-15', grossPrincipalCents: 100_000 }]), loan('p2', 'parent_plus', 'parent-b', [{ date: '2026-08-15', grossPrincipalCents: 200_000 }])]))
    expect(result.summaries?.parents.map((parent) => [parent.borrowerId, parent.principalCents])).toEqual([['parent-a', 100_000], ['parent-b', 200_000]])
  })
})

describe('UTC-safe date interval and graduation validation', () => {
  it('excludes the disbursement date and includes the graduation date', () => {
    expect(elapsedInterestDays('2026-01-01', '2026-01-01')).toBe(0)
    expect(elapsedInterestDays('2026-01-01', '2026-01-02')).toBe(1)
  })
  it('handles a leap-year interval deterministically with a 365.25 divisor', () => {
    expect(elapsedInterestDays('2027-03-01', '2028-03-01')).toBe(366)
  })
  it('rejects graduation before any disbursement while retaining principal', () => {
    const result = calculateGraduationDebt(base([loan('u1', 'direct_unsubsidized', 'student-1', [{ date: '2026-08-15', grossPrincipalCents: 100_000 }])], { graduationDate: '2026-08-14' }))
    expect(result).toMatchObject({ status: 'requires_assumption', loans: [{ status: 'incomplete', principalCents: 100_000, reason: 'Graduation date precedes a loan disbursement.' }] })
  })
  it('rejects malformed graduation dates', () => {
    expect(calculateGraduationDebt(base([], { graduationDate: 'not-a-date' }))).toMatchObject({ status: 'incomplete', knownPrincipalCents: 0 })
  })
})

describe('graduation snapshot and borrower-separated totals', () => {
  it('keeps principal and accrued interest separate and labels the scope', () => {
    const result = calculateGraduationDebt(base([loan('u1', 'direct_unsubsidized', 'student-1', [{ date: '2026-08-15', grossPrincipalCents: 100_000 }])]))
    expect(result).toMatchObject({ scopeLabel: 'Projected new debt from this plan at graduation', capitalizationApplied: false, loans: [{ principalCents: 100_000 }], summaries: { student: { principalCents: 100_000, accruedInterestCents: expect.any(Number), informationalPrincipalPlusInterestCents: expect.any(Number) } } })
  })
  it('separates subsidized, unsubsidized, student, parent, and household-associated totals', () => {
    const result = calculateGraduationDebt(base([loan('s1', 'direct_subsidized', 'student-1', [{ date: '2026-08-15', grossPrincipalCents: 100_000 }]), loan('u1', 'direct_unsubsidized', 'student-1', [{ date: '2026-08-15', grossPrincipalCents: 200_000 }]), loan('p1', 'parent_plus', 'parent-a', [{ date: '2026-08-15', grossPrincipalCents: 300_000 }])]))
    expect(result).toMatchObject({ summaries: { student: { subsidizedPrincipalCents: 100_000, unsubsidizedPrincipalCents: 200_000, principalCents: 300_000 }, parents: [{ borrowerId: 'parent-a', principalCents: 300_000 }], allParents: { principalCents: 300_000 }, combinedHouseholdAssociatedBorrowing: { principalCents: 600_000 } } })
  })
  it('keeps multiple student cohorts and rates distinct', () => {
    const first = loan('u1', 'direct_unsubsidized', 'student-1', [{ date: '2026-08-15', grossPrincipalCents: 100_000 }])
    const future = loan('u2', 'direct_unsubsidized', 'student-1', [{ date: '2027-08-15', grossPrincipalCents: 100_000 }])
    const result = calculateGraduationDebt(base([first, future], { futureRateResolutions: [{ loanId: 'u2', rate: { status: 'assumed', annualRatePercent: 7.25, explanation: 'Future planning rate', provenance: { source: 'User assumption', createdFor: 'Plan' } } }] }))
    expect(result.loans.map((item) => item.rate.status === 'unknown' ? null : item.rate.annualRatePercent)).toEqual([6.52, 7.25])
  })
  it('returns unsupported when voluntary in-school payments would require allocation', () => {
    expect(calculateGraduationDebt(base([loan('u1', 'direct_unsubsidized', 'student-1', [{ date: '2026-08-15', grossPrincipalCents: 100_000 }])], { inSchoolPayments: { status: 'payments_planned', reason: 'Borrower plans monthly payments' } }))).toMatchObject({ status: 'unsupported', knownPrincipalCents: 100_000 })
  })
})

describe('pure architecture boundary', () => {
  it('fails closed when supplied ledger accounting or borrower ownership is malformed', () => {
    const valid = loan('u1', 'direct_unsubsidized', 'student-1', [{ date: '2026-08-15', grossPrincipalCents: 100_000 }])
    expect(calculateGraduationDebt(base([{ ...valid, feeCents: valid.feeCents + 1 }]))).toMatchObject({ status: 'incomplete', loans: [] })
    expect(calculateGraduationDebt(base([{ ...valid, borrowerRole: 'parent' }]))).toMatchObject({ status: 'incomplete', loans: [] })
  })
  it('does not invoke network, persistence, Scorecard, policy mutation, or repayment calculations', () => {
    const source = readdirSync(resolve('src/lib/funding')).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts')).map((file) => readFileSync(resolve('src/lib/funding', file), 'utf8')).join('\n')
    for (const forbidden of ['fetch(', 'XMLHttpRequest', 'indexedDB', 'localStorage', 'sessionStorage', 'writeFile', 'src/data/scorecard', 'calculateRap', 'calculateIbr', 'calculateTiered']) expect(source).not.toContain(forbidden)
  })
})
