import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  calculateOriginationFeeCents,
  calculateAggregateCountableOutstandingPrincipalCents,
  determineHigherLimitQualificationFromParentFacts,
  getCountedLifetimeBorrowingCents,
  getDirectLoanAnnualLimit,
  getOriginationFeePolicy,
  getParentPlusLimit,
  getRemainingAggregateHeadroom,
  getRemainingLifetimeHeadroom,
  resolveOriginationPolicy,
  type HigherLimitQualification,
  type LifetimeBorrowingHistory,
  type OriginationContext,
  type ParentPlusLimitInput,
  type ParentPlusTransitionDetermination,
  lifetimeBorrowingHistorySchema,
  parentPlusTransitionDeterminationSchema,
} from './origination'
import {
  directLoanOriginationFees,
  directLoanOriginationFeesSchema,
  directLoanOriginationLimits,
  directLoanOriginationLimitsSchema,
  originationPolicyIntegrity,
  parentPlusOriginationLimits,
  parentPlusOriginationLimitsSchema,
} from './originationSchemas'
import { POLICY_VERSION_UNAVAILABLE } from './types'

const context = (overrides: Partial<OriginationContext> = {}): OriginationContext => ({
  institutionIdentifier: 'institution-1', programIdentifier: 'program-1',
  dependencyStatus: 'dependent', educationLevel: 'undergraduate', enrollmentPattern: 'full_time_standard_academic_year',
  academicYearStart: '2026-07-01', enrollmentPeriodStart: '2026-07-01', institutionalProgramLimit: { status: 'none_confirmed' }, ...overrides,
})
const normal = (academicYearStart = '2026-07-01', reason: Extract<HigherLimitQualification, { status: 'not_qualified' }>['reason'] = 'no_qualifying_determination'): HigherLimitQualification => ({ status: 'not_qualified', academicYearStart, reason })
const qualified = (academicYearStart = '2026-07-01', basis: Extract<HigherLimitQualification, { status: 'qualified' }>['basis'] = 'verified_parent_plus_denial'): HigherLimitQualification => ({ status: 'qualified', academicYearStart, basis, anotherParentApprovedForSamePeriod: false })
const predicates = {
  enrolledInProgramAtInstitutionOn2026_06_30: false, qualifyingDirectLoanDisbursedBefore2026_07_01: false, qualifyingLoanRecipient: 'student' as const, qualifyingLoanCanceled: false,
  remainsEnrolledInSameProgram: false, withdrewOrOtherwiseCeasedEnrollment: false, approvedTitleIvLeaveOfAbsence: false,
  returnedToSameProgramWithinApprovedLeaveWindow: false, withinInstitutionDeterminedExpectedTimeToCredential: false,
}
const noTransition = (period = '2026-07-01'): ParentPlusTransitionDetermination => ({ status: 'verified_not_applicable', institutionIdentifier: 'institution-1', enrollmentPeriodStart: period, programIdentifier: 'program-1', predicates })
const applicableTransition = (overrides: Partial<ParentPlusTransitionDetermination['predicates']> = {}, period = '2026-07-01'): ParentPlusTransitionDetermination => ({ status: 'verified_applicable', institutionIdentifier: 'institution-1', enrollmentPeriodStart: period, programIdentifier: 'program-1', predicates: { enrolledInProgramAtInstitutionOn2026_06_30: true, qualifyingDirectLoanDisbursedBefore2026_07_01: true, qualifyingLoanRecipient: 'student', qualifyingLoanCanceled: false, remainsEnrolledInSameProgram: true, withdrewOrOtherwiseCeasedEnrollment: false, approvedTitleIvLeaveOfAbsence: false, returnedToSameProgramWithinApprovedLeaveWindow: false, withinInstitutionDeterminedExpectedTimeToCredential: true, ...overrides } })
const plusInput = (overrides: Partial<ParentPlusLimitInput> = {}): ParentPlusLimitInput => ({ context: context(), creditStatus: 'eligible', transitionDetermination: noTransition(), allParentsAnnualCumulativeUsageForStudentCents: 0, allParentsAggregateCumulativeUsageForStudentCents: 0, ...overrides })
type CompleteLifetimeHistory = Extract<LifetimeBorrowingHistory, { status: 'confirmed_complete' }>
const history = (overrides: Partial<CompleteLifetimeHistory> = {}): CompleteLifetimeHistory => ({ status: 'confirmed_complete', directAndFfelStudentBorrowingCents: 0, graduatePlusStudentBorrowingCents: 0, parentPlusBorrowedAsParentExcludedCents: 0, healAndExcludedHealthProfessionBorrowingCents: 0, convertedTeachGrantBorrowingCents: 0, consolidationUnderlyingPrincipalAlreadyIncluded: true, ...overrides })

