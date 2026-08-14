import constants from '../../data/policy/policy-constants-v1.0.json'
import loanRates from '../../data/policy/federal-loan-rates-2026-27.json'
import pellPoverty from '../../data/policy/hhs-poverty-guidelines-2024-pell.json'
import idrPoverty from '../../data/policy/hhs-poverty-guidelines-2026-idr.json'
import { POLICY_VERSION_UNAVAILABLE, type FederalLoanRatePolicy, type PolicyConstants, type PolicyResult, type PovertyGuidelines, type SaiSupport, type StudentDependency } from './types'

const unavailable = (requestedVersion: string) => ({ ok: false, error: POLICY_VERSION_UNAVAILABLE, requestedVersion } as const)

export function selectPolicyConstants(contractVersion: string): PolicyResult<PolicyConstants> {
  return contractVersion === constants.contractVersion ? { ok: true, value: constants as PolicyConstants } : unavailable(contractVersion)
}

export function selectPovertyGuidelines(year: number, purpose: 'pell' | 'idr'): PolicyResult<PovertyGuidelines> {
  if (year === 2024 && purpose === 'pell') return { ok: true, value: pellPoverty }
  if (year === 2026 && purpose === 'idr') return { ok: true, value: idrPoverty }
  return unavailable(`${year}:${purpose}`)
}

export function selectFederalLoanRates(disbursementDate: string): PolicyResult<FederalLoanRatePolicy> {
  return disbursementDate >= loanRates.effectiveFrom && disbursementDate <= loanRates.effectiveThrough
    ? { ok: true, value: loanRates }
    : unavailable(disbursementDate)
}

export function selectSaiSupport(student: StudentDependency, awardYear: string): SaiSupport {
  return student.kind === 'dependent' && awardYear === '2026-27'
    ? { supported: true, formula: 'A' }
    : { supported: false, reason: 'INDEPENDENT_STUDENT_UNSUPPORTED_V1' }
}
