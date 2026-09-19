import Decimal from 'decimal.js'
import type { AssetExemptionFacts, BusinessFarmAsset, DependentSaiInputs, FilingStatus, IncomeInputs, SaiResult, TaxReturnWorkIncome } from './types'

const D = (value: Decimal.Value) => new Decimal(value)
const n = (value: number | undefined) => value ?? 0
export function saiWhole(value: Decimal.Value): number {
  const rounded = D(value).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()
  return Object.is(rounded, -0) ? 0 : rounded
}
const three = (value: Decimal.Value) => D(value).toDecimalPlaces(3, Decimal.ROUND_HALF_UP)

export function incomeAdditions(input: IncomeInputs): number {
  return saiWhole(D(input.agi).plus(n(input.deductiblePayments)).plus(n(input.taxExemptInterest))
    .plus(Decimal.max(0, D(n(input.untaxedIraDistributions)).minus(n(input.iraRollover))))
    .plus(Decimal.max(0, D(n(input.untaxedPensions)).minus(n(input.pensionRollover))))
    .plus(D(n(input.foreignIncomeExclusion)).abs()))
}
export function incomeOffsets(input: IncomeInputs): number { return saiWhole(D(n(input.taxableGrants)).plus(n(input.educationCredits)).plus(n(input.federalWorkStudy))) }

const hiThreshold: Record<FilingStatus, number> = { single: 200000, head_of_household: 200000, qualifying_surviving_spouse: 200000, married_filing_jointly: 250000, married_filing_separately: 125000, dependent_student: 200000 }
const oasdiBase: Record<FilingStatus, number> = { single: 168600, head_of_household: 168600, qualifying_surviving_spouse: 168600, married_filing_jointly: 337200, married_filing_separately: 168600, dependent_student: 168600 }
const payrollRaw = (entry: TaxReturnWorkIncome, kind: 'hi' | 'oasdi') => {
  const income = Decimal.max(0, entry.workIncome)
  if (kind === 'oasdi') return Decimal.min(income, oasdiBase[entry.filingStatus]).times('0.062')
  const threshold = D(hiThreshold[entry.filingStatus])
  return Decimal.min(income, threshold).times('0.0145').plus(Decimal.max(0, income.minus(threshold)).times('0.0235'))
}
function normalizedReturns(returns: TaxReturnWorkIncome[]): TaxReturnWorkIncome[] {
  const joint = returns.filter((r) => r.filingStatus === 'married_filing_jointly')
  if (joint.length < 2) return returns
  return [{ filingStatus: 'married_filing_jointly', workIncome: joint.reduce((sum, r) => sum + r.workIncome, 0) }, ...returns.filter((r) => r.filingStatus !== 'married_filing_jointly')]
}
export function payrollAllowance(returns: TaxReturnWorkIncome[] = [], kind: 'hi' | 'oasdi'): number {
  return saiWhole(normalizedReturns(returns).reduce((sum, entry) => sum.plus(three(payrollRaw(entry, kind))), D(0)))
}
export const medicareHiAllowance = (returns: TaxReturnWorkIncome[] = []) => payrollAllowance(returns, 'hi')
export const oasdiAllowance = (returns: TaxReturnWorkIncome[] = []) => payrollAllowance(returns, 'oasdi')

export function parentIncomeProtectionAllowance(familySize: number): number {
  if (!Number.isInteger(familySize) || familySize < 2) throw new RangeError('Formula A family size must be an integer of at least 2')
  const table: Record<number, number> = { 2: 29190, 3: 36330, 4: 44880, 5: 52950, 6: 61930 }
  return table[familySize] ?? 61930 + (familySize - 6) * 6990
}
export function isAssetReportingExempt(f: AssetExemptionFacts): boolean {
  const foreignException = f.parentsLiveOutsideUs || (!f.parentsFiledUsOrTerritoryReturn && !f.nonfilingBelowFilingThreshold)
  if (foreignException) return false
  const simpleTax = f.parentAgi < 60000 && !f.filedSchedulesA_B_D_E_F_H && (f.scheduleC === 'not_filed' || Math.abs(n(f.scheduleCNetIncome)) <= 10000)
  return f.qualifiesForMaximumPell || simpleTax || f.receivedMeansTestedBenefit
}
export function reportableBusinessFarmNetWorth(items: BusinessFarmAsset[] = []): number {
  return saiWhole(items.reduce((sum, item) => {
    const excluded = (item.category === 'family_business' && item.familyOwnedOrControlled === true && typeof item.fullTimeEquivalentEmployees === 'number' && item.fullTimeEquivalentEmployees <= 100)
      || (item.category === 'family_residence_farm' && item.familyOwnedOrControlled === true)
      || (item.category === 'family_commercial_fishing' && item.familyOwnedOrControlled === true)
    return sum + (excluded ? 0 : Math.max(0, item.netWorth))
  }, 0))
}
export function adjustBusinessFarmNetWorth(value: number): number {
  if (value < 1) return 0
  if (value <= 175000) return saiWhole(D(value).times('.4'))
  if (value <= 520000) return saiWhole(D(70000).plus(D(value).minus(175000).times('.5')))
  if (value <= 870000) return saiWhole(D(242500).plus(D(value).minus(520000).times('.6')))
  return saiWhole(D(452500).plus(D(value).minus(870000)))
}
export const parentContributionFromAssets = (netWorth: number) => Math.max(0, saiWhole(D(netWorth).times('.12')))
export function tableA5ParentContribution(paai: number): number {
  if (paai < -8500) return -1870
  if (paai <= 21800) return saiWhole(D(paai).times('.22'))
  if (paai <= 27300) return saiWhole(D(4796).plus(D(paai).minus(21800).times('.25')))
  if (paai <= 32800) return saiWhole(D(6171).plus(D(paai).minus(27300).times('.29')))
  if (paai <= 38400) return saiWhole(D(7766).plus(D(paai).minus(32800).times('.34')))
  if (paai <= 43900) return saiWhole(D(9670).plus(D(paai).minus(38400).times('.4')))
  return saiWhole(D(11870).plus(D(paai).minus(43900).times('.47')))
}
export const boundSai = (sai: number) => Math.max(-1500, Math.min(999999, saiWhole(sai)))
export const nonfilerSai = ():SaiResult => ({status:'calculated',sai:-1500,maxPellIndicator:1,ordinaryFormulaRun:false})