describe('Direct Loan annual and aggregate policy', () => {
  it.each([[1, 5500, 3500, 'year1'], [2, 6500, 4500, 'year2'], [3, 7500, 5500, 'year3Plus'], [4, 7500, 5500, 'year3Plus']] as const)('selects standard grade %i', (gradeLevel, combined, subsidized, gradeBand) => {
    expect(getDirectLoanAnnualLimit({ context: context(), gradeLevel, higherLimitQualification: normal() })).toMatchObject({ status: 'available', tier: 'standardDependent', gradeBand, combinedAnnualLimitCents: combined * 100, subsidizedAnnualLimitCents: subsidized * 100 })
  })

  it.each([[1, 9500, 3500], [2, 10500, 4500], [3, 12500, 5500], [4, 12500, 5500]] as const)('selects verified higher tier for grade %i', (gradeLevel, combined, subsidized) => {
    expect(getDirectLoanAnnualLimit({ context: context(), gradeLevel, higherLimitQualification: qualified() })).toMatchObject({ status: 'available', tier: 'higherLimitDependent', combinedAnnualLimitCents: combined * 100, subsidizedAnnualLimitCents: subsidized * 100 })
  })

  it('does not infer qualification from denial, cap exhaustion, unwillingness, or another-parent approval', () => {
    for (const reason of ['parent_plus_cap_exhausted', 'parent_unwilling_to_borrow', 'another_parent_approved'] as const) {
      expect(getDirectLoanAnnualLimit({ context: context(), gradeLevel: 1, higherLimitQualification: normal('2026-07-01', reason) })).toMatchObject({ status: 'available', tier: 'standardDependent' })
    }
    expect(getParentPlusLimit(plusInput({ creditStatus: 'denied' }))).toMatchObject({ status: 'credit_denied', requiresSeparateHigherLimitDetermination: true })
    expect(determineHigherLimitQualificationFromParentFacts({ academicYearStart: '2026-07-01', parentApplicationOutcomes: ['denied'], schoolVerifiedQualifyingDenial: true })).toMatchObject({ status: 'qualified' })
    expect(determineHigherLimitQualificationFromParentFacts({ academicYearStart: '2026-07-01', parentApplicationOutcomes: ['denied', 'approved'], schoolVerifiedQualifyingDenial: true })).toMatchObject({ status: 'not_qualified', reason: 'another_parent_approved' })
  })

  it('fails closed for unresolved, malformed, and prior-year qualification', () => {
    expect(getDirectLoanAnnualLimit({ context: context(), gradeLevel: 1, higherLimitQualification: { status: 'unresolved', academicYearStart: '2026-07-01' } })).toMatchObject({ status: 'insufficient_information' })
    expect(getDirectLoanAnnualLimit({ context: context(), gradeLevel: 1, higherLimitQualification: qualified('2025-07-01') })).toMatchObject({ status: 'insufficient_information' })
    expect(getDirectLoanAnnualLimit({ context: context(), gradeLevel: 1, higherLimitQualification: { status: 'wrong' } as never })).toMatchObject({ status: 'insufficient_information' })
  })

  it('uses aggregate-countable outstanding principal, so repaid principal restores headroom', () => {
    expect(getRemainingAggregateHeadroom({ context: context(), higherLimitQualification: normal(), aggregateCountableOutstandingCombinedPrincipalCents: 2_600_000, aggregateCountableOutstandingSubsidizedPrincipalCents: 2_100_000 })).toMatchObject({ status: 'available', combinedHeadroomCents: 500_000, subsidizedHeadroomCents: 200_000 })
    expect(directLoanOriginationLimits.aggregateAccounting.repaymentOfCountablePrincipalRestoresHeadroom).toBe(true)
  })

  it('arithmetically excludes capitalized interest and counts consolidation attribution once', () => {
    const countable = calculateAggregateCountableOutstandingPrincipalCents({ unconsolidatedEligibleOutstandingPrincipalCents: 1_600_000, consolidationAttributableEligibleOutstandingPrincipalCents: 1_000_000, capitalizedInterestExcludedCents: 100_000, otherNoncountingAmountsExcludedCents: 50_000 })
    expect(countable).toBe(2_600_000)
    expect(getRemainingAggregateHeadroom({ context: context(), higherLimitQualification: normal(), aggregateCountableOutstandingCombinedPrincipalCents: countable, aggregateCountableOutstandingSubsidizedPrincipalCents: 2_100_000 })).toMatchObject({ combinedHeadroomCents: 500_000 })
  })

  it('excludes capitalized interest and handles a return from higher to standard limits', () => {
    expect(directLoanOriginationLimits.aggregateAccounting.capitalizedInterestCountsTowardUndergraduateAggregate).toBe(false)
    const totalPreviouslyBorrowedUnderHigherLimits = 3_250_000
    const additionalUnsubsidizedNotCountedAgainstReturnedStandardTier = 1_300_000
    const standardTierCountablePrincipal = totalPreviouslyBorrowedUnderHigherLimits - additionalUnsubsidizedNotCountedAgainstReturnedStandardTier
    expect(getRemainingAggregateHeadroom({ context: context(), higherLimitQualification: normal(), aggregateCountableOutstandingCombinedPrincipalCents: standardTierCountablePrincipal, aggregateCountableOutstandingSubsidizedPrincipalCents: 1_350_000 })).toMatchObject({ status: 'available', tier: 'standardDependent', combinedHeadroomCents: 1_150_000 })
  })

  it('applies aggregate boundaries and never returns negative headroom', () => {
    expect(getRemainingAggregateHeadroom({ context: context(), higherLimitQualification: normal(), aggregateCountableOutstandingCombinedPrincipalCents: 4_000_000, aggregateCountableOutstandingSubsidizedPrincipalCents: 2_500_000 })).toMatchObject({ combinedHeadroomCents: 0, subsidizedHeadroomCents: 0 })
    expect(getRemainingAggregateHeadroom({ context: context(), higherLimitQualification: qualified(), aggregateCountableOutstandingCombinedPrincipalCents: 0, aggregateCountableOutstandingSubsidizedPrincipalCents: 0 })).toMatchObject({ combinedLimitCents: 5_750_000, subsidizedLimitCents: 2_300_000 })
  })

  it('fails closed for incomplete or inconsistent aggregate principal', () => {
    expect(getRemainingAggregateHeadroom({ context: context(), higherLimitQualification: normal(), aggregateCountableOutstandingCombinedPrincipalCents: null, aggregateCountableOutstandingSubsidizedPrincipalCents: 0 })).toMatchObject({ status: 'insufficient_information' })
    expect(getRemainingAggregateHeadroom({ context: context(), higherLimitQualification: normal(), aggregateCountableOutstandingCombinedPrincipalCents: 100, aggregateCountableOutstandingSubsidizedPrincipalCents: 200 })).toMatchObject({ status: 'insufficient_information' })
  })
})

