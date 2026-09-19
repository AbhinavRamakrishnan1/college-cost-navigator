import { describe,expect,it } from 'vitest'
import { calculatePell } from './pell'

const pell=(overrides:Record<string,unknown>={})=>calculatePell({sai:1004,pellCoa:9999,familySize:4,parentState:'OH',parentSingleParent:false,parentAgi:100000,qualifyingParentNonfiler:false,...overrides})

describe('Pell explanation metadata uses the canonical decision path',()=>{
  it('describes Calculated Pell and nearest-$5 rounding',()=>expect(pell()).toMatchObject({status:'eligible',eligibility:'calculated',scheduledAward:6390,trace:{path:'calculated',reportedSai:1004,pellSai:1004,maximumScheduledAward:7395,rawCalculatedPell:6391,roundedCalculatedPell:6390,coaLimited:false}}))
  it('describes Maximum Pell without exposing an internal indicator',()=>expect(pell({parentAgi:54600})).toMatchObject({status:'eligible',eligibility:'maximum',trace:{path:'maximum',maximumReason:'family_income',familyIncome:54600}}))
  it('describes the qualifying nonfiler reason',()=>expect(pell({qualifyingParentNonfiler:true,parentAgi:0})).toMatchObject({trace:{path:'maximum',maximumReason:'qualifying_nonfiler'}}))
  it('describes Minimum Pell and its income threshold',()=>expect(pell({sai:6656,parentAgi:85800})).toMatchObject({status:'eligible',eligibility:'minimum',scheduledAward:740,trace:{path:'minimum',rawCalculatedPell:739,minimumIncomeThreshold:85800}}))
  it('retains a negative reported SAI but uses zero for subtraction',()=>expect(pell({sai:-1500})).toMatchObject({trace:{reportedSai:-1500,pellSai:0,rawCalculatedPell:7395}}))
  it('records an unrounded COA limit',()=>expect(pell({sai:-1500,pellCoa:6388})).toMatchObject({scheduledAward:6388,trace:{pellCoa:6388,coaLimited:true}}))
  it('describes special-rule verification rather than ordinary eligibility',()=>expect(pell({possibleSpecialRuleDependent:true})).toMatchObject({status:'unsupported',trace:{path:'special_rule_verification'}}))
  it('describes both modeled ineligibility paths',()=>{expect(pell({sai:14790})).toMatchObject({status:'ineligible',trace:{path:'ineligible',ineligibleReason:'sai_threshold'}});expect(pell({sai:7000,parentAgi:200000})).toMatchObject({status:'ineligible',trace:{path:'ineligible',ineligibleReason:'income_threshold'}})})
})
