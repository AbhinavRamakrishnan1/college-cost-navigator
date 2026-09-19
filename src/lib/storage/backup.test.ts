import { afterEach,describe,expect,it,vi } from 'vitest'
import { calculateProfileAid } from '../calculations'
import type { LoanScenarioInput,ProjectionAssumptions } from '../repayment/schema'
import { BackupService,parseNavigatorBackup } from './backup'
import { NavigatorDatabase } from './database'
import { FICTIONAL_DEMO_PROFILE } from './demoProfile'
import { HouseholdRepository,LoanScenarioRepository,SavedSchoolRepository } from './repositories'

let database:NavigatorDatabase|undefined
afterEach(async()=>{if(database){database.close();await database.delete();database=undefined}})
const setup=()=>{database=new NavigatorDatabase(`backup-test-${crypto.randomUUID()}`);return {backup:new BackupService(database),households:new HouseholdRepository(database),schools:new SavedSchoolRepository(database),loans:new LoanScenarioRepository(database)}}
const loan:LoanScenarioInput={id:'backup-loan',name:'Backup loan',type:'direct_subsidized_undergrad',principalCents:2_000_000,accruedInterestCents:0,disbursementDate:'2026-07-01',fixedApr:null,enteredRepaymentAt:'2027-01-01',borrowerAgiCents:4_000_000,spouseAgiCents:0,filingChoice:'unmarried',familySize:1,state:'Ohio',rapDependents:0,spouseEligibleDebtCents:0,repayePaymentsSince2024:0,ibrEnrollmentSnapshot:null,parentPlusConsolidationHistory:null,subsidizedConsolidationPortionCents:0}
const assumptions:Omit<ProjectionAssumptions,'scenarioId'>={incomePath:[{year:2026,agiCents:4_000_000}],dependentPath:[{year:2026,dependents:0}],povertyGuidelineVersionByYear:{'2026':'hhs-poverty-guidelines-2026'},recertificationAssumption:'annual_on_time',paymentTimingAssumption:'on_time_monthly',extraPayments:'none'}

describe('versioned local backup',()=>{
  it('rejects duplicate identifiers without changing stored data',async()=>{
    const services=setup();await services.households.save(FICTIONAL_DEMO_PROFILE);await services.schools.save(204796,'development-1.0.0');const backup=await services.backup.create()
    await expect(services.backup.restore({...backup,data:{...backup.data,savedSchools:[...backup.data.savedSchools,...backup.data.savedSchools]}})).rejects.toThrow()
    await expect(services.schools.list()).resolves.toHaveLength(1)
  })
  it('rolls back all tables when a restore write fails after clears',async()=>{
    const services=setup();await services.households.save(FICTIONAL_DEMO_PROFILE);await services.schools.save(204796,'development-1.0.0');await services.loans.save(loan,assumptions)
    const before=await services.backup.create(),failure=vi.spyOn(database!.loanScenarios,'bulkPut').mockRejectedValueOnce(new Error('Simulated write failure'))
    await expect(services.backup.restore(before)).rejects.toThrow('Simulated write failure');failure.mockRestore()
    expect((await services.backup.create()).data).toEqual(before.data)
  })
  it('delete-all empties every IndexedDB table',async()=>{
    const services=setup();await services.households.save(FICTIONAL_DEMO_PROFILE);await services.schools.save(204796,'development-1.0.0');await services.loans.save(loan,assumptions)
    await services.households.deleteAll()
    for(const table of database!.tables)expect(await table.count()).toBe(0)
  })
  it('round-trips profiles, schools, loan scenarios, and assumptions',async()=>{const services=setup();await services.households.save(FICTIONAL_DEMO_PROFILE);await services.schools.save(204796,'development-1.0.0');await services.loans.save(loan,assumptions);const exported=await services.backup.create();expect(exported).toMatchObject({format:'college-cost-navigator-backup',formatVersion:4,databaseVersion:4,data:{profiles:[{studentName:'Maya Rivera'}],savedSchools:[{unitId:204796}],loanScenarios:[{id:'backup-loan'}],projectionAssumptions:[{scenarioId:'backup-loan'}]}});await services.households.deleteAll();await expect(services.backup.restore(exported)).resolves.toEqual({profiles:1,savedSchools:1,loanScenarios:1,projectionAssumptions:1,total:4});expect(calculateProfileAid((await services.households.load())!)).toMatchObject({status:'calculated',sai:{sai:2069}});await expect(services.loans.load('backup-loan')).resolves.toMatchObject({scenario:{principalCents:2_000_000}})})
  it('rejects incompatible versions and orphan assumptions before replacing data',async()=>{const services=setup();await services.households.save(FICTIONAL_DEMO_PROFILE);const valid=await services.backup.create();await expect(services.backup.restore({...valid,formatVersion:99})).rejects.toThrow();await expect(services.backup.restore({...valid,data:{...valid.data,projectionAssumptions:[{...assumptions,scenarioId:'orphan'}]}})).rejects.toThrow();await expect(services.households.load()).resolves.toMatchObject({studentName:'Maya Rivera'})})
  it('does not make a network request while creating or restoring a backup',async()=>{const services=setup(),fetchSpy=vi.spyOn(globalThis,'fetch');await services.households.save(FICTIONAL_DEMO_PROFILE);const exported=await services.backup.create();await services.backup.restore(exported);expect(fetchSpy).not.toHaveBeenCalled();fetchSpy.mockRestore()})
  it('validates exact backup metadata',()=>{expect(()=>parseNavigatorBackup({})).toThrow()})
})
