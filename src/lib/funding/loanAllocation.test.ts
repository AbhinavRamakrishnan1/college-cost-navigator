import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { allocateFederalLoans, buildLoanLedgerEntry, explicitlyAssumedTwoTermSchedule, loanAllocationInputSchema, type LoanAllocationInput } from '.'

const noTransition = (period = '2026-07-01') => ({ status: 'verified_not_applicable' as const, institutionIdentifier: 'school-1', programIdentifier: 'program-1', enrollmentPeriodStart: period, predicates: { enrolledInProgramAtInstitutionOn2026_06_30: false, qualifyingDirectLoanDisbursedBefore2026_07_01: false, qualifyingLoanRecipient: 'student' as const, qualifyingLoanCanceled: false, remainsEnrolledInSameProgram: true, withdrewOrOtherwiseCeasedEnrollment: false, approvedTitleIvLeaveOfAbsence: false, returnedToSameProgramWithinApprovedLeaveWindow: false, withinInstitutionDeterminedExpectedTimeToCredential: false } })
const transition = () => ({ status: 'verified_applicable' as const, institutionIdentifier: 'school-1', programIdentifier: 'program-1', enrollmentPeriodStart: '2026-07-01', predicates: { enrolledInProgramAtInstitutionOn2026_06_30: true, qualifyingDirectLoanDisbursedBefore2026_07_01: true, qualifyingLoanRecipient: 'student' as const, qualifyingLoanCanceled: false, remainsEnrolledInSameProgram: true, withdrewOrOtherwiseCeasedEnrollment: false, approvedTitleIvLeaveOfAbsence: false, returnedToSameProgramWithinApprovedLeaveWindow: false, withinInstitutionDeterminedExpectedTimeToCredential: true } })
const completeHistory = (direct = 0) => ({ status: 'confirmed_complete' as const, directAndFfelStudentBorrowingCents: direct, graduatePlusStudentBorrowingCents: 0, parentPlusBorrowedAsParentExcludedCents: 0, healAndExcludedHealthProfessionBorrowingCents: 0, convertedTeachGrantBorrowingCents: 0, consolidationUnderlyingPrincipalAlreadyIncluded: true as const })
const schedule = (gross: number, date = '2026-08-15') => ({ disbursements: [{ date, grossPrincipalCents: gross }] })

function input(overrides: Partial<LoanAllocationInput> = {}): LoanAllocationInput {
  const base: LoanAllocationInput = {
    context: { institutionIdentifier: 'school-1', programIdentifier: 'program-1', dependencyStatus: 'dependent', educationLevel: 'undergraduate', enrollmentPattern: 'full_time_standard_academic_year', academicYearStart: '2026-07-01', enrollmentPeriodStart: '2026-07-01', institutionalProgramLimit: { status: 'none_confirmed' } },
    academicYear: '2026-27', gradeLevel: 1, studentBeneficiaryId: 'student-1',
    higherLimitQualification: { status: 'not_qualified', academicYearStart: '2026-07-01', reason: 'no_qualifying_determination' },
    directElection: { borrowerId: 'student-1', subsidizedGrossCents: 350_000, unsubsidizedGrossCents: 200_000, subsidizedBasis: { status: 'school_confirmed', source: 'School award notice' }, subsidizedSchedule: schedule(350_000), unsubsidizedSchedule: schedule(200_000) },
    currentYearPriorDirectUsage: { combinedGrossCents: 0, subsidizedGrossCents: 0 }, aggregateHistory: { combinedOutstandingPrincipalCents: 0, subsidizedOutstandingPrincipalCents: 0 }, lifetimeHistory: completeHistory(), lifetimeTransitionDetermination: noTransition(),
    parentPlusHistory: { allParentsAnnualCumulativeUsageCents: 0, allParentsAggregateCumulativeUsageCents: 0 }, parentPlusElections: [], preLoanGapCents: 2_000_000,
  }
  return { ...base, ...overrides }
}
const direct = (sub: number, unsub: number, basis: 'school_confirmed' | 'assumed' = 'school_confirmed') => ({ borrowerId: 'student-1', subsidizedGrossCents: sub, unsubsidizedGrossCents: unsub, subsidizedBasis: basis === 'school_confirmed' ? { status: 'school_confirmed' as const, source: 'School award notice' } : { status: 'assumed' as const, explanation: 'Planning estimate pending school packaging', source: 'User assumption' }, subsidizedSchedule: schedule(sub), unsubsidizedSchedule: schedule(unsub) })
const parent = (borrowerId: string, gross: number, date = '2026-08-15') => ({ borrowerId, grossPrincipalCents: gross, creditStatus: 'eligible' as const, transitionDetermination: noTransition(), schedule: schedule(gross, date) })

