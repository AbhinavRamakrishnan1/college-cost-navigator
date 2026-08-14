export const POLICY_VERSION_UNAVAILABLE = 'POLICY_VERSION_UNAVAILABLE' as const

export type ContractVersion = '1.0.0'
export type AwardYear = '2026-27'
export type PovertyGuidelineYear = 2024 | 2026

export type PolicyUnavailable = {
  ok: false
  error: typeof POLICY_VERSION_UNAVAILABLE
  requestedVersion: string
}
export type PolicyAvailable<T> = { ok: true; value: T }
export type PolicyResult<T> = PolicyAvailable<T> | PolicyUnavailable

export interface PolicyConstants {
  contractVersion: ContractVersion
  verifiedAt: string
  sai2026_27: Record<string, unknown>
  pell2026_27: Record<string, unknown>
  rap: Record<string, unknown>
  ibr: Record<string, unknown>
  tieredStandard: Record<string, unknown>
}

export interface PovertyGuidelines {
  id: string
  publishedDate: string
  regions: Record<string, Record<string, number>>
}

export interface FederalLoanRatePolicy {
  id: string
  postedDate: string
  effectiveFrom: string
  effectiveThrough: string
  rates: Record<string, number>
  fixedForLifeOfLoan: boolean
}

export type DirectLoanType =
  | 'DIRECT_SUBSIDIZED_UNDERGRADUATE'
  | 'DIRECT_UNSUBSIDIZED_UNDERGRADUATE'
  | 'DIRECT_UNSUBSIDIZED_GRADUATE_PROFESSIONAL'
  | 'DIRECT_PLUS_PARENT'
  | 'DIRECT_PLUS_GRADUATE_PROFESSIONAL'

export type StudentDependency = { kind: 'dependent' } | { kind: 'independent'; formula: 'B' | 'C' }
export type SaiSupport = { supported: true; formula: 'A' } | { supported: false; reason: 'INDEPENDENT_STUDENT_UNSUPPORTED_V1' }
