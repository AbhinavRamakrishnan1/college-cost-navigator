import type { CalculationProfile, CalculationDraft, HouseholdProfileInput } from './schema'

const zeroIncome = (filingStatus: 'married_filing_jointly' | 'dependent_student'): CalculationProfile['parentIncome'] => ({
  agi:0,deductiblePayments:0,taxExemptInterest:0,untaxedIraDistributions:0,iraRollover:0,untaxedPensions:0,
  pensionRollover:0,foreignIncomeExclusion:0,taxableGrants:0,educationCredits:0,federalWorkStudy:0,incomeTaxPaid:0,
  workReturns:[{filingStatus,workIncome:0}],
})

const DEMO_BASE: CalculationProfile = {
  numberInCollege:1,parentSingleParent:false,meansTestedBenefits2024or2025:[],
  parentIncome:zeroIncome('married_filing_jointly'),studentIncome:zeroIncome('dependent_student'),
  assetExemption:{qualifiesForMaximumPell:false,parentAgi:0,filedSchedulesA_B_D_E_F_H:false,scheduleC:'not_filed',scheduleCNetIncome:0,receivedMeansTestedBenefit:false,parentsLiveOutsideUs:false,parentsFiledUsOrTerritoryReturn:true,nonfilingBelowFilingThreshold:false},
  parentAssets:{annualChildSupportReceived:0,cashSavingsChecking:0,investmentNetWorth:0,businessFarmAssets:[]},
  studentAssets:{cashSavingsChecking:0,investmentNetWorth:0,businessFarmAssets:[]},
  maxPellIndicator:0,qualifyingParentNonfiler:false,possibleSpecialRuleDependent:false,pellCoa:0,
}

const unknownIncome = ():CalculationDraft['parentIncome'] => ({agi:null,deductiblePayments:null,taxExemptInterest:null,untaxedIraDistributions:null,iraRollover:null,untaxedPensions:null,pensionRollover:null,foreignIncomeExclusion:null,taxableGrants:null,educationCredits:null,federalWorkStudy:null,incomeTaxPaid:null,workReturns:[{filingStatus:null,workIncome:null}]})
export const EMPTY_CALCULATION_PROFILE:CalculationDraft={
  numberInCollege:1,parentSingleParent:null,qualifyingParentNonfiler:null,possibleSpecialRuleDependent:null,pellCoa:null,meansTestedBenefits2024or2025:null,
  parentIncome:unknownIncome(),studentIncome:unknownIncome(),
  maxPellIndicator:0,assetExemption:{qualifiesForMaximumPell:false,parentAgi:0,receivedMeansTestedBenefit:false,filedSchedulesA_B_D_E_F_H:null,scheduleC:null,scheduleCNetIncome:null,parentsLiveOutsideUs:null,parentsFiledUsOrTerritoryReturn:null,nonfilingBelowFilingThreshold:null},
}

export const EMPTY_HOUSEHOLD_PROFILE:HouseholdProfileInput={studentName:'',householdName:'',dependencyStatus:'dependent',awardYear:'2026-27',familySize:null,state:'',isFictionalDemo:false,calculation:null}

export const FICTIONAL_DEMO_PROFILE: HouseholdProfileInput = Object.freeze({
  studentName:'Maya Rivera',householdName:'Rivera household',dependencyStatus:'dependent',awardYear:'2026-27',familySize:4,state:'OH',isFictionalDemo:true,
  calculation:{
    ...DEMO_BASE,pellCoa:9000,
    parentIncome:{...zeroIncome('married_filing_jointly'),agi:65000,incomeTaxPaid:4000,workReturns:[{filingStatus:'married_filing_jointly' as const,workIncome:65000}]},
    studentIncome:{...zeroIncome('dependent_student'),agi:5000,workReturns:[{filingStatus:'dependent_student' as const,workIncome:5000}]},
    assetExemption:{...DEMO_BASE.assetExemption,parentAgi:65000,filedSchedulesA_B_D_E_F_H:true},
    parentAssets:{annualChildSupportReceived:0,cashSavingsChecking:10000,investmentNetWorth:2000,businessFarmAssets:[]},
    studentAssets:{cashSavingsChecking:2000,investmentNetWorth:0,businessFarmAssets:[]},
  },
})