describe('lifetime cumulative policy', () => {
  it('includes student Direct/FFEL and graduate PLUS while excluding enumerated categories', () => {
    expect(getCountedLifetimeBorrowingCents(history({ directAndFfelStudentBorrowingCents: 10_000_000, graduatePlusStudentBorrowingCents: 2_000_000, parentPlusBorrowedAsParentExcludedCents: 8_000_000, healAndExcludedHealthProfessionBorrowingCents: 3_000_000, convertedTeachGrantBorrowingCents: 100_000 }))).toEqual({ status: 'available', countedLifetimeBorrowingCents: 12_000_000 })
  })

  it('does not restore lifetime capacity because cumulative loans were repaid', () => {
    expect(getRemainingLifetimeHeadroom({ context: context(), transitionDetermination: noTransition(), history: history({ directAndFfelStudentBorrowingCents: 25_750_000 }) })).toMatchObject({ status: 'available', lifetimeHeadroomCents: 0 })
    expect(directLoanOriginationLimits.limits.lifetimeStudentBorrowing.repaymentForgivenessCancellationOrDischargeRestoresHeadroom).toBe(false)
  })

  it('requires complete categorized history and consolidation attribution', () => {
    const incomplete: LifetimeBorrowingHistory = { status: 'incomplete', directAndFfelStudentBorrowingCents: null, graduatePlusStudentBorrowingCents: null, parentPlusBorrowedAsParentExcludedCents: null, healAndExcludedHealthProfessionBorrowingCents: null, convertedTeachGrantBorrowingCents: null, consolidationUnderlyingPrincipalAlreadyIncluded: null }
    expect(getCountedLifetimeBorrowingCents(incomplete)).toMatchObject({ status: 'insufficient_information' })
    expect(lifetimeBorrowingHistorySchema.safeParse({ ...history(), directAndFfelStudentBorrowingCents: null }).success).toBe(false)
    expect(lifetimeBorrowingHistorySchema.safeParse({ ...history(), consolidationUnderlyingPrincipalAlreadyIncluded: false }).success).toBe(false)
    expect(lifetimeBorrowingHistorySchema.safeParse(incomplete).success).toBe(true)
  })

  it('binds the lifetime transition determination to the enrollment period', () => {
    expect(getRemainingLifetimeHeadroom({ context: context(), transitionDetermination: applicableTransition(), history: history() })).toMatchObject({ status: 'transition_exception' })
    expect(getRemainingLifetimeHeadroom({ context: context(), transitionDetermination: applicableTransition({}, '2027-07-01'), history: history() })).toMatchObject({ status: 'insufficient_information' })
    expect(getRemainingLifetimeHeadroom({ context: context({ programIdentifier: 'program-2' }), transitionDetermination: applicableTransition(), history: history() })).toMatchObject({ status: 'insufficient_information' })
    expect(getRemainingLifetimeHeadroom({ context: context({ institutionIdentifier: 'institution-2' }), transitionDetermination: applicableTransition(), history: history() })).toMatchObject({ status: 'insufficient_information' })
    expect(getRemainingLifetimeHeadroom({ context: context(), transitionDetermination: applicableTransition({ qualifyingDirectLoanDisbursedBefore2026_07_01: null }), history: history() })).toMatchObject({ status: 'insufficient_information' })
  })
})

