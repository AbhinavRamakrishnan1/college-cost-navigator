import Dexie from 'dexie'
import { describe,it,expect } from 'vitest'
import { NavigatorDatabase } from './database'
import { HouseholdRepository } from './repositories'
import { BackupService,parseNavigatorBackup } from './backup'
import { FICTIONAL_DEMO_PROFILE } from './demoProfile'
import { calculateProfileAid } from '../calculations/profile'

describe('v4 → v5 data-preserving migration',()=>{
  it('retains original data and two returns, marks defaults unknown, preserves schools/loans/assumptions',async()=>{
    const name=`patch-migration-${crypto.randomUUID()}`,old=new Dexie(name),now='2026-09-19T00:00:00Z'
    old.version(4).stores({profiles:'&id, updatedAt',metadata:'&id',savedSchools:'&unitId, addedAt',loanScenarios:'&id, updatedAt',projectionAssumptions:'&scenarioId'})
    const prior={...structuredClone(FICTIONAL_DEMO_PROFILE),state:'Alaska',schemaVersion:2,id:'current-household',updatedAt:now}
    prior.calculation!.parentIncome.workReturns.push({filingStatus:'single',workIncome:10000})
    await old.table('profiles').put(prior);await old.table('savedSchools').put({unitId:1,snapshotVersion:'unchanged',addedAt:now});await old.table('loanScenarios').put({id:'preserved',updatedAt:now});await old.table('projectionAssumptions').put({scenarioId:'preserved'});old.close()
    const db=new NavigatorDatabase(name)
    try{const p=(await new HouseholdRepository(db).load())!;expect(db.verno).toBe(5);expect(p.schemaVersion).toBe(3);expect(p.state).toBe('AK');expect(p.legacyProfile).toEqual(prior);expect(p.calculation!.parentIncome.agi).toBe(65000);expect(p.calculation!.parentIncome.taxExemptInterest).toBeNull();expect(p.calculation!.parentSingleParent).toBeNull();expect(p.calculation!.parentIncome.workReturns).toHaveLength(2);expect(calculateProfileAid(p).status).toBe('incomplete');expect(await db.savedSchools.count()).toBe(1);expect(await db.loanScenarios.get('preserved')).toEqual({id:'preserved',updatedAt:now});expect(await db.projectionAssumptions.count()).toBe(1)}finally{db.close();await db.delete()}
  })
  it('imports shipped v4 backups without upgrading default answers to confirmed facts',()=>{
    const prior={...structuredClone(FICTIONAL_DEMO_PROFILE),id:'current-household',schemaVersion:2,updatedAt:'2026-09-19T00:00:00Z'}
    const result=parseNavigatorBackup({format:'college-cost-navigator-backup',formatVersion:4,databaseVersion:4,exportedAt:'2026-09-19T00:00:00Z',data:{profiles:[prior],savedSchools:[],loanScenarios:[],projectionAssumptions:[]}})
    expect(result.formatVersion).toBe(5);expect(result.data.profiles[0].legacyProfile).toEqual(prior);expect(calculateProfileAid(result.data.profiles[0]).status).toBe('incomplete')
  })
  it('preserves migrated incomplete state and archived inputs across export/restore',async()=>{
    const db=new NavigatorDatabase(`patch-backup-${crypto.randomUUID()}`)
    try{const service=new BackupService(db),prior={...structuredClone(FICTIONAL_DEMO_PROFILE),id:'current-household',schemaVersion:2,updatedAt:'2026-09-19T00:00:00Z'};await service.restore({format:'college-cost-navigator-backup',formatVersion:4,databaseVersion:4,exportedAt:prior.updatedAt,data:{profiles:[prior],savedSchools:[],loanScenarios:[],projectionAssumptions:[]}});const snapshot=await service.create();await service.restore(snapshot);const profile=(await new HouseholdRepository(db).load())!;expect(profile.legacyProfile).toEqual(prior);expect(calculateProfileAid(profile).status).toBe('incomplete')}finally{db.close();await db.delete()}
  })
})
