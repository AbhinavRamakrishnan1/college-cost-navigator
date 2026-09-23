import { calculateGraduationDebt } from './interest'
import { allocateFederalLoans } from './loanAllocation'
import type { LoanAllocationInput, LoanLedgerEntry } from './loanTypes'
import { calculatePreLoanFundingPlan, type FundingPlanInput } from './plan'
import { fundingPlanInputSchema } from './schema'
import type { NonLoanFundingEntry, PlanningMoney } from './types'
import type { HigherLimitQualification, LifetimeBorrowingHistory, ParentPlusTransitionDetermination } from '../policy/origination'
import type { SchoolRecord } from '../scorecard/schema'

export type Knowledge = 'known' | 'assumed' | 'unknown'
export type PlannerMoney = { status: Knowledge; amount: number; explanation: string; source: string }
export type PlannerFundingFact = PlannerMoney & { schedule: 'recurring' | 'one_time' | 'custom_year'; year: number }
export type PlannerComponentKey = 'tuition' | 'housing' | 'books' | 'transportation' | 'other'
export type PlannerFundingKey = 'grant' | 'scholarship' | 'otherGrant' | 'familyCash'

export type PlannerTransition = {
  status: 'unresolved' | 'verified_not_applicable' | 'verified_applicable' | 'stale_or_expired'
  institutionIdentifier: string
  programIdentifier: string
  enrollmentPeriodStart: string
  predicates: {
    enrolledInProgramAtInstitutionOn2026_06_30: boolean | null
    qualifyingDirectLoanDisbursedBefore2026_07_01: boolean | null
    qualifyingLoanRecipient: 'student' | 'current_parent' | null
    qualifyingLoanCanceled: boolean | null
    remainsEnrolledInSameProgram: boolean | null
    withdrewOrOtherwiseCeasedEnrollment: boolean | null
    approvedTitleIvLeaveOfAbsence: boolean | null
    returnedToSameProgramWithinApprovedLeaveWindow: boolean | null
    withinInstitutionDeterminedExpectedTimeToCredential: boolean | null
  }
}

export type PlannerHigherLimit = {
  status: 'qualified' | 'not_qualified' | 'unresolved' | 'stale'
  basis: 'verified_parent_plus_denial' | 'verified_faa_exceptional_circumstances'
  reason: 'no_qualifying_determination' | 'parent_unwilling_to_borrow' | 'parent_plus_cap_exhausted' | 'another_parent_approved'
}

export type PlannerHistory = {
  status: 'incomplete' | 'confirmed_complete'
  directOutstanding: number | null
  subsidizedOutstanding: number | null
  lifetimeDirectAndFfel: number | null
  lifetimeGraduatePlus: number | null
  parentPlusBorrowedAsParentExcluded: number | null
  healExcluded: number | null
  convertedTeachGrant: number | null
  consolidationUnderlyingIncluded: boolean | null
  parentPlusAggregate: number | null
  currentYearDirect: Array<number | null>
  currentYearSubsidized: Array<number | null>
  currentYearParentPlus: Array<number | null>
}

export type PlannerSchoolPlan = {
  costMode: 'total' | 'components'
  totalCost: PlannerMoney
  components: Record<PlannerComponentKey, PlannerMoney>
  overrides: Array<{ enabled: boolean; amount: number; explanation: string }>
  pell: PlannerMoney[]
  funding: Record<PlannerFundingKey, PlannerFundingFact>
  programIdentifier: string
  programScope: 'unknown' | 'supported' | 'unsupported'
  educationLevel: 'unknown' | 'undergraduate' | 'graduate_professional'
  enrollmentPattern: 'unknown' | 'full_time_standard_academic_year' | 'part_time' | 'summer_or_nonstandard' | 'transfer_specific' | 'shortened_or_nonterm'
  gradeLevels: Array<1 | 2 | 3 | 4 | null>
  academicYearStarts: string[]
  enrollmentPeriodStarts: string[]
  higherLimits: PlannerHigherLimit[]
  subsidizedGross: number[]
  unsubsidizedGross: number[]
  parentPlusGross: number[]
  secondParentPlusGross: number[]
  parentLabel: string
  secondParentLabel: string
  parentCredit: 'eligible' | 'denied' | 'unknown'
  secondParentCredit: 'eligible' | 'denied' | 'unknown'
  transition: PlannerTransition[]
  institutionalStatus: 'none_confirmed' | 'unknown' | 'known_total_limit'
  institutionalTotal: number
  institutionalSub: number
  institutionalUnsub: number
  institutionalPlus: number
  institutionalAllocationConfirmed: boolean
  disbursementDates: string[]
  disbursementAssumptionAccepted: boolean
}

export type PlannerSharedState = {
  horizon: 4 | 5
  growthMode: 'flat' | 'percentage'
  growth: number
  dependencyStatus: 'dependent' | 'independent' | 'missing'
  history: PlannerHistory
  futureRates: Array<number | null>
  graduationDate: string
  subsidyEnrollment: 'unresolved' | 'qualifying_in_school' | 'unsupported'
  noInSchoolPaymentsAccepted: boolean
}

export type MetricStatus = 'complete' | 'partial' | 'incomplete'
export type AggregateMetric = { status: MetricStatus; knownCents?: number; resolvedYears: number; totalYears: number; reasons: string[] }
export type PlannerValidationError = { field: string; message: string; step: number; year?: number }
export type PlannerAllocationResult = ReturnType<typeof allocateFederalLoans>

