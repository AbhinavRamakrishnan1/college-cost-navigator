import { z } from 'zod'
import directLoanLimitsJson from '../../data/policy/direct-loan-origination-limits-2026-07-01.v1.json'
import parentPlusLimitsJson from '../../data/policy/parent-plus-origination-limits-2026-07-01.v1.json'
import originationFeesJson from '../../data/policy/direct-loan-origination-fees-2026.v1.json'
import originationIntegrityJson from '../../data/policy/origination-policy-integrity-v1.0.json'

const primarySourceSchema = z.object({
  id: z.string().min(1),
  agency: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url(),
  locators: z.array(z.string().min(1)).min(1),
})

const metadataShape = {
  schemaVersion: z.literal(1),
  policyVersion: z.string().min(1),
  effectiveFrom: z.iso.date(),
  effectiveTo: z.iso.date().nullable(),
  verifiedAsOf: z.iso.date(),
}

const validWindow = <T extends z.ZodType<{ effectiveFrom: string; effectiveTo: string | null }>>(schema: T) => schema.refine(
  (policy) => policy.effectiveTo === null || policy.effectiveFrom <= policy.effectiveTo,
  { message: 'Policy effectiveFrom must not be after effectiveTo.' },
)

const annualLimitSchema = z.object({
  combinedMaxDollars: z.number().int().positive(),
  subsidizedMaxDollars: z.number().int().positive(),
}).refine((limit) => limit.subsidizedMaxDollars <= limit.combinedMaxDollars, {
  message: 'The subsidized ceiling cannot exceed the combined ceiling.',
})

const limitTierSchema = z.object({
  annual: z.object({
    year1: annualLimitSchema,
    year2: annualLimitSchema,
    year3Plus: annualLimitSchema,
  }),
  aggregate: z.object({
    combinedMaxDollars: z.number().int().positive(),
    subsidizedMaxDollars: z.number().int().positive(),
  }),
})

export const directLoanOriginationLimitsSchema = validWindow(z.object({
  ...metadataShape,
  effectiveDateBasis: z.literal('academic_year_start'),
  scope: z.literal('dependent_undergraduate_full_time_standard_academic_year'),
  limits: z.object({
    standardDependent: limitTierSchema,
    higherLimitDependent: limitTierSchema.extend({
      requiresExplicitQualification: z.literal(true),
      qualifyingDetermination: z.literal('parent_plus_credit_denial_or_documented_financial_aid_administrator_exceptional_circumstances'),
      nonqualifyingFacts: z.array(z.enum(['parent_refusal_to_borrow', 'parent_plus_aggregate_cap_exhaustion'])).length(2),
    }),
    lifetimeStudentBorrowing: z.object({
      maxDollars: z.number().int().positive(),
      excludesParentPlusBorrowedAsParent: z.literal(true),
      repaymentForgivenessCancellationOrDischargeRestoresHeadroom: z.literal(false),
      returnedLoanFundsCountTowardLimit: z.literal(false),
      consolidationLoansDoubleCountUnderlyingLoans: z.literal(false),
      transitionExceptionRequiresExplicitDetermination: z.literal(true),
      transitionExceptionLimitTreatment: z.literal('not_applicable_during_verified_expected_time_to_credential'),
    }),
  }),
  aggregateAccounting: z.object({
    capitalizedInterestCountsTowardUndergraduateAggregate: z.literal(false),
    consolidationAttributableUnderlyingPrincipalCounts: z.literal(true),
    basis: z.literal('aggregate_countable_outstanding_principal'),
    repaymentOfCountablePrincipalRestoresHeadroom: z.literal(true),
    undifferentiatedServicerBalanceIsSufficient: z.literal(false),
  }),
  lifetimeAccounting: z.object({
    includesDirectAndFfelStudentBorrowing: z.literal(true),
    includesGraduatePlusBorrowedAsStudent: z.literal(true),
    excludesParentPlusBorrowedAsParent: z.literal(true),
    excludesHealAndSpecifiedHealthProfessionBorrowing: z.literal(true),
    excludesConvertedTeachGrants: z.literal(true),
    requiresCompleteCategorizedHistory: z.literal(true),
  }),
  institutionalLimitAccounting: z.object({
    basis: z.literal('shared_total_across_direct_subsidized_unsubsidized_and_plus'),
    requiresCrossLoanAllocationForUsableAmounts: z.literal(true),
  }),
  primarySources: z.array(primarySourceSchema).min(2),
}))

