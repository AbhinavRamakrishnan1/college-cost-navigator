import { z } from 'zod'
import { directLoanOriginationFees, directLoanOriginationLimits, parentPlusOriginationLimits } from './originationSchemas'
import { POLICY_VERSION_UNAVAILABLE } from './types'

const isoDateSchema = z.iso.date()
const moneyCentsSchema = z.number().int().nonnegative().safe()
type PolicyFailure = { status: 'unavailable'; reason: typeof POLICY_VERSION_UNAVAILABLE; requested: string } | { status: 'insufficient_information' | 'unsupported'; reason: string }
const unavailable = (requested: string): PolicyFailure => ({ status: 'unavailable', reason: POLICY_VERSION_UNAVAILABLE, requested })
const insufficient = (reason: string): PolicyFailure => ({ status: 'insufficient_information', reason })
const unsupported = (reason: string): PolicyFailure => ({ status: 'unsupported', reason })
const inWindow = (date: string, policy: { effectiveFrom: string; effectiveTo: string | null }) => date >= policy.effectiveFrom && (policy.effectiveTo === null || date <= policy.effectiveTo)

export const originationContextSchema = z.object({
  institutionIdentifier: z.string().min(1),
  programIdentifier: z.string().min(1),
  dependencyStatus: z.enum(['dependent', 'independent']),
  educationLevel: z.enum(['undergraduate', 'graduate_professional']),
  enrollmentPattern: z.enum(['full_time_standard_academic_year', 'part_time', 'summer_or_nonstandard', 'transfer_specific', 'shortened_or_nonterm']),
  academicYearStart: isoDateSchema,
  enrollmentPeriodStart: isoDateSchema,
  institutionalProgramLimit: z.discriminatedUnion('status', [
    z.object({ status: z.literal('none_confirmed') }),
    z.object({ status: z.literal('known_total_limit'), annualTotalCapCents: moneyCentsSchema }),
    z.object({ status: z.literal('unknown') }),
  ]),
})
export type OriginationContext = z.infer<typeof originationContextSchema>

function validateContext(input: OriginationContext, policy: 'direct' | 'parent_plus') {
  const parsed = originationContextSchema.safeParse(input)
  if (!parsed.success) return insufficient('The origination context contains missing or invalid facts.')
  const value = parsed.data
  if (value.dependencyStatus !== 'dependent') return unsupported('Independent-student origination planning is outside the Phase 3 scope.')
  if (value.educationLevel !== 'undergraduate') return unsupported('Graduate/professional origination planning is outside the Phase 3 scope.')
  if (value.enrollmentPattern !== 'full_time_standard_academic_year') return unsupported('Only full-time standard academic years are supported in the initial Phase 3 scope.')
  if (value.institutionalProgramLimit.status === 'unknown') return insufficient('Institutional program-limit status must be confirmed before an automated result is produced.')
  const date = policy === 'direct' ? value.academicYearStart : value.enrollmentPeriodStart
  const dataset = policy === 'direct' ? directLoanOriginationLimits : parentPlusOriginationLimits
  if (!inWindow(date, dataset)) return unavailable(date)
  return { status: 'available' as const, value }
}

export function resolveOriginationPolicy(input: OriginationContext) {
  const direct = validateContext(input, 'direct')
  if (direct.status !== 'available') return direct
  const parentPlus = validateContext(input, 'parent_plus')
  if (parentPlus.status !== 'available') return parentPlus
  if (direct.value.institutionalProgramLimit.status === 'known_total_limit') {
    return { status: 'requires_institutional_allocation' as const, directLoanPolicyVersion: directLoanOriginationLimits.policyVersion, parentPlusPolicyVersion: parentPlusOriginationLimits.policyVersion, institutionalAnnualTotalCapCents: direct.value.institutionalProgramLimit.annualTotalCapCents, reason: 'The institutional limit is shared across Direct Subsidized, Direct Unsubsidized, and PLUS loans; usable amounts require cross-loan allocation.' }
  }
  return { status: 'available' as const, directLoanPolicyVersion: directLoanOriginationLimits.policyVersion, parentPlusPolicyVersion: parentPlusOriginationLimits.policyVersion, institutionalAnnualTotalCapCents: null }
}

