import type { SchoolRecord } from './schema'

export const INCOME_BRACKETS=['0-30000','30001-48000','48001-75000','75001-110000','110001-plus'] as const
export type IncomeBracket=typeof INCOME_BRACKETS[number]
export type ComparisonSort='saved_order'|'cost_low'|'net_price_low'|'graduation_high'|'debt_low'|'earnings_high'|'debt_to_earnings_low'

export interface ComparableSchoolValues {
  publishedCost:number|null
  averageNetPrice:number|null
  incomeBracketNetPrice:number|null
  graduationRate:number|null
  medianFederalDebt:number|null
  earningsOneYear:number|null
  earningsFourYears:number|null
  earningsTenYears:number|null
  debtToFirstYearEarnings:number|null
}

const finiteOrNull=(value:number|null|undefined)=>typeof value==='number'&&Number.isFinite(value)?value:null
export function selectInstitutionEarnings(school:SchoolRecord,yearsAfterEntry:number):number|null {
  return finiteOrNull(school.earnings.find((outcome)=>outcome.yearsAfterEntry===yearsAfterEntry)?.value)
}
export function selectAvailableEarnings(school:SchoolRecord):{value:number;yearsAfterEntry:number|null;label:string}|null {
  const outcomes=school.earnings.filter((outcome)=>finiteOrNull(outcome.value)!==null)
  const preferred=[10,4,1].map((year)=>outcomes.find((outcome)=>outcome.yearsAfterEntry===year)).find(Boolean)??outcomes[0]
  return preferred&&preferred.value!==null?{value:preferred.value,yearsAfterEntry:preferred.yearsAfterEntry,label:preferred.label}:null
}
export function selectFieldOfStudyEarnings(school:SchoolRecord,intendedCip?:string):{source:'field_of_study'|'institution'|'unavailable';value:number|null;label:string} {
  const field=intendedCip?school.fieldOfStudyEarnings.find((item)=>item.cipCode===intendedCip&&finiteOrNull(item.medianEarnings)!==null):undefined
  if(field)return {source:'field_of_study',value:field.medianEarnings,label:field.title??`CIP ${field.cipCode}`}
  const institution=selectAvailableEarnings(school)
  return institution?{source:'institution',value:institution.value,label:institution.label}:{source:'unavailable',value:null,label:'Not available'}
}
export function debtToFirstYearEarnings(debt:number|null|undefined,earnings:number|null|undefined):number|null {
  const validDebt=finiteOrNull(debt),validEarnings=finiteOrNull(earnings)
  return validDebt===null||validDebt<0||validEarnings===null||validEarnings<=0?null:validDebt/validEarnings
}
export function selectFirstYearEarnings(school:SchoolRecord,intendedCip?:string):number|null {
  const field=intendedCip?school.fieldOfStudyEarnings.find((item)=>item.cipCode===intendedCip&&item.yearsAfterEntry===1):undefined
  return finiteOrNull(field?.medianEarnings)??selectInstitutionEarnings(school,1)
}
export function getComparableSchoolValues(school:SchoolRecord,incomeBracket:IncomeBracket='48001-75000',intendedCip?:string):ComparableSchoolValues {
  const earningsOneYear=selectFirstYearEarnings(school,intendedCip)
  return {publishedCost:finiteOrNull(school.costOfAttendance),averageNetPrice:finiteOrNull(school.averageNetPrice),incomeBracketNetPrice:finiteOrNull(school.averageNetPriceByIncome[incomeBracket]),graduationRate:finiteOrNull(school.graduationRate),medianFederalDebt:finiteOrNull(school.medianFederalDebtAtGraduation),earningsOneYear,earningsFourYears:selectInstitutionEarnings(school,4),earningsTenYears:selectInstitutionEarnings(school,10),debtToFirstYearEarnings:debtToFirstYearEarnings(school.medianFederalDebtAtGraduation,earningsOneYear)}
}
function sortValue(school:SchoolRecord,sort:ComparisonSort,bracket:IncomeBracket,intendedCip?:string):number|null {
  const values=getComparableSchoolValues(school,bracket,intendedCip)
  if(sort==='cost_low')return values.publishedCost;if(sort==='net_price_low')return values.averageNetPrice;if(sort==='graduation_high')return values.graduationRate;if(sort==='debt_low')return values.medianFederalDebt;if(sort==='debt_to_earnings_low')return values.debtToFirstYearEarnings
  return selectAvailableEarnings(school)?.value??null
}
export function sortSchools(records:SchoolRecord[],sort:ComparisonSort,bracket:IncomeBracket='48001-75000',intendedCip?:string):SchoolRecord[] {
  if(sort==='saved_order')return [...records]
  const direction=sort==='graduation_high'||sort==='earnings_high'?-1:1
  return records.map((school,index)=>({school,index,value:sortValue(school,sort,bracket,intendedCip)})).sort((a,b)=>{
    if(a.value===null&&b.value===null)return a.index-b.index;if(a.value===null)return 1;if(b.value===null)return -1
    return (a.value-b.value)*direction||a.index-b.index
  }).map(({school})=>school)
}
export const formatScorecardMoney=(value:number|null)=>value===null?'Not available':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value)
export const formatScorecardPercent=(value:number|null)=>value===null?'Not available':new Intl.NumberFormat('en-US',{style:'percent',maximumFractionDigits:1}).format(value)
export const formatDebtToEarnings=(value:number|null)=>value===null?'Not available':`${value.toFixed(2)}×`
export function resolveSavedSchools(saved:Array<{unitId:number}>,records:SchoolRecord[]):SchoolRecord[] {
  const byId=new Map(records.map((school)=>[school.unitId,school]))
  return saved.flatMap((entry)=>{const school=byId.get(entry.unitId);return school?[school]:[]})
}
