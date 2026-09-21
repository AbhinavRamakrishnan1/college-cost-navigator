import { calculateOriginationFeeCents, getOriginationFeePolicy, type OriginationFeeLoanType } from '../policy/origination'
import { selectFederalLoanRates } from '../policy/selectors'
import type { LoanKind, LoanLedgerEntry, LoanSchedule } from './loanTypes'

const feeType: Record<LoanKind, OriginationFeeLoanType> = { direct_subsidized: 'direct_subsidized_undergraduate', direct_unsubsidized: 'direct_unsubsidized_undergraduate', parent_plus: 'direct_plus_parent' }
const rateKey = { direct_subsidized: 'DIRECT_SUBSIDIZED_UNDERGRADUATE', direct_unsubsidized: 'DIRECT_UNSUBSIDIZED_UNDERGRADUATE', parent_plus: 'DIRECT_PLUS_PARENT' } as const

export function buildLoanLedgerEntry(input: { borrowerId: string; borrowerRole: 'student' | 'parent'; studentBeneficiaryId: string; loanType: LoanKind; academicYear: string; schedule: LoanSchedule }): LoanLedgerEntry | { status: 'requires_assumption'; reasons: string[] } {
  const sorted = [...input.schedule.disbursements].sort((a, b) => a.date.localeCompare(b.date))
  const firstDisbursementDate = sorted[0]?.date
  if (!firstDisbursementDate) return { status: 'requires_assumption', reasons: ['At least one explicit disbursement date and amount is required.'] }
  const policy = getOriginationFeePolicy({ loanType: feeType[input.loanType], firstDisbursementDate })
  if (policy.status !== 'available') return { status: 'requires_assumption', reasons: [`Origination-fee policy is unavailable for first disbursement ${firstDisbursementDate}; a future fee assumption is required.`] }
  const disbursements = sorted.map((item) => {
    const feeCents = calculateOriginationFeeCents(item.grossPrincipalCents, policy)
    return { ...item, feeCents, netProceedsCents: item.grossPrincipalCents - feeCents }
  })
  const grossPrincipalCents = disbursements.reduce((sum, item) => sum + item.grossPrincipalCents, 0)
  const feeCents = disbursements.reduce((sum, item) => sum + item.feeCents, 0)
  const rates = selectFederalLoanRates(firstDisbursementDate)
  const rateCohort = rates.ok
    ? { status: 'known' as const, policyId: rates.value.id, annualRatePercent: rates.value.rates[rateKey[input.loanType]] }
    : { status: 'unknown' as const, requestedDate: firstDisbursementDate }
  return { borrowerId: input.borrowerId, borrowerRole: input.borrowerRole, studentBeneficiaryId: input.studentBeneficiaryId, loanType: input.loanType, academicYear: input.academicYear, firstDisbursementDate, feePolicyVersion: policy.policyVersion, rateCohort, grossPrincipalCents, feeCents, netProceedsCents: grossPrincipalCents - feeCents, ...(input.schedule.assumption ? { scheduleAssumption: input.schedule.assumption } : {}), disbursements }
}

export function explicitlyAssumedTwoTermSchedule(input: { firstDate: string; secondDate: string; grossPrincipalCents: number; explanation: string; source: string }): LoanSchedule {
  const first = Math.floor(input.grossPrincipalCents / 2)
  return { assumption: { explanation: input.explanation, source: input.source }, disbursements: [{ date: input.firstDate, grossPrincipalCents: first }, { date: input.secondDate, grossPrincipalCents: input.grossPrincipalCents - first }] }
}

