import { describe,expect,it } from 'vitest'
import { buildExtraPayments,readExtraPayments } from './extraPayments'
import { projectRepayment } from './core'
import { loanScenarioSchema,projectionAssumptionsSchema } from './schema'

const loan=loanScenarioSchema.parse({id:'extra-test',name:'Extra test',type:'direct_subsidized_undergrad',borrowingHistory:'non_excepted',principalCents:2_000_000,accruedInterestCents:0,disbursementDate:'2026-07-01',fixedApr:null,enteredRepaymentAt:'2027-01-01',borrowerAgiCents:4_500_000,spouseAgiCents:0,filingChoice:'unmarried',familySize:1,state:'OH',rapDependents:0,spouseEligibleDebtCents:0,repayePaymentsSince2024:0,ibrEnrollmentSnapshot:null,parentPlusConsolidationHistory:null,subsidizedConsolidationPortionCents:0,createdAt:'2026-09-19T00:00:00.000Z',updatedAt:'2026-09-19T00:00:00.000Z'})
const assumptions=(extraPayments:ReturnType<typeof buildExtraPayments>)=>projectionAssumptionsSchema.parse({scenarioId:loan.id,incomePath:[{year:2026,agiCents:4_500_000}],dependentPath:[{year:2026,dependents:0}],povertyGuidelineVersionByYear:{'2026':'hhs-poverty-guidelines-2026'},recertificationAssumption:'annual_on_time',paymentTimingAssumption:'on_time_monthly',extraPayments})

describe('extra-payment UI schedules use the existing projection engine',()=>{
  it('preserves the no-extra baseline',()=>expect(projectRepayment('tiered',loan,assumptions(buildExtraPayments('none',0,1)))).toEqual(projectRepayment('tiered',loan,assumptions('none'))))
  it('models a recurring extra payment',()=>{const baseline=projectRepayment('tiered',loan,assumptions('none')),extra=projectRepayment('tiered',loan,assumptions(buildExtraPayments('recurring',5000,1)));expect(baseline.status).toBe('projected');expect(extra.status).toBe('projected');if(baseline.status==='projected'&&extra.status==='projected'){expect(extra.months).toBeLessThan(baseline.months);expect(extra.totalInterestChargedCents).toBeLessThan(baseline.totalInterestChargedCents)}})
  it('models a one-time extra payment at the selected month',()=>{const schedule=buildExtraPayments('one_time',25000,6);expect(schedule).toEqual([{month:6,amountCents:25000}]);const baseline=projectRepayment('tiered',loan,assumptions('none')),extra=projectRepayment('tiered',loan,assumptions(schedule));expect(extra).not.toEqual(baseline)})
  it('round-trips generated schedule controls',()=>{expect(readExtraPayments(buildExtraPayments('recurring',5000,1))).toEqual({mode:'recurring',amountCents:5000,month:1});expect(readExtraPayments(buildExtraPayments('one_time',25000,6))).toEqual({mode:'one_time',amountCents:25000,month:6})})
})
