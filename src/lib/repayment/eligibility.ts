import type { LoanScenario } from './schema'

export const ELIGIBILITY_AS_OF='2026-09-19'
const cutoff='2026-07-01'
const denied=(reason:string)=>({eligible:false as const,reason})
const unknown=(fact:string)=>denied(`Cannot determine eligibility: ${fact}.`)

export function postCutoffHistory(loan:LoanScenario){
  const history=loan.borrowingHistory
  if(loan.disbursementDate>=cutoff){
    if(history==='none')return 'contradictory' as const
    return history==='unknown'||history===undefined?'present':history
  }
  return history??'unknown'
}

export function tieredEligibility(loan:LoanScenario){
  const history=postCutoffHistory(loan)
  if(history==='contradictory')return unknown('borrowing history contradicts this loan date')
  if(loan.disbursementDate>=cutoff)return {eligible:true as const}
  if(history==='unknown')return unknown('borrower-wide borrowing on or after July 1, 2026 is missing')
  if(history==='non_excepted')return {eligible:true as const}
  return denied('Legacy Standard, not Tiered Standard, requires assessment for this legacy loan. Legacy Standard payments are not modeled in v1.')
}

export function consolidationEligibility(loan:LoanScenario,asOf=ELIGIBILITY_AS_OF){
  if(loan.type!=='direct_consolidation')return {eligible:true as const}
  const history=loan.parentPlusConsolidationHistory
  if(!history||history.repaidParentPlus===null)return unknown('direct and indirect Parent PLUS consolidation history is required')
  if(!history.repaidParentPlus)return {eligible:true as const}
  if(history.hadQualifyingIdrPaymentBetween2025_07_04And2028_06_30===null)return unknown('qualifying repayment history is required')
  if(!history.hadQualifyingIdrPaymentBetween2025_07_04And2028_06_30)return denied('Excepted Parent-PLUS-derived consolidation: no qualifying IDR payment history.')
  const paid=history.qualifyingPaymentDate
  if(!paid)return unknown('the qualifying ICR/PAYE/IBR payment date is required')
  if(paid<'2025-07-04'||paid>'2028-06-30'||paid>asOf||paid<loan.disbursementDate)return unknown('qualifying payment date is outside the verified window or precedes disbursement')
  const subsequent=postCutoffHistory(loan)
  if(subsequent==='contradictory')return unknown('borrowing history contradicts this loan date')
  if(loan.disbursementDate>='2025-07-01'&&asOf<'2028-07-01'){
    if(subsequent==='unknown')return unknown('subsequent borrowing is required for the consolidation transition exception')
    if(subsequent==='none')return denied('ICR-only transition through June 30, 2028 applies to this Parent-PLUS-derived consolidation; ICR is not simulated in v1.')
  }
  return {eligible:true as const}
}

export function borrowerIbrEligibility(loan:LoanScenario){
  const history=postCutoffHistory(loan)
  if(history==='unknown'||history==='contradictory')return unknown('verified borrower-wide subsequent borrowing history is required')
  if(history==='non_excepted'||history==='present')return denied('Subsequent non-excepted Direct borrowing requires assessment under the post-July-2026 repayment plans, not IBR.')
  return {eligible:true as const}
}
