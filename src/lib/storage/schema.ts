import { z } from 'zod'

export const DATABASE_NAME = 'college-cost-aid-navigator'
export const DATABASE_VERSION = 1
export const BACKUP_FORMAT = 'college-cost-navigator-backup'
export const BACKUP_FORMAT_VERSION = 1
export const CURRENT_PROFILE_ID = 'current-household'

export const householdProfileSchema = z.object({
  id: z.literal(CURRENT_PROFILE_ID),
  studentName: z.string().trim().min(1).max(80),
  householdName: z.string().trim().min(1).max(80),
  dependencyStatus: z.literal('dependent'),
  awardYear: z.literal('2026-27'),
  familySize: z.number().int().min(2).max(20),
  state: z.string().trim().min(2).max(40),
  isFictionalDemo: z.boolean(),
  updatedAt: z.string().datetime(),
})

export const storageMetadataSchema = z.object({
  id: z.literal('storage-schema'),
  databaseName: z.literal(DATABASE_NAME),
  databaseVersion: z.literal(DATABASE_VERSION),
  backupFormat: z.literal(BACKUP_FORMAT),
  backupFormatVersion: z.literal(BACKUP_FORMAT_VERSION),
})

export type HouseholdProfile = z.infer<typeof householdProfileSchema>
export type HouseholdProfileInput = Omit<HouseholdProfile, 'id' | 'updatedAt'>
export type StorageMetadata = z.infer<typeof storageMetadataSchema>

export const STORAGE_METADATA: StorageMetadata = Object.freeze({
  id: 'storage-schema', databaseName: DATABASE_NAME, databaseVersion: DATABASE_VERSION,
  backupFormat: BACKUP_FORMAT, backupFormatVersion: BACKUP_FORMAT_VERSION,
})