describe('Direct Loan election and federal ceilings', () => {
  it.each([[1, 350_000, 200_000], [2, 450_000, 200_000], [3, 550_000, 200_000], [4, 550_000, 200_000]] as const)('accepts the exact combined maximum for grade %i', (gradeLevel, sub, unsub) => {
    expect(allocateFederalLoans(input({ gradeLevel, directElection: direct(sub, unsub) })).status).toBe('complete')
  })
  it('accepts an election below the maximum and does not maximize it', () => {
    const result = allocateFederalLoans(input({ directElection: direct(100_000, 50_000) }))
    expect(result).toMatchObject({ status: 'complete', elections: { directSubsidizedGrossCents: 100_000, directUnsubsidizedGrossCents: 50_000 } })
  })
  it('rejects combined annual and subsidized annual excesses', () => {
    expect(allocateFederalLoans(input({ directElection: direct(350_000, 200_001) })).status).toBe('exceeds_limit')
    expect(allocateFederalLoans(input({ directElection: direct(350_001, 0) })).status).toBe('exceeds_limit')
  })
  it('binds aggregate headroom before the annual limit', () => {
    expect(allocateFederalLoans(input({ aggregateHistory: { combinedOutstandingPrincipalCents: 3_050_000, subsidizedOutstandingPrincipalCents: 2_100_000 }, directElection: direct(100_000, 0) }))).toMatchObject({ status: 'exceeds_limit', allowed: { combinedCents: 50_000 } })
  })
  it('binds subsidized aggregate headroom independently', () => {
    expect(allocateFederalLoans(input({ aggregateHistory: { combinedOutstandingPrincipalCents: 2_200_000, subsidizedOutstandingPrincipalCents: 2_290_000 }, directElection: direct(20_000, 0) })).status).toBe('incomplete')
    expect(allocateFederalLoans(input({ aggregateHistory: { combinedOutstandingPrincipalCents: 2_900_000, subsidizedOutstandingPrincipalCents: 2_290_000 }, directElection: direct(20_000, 0) }))).toMatchObject({ status: 'exceeds_limit', allowed: { subsidizedCents: 10_000 } })
  })
  it('allows repayment-restored ordinary aggregate capacity', () => {
    expect(allocateFederalLoans(input({ aggregateHistory: { combinedOutstandingPrincipalCents: 2_500_000, subsidizedOutstandingPrincipalCents: 2_000_000 }, directElection: direct(300_000, 200_000) })).status).toBe('complete')
  })
  it('fails closed for incomplete prior and current-year history', () => {
    expect(allocateFederalLoans(input({ aggregateHistory: { combinedOutstandingPrincipalCents: null, subsidizedOutstandingPrincipalCents: null } })).status).toBe('incomplete')
    expect(allocateFederalLoans(input({ currentYearPriorDirectUsage: { combinedGrossCents: null, subsidizedGrossCents: null } })).status).toBe('incomplete')
  })
  it('supports a verified higher-limit dependent election and rejects stale qualification', () => {
    const qualified = { status: 'qualified' as const, academicYearStart: '2026-07-01', basis: 'verified_parent_plus_denial' as const, anotherParentApprovedForSamePeriod: false as const }
    expect(allocateFederalLoans(input({ higherLimitQualification: qualified, directElection: direct(350_000, 600_000) })).status).toBe('complete')
    expect(allocateFederalLoans(input({ higherLimitQualification: { ...qualified, academicYearStart: '2025-07-01' } })).status).toBe('incomplete')
  })
  it('binds lifetime headroom and current-year prior usage', () => {
    expect(allocateFederalLoans(input({ lifetimeHistory: completeHistory(25_740_000), directElection: direct(20_000, 0) }))).toMatchObject({ status: 'exceeds_limit', allowed: { combinedCents: 10_000 } })
    expect(allocateFederalLoans(input({ currentYearPriorDirectUsage: { combinedGrossCents: 500_000, subsidizedGrossCents: 300_000 }, directElection: direct(50_000, 1) }))).toMatchObject({ status: 'exceeds_limit', allowed: { combinedCents: 50_000 } })
  })
  it('preserves explicit assumed subsidized packaging without inferring it from SAI', () => {
    const result = allocateFederalLoans(input({ directElection: direct(100_000, 0, 'assumed') }))
    expect(result.status).toBe('complete')
    expect(input({ directElection: direct(100_000, 0, 'assumed') }).directElection.subsidizedBasis.status).toBe('assumed')
  })
})

