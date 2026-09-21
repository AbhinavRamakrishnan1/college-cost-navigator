import type { HigherLimitQualification, LifetimeBorrowingHistory, OriginationContext, ParentPlusTransitionDetermination } from '../policy/origination'

export type LoanKind = 'direct_subsidized' | 'direct_unsubsidized' | 'parent_plus'
export type ExplicitDisbursement = { date: string; grossPrincipalCents: number }
export type LoanSchedule = { assumption?: { explanation: string; source: string }; disbursements: ExplicitDisbursement[] }

export type DirectLoanElection = {
  borrowerId: string
  subsidizedGrossCents: number
  unsubsidizedGrossCents: number
  subsidizedBasis: { status: 'school_confirmed'; source: string } | { status: 'assumed'; explanation: string; source: string }
  subsidizedSchedule: LoanSchedule
  unsubsidizedSchedule: LoanSchedule
}

export type ParentPlusElection = {
  borrowerId: string
  grossPrincipalCents: number
  creditStatus: 'eligible' | 'denied' | 'unknown'
  transitionDetermination: ParentPlusTransitionDetermination
  schedule: LoanSchedule
}

export type InstitutionalLoanAllocation = {
  directSubsidizedCents: number
  directUnsubsidizedCents: number
  parentPlusCents: number
  source: string
}

export type LoanAllocationInput = {
  context: OriginationContext
  academicYear: string
  gradeLevel: 1 | 2 | 3 | 4
  studentBeneficiaryId: string
  higherLimitQualification: HigherLimitQualification
  directElection: DirectLoanElection
  currentYearPriorDirectUsage: { combinedGrossCents: number | null; subsidizedGrossCents: number | null }
  aggregateHistory: { combinedOutstandingPrincipalCents: number | null; subsidizedOutstandingPrincipalCents: number | null }
  lifetimeHistory: LifetimeBorrowingHistory
  lifetimeTransitionDetermination: ParentPlusTransitionDetermination
  parentPlusHistory: { allParentsAnnualCumulativeUsageCents: number | null; allParentsAggregateCumulativeUsageCents: number | null }
  parentPlusElections: ParentPlusElection[]
  institutionalAllocation?: InstitutionalLoanAllocation
  preLoanGapCents: number
}

export type LedgerDisbursement = { date: string; grossPrincipalCents: number; feeCents: number; netProceedsCents: number }
export type LoanLedgerEntry = {
  borrowerId: string
  borrowerRole: 'student' | 'parent'
  studentBeneficiaryId: string
  loanType: LoanKind
  academicYear: string
  firstDisbursementDate: string
  feePolicyVersion: string
  rateCohort: { status: 'known'; policyId: string; annualRatePercent: number } | { status: 'unknown'; requestedDate: string }
  grossPrincipalCents: number
  feeCents: number
  netProceedsCents: number
  scheduleAssumption?: { explanation: string; source: string }
  disbursements: LedgerDisbursement[]
}

export type AllocationFailureStatus = 'incomplete' | 'requires_assumption' | 'requires_institutional_allocation' | 'unsupported' | 'exceeds_limit'
export type AllocationFailure = { status: AllocationFailureStatus; reasons: string[]; requested?: Record<string, number>; allowed?: Record<string, number> }

