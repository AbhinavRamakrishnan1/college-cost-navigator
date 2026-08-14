import type { NavigatorDatabase } from './database'
import { navigatorDatabase } from './database'
import { CURRENT_PROFILE_ID, STORAGE_METADATA, householdProfileSchema, storageMetadataSchema, type HouseholdProfile, type HouseholdProfileInput, type StorageMetadata } from './schema'

export class HouseholdRepository {
  private readonly database: NavigatorDatabase

  constructor(database: NavigatorDatabase = navigatorDatabase) {
    this.database = database
  }

  async save(input: HouseholdProfileInput): Promise<HouseholdProfile> {
    const profile = householdProfileSchema.parse({ ...input, id: CURRENT_PROFILE_ID, updatedAt: new Date().toISOString() })
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
    await this.database.transaction('rw', this.database.profiles, this.database.metadata, async () => {
      await this.database.profiles.clear()
      await this.database.metadata.clear()
    })
  }
}

export const householdRepository = new HouseholdRepository()