export const higherLimitQualificationSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('qualified'), academicYearStart: isoDateSchema, basis: z.enum(['verified_parent_plus_denial', 'verified_faa_exceptional_circumstances']), anotherParentApprovedForSamePeriod: z.literal(false) }),
  z.object({ status: z.literal('not_qualified'), academicYearStart: isoDateSchema, reason: z.enum(['no_qualifying_determination', 'parent_unwilling_to_borrow', 'parent_plus_cap_exhausted', 'another_parent_approved']) }),
  z.object({ status: z.literal('unresolved'), academicYearStart: isoDateSchema }),
])
export type HigherLimitQualification = z.infer<typeof higherLimitQualificationSchema>

export const parentPlusQualificationFactsSchema = z.object({
  academicYearStart: isoDateSchema,
  parentApplicationOutcomes: z.array(z.enum(['denied', 'approved'])).min(1),
  schoolVerifiedQualifyingDenial: z.boolean().nullable(),
})
export function determineHigherLimitQualificationFromParentFacts(input: z.input<typeof parentPlusQualificationFactsSchema>): HigherLimitQualification | PolicyFailure {
  const parsed = parentPlusQualificationFactsSchema.safeParse(input)
  if (!parsed.success || parsed.data.schoolVerifiedQualifyingDenial === null) return insufficient('A verified academic-year-specific higher-limit determination is required.')
  if (parsed.data.parentApplicationOutcomes.includes('approved')) return { status: 'not_qualified', academicYearStart: parsed.data.academicYearStart, reason: 'another_parent_approved' }
  if (parsed.data.parentApplicationOutcomes.includes('denied') && parsed.data.schoolVerifiedQualifyingDenial) return { status: 'qualified', academicYearStart: parsed.data.academicYearStart, basis: 'verified_parent_plus_denial', anotherParentApprovedForSamePeriod: false }
  return { status: 'not_qualified', academicYearStart: parsed.data.academicYearStart, reason: 'no_qualifying_determination' }
}
function qualificationTier(q: HigherLimitQualification, academicYearStart: string) {
  if (q.academicYearStart !== academicYearStart) return insufficient('The higher-limit determination is stale or belongs to another academic year.')
  if (q.status === 'unresolved') return insufficient('Higher-limit dependent eligibility requires an academic-year-specific verified determination.')
  return q.status === 'qualified' ? 'higherLimitDependent' as const : 'standardDependent' as const
}

export const directLoanAnnualLimitInputSchema = z.object({ context: originationContextSchema, gradeLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), higherLimitQualification: higherLimitQualificationSchema })
export function getDirectLoanAnnualLimit(input: z.input<typeof directLoanAnnualLimitInputSchema>) {
  const parsed = directLoanAnnualLimitInputSchema.safeParse(input)
  if (!parsed.success) return insufficient('Direct Loan annual-limit inputs are missing or invalid.')
  const value = parsed.data
  const scope = validateContext(value.context, 'direct')
  if (scope.status !== 'available') return scope
  const tier = qualificationTier(value.higherLimitQualification, value.context.academicYearStart)
  if (typeof tier !== 'string') return tier
  const yearKey = value.gradeLevel === 1 ? 'year1' : value.gradeLevel === 2 ? 'year2' : 'year3Plus'
  const limits = directLoanOriginationLimits.limits[tier]
  const federalCombinedAnnualLimitCents = limits.annual[yearKey].combinedMaxDollars * 100
  const federalSubsidizedAnnualLimitCents = limits.annual[yearKey].subsidizedMaxDollars * 100
  if (value.context.institutionalProgramLimit.status === 'known_total_limit') return { status: 'requires_institutional_allocation' as const, policyVersion: directLoanOriginationLimits.policyVersion, tier, gradeBand: yearKey, federalCombinedAnnualLimitCents, federalSubsidizedAnnualLimitCents, institutionalAnnualTotalCapCents: value.context.institutionalProgramLimit.annualTotalCapCents, reason: 'A usable Direct Loan amount cannot be determined independently from the shared institutional Direct-plus-PLUS total.' }
  return { status: 'available' as const, policyVersion: directLoanOriginationLimits.policyVersion, tier, gradeBand: yearKey, federalCombinedAnnualLimitCents, federalSubsidizedAnnualLimitCents, institutionalAnnualTotalCapCents: null, combinedAnnualLimitCents: federalCombinedAnnualLimitCents, subsidizedAnnualLimitCents: federalSubsidizedAnnualLimitCents }
}

