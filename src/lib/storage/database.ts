import Dexie, { type EntityTable } from 'dexie'
import type { HouseholdProfile, SavedSchool, StorageMetadata } from './schema'
import { DATABASE_NAME, DATABASE_VERSION, STORAGE_METADATA } from './schema'
import { migrateLegacyProfile } from './migration'
import type { LoanScenario,ProjectionAssumptions } from '../repayment/schema'

export class NavigatorDatabase extends Dexie {
  profiles!: EntityTable<HouseholdProfile, 'id'>
  metadata!: EntityTable<StorageMetadata, 'id'>
  savedSchools!: EntityTable<SavedSchool,'unitId'>
  loanScenarios!: EntityTable<LoanScenario,'id'>
  projectionAssumptions!: EntityTable<ProjectionAssumptions,'scenarioId'>

  constructor(name = DATABASE_NAME) {
    super(name)
    this.version(1).stores({ profiles: '&id, updatedAt', metadata: '&id' })
    this.version(2).stores({ profiles: '&id, updatedAt', metadata: '&id' }).upgrade(async (transaction) => {
      await transaction.table('profiles').toCollection().modify((profile) => { profile.schemaVersion = 2; profile.calculation = null })
      await transaction.table('metadata').put(STORAGE_METADATA)
    })
    this.version(3).stores({profiles:'&id, updatedAt',metadata:'&id',savedSchools:'&unitId, addedAt'}).upgrade(async(transaction)=>{await transaction.table('metadata').put({...STORAGE_METADATA,databaseVersion:3,backupFormatVersion:3})})
    this.version(4).stores({profiles:'&id, updatedAt',metadata:'&id',savedSchools:'&unitId, addedAt',loanScenarios:'&id, updatedAt',projectionAssumptions:'&scenarioId'})
    this.version(DATABASE_VERSION).stores({profiles:'&id, updatedAt',metadata:'&id',savedSchools:'&unitId, addedAt',loanScenarios:'&id, updatedAt',projectionAssumptions:'&scenarioId'}).upgrade(async(transaction)=>{
      await transaction.table('profiles').toCollection().modify(profile=>{Object.assign(profile,migrateLegacyProfile(profile))})
      await transaction.table('metadata').put(STORAGE_METADATA)
    })
  }
}

export const navigatorDatabase = new NavigatorDatabase()
