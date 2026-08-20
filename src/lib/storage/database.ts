import Dexie, { type EntityTable } from 'dexie'
import type { HouseholdProfile, StorageMetadata } from './schema'
import { DATABASE_NAME, DATABASE_VERSION, STORAGE_METADATA } from './schema'

export class NavigatorDatabase extends Dexie {
  profiles!: EntityTable<HouseholdProfile, 'id'>
  metadata!: EntityTable<StorageMetadata, 'id'>

  constructor(name = DATABASE_NAME) {
    super(name)
    this.version(1).stores({ profiles: '&id, updatedAt', metadata: '&id' })
    this.version(DATABASE_VERSION).stores({ profiles: '&id, updatedAt', metadata: '&id' }).upgrade(async (transaction) => {
      await transaction.table('profiles').toCollection().modify((profile) => { profile.schemaVersion = 2; profile.calculation = null })
      await transaction.table('metadata').put(STORAGE_METADATA)
    })
  }
}

export const navigatorDatabase = new NavigatorDatabase()
