import { afterEach, describe, expect, it } from 'vitest'
import { NavigatorDatabase } from './database'
import Dexie from 'dexie'
import { FICTIONAL_DEMO_PROFILE } from './demoProfile'
import { HouseholdRepository } from './repositories'
import { BACKUP_FORMAT_VERSION, DATABASE_VERSION, householdProfileSchema } from './schema'
import { calculateProfileAid } from '../calculations'

let database: NavigatorDatabase | undefined

afterEach(async () => {
  if (database) { database.close(); await database.delete(); database = undefined }
})

function createRepository() {
  database = new NavigatorDatabase(`navigator-test-${crypto.randomUUID()}`)
  return new HouseholdRepository(database)
}

describe('local household repository', () => {
  it('defines a valid, clearly fictional dependent demo', () => {
    const parsed = householdProfileSchema.omit({ id:true,updatedAt:true,schemaVersion:true }).parse(FICTIONAL_DEMO_PROFILE)
    expect(parsed).toMatchObject({ studentName: 'Maya Rivera', dependencyStatus: 'dependent', isFictionalDemo: true })
  })

  it('saves and loads a validated profile', async () => {
    const repository = createRepository()
    await repository.save(FICTIONAL_DEMO_PROFILE)
    await expect(repository.load()).resolves.toMatchObject(FICTIONAL_DEMO_PROFILE)
  })

  it('stores schema and future backup metadata', async () => {
    const repository = createRepository()
    await repository.save(FICTIONAL_DEMO_PROFILE)
    await expect(repository.getMetadata()).resolves.toMatchObject({ databaseVersion: DATABASE_VERSION, backupFormatVersion: BACKUP_FORMAT_VERSION })
  })

  it('stores independent profiles but keeps them blocked by the calculation boundary', async () => {
    const repository=createRepository()
    const saved=await repository.save({...FICTIONAL_DEMO_PROFILE,dependencyStatus:'independent'})
    expect(calculateProfileAid(saved)).toEqual({status:'unsupported',reason:'unsupported_dependency_status'})
  })

  it('migrates a Phase 2 profile without guessing financial inputs', async () => {
    const name=`navigator-migration-${crypto.randomUUID()}`
    const oldDatabase=new Dexie(name)
    oldDatabase.version(1).stores({profiles:'&id, updatedAt',metadata:'&id'})
    await oldDatabase.table('profiles').put({id:'current-household',studentName:'Legacy Student',householdName:'Legacy household',dependencyStatus:'dependent',awardYear:'2026-27',familySize:3,state:'Ohio',isFictionalDemo:false,updatedAt:new Date().toISOString()})
    oldDatabase.close()
    database=new NavigatorDatabase(name)
    const migrated=await new HouseholdRepository(database).load()
    expect(migrated).toMatchObject({studentName:'Legacy Student',schemaVersion:2,calculation:null})
    expect(calculateProfileAid(migrated!)).toEqual({status:'incomplete',missing:['financial inputs']})
  })

  it('complete demo inputs produce deterministic SAI and Pell', async () => {
    const saved=await createRepository().save(FICTIONAL_DEMO_PROFILE)
    expect(calculateProfileAid(saved)).toMatchObject({status:'calculated',sai:{sai:2069},pell:{status:'eligible',eligibility:'calculated',scheduledAward:5325}})
  })

  it('deletes every local profile and metadata record', async () => {
    const repository = createRepository()
    await repository.save(FICTIONAL_DEMO_PROFILE)
    await repository.deleteAll()
    await expect(repository.load()).resolves.toBeUndefined()
    await expect(database!.metadata.count()).resolves.toBe(0)
  })
})
