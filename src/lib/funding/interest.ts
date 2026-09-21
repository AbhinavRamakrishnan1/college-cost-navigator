import Decimal from 'decimal.js'
import { graduationDebtInputSchema } from './interestSchema'
import type { GraduationDebtInput, GraduationLoanSnapshot, InterestRatePlanningValue, LoanLedgerEntry } from './loanTypes'

const MS_PER_DAY = 86_400_000
const utcDay = (date: string) => Date.parse(`${date}T00:00:00Z`)
export const elapsedInterestDays = (disbursementDate: string, graduationDate: string) => (utcDay(graduationDate) - utcDay(disbursementDate)) / MS_PER_DAY

function resolveRate(loan: LoanLedgerEntry, input: GraduationDebtInput): InterestRatePlanningValue {
  if (loan.rateCohort.status === 'known') return { status: 'known', annualRatePercent: loan.rateCohort.annualRatePercent, provenance: { source: loan.rateCohort.policyId, asOf: loan.firstDisbursementDate } }
  return input.futureRateResolutions.find((item) => item.loanId === loan.loanId)?.rate ?? { status: 'unknown', reason: `No rate assumption was supplied for future cohort ${loan.firstDisbursementDate}.` }
}

function loanInterestCents(loan: LoanLedgerEntry, annualRatePercent: number, graduationDate: string) {
  const rate = new Decimal(annualRatePercent).div(100)
  const interest = loan.disbursements.reduce((sum, item) => sum.plus(new Decimal(item.grossPrincipalCents).times(rate).times(elapsedInterestDays(item.date, graduationDate)).div('365.25')), new Decimal(0))
  return interest.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()
}

export function calculateGraduationDebt(input: GraduationDebtInput) {
  const parsed = graduationDebtInputSchema.safeParse(input)
  if (!parsed.success) return { status: 'incomplete' as const, reasons: parsed.error.issues.map((issue) => issue.message), loans: [], knownPrincipalCents: 0 }
  const value = parsed.data
  if (value.inSchoolPayments.status === 'payments_planned') return { status: 'unsupported' as const, reasons: ['Voluntary in-school payment allocation is outside this engine.'], loans: [], knownPrincipalCents: value.ledger.reduce((sum, loan) => sum + loan.grossPrincipalCents, 0) }
  const loans: GraduationLoanSnapshot[] = value.ledger.map((loan) => {
    const rate = resolveRate(loan, value)
    if (loan.disbursements.some((item) => elapsedInterestDays(item.date, value.graduationDate) < 0)) return { loanId: loan.loanId, borrowerId: loan.borrowerId, borrowerRole: loan.borrowerRole, studentBeneficiaryId: loan.studentBeneficiaryId, loanType: loan.loanType, principalCents: loan.grossPrincipalCents, rate, graduationDate: value.graduationDate, status: 'incomplete', reason: 'Graduation date precedes a loan disbursement.' }
    if (loan.loanType === 'direct_subsidized') {
      if (value.subsidyEnrollment.status !== 'qualifying_in_school') return { loanId: loan.loanId, borrowerId: loan.borrowerId, borrowerRole: loan.borrowerRole, studentBeneficiaryId: loan.studentBeneficiaryId, loanType: loan.loanType, principalCents: loan.grossPrincipalCents, rate, graduationDate: value.graduationDate, status: value.subsidyEnrollment.status === 'unsupported' ? 'unsupported' : 'incomplete', reason: value.subsidyEnrollment.reason }
      if (rate.status === 'unknown') return { loanId: loan.loanId, borrowerId: loan.borrowerId, borrowerRole: loan.borrowerRole, studentBeneficiaryId: loan.studentBeneficiaryId, loanType: loan.loanType, principalCents: loan.grossPrincipalCents, rate, graduationDate: value.graduationDate, status: 'incomplete', reason: rate.reason }
      return { loanId: loan.loanId, borrowerId: loan.borrowerId, borrowerRole: loan.borrowerRole, studentBeneficiaryId: loan.studentBeneficiaryId, loanType: loan.loanType, principalCents: loan.grossPrincipalCents, rate, graduationDate: value.graduationDate, status: 'complete', accruedInterestCents: 0, informationalPrincipalPlusInterestCents: loan.grossPrincipalCents }
    }
    if (rate.status === 'unknown') return { loanId: loan.loanId, borrowerId: loan.borrowerId, borrowerRole: loan.borrowerRole, studentBeneficiaryId: loan.studentBeneficiaryId, loanType: loan.loanType, principalCents: loan.grossPrincipalCents, rate, graduationDate: value.graduationDate, status: 'incomplete', reason: rate.reason }
    const accruedInterestCents = loanInterestCents(loan, rate.annualRatePercent, value.graduationDate)
    return { loanId: loan.loanId, borrowerId: loan.borrowerId, borrowerRole: loan.borrowerRole, studentBeneficiaryId: loan.studentBeneficiaryId, loanType: loan.loanType, principalCents: loan.grossPrincipalCents, rate, graduationDate: value.graduationDate, status: 'complete', accruedInterestCents, informationalPrincipalPlusInterestCents: loan.grossPrincipalCents + accruedInterestCents }
  })
  const summarize = (items: GraduationLoanSnapshot[]) => {
    const principalCents = items.reduce((sum, loan) => sum + loan.principalCents, 0)
    const complete = items.every((loan) => loan.status === 'complete')
    const knownAccruedInterestCents = items.reduce((sum, loan) => sum + (loan.accruedInterestCents ?? 0), 0)
    return { status: complete ? 'complete' as const : 'incomplete' as const, principalCents, knownAccruedInterestCents, ...(complete ? { accruedInterestCents: knownAccruedInterestCents, informationalPrincipalPlusInterestCents: principalCents + knownAccruedInterestCents } : {}) }
  }
  const studentLoans = loans.filter((loan) => loan.borrowerRole === 'student')
  const parentIds = [...new Set(loans.filter((loan) => loan.borrowerRole === 'parent').map((loan) => loan.borrowerId))]
  const student = { ...summarize(studentLoans), subsidizedPrincipalCents: studentLoans.filter((loan) => loan.loanType === 'direct_subsidized').reduce((sum, loan) => sum + loan.principalCents, 0), unsubsidizedPrincipalCents: studentLoans.filter((loan) => loan.loanType === 'direct_unsubsidized').reduce((sum, loan) => sum + loan.principalCents, 0) }
  const parents = parentIds.map((borrowerId) => ({ borrowerId, ...summarize(loans.filter((loan) => loan.borrowerId === borrowerId && loan.borrowerRole === 'parent')) }))
  const allParents = summarize(loans.filter((loan) => loan.borrowerRole === 'parent'))
  const householdAssociated = summarize(loans)
  const unsupported = loans.some((loan) => loan.status === 'unsupported')
  const incomplete = loans.some((loan) => loan.status === 'incomplete')
  return { status: unsupported ? 'unsupported' as const : incomplete ? 'requires_assumption' as const : 'complete' as const, reasons: loans.filter((loan) => loan.status !== 'complete').map((loan) => loan.reason!), loans, summaries: { student, parents, allParents, combinedHouseholdAssociatedBorrowing: householdAssociated }, scopeLabel: 'Projected new debt from this plan at graduation', capitalizationApplied: false as const, parentPlusGracePeriodIncluded: false as const, inSchoolPaymentAssumption: value.inSchoolPayments }
}

