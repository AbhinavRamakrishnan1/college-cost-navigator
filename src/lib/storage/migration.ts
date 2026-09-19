import { normalizeResidence } from '../residence'
import { EMPTY_CALCULATION_PROFILE } from './demoProfile'
import { completeCalculationProfileSchema, type CalculationDraft } from './schema'

/** Retain the original record: v1 stored no answer-confirmation provenance. */
export function migrateLegacyProfile(profile:Record<string,unknown>) {
  if(profile.schemaVersion===3)return profile
  if(profile.schemaVersion!==2)throw new Error('Unsupported legacy household schema; original data was not changed.')
  const state=typeof profile.state==='string'?normalizeResidence(profile.state):null
  if(!state)throw new Error('Invalid legacy residence; original data was not changed. Review the original backup before importing.')
  let calculation:CalculationDraft|null=null
  if(profile.calculation){
    const old=completeCalculationProfileSchema.parse(profile.calculation)
    calculation=structuredClone(EMPTY_CALCULATION_PROFILE)
    for(const person of ['parentIncome','studentIncome'] as const){
      calculation[person]={...old[person],workReturns:old[person].workReturns.map(r=>({workIncome:r.workIncome===0?null:r.workIncome,filingStatus:r.filingStatus==='married_filing_jointly'||r.filingStatus==='dependent_student'?null:r.filingStatus}))}
      for(const key of Object.keys(old[person]) as Array<keyof typeof old.parentIncome>){if(key!=='workReturns'&&old[person][key]===0)calculation[person][key]=null}
    }
    calculation.parentSingleParent=old.parentSingleParent?true:null
    calculation.qualifyingParentNonfiler=old.qualifyingParentNonfiler?true:null
    calculation.possibleSpecialRuleDependent=old.possibleSpecialRuleDependent?true:null
    calculation.pellCoa=old.pellCoa===0?null:old.pellCoa
    calculation.numberInCollege=old.numberInCollege
    calculation.meansTestedBenefits2024or2025=old.meansTestedBenefits2024or2025.length?old.meansTestedBenefits2024or2025:null
    // Other ambiguous defaults remain unknown. Original assets and all flags are
    // retained in legacyProfile, including omitted versus zero-valued assets.
  }
  return {...profile,schemaVersion:3,familySize:profile.familySize===2?null:profile.familySize,state,legacyProfile:structuredClone(profile),calculation}
}
