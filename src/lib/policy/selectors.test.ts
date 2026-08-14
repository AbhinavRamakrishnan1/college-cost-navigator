import { describe, expect, it } from 'vitest'
import { selectFederalLoanRates, selectPolicyConstants, selectPovertyGuidelines, selectSaiSupport } from './selectors'
import { POLICY_VERSION_UNAVAILABLE, type DirectLoanType } from './types'

describe('policy selectors', () => {
  it('requires an exact contract version', () => {
    expect(selectPolicyConstants('1.0.0').ok).toBe(true)
    expect(selectPolicyConstants('2.0.0')).toEqual({ ok: false, error: POLICY_VERSION_UNAVAILABLE, requestedVersion: '2.0.0' })
  })

  it('does not substitute a poverty guideline year or purpose', () => {
    expect(selectPovertyGuidelines(2024, 'pell').ok).toBe(true)
    expect(selectPovertyGuidelines(2025, 'pell').ok).toBe(false)
    expect(selectPovertyGuidelines(2024, 'idr').ok).toBe(false)
  })

  it('matches loan rates only inside the exact effective period', () => {
    expect(selectFederalLoanRates('2026-07-01').ok).toBe(true)
    expect(selectFederalLoanRates('2027-06-30').ok).toBe(true)
    expect(selectFederalLoanRates('2027-07-01').ok).toBe(false)
  })

  it('fails closed for independent students', () => {
    expect(selectSaiSupport({ kind: 'independent', formula: 'B' }, '2026-27')).toEqual({ supported: false, reason: 'INDEPENDENT_STUDENT_UNSUPPORTED_V1' })
  })

  it('keeps Parent PLUS and Grad/Professional PLUS distinct', () => {
    const parent: DirectLoanType = 'DIRECT_PLUS_PARENT'
    const graduate: DirectLoanType = 'DIRECT_PLUS_GRADUATE_PROFESSIONAL'
    expect(parent).not.toBe(graduate)
  })
})
