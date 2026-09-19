import { z } from 'zod'
import { residenceSchema } from '../residence'

export const DATABASE_NAME = 'college-cost-aid-navigator'
export const DATABASE_VERSION = 5
export const BACKUP_FORMAT = 'college-cost-navigator-backup'
export const BACKUP_FORMAT_VERSION = 5
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
export const completeCalculationProfileSchema = z.object({
  numberInCollege:z.number().int().min(1).max(20), parentSingleParent:z.boolean(),
  meansTestedBenefits2024or2025:z.array(z.enum(['EITC','HOUSING_ASSISTANCE','SCHOOL_LUNCH','MEDICAID','QHP_CREDIT','SNAP','SSI','TANF','WIC'])),
  parentIncome:incomeSchema, studentIncome:incomeSchema, assetExemption:assetExemptionSchema,
  parentAssets:parentAssetsSchema.optional(), studentAssets:studentAssetsSchema.optional(), maxPellIndicator:z.union([z.literal(0),z.literal(1),z.literal(2),z.literal(3)]),
  qualifyingParentNonfiler:z.boolean(), possibleSpecialRuleDependent:z.boolean(), pellCoa:dollars.nonnegative(),
})

const draftIncomeSchema=incomeSchema.extend({
  agi:dollars.nullable(),deductiblePayments:dollars.nullable(),taxExemptInterest:dollars.nullable(),untaxedIraDistributions:dollars.nullable(),iraRollover:dollars.nullable(),untaxedPensions:dollars.nullable(),pensionRollover:dollars.nullable(),foreignIncomeExclusion:dollars.nullable(),taxableGrants:dollars.nullable(),educationCredits:dollars.nullable(),federalWorkStudy:dollars.nullable(),incomeTaxPaid:dollars.nullable(),
  workReturns:z.array(workReturnSchema.extend({filingStatus:filingStatusSchema.nullable(),workIncome:dollars.nullable()})).min(1).max(2),
})
const draftBusinessSchema=businessFarmAssetSchema.extend({netWorth:dollars.nullable(),familyOwnedOrControlled:z.boolean().nullable(),fullTimeEquivalentEmployees:z.number().int().nonnegative().nullable().optional()})
export const calculationProfileSchema=completeCalculationProfileSchema.extend({
  parentSingleParent:z.boolean().nullable(),qualifyingParentNonfiler:z.boolean().nullable(),possibleSpecialRuleDependent:z.boolean().nullable(),pellCoa:dollars.nonnegative().nullable(),
  meansTestedBenefits2024or2025:completeCalculationProfileSchema.shape.meansTestedBenefits2024or2025.nullable(),
  parentIncome:draftIncomeSchema,studentIncome:draftIncomeSchema,
  assetExemption:assetExemptionSchema.extend({filedSchedulesA_B_D_E_F_H:z.boolean().nullable(),scheduleC:z.enum(['not_filed','filed']).nullable(),scheduleCNetIncome:dollars.nullable().optional(),parentsLiveOutsideUs:z.boolean().nullable(),parentsFiledUsOrTerritoryReturn:z.boolean().nullable(),nonfilingBelowFilingThreshold:z.boolean().nullable()}),
  parentAssets:parentAssetsSchema.extend({annualChildSupportReceived:dollars.nullable(),cashSavingsChecking:dollars.nullable(),investmentNetWorth:dollars.nullable(),businessFarmAssets:z.array(draftBusinessSchema).nullable()}).optional(),
  studentAssets:studentAssetsSchema.extend({cashSavingsChecking:dollars.nullable(),investmentNetWorth:dollars.nullable(),businessFarmAssets:z.array(draftBusinessSchema).nullable()}).optional(),
})

export const householdProfileSchema = z.object({
  id:z.literal(CURRENT_PROFILE_ID), schemaVersion:z.literal(3), studentName:z.string().trim().min(1).max(80),
  householdName:z.string().trim().min(1).max(80), dependencyStatus:z.enum(['dependent','independent']), awardYear:z.literal('2026-27'),
  familySize:z.number().int().min(2).max(20).nullable(), state:residenceSchema, isFictionalDemo:z.boolean(),
  legacyProfile:z.unknown().optional(),
  calculation:z.union([calculationProfileSchema,z.null()]), updatedAt:z.string().datetime(),
})

export const savedSchoolSchema=z.object({unitId:z.number().int().positive(),snapshotVersion:z.string().min(1),addedAt:z.string().datetime()})

export const storageMetadataSchema = z.object({ id:z.literal('storage-schema'),databaseName:z.literal(DATABASE_NAME),databaseVersion:z.literal(DATABASE_VERSION),backupFormat:z.literal(BACKUP_FORMAT),backupFormatVersion:z.literal(BACKUP_FORMAT_VERSION) })
export type HouseholdProfile = z.infer<typeof householdProfileSchema>
export type HouseholdProfileInput = Omit<HouseholdProfile,'id'|'updatedAt'|'schemaVersion'>
export type CalculationProfile = z.infer<typeof completeCalculationProfileSchema>
export type CalculationDraft = z.infer<typeof calculationProfileSchema>
export type SavedSchool = z.infer<typeof savedSchoolSchema>
export type StorageMetadata = z.infer<typeof storageMetadataSchema>
export const STORAGE_METADATA: StorageMetadata = Object.freeze({ id:'storage-schema',databaseName:DATABASE_NAME,databaseVersion:DATABASE_VERSION,backupFormat:BACKUP_FORMAT,backupFormatVersion:BACKUP_FORMAT_VERSION })