describe('Parent PLUS policy', () => {
  it('applies shared $20,000 annual and $65,000 cumulative caps', () => {
    expect(getParentPlusLimit(plusInput({ allParentsAnnualCumulativeUsageForStudentCents: 2_000_000, allParentsAggregateCumulativeUsageForStudentCents: 2_000_000 }))).toMatchObject({ status: 'cap_exhausted', annualHeadroomCents: 0 })
    expect(getParentPlusLimit(plusInput({ allParentsAnnualCumulativeUsageForStudentCents: 1_200_000, allParentsAggregateCumulativeUsageForStudentCents: 5_900_000 }))).toMatchObject({ status: 'eligible', annualHeadroomCents: 800_000, aggregateHeadroomCents: 600_000, maximumBeforeCoaAndOtherAidCents: 600_000, sharedAcrossAllParentsForStudent: true })
  })

  it('does not restore Parent PLUS cumulative capacity after repayment', () => {
    expect(getParentPlusLimit(plusInput({ allParentsAnnualCumulativeUsageForStudentCents: 0, allParentsAggregateCumulativeUsageForStudentCents: 6_500_000 }))).toMatchObject({ status: 'cap_exhausted', aggregateHeadroomCents: 0 })
    expect(parentPlusOriginationLimits.limits.repaymentForgivenessCancellationOrDischargeRestoresHeadroom).toBe(false)
  })

  it('rejects impossible annual usage above aggregate usage', () => {
    expect(getParentPlusLimit(plusInput({ allParentsAnnualCumulativeUsageForStudentCents: 2_000_000, allParentsAggregateCumulativeUsageForStudentCents: 1_900_000 }))).toMatchObject({ status: 'insufficient_information' })
  })

  it('accepts a current period-bound transition determination', () => {
    expect(getParentPlusLimit(plusInput({ transitionDetermination: applicableTransition(), allParentsAnnualCumulativeUsageForStudentCents: null, allParentsAggregateCumulativeUsageForStudentCents: null }))).toMatchObject({ status: 'transition_exception', annualCapCents: null, aggregateCapCents: null })
  })

  it('fails closed for stale, expired, unresolved, or individually missing transition facts', () => {
    expect(getParentPlusLimit(plusInput({ transitionDetermination: applicableTransition({}, '2027-07-01') }))).toMatchObject({ status: 'insufficient_information' })
    expect(getParentPlusLimit(plusInput({ transitionDetermination: { ...noTransition(), status: 'stale_or_expired' } }))).toMatchObject({ status: 'insufficient_information' })
    expect(getParentPlusLimit(plusInput({ transitionDetermination: { ...noTransition(), status: 'unresolved' } }))).toMatchObject({ status: 'insufficient_information' })
    expect(getParentPlusLimit(plusInput({ transitionDetermination: applicableTransition({ qualifyingLoanCanceled: null }) }))).toMatchObject({ status: 'insufficient_information' })
  })

  it('distinguishes cancellation, withdrawal, and approved Title IV leave', () => {
    expect(getParentPlusLimit(plusInput({ transitionDetermination: applicableTransition({ qualifyingLoanCanceled: true }) }))).toMatchObject({ status: 'insufficient_information' })
    expect(getParentPlusLimit(plusInput({ transitionDetermination: applicableTransition({ withdrewOrOtherwiseCeasedEnrollment: true }) }))).toMatchObject({ status: 'insufficient_information' })
    expect(parentPlusTransitionDeterminationSchema.safeParse(applicableTransition({ withdrewOrOtherwiseCeasedEnrollment: true, approvedTitleIvLeaveOfAbsence: true })).success).toBe(false)
    expect(getParentPlusLimit(plusInput({ transitionDetermination: applicableTransition({ approvedTitleIvLeaveOfAbsence: true, withdrewOrOtherwiseCeasedEnrollment: false, returnedToSameProgramWithinApprovedLeaveWindow: true }) }))).toMatchObject({ status: 'transition_exception' })
  })

  it('binds the determination to the requested institution and program', () => {
    expect(getParentPlusLimit(plusInput({ context: context({ programIdentifier: 'program-2' }), transitionDetermination: applicableTransition() }))).toMatchObject({ status: 'insufficient_information' })
    expect(getParentPlusLimit(plusInput({ context: context({ institutionIdentifier: 'institution-2' }), transitionDetermination: applicableTransition() }))).toMatchObject({ status: 'insufficient_information' })
    expect(getParentPlusLimit(plusInput({ transitionDetermination: applicableTransition() }))).toMatchObject({ status: 'transition_exception' })
  })
})

