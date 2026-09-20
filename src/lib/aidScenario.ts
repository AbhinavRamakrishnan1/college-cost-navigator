import { calculateProfileAid } from './calculations'
import type { HouseholdProfile } from './storage/schema'

export type AidScenarioField='parentAgi'|'studentAgi'|'parentCash'|'studentCash'
export const createAidScenario=(profile:HouseholdProfile):HouseholdProfile=>structuredClone(profile)

export function updateAidScenario(profile:HouseholdProfile,field:AidScenarioField,value:number|null):HouseholdProfile{
  const next=createAidScenario(profile)
  if(!next.calculation)return next
  if(field==='parentAgi')next.calculation.parentIncome.agi=value
  if(field==='studentAgi')next.calculation.studentIncome.agi=value
  if(field==='parentCash'&&next.calculation.parentAssets)next.calculation.parentAssets.cashSavingsChecking=value
  if(field==='studentCash'&&next.calculation.studentAssets)next.calculation.studentAssets.cashSavingsChecking=value
  return next
}

export function compareAidScenario(current:HouseholdProfile,scenario:HouseholdProfile){return {current:calculateProfileAid(current),scenario:calculateProfileAid(scenario)}}
