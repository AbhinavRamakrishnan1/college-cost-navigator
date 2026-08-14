import Dexie, { type EntityTable } from 'dexie'
import type { HouseholdProfile, StorageMetadata } from './schema'
import { DATABASE_NAME, DATABASE_VERSION } from './schema'

export class NavigatorDatabase extends Dexie {
  profiles!: EntityTable<HouseholdProfile, 'id'>
  metadata!: EntityTable<StorageMetadata, 'id'>

  constructor(name = DATABASE_NAME) {
    super(name)
    this.version(DATABASE_VERSION).stores({ profiles: '&id, updatedAt', metadata: '&id' })
  }
}

export const navigatorDatabase = new NavigatorDatabase()
