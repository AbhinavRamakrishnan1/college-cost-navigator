import { z } from 'zod'
import { higherLimitQualificationSchema, lifetimeBorrowingHistorySchema, originationContextSchema, parentPlusTransitionDeterminationSchema } from '../policy/origination'

const money = z.number().int().nonnegative().safe()
const schedule = z.object({
  assumption: z.object({ explanation: z.string().min(1), source: z.string().min(1) }).optional(),
  disbursements: z.array(z.object({ date: z.iso.date(), grossPrincipalCents: money })).min(1),
})
const directElection = z.object({
  borrowerId: z.string().min(1), subsidizedGrossCents: money, unsubsidizedGrossCents: money,
  subsidizedBasis: z.discriminatedUnion('status', [z.object({ status: z.literal('school_confirmed'), source: z.string().min(1) }), z.object({ status: z.literal('assumed'), explanation: z.string().min(1), source: z.string().min(1) })]),
  subsidizedSchedule: schedule, unsubsidizedSchedule: schedule,
})
const parentElection = z.object({ borrowerId: z.string().min(1), grossPrincipalCents: money, creditStatus: z.enum(['eligible', 'denied', 'unknown']), transitionDetermination: parentPlusTransitionDeterminationSchema, schedule })

export const loanAllocationInputSchema = z.object({
  context: originationContextSchema, academicYear: z.string().min(1), gradeLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), studentBeneficiaryId: z.string().min(1),
  higherLimitQualification: higherLimitQualificationSchema, directElection,
  currentYearPriorDirectUsage: z.object({ combinedGrossCents: money.nullable(), subsidizedGrossCents: money.nullable() }),
  aggregateHistory: z.object({ combinedOutstandingPrincipalCents: money.nullable(), subsidizedOutstandingPrincipalCents: money.nullable() }),
  lifetimeHistory: lifetimeBorrowingHistorySchema, lifetimeTransitionDetermination: parentPlusTransitionDeterminationSchema,
  parentPlusHistory: z.object({ allParentsAnnualCumulativeUsageCents: money.nullable(), allParentsAggregateCumulativeUsageCents: money.nullable() }),
  parentPlusElections: z.array(parentElection),
  institutionalAllocation: z.object({ directSubsidizedCents: money, directUnsubsidizedCents: money, parentPlusCents: money, source: z.string().min(1) }).optional(),
  preLoanGapCents: money,
}).superRefine((value, ctx) => {
  const scheduleTotal = (items: Array<{ grossPrincipalCents: number }>) => items.reduce((sum, item) => sum + item.grossPrincipalCents, 0)
  if (scheduleTotal(value.directElection.subsidizedSchedule.disbursements) !== value.directElection.subsidizedGrossCents) ctx.addIssue({ code: 'custom', message: 'Subsidized disbursements must equal the elected gross principal.' })
  if (scheduleTotal(value.directElection.unsubsidizedSchedule.disbursements) !== value.directElection.unsubsidizedGrossCents) ctx.addIssue({ code: 'custom', message: 'Unsubsidized disbursements must equal the elected gross principal.' })
  for (const election of value.parentPlusElections) if (scheduleTotal(election.schedule.disbursements) !== election.grossPrincipalCents) ctx.addIssue({ code: 'custom', message: `Parent PLUS disbursements for ${election.borrowerId} must equal the elected gross principal.` })
  if (new Set(value.parentPlusElections.map((item) => item.borrowerId)).size !== value.parentPlusElections.length) ctx.addIssue({ code: 'custom', message: 'Each Parent PLUS election must have a distinct borrower identifier.' })
  if (value.currentYearPriorDirectUsage.subsidizedGrossCents !== null && value.currentYearPriorDirectUsage.combinedGrossCents !== null && value.currentYearPriorDirectUsage.subsidizedGrossCents > value.currentYearPriorDirectUsage.combinedGrossCents) ctx.addIssue({ code: 'custom', message: 'Prior subsidized usage cannot exceed prior combined usage.' })
})