export type PlannerSchoolResult = {
  status: 'complete' | 'incomplete' | 'unsupported' | 'error'
  school: SchoolRecord
  errors: PlannerValidationError[]
  funding: ReturnType<typeof calculatePreLoanFundingPlan> | null
  allocations: PlannerAllocationResult[]
  graduation: ReturnType<typeof calculateGraduationDebt> | null
  futureRateResolutions: Array<{ loanId: string; rate: { status: 'unknown'; reason: string } | { status: 'assumed'; annualRatePercent: number; explanation: string; provenance: { source: string; createdFor: string } } }>
  omittedElectedPrincipalCents: number
  metrics: Record<'cost' | 'grants' | 'familyCash' | 'studentGross' | 'studentNet' | 'parentPlusGross' | 'parentPlusNet' | 'fees' | 'gap' | 'surplus' | 'studentPrincipal' | 'studentInterest' | 'studentDebt' | 'parentPrincipal' | 'parentInterest' | 'parentDebt', AggregateMetric>
  missingReasons: string[]
}

const cents = (amount: number) => Math.round(amount * 100)
const validMoney = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return false
  const scaled = value * 100
  return Number.isSafeInteger(Math.round(scaled)) && Math.abs(scaled - Math.round(scaled)) < 1e-7
}
const validIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
const knownMoney = (amount: number, source: string): PlanningMoney => ({ status: 'known', value: cents(amount), provenance: { source } })
const assumedMoney = (amount: number, explanation: string, source = 'User planning input'): PlanningMoney => ({ status: 'assumed', value: cents(amount), explanation, provenance: { source, createdFor: 'Funding plan' } })
const planningMoney = (fact: PlannerMoney, unknownReason: string): PlanningMoney => fact.status === 'unknown' ? { status: 'unknown', reason: unknownReason } : fact.status === 'known' ? knownMoney(fact.amount, fact.source) : assumedMoney(fact.amount, fact.explanation, fact.source)

export function createUnknownMoney(source = 'User input required'): PlannerMoney {
  return { status: 'unknown', amount: 0, explanation: '', source }
}

export function createPlannerSchoolPlan(school: SchoolRecord, pell: number | null): PlannerSchoolPlan {
  const unknown = () => createUnknownMoney()
  return {
    costMode: 'total',
    totalCost: school.costOfAttendance == null ? unknown() : { status: 'known', amount: school.costOfAttendance, explanation: '', source: `College Scorecard ${school.dataYear} snapshot, UNITID ${school.unitId}` },
    components: {
      tuition: school.tuitionInState == null ? unknown() : { status: 'known', amount: school.tuitionInState, explanation: '', source: `College Scorecard ${school.dataYear} snapshot, UNITID ${school.unitId}` },
      housing: unknown(), books: unknown(), transportation: unknown(), other: unknown(),
    },
    overrides: Array.from({ length: 5 }, () => ({ enabled: false, amount: 0, explanation: 'Explicit annual cost override' })),
    pell: Array.from({ length: 5 }, (_, index) => index === 0 && pell !== null
      ? { status: 'known', amount: pell, explanation: '', source: 'Verified local SAI/Pell calculation' }
      : { ...unknown(), source: 'Future Pell must be confirmed or assumed' }),
    funding: {
      grant: { ...unknown(), schedule: 'recurring', year: 1 },
      scholarship: { ...unknown(), schedule: 'recurring', year: 1 },
      otherGrant: { ...unknown(), schedule: 'recurring', year: 1 },
      familyCash: { ...unknown(), schedule: 'recurring', year: 1 },
    },
    programIdentifier: '', programScope: 'unknown', educationLevel: 'unknown', enrollmentPattern: 'unknown',
    gradeLevels: [null, null, null, null, null], academicYearStarts: ['', '', '', '', ''], enrollmentPeriodStarts: ['', '', '', '', ''],
    higherLimits: Array.from({ length: 5 }, () => ({ status: 'unresolved', basis: 'verified_parent_plus_denial', reason: 'no_qualifying_determination' })),
    subsidizedGross: [0, 0, 0, 0, 0], unsubsidizedGross: [0, 0, 0, 0, 0], parentPlusGross: [0, 0, 0, 0, 0], secondParentPlusGross: [0, 0, 0, 0, 0],
    parentLabel: 'Parent borrower 1', secondParentLabel: 'Parent borrower 2', parentCredit: 'unknown', secondParentCredit: 'unknown',
    transition: Array.from({ length: 5 }, () => ({ status: 'unresolved', institutionIdentifier: String(school.unitId), programIdentifier: '', enrollmentPeriodStart: '', predicates: { enrolledInProgramAtInstitutionOn2026_06_30: null, qualifyingDirectLoanDisbursedBefore2026_07_01: null, qualifyingLoanRecipient: null, qualifyingLoanCanceled: null, remainsEnrolledInSameProgram: null, withdrewOrOtherwiseCeasedEnrollment: null, approvedTitleIvLeaveOfAbsence: null, returnedToSameProgramWithinApprovedLeaveWindow: null, withinInstitutionDeterminedExpectedTimeToCredential: null } })),
    institutionalStatus: 'unknown', institutionalTotal: 0, institutionalSub: 0, institutionalUnsub: 0, institutionalPlus: 0, institutionalAllocationConfirmed: false,
    disbursementDates: ['', '', '', '', ''], disbursementAssumptionAccepted: false,
  }
}

export function createPlannerSharedState(dependencyStatus: PlannerSharedState['dependencyStatus']): PlannerSharedState {
  return {
    horizon: 4, growthMode: 'flat', growth: 0, dependencyStatus,
    history: { status: 'incomplete', directOutstanding: null, subsidizedOutstanding: null, lifetimeDirectAndFfel: null, lifetimeGraduatePlus: null, parentPlusBorrowedAsParentExcluded: null, healExcluded: null, convertedTeachGrant: null, consolidationUnderlyingIncluded: null, parentPlusAggregate: null, currentYearDirect: [null, null, null, null, null], currentYearSubsidized: [null, null, null, null, null], currentYearParentPlus: [null, null, null, null, null] },
    futureRates: [null, null, null, null, null], graduationDate: '', subsidyEnrollment: 'unresolved', noInSchoolPaymentsAccepted: false,
  }
}

