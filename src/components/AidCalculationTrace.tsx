import type { PellResult,SaiResult } from '../lib/calculations'
import { CalculationTrace,ExplanationRow,InlineDefinition } from './Explainability'

const money=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value)
const index=(value:number)=>value.toLocaleString('en-US')

export function SaiCalculationTrace({result}:{result:Extract<SaiResult,{status:'calculated'}>}){
  if(!result.ordinaryFormulaRun)return <CalculationTrace title="Show how we calculated your SAI" testId="sai-trace"><p className="font-bold">Qualifying nonfiler pathway</p><p className="mt-2 text-sm leading-6">The federal rule assigns an SAI of −1,500 for this qualifying pathway, so the ordinary Formula A worksheet was not run.</p><dl className="mt-4"><ExplanationRow label="Final bounded SAI" value={index(result.sai)} explanation="SAI is an eligibility index, not a bill or a required family payment."/></dl></CalculationTrace>
  const w=result.worksheet
  if(!w)return null
  return <CalculationTrace title="Show how we calculated your SAI" testId="sai-trace">
    <p className="text-sm leading-6">These values come from the same federal worksheet calculation that produced the displayed SAI. Dollar amounts are rounded using the federal worksheet rules.</p>
    <section className="mt-5" aria-labelledby="parent-trace"><h3 id="parent-trace" className="font-serif text-xl font-bold">Parent calculation</h3><dl className="mt-2">
      <ExplanationRow label="Parent income additions" value={money(w.parentIncomeAdditions)} explanation="AGI and applicable federal income additions used by Formula A."/>
      {w.parentIncomeOffsets!==0?<ExplanationRow label="Parent income offsets" value={`−${money(Math.abs(w.parentIncomeOffsets))}`} explanation="Applicable grants, education credits, and Federal Work-Study offsets."/>:null}
      <ExplanationRow label="Total parent income used" value={money(w.totalParentIncome)}/>
      <ExplanationRow label="Income Protection Allowance" value={`−${money(w.parentIpa)}`} explanation="A federally defined amount protected for basic family expenses."/>
      {w.parentEmploymentExpense!==0?<ExplanationRow label="Employment expense allowance" value={`−${money(w.parentEmploymentExpense)}`}/>:null}
      {w.parentMedicareHi!==0?<ExplanationRow label="Medicare HI payroll allowance" value={`−${money(w.parentMedicareHi)}`}/>:null}
      {w.parentOasdi!==0?<ExplanationRow label="OASDI payroll allowance" value={`−${money(w.parentOasdi)}`}/>:null}
      <ExplanationRow label="Total parent allowances" value={`−${money(w.parentAllowances)}`}/>
      <ExplanationRow label="Parent available income" value={money(w.parentAvailableIncome)}/>
      {w.assetExempt?<ExplanationRow label="Assets were not included" value="Exempt" explanation="This household qualifies for the federal asset-reporting exemption, so the calculation did not require or fabricate parent or student asset values."/>:<><ExplanationRow label="Reportable parent assets" value={money(w.parentNetWorth)}/><ExplanationRow label="Parent contribution from assets" value={money(w.parentContributionFromAssets)} explanation="Formula A applies the federal parent asset conversion rate after applicable exclusions and adjustments."/></>}
      <ExplanationRow label="Parent adjusted available income" value={money(w.parentAdjustedAvailableIncome)}/>
      <ExplanationRow label="Final parent contribution" value={money(w.parentContribution)} explanation="The federal Table A5 rate applies to parent adjusted available income; this value can be negative."/>
    </dl></section>
    <section className="mt-6" aria-labelledby="student-trace"><h3 id="student-trace" className="font-serif text-xl font-bold">Student calculation</h3><dl className="mt-2">
      <ExplanationRow label="Student income additions" value={money(w.studentIncomeAdditions)}/>
      {w.studentIncomeOffsets!==0?<ExplanationRow label="Student income offsets" value={`−${money(Math.abs(w.studentIncomeOffsets))}`}/>:null}
      <ExplanationRow label="Total student income used" value={money(w.totalStudentIncome)}/>
      <ExplanationRow label="Student income protection allowance" value={`−${money(w.studentIncomeProtectionAllowance)}`} explanation="A federally defined amount of student income protected before assessment."/>
      {w.studentMedicareHi!==0?<ExplanationRow label="Student Medicare HI payroll allowance" value={`−${money(w.studentMedicareHi)}`}/>:null}
      {w.studentOasdi!==0?<ExplanationRow label="Student OASDI payroll allowance" value={`−${money(w.studentOasdi)}`}/>:null}
      <ExplanationRow label="Total student allowances" value={`−${money(w.studentAllowances)}`} explanation="Includes the income protection, applicable income-tax and payroll allowances, and any negative-parent-income allowance."/>
      <ExplanationRow label="Student available income" value={money(w.studentAvailableIncome)}/>
      <ExplanationRow label="Student contribution from income" value={money(w.studentContributionFromIncome)} explanation="The student income contribution cannot be below zero."/>
      {!w.assetExempt?<><ExplanationRow label="Reportable student assets" value={money(w.studentNetWorth)}/><ExplanationRow label="Student contribution from assets" value={money(w.studentContributionFromAssets)} explanation="The student asset contribution cannot be below zero."/></>:null}
    </dl></section>
    <section className="mt-6" aria-labelledby="final-trace"><h3 id="final-trace" className="font-serif text-xl font-bold">Final SAI</h3><dl className="mt-2"><ExplanationRow label="Parent contribution" value={money(w.parentContribution)}/><ExplanationRow label="Student contribution from income" value={money(w.studentContributionFromIncome)}/><ExplanationRow label="Student contribution from assets" value={money(w.studentContributionFromAssets)}/><ExplanationRow label="Raw SAI" value={index(w.rawSai)}/>{w.calculatedSai!==w.rawSai?<ExplanationRow label="SAI after applicable Maximum Pell rule" value={index(w.calculatedSai)} explanation="This federal path caps the ordinary SAI at zero before the final statutory bounds."/>:null}<ExplanationRow label="Final bounded SAI" value={index(w.finalSai)} explanation="The statutory SAI range is −1,500 through 999,999. This remains an index, not an amount due."/></dl></section>
  </CalculationTrace>
}