export const aggregateHeadroomInputSchema = z.object({ context: originationContextSchema, higherLimitQualification: higherLimitQualificationSchema, aggregateCountableOutstandingCombinedPrincipalCents: moneyCentsSchema.nullable(), aggregateCountableOutstandingSubsidizedPrincipalCents: moneyCentsSchema.nullable() })
export const aggregatePrincipalComponentsSchema = z.object({
  unconsolidatedEligibleOutstandingPrincipalCents: moneyCentsSchema,
  consolidationAttributableEligibleOutstandingPrincipalCents: moneyCentsSchema,
  capitalizedInterestExcludedCents: moneyCentsSchema,
  otherNoncountingAmountsExcludedCents: moneyCentsSchema,
})
export function calculateAggregateCountableOutstandingPrincipalCents(input: z.input<typeof aggregatePrincipalComponentsSchema>) {
  const value = aggregatePrincipalComponentsSchema.parse(input)
  return value.unconsolidatedEligibleOutstandingPrincipalCents + value.consolidationAttributableEligibleOutstandingPrincipalCents
}
export function getRemainingAggregateHeadroom(input: z.input<typeof aggregateHeadroomInputSchema>) {
  const parsed = aggregateHeadroomInputSchema.safeParse(input)
  if (!parsed.success) return insufficient('Aggregate-countable outstanding principal values are invalid.')
  const value = parsed.data
  const scope = validateContext(value.context, 'direct')
  if (scope.status !== 'available') return scope
  const tier = qualificationTier(value.higherLimitQualification, value.context.academicYearStart)
  if (typeof tier !== 'string') return tier
  const combined = value.aggregateCountableOutstandingCombinedPrincipalCents
  const subsidized = value.aggregateCountableOutstandingSubsidizedPrincipalCents
  if (combined === null || subsidized === null) return insufficient('Complete aggregate-countable outstanding principal is required; neither cumulative borrowing nor an undifferentiated servicer balance is a substitute.')
  if (subsidized > combined) return insufficient('Aggregate-countable outstanding principal values are inconsistent.')
  const limits = directLoanOriginationLimits.limits[tier].aggregate
  return { status: 'available' as const, policyVersion: directLoanOriginationLimits.policyVersion, tier, combinedLimitCents: limits.combinedMaxDollars * 100, subsidizedLimitCents: limits.subsidizedMaxDollars * 100, combinedHeadroomCents: Math.max(0, limits.combinedMaxDollars * 100 - combined), subsidizedHeadroomCents: Math.max(0, limits.subsidizedMaxDollars * 100 - subsidized) }
}