describe('Parent PLUS shared caps and ownership', () => {
  it('accepts below-cap and exact-cap explicit elections', () => {
    expect(allocateFederalLoans(input({ directElection: direct(0, 0), parentPlusElections: [parent('parent-a', 1_000_000)] })).status).toBe('complete')
    expect(allocateFederalLoans(input({ directElection: direct(0, 0), parentPlusElections: [parent('parent-a', 2_000_000)] })).status).toBe('complete')
  })
  it('rejects annual and cumulative aggregate cap excesses', () => {
    expect(allocateFederalLoans(input({ directElection: direct(0, 0), parentPlusElections: [parent('parent-a', 2_000_001)] })).status).toBe('exceeds_limit')
    expect(allocateFederalLoans(input({ directElection: direct(0, 0), parentPlusHistory: { allParentsAnnualCumulativeUsageCents: 0, allParentsAggregateCumulativeUsageCents: 6_400_000 }, parentPlusElections: [parent('parent-a', 100_001)] }))).toMatchObject({ status: 'exceeds_limit', allowed: { parentPlusCents: 100_000 } })
  })
  it('shares caps across two parents and preserves separate ownership', () => {
    const result = allocateFederalLoans(input({ directElection: direct(0, 0), parentPlusElections: [parent('parent-a', 1_000_000), parent('parent-b', 1_000_000)] }))
    expect(result.status).toBe('complete')
    if (result.status === 'complete') {
      expect(result.ledger.map((loan) => loan.borrowerId)).toEqual(['parent-a', 'parent-b'])
      expect(result.policy.parentPlus).toHaveLength(2)
      expect(result.policy.parentPlus[0]).toMatchObject({ status: 'eligible', annualHeadroomCents: 2_000_000, aggregateHeadroomCents: 6_500_000 })
    }
    expect(allocateFederalLoans(input({ directElection: direct(0, 0), parentPlusElections: [parent('parent-a', 1_000_001), parent('parent-b', 1_000_000)] })).status).toBe('exceeds_limit')
  })
  it('does not restore cumulative cap after repayment', () => {
    expect(allocateFederalLoans(input({ directElection: direct(0, 0), parentPlusHistory: { allParentsAnnualCumulativeUsageCents: 0, allParentsAggregateCumulativeUsageCents: 6_500_000 }, parentPlusElections: [parent('parent-a', 1)] })).status).toBe('exceeds_limit')
  })
  it('supports a verified transition exception and fails closed for stale evidence', () => {
    const transitioned = { ...parent('parent-a', 2_500_000), transitionDetermination: transition() }
    expect(allocateFederalLoans(input({ directElection: direct(0, 0), parentPlusHistory: { allParentsAnnualCumulativeUsageCents: null, allParentsAggregateCumulativeUsageCents: null }, parentPlusElections: [transitioned] })).status).toBe('complete')
    expect(allocateFederalLoans(input({ directElection: direct(0, 0), parentPlusElections: [{ ...parent('parent-a', 1), transitionDetermination: { ...noTransition(), enrollmentPeriodStart: '2025-07-01' } }] })).status).toBe('incomplete')
  })
})

