import { completeCalculationProfileSchema, type HouseholdProfile } from '../storage/schema'
import { normalizeResidence } from '../residence'
import { calculatePell, pellPovertyGuideline } from './pell'
import { calculateDependentSai, isAssetReportingExempt, saiWhole, nonfilerSai } from './sai'

export function calculateProfileAid(profile: HouseholdProfile) {
  if (profile.dependencyStatus !== 'dependent') return { status:'unsupported' as const, reason:'unsupported_dependency_status' as const }
  const incomplete=(...missing:string[])=>({status:'incomplete' as const,missing})
  if (!profile.calculation) return incomplete('financial inputs')
  if(profile.familySize===null)return incomplete('family size')
  const draft=profile.calculation,state=normalizeResidence(profile.state)
  if(!state)return incomplete('valid parent residence')
  if(draft.pellCoa===null||draft.qualifyingParentNonfiler===null||draft.possibleSpecialRuleDependent===null)return incomplete('Pell eligibility facts and cost of attendance')
  if(draft.qualifyingParentNonfiler){
    const sai=nonfilerSai()
    if(sai.status!=='calculated')return sai
    return {status:'calculated' as const,sai,pell:calculatePell({sai:sai.sai,pellCoa:draft.pellCoa,familySize:profile.familySize,parentState:state,parentSingleParent:false,parentAgi:0,qualifyingParentNonfiler:true,possibleSpecialRuleDependent:draft.possibleSpecialRuleDependent})}
  }
  if(draft.parentSingleParent===null||draft.parentIncome.agi===null||draft.parentIncome.foreignIncomeExclusion===null)return incomplete('parent income and household facts')
  const agi=draft.parentIncome.agi+draft.parentIncome.foreignIncomeExclusion
  const qualifies=agi>0&&agi<=saiWhole(pellPovertyGuideline(profile.familySize,state)*(draft.parentSingleParent?2.25:1.75))
  const gate=draft.assetExemption
  if(gate.parentsLiveOutsideUs===null||gate.parentsFiledUsOrTerritoryReturn===null||gate.nonfilingBelowFilingThreshold===null)return incomplete('asset-reporting residence and filing facts')
  const foreignException=(gate.parentsLiveOutsideUs||!gate.parentsFiledUsOrTerritoryReturn)&&!gate.nonfilingBelowFilingThreshold
  const benefit=draft.meansTestedBenefits2024or2025!==null&&draft.meansTestedBenefits2024or2025.length>0
  const scheduleKnown=gate.filedSchedulesA_B_D_E_F_H!==null&&gate.scheduleC!==null&&(gate.scheduleC==='not_filed'||gate.scheduleCNetIncome!=null)
  if(!foreignException&&!qualifies&&!benefit&&!scheduleKnown)return incomplete('asset-reporting schedules or benefits')
  const assetExemption={...gate,parentsLiveOutsideUs:gate.parentsLiveOutsideUs,parentsFiledUsOrTerritoryReturn:gate.parentsFiledUsOrTerritoryReturn,nonfilingBelowFilingThreshold:gate.nonfilingBelowFilingThreshold,parentAgi:draft.parentIncome.agi,qualifiesForMaximumPell:qualifies,receivedMeansTestedBenefit:benefit,filedSchedulesA_B_D_E_F_H:gate.filedSchedulesA_B_D_E_F_H??true,scheduleC:gate.scheduleC??'filed' as const,scheduleCNetIncome:gate.scheduleCNetIncome??10001}
  if(!foreignException&&!qualifies&&!benefit&&!isAssetReportingExempt(assetExemption)&&draft.meansTestedBenefits2024or2025===null)return incomplete('means-tested benefits')
  const exempt=isAssetReportingExempt(assetExemption)
  if(!exempt)for(const assets of [draft.parentAssets,draft.studentAssets]){
    for(const business of assets?.businessFarmAssets??[]){if(business.category==='family_business'&&business.familyOwnedOrControlled&&business.fullTimeEquivalentEmployees==null)return incomplete('family business employee count')}
  }
  const assetsForCalculation=<T extends typeof draft.parentAssets|typeof draft.studentAssets>(assets:T)=>assets?{...assets,businessFarmAssets:assets.businessFarmAssets?.map(item=>({...item,fullTimeEquivalentEmployees:item.fullTimeEquivalentEmployees??undefined}))}:undefined
  const parsed=completeCalculationProfileSchema.safeParse({...draft,assetExemption,meansTestedBenefits2024or2025:draft.meansTestedBenefits2024or2025??[],maxPellIndicator:qualifies?(draft.parentSingleParent?2:3):0,parentAssets:exempt?undefined:assetsForCalculation(draft.parentAssets),studentAssets:exempt?undefined:assetsForCalculation(draft.studentAssets)})
  if(!parsed.success)return incomplete(...parsed.error.issues.map(issue=>issue.path.join('.')))
  const c=parsed.data
  const sai = calculateDependentSai({ dependencyStatus:'dependent',familySize:profile.familySize,numberInCollege:c.numberInCollege,parentIncome:c.parentIncome,studentIncome:c.studentIncome,assetExemption:c.assetExemption,parentAssets:c.parentAssets,studentAssets:c.studentAssets,maxPellIndicator:c.maxPellIndicator })
  if (sai.status !== 'calculated') return sai
  const pell = calculatePell({ sai:sai.sai,pellCoa:c.pellCoa,familySize:profile.familySize,parentState:profile.state,parentSingleParent:c.parentSingleParent,parentAgi:c.parentIncome.agi,parentForeignIncomeExclusion:c.parentIncome.foreignIncomeExclusion,qualifyingParentNonfiler:c.qualifyingParentNonfiler,possibleSpecialRuleDependent:c.possibleSpecialRuleDependent })
  return { status:'calculated' as const,sai,pell }
}
