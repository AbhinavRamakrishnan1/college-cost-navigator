import type { NavigatorDatabase } from './database'
import { navigatorDatabase } from './database'
import { CURRENT_PROFILE_ID, STORAGE_METADATA, householdProfileSchema, savedSchoolSchema, storageMetadataSchema, type HouseholdProfile, type HouseholdProfileInput, type SavedSchool, type StorageMetadata } from './schema'

export class HouseholdRepository {
  private readonly database: NavigatorDatabase

  constructor(database: NavigatorDatabase = navigatorDatabase) {
    this.database = database
  }

  async save(input: HouseholdProfileInput): Promise<HouseholdProfile> {
    const profile = householdProfileSchema.parse({ ...input, id: CURRENT_PROFILE_ID, schemaVersion: 2, updatedAt: new Date().toISOString() })
    await this.database.transaction('rw', this.database.profiles, this.database.metadata, async () => {
      await this.database.profiles.put(profile)
      await this.database.metadata.put(STORAGE_METADATA)
    })
    return profile
  }

  async load(): Promise<HouseholdProfile | undefined> {
    const stored = await this.database.profiles.get(CURRENT_PROFILE_ID)
    return stored ? householdProfileSchema.parse(stored) : undefined
  }

  async getMetadata(): Promise<StorageMetadata> {
    const stored = await this.database.metadata.get(STORAGE_METADATA.id)
    return storageMetadataSchema.parse(stored ?? STORAGE_METADATA)
  }

  async deleteAll(): Promise<void> {
    await this.database.transaction('rw', this.database.profiles, this.database.metadata, this.database.savedSchools, async () => {
      await this.database.profiles.clear()
      await this.database.metadata.clear()
      await this.database.savedSchools.clear()
    })
  }
}

export const householdRepository = new HouseholdRepository()

export const SAVED_SCHOOL_LIMIT=10
export class SavedSchoolLimitError extends Error { constructor(){super(`You can save up to ${SAVED_SCHOOL_LIMIT} schools.`);this.name='SavedSchoolLimitError'} }
export class SavedSchoolRepository {
  private readonly database:NavigatorDatabase
  constructor(database:NavigatorDatabase=navigatorDatabase){this.database=database}
  async list():Promise<SavedSchool[]>{const rows=await this.database.savedSchools.orderBy('addedAt').toArray();return rows.map((row)=>savedSchoolSchema.parse(row))}
  async save(unitId:number,snapshotVersion:string):Promise<SavedSchool>{
    const existing=await this.database.savedSchools.get(unitId);if(existing)return savedSchoolSchema.parse(existing)
    if(await this.database.savedSchools.count()>=SAVED_SCHOOL_LIMIT)throw new SavedSchoolLimitError()
    const saved=savedSchoolSchema.parse({unitId,snapshotVersion,addedAt:new Date().toISOString()});await this.database.savedSchools.put(saved);return saved
  }
  async remove(unitId:number):Promise<void>{await this.database.savedSchools.delete(unitId)}
}
export const savedSchoolRepository=new SavedSchoolRepository()
