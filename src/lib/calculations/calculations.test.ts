import { describe, expect, it } from 'vitest'
import vectors from '../../../docs/calculation-test-vectors-v1.0.json'
import { adjustBusinessFarmNetWorth, boundSai, calculateDependentSai, calculatePell, isAssetReportingExempt, medicareHiAllowance, oasdiAllowance, parentIncomeProtectionAllowance, reportableBusinessFarmNetWorth, saiWhole, tableA5ParentContribution } from '.'
import type { AssetExemptionFacts, DependentSaiInputs } from '.'

const exemption = (overrides: Partial<AssetExemptionFacts> = {}): AssetExemptionFacts => ({ qualifiesForMaximumPell:false,parentAgi:0,filedSchedulesA_B_D_E_F_H:false,scheduleC:'not_filed',receivedMeansTestedBenefit:false,parentsLiveOutsideUs:false,parentsFiledUsOrTerritoryReturn:true,nonfilingBelowFilingThreshold:false,...overrides })
const baseInput = (overrides: Partial<DependentSaiInputs> = {}): DependentSaiInputs => ({ dependencyStatus:'dependent',familySize:2,parentIncome:{agi:0},studentIncome:{agi:0},assetExemption:exemption(),...overrides })

describe('federal regression vectors', () => {
  it.each(vectors.saiRounding)('SAI whole-dollar rounding $input -> $expected', ({ input, expected }) => expect(saiWhole(input)).toBe(expected))
  it('official Table A1 Medicare HI example = $7,367', () => expect(medicareHiAllowance([{filingStatus:'married_filing_jointly',workIncome:350000},{filingStatus:'married_filing_separately',workIncome:96000}])).toBe(7367))
  it('official Table A1 OASDI example = $24,837', () => expect(oasdiAllowance([{filingStatus:'married_filing_jointly',workIncome:250400},{filingStatus:'single',workIncome:150200}])).toBe(24837))
  it.each(vectors.a5Boundaries)('Table A5 $paai -> $expectedParentContribution', ({paai,expectedParentContribution}) => expect(tableA5ParentContribution(paai)).toBe(expectedParentContribution))
  it('matches the zero-income ordinary Formula A floor vector', () => {
    const result = calculateDependentSai(baseInput())
    expect(result.status).toBe('calculated')
    if (result.status !== 'calculated' || !result.worksheet) return
    expect(result.worksheet).toMatchObject({parentIpa:29190,parentAvailableIncome:-29190,parentAdjustedAvailableIncome:-29190,parentContribution:-1870,studentContributionFromIncome:0,studentContributionFromAssets:0,rawSai:-1870,finalSai:-1500})
  })
})

