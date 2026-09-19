import { afterEach, describe, expect, it,vi } from 'vitest'
import { NavigatorDatabase } from './database'
import Dexie from 'dexie'
import { FICTIONAL_DEMO_PROFILE } from './demoProfile'
import { HouseholdRepository,LoanScenarioRepository,SAVED_SCHOOL_LIMIT, SavedSchoolLimitError, SavedSchoolRepository } from './repositories'
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
  it('does not hide corrupt records that lack sort-index fields',async()=>{
    createRepository()
    await database!.savedSchools.put({unitId:123} as never)
    await expect(new SavedSchoolRepository(database).list()).rejects.toThrow('Local data is invalid')
    await database!.loanScenarios.put({id:'corrupt'} as never)
    await expect(new LoanScenarioRepository(database).list()).rejects.toThrow('Local data is invalid')
  })
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
    expect(migrated).toMatchObject({studentName:'Legacy Student',schemaVersion:3,calculation:null})
    expect(calculateProfileAid(migrated!)).toEqual({status:'incomplete',missing:['financial inputs']})
  })

  it('complete demo inputs produce deterministic SAI and Pell', async () => {
    const saved=await createRepository().save(FICTIONAL_DEMO_PROFILE)
    expect(calculateProfileAid(saved)).toMatchObject({status:'calculated',sai:{sai:2069},pell:{status:'eligible',eligibility:'calculated',scheduledAward:5325}})
  })

  it('migrates v2 to v3 without changing the complete household profile',async()=>{
    const name=`navigator-v2-migration-${crypto.randomUUID()}`,oldDatabase=new Dexie(name)
    oldDatabase.version(2).stores({profiles:'&id, updatedAt',metadata:'&id'})
    const now=new Date().toISOString(),stored={...FICTIONAL_DEMO_PROFILE,id:'current-household',schemaVersion:2,updatedAt:now}
    await oldDatabase.table('profiles').put(stored);oldDatabase.close();database=new NavigatorDatabase(name)
    await expect(new HouseholdRepository(database).load()).resolves.toMatchObject({schemaVersion:3,legacyProfile:stored})
    await expect(database.savedSchools.count()).resolves.toBe(0)
  })

  it('migrates Phase 5 storage to Phase 6 without changing profiles or saved schools',async()=>{
    const name=`navigator-v3-migration-${crypto.randomUUID()}`,oldDatabase=new Dexie(name),now=new Date().toISOString()
    oldDatabase.version(3).stores({profiles:'&id, updatedAt',metadata:'&id',savedSchools:'&unitId, addedAt'})
    const stored={...FICTIONAL_DEMO_PROFILE,id:'current-household',schemaVersion:2,updatedAt:now};await oldDatabase.table('profiles').put(stored);await oldDatabase.table('savedSchools').put({unitId:204796,snapshotVersion:'development-1.0.0',addedAt:now});oldDatabase.close()
    database=new NavigatorDatabase(name);await expect(new HouseholdRepository(database).load()).resolves.toMatchObject({schemaVersion:3,legacyProfile:stored});await expect(new SavedSchoolRepository(database).list()).resolves.toHaveLength(1);await expect(database.loanScenarios.count()).resolves.toBe(0);await expect(database.projectionAssumptions.count()).resolves.toBe(0)
  })

  it('saves, reloads, edits, and deletes loan scenarios with assumptions without fetch',async()=>{
    createRepository();const repository=new LoanScenarioRepository(database),fetchSpy=vi.spyOn(globalThis,'fetch')
    const input={id:'local-loan',name:'Local loan',type:'direct_subsidized_undergrad' as const,principalCents:2_000_000,accruedInterestCents:0,disbursementDate:'2026-07-01',fixedApr:null,enteredRepaymentAt:null,borrowerAgiCents:4_000_000,spouseAgiCents:0,filingChoice:'unmarried' as const,familySize:1,state:'Ohio',rapDependents:0,spouseEligibleDebtCents:0,repayePaymentsSince2024:0,ibrEnrollmentSnapshot:null,parentPlusConsolidationHistory:null,subsidizedConsolidationPortionCents:0}
    const assumptions={incomePath:[{year:2026,agiCents:4_000_000}],dependentPath:[{year:2026,dependents:0}],povertyGuidelineVersionByYear:{'2026':'hhs-poverty-guidelines-2026'},recertificationAssumption:'annual_on_time' as const,paymentTimingAssumption:'on_time_monthly' as const,extraPayments:'none' as const}
    await repository.save(input,assumptions);await expect(repository.load('local-loan')).resolves.toMatchObject({scenario:{name:'Local loan'},assumptions:{scenarioId:'local-loan'}});await repository.save({...input,name:'Edited loan'},assumptions);await expect(repository.list()).resolves.toMatchObject([{name:'Edited loan'}]);await repository.remove('local-loan');await expect(repository.list()).resolves.toEqual([]);expect(fetchSpy).not.toHaveBeenCalled();fetchSpy.mockRestore()
  })

  it('saves, lists, and removes schools locally',async()=>{
    createRepository();const schools=new SavedSchoolRepository(database)
    await schools.save(204796,'development-1.0.0');await expect(schools.list()).resolves.toMatchObject([{unitId:204796,snapshotVersion:'development-1.0.0'}])
    await schools.remove(204796);await expect(schools.list()).resolves.toEqual([])
  })

  it('enforces the saved-school limit and treats duplicate saves as idempotent',async()=>{
    createRepository();const schools=new SavedSchoolRepository(database)
    for(let index=1;index<=SAVED_SCHOOL_LIMIT;index++)await schools.save(100000+index,'development-1.0.0')
    await schools.save(100001,'development-1.0.0');await expect(schools.list()).resolves.toHaveLength(SAVED_SCHOOL_LIMIT)
    await expect(schools.save(200000,'development-1.0.0')).rejects.toBeInstanceOf(SavedSchoolLimitError)
  })

  it('deletes every local profile and metadata record', async () => {
    const repository = createRepository()
    await repository.save(FICTIONAL_DEMO_PROFILE)
    await repository.deleteAll()
    await expect(repository.load()).resolves.toBeUndefined()
    await expect(database!.metadata.count()).resolves.toBe(0)
    await expect(database!.savedSchools.count()).resolves.toBe(0)
    await expect(database!.loanScenarios.count()).resolves.toBe(0)
    await expect(database!.projectionAssumptions.count()).resolves.toBe(0)
  })
})