function validateMoney(fact: PlannerMoney, field: string, step: number, errors: PlannerValidationError[], year?: number) {
  if (fact.status !== 'unknown' && !validMoney(fact.amount)) errors.push({ field: `${field}-amount`, message: 'Enter a finite, nonnegative amount with no more than two decimal places.', step, ...(year === undefined ? {} : { year }) })
  if (fact.status === 'assumed' && !fact.explanation.trim()) errors.push({ field: `${field}-explanation`, message: 'Explain this planning assumption.', step, ...(year === undefined ? {} : { year }) })
}

function validateDollar(value: number | null, field: string, label: string, step: number, errors: PlannerValidationError[], year?: number) {
  if (value === null) {
    errors.push({ field, message: `${label} remains unknown.`, step, ...(year === undefined ? {} : { year }) })
  } else if (!validMoney(value)) {
    errors.push({ field, message: `${label} must be a finite, nonnegative amount with no more than two decimal places.`, step, ...(year === undefined ? {} : { year }) })
  }
}

function validateDate(value: string, field: string, missingMessage: string, step: number, errors: PlannerValidationError[], year?: number) {
  if (!value) errors.push({ field, message: missingMessage, step, ...(year === undefined ? {} : { year }) })
  else if (!validIsoDate(value)) errors.push({ field, message: 'Enter a valid calendar date in YYYY-MM-DD format.', step, ...(year === undefined ? {} : { year }) })
}

