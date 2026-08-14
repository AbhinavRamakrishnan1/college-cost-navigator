import { afterEach, describe, expect, it } from 'vitest'
import { NavigatorDatabase } from './database'
import { FICTIONAL_DEMO_PROFILE } from './demoProfile'
import { HouseholdRepository } from './repositories'
import { BACKUP_FORMAT_VERSION, DATABASE_VERSION, householdProfileSchema } from './schema'

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
    const parsed = householdProfileSchema.omit({ id: true, updatedAt: true }).parse(FICTIONAL_DEMO_PROFILE)
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

  it('rejects unsupported independent profiles at the schema boundary', () => {
    expect(() => householdProfileSchema.parse({ ...FICTIONAL_DEMO_PROFILE, id: 'current-household', updatedAt: new Date().toISOString(), dependencyStatus: 'independent' })).toThrow()
  })

  it('deletes every local profile and metadata record', async () => {
    const repository = createRepository()
    await repository.save(FICTIONAL_DEMO_PROFILE)
    await repository.deleteAll()
    await expect(repository.load()).resolves.toBeUndefined()
    await expect(database!.metadata.count()).resolves.toBe(0)
  })
})
