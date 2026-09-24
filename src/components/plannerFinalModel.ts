import type { PlannerSchoolResult,PlannerValidationError } from '../lib/funding'

export type SourceKind='scorecard'|'federal'|'verified'|'user'|'assumption'|'calculated'
export type CompletenessItem={message:string;error?:PlannerValidationError}

export function sourceKindFor(source:string,status?:string):SourceKind{
  if(status==='assumed')return 'assumption'
  if(source.includes('College Scorecard'))return 'scorecard'
  if(source.includes('Verified local'))return 'verified'
  if(source.includes('policy')||source.includes('Federal'))return 'federal'
  return 'user'
}

export function derivePlanCompleteness(result:PlannerSchoolResult){
  const errorMessages=new Set(result.errors.map(error=>error.message))
  const items:CompletenessItem[]=[...result.errors.map(error=>({message:error.message,error})),...result.missingReasons.filter(reason=>!errorMessages.has(reason)).map(message=>({message}))]
  const missing=items.filter((item,index)=>items.findIndex(candidate=>candidate.message===item.message)===index)
  const resolved=Object.values(result.metrics).filter(metric=>metric.status==='complete').length
  return {resolved,total:resolved+missing.length,missing}
}