describe('scope and date bases', () => {
  it('enforces the common scope gate on every public limit/headroom selector', () => {
    const unsupported = context({ enrollmentPattern: 'part_time' })
    expect(getDirectLoanAnnualLimit({ context: unsupported, gradeLevel: 1, higherLimitQualification: normal() })).toMatchObject({ status: 'unsupported' })
    expect(getRemainingAggregateHeadroom({ context: unsupported, higherLimitQualification: normal(), aggregateCountableOutstandingCombinedPrincipalCents: 0, aggregateCountableOutstandingSubsidizedPrincipalCents: 0 })).toMatchObject({ status: 'unsupported' })
    expect(getRemainingLifetimeHeadroom({ context: unsupported, transitionDetermination: noTransition(), history: history() })).toMatchObject({ status: 'unsupported' })
    expect(getParentPlusLimit(plusInput({ context: unsupported }))).toMatchObject({ status: 'unsupported' })
  })

  it('blocks unknown institutional restrictions on every public limit/headroom selector', () => {
    const blocked = context({ institutionalProgramLimit: { status: 'unknown' } })
    expect(resolveOriginationPolicy(blocked)).toMatchObject({ status: 'insufficient_information' })
    expect(getDirectLoanAnnualLimit({ context: blocked, gradeLevel: 1, higherLimitQualification: normal() })).toMatchObject({ status: 'insufficient_information' })
    expect(getParentPlusLimit(plusInput({ context: blocked }))).toMatchObject({ status: 'insufficient_information' })
  })

  it('uses academic-year start for Direct limits and enrollment-period start for Parent PLUS', () => {
    const split = context({ academicYearStart: '2026-07-01', enrollmentPeriodStart: '2026-06-30' })
    expect(getDirectLoanAnnualLimit({ context: split, gradeLevel: 1, higherLimitQualification: normal() })).toMatchObject({ status: 'available' })
    expect(getParentPlusLimit(plusInput({ context: split, transitionDetermination: noTransition('2026-06-30') }))).toEqual({ status: 'unavailable', reason: POLICY_VERSION_UNAVAILABLE, requested: '2026-06-30' })
    expect(resolveOriginationPolicy(split)).toEqual({ status: 'unavailable', reason: POLICY_VERSION_UNAVAILABLE, requested: '2026-06-30' })
  })

  it('supports known institutional caps but not unknown or malformed status', () => {
    const limited = context({ institutionalProgramLimit: { status: 'known_total_limit', annualTotalCapCents: 1_000_000 } })
    expect(resolveOriginationPolicy(limited)).toMatchObject({ status: 'requires_institutional_allocation', institutionalAnnualTotalCapCents: 1_000_000 })
    expect(getDirectLoanAnnualLimit({ context: limited, gradeLevel: 1, higherLimitQualification: normal() })).toMatchObject({ status: 'requires_institutional_allocation', federalCombinedAnnualLimitCents: 550_000, institutionalAnnualTotalCapCents: 1_000_000 })
    expect(getParentPlusLimit(plusInput({ context: limited }))).toMatchObject({ status: 'requires_institutional_allocation', federalAnnualCapCents: 2_000_000, institutionalAnnualTotalCapCents: 1_000_000 })
    expect(resolveOriginationPolicy(context({ institutionalProgramLimit: { status: 'known' } as never }))).toMatchObject({ status: 'insufficient_information' })
  })
})