const completeLifetimeHistorySchema = z.object({
  status: z.literal('confirmed_complete'),
  directAndFfelStudentBorrowingCents: moneyCentsSchema,
  graduatePlusStudentBorrowingCents: moneyCentsSchema,
  parentPlusBorrowedAsParentExcludedCents: moneyCentsSchema,
  healAndExcludedHealthProfessionBorrowingCents: moneyCentsSchema,
  convertedTeachGrantBorrowingCents: moneyCentsSchema,
  consolidationUnderlyingPrincipalAlreadyIncluded: z.literal(true),
})
const incompleteLifetimeHistorySchema = z.object({
  status: z.literal('incomplete'),
  directAndFfelStudentBorrowingCents: moneyCentsSchema.nullable(),
  graduatePlusStudentBorrowingCents: moneyCentsSchema.nullable(),
  parentPlusBorrowedAsParentExcludedCents: moneyCentsSchema.nullable(),
  healAndExcludedHealthProfessionBorrowingCents: moneyCentsSchema.nullable(),
  convertedTeachGrantBorrowingCents: moneyCentsSchema.nullable(),
  consolidationUnderlyingPrincipalAlreadyIncluded: z.boolean().nullable(),
})
export const lifetimeBorrowingHistorySchema = z.discriminatedUnion('status', [completeLifetimeHistorySchema, incompleteLifetimeHistorySchema])
export type LifetimeBorrowingHistory = z.infer<typeof lifetimeBorrowingHistorySchema>
export function getCountedLifetimeBorrowingCents(history: LifetimeBorrowingHistory) {
  const parsed = lifetimeBorrowingHistorySchema.safeParse(history)
  if (!parsed.success || parsed.data.status !== 'confirmed_complete') return insufficient('Complete categorized lifetime borrowing history is required.')
  return { status: 'available' as const, countedLifetimeBorrowingCents: parsed.data.directAndFfelStudentBorrowingCents + parsed.data.graduatePlusStudentBorrowingCents }
}
const transitionPredicatesSchema = z.object({
  enrolledInProgramAtInstitutionOn2026_06_30: z.boolean().nullable(),
  qualifyingDirectLoanDisbursedBefore2026_07_01: z.boolean().nullable(),
  qualifyingLoanRecipient: z.enum(['student', 'current_parent']).nullable(),
  qualifyingLoanCanceled: z.boolean().nullable(),
  remainsEnrolledInSameProgram: z.boolean().nullable(),
  withdrewOrOtherwiseCeasedEnrollment: z.boolean().nullable(),
  approvedTitleIvLeaveOfAbsence: z.boolean().nullable(),
  returnedToSameProgramWithinApprovedLeaveWindow: z.boolean().nullable(),
  withinInstitutionDeterminedExpectedTimeToCredential: z.boolean().nullable(),
}).superRefine((value, ctx) => {
  if (value.withdrewOrOtherwiseCeasedEnrollment && value.approvedTitleIvLeaveOfAbsence) ctx.addIssue({ code: 'custom', message: 'An approved Title IV leave is not a withdrawal; these facts cannot both be true.' })
})
export const parentPlusTransitionDeterminationSchema = z.object({
  status: z.enum(['verified_applicable', 'verified_not_applicable', 'stale_or_expired', 'unresolved']),
  institutionIdentifier: z.string().min(1).nullable(),
  programIdentifier: z.string().min(1).nullable(),
  enrollmentPeriodStart: isoDateSchema.nullable(),
  predicates: transitionPredicatesSchema,
})
export type ParentPlusTransitionDetermination = z.infer<typeof parentPlusTransitionDeterminationSchema>
function resolveTransitionException(determination: ParentPlusTransitionDetermination, context: OriginationContext, recipient: 'student_only' | 'student_or_parent') {
  const parsed = parentPlusTransitionDeterminationSchema.safeParse(determination)
  if (!parsed.success) return insufficient('Parent PLUS transition determination is invalid.')
  const value = parsed.data
  if (value.status === 'unresolved') return insufficient('Parent PLUS transition applicability is unresolved.')
  if (value.status === 'stale_or_expired') return insufficient('The transition determination is stale or expired.')
  if (value.enrollmentPeriodStart !== context.enrollmentPeriodStart || value.institutionIdentifier !== context.institutionIdentifier || value.programIdentifier !== context.programIdentifier) return insufficient('The transition determination does not match the requested institution, program, and enrollment period.')
  if (Object.values(value.predicates).some((predicate) => predicate === null)) return insufficient('Every required Parent PLUS transition predicate must be resolved.')
  if (value.status === 'verified_not_applicable') return { applies: false as const }
  const p = value.predicates
  const qualifyingRecipient = recipient === 'student_or_parent' || p.qualifyingLoanRecipient === 'student'
  const qualifyingLoanCounts = p.qualifyingDirectLoanDisbursedBefore2026_07_01 && qualifyingRecipient && !p.qualifyingLoanCanceled
  const validLeave = !p.approvedTitleIvLeaveOfAbsence || p.returnedToSameProgramWithinApprovedLeaveWindow
  const enrollmentContinues = p.remainsEnrolledInSameProgram && !p.withdrewOrOtherwiseCeasedEnrollment && validLeave
  if (!p.enrolledInProgramAtInstitutionOn2026_06_30 || !qualifyingLoanCounts || !enrollmentContinues || !p.withinInstitutionDeterminedExpectedTimeToCredential) return insufficient('A verified-applicable transition determination conflicts with its underlying predicates.')
  return { applies: true as const }
}

