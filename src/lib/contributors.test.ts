import { describe,expect,it } from 'vitest'
import { determineContributors,type ContributorFacts } from './contributors'

const facts=(overrides:Partial<ContributorFacts>):ContributorFacts=>({livingArrangement:'not_together',apartStatus:'divorced',supportLast12:'parent_a',greaterIncomeAssets:'',selectedParentRemarried:false,...overrides})

describe('FAFSA contributor guidance',()=>{
  it('includes married parents living together',()=>expect(determineContributors(facts({livingArrangement:'married_together'}))).toMatchObject({status:'determined',included:'both_parents',parentSingleParent:false}))
  it('includes unmarried legal parents living together',()=>expect(determineContributors(facts({livingArrangement:'unmarried_together'}))).toMatchObject({status:'determined',included:'both_parents',parentSingleParent:false}))
  it.each(['separated','divorced'] as const)('uses support rather than custody for %s parents',(apartStatus)=>expect(determineContributors(facts({apartStatus,supportLast12:'parent_b'}))).toMatchObject({status:'determined',included:'parent_b',parentSingleParent:true}))
  it('includes a remarried selected parent and stepparent',()=>expect(determineContributors(facts({supportLast12:'parent_b',selectedParentRemarried:true}))).toMatchObject({status:'determined',included:'parent_b_and_stepparent',parentSingleParent:false}))
  it('resolves an equal-support case using greater income and assets',()=>expect(determineContributors(facts({supportLast12:'equal_or_neither',greaterIncomeAssets:'parent_b'}))).toMatchObject({status:'determined',included:'parent_b'}))
  it('fails closed when a support tie lacks the next required fact',()=>expect(determineContributors(facts({supportLast12:'equal_or_neither',greaterIncomeAssets:''}))).toMatchObject({status:'clarification_required',missing:'income and assets'}))
  it('never asks for or uses custody',()=>expect(JSON.stringify(facts({})).toLowerCase()).not.toContain('custody'))
})