export function PellCalculationTrace({result}:{result:PellResult}){
  const t=result.trace
  return <CalculationTrace title="Show how we estimated Pell" testId="pell-trace">
    {t.path==='maximum'?<><p className="font-bold">Maximum Pell path</p><p className="mt-2 text-sm">{t.maximumReason==='qualifying_nonfiler'?'The qualifying nonfiler rule placed this household on the Maximum Pell path.':'The household income used for this test was within the applicable federal poverty-guideline threshold.'}</p></>:null}
    {t.path==='calculated'?<><p className="font-bold">Calculated Pell path</p><p className="mt-2 text-sm">The estimate subtracts the Pell-specific SAI from the published maximum, checks the minimum threshold, rounds to the nearest $5, then compares that result with Pell cost of attendance.</p></>:null}
    {t.path==='minimum'?<><p className="font-bold">Minimum Pell path</p><p className="mt-2 text-sm">The Calculated Pell result was below the federal minimum, but household income was within the applicable Minimum Pell threshold.</p></>:null}
    {t.path==='ineligible'?<><p className="font-bold">Ineligible under the modeled Pell paths</p><p className="mt-2 text-sm">{t.ineligibleReason==='sai_threshold'?'The reported SAI is at or above the modeled Pell SAI ceiling.':'The calculation did not qualify under the Maximum, Calculated, or Minimum Pell paths.'}</p></>:null}
    {t.path==='special_rule_verification'?<><p className="font-bold">Special-rule verification required</p><p className="mt-2 text-sm">A statutory dependent-student special rule may apply. This app cannot verify that evidence and therefore does not show an ordinary Pell eligibility conclusion.</p></>:null}
    <dl className="mt-4"><ExplanationRow label="Reported SAI" value={index(t.reportedSai)} explanation="The actual SAI remains unchanged."/>{t.path==='calculated'?<><ExplanationRow label="Pell SAI used for subtraction" value={index(t.pellSai)} explanation={t.reportedSai<0?'Federal law treats a negative SAI as zero only for this Calculated Pell subtraction. The displayed SAI remains negative.':undefined}/><ExplanationRow label="Published maximum Pell amount" value={money(t.maximumScheduledAward)}/><ExplanationRow label="Maximum minus Pell SAI" value={money(t.rawCalculatedPell!)}/><ExplanationRow label="Nearest-$5 result" value={money(t.roundedCalculatedPell!)}/></>:null}{t.path==='maximum'?<><ExplanationRow label="Published maximum Pell amount" value={money(t.maximumScheduledAward)}/>{t.maximumReason==='family_income'?<><ExplanationRow label="Household income used for this test" value={money(t.familyIncome!)}/><ExplanationRow label="Maximum Pell income threshold" value={money(t.maximumIncomeThreshold!)}/></>:null}</>:null}{t.path==='minimum'?<><ExplanationRow label="Calculated amount before Minimum Pell test" value={money(t.rawCalculatedPell!)} /><ExplanationRow label="Household income used for this test" value={money(t.familyIncome!)}/><ExplanationRow label="Minimum Pell income threshold" value={money(t.minimumIncomeThreshold!)}/><ExplanationRow label="Published minimum Pell amount" value={money(t.minimumScheduledAward)}/></>:null}{t.path==='ineligible'&&t.ineligibleReason==='income_threshold'?<><ExplanationRow label="Household income used for this test" value={money(t.familyIncome!)}/><ExplanationRow label="Minimum Pell income threshold" value={money(t.minimumIncomeThreshold!)}/></>:null}{result.status==='eligible'?<><ExplanationRow label="Pell cost of attendance" value={money(t.pellCoa)} explanation="This Pell-specific COA is an award limit, not the school’s published sticker price."/><ExplanationRow label="Final Scheduled Award estimate" value={money(result.scheduledAward)} explanation={t.coaLimited?'The unrounded Pell cost of attendance was lower, so it became the final limit.':'Cost of attendance did not reduce this Scheduled Award estimate.'}/></>:null}</dl>
    <div className="mt-4 text-sm"><InlineDefinition term="Scheduled Award" learnMore="/methodology#pell">The annual Pell amount before enrollment intensity and other disbursement factors are applied.</InlineDefinition></div>
  </CalculationTrace>
}
