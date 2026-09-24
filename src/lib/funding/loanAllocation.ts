import { getDirectLoanAnnualLimit, getParentPlusLimit, getRemainingAggregateHeadroom, getRemainingLifetimeHeadroom } from '../policy/origination'
import { loanAllocationInputSchema } from './loanSchema'
import { buildLoanLedgerEntry } from './ledger'
import type { AllocationFailure, LoanAllocationInput, LoanLedgerEntry } from './loanTypes'

const failure = (status: AllocationFailure['status'], reason: string, extra: Partial<AllocationFailure> = {}): AllocationFailure => ({ status, reasons: [reason], ...extra })

export function allocateFederalLoans(input: LoanAllocationInput) {
  const parsed = loanAllocationInputSchema.safeParse(input)
  if (!parsed.success) return failure('incomplete', parsed.error.issues.map((issue) => issue.message).join(' '))
  const value = parsed.data
  const institutional = value.context.institutionalProgramLimit
  if (institutional.status === 'unknown') return failure('incomplete', 'Institutional program-limit status is unknown.')
  if (institutional.status === 'known_total_limit' && !value.institutionalAllocation) {
    const requestedInstitutionalTotal = value.directElection.subsidizedGrossCents + value.directElection.unsubsidizedGrossCents + value.parentPlusElections.reduce((sum, item) => sum + item.grossPrincipalCents, 0)
    return failure('requires_institutional_allocation', 'The known shared institutional total requires an explicit allocation among Direct Subsidized, Direct Unsubsidized, and Parent PLUS.', { requested: { institutionalAllocationCents: requestedInstitutionalTotal }, allowed: { institutionalAnnualTotalCapCents: institutional.annualTotalCapCents } })
  }
  if (institutional.status === 'known_total_limit' && value.institutionalAllocation) {
    const allocated = value.institutionalAllocation.directSubsidizedCents + value.institutionalAllocation.directUnsubsidizedCents + value.institutionalAllocation.parentPlusCents
    if (allocated > institutional.annualTotalCapCents) return failure('exceeds_limit', 'The supplied cross-loan allocation exceeds the known institutional annual total.', { requested: { institutionalAllocationCents: allocated }, allowed: { institutionalAnnualTotalCapCents: institutional.annualTotalCapCents } })
  }
  const federalContext = institutional.status === 'known_total_limit' ? { ...value.context, institutionalProgramLimit: { status: 'none_confirmed' as const } } : value.context
  const annual = getDirectLoanAnnualLimit({ context: federalContext, gradeLevel: value.gradeLevel, higherLimitQualification: value.higherLimitQualification })
  if (annual.status !== 'available') return failure(annual.status === 'unsupported' ? 'unsupported' : 'incomplete', annual.reason)
  const aggregate = getRemainingAggregateHeadroom({ context: federalContext, higherLimitQualification: value.higherLimitQualification, aggregateCountableOutstandingCombinedPrincipalCents: value.aggregateHistory.combinedOutstandingPrincipalCents, aggregateCountableOutstandingSubsidizedPrincipalCents: value.aggregateHistory.subsidizedOutstandingPrincipalCents })
  if (aggregate.status !== 'available') return failure(aggregate.status === 'unsupported' ? 'unsupported' : 'incomplete', aggregate.reason)
  const lifetime = getRemainingLifetimeHeadroom({ context: federalContext, transitionDetermination: value.lifetimeTransitionDetermination, history: value.lifetimeHistory })
  if (lifetime.status !== 'available' && lifetime.status !== 'transition_exception') return failure(lifetime.status === 'unsupported' ? 'unsupported' : 'incomplete', lifetime.reason)
  const priorCombined = value.currentYearPriorDirectUsage.combinedGrossCents
  const priorSubsidized = value.currentYearPriorDirectUsage.subsidizedGrossCents
  if (priorCombined === null || priorSubsidized === null) return failure('incomplete', 'Complete current-academic-year Direct Loan usage is required; missing usage is not zero.')
  const requestedSub = value.directElection.subsidizedGrossCents
  const requestedUnsub = value.directElection.unsubsidizedGrossCents
  const requestedCombined = requestedSub + requestedUnsub
  const allocatedSub = value.institutionalAllocation?.directSubsidizedCents ?? Number.MAX_SAFE_INTEGER
  const allocatedUnsub = value.institutionalAllocation?.directUnsubsidizedCents ?? Number.MAX_SAFE_INTEGER
  const allowedCombined = Math.min(Math.max(0, annual.combinedAnnualLimitCents - priorCombined), aggregate.combinedHeadroomCents, lifetime.status === 'available' ? lifetime.lifetimeHeadroomCents : Number.MAX_SAFE_INTEGER, allocatedSub + allocatedUnsub)
  const allowedSub = Math.min(Math.max(0, annual.subsidizedAnnualLimitCents - priorSubsidized), aggregate.subsidizedHeadroomCents, allocatedSub)
  const violations: string[] = []
  if (requestedSub > allowedSub) violations.push('The elected Direct Subsidized amount exceeds its binding annual, aggregate, or institutional ceiling.')
  if (requestedUnsub > allocatedUnsub) violations.push('The elected Direct Unsubsidized amount exceeds its supplied institutional allocation.')
  if (requestedCombined > allowedCombined) violations.push('The combined Direct Loan election exceeds its binding annual, aggregate, lifetime, current-year, or institutional ceiling.')
  if (violations.length) return { status: 'exceeds_limit' as const, reasons: violations, requested: { subsidizedCents: requestedSub, unsubsidizedCents: requestedUnsub, combinedCents: requestedCombined }, allowed: { subsidizedCents: allowedSub, combinedCents: allowedCombined, institutionalUnsubsidizedCents: allocatedUnsub } }

  const parentRequested = value.parentPlusElections.reduce((sum, item) => sum + item.grossPrincipalCents, 0)
  const parentAllocation = value.institutionalAllocation?.parentPlusCents ?? Number.MAX_SAFE_INTEGER
  let parentAllowed = parentAllocation
  const parentPolicies: Array<ReturnType<typeof getParentPlusLimit>> = []
  for (const election of value.parentPlusElections) {
    const result = getParentPlusLimit({ context: federalContext, creditStatus: election.creditStatus, transitionDetermination: election.transitionDetermination, allParentsAnnualCumulativeUsageForStudentCents: value.parentPlusHistory.allParentsAnnualCumulativeUsageCents, allParentsAggregateCumulativeUsageForStudentCents: value.parentPlusHistory.allParentsAggregateCumulativeUsageCents })
    parentPolicies.push(result)
    if (result.status === 'credit_denied') return failure('unsupported', `Parent borrower ${election.borrowerId} is not eligible for a Parent PLUS allocation because credit was denied.`)
    if (result.status === 'insufficient_information' || result.status === 'unavailable') return failure('incomplete', result.reason)
    if (result.status === 'unsupported') return failure('unsupported', result.reason)
    if (result.status === 'cap_exhausted') parentAllowed = 0
    if (result.status === 'eligible') parentAllowed = Math.min(parentAllowed, result.maximumBeforeCoaAndOtherAidCents)
  }
  if (parentRequested > parentAllowed) return { status: 'exceeds_limit' as const, reasons: ['Parent PLUS elections across all parent borrowers exceed the shared annual, aggregate, or institutional ceiling.'], requested: { parentPlusCents: parentRequested }, allowed: { parentPlusCents: parentAllowed } }

  const ledgerInputs = [
    ...(requestedSub ? [{ loanId: `${value.academicYear}:direct-subsidized:${value.directElection.borrowerId}`, borrowerId: value.directElection.borrowerId, borrowerRole: 'student' as const, studentBeneficiaryId: value.studentBeneficiaryId, loanType: 'direct_subsidized' as const, academicYear: value.academicYear, schedule: value.directElection.subsidizedSchedule }] : []),
    ...(requestedUnsub ? [{ loanId: `${value.academicYear}:direct-unsubsidized:${value.directElection.borrowerId}`, borrowerId: value.directElection.borrowerId, borrowerRole: 'student' as const, studentBeneficiaryId: value.studentBeneficiaryId, loanType: 'direct_unsubsidized' as const, academicYear: value.academicYear, schedule: value.directElection.unsubsidizedSchedule }] : []),
    ...value.parentPlusElections.filter((item) => item.grossPrincipalCents > 0).map((item) => ({ loanId: `${value.academicYear}:parent-plus:${item.borrowerId}`, borrowerId: item.borrowerId, borrowerRole: 'parent' as const, studentBeneficiaryId: value.studentBeneficiaryId, loanType: 'parent_plus' as const, academicYear: value.academicYear, schedule: item.schedule })),
  ]
  const built = ledgerInputs.map(buildLoanLedgerEntry)
  const unavailable = built.find((item): item is { status: 'requires_assumption'; reasons: string[] } => 'status' in item)
  if (unavailable) return unavailable
  const ledger = built as LoanLedgerEntry[]
  const studentNetProceedsCents = ledger.filter((item) => item.borrowerRole === 'student').reduce((sum, item) => sum + item.netProceedsCents, 0)
  const parentPlusNetProceedsCents = ledger.filter((item) => item.borrowerRole === 'parent').reduce((sum, item) => sum + item.netProceedsCents, 0)
  const signedRemainingFundingGapCents = value.preLoanGapCents - studentNetProceedsCents - parentPlusNetProceedsCents
  return { status: 'complete' as const, policy: { directAnnual: annual, directAggregate: aggregate, directLifetime: lifetime, parentPlus: parentPolicies }, elections: { directSubsidizedGrossCents: requestedSub, directUnsubsidizedGrossCents: requestedUnsub, parentPlusGrossCents: parentRequested }, ledger, accounting: { preLoanGapCents: value.preLoanGapCents, grossBorrowingCents: ledger.reduce((sum, item) => sum + item.grossPrincipalCents, 0), originationFeesCents: ledger.reduce((sum, item) => sum + item.feeCents, 0), netProceedsCents: studentNetProceedsCents + parentPlusNetProceedsCents, studentNetProceedsCents, parentPlusNetProceedsCents, signedRemainingFundingGapCents, remainingUncoveredFundingGapCents: Math.max(0, signedRemainingFundingGapCents), surplusLoanProceedsCents: Math.max(0, -signedRemainingFundingGapCents) } }
}