describe('Formula A scope and assets', () => {
  it('fails independent students closed', () => expect(calculateDependentSai({...baseInput(),dependencyStatus:'independent'})).toEqual({status:'unsupported',reason:'unsupported_dependency_status'}))
  it('rejects impossible family sizes', () => expect(() => parentIncomeProtectionAllowance(1)).toThrow())
  it.each([
    exemption({qualifiesForMaximumPell:true,parentAgi:100000}),
    exemption({parentAgi:59999,scheduleC:'not_filed'}),
    exemption({parentAgi:59999,scheduleC:'filed',scheduleCNetIncome:10000}),
    exemption({parentAgi:100000,receivedMeansTestedBenefit:true}),
  ])('supports every asset exemption route', (facts) => expect(isAssetReportingExempt(facts)).toBe(true))
  it('applies the foreign/non-U.S.-filing exception except below-threshold nonfiling', () => {
    expect(isAssetReportingExempt(exemption({receivedMeansTestedBenefit:true,parentsLiveOutsideUs:true}))).toBe(false)
    expect(isAssetReportingExempt(exemption({receivedMeansTestedBenefit:true,parentsFiledUsOrTerritoryReturn:false}))).toBe(false)
    expect(isAssetReportingExempt(exemption({receivedMeansTestedBenefit:true,parentsFiledUsOrTerritoryReturn:false,nonfilingBelowFilingThreshold:true}))).toBe(true)
  })
  it('does not require assets and makes both contributions zero when exempt', () => {
    const result = calculateDependentSai(baseInput({assetExemption:exemption({receivedMeansTestedBenefit:true,parentAgi:100000})}))
    expect(result.status === 'calculated' && result.worksheet).toMatchObject({assetExempt:true,parentContributionFromAssets:0,studentContributionFromAssets:0})
  })
  it('returns incomplete when non-exempt asset inputs are absent', () => {
    const result = calculateDependentSai(baseInput({assetExemption:exemption({parentAgi:60000,filedSchedulesA_B_D_E_F_H:true})}))
    expect(result).toEqual({status:'incomplete',missing:['parent assets','student assets']})
  })
  it('excludes only the contract-defined business/farm categories', () => {
    expect(reportableBusinessFarmNetWorth([
      {category:'family_business',netWorth:100000,familyOwnedOrControlled:true,fullTimeEquivalentEmployees:100},
      {category:'family_residence_farm',netWorth:80000,familyOwnedOrControlled:true},
      {category:'family_commercial_fishing',netWorth:60000,familyOwnedOrControlled:true},
      {category:'other',netWorth:50000},
    ])).toBe(50000)
    expect(adjustBusinessFarmNetWorth(50000)).toBe(20000)
  })
  it('number in college never changes SAI', () => {
    const one = calculateDependentSai(baseInput({numberInCollege:1})), four = calculateDependentSai(baseInput({numberInCollege:4}))
    expect(one.status === 'calculated' && one.sai).toBe(four.status === 'calculated' && four.sai)
  })
  it('uses the nonfiler override without running Formula A', () => expect(calculateDependentSai(baseInput({familySize:1,maxPellIndicator:1}))).toMatchObject({status:'calculated',sai:-1500,ordinaryFormulaRun:false}))
  it('caps Indicator 2/3 ordinary-formula results at zero', () => {
    const result = calculateDependentSai(baseInput({maxPellIndicator:2,parentIncome:{agi:100000},assetExemption:exemption({qualifiesForMaximumPell:true,parentAgi:100000})}))
    expect(result.status === 'calculated' && result.sai).toBe(0)
    expect(result.status === 'calculated' && result.ordinaryFormulaRun).toBe(true)
  })
  it('always bounds final SAI and keeps student contributions nonnegative', () => {
    for (const agi of [-1e7, 0, 1e4, 1e7]) {
      const result = calculateDependentSai(baseInput({parentIncome:{agi},studentIncome:{agi},assetExemption:exemption({qualifiesForMaximumPell:true,parentAgi:agi})}))
      expect(result.status).toBe('calculated')
      if (result.status === 'calculated' && result.worksheet) {
        expect(result.sai).toBeGreaterThanOrEqual(-1500); expect(result.sai).toBeLessThanOrEqual(999999)
        expect(result.worksheet.studentContributionFromIncome).toBeGreaterThanOrEqual(0); expect(result.worksheet.studentContributionFromAssets).toBeGreaterThanOrEqual(0)
      }
    }
    expect(boundSai(-999999)).toBe(-1500); expect(boundSai(9999999)).toBe(999999)
  })
})

describe('Pell', () => {
  const pell = (overrides = {}) => calculatePell({sai:1004,pellCoa:9999,familySize:4,parentState:'Ohio',parentSingleParent:false,parentAgi:100000,qualifyingParentNonfiler:false,...overrides})
  it('matches maximum/minimum constants and Max Pell thresholds', () => {
    expect(pell({parentAgi:54600})).toMatchObject({status:'eligible',eligibility:'maximum',scheduledAward:7395})
    expect(pell({parentSingleParent:true,parentAgi:70200})).toMatchObject({status:'eligible',eligibility:'maximum'})
  })
  it('calculates and rounds Pell to nearest $5', () => expect(pell()).toMatchObject({status:'eligible',eligibility:'calculated',rawCalculatedPell:6391,roundedCalculatedPell:6390,scheduledAward:6390}))
  it('keeps calculated Pell eligibility at the minimum boundary', () => expect(pell({sai:6655})).toMatchObject({status:'eligible',eligibility:'calculated',rawCalculatedPell:740}))
  it('evaluates Minimum Pell when calculated Pell is below minimum', () => expect(pell({sai:6656,parentAgi:85800})).toMatchObject({status:'eligible',eligibility:'minimum',scheduledAward:740}))
  it('does not round a smaller Pell COA cap', () => expect(pell({pellCoa:6388})).toMatchObject({scheduledAward:6388}))
  it('enforces the SAI threshold and preserves the unmodeled special rule', () => {
    expect(pell({sai:14790})).toEqual({status:'ineligible',reason:'sai_threshold',trace:{path:'ineligible',reportedSai:14790,pellSai:14790,maximumScheduledAward:7395,minimumScheduledAward:740,pellCoa:9999,coaLimited:false,ineligibleReason:'sai_threshold'}})
    expect(pell({sai:14790,possibleSpecialRuleDependent:true})).toEqual({status:'unsupported',reason:'special_rule_not_modeled',specialRuleNotModeled:true,trace:{path:'special_rule_verification',reportedSai:14790,pellSai:14790,maximumScheduledAward:7395,minimumScheduledAward:740,pellCoa:9999,coaLimited:false}})
  })
})