export const lifetimeHeadroomInputSchema = z.object({
  context: originationContextSchema,
  transitionDetermination: parentPlusTransitionDeterminationSchema,
  history: lifetimeBorrowingHistorySchema,
})
export function getRemainingLifetimeHeadroom(input: z.input<typeof lifetimeHeadroomInputSchema>) {
  const parsed = lifetimeHeadroomInputSchema.safeParse(input)
  if (!parsed.success) return insufficient('Lifetime-limit inputs are missing, invalid, or contradictory.')
  const value = parsed.data
  const scope = validateContext(value.context, 'direct')
  if (scope.status !== 'available') return scope
  const transition = resolveTransitionException(value.transitionDetermination, value.context, 'student_only')
  if ('status' in transition) return transition
  if (transition.applies) return { status: 'transition_exception' as const, policyVersion: directLoanOriginationLimits.policyVersion, lifetimeLimitCents: null }
  const counted = getCountedLifetimeBorrowingCents(value.history)
  if (counted.status !== 'available') return counted
  const limitCents = directLoanOriginationLimits.limits.lifetimeStudentBorrowing.maxDollars * 100
  return { status: 'available' as const, policyVersion: directLoanOriginationLimits.policyVersion, lifetimeLimitCents: limitCents, countedLifetimeBorrowingCents: counted.countedLifetimeBorrowingCents, lifetimeHeadroomCents: Math.max(0, limitCents - counted.countedLifetimeBorrowingCents) }
}

