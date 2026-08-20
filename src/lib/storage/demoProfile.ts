import type { CalculationProfile, HouseholdProfileInput } from './schema'

const zeroIncome = (filingStatus: 'married_filing_jointly' | 'dependent_student'): CalculationProfile['parentIncome'] => ({
  agi:0,deductiblePayments:0,taxExemptInterest:0,untaxedIraDistributions:0,iraRollover:0,untaxedPensions:0,
  pensionRollover:0,foreignIncomeExclusion:0,taxableGrants:0,educationCredits:0,federalWorkStudy:0,incomeTaxPaid:0,
  workReturns:[{filingStatus,workIncome:0}],
})

export const EMPTY_CALCULATION_PROFILE: CalculationProfile = {
  numberInCollege:1,parentSingleParent:false,meansTestedBenefits2024or2025:[],
  parentIncome:zeroIncome('married_filing_jointly'),studentIncome:zeroIncome('dependent_student'),
  assetExemption:{qualifiesForMaximumPell:false,parentAgi:0,filedSchedulesA_B_D_E_F_H:false,scheduleC:'not_filed',scheduleCNetIncome:0,receivedMeansTestedBenefit:false,parentsLiveOutsideUs:false,parentsFiledUsOrTerritoryReturn:true,nonfilingBelowFilingThreshold:false},
  parentAssets:{annualChildSupportReceived:0,cashSavingsChecking:0,investmentNetWorth:0,businessFarmAssets:[]},
  studentAssets:{cashSavingsChecking:0,investmentNetWorth:0,businessFarmAssets:[]},
  maxPellIndicator:0,qualifyingParentNonfiler:false,possibleSpecialRuleDependent:false,pellCoa:0,
}

export const FICTIONAL_DEMO_PROFILE: HouseholdProfileInput = Object.freeze({
  studentName:'Maya Rivera',householdName:'Rivera household',dependencyStatus:'dependent',awardYear:'2026-27',familySize:4,state:'Ohio',isFictionalDemo:true,
  calculation:{
    ...EMPTY_CALCULATION_PROFILE,pellCoa:9000,
    parentIncome:{...zeroIncome('married_filing_jointly'),agi:65000,incomeTaxPaid:4000,workReturns:[{filingStatus:'married_filing_jointly' as const,workIncome:65000}]},
    studentIncome:{...zeroIncome('dependent_student'),agi:5000,workReturns:[{filingStatus:'dependent_student' as const,workIncome:5000}]},
    assetExemption:{...EMPTY_CALCULATION_PROFILE.assetExemption,parentAgi:65000,filedSchedulesA_B_D_E_F_H:true},
    parentAssets:{annualChildSupportReceived:0,cashSavingsChecking:10000,investmentNetWorth:2000,businessFarmAssets:[]},
    studentAssets:{cashSavingsChecking:2000,investmentNetWorth:0,businessFarmAssets:[]},
  },
})