export function validatePlannerInputs(school: SchoolRecord, plan: PlannerSchoolPlan, shared: PlannerSharedState): PlannerValidationError[] {
  const errors: PlannerValidationError[] = []
  if (shared.dependencyStatus === 'missing') errors.push({ field: 'planner-scope', message: 'Create or load a household profile before federal borrowing can be modeled.', step: 0 })
  if (shared.dependencyStatus === 'independent') errors.push({ field: 'planner-scope', message: 'Independent-student origination planning is unsupported in Phase 3.', step: 0 })
  if (plan.educationLevel === 'unknown') errors.push({ field: 'educationLevel', message: 'Confirm undergraduate education level.', step: 0 })
  if (plan.educationLevel === 'graduate_professional') errors.push({ field: 'educationLevel', message: 'Graduate/professional origination planning is unsupported in Phase 3.', step: 0 })
  if (plan.enrollmentPattern === 'unknown') errors.push({ field: 'enrollmentPattern', message: 'Confirm the enrollment and academic-year structure.', step: 0 })
  if (plan.enrollmentPattern !== 'unknown' && plan.enrollmentPattern !== 'full_time_standard_academic_year') errors.push({ field: 'enrollmentPattern', message: 'Only full-time standard academic years are supported in Phase 3.', step: 0 })
  if (!plan.programIdentifier.trim()) errors.push({ field: 'programIdentifier', message: 'Enter the school program identifier used for this plan.', step: 0 })
  if (plan.programScope === 'unknown') errors.push({ field: 'programScope', message: 'Confirm whether the program is within the supported standard undergraduate scope.', step: 0 })
  if (plan.programScope === 'unsupported') errors.push({ field: 'programScope', message: 'This program structure is unsupported in Phase 3.', step: 0 })
  if (!String(school.unitId)) errors.push({ field: 'planner-scope', message: 'A valid selected-school UNITID is required.', step: 0 })
  if (shared.growthMode === 'percentage' && (!Number.isFinite(shared.growth) || shared.growth < -100 || shared.growth > 100)) errors.push({ field: 'growth', message: 'Enter a growth percentage from -100 through 100.', step: 1 })
  validateMoney(plan.totalCost, 'totalCost', 1, errors)
  Object.entries(plan.components).forEach(([key, fact]) => validateMoney(fact, `component-${key}`, 1, errors))
  plan.pell.slice(0, shared.horizon).forEach((fact, i) => validateMoney(fact, `pell-${i}`, 2, errors, i))
  Object.entries(plan.funding).forEach(([key, fact]) => { const step = key === 'familyCash' ? 3 : 2; validateMoney(fact, `funding-${key}`, step, errors); if (fact.schedule === 'custom_year' && (fact.year < 1 || fact.year > shared.horizon)) errors.push({ field: `funding-${key}-year`, message: `Choose a custom year within this ${shared.horizon}-year plan.`, step }) })
  plan.overrides.slice(0, shared.horizon).forEach((override, i) => { if (override.enabled && !validMoney(override.amount)) errors.push({ field: `override-${i}`, message: 'Enter a finite, nonnegative annual override with no more than two decimal places.', step: 1, year: i }) })
  shared.futureRates.slice(0, shared.horizon).forEach((rate, i) => { if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) errors.push({ field: `futureRate-${i}`, message: 'Enter a rate from 0 through 100, or leave it unknown.', step: 6, year: i }) })
  for (let i = 0; i < shared.horizon; i += 1) {
    if (plan.gradeLevels[i] === null) errors.push({ field: `grade-${i}`, message: `Resolve the grade level for Year ${i + 1}; it is not inferred from planner year.`, step: 4, year: i })
    validateDate(plan.academicYearStarts[i], `academicYearStart-${i}`, `Enter the academic-year start for Year ${i + 1}.`, 4, errors, i)
    validateDate(plan.enrollmentPeriodStarts[i], `enrollmentPeriodStart-${i}`, `Enter the enrollment-period start for Year ${i + 1}.`, 4, errors, i)
    validateDate(plan.disbursementDates[i], `disbursementDate-${i}`, `Enter a first-disbursement date for Year ${i + 1}.`, 6, errors, i)
    if (plan.higherLimits[i].status === 'unresolved') errors.push({ field: `higherLimit-${i}`, message: `Higher-limit qualification is unresolved for Year ${i + 1}.`, step: 4, year: i })
    if (plan.higherLimits[i].status === 'stale') errors.push({ field: `higherLimit-${i}`, message: `Higher-limit qualification is stale for Year ${i + 1}; obtain a current determination.`, step: 4, year: i })
    if (plan.transition[i].status === 'unresolved') errors.push({ field: `transition-${i}`, message: `Transition-exception applicability is unresolved for Year ${i + 1}.`, step: 5, year: i })
    if (plan.transition[i].status === 'stale_or_expired') errors.push({ field: `transition-${i}`, message: `Transition-exception evidence is stale for Year ${i + 1}.`, step: 5, year: i })
    if ((plan.transition[i].status === 'verified_applicable' || plan.transition[i].status === 'verified_not_applicable') && Object.values(plan.transition[i].predicates).some((value) => value === null)) errors.push({ field: `transition-${i}`, message: `Every transition-exception predicate must be explicitly resolved for Year ${i + 1}.`, step: 5, year: i })
    validateDollar(shared.history.currentYearDirect[i], 'current-year-direct-usage', `Current-year Direct usage for Year ${i + 1}`, 4, errors, i)
    validateDollar(shared.history.currentYearSubsidized[i], 'current-year-subsidized-usage', `Current-year subsidized usage for Year ${i + 1}`, 4, errors, i)
    validateDollar(shared.history.currentYearParentPlus[i], 'current-year-parent-plus-usage', `Current-year Parent PLUS usage for Year ${i + 1}`, 4, errors, i)
    if (shared.history.currentYearDirect[i] !== null && shared.history.currentYearSubsidized[i] !== null && validMoney(shared.history.currentYearDirect[i]!) && validMoney(shared.history.currentYearSubsidized[i]!) && shared.history.currentYearSubsidized[i]! > shared.history.currentYearDirect[i]!) errors.push({ field: 'current-year-subsidized-usage', message: `Current-year subsidized usage cannot exceed total Direct usage for Year ${i + 1}.`, step: 4, year: i })
    if (!validMoney(plan.subsidizedGross[i])) errors.push({ field: 'requested-direct-subsidized-gross-principal', message: `Requested Direct Subsidized principal for Year ${i + 1} must be a finite, nonnegative amount with no more than two decimal places.`, step: 4, year: i })
    if (!validMoney(plan.unsubsidizedGross[i])) errors.push({ field: 'requested-direct-unsubsidized-gross-principal', message: `Requested Direct Unsubsidized principal for Year ${i + 1} must be a finite, nonnegative amount with no more than two decimal places.`, step: 4, year: i })
    if (!validMoney(plan.parentPlusGross[i])) errors.push({ field: 'requested-parent-plus-gross-principal', message: `Requested Parent PLUS principal for Year ${i + 1} must be a finite, nonnegative amount with no more than two decimal places.`, step: 5, year: i })
    if (!validMoney(plan.secondParentPlusGross[i])) errors.push({ field: 'second-parent-requested-parent-plus', message: `Second-parent requested Parent PLUS principal for Year ${i + 1} must be a finite, nonnegative amount with no more than two decimal places.`, step: 5, year: i })
  }
  if (plan.institutionalStatus === 'unknown') errors.push({ field: 'institutionalStatus', message: 'Institutional loan-restriction status is unknown.', step: 5 })
  if (plan.institutionalStatus === 'known_total_limit') {
    for (const [value, field, label] of [[plan.institutionalTotal, 'institutional-total', 'Institutional total'], [plan.institutionalSub, 'allocated-subsidized', 'Allocated Subsidized amount'], [plan.institutionalUnsub, 'allocated-unsubsidized', 'Allocated Unsubsidized amount'], [plan.institutionalPlus, 'allocated-parent-plus', 'Allocated Parent PLUS amount']] as const) if (!validMoney(value)) errors.push({ field, message: `${label} must be a finite, nonnegative amount with no more than two decimal places.`, step: 5 })
  }
  if (shared.history.status !== 'confirmed_complete') errors.push({ field: 'historyStatus', message: 'Borrowing history is incomplete; missing history is not zero.', step: 4 })
  if (shared.history.status === 'confirmed_complete') {
    validateDollar(shared.history.directOutstanding, 'direct-aggregate-countable-outstanding-principal', 'Direct aggregate-countable outstanding principal', 4, errors)
    validateDollar(shared.history.subsidizedOutstanding, 'subsidized-aggregate-countable-outstanding-principal', 'Subsidized aggregate-countable outstanding principal', 4, errors)
    validateDollar(shared.history.lifetimeDirectAndFfel, 'lifetime-direct-and-ffel-borrowing', 'Lifetime Direct and FFEL borrowing', 4, errors)
    validateDollar(shared.history.lifetimeGraduatePlus, 'lifetime-graduate-plus-student-borrowing', 'Lifetime graduate PLUS student borrowing', 4, errors)
    validateDollar(shared.history.parentPlusBorrowedAsParentExcluded, 'parent-plus-borrowed-as-parent-excluded', 'Parent PLUS borrowed as a parent', 4, errors)
    validateDollar(shared.history.healExcluded, 'heal-excluded-borrowing', 'Excluded health-profession borrowing', 4, errors)
    validateDollar(shared.history.convertedTeachGrant, 'converted-teach-grant-borrowing', 'Converted TEACH Grant borrowing', 4, errors)
    validateDollar(shared.history.parentPlusAggregate, 'parent-plus-cumulative-usage-for-student', 'Parent PLUS cumulative usage', 4, errors)
    if (shared.history.consolidationUnderlyingIncluded !== true) errors.push({ field: 'consolidation', message: 'Confirm that consolidation underlying principal is completely attributed.', step: 4 })
    if (shared.history.directOutstanding !== null && shared.history.subsidizedOutstanding !== null && validMoney(shared.history.directOutstanding) && validMoney(shared.history.subsidizedOutstanding) && shared.history.subsidizedOutstanding > shared.history.directOutstanding) errors.push({ field: 'subsidized-aggregate-countable-outstanding-principal', message: 'Subsidized outstanding principal cannot exceed total Direct outstanding principal.', step: 4 })
  }
  if (!plan.disbursementAssumptionAccepted) errors.push({ field: 'disbursementAssumption', message: 'Accept the explicit one-disbursement planning assumption or supply a supported schedule.', step: 6 })
  validateDate(shared.graduationDate, 'graduationDate', 'Confirm a graduation or planning-end date.', 6, errors)
  if (shared.subsidyEnrollment === 'unresolved') errors.push({ field: 'subsidyEnrollment', message: 'Confirm the in-school subsidy-enrollment treatment.', step: 6 })
  if (!shared.noInSchoolPaymentsAccepted) errors.push({ field: 'inSchoolPayments', message: 'Accept the no-voluntary-in-school-payments limitation to calculate graduation debt.', step: 6 })
  return errors
}