export const parentPlusInputSchema = z.object({ context: originationContextSchema, creditStatus: z.enum(['eligible', 'denied', 'unknown']), transitionDetermination: parentPlusTransitionDeterminationSchema, allParentsAnnualCumulativeUsageForStudentCents: moneyCentsSchema.nullable(), allParentsAggregateCumulativeUsageForStudentCents: moneyCentsSchema.nullable() }).superRefine((value, ctx) => {
  if (value.allParentsAnnualCumulativeUsageForStudentCents !== null && value.allParentsAggregateCumulativeUsageForStudentCents !== null && value.allParentsAnnualCumulativeUsageForStudentCents > value.allParentsAggregateCumulativeUsageForStudentCents) ctx.addIssue({ code: 'custom', message: 'Annual Parent PLUS usage cannot exceed cumulative aggregate usage.' })
})
export type ParentPlusLimitInput = z.infer<typeof parentPlusInputSchema>
export function getParentPlusLimit(input: ParentPlusLimitInput) {
  const parsed = parentPlusInputSchema.safeParse(input)
  if (!parsed.success) return insufficient('Parent PLUS limit inputs contain missing, invalid, or inconsistent facts.')
  const value = parsed.data
  const scope = validateContext(value.context, 'parent_plus')
  if (scope.status !== 'available') return scope
  if (value.context.institutionalProgramLimit.status === 'known_total_limit') return { status: 'requires_institutional_allocation' as const, policyVersion: parentPlusOriginationLimits.policyVersion, federalAnnualCapCents: parentPlusOriginationLimits.limits.annualPerDependentStudentDollars * 100, federalAggregateCapCents: parentPlusOriginationLimits.limits.aggregatePerDependentStudentDollars * 100, institutionalAnnualTotalCapCents: value.context.institutionalProgramLimit.annualTotalCapCents, reason: 'A usable Parent PLUS amount cannot be determined independently from the shared institutional Direct-plus-PLUS total.' }
  if (value.creditStatus === 'unknown') return insufficient('Parent PLUS credit eligibility is unknown.')
  if (value.creditStatus === 'denied') return { status: 'credit_denied' as const, policyVersion: parentPlusOriginationLimits.policyVersion, requiresSeparateHigherLimitDetermination: true as const }
  const transition = resolveTransitionException(value.transitionDetermination, value.context, 'student_or_parent')
  if ('status' in transition) return transition
  if (transition.applies) return { status: 'transition_exception' as const, policyVersion: parentPlusOriginationLimits.policyVersion, annualCapCents: null, aggregateCapCents: null, limitBasis: 'cost_of_attendance_minus_other_financial_assistance' as const }
  const annualUsage = value.allParentsAnnualCumulativeUsageForStudentCents
  const aggregateUsage = value.allParentsAggregateCumulativeUsageForStudentCents
  if (annualUsage === null || aggregateUsage === null) return insufficient('Cumulative Parent PLUS usage across all parents for the student is required.')
  const annualCapCents = parentPlusOriginationLimits.limits.annualPerDependentStudentDollars * 100
  const aggregateCapCents = parentPlusOriginationLimits.limits.aggregatePerDependentStudentDollars * 100
  const annualHeadroomCents = Math.max(0, annualCapCents - annualUsage)
  const aggregateHeadroomCents = Math.max(0, aggregateCapCents - aggregateUsage)
  const common = { policyVersion: parentPlusOriginationLimits.policyVersion, annualCapCents, aggregateCapCents, annualHeadroomCents, aggregateHeadroomCents, sharedAcrossAllParentsForStudent: true as const }
  if (annualHeadroomCents === 0 || aggregateHeadroomCents === 0) return { status: 'cap_exhausted' as const, ...common, creditDenied: false as const }
  return { status: 'eligible' as const, ...common, maximumBeforeCoaAndOtherAidCents: Math.min(annualHeadroomCents, aggregateHeadroomCents) }
}

export type OriginationFeeLoanType = 'direct_subsidized_undergraduate' | 'direct_unsubsidized_undergraduate' | 'direct_plus_parent'
export const originationFeeInputSchema = z.object({ loanType: z.enum(['direct_subsidized_undergraduate', 'direct_unsubsidized_undergraduate', 'direct_plus_parent']), firstDisbursementDate: isoDateSchema })
export function getOriginationFeePolicy(input: z.input<typeof originationFeeInputSchema>) {
  const parsed = originationFeeInputSchema.safeParse(input)
  if (!parsed.success) return unsupported('The loan type or first-disbursement date is outside the supported origination-fee input.')
  const value = parsed.data
  if (!inWindow(value.firstDisbursementDate, directLoanOriginationFees)) return unavailable(value.firstDisbursementDate)
  const rate = value.loanType === 'direct_plus_parent' ? directLoanOriginationFees.rates.directPlus : directLoanOriginationFees.rates.directSubsidizedOrUnsubsidized
  return { status: 'available' as const, policyVersion: directLoanOriginationFees.policyVersion, firstDisbursementDate: value.firstDisbursementDate, decimalRate: rate.decimalRate, exactNumerator: rate.exactNumerator, exactDenominator: rate.exactDenominator, rounding: directLoanOriginationFees.feeCalculation.rounding }
}
export function calculateOriginationFeeCents(grossLoanAmountCents: number, policy: Extract<ReturnType<typeof getOriginationFeePolicy>, { status: 'available' }>) {
  if (!moneyCentsSchema.safeParse(grossLoanAmountCents).success) throw new RangeError('Gross loan amount must be nonnegative integer cents.')
  return Number((BigInt(grossLoanAmountCents) * BigInt(policy.exactNumerator)) / BigInt(policy.exactDenominator))
}
