import { describe,it,expect } from 'vitest'
import { calculatePell } from './pell'
import { calculateProfileAid } from './profile'
import { EMPTY_CALCULATION_PROFILE,FICTIONAL_DEMO_PROFILE } from '../storage/demoProfile'
import { householdProfileSchema } from '../storage/schema'
import { residenceSchema } from '../residence'

const profile=()=>householdProfileSchema.parse({...structuredClone(FICTIONAL_DEMO_PROFILE),id:'current-household',schemaVersion:3,updatedAt:'2026-09-19T00:00:00Z'})
const pell=(sai:number,coa=20000,state='OH')=>calculatePell({sai,pellCoa:coa,familySize:4,parentState:state,parentSingleParent:false,parentAgi:100000,qualifyingParentNonfiler:false})
describe('v1.0.1 profile and Pell correctness',()=>{
  it.each([-1500,-1,0])('D3 treats SAI %s as zero solely for Calculated Pell',sai=>expect(pell(sai)).toMatchObject({status:'eligible',eligibility:'calculated',rawCalculatedPell:7395,scheduledAward:7395}))
  it('D3 preserves an unrounded COA for negative SAI',()=>expect(pell(-1500,6388)).toMatchObject({scheduledAward:6388}))
  it('D3 preserves SAI 1004 rounding',()=>expect(pell(1004)).toMatchObject({rawCalculatedPell:6391,scheduledAward:6390}))
  it('D3 bounds every ordinary award across SAI and COA ranges',()=>{
    for(let sai=-1500;sai<=16000;sai+=37)for(const coa of [0,739.99,6388,7395,20000]){const result=pell(sai,coa);if(result.status==='eligible'){expect(result.scheduledAward).toBeLessThanOrEqual(7395);expect(result.scheduledAward).toBeLessThanOrEqual(coa)}}
  })
  it.each([['AK','Alaska'],['HI','Hawaii'],['ak',' alaska '],['hi','hawaii']])('D4 normalizes %s and %s',(a,b)=>{expect(residenceSchema.parse(a)).toBe(residenceSchema.parse(b));expect(pell(7000,20000,a)).toEqual(pell(7000,20000,b))})
  it.each(['','Atlantis','AK!','ZZ'])('D4 rejects malformed residence %s',state=>{expect(residenceSchema.safeParse(state).success).toBe(false);expect(()=>pell(0,20000,state)).toThrow()})
  it.each([-1500,0,10000,14789,14790,999999])('D5 fails closed for unresolved special-rule eligibility at %s',sai=>expect(calculatePell({sai,pellCoa:20000,familySize:4,parentState:'OH',parentSingleParent:false,parentAgi:150000,qualifyingParentNonfiler:false,possibleSpecialRuleDependent:true})).toMatchObject({status:'unsupported',reason:'special_rule_not_modeled'}))
  it('D1 derives Max Pell and exemption despite contradictory obsolete indicators',()=>{
    const p=profile(),c=p.calculation!;c.parentIncome.agi=50000;c.parentIncome.workReturns[0].workIncome=50000;c.studentAssets!.cashSavingsChecking=100000
    const first=calculateProfileAid(p)
    expect(first).toMatchObject({status:'calculated',sai:{sai:-1500,worksheet:{assetExempt:true}},pell:{scheduledAward:7395}})
    c.maxPellIndicator=2;c.assetExemption.parentAgi=999999;c.assetExemption.qualifiesForMaximumPell=true;c.assetExemption.receivedMeansTestedBenefit=true
    expect(calculateProfileAid(p)).toEqual(first)
  })
  it('D1 derives benefit exemption from the canonical list',()=>{const p=profile();p.calculation!.meansTestedBenefits2024or2025=['SNAP'];expect(calculateProfileAid(p)).toMatchObject({sai:{worksheet:{assetExempt:true}}})})
  it('D2 keeps unknown distinct from zero and false',()=>{
    const p=profile();p.calculation=structuredClone(EMPTY_CALCULATION_PROFILE)
    expect(p.calculation.parentIncome.agi).toBeNull();expect(p.calculation.parentSingleParent).toBeNull();expect(calculateProfileAid(p).status).toBe('incomplete')
    p.calculation.parentIncome.agi=0;p.calculation.parentSingleParent=false
    expect(householdProfileSchema.parse(p).calculation).toMatchObject({parentIncome:{agi:0},parentSingleParent:false});expect(calculateProfileAid(p).status).toBe('incomplete')
  })
  it('nonfiler path requires no ordinary income/assets and does not change actual SAI',()=>{const p=profile();p.calculation={...structuredClone(EMPTY_CALCULATION_PROFILE),qualifyingParentNonfiler:true,possibleSpecialRuleDependent:false,pellCoa:20000};expect(calculateProfileAid(p)).toMatchObject({sai:{sai:-1500,ordinaryFormulaRun:false},pell:{scheduledAward:7395}})})
  it('D7 calculates without exempt assets',()=>{const p=profile();p.calculation!.meansTestedBenefits2024or2025=['SNAP'];delete p.calculation!.parentAssets;delete p.calculation!.studentAssets;expect(calculateProfileAid(p)).toMatchObject({status:'calculated',sai:{worksheet:{parentContributionFromAssets:0,studentContributionFromAssets:0}}})})
  it('nonexempt missing assets and unknown business employee counts remain incomplete',()=>{const p=profile();delete p.calculation!.parentAssets;expect(calculateProfileAid(p).status).toBe('incomplete');const q=profile();q.calculation!.parentAssets!.businessFarmAssets=[{netWorth:50000,category:'family_business',familyOwnedOrControlled:true,fullTimeEquivalentEmployees:null}];expect(calculateProfileAid(q).status).toBe('incomplete')})
  it('preserves the Rivera result and independent fail-closed behavior',()=>{const p=profile();expect(calculateProfileAid(p)).toMatchObject({sai:{sai:2069},pell:{scheduledAward:5325}});p.dependencyStatus='independent';expect(calculateProfileAid(p).status).toBe('unsupported')})
})