function transitionFor(plan: PlannerSchoolPlan, year: number): ParentPlusTransitionDetermination {
  const input = plan.transition[year]
  return {
    status: input.status,
    institutionIdentifier: input.institutionIdentifier || null,
    programIdentifier: input.programIdentifier || null,
    enrollmentPeriodStart: input.enrollmentPeriodStart || null,
    predicates: input.predicates,
  }
}

function higherLimitFor(plan: PlannerSchoolPlan, year: number): HigherLimitQualification {
  const input = plan.higherLimits[year]
  const start = plan.academicYearStarts[year]
  if (input.status === 'qualified') return { status: 'qualified', academicYearStart: start, basis: input.basis, anotherParentApprovedForSamePeriod: false }
  if (input.status === 'not_qualified') return { status: 'not_qualified', academicYearStart: start, reason: input.reason }
  return { status: 'unresolved', academicYearStart: input.status === 'stale' ? '2026-01-01' : start }
}

function fundingPlan(plan: PlannerSchoolPlan, shared: PlannerSharedState): FundingPlanInput {
  const baseCost = plan.costMode === 'total'
    ? { mode: 'total' as const, totalCostCents: planningMoney(plan.totalCost, 'Published or user-entered total cost is unknown.') }
    : { mode: 'components' as const, components: {
      tuitionAndRequiredFeesCents: planningMoney(plan.components.tuition, 'Tuition and required fees are unknown.'),
      housingAndFoodCents: planningMoney(plan.components.housing, 'Housing and food are unknown.'),
      booksAndSuppliesCents: planningMoney(plan.components.books, 'Books and supplies are unknown.'),
      transportationCents: planningMoney(plan.components.transportation, 'Transportation cost is unknown.'),
      otherEducationCostsCents: planningMoney(plan.components.other, 'Other educational costs are unknown.'),
    } }
  const entries: NonLoanFundingEntry[] = plan.pell.slice(0, shared.horizon).map((fact, i) => ({ id: `pell-${i}`, category: 'pell', label: `Future Pell for Year ${i + 1}`, schedule: { kind: 'one_time', year: i + 1, amountCents: planningMoney(fact, `Future Pell unknown for Year ${i + 1}.`) } }))
  const add = (id: string, category: NonLoanFundingEntry['category'], label: string, fact: PlannerFundingFact) => {
    const value = planningMoney(fact, `${label} is unknown.`)
    entries.push({ id, category, label, schedule: fact.schedule === 'recurring' ? { kind: 'recurring', startYear: 1, endYear: shared.horizon, amountCents: value } : { kind: 'one_time', year: fact.schedule === 'one_time' ? 1 : fact.year, amountCents: value } })
  }
  add('grant', 'institutional_grant', 'Institutional grant', plan.funding.grant)
  add('scholarship', 'outside_scholarship', 'Outside scholarship', plan.funding.scholarship)
  add('other', 'other_grant', 'Other grant', plan.funding.otherGrant)
  add('cash', 'family_cash', 'Family cash', plan.funding.familyCash)
  return { costProjection: { baseCost, horizonYears: shared.horizon, growth: shared.growthMode === 'flat' ? { kind: 'flat', explanation: 'Shared flat-cost assumption', provenance: { source: 'User input', createdFor: 'Funding comparison' } } : { kind: 'percentage', annualPercent: shared.growth, explanation: 'Shared cost-growth assumption', provenance: { source: 'User input', createdFor: 'Funding comparison' } }, annualOverrides: plan.overrides.slice(0, shared.horizon).flatMap((item, i) => item.enabled ? [{ year: i + 1, amountCents: assumedMoney(item.amount, item.explanation) }] : []) }, nonLoanFunding: entries }
}

function metric(values: Array<number | undefined>, reasons: string[], totalYears: number): AggregateMetric {
  const known = values.filter((value): value is number => value !== undefined)
  return { status: known.length === totalYears ? 'complete' : known.length ? 'partial' : 'incomplete', ...(known.length ? { knownCents: known.reduce((sum, value) => sum + value, 0) } : {}), resolvedYears: known.length, totalYears, reasons: [...new Set(reasons)] }
}

function knownSubtotalMetric(knownCents: number, hasKnownValue: boolean, complete: boolean, resolvedYears: number, totalYears: number, reasons: string[]): AggregateMetric {
  return { status: complete ? 'complete' : hasKnownValue ? 'partial' : 'incomplete', ...(hasKnownValue || complete ? { knownCents } : {}), resolvedYears, totalYears, reasons: [...new Set(reasons)] }
}

function allocationReason(allocation: PlannerAllocationResult) { return allocation.status === 'complete' ? [] : allocation.reasons }

