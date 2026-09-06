import { z } from 'zod'

export const DATABASE_NAME = 'college-cost-aid-navigator'
export const DATABASE_VERSION = 3
export const BACKUP_FORMAT = 'college-cost-navigator-backup'
export const BACKUP_FORMAT_VERSION = 3
export const CURRENT_PROFILE_ID = 'current-household'

const dollars = z.number().finite()
const filingStatusSchema = z.enum(['single','head_of_household','qualifying_surviving_spouse','married_filing_jointly','married_filing_separately','dependent_student'])
const workReturnSchema = z.object({ filingStatus: filingStatusSchema, workIncome: dollars })
const incomeSchema = z.object({
  agi:dollars, deductiblePayments:dollars, taxExemptInterest:dollars, untaxedIraDistributions:dollars,
  iraRollover:dollars, untaxedPensions:dollars, pensionRollover:dollars, foreignIncomeExclusion:dollars,
  taxableGrants:dollars, educationCredits:dollars, federalWorkStudy:dollars, incomeTaxPaid:dollars,
  workReturns:z.array(workReturnSchema).min(1).max(2),
})
const businessFarmAssetSchema = z.object({
  netWorth:dollars, category:z.enum(['family_business','family_residence_farm','family_commercial_fishing','other']),
  familyOwnedOrControlled:z.boolean(), fullTimeEquivalentEmployees:z.number().int().nonnegative().optional(),
})
const parentAssetsSchema = z.object({ annualChildSupportReceived:dollars, cashSavingsChecking:dollars, investmentNetWorth:dollars, businessFarmAssets:z.array(businessFarmAssetSchema) })
const studentAssetsSchema = z.object({ cashSavingsChecking:dollars, investmentNetWorth:dollars, businessFarmAssets:z.array(businessFarmAssetSchema) })
const assetExemptionSchema = z.object({
  qualifiesForMaximumPell:z.boolean(), parentAgi:dollars, filedSchedulesA_B_D_E_F_H:z.boolean(),
  scheduleC:z.enum(['not_filed','filed']), scheduleCNetIncome:dollars.optional(), receivedMeansTestedBenefit:z.boolean(),
  parentsLiveOutsideUs:z.boolean(), parentsFiledUsOrTerritoryReturn:z.boolean(), nonfilingBelowFilingThreshold:z.boolean(),
})
export const calculationProfileSchema = z.object({
  numberInCollege:z.number().int().min(1).max(20), parentSingleParent:z.boolean(),
  meansTestedBenefits2024or2025:z.array(z.enum(['EITC','HOUSING_ASSISTANCE','SCHOOL_LUNCH','MEDICAID','QHP_CREDIT','SNAP','SSI','TANF','WIC'])),
  parentIncome:incomeSchema, studentIncome:incomeSchema, assetExemption:assetExemptionSchema,
  parentAssets:parentAssetsSchema.optional(), studentAssets:studentAssetsSchema.optional(), maxPellIndicator:z.union([z.literal(0),z.literal(1),z.literal(2),z.literal(3)]),
  qualifyingParentNonfiler:z.boolean(), possibleSpecialRuleDependent:z.boolean(), pellCoa:dollars.nonnegative(),
})

export const householdProfileSchema = z.object({
  id:z.literal(CURRENT_PROFILE_ID), schemaVersion:z.literal(2), studentName:z.string().trim().min(1).max(80),
  householdName:z.string().trim().min(1).max(80), dependencyStatus:z.enum(['dependent','independent']), awardYear:z.literal('2026-27'),
  familySize:z.number().int().min(2).max(20), state:z.string().trim().min(2).max(40), isFictionalDemo:z.boolean(),
  calculation:z.union([calculationProfileSchema,z.null()]), updatedAt:z.string().datetime(),
})

export const savedSchoolSchema=z.object({unitId:z.number().int().positive(),snapshotVersion:z.string().min(1),addedAt:z.string().datetime()})

export const storageMetadataSchema = z.object({ id:z.literal('storage-schema'),databaseName:z.literal(DATABASE_NAME),databaseVersion:z.literal(DATABASE_VERSION),backupFormat:z.literal(BACKUP_FORMAT),backupFormatVersion:z.literal(BACKUP_FORMAT_VERSION) })
export type HouseholdProfile = z.infer<typeof householdProfileSchema>
export type HouseholdProfileInput = Omit<HouseholdProfile,'id'|'updatedAt'|'schemaVersion'>
export type CalculationProfile = z.infer<typeof calculationProfileSchema>
export type SavedSchool = z.infer<typeof savedSchoolSchema>
export type StorageMetadata = z.infer<typeof storageMetadataSchema>
export const STORAGE_METADATA: StorageMetadata = Object.freeze({ id:'storage-schema',databaseName:DATABASE_NAME,databaseVersion:DATABASE_VERSION,backupFormat:BACKUP_FORMAT,backupFormatVersion:BACKUP_FORMAT_VERSION })
