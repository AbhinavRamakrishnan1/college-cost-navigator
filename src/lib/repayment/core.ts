import Decimal from 'decimal.js'
import { selectFederalLoanRates,selectPovertyGuidelines } from '../policy/selectors'
import type { DirectLoanType,LoanScenario,ProjectionAssumptions } from './schema'
import { spouseDebtProjectionSchema } from './schema'
import { borrowerIbrEligibility, consolidationEligibility, tieredEligibility } from './eligibility'
import { residenceSchema } from '../residence'

export const POLICY_VERSION_UNAVAILABLE='POLICY_VERSION_UNAVAILABLE' as const
const cents=(value:Decimal.Value)=>new Decimal(value).toDecimalPlaces(0,Decimal.ROUND_HALF_UP).toNumber()
const includedSpouse=(loan:LoanScenario)=>loan.filingChoice==='married_filing_jointly'
export const totalBalance=(loan:LoanScenario)=>loan.principalCents+loan.accruedInterestCents

export type RateResult={status:'available';apr:number;source:'federal_2026_27'|'borrower_provided'}|{status:'unavailable';reason:typeof POLICY_VERSION_UNAVAILABLE}
export function selectLoanRate(loan:Pick<LoanScenario,'type'|'disbursementDate'|'fixedApr'>):RateResult{
  const policy=selectFederalLoanRates(loan.disbursementDate)
  if(policy.ok&&loan.type!=='direct_consolidation'){const keys:Record<Exclude<DirectLoanType,'direct_consolidation'>,string>={direct_subsidized_undergrad:'directSubsidizedUndergrad',direct_unsubsidized_undergrad:'directUnsubsidizedUndergrad',direct_unsubsidized_grad_professional:'directUnsubsidizedGraduateProfessional',direct_plus_parent:'directPlusParentOrGradProfessional',direct_plus_grad_professional:'directPlusParentOrGradProfessional'};return {status:'available',apr:policy.value.rates[keys[loan.type]],source:'federal_2026_27'}}
  if(loan.fixedApr!==null)return {status:'available',apr:loan.fixedApr,source:'borrower_provided'}
  return {status:'unavailable',reason:POLICY_VERSION_UNAVAILABLE}
}
export function amortizedPaymentCents(balanceCents:number,apr:number,months:number){if(balanceCents<=0)return 0;if(apr===0)return cents(new Decimal(balanceCents).div(months));const rate=new Decimal(apr).div(12);return cents(new Decimal(balanceCents).mul(rate).div(new Decimal(1).minus(new Decimal(1).plus(rate).pow(-months))))}
export function tieredStandardTermMonths(totalDirectBalanceCents:number){if(totalDirectBalanceCents<2_500_000)return 120;if(totalDirectBalanceCents<5_000_000)return 180;if(totalDirectBalanceCents<10_000_000)return 240;return 300}
export function calculateTieredStandard(loans:LoanScenario[]){
  if(loans.length===0)return {status:'unavailable' as const,reason:'Cannot determine eligibility: no loans supplied.'}
  for(const loan of loans){const eligibility=tieredEligibility(loan);if(!eligibility.eligible)return {status:'unavailable' as const,reason:eligibility.reason}}
  const balance=loans.reduce((sum,loan)=>sum+totalBalance(loan),0),termMonths=tieredStandardTermMonths(balance),rates=loans.map(selectLoanRate)
  if(rates.some((rate)=>rate.status==='unavailable'))return {status:'unavailable' as const,reason:POLICY_VERSION_UNAVAILABLE,termMonths}
  const raw=loans.reduce((sum,loan,index)=>sum+amortizedPaymentCents(totalBalance(loan),(rates[index] as Extract<RateResult,{status:'available'}>).apr,termMonths),0)
  return {status:'eligible' as const,label:'Tiered Standard monthly payment estimate',termMonths,monthlyPaymentCents:balance===0?0:Math.min(balance,Math.max(5000,raw)),rateSources:[...new Set(rates.map((rate)=>(rate as Extract<RateResult,{status:'available'}>).source))]}
}

