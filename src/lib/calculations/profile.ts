import type { HouseholdProfile } from '../storage/schema'
import { calculatePell } from './pell'
import { calculateDependentSai } from './sai'

export function calculateProfileAid(profile: HouseholdProfile) {
  if (profile.dependencyStatus !== 'dependent') return { status:'unsupported' as const, reason:'unsupported_dependency_status' as const }
  if (!profile.calculation) return { status:'incomplete' as const, missing:['financial inputs'] }
  const c = profile.calculation
  const sai = calculateDependentSai({ dependencyStatus:'dependent',familySize:profile.familySize,numberInCollege:c.numberInCollege,parentIncome:c.parentIncome,studentIncome:c.studentIncome,assetExemption:c.assetExemption,parentAssets:c.parentAssets,studentAssets:c.studentAssets,maxPellIndicator:c.maxPellIndicator })
  if (sai.status !== 'calculated') return sai
  const pell = calculatePell({ sai:sai.sai,pellCoa:c.pellCoa,familySize:profile.familySize,parentState:profile.state,parentSingleParent:c.parentSingleParent,parentAgi:c.parentIncome.agi,parentForeignIncomeExclusion:c.parentIncome.foreignIncomeExclusion,qualifyingParentNonfiler:c.qualifyingParentNonfiler,possibleSpecialRuleDependent:c.possibleSpecialRuleDependent })
  return { status:'calculated' as const,sai,pell }
}
