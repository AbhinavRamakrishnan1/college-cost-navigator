import { describe,expect,it } from 'vitest'
import { scorecardSnapshot } from './catalog'
import { debtToFirstYearEarnings,deriveHouseholdIncomeBracket,formatScorecardMoney,getComparableSchoolValues,incomeBracketForFamilyIncome,resolveSavedSchools,selectFieldOfStudyEarnings,sortSchools } from './comparison'
import type { SchoolRecord } from './schema'
import { FICTIONAL_DEMO_PROFILE } from '../storage/demoProfile'
import { householdProfileSchema } from '../storage/schema'

const [howard,mit,ohio]=scorecardSnapshot.records
describe('shared school comparison values',()=>{
  it('uses the exact individual-school source values and formatting',()=>{const values=getComparableSchoolValues(ohio,'48001-75000');expect(values).toMatchObject({publishedCost:30305,averageNetPrice:17339,incomeBracketNetPrice:9807,graduationRate:.8773,medianFederalDebt:19976,earningsTenYears:60409});expect(formatScorecardMoney(values.averageNetPrice)).toBe('$17,339')})
  it('computes debt divided by valid first-year annual earnings',()=>expect(debtToFirstYearEarnings(20000,50000)).toBe(.4))
  it.each([[20000,0],[20000,-1],[20000,null],[-1,50000],[null,50000],[Number.NaN,50000]])('returns null for invalid or missing ratio inputs',((debt,earnings)=>expect(debtToFirstYearEarnings(debt,earnings)).toBeNull()))
  it('keeps field data unavailable and falls back explicitly to institution earnings',()=>{expect(selectFieldOfStudyEarnings(ohio,'11.0701')).toMatchObject({source:'institution',value:60409});const empty={...ohio,earnings:[]};expect(selectFieldOfStudyEarnings(empty,'11.0701')).toEqual({source:'unavailable',value:null,label:'Not available'})})
  it('selects matching field-of-study data when present',()=>{const school:SchoolRecord={...ohio,fieldOfStudyEarnings:[{cipCode:'11.0701',credentialLevel:'3',title:'Computer Science',medianEarnings:90000,yearsAfterEntry:1}]};expect(selectFieldOfStudyEarnings(school,'11.0701')).toEqual({source:'field_of_study',value:90000,label:'Computer Science'})})
  it('uses selected field-specific first-year earnings in the ratio when available',()=>{const school:SchoolRecord={...ohio,fieldOfStudyEarnings:[{cipCode:'11.0701',credentialLevel:'3',title:'Computer Science',medianEarnings:80000,yearsAfterEntry:1}]};expect(getComparableSchoolValues(school,'48001-75000','11.0701').debtToFirstYearEarnings).toBe(19976/80000)})
  it('sorts without mutating source records',()=>{const original=[howard,mit,ohio],sorted=sortSchools(original,'cost_low');expect(sorted.map((x)=>x.unitId)).toEqual([204796,131520,166683]);expect(original.map((x)=>x.unitId)).toEqual([131520,166683,204796])})
  it('sorts missing values last',()=>{const missing={...ohio,unitId:999999,costOfAttendance:null};expect(sortSchools([missing,mit,howard],'cost_low').at(-1)?.unitId).toBe(999999)})
  it('ranks by highest available earnings without an overall score',()=>expect(sortSchools([howard,mit,ohio],'earnings_high').map((x)=>x.unitId)).toEqual([166683,131520,204796]))
  it.each([[[],0],[[{unitId:131520}],1],[[{unitId:131520},{unitId:166683},{unitId:204796}],3]] as const)('resolves zero, one, and at least three saved schools',((saved,count)=>expect(resolveSavedSchools([...saved],scorecardSnapshot.records)).toHaveLength(count)))
  it.each([[30000,'0-30000'],[30001,'30001-48000'],[48000,'30001-48000'],[48001,'48001-75000'],[75001,'75001-110000'],[110001,'110001-plus']] as const)('maps family income %s to %s',(income,expected)=>expect(incomeBracketForFamilyIncome(income)).toBe(expected))
  it('derives Rivera family income from parent plus student AGI locally',()=>{const profile=householdProfileSchema.parse({...structuredClone(FICTIONAL_DEMO_PROFILE),id:'current-household',schemaVersion:3,updatedAt:'2026-09-19T00:00:00Z'});expect(deriveHouseholdIncomeBracket(profile)).toBe('48001-75000')})
  it('does not guess a bracket for an incomplete household',()=>{const profile=householdProfileSchema.parse({...structuredClone(FICTIONAL_DEMO_PROFILE),id:'current-household',schemaVersion:3,updatedAt:'2026-09-19T00:00:00Z'});profile.calculation!.studentIncome.agi=null;expect(deriveHouseholdIncomeBracket(profile)).toBeNull();expect(getComparableSchoolValues(ohio).incomeBracketNetPrice).toBeNull()})
  it('keeps a selected bracket unavailable instead of substituting another value',()=>{const missing:SchoolRecord={...ohio,averageNetPriceByIncome:{...ohio.averageNetPriceByIncome,'48001-75000':null}};expect(getComparableSchoolValues(missing,'48001-75000').incomeBracketNetPrice).toBeNull();expect(formatScorecardMoney(getComparableSchoolValues(missing,'48001-75000').incomeBracketNetPrice)).toBe('Not available')})
})