export function calculateDependentSai(input: DependentSaiInputs): SaiResult {
  if (input.dependencyStatus !== 'dependent') return { status: 'unsupported', reason: 'unsupported_dependency_status' }
  const indicator = input.maxPellIndicator ?? 0
  if (indicator === 1) return nonfilerSai()
  if (!Number.isInteger(input.familySize) || input.familySize < 2) return { status: 'incomplete', missing: ['valid family size of at least 2'] }
  const exempt = isAssetReportingExempt(input.assetExemption)
  const missing = [] as string[]
  if (!exempt && !input.parentAssets) missing.push('parent assets')
  if (!exempt && !input.studentAssets) missing.push('student assets')
  if (missing.length) return { status: 'incomplete', missing }
  const pAdd = incomeAdditions(input.parentIncome), pOff = incomeOffsets(input.parentIncome), totalP = saiWhole(D(pAdd).minus(pOff))
  const pHi = medicareHiAllowance(input.parentIncome.workReturns), pOasdi = oasdiAllowance(input.parentIncome.workReturns)
  const ipa = parentIncomeProtectionAllowance(input.familySize)
  const workIncome = (input.parentIncome.workReturns ?? []).reduce((sum, r) => sum + r.workIncome, 0)
  const eea = Math.max(0, saiWhole(Decimal.min(D(workIncome).times('.35'), 5000)))
  const pAllow = saiWhole(D(n(input.parentIncome.incomeTaxPaid)).plus(pHi).plus(pOasdi).plus(ipa).plus(eea))
  const pai = saiWhole(D(totalP).minus(pAllow))
  const pa = input.parentAssets
  const pBusiness = exempt ? 0 : adjustBusinessFarmNetWorth(reportableBusinessFarmNetWorth(pa?.businessFarmAssets))
  const pNet = exempt ? 0 : saiWhole(D(n(pa?.annualChildSupportReceived)).plus(n(pa?.cashSavingsChecking)).plus(Math.max(0, n(pa?.investmentNetWorth))).plus(pBusiness))
  const pAssets = exempt ? 0 : parentContributionFromAssets(pNet), paai = saiWhole(D(pai).plus(pAssets)), pc = tableA5ParentContribution(paai)
  const sAdd = incomeAdditions(input.studentIncome), sOff = incomeOffsets(input.studentIncome), totalS = saiWhole(D(sAdd).minus(sOff))
  const sHi = medicareHiAllowance(input.studentIncome.workReturns), sOasdi = oasdiAllowance(input.studentIncome.workReturns)
  const studentIpa=11770,sAllow = saiWhole(D(n(input.studentIncome.incomeTaxPaid)).plus(sHi).plus(sOasdi).plus(studentIpa).plus(paai < 0 ? Math.abs(paai) : 0))
  const saiIncome = saiWhole(D(totalS).minus(sAllow)), sci = Math.max(0, saiWhole(D(saiIncome).times('.5')))
  const sa = input.studentAssets
  const sBusiness = exempt ? 0 : adjustBusinessFarmNetWorth(reportableBusinessFarmNetWorth(sa?.businessFarmAssets))
  const sNet = exempt ? 0 : saiWhole(D(n(sa?.cashSavingsChecking)).plus(Math.max(0, n(sa?.investmentNetWorth))).plus(sBusiness))
  const sca = exempt ? 0 : Math.max(0, saiWhole(D(sNet).times('.2')))
  const raw = saiWhole(D(pc).plus(sci).plus(sca)), calculated = indicator === 2 || indicator === 3 ? Math.min(raw, 0) : raw, finalSai = boundSai(calculated)
  return { status: 'calculated', sai: finalSai, maxPellIndicator: indicator, ordinaryFormulaRun: true, worksheet: { parentIncomeAdditions:pAdd,parentIncomeOffsets:pOff,totalParentIncome:totalP,parentMedicareHi:pHi,parentOasdi:pOasdi,parentIpa:ipa,parentEmploymentExpense:eea,parentAllowances:pAllow,parentAvailableIncome:pai,parentNetWorth:pNet,parentContributionFromAssets:pAssets,parentAdjustedAvailableIncome:paai,parentContribution:pc,studentIncomeAdditions:sAdd,studentIncomeOffsets:sOff,totalStudentIncome:totalS,studentMedicareHi:sHi,studentOasdi:sOasdi,studentIncomeProtectionAllowance:studentIpa,studentAllowances:sAllow,studentAvailableIncome:saiIncome,studentContributionFromIncome:sci,studentNetWorth:sNet,studentContributionFromAssets:sca,assetExempt:exempt,rawSai:raw,calculatedSai:calculated,finalSai } }
}
