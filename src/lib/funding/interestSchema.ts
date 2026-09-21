import { z } from 'zod'

const money = z.number().int().nonnegative().safe()
const rate = z.number().finite().nonnegative().max(100)
const provenance = z.object({ source: z.string().min(1), asOf: z.iso.date().optional() })
const planningRate = z.discriminatedUnion('status', [
  z.object({ status: z.literal('known'), annualRatePercent: rate, provenance }),
  z.object({ status: z.literal('assumed'), annualRatePercent: rate, explanation: z.string().min(1), provenance: z.object({ source: z.string().min(1), createdFor: z.string().min(1) }) }),
  z.object({ status: z.literal('unknown'), reason: z.string().min(1) }),
])
const ledgerEntry = z.object({
  loanId: z.string().min(1), borrowerId: z.string().min(1), borrowerRole: z.enum(['student', 'parent']), studentBeneficiaryId: z.string().min(1), loanType: z.enum(['direct_subsidized', 'direct_unsubsidized', 'parent_plus']), academicYear: z.string().min(1), firstDisbursementDate: z.iso.date(), feePolicyVersion: z.string().min(1),
  rateCohort: z.discriminatedUnion('status', [z.object({ status: z.literal('known'), policyId: z.string().min(1), annualRatePercent: rate }), z.object({ status: z.literal('unknown'), requestedDate: z.iso.date() })]),
  grossPrincipalCents: money, feeCents: money, netProceedsCents: money, scheduleAssumption: z.object({ explanation: z.string().min(1), source: z.string().min(1) }).optional(),
  disbursements: z.array(z.object({ date: z.iso.date(), grossPrincipalCents: money, feeCents: money, netProceedsCents: money })).min(1),
}).superRefine((value, ctx) => {
  if (value.disbursements.reduce((sum, item) => sum + item.grossPrincipalCents, 0) !== value.grossPrincipalCents) ctx.addIssue({ code: 'custom', message: 'Ledger disbursement principal does not reconcile to loan principal.' })
  if (value.disbursements.reduce((sum, item) => sum + item.feeCents, 0) !== value.feeCents) ctx.addIssue({ code: 'custom', message: 'Ledger disbursement fees do not reconcile to the loan fee.' })
  if (value.disbursements.reduce((sum, item) => sum + item.netProceedsCents, 0) !== value.netProceedsCents) ctx.addIssue({ code: 'custom', message: 'Ledger disbursement proceeds do not reconcile to loan net proceeds.' })
  if (value.disbursements.some((item) => item.grossPrincipalCents - item.feeCents !== item.netProceedsCents)) ctx.addIssue({ code: 'custom', message: 'A ledger disbursement violates the gross-minus-fee net-proceeds identity.' })
  if (value.grossPrincipalCents - value.feeCents !== value.netProceedsCents) ctx.addIssue({ code: 'custom', message: 'Ledger gross, fee, and net amounts do not reconcile.' })
  if ([...value.disbursements].sort((a, b) => a.date.localeCompare(b.date))[0]?.date !== value.firstDisbursementDate) ctx.addIssue({ code: 'custom', message: 'First-disbursement date does not match the earliest ledger disbursement.' })
  if ((value.loanType === 'parent_plus') !== (value.borrowerRole === 'parent')) ctx.addIssue({ code: 'custom', message: 'Ledger borrower role does not match the federal loan type.' })
})

export const graduationDebtInputSchema = z.object({
  ledger: z.array(ledgerEntry).superRefine((entries, ctx) => { if (new Set(entries.map((entry) => entry.loanId)).size !== entries.length) ctx.addIssue({ code: 'custom', message: 'Loan IDs must be unique.' }) }),
  graduationDate: z.iso.date(),
  subsidyEnrollment: z.discriminatedUnion('status', [z.object({ status: z.literal('qualifying_in_school'), explanation: z.string().min(1) }), z.object({ status: z.literal('unresolved'), reason: z.string().min(1) }), z.object({ status: z.literal('unsupported'), reason: z.string().min(1) })]),
  inSchoolPayments: z.discriminatedUnion('status', [z.object({ status: z.literal('none_assumed'), explanation: z.string().min(1), source: z.string().min(1) }), z.object({ status: z.literal('payments_planned'), reason: z.string().min(1) })]),
  futureRateResolutions: z.array(z.object({ loanId: z.string().min(1), rate: planningRate })).superRefine((items, ctx) => { if (new Set(items.map((item) => item.loanId)).size !== items.length) ctx.addIssue({ code: 'custom', message: 'Each loan may have only one future-rate resolution.' }) }),
})