describe('fee policy and schema integrity', () => {
  it('selects exact inclusive fee windows and refuses unknown future dates', () => {
    expect(getOriginationFeePolicy({ loanType: 'direct_subsidized_undergraduate', firstDisbursementDate: '2020-10-01' })).toMatchObject({ status: 'available', decimalRate: 0.01057 })
    expect(getOriginationFeePolicy({ loanType: 'direct_plus_parent', firstDisbursementDate: '2027-09-30' })).toMatchObject({ status: 'available', decimalRate: 0.04228 })
    expect(getOriginationFeePolicy({ loanType: 'direct_plus_parent', firstDisbursementDate: '2027-10-01' })).toMatchObject({ status: 'unavailable' })
  })

  it('truncates fractional cents', () => {
    const direct = getOriginationFeePolicy({ loanType: 'direct_subsidized_undergraduate', firstDisbursementDate: '2026-10-01' })
    const plus = getOriginationFeePolicy({ loanType: 'direct_plus_parent', firstDisbursementDate: '2026-10-01' })
    if (direct.status !== 'available' || plus.status !== 'available') throw new Error('Expected available fee policies')
    expect(calculateOriginationFeeCents(550_000, direct)).toBe(5_813)
    expect(calculateOriginationFeeCents(1_000_000, plus)).toBe(42_280)
  })

  it('rejects reversed windows, invalid date bases, and open-ended fee windows', () => {
    expect(directLoanOriginationLimitsSchema.safeParse({ ...directLoanOriginationLimits, effectiveFrom: '2027-01-01', effectiveTo: '2026-01-01' }).success).toBe(false)
    expect(directLoanOriginationLimitsSchema.safeParse({ ...directLoanOriginationLimits, effectiveDateBasis: 'generic_date' }).success).toBe(false)
    expect(directLoanOriginationFeesSchema.safeParse({ ...directLoanOriginationFees, effectiveTo: null }).success).toBe(false)
    expect(parentPlusOriginationLimitsSchema.safeParse({ ...parentPlusOriginationLimits, effectiveDateBasis: 'academic_year_start' }).success).toBe(false)
  })

  it('validates current datasets and all new integrity hashes', () => {
    expect(directLoanOriginationLimitsSchema.safeParse(directLoanOriginationLimits).success).toBe(true)
    expect(parentPlusOriginationLimitsSchema.safeParse(parentPlusOriginationLimits).success).toBe(true)
    expect(directLoanOriginationFeesSchema.safeParse(directLoanOriginationFees).success).toBe(true)
    for (const [file, expected] of Object.entries(originationPolicyIntegrity.files)) {
      const text = readFileSync(resolve('src/data/policy', file), 'utf8').replace(/\r\n/g, '\n')
      expect(createHash('sha256').update(text).digest('hex'), file).toBe(expected)
    }
  })

  it('preserves all six original frozen policy hashes', () => {
    const expected = { 'federal-loan-rates-2026-27.json': '1d44f58fbe8192ad8babe83d0ab03418d9bcbaeacfd78db7b0e74f3ff22aec5b', 'hhs-poverty-guidelines-2024-pell.json': '93479779354e494a624799bf67f237ed4a7d1186a708e6bac2dd08add21e8b2a', 'hhs-poverty-guidelines-2026-idr.json': 'ae6a0dfec5d68d11a96fb6be812959f3d814712b44cf0279b453b073359ebfff', 'policy-constants-v1.0.json': '5b5856a820c7637170440ba0c78336537c', 'policy-status-2026-08-07.json': 'd09057b1654e3dee1dbb8c868f5769bf41c6b125b155d7f656163bd153b6bb1c', 'source-manifest-v1.0.json': '97ee5608d68a30dbe32a0c1e6f377014c74695d77d66b4972399a6398126943a' }
    expected['policy-constants-v1.0.json'] = '5b5856a820c7637170440ba687bbdf3318a213d01f94c70cd14ba0c78336537c'
    for (const [file, hash] of Object.entries(expected)) {
      const text = readFileSync(resolve('src/data/policy', file), 'utf8').replace(/\r\n/g, '\n')
      expect(createHash('sha256').update(text).digest('hex'), file).toBe(hash)
    }
  })
})
