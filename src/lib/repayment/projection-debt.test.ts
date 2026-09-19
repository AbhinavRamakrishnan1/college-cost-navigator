import Decimal from 'decimal.js'
import { describe,expect,it } from 'vitest'
import vectors from '../../../docs/calculation-test-vectors-v1.0.json'
import { calculateRapPayment,loanScenarioSchema,projectRepayment,projectionAssumptionsSchema } from '.'

const loan=loanScenarioSchema.parse({...vectors.repayment.defaults,disbursementDate:'2025-01-01',fixedApr:0,filingChoice:'married_filing_jointly',spouseEligibleDebtCents:2000000})
const assumptions=projectionAssumptionsSchema.parse({...vectors.repayment.rapProjection.assumptions,incomePath:[{year:2026,agiCents:4500000}],spouseDebtProjection:{kind:'constant',amountCents:2000000}})
describe('explicit spouse debt in RAP projections',()=>{
  it('uses declining borrower debt at each recalculation including the next annual period',()=>{
    const result=projectRepayment('rap',loan,assumptions)
    expect(result.status).toBe('projected')
    if(result.status!=='projected')return
    expect(result.rapRecalculations[0].requiredPaymentCents).toBe(7500)
    expect(result.rapRecalculations[1]).toMatchObject({principalCents:1992500,requiredPaymentCents:7486,spouseDebtCents:2000000})
    const annual=result.rapRecalculations[12]
    expect(annual.year).toBe(2028)
    expect(annual.principalCents).toBeLessThan(2000000)
    const expected=new Decimal(15000).mul(annual.principalCents+annual.accruedInterestCents).div(annual.principalCents+annual.accruedInterestCents+2000000).toDecimalPlaces(0,Decimal.ROUND_HALF_UP).toNumber()
    expect(annual.requiredPaymentCents).toBe(expected)
    expect(annual.requiredPaymentCents).toBeLessThan(7500)
    expect(calculateRapPayment(loan)).toMatchObject({monthlyPaymentCents:7500})
  })
  it('supports changing borrower and spouse balances with an explicit annual path',()=>{
    const path=Array.from({length:31},(_,index)=>({year:2027+index,amountCents:index===0?2000000:1000000}))
    const result=projectRepayment('rap',loan,{...assumptions,spouseDebtProjection:{kind:'annual_path',path}})
    expect(result.status).toBe('projected')
    if(result.status!=='projected')return
    expect(result.rapRecalculations[12].spouseDebtCents).toBe(1000000)
    expect(result.rapRecalculations[12].requiredPaymentCents).toBeGreaterThan(result.rapRecalculations[11].requiredPaymentCents)
  })
  it('includes accrued interest in the borrower numerator and denominator',()=>{
    const result=projectRepayment('rap',{...loan,accruedInterestCents:100000},assumptions)
    expect(result.status).toBe('projected')
    if(result.status==='projected')expect(result.rapRecalculations[0].requiredPaymentCents).toBe(7683)
  })
  it('fails closed for absent or incomplete spouse assumptions, including old stored records',()=>{
    expect(projectRepayment('rap',loan,{...assumptions,spouseDebtProjection:undefined}).status).toBe('unavailable')
    expect(projectRepayment('rap',loan,{...assumptions,spouseDebtProjection:{kind:'annual_path',path:[{year:2027,amountCents:2000000}]}}).status).toBe('unavailable')
    expect(projectionAssumptionsSchema.safeParse({...assumptions,spouseDebtProjection:{kind:'constant',amountCents:-1}}).success).toBe(false)
  })
  it('applies the $10 floor after updated proration',()=>{
    const result=projectRepayment('rap',loan,{...assumptions,incomePath:[{year:2026,agiCents:1000000}]})
    expect(result.status).toBe('projected')
    if(result.status==='projected')expect(result.rapRecalculations.every(row=>row.requiredPaymentCents===1000)).toBe(true)
  })
  it.each(['unmarried','married_filing_separately'] as const)('does not change %s projections',filingChoice=>{
    const scenario={...loan,filingChoice}
    expect(projectRepayment('rap',scenario,{...assumptions,spouseDebtProjection:undefined})).toEqual(projectRepayment('rap',scenario,assumptions))
  })
})