// The annual base is an intermediate value: retain fractional cents until monthly output.
function rapAnnualBase(agiCents:number){const dollars=new Decimal(agiCents).div(100);if(dollars.lte(10_000))return new Decimal(12_000);const percent=dollars.lte(20_000)?1:dollars.lte(30_000)?2:dollars.lte(40_000)?3:dollars.lte(50_000)?4:dollars.lte(60_000)?5:dollars.lte(70_000)?6:dollars.lte(80_000)?7:dollars.lte(90_000)?8:dollars.lte(100_000)?9:10;return new Decimal(agiCents).mul(percent).div(100)}
export function rapAnnualBaseCents(agiCents:number){return rapAnnualBase(agiCents).toNumber()}
export function rapEligibility(loan:LoanScenario){
  if(loan.type==='direct_plus_parent')return {eligible:false as const,reason:'Direct Parent PLUS is not RAP-eligible.'}
  return consolidationEligibility(loan)
}
export function calculateRapPayment(loan:LoanScenario,agiCents= includedSpouse(loan)?loan.borrowerAgiCents+loan.spouseAgiCents:loan.borrowerAgiCents,dependents=loan.rapDependents){
  const eligibility=rapEligibility(loan);if(!eligibility.eligible)return {status:'unavailable' as const,reason:eligibility.reason}
  let payment=rapAnnualBase(agiCents).div(12).minus(new Decimal(dependents).mul(5000))
  if(includedSpouse(loan)){const borrowerDebt=totalBalance(loan),combined=borrowerDebt+loan.spouseEligibleDebtCents;payment=combined===0?new Decimal(0):payment.mul(borrowerDebt).div(combined)}
  return {status:'eligible' as const,monthlyPaymentCents:cents(Decimal.max(1000,payment)),agiCents,spouseProrationApplied:includedSpouse(loan),forgivenessMonths:360}
}

const stateRegion=(state:string)=>{const value=residenceSchema.parse(state);return value==='AK'?'alaska':value==='HI'?'hawaii':'contiguous48_dc'}
export function povertyGuidelineCents(year:number,state:string,familySize:number){const selected=selectPovertyGuidelines(year,'idr');if(!selected.ok)return {status:'unavailable' as const,reason:POLICY_VERSION_UNAVAILABLE};const table=selected.value.regions[stateRegion(state)],size=Math.max(1,familySize),dollars=size<=8?table[String(size)]:table['8']+(size-8)*table.eachAdditional;return {status:'available' as const,amountCents:dollars*100,version:selected.value.id}}
export function ibrEligibility(loan:LoanScenario){
  if(loan.disbursementDate>='2026-07-01')return {eligible:false as const,reason:'IBR is unavailable for Direct Loans made on or after July 1, 2026.'}
  if(loan.repayePaymentsSince2024>=60)return {eligible:false as const,reason:'60 or more qualifying REPAYE payments block new IBR enrollment.'}
  if(loan.type==='direct_plus_parent')return {eligible:false as const,reason:'Direct Parent PLUS is not eligible for IBR.'}
  const consolidation=consolidationEligibility(loan);if(!consolidation.eligible)return consolidation
  const borrower=borrowerIbrEligibility(loan);if(!borrower.eligible)return borrower
  if(!loan.ibrEnrollmentSnapshot)return {eligible:false as const,reason:'A verified IBR cohort and entry-payment cap are required.'}
  return {eligible:true as const,snapshot:loan.ibrEnrollmentSnapshot}
}
export function calculateIbrPayment(loan:LoanScenario,year=2026,agiCents=includedSpouse(loan)?loan.borrowerAgiCents+loan.spouseAgiCents:loan.borrowerAgiCents){
  const eligibility=ibrEligibility(loan);if(!eligibility.eligible)return {status:'unavailable' as const,reason:eligibility.reason}
  const poverty=povertyGuidelineCents(year,loan.state,loan.familySize);if(poverty.status==='unavailable')return poverty
  const discretionary=Math.max(0,agiCents-cents(new Decimal(poverty.amountCents).mul(1.5))),percent=eligibility.snapshot.cohort==='new'?0.10:0.15
  let payment=Decimal.min(new Decimal(discretionary).mul(percent).div(12),eligibility.snapshot.tenYearStandardCapCents)
  if(includedSpouse(loan)){const borrowerDebt=eligibility.snapshot.eligibleBalanceCents,combined=borrowerDebt+loan.spouseEligibleDebtCents;payment=combined===0?new Decimal(0):payment.mul(borrowerDebt).div(combined)}
  // Test the unrounded adjusted amount before converting the result to cents.
  const monthly=payment.lt(500)?0:payment.lt(1000)?1000:cents(payment)
  if(monthly>eligibility.snapshot.tenYearStandardCapCents)return {status:'unavailable' as const,reason:'The supplied entry cap conflicts with the contract small-payment adjustment; verify the snapshot.'}
  return {status:'eligible' as const,monthlyPaymentCents:monthly,cohort:eligibility.snapshot.cohort,forgivenessMonths:eligibility.snapshot.cohort==='new'?240:300,povertyGuidelineCents:poverty.amountCents,povertyVersion:poverty.version}
}