describe('institutional allocation contract', () => {
  const limitedContext = { ...input().context, institutionalProgramLimit: { status: 'known_total_limit' as const, annualTotalCapCents: 1_000_000 } }
  it('allows none-confirmed normal behavior and blocks unknown limits', () => {
    expect(allocateFederalLoans(input()).status).toBe('complete')
    expect(allocateFederalLoans(input({ context: { ...input().context, institutionalProgramLimit: { status: 'unknown' } } })).status).toBe('incomplete')
  })
  it('requires an explicit allocation for a known shared total', () => {
    expect(allocateFederalLoans(input({ context: limitedContext, directElection: direct(200_000, 100_000), parentPlusElections: [parent('parent-a', 150_000)] }))).toMatchObject({ status: 'requires_institutional_allocation', requested: { institutionalAllocationCents: 450_000 }, allowed: { institutionalAnnualTotalCapCents: 1_000_000 } })
  })
  it('accepts a valid allocation and rejects allocations above the total', () => {
    expect(allocateFederalLoans(input({ context: limitedContext, institutionalAllocation: { directSubsidizedCents: 350_000, directUnsubsidizedCents: 200_000, parentPlusCents: 450_000, source: 'School allocation notice' } })).status).toBe('complete')
    expect(allocateFederalLoans(input({ context: limitedContext, institutionalAllocation: { directSubsidizedCents: 350_000, directUnsubsidizedCents: 200_000, parentPlusCents: 450_001, source: 'School allocation notice' } })).status).toBe('exceeds_limit')
  })
})

describe('fees and dated disbursement ledger', () => {
  it('applies Direct and PLUS fees and preserves gross-minus-fee identity', () => {
    const result = allocateFederalLoans(input({ directElection: direct(350_000, 0), parentPlusElections: [parent('parent-a', 1_000_000)] }))
    expect(result.status).toBe('complete')
    if (result.status !== 'complete') return
    expect(result.ledger[0].feeCents).toBe(3_699)
    expect(result.ledger[1].feeCents).toBe(42_280)
    for (const loan of result.ledger) expect(loan.grossPrincipalCents - loan.feeCents).toBe(loan.netProceedsCents)
  })
  it('uses the first-disbursement boundary and truncates each disbursement fee', () => {
    const ledger = buildLoanLedgerEntry({ loanId: 'loan-1', borrowerId: 'student-1', borrowerRole: 'student', studentBeneficiaryId: 'student-1', loanType: 'direct_subsidized', academicYear: '2026-27', schedule: { disbursements: [{ date: '2026-10-02', grossPrincipalCents: 101 }, { date: '2026-10-01', grossPrincipalCents: 101 }] } })
    expect(ledger).toMatchObject({ firstDisbursementDate: '2026-10-01', grossPrincipalCents: 202, feeCents: 2, netProceedsCents: 200 })
  })
  it('supports one and two explicit disbursements with reconciliation and cohort preservation', () => {
    const one = buildLoanLedgerEntry({ loanId: 'loan-1', borrowerId: 'student-1', borrowerRole: 'student', studentBeneficiaryId: 'student-1', loanType: 'direct_unsubsidized', academicYear: '2026-27', schedule: schedule(100_000) })
    expect(one).toMatchObject({ borrowerId: 'student-1', firstDisbursementDate: '2026-08-15', rateCohort: { status: 'known' }, disbursements: [{ grossPrincipalCents: 100_000 }] })
    const two = buildLoanLedgerEntry({ loanId: 'loan-2', borrowerId: 'parent-a', borrowerRole: 'parent', studentBeneficiaryId: 'student-1', loanType: 'parent_plus', academicYear: '2026-27', schedule: explicitlyAssumedTwoTermSchedule({ firstDate: '2026-08-15', secondDate: '2027-01-10', grossPrincipalCents: 100_001, explanation: 'Two equal term disbursements', source: 'Planner assumption' }) })
    expect(two).toMatchObject({ borrowerRole: 'parent', studentBeneficiaryId: 'student-1', loanType: 'parent_plus', grossPrincipalCents: 100_001, scheduleAssumption: { source: 'Planner assumption' } })
    if (!('status' in two)) expect(two.disbursements.reduce((sum, item) => sum + item.grossPrincipalCents, 0)).toBe(two.grossPrincipalCents)
  })
  it('requires an assumption for an unknown future fee window', () => {
    expect(buildLoanLedgerEntry({ loanId: 'loan-1', borrowerId: 'student-1', borrowerRole: 'student', studentBeneficiaryId: 'student-1', loanType: 'direct_unsubsidized', academicYear: '2027-28', schedule: schedule(100, '2027-10-01') })).toMatchObject({ status: 'requires_assumption' })
  })
  it('records no interest or accrued balance fields', () => {
    const text = JSON.stringify(buildLoanLedgerEntry({ loanId: 'loan-1', borrowerId: 'student-1', borrowerRole: 'student', studentBeneficiaryId: 'student-1', loanType: 'direct_unsubsidized', academicYear: '2026-27', schedule: schedule(100_000) }))
    expect(text).not.toMatch(/interest|capitaliz|graduation/i)
  })
})

