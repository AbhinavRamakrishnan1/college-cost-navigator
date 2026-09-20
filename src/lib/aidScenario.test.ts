import { describe,expect,it } from 'vitest'
import { compareAidScenario,createAidScenario,updateAidScenario } from './aidScenario'
import { FICTIONAL_DEMO_PROFILE } from './storage/demoProfile'
import { householdProfileSchema } from './storage/schema'

const rivera=()=>householdProfileSchema.parse({...structuredClone(FICTIONAL_DEMO_PROFILE),id:'current-household',schemaVersion:3,updatedAt:'2026-09-19T00:00:00.000Z'})
describe('local aid what-if scenarios',()=>{
  it('clones without mutating the saved baseline and calculates both sides',()=>{const current=rivera(),scenario=updateAidScenario(createAidScenario(current),'parentAgi',55000);expect(current.calculation!.parentIncome.agi).toBe(65000);const compared=compareAidScenario(current,scenario);expect(compared.current).toMatchObject({status:'calculated',sai:{sai:2069},pell:{scheduledAward:5325}});expect(compared.scenario.status).toBe('calculated')})
  it('keeps a confirmed zero distinct from unknown',()=>{const current=rivera();expect(updateAidScenario(current,'studentAgi',0).calculation!.studentIncome.agi).toBe(0);expect(updateAidScenario(current,'studentAgi',null).calculation!.studentIncome.agi).toBeNull()})
  it('fails closed when a hypothetical input becomes unknown',()=>{const compared=compareAidScenario(rivera(),updateAidScenario(rivera(),'parentAgi',null));expect(compared.scenario.status).toBe('incomplete')})
  it('fails closed when a hypothetical profile is outside dependent Formula A scope',()=>{const scenario=createAidScenario(rivera());scenario.dependencyStatus='independent';expect(compareAidScenario(rivera(),scenario).scenario.status).toBe('unsupported')})
})