export type RapRecalculation={month:number;year:number;principalCents:number;accruedInterestCents:number;spouseDebtCents:number|null;requiredPaymentCents:number}
export type ProjectionResult={status:'projected';months:number;monthlyPaymentCents:number;totalPaidCents:number;totalInterestChargedCents:number;interestProtectedCents:number;principalMatchedCents:number;forgivenCents:number;endingBalanceCents:number;rapRecalculations:RapRecalculation[]}|{status:'unavailable';reason:string}
export function projectedSpouseDebt(loan:LoanScenario,assumptions:ProjectionAssumptions,year:number):number|null{
  if(!includedSpouse(loan))return 0
  const parsed=spouseDebtProjectionSchema.safeParse(assumptions.spouseDebtProjection)
  if(!parsed.success)return null
  const projection=parsed.data
  return projection.kind==='constant'?projection.amountCents:projection.path.find(entry=>entry.year===year)?.amountCents??null
}
const pathValue=(path:Array<{year:number;agiCents:number}>,year:number,fallback:number)=>path.findLast((entry)=>entry.year<=year)?.agiCents??fallback
const dependentValue=(path:Array<{year:number;dependents:number}>,year:number,fallback:number)=>path.findLast((entry)=>entry.year<=year)?.dependents??fallback
function applyPayment(principal:number,interest:number,payment:number){const interestPaid=Math.min(interest,payment),principalPaid=Math.min(principal,payment-interestPaid);return {principal:principal-principalPaid,interest:interest-interestPaid,principalPaid}}
export function ibrInterestProtectionCents(loan:LoanScenario,month:number,unpaidInterestCents:number,accruedThisMonthCents:number){if(month<1||month>36)return 0;const eligibleShare=loan.type==='direct_subsidized_undergrad'?1:loan.type==='direct_consolidation'&&loan.principalCents>0?Math.min(1,loan.subsidizedConsolidationPortionCents/loan.principalCents):0;return cents(new Decimal(Math.min(unpaidInterestCents,accruedThisMonthCents)).mul(eligibleShare))}
export function projectRepayment(plan:'tiered'|'rap'|'ibr',loan:LoanScenario,assumptions:ProjectionAssumptions):ProjectionResult{
  const rate=selectLoanRate(loan);if(rate.status==='unavailable')return {status:'unavailable',reason:rate.reason}
  const current=plan==='tiered'?calculateTieredStandard([loan]):plan==='rap'?calculateRapPayment(loan):calculateIbrPayment(loan)
  if(current.status!=='eligible')return {status:'unavailable',reason:current.reason}
  const maxMonths=plan==='tiered'?tieredStandardTermMonths(totalBalance(loan)):plan==='rap'?360:loan.ibrEnrollmentSnapshot?.cohort==='new'?240:300
  const projectionStartYear=loan.enteredRepaymentAt?Number(loan.enteredRepaymentAt.slice(0,4)):2026
  const projectionStartMonth=loan.enteredRepaymentAt?Number(loan.enteredRepaymentAt.slice(5,7))-1:0
  if(assumptions.scenarioId!==loan.id||!assumptions.incomePath.some(entry=>entry.year<=projectionStartYear)||!assumptions.dependentPath.some(entry=>entry.year<=projectionStartYear))return {status:'unavailable',reason:'Incomplete or mismatched projection assumptions.'}
  let principal=loan.principalCents,interest=loan.accruedInterestCents,totalPaid=0,interestCharged=0,protectedInterest=0,matched=0,month=0,lastPayment=current.monthlyPaymentCents
  const rapRecalculations:RapRecalculation[]=[]
  for(month=1;month<=maxMonths&&principal+interest>0;month++){
    const year=projectionStartYear+Math.floor((projectionStartMonth+month-1)/12),agi=pathValue(assumptions.incomePath,year,loan.borrowerAgiCents),deps=dependentValue(assumptions.dependentPath,year,loan.rapDependents)
    const expectedPovertyVersion=assumptions.povertyGuidelineVersionByYear[String(year)]
    let recalculated
    if(plan==='ibr'){
      if(!expectedPovertyVersion)return {status:'unavailable',reason:POLICY_VERSION_UNAVAILABLE}
      const ibrPayment=calculateIbrPayment(loan,year,agi)
      if(ibrPayment.status==='eligible'&&ibrPayment.povertyVersion!==expectedPovertyVersion)return {status:'unavailable',reason:POLICY_VERSION_UNAVAILABLE}
      recalculated=ibrPayment
    }else if(plan==='rap'){
      const spouseDebt=projectedSpouseDebt(loan,assumptions,year)
      if(spouseDebt===null)return {status:'unavailable',reason:'An explicit spouse eligible-debt projection covering this year is required for joint-filing RAP. Select a debt path or explicitly accept a constant-debt assumption.'}
      recalculated=calculateRapPayment({...loan,principalCents:principal,accruedInterestCents:interest,spouseEligibleDebtCents:spouseDebt},agi,deps)
      if(recalculated.status==='eligible')rapRecalculations.push({month,year,principalCents:principal,accruedInterestCents:interest,spouseDebtCents:includedSpouse(loan)?spouseDebt:null,requiredPaymentCents:recalculated.monthlyPaymentCents})
    }else recalculated=current
    if(recalculated.status!=='eligible')return {status:'unavailable',reason:recalculated.reason}
    const requiredPayment=plan==='tiered'?Math.max(5000,recalculated.monthlyPaymentCents):recalculated.monthlyPaymentCents
    const accrued=cents(new Decimal(principal).mul(rate.apr).div(12));interest+=accrued;interestCharged+=accrued
    lastPayment=Math.min(principal+interest,requiredPayment)
    const applied=applyPayment(principal,interest,lastPayment);principal=applied.principal;interest=applied.interest;totalPaid+=lastPayment
    if(plan==='rap'){protectedInterest+=interest;interest=0;const match=Math.max(0,Math.min(5000,lastPayment)-applied.principalPaid),actual=Math.min(match,principal);principal-=actual;matched+=actual}
    if(plan==='ibr'){const protection=ibrInterestProtectionCents(loan,month,interest,accrued);interest-=protection;protectedInterest+=protection}
    if(assumptions.extraPayments!=='none'){const extra=assumptions.extraPayments.filter(entry=>entry.month===month).reduce((sum,entry)=>sum+entry.amountCents,0),extraApplied=Math.min(extra,principal+interest);const after=applyPayment(principal,interest,extraApplied);principal=after.principal;interest=after.interest;totalPaid+=extraApplied}
  }
  const reachedForgiveness=(plan==='rap'||plan==='ibr')&&month>maxMonths&&principal+interest>0,forgiven=reachedForgiveness?principal+interest:0;if(reachedForgiveness){principal=0;interest=0}
  return {status:'projected',months:Math.min(month-1,maxMonths),monthlyPaymentCents:lastPayment,totalPaidCents:totalPaid,totalInterestChargedCents:interestCharged,interestProtectedCents:protectedInterest,principalMatchedCents:matched,forgivenCents:forgiven,endingBalanceCents:principal+interest,rapRecalculations}
}
export function countsTowardForgiveness(source:'rap'|'tiered'|'ibr'|'paye'|'icr',target:'rap'|'ibr',date:string){if(target==='ibr')return source==='ibr';return source==='rap'||source==='tiered'||source==='ibr'||((source==='paye'||source==='icr')&&date<'2028-07-01')}