export const parentPlusOriginationLimitsSchema = validWindow(z.object({
  ...metadataShape,
  effectiveDateBasis: z.literal('period_of_enrollment_beginning_on_or_after'),
  scope: z.literal('parent_plus_for_dependent_undergraduate'),
  limits: z.object({
    annualPerDependentStudentDollars: z.number().int().positive(),
    aggregatePerDependentStudentDollars: z.number().int().positive(),
    sharedAcrossAllParentsForStudent: z.literal(true),
    repaymentForgivenessCancellationOrDischargeRestoresHeadroom: z.literal(false),
    returnedLoanFundsCountTowardAggregate: z.literal(false),
    alsoLimitedBy: z.literal('cost_of_attendance_minus_other_financial_assistance'),
    institutionalProgramTotalLimitRequiresCrossLoanAllocation: z.literal(true),
  }),
  transitionException: z.object({
    appliesToAnnualAndAggregateCaps: z.literal(true),
    enrolledInProgramAtInstitutionAsOf: z.literal('2026-06-30'),
    qualifyingDirectLoanMustBeDisbursedBefore: z.literal('2026-07-01'),
    qualifyingLoanMayHaveBeenMadeTo: z.array(z.enum(['dependent_student_for_same_program', 'current_parent_borrower_for_same_program_and_student'])).length(2),
    requiresContinuedEnrollmentInProgram: z.literal(true),
    majorChangeWithinSameDegreeOrCertificateRemainsSameProgram: z.literal(true),
    maximumAcademicYears: z.literal(3),
    durationRule: z.literal('lesser_of_three_academic_years_or_published_program_length_minus_completed_time_as_of_2026_07_01'),
    legacyLimitWhileExceptionApplies: z.literal('cost_of_attendance_minus_other_financial_assistance'),
  }),
  decisionStates: z.array(z.enum(['eligible', 'credit_denied', 'cap_exhausted', 'transition_exception', 'insufficient_information', 'unsupported'])).length(6),
  primarySources: z.array(primarySourceSchema).min(2),
}))

const exactRateSchema = z.object({
  decimalRate: z.number().positive().max(1),
  exactNumerator: z.number().int().positive(),
  exactDenominator: z.number().int().positive(),
}).refine((rate) => rate.decimalRate === rate.exactNumerator / rate.exactDenominator, {
  message: 'The displayed rate must equal the exact rational rate.',
})

export const directLoanOriginationFeesSchema = validWindow(z.object({
  ...metadataShape,
  effectiveDateBasis: z.literal('first_disbursement_date'),
  effectiveTo: z.iso.date(),
  feeCalculation: z.object({
    rounding: z.literal('truncate_fractional_cent'),
    deductedProportionatelyFromEachDisbursement: z.literal(true),
  }),
  rates: z.object({
    directSubsidizedOrUnsubsidized: exactRateSchema,
    directPlus: exactRateSchema,
  }),
  primarySources: z.array(primarySourceSchema).min(1),
}))

export const originationPolicyIntegritySchema = z.object({
  schemaVersion: z.literal(1),
  policyVersion: z.literal('funding-origination-policy-foundation-v1.0'),
  verifiedAsOf: z.iso.date(),
  algorithm: z.literal('sha256'),
  normalization: z.literal('utf8_lf'),
  files: z.record(z.string().min(1), z.string().regex(/^[a-f0-9]{64}$/)).refine((files) => Object.keys(files).length === 3, {
    message: 'The integrity manifest must cover all three origination policy datasets.',
  }),
})

export const directLoanOriginationLimits = directLoanOriginationLimitsSchema.parse(directLoanLimitsJson)
export const parentPlusOriginationLimits = parentPlusOriginationLimitsSchema.parse(parentPlusLimitsJson)
export const directLoanOriginationFees = directLoanOriginationFeesSchema.parse(originationFeesJson)
export const originationPolicyIntegrity = originationPolicyIntegritySchema.parse(originationIntegrityJson)

export type DirectLoanOriginationLimitsPolicy = z.infer<typeof directLoanOriginationLimitsSchema>
export type ParentPlusOriginationLimitsPolicy = z.infer<typeof parentPlusOriginationLimitsSchema>
export type DirectLoanOriginationFeesPolicy = z.infer<typeof directLoanOriginationFeesSchema>
