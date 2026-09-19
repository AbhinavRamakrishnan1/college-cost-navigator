import { z } from 'zod'
import { residenceSchema } from '../residence'

export const directLoanTypeSchema=z.enum(['direct_subsidized_undergrad','direct_unsubsidized_undergrad','direct_unsubsidized_grad_professional','direct_plus_parent','direct_plus_grad_professional','direct_consolidation'])
export const filingChoiceSchema=z.enum(['unmarried','married_filing_jointly','married_filing_separately','qualifying_separated_or_inaccessible'])
export const parentPlusHistorySchema=z.object({repaidParentPlus:z.boolean().nullable(),hadQualifyingIdrPaymentBetween2025_07_04And2028_06_30:z.boolean().nullable(),qualifyingPaymentDate:z.iso.date().nullable().optional()})
export const ibrSnapshotSchema=z.object({eligibleBalanceCents:z.number().int().nonnegative(),tenYearStandardCapCents:z.number().int().nonnegative(),cohort:z.enum(['new','old'])})
export const loanScenarioSchema=z.object({
  id:z.string().min(1),name:z.string().trim().min(1).max(80),type:directLoanTypeSchema,
  principalCents:z.number().int().nonnegative(),accruedInterestCents:z.number().int().nonnegative(),
  disbursementDate:z.iso.date(),fixedApr:z.number().finite().min(0).max(1).nullable(),enteredRepaymentAt:z.iso.date().nullable(),
  borrowerAgiCents:z.number().int().nonnegative(),spouseAgiCents:z.number().int().nonnegative(),filingChoice:filingChoiceSchema,
  familySize:z.number().int().min(1).max(50),state:residenceSchema,rapDependents:z.number().int().nonnegative().max(50),
  borrowingHistory:z.enum(['unknown','none','excepted_only','non_excepted']).optional(),
  spouseEligibleDebtCents:z.number().int().nonnegative(),repayePaymentsSince2024:z.number().int().nonnegative(),
  ibrEnrollmentSnapshot:ibrSnapshotSchema.nullable(),parentPlusConsolidationHistory:parentPlusHistorySchema.nullable(),
  subsidizedConsolidationPortionCents:z.number().int().nonnegative(),createdAt:z.string().datetime(),updatedAt:z.string().datetime(),
})
const pathEntrySchema=z.object({year:z.number().int().min(2026),agiCents:z.number().int().nonnegative()})
const dependentEntrySchema=z.object({year:z.number().int().min(2026),dependents:z.number().int().nonnegative()})
export const spouseDebtProjectionSchema=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('constant'),amountCents:z.number().int().nonnegative()}),
  z.object({kind:z.literal('annual_path'),path:z.array(z.object({year:z.number().int().min(2026),amountCents:z.number().int().nonnegative()})).min(1)}),
]).superRefine((value,context)=>{
  if(value.kind==='annual_path'&&value.path.some((entry,index)=>index>0&&entry.year<=value.path[index-1].year))context.addIssue({code:'custom',message:'Spouse debt years must be unique and increasing.'})
})
export const projectionAssumptionsSchema=z.object({
  // Optional for old records: absence deliberately blocks joint RAP projections, not current payments.
  spouseDebtProjection:spouseDebtProjectionSchema.optional(),
  scenarioId:z.string().min(1),incomePath:z.array(pathEntrySchema).min(1),dependentPath:z.array(dependentEntrySchema).min(1),
  povertyGuidelineVersionByYear:z.record(z.string(),z.string()),recertificationAssumption:z.literal('annual_on_time'),
  paymentTimingAssumption:z.literal('on_time_monthly'),extraPayments:z.union([z.literal('none'),z.array(z.object({month:z.number().int().positive(),amountCents:z.number().int().positive()}))]),
}).superRefine((value,context)=>{
  for(const key of ['incomePath','dependentPath'] as const){
    if(value[key].some((entry,index)=>index>0&&entry.year<=value[key][index-1].year))context.addIssue({code:'custom',path:[key],message:'Projection years must be unique and increasing.'})
  }
})
export type DirectLoanType=z.infer<typeof directLoanTypeSchema>
export type LoanScenario=z.infer<typeof loanScenarioSchema>
export type LoanScenarioInput=Omit<LoanScenario,'createdAt'|'updatedAt'>
export type ProjectionAssumptions=z.infer<typeof projectionAssumptionsSchema>
export type IbrCohort='new'|'old'
