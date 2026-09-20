import type { ProjectionAssumptions } from './schema'

export type ExtraPaymentMode='none'|'recurring'|'one_time'
export function buildExtraPayments(mode:ExtraPaymentMode,amountCents:number,month:number):ProjectionAssumptions['extraPayments']{
  if(mode==='none'||amountCents<=0)return 'none'
  if(mode==='one_time')return [{month:Math.max(1,Math.trunc(month)),amountCents:Math.trunc(amountCents)}]
  return Array.from({length:360},(_,index)=>({month:index+1,amountCents:Math.trunc(amountCents)}))
}
export function readExtraPayments(value:ProjectionAssumptions['extraPayments']):{mode:ExtraPaymentMode;amountCents:number;month:number}{
  if(value==='none'||value.length===0)return {mode:'none',amountCents:0,month:1}
  if(value.length===1)return {mode:'one_time',amountCents:value[0].amountCents,month:value[0].month}
  const recurring=value.every((entry,index)=>entry.month===index+1&&entry.amountCents===value[0].amountCents)
  return recurring?{mode:'recurring',amountCents:value[0].amountCents,month:1}:{mode:'one_time',amountCents:value[0].amountCents,month:value[0].month}
}
