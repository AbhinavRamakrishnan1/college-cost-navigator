export type ContributorFacts={
  livingArrangement:''|'married_together'|'unmarried_together'|'not_together'
  apartStatus:''|'separated'|'divorced'|'never_married'
  supportLast12:''|'parent_a'|'parent_b'|'equal_or_neither'
  greaterIncomeAssets:''|'parent_a'|'parent_b'
  selectedParentRemarried:boolean|null
}

export type ContributorResult=
  |{status:'determined';parentSingleParent:boolean;included:'both_parents'|'parent_a'|'parent_b'|'parent_a_and_stepparent'|'parent_b_and_stepparent';message:string}
  |{status:'clarification_required';missing:string;message:string}

const clarification=(missing:string,message:string):ContributorResult=>({status:'clarification_required',missing,message})

export function determineContributors(facts:ContributorFacts):ContributorResult{
  if(!facts.livingArrangement)return clarification('living arrangement','More information required: tell us whether the student’s parents live together.')
  if(facts.livingArrangement==='married_together')return {status:'determined',parentSingleParent:false,included:'both_parents',message:'Include information for both parents.'}
  if(facts.livingArrangement==='unmarried_together')return {status:'determined',parentSingleParent:false,included:'both_parents',message:'Include information for both legal parents who live together.'}
  if(!facts.apartStatus)return clarification('relationship status','More information required: tell us whether the parents are separated, divorced, or never married.')
  if(!facts.supportLast12)return clarification('financial support','More information required: identify which parent provided more financial support during the past 12 months.')
  const selected=facts.supportLast12==='equal_or_neither'?facts.greaterIncomeAssets:facts.supportLast12
  if(!selected)return clarification('income and assets','More information required: when support was equal or neither parent provided more support, identify the parent with greater income and assets.')
  if(facts.selectedParentRemarried===null)return clarification('remarriage','More information required: tell us whether the selected parent is remarried so stepparent information is handled correctly.')
  const label=selected==='parent_a'?'Parent A':'Parent B'
  if(facts.selectedParentRemarried)return {status:'determined',parentSingleParent:false,included:selected==='parent_a'?'parent_a_and_stepparent':'parent_b_and_stepparent',message:`Include ${label} and that parent’s current spouse (the stepparent).`}
  return {status:'determined',parentSingleParent:true,included:selected,message:`Include ${label}. Do not choose based only on custody or where the student lived.`}
}

export const EMPTY_CONTRIBUTOR_FACTS:ContributorFacts={livingArrangement:'',apartStatus:'',supportLast12:'',greaterIncomeAssets:'',selectedParentRemarried:null}
