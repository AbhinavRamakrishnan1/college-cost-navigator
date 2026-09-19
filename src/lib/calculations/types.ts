export type FilingStatus = 'single' | 'head_of_household' | 'qualifying_surviving_spouse' | 'married_filing_jointly' | 'married_filing_separately' | 'dependent_student'

export interface TaxReturnWorkIncome { filingStatus: FilingStatus; workIncome: number }

export interface IncomeInputs {
  agi: number
  deductiblePayments?: number
  taxExemptInterest?: number
  untaxedIraDistributions?: number
  iraRollover?: number
  untaxedPensions?: number
  pensionRollover?: number
  foreignIncomeExclusion?: number
  taxableGrants?: number
  educationCredits?: number
  federalWorkStudy?: number
  incomeTaxPaid?: number
  workReturns?: TaxReturnWorkIncome[]
}

export interface BusinessFarmAsset {
  netWorth: number
  category: 'family_business' | 'family_residence_farm' | 'family_commercial_fishing' | 'other'
  familyOwnedOrControlled?: boolean
  fullTimeEquivalentEmployees?: number
}

export interface ParentAssets {
  annualChildSupportReceived?: number
  cashSavingsChecking?: number
  investmentNetWorth?: number
  businessFarmAssets?: BusinessFarmAsset[]
}

export interface StudentAssets {
  cashSavingsChecking?: number
  investmentNetWorth?: number
  businessFarmAssets?: BusinessFarmAsset[]
}

export interface AssetExemptionFacts {
  qualifiesForMaximumPell: boolean
  parentAgi: number
  filedSchedulesA_B_D_E_F_H: boolean
  scheduleC: 'not_filed' | 'filed'
  scheduleCNetIncome?: number
  receivedMeansTestedBenefit: boolean
  parentsLiveOutsideUs: boolean
  parentsFiledUsOrTerritoryReturn: boolean
  nonfilingBelowFilingThreshold: boolean
}

export type MaxPellIndicator = 0 | 1 | 2 | 3

export interface DependentSaiInputs {
  dependencyStatus: 'dependent' | 'independent'
  familySize: number
  numberInCollege?: number
  parentIncome: IncomeInputs
  studentIncome: IncomeInputs
  assetExemption: AssetExemptionFacts
  parentAssets?: ParentAssets
  studentAssets?: StudentAssets
  maxPellIndicator?: MaxPellIndicator
}

export interface SaiWorksheet {
  parentIncomeAdditions: number; parentIncomeOffsets: number; totalParentIncome: number
  parentMedicareHi: number; parentOasdi: number; parentIpa: number; parentEmploymentExpense: number
  parentAllowances: number; parentAvailableIncome: number; parentNetWorth: number
  parentContributionFromAssets: number; parentAdjustedAvailableIncome: number; parentContribution: number
  studentIncomeAdditions: number; studentIncomeOffsets: number; totalStudentIncome: number
  studentMedicareHi: number; studentOasdi: number; studentIncomeProtectionAllowance: number; studentAllowances: number; studentAvailableIncome: number
  studentContributionFromIncome: number; studentNetWorth: number; studentContributionFromAssets: number
  assetExempt: boolean; rawSai: number; calculatedSai: number; finalSai: number
}

export type SaiResult =
  | { status: 'unsupported'; reason: 'unsupported_dependency_status' }
  | { status: 'incomplete'; missing: string[] }
  | { status: 'calculated'; sai: number; maxPellIndicator: MaxPellIndicator; ordinaryFormulaRun: boolean; worksheet?: SaiWorksheet }

export interface PellInputs {
  sai: number
  pellCoa: number
  familySize: number
  parentState: string
  parentSingleParent: boolean
  parentAgi: number
  parentForeignIncomeExclusion?: number
  qualifyingParentNonfiler: boolean
  possibleSpecialRuleDependent?: boolean
}

export interface PellTrace {
  path: 'maximum' | 'calculated' | 'minimum' | 'ineligible' | 'special_rule_verification'
  reportedSai: number
  pellSai: number
  maximumScheduledAward: number
  minimumScheduledAward: number
  pellCoa: number
  coaLimited: boolean
  familyIncome?: number
  maximumIncomeThreshold?: number
  minimumIncomeThreshold?: number
  maximumReason?: 'qualifying_nonfiler' | 'family_income'
  rawCalculatedPell?: number
  roundedCalculatedPell?: number
  ineligibleReason?: 'sai_threshold' | 'income_threshold'
}

export type PellResult =
  | { status: 'unsupported'; reason: 'special_rule_not_modeled'; specialRuleNotModeled: true; trace: PellTrace }
  | { status: 'ineligible'; reason: 'sai_threshold' | 'income_threshold'; trace: PellTrace }
  | { status: 'eligible'; eligibility: 'maximum' | 'calculated' | 'minimum'; scheduledAward: number; rawCalculatedPell?: number; roundedCalculatedPell?: number; label: 'Scheduled Award estimate'; trace: PellTrace }