export function calculatePlannerSchool(school: SchoolRecord, plan: PlannerSchoolPlan, shared: PlannerSharedState): PlannerSchoolResult {
  const errors = validatePlannerInputs(school, plan, shared)
  const planInput = fundingPlan(plan, shared)
  const parsedFunding = fundingPlanInputSchema.safeParse(planInput)
  if (!parsedFunding.success) {
    const schemaErrors: PlannerValidationError[] = parsedFunding.error.issues.map((issue) => ({ field: 'planner-cost-input', message: issue.message, step: 1 }))
    const allErrors = [...errors, ...schemaErrors]
    return emptyResult('error', school, allErrors, allErrors.map((item) => item.message), shared.horizon)
  }
  let funding: ReturnType<typeof calculatePreLoanFundingPlan>
  try { funding = calculatePreLoanFundingPlan(parsedFunding.data) } catch (error) {
    const message = error instanceof Error ? error.message : 'The planner input could not be validated.'
    return emptyResult('error', school, [...errors, { field: 'planner-cost-input', message, step: 1 }], [message], shared.horizon)
  }
  const allocationErrors = errors.filter((item) => !['graduationDate', 'subsidyEnrollment', 'inSchoolPayments'].includes(item.field) && !item.field.startsWith('futureRate-'))
  const allocations: PlannerAllocationResult[] = []
  const ledgers: LoanLedgerEntry[] = []
  let directOutstanding = shared.history.directOutstanding
  let subsidizedOutstanding = shared.history.subsidizedOutstanding
  let lifetimeDirect = shared.history.lifetimeDirectAndFfel
  let parentPlusAggregate = shared.history.parentPlusAggregate
  for (let i = 0; i < shared.horizon; i += 1) {
    const annual = funding.annual[i]
    const yearErrors = allocationErrors.filter((error) => error.year === undefined || error.year === i)
    if (yearErrors.length || annual.status !== 'complete') {
      allocations.push({ status: shared.dependencyStatus === 'independent' || (plan.enrollmentPattern !== 'unknown' && plan.enrollmentPattern !== 'full_time_standard_academic_year') || plan.educationLevel === 'graduate_professional' ? 'unsupported' : 'incomplete', reasons: [...yearErrors.map((item) => item.message), ...(annual.status === 'complete' ? [] : annual.reasons)] })
      continue
    }
    const institutionalProgramLimit = plan.institutionalStatus === 'known_total_limit' ? { status: 'known_total_limit' as const, annualTotalCapCents: cents(plan.institutionalTotal) } : plan.institutionalStatus === 'none_confirmed' ? { status: 'none_confirmed' as const } : { status: 'unknown' as const }
    const transition = transitionFor(plan, i)
    const date = plan.disbursementDates[i]
    const sub = cents(plan.subsidizedGross[i]), unsub = cents(plan.unsubsidizedGross[i]), firstPlus = cents(plan.parentPlusGross[i]), secondPlus = cents(plan.secondParentPlusGross[i])
    const schedule = (grossPrincipalCents: number) => ({ assumption: { explanation: 'One-disbursement planning template explicitly accepted by the user.', source: 'User planning assumption' }, disbursements: [{ date, grossPrincipalCents }] })
    const completeLifetime: LifetimeBorrowingHistory = shared.history.status === 'confirmed_complete' && lifetimeDirect !== null && shared.history.lifetimeGraduatePlus !== null && shared.history.parentPlusBorrowedAsParentExcluded !== null && shared.history.healExcluded !== null && shared.history.convertedTeachGrant !== null && shared.history.consolidationUnderlyingIncluded === true
      ? { status: 'confirmed_complete', directAndFfelStudentBorrowingCents: cents(lifetimeDirect), graduatePlusStudentBorrowingCents: cents(shared.history.lifetimeGraduatePlus), parentPlusBorrowedAsParentExcludedCents: cents(shared.history.parentPlusBorrowedAsParentExcluded), healAndExcludedHealthProfessionBorrowingCents: cents(shared.history.healExcluded), convertedTeachGrantBorrowingCents: cents(shared.history.convertedTeachGrant), consolidationUnderlyingPrincipalAlreadyIncluded: true }
      : { status: 'incomplete', directAndFfelStudentBorrowingCents: lifetimeDirect === null ? null : cents(lifetimeDirect), graduatePlusStudentBorrowingCents: shared.history.lifetimeGraduatePlus === null ? null : cents(shared.history.lifetimeGraduatePlus), parentPlusBorrowedAsParentExcludedCents: shared.history.parentPlusBorrowedAsParentExcluded === null ? null : cents(shared.history.parentPlusBorrowedAsParentExcluded), healAndExcludedHealthProfessionBorrowingCents: shared.history.healExcluded === null ? null : cents(shared.history.healExcluded), convertedTeachGrantBorrowingCents: shared.history.convertedTeachGrant === null ? null : cents(shared.history.convertedTeachGrant), consolidationUnderlyingPrincipalAlreadyIncluded: shared.history.consolidationUnderlyingIncluded }
    const input: LoanAllocationInput = {
      context: { institutionIdentifier: String(school.unitId), programIdentifier: plan.programIdentifier, dependencyStatus: shared.dependencyStatus === 'independent' ? 'independent' : 'dependent', educationLevel: plan.educationLevel === 'graduate_professional' ? 'graduate_professional' : 'undergraduate', enrollmentPattern: plan.enrollmentPattern === 'unknown' ? 'part_time' : plan.enrollmentPattern, academicYearStart: plan.academicYearStarts[i], enrollmentPeriodStart: plan.enrollmentPeriodStarts[i], institutionalProgramLimit },
      academicYear: `${plan.academicYearStarts[i].slice(0, 4)}-${String(Number(plan.academicYearStarts[i].slice(0, 4)) + 1).slice(-2)}`,
      gradeLevel: plan.gradeLevels[i]!, studentBeneficiaryId: 'local-planner-student', higherLimitQualification: higherLimitFor(plan, i),
      directElection: { borrowerId: 'local-planner-student', subsidizedGrossCents: sub, unsubsidizedGrossCents: unsub, subsidizedBasis: { status: 'assumed', explanation: 'Pending school packaging', source: 'User planning assumption' }, subsidizedSchedule: schedule(sub), unsubsidizedSchedule: schedule(unsub) },
      currentYearPriorDirectUsage: { combinedGrossCents: shared.history.currentYearDirect[i] === null ? null : cents(shared.history.currentYearDirect[i]!), subsidizedGrossCents: shared.history.currentYearSubsidized[i] === null ? null : cents(shared.history.currentYearSubsidized[i]!) },
      aggregateHistory: { combinedOutstandingPrincipalCents: directOutstanding === null ? null : cents(directOutstanding), subsidizedOutstandingPrincipalCents: subsidizedOutstanding === null ? null : cents(subsidizedOutstanding) },
      lifetimeHistory: completeLifetime, lifetimeTransitionDetermination: transition,
      parentPlusHistory: { allParentsAnnualCumulativeUsageCents: shared.history.currentYearParentPlus[i] === null ? null : cents(shared.history.currentYearParentPlus[i]!), allParentsAggregateCumulativeUsageCents: parentPlusAggregate === null ? null : cents(parentPlusAggregate) },
      parentPlusElections: [
        ...(firstPlus > 0 ? [{ borrowerId: plan.parentLabel, grossPrincipalCents: firstPlus, creditStatus: plan.parentCredit, transitionDetermination: transition, schedule: schedule(firstPlus) }] : []),
        ...(secondPlus > 0 ? [{ borrowerId: plan.secondParentLabel, grossPrincipalCents: secondPlus, creditStatus: plan.secondParentCredit, transitionDetermination: transition, schedule: schedule(secondPlus) }] : []),
      ],
      institutionalAllocation: plan.institutionalStatus === 'known_total_limit' && plan.institutionalAllocationConfirmed ? { directSubsidizedCents: cents(plan.institutionalSub), directUnsubsidizedCents: cents(plan.institutionalUnsub), parentPlusCents: cents(plan.institutionalPlus), source: 'User-entered school allocation' } : undefined,
      preLoanGapCents: annual.remainingPreLoanGapCents,
    }
    const allocation = allocateFederalLoans(input)
    allocations.push(allocation)
    if (allocation.status === 'complete') {
      ledgers.push(...allocation.ledger)
      const studentLedger = allocation.ledger.filter((loan) => loan.borrowerRole === 'student')
      const parentLedger = allocation.ledger.filter((loan) => loan.borrowerRole === 'parent')
      const directAdded = studentLedger.reduce((sum, loan) => sum + loan.grossPrincipalCents, 0) / 100
      const subAdded = studentLedger.filter((loan) => loan.loanType === 'direct_subsidized').reduce((sum, loan) => sum + loan.grossPrincipalCents, 0) / 100
      const plusAdded = parentLedger.reduce((sum, loan) => sum + loan.grossPrincipalCents, 0) / 100
      directOutstanding = (directOutstanding ?? 0) + directAdded
      subsidizedOutstanding = (subsidizedOutstanding ?? 0) + subAdded
      lifetimeDirect = (lifetimeDirect ?? 0) + directAdded
      parentPlusAggregate = (parentPlusAggregate ?? 0) + plusAdded
    }
  }
  const futureRateResolutions = ledgers.filter((loan) => loan.rateCohort.status === 'unknown').map((loan) => {
    const index = allocations.findIndex((allocation) => allocation.status === 'complete' && allocation.ledger.some((item) => item.loanId === loan.loanId))
    const rate = index < 0 ? null : shared.futureRates[index]
    return { loanId: loan.loanId, rate: rate === null ? { status: 'unknown' as const, reason: `Future federal rate assumption missing for ${loan.academicYear}.` } : { status: 'assumed' as const, annualRatePercent: rate, explanation: 'User-selected shared future planning rate', provenance: { source: 'User planning input', createdFor: 'Funding planner comparison' } } }
  })
  const graduation = shared.graduationDate && shared.subsidyEnrollment !== 'unresolved' && shared.noInSchoolPaymentsAccepted
    ? calculateGraduationDebt({ ledger: ledgers, graduationDate: shared.graduationDate, subsidyEnrollment: shared.subsidyEnrollment === 'qualifying_in_school' ? { status: 'qualifying_in_school', explanation: 'User confirmed qualifying in-school enrollment for this planning period.' } : { status: 'unsupported', reason: 'The entered enrollment treatment does not support subsidized in-school interest treatment.' }, inSchoolPayments: { status: 'none_assumed', explanation: 'User accepted that voluntary in-school payments are not modeled.', source: 'User planning assumption' }, futureRateResolutions })
    : null
  const annualReasons = funding.annual.flatMap((year) => year.status === 'complete' ? [] : year.reasons)
  const allocationReasons = allocations.flatMap(allocationReason)
  const cost = metric(funding.annual.map((year) => year.projectedCostCents), annualReasons, shared.horizon)
  const fundingCategory = (categories: Array<'pell' | 'institutional_grant' | 'outside_scholarship' | 'other_grant' | 'family_cash'>) => {
    let knownCents = 0, resolvedYears = 0, hasKnownValue = false
    const reasons: string[] = []
    for (const year of funding.funding) {
      const applied = year.applied.filter((item) => categories.includes(item.category))
      const unknown = year.unknown.filter((item) => categories.includes(item.category))
      knownCents += applied.reduce((sum, item) => sum + item.amountCents, 0)
      if (applied.length > 0) hasKnownValue = true
      if (unknown.length === 0) { resolvedYears += 1; hasKnownValue = true }
      reasons.push(...unknown.map((item) => `${item.label}: ${item.reason}`))
    }
    return knownSubtotalMetric(knownCents, hasKnownValue, resolvedYears === shared.horizon, resolvedYears, shared.horizon, reasons)
  }
  const allocationMetric = (select: (allocation: Extract<PlannerAllocationResult, { status: 'complete' }>) => number) => metric(allocations.map((allocation) => allocation.status === 'complete' ? select(allocation) : undefined), allocationReasons, shared.horizon)
  const completedAllocationYears = allocations.filter((allocation) => allocation.status === 'complete').length
  const allAllocationsComplete = completedAllocationYears === shared.horizon
  const debtReasons = [...allocationReasons, ...(graduation?.reasons ?? [])]
  const debtMetrics = graduation?.summaries
    ? (() => {
      const studentKnownInterestLoans = graduation.loans.filter((loan) => loan.borrowerRole === 'student' && loan.accruedInterestCents !== undefined).length
      const parentKnownInterestLoans = graduation.loans.filter((loan) => loan.borrowerRole === 'parent' && loan.accruedInterestCents !== undefined).length
      const studentPrincipal = knownSubtotalMetric(graduation.summaries.student.principalCents, true, allAllocationsComplete, completedAllocationYears, shared.horizon, allocationReasons)
      const parentPrincipal = knownSubtotalMetric(graduation.summaries.allParents.principalCents, true, allAllocationsComplete, completedAllocationYears, shared.horizon, allocationReasons)
      const studentInterestComplete = allAllocationsComplete && graduation.summaries.student.status === 'complete'
      const parentInterestComplete = allAllocationsComplete && graduation.summaries.allParents.status === 'complete'
      const studentInterest = knownSubtotalMetric(graduation.summaries.student.knownAccruedInterestCents, studentKnownInterestLoans > 0 || studentInterestComplete, studentInterestComplete, studentInterestComplete ? shared.horizon : completedAllocationYears, shared.horizon, debtReasons)
      const parentInterest = knownSubtotalMetric(graduation.summaries.allParents.knownAccruedInterestCents, parentKnownInterestLoans > 0 || parentInterestComplete, parentInterestComplete, parentInterestComplete ? shared.horizon : completedAllocationYears, shared.horizon, debtReasons)
      const studentDebtComplete = studentInterestComplete && graduation.summaries.student.informationalPrincipalPlusInterestCents !== undefined
      const parentDebtComplete = parentInterestComplete && graduation.summaries.allParents.informationalPrincipalPlusInterestCents !== undefined
      const studentDebt = knownSubtotalMetric(studentDebtComplete ? graduation.summaries.student.informationalPrincipalPlusInterestCents! : graduation.summaries.student.principalCents + graduation.summaries.student.knownAccruedInterestCents, true, studentDebtComplete, studentDebtComplete ? shared.horizon : completedAllocationYears, shared.horizon, debtReasons)
      const parentDebt = knownSubtotalMetric(parentDebtComplete ? graduation.summaries.allParents.informationalPrincipalPlusInterestCents! : graduation.summaries.allParents.principalCents + graduation.summaries.allParents.knownAccruedInterestCents, true, parentDebtComplete, parentDebtComplete ? shared.horizon : completedAllocationYears, shared.horizon, debtReasons)
      return { studentPrincipal, studentInterest, studentDebt, parentPrincipal, parentInterest, parentDebt }
    })()
    : { studentPrincipal: metric([], ['Graduation date, subsidy enrollment, and the no-in-school-payments assumption must be confirmed.'], shared.horizon), studentInterest: metric([], ['Graduation date and interest assumptions must be confirmed.'], shared.horizon), studentDebt: metric([], ['Graduation date and interest assumptions must be confirmed.'], shared.horizon), parentPrincipal: metric([], ['Graduation date and interest assumptions must be confirmed.'], shared.horizon), parentInterest: metric([], ['Graduation date and interest assumptions must be confirmed.'], shared.horizon), parentDebt: metric([], ['Graduation date and interest assumptions must be confirmed.'], shared.horizon) }
  const omittedElectedPrincipalCents = allocations.reduce((sum, allocation, i) => sum + (allocation.status === 'complete' ? 0 : cents(plan.subsidizedGross[i] + plan.unsubsidizedGross[i] + plan.parentPlusGross[i] + plan.secondParentPlusGross[i])), 0)
  const missingReasons = [...new Set([...errors.map((item) => item.message), ...annualReasons, ...allocationReasons, ...(graduation?.reasons ?? [])])]
  const unsupported = allocations.some((allocation) => allocation.status === 'unsupported') || errors.some((error) => error.message.includes('unsupported'))
  return { status: unsupported ? 'unsupported' : missingReasons.length || graduation?.status !== 'complete' ? 'incomplete' : 'complete', school, errors, funding, allocations, graduation, futureRateResolutions, omittedElectedPrincipalCents, metrics: { cost, grants: fundingCategory(['pell', 'institutional_grant', 'outside_scholarship', 'other_grant']), familyCash: fundingCategory(['family_cash']), studentGross: allocationMetric((a) => a.elections.directSubsidizedGrossCents + a.elections.directUnsubsidizedGrossCents), studentNet: allocationMetric((a) => a.accounting.studentNetProceedsCents), parentPlusGross: allocationMetric((a) => a.elections.parentPlusGrossCents), parentPlusNet: allocationMetric((a) => a.accounting.parentPlusNetProceedsCents), fees: allocationMetric((a) => a.accounting.originationFeesCents), gap: allocationMetric((a) => a.accounting.remainingUncoveredFundingGapCents), surplus: allocationMetric((a) => a.accounting.surplusLoanProceedsCents), ...debtMetrics }, missingReasons }
}

function emptyResult(status: PlannerSchoolResult['status'], school: SchoolRecord, errors: PlannerValidationError[], reasons: string[], years: number): PlannerSchoolResult {
  const unavailable = metric([], reasons, years)
  return { status, school, errors, funding: null, allocations: [], graduation: null, futureRateResolutions: [], omittedElectedPrincipalCents: 0, metrics: { cost: unavailable, grants: unavailable, familyCash: unavailable, studentGross: unavailable, studentNet: unavailable, parentPlusGross: unavailable, parentPlusNet: unavailable, fees: unavailable, gap: unavailable, surplus: unavailable, studentPrincipal: unavailable, studentInterest: unavailable, studentDebt: unavailable, parentPrincipal: unavailable, parentInterest: unavailable, parentDebt: unavailable }, missingReasons: reasons }
}