describe('net-proceeds funding accounting', () => {
  it('handles student-only, PLUS-only, and combined proceeds', () => {
    const student = allocateFederalLoans(input({ directElection: direct(100_000, 0), preLoanGapCents: 200_000 }))
    expect(student).toMatchObject({ status: 'complete', accounting: { studentNetProceedsCents: 98_943, parentPlusNetProceedsCents: 0, remainingUncoveredFundingGapCents: 101_057 } })
    const plus = allocateFederalLoans(input({ directElection: direct(0, 0), parentPlusElections: [parent('parent-a', 100_000)], preLoanGapCents: 200_000 }))
    expect(plus).toMatchObject({ status: 'complete', accounting: { studentNetProceedsCents: 0, parentPlusNetProceedsCents: 95_772, remainingUncoveredFundingGapCents: 104_228 } })
    const both = allocateFederalLoans(input({ directElection: direct(100_000, 0), parentPlusElections: [parent('parent-a', 100_000)], preLoanGapCents: 200_000 }))
    expect(both).toMatchObject({ status: 'complete', accounting: { netProceedsCents: 194_715, remainingUncoveredFundingGapCents: 5_285 } })
  })
  it('reports zero gap and overfunding surplus without clamping signed information', () => {
    const exact = allocateFederalLoans(input({ directElection: direct(100_000, 0), preLoanGapCents: 98_943 }))
    expect(exact).toMatchObject({ status: 'complete', accounting: { signedRemainingFundingGapCents: 0, remainingUncoveredFundingGapCents: 0, surplusLoanProceedsCents: 0 } })
    const over = allocateFederalLoans(input({ directElection: direct(100_000, 0), preLoanGapCents: 90_000 }))
    expect(over).toMatchObject({ status: 'complete', accounting: { signedRemainingFundingGapCents: -8_943, remainingUncoveredFundingGapCents: 0, surplusLoanProceedsCents: 8_943 } })
  })
  it('never mistakes gross principal for spendable proceeds', () => {
    const result = allocateFederalLoans(input({ directElection: direct(100_000, 0), preLoanGapCents: 100_000 }))
    expect(result).toMatchObject({ status: 'complete', accounting: { grossBorrowingCents: 100_000, netProceedsCents: 98_943, remainingUncoveredFundingGapCents: 1_057 } })
  })
})

describe('validation and pure architecture', () => {
  it('rejects schedules that do not reconcile and duplicate parent borrowers', () => {
    const malformed = input(); malformed.directElection.subsidizedSchedule = schedule(1)
    expect(loanAllocationInputSchema.safeParse(malformed).success).toBe(false)
    expect(loanAllocationInputSchema.safeParse(input({ directElection: direct(0, 0), parentPlusElections: [parent('parent-a', 1), parent('parent-a', 1)] })).success).toBe(false)
  })
  it('contains no network, persistence, Scorecard, or policy mutation path', () => {
    const source = readdirSync(resolve('src/lib/funding')).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts')).map((file) => readFileSync(resolve('src/lib/funding', file), 'utf8')).join('\n')
    for (const forbidden of ['fetch(', 'XMLHttpRequest', 'indexedDB', 'localStorage', 'sessionStorage', 'navigator.sendBeacon', 'src/data/scorecard', 'writeFile', 'analytics']) expect(source).not.toContain(forbidden)
  })
})
