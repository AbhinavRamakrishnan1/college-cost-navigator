import poverty from '../../data/policy/hhs-poverty-guidelines-2024-pell.json'
import { saiWhole } from './sai'
import type { PellInputs, PellResult } from './types'

export const MAX_PELL = 7395, MIN_PELL = 740, PELL_SAI_CEILING = 14790
export const nearestFive = (value: number) => Math.round(value / 5) * 5
export function pellPovertyGuideline(familySize: number, state: string): number {
  if (!Number.isInteger(familySize) || familySize < 1) throw new RangeError('Family size must be a positive integer')
  const region = state.trim().toLowerCase() === 'alaska' ? poverty.regions.alaska : state.trim().toLowerCase() === 'hawaii' ? poverty.regions.hawaii : poverty.regions.contiguous48_dc_other_for_fafsa
  if (familySize <= 8) return region[String(familySize) as keyof typeof region]
  return region['8'] + (familySize - 8) * region.eachAdditional
}
export function calculatePell(input: PellInputs): PellResult {
  if (input.sai >= PELL_SAI_CEILING && input.possibleSpecialRuleDependent) return { status: 'unsupported', reason: 'special_rule_not_modeled', specialRuleNotModeled: true }
  if (input.sai >= PELL_SAI_CEILING) return { status: 'ineligible', reason: 'sai_threshold' }
  const base = pellPovertyGuideline(input.familySize, input.parentState)
  const agi = input.parentAgi + (input.parentForeignIncomeExclusion ?? 0)
  const maxThreshold = saiWhole(base * (input.parentSingleParent ? 2.25 : 1.75))
  const maxEligible = input.qualifyingParentNonfiler || (agi > 0 && agi <= maxThreshold)
  if (maxEligible) return { status: 'eligible', eligibility: 'maximum', scheduledAward: Math.min(MAX_PELL, input.pellCoa), label: 'Scheduled Award estimate' }
  const raw = MAX_PELL - input.sai
  if (raw >= MIN_PELL) {
    const rounded = nearestFive(raw)
    return { status: 'eligible', eligibility: 'calculated', rawCalculatedPell: raw, roundedCalculatedPell: rounded, scheduledAward: Math.min(rounded, input.pellCoa), label: 'Scheduled Award estimate' }
  }
  const minThreshold = saiWhole(base * (input.parentSingleParent ? 3.25 : 2.75))
  if (agi <= minThreshold) return { status: 'eligible', eligibility: 'minimum', scheduledAward: Math.min(MIN_PELL, input.pellCoa), label: 'Scheduled Award estimate' }
  return { status: 'ineligible', reason: 'income_threshold' }
}
