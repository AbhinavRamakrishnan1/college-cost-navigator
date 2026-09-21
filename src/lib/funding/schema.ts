import { z } from 'zod'

const moneyCentsSchema = z.number().int().nonnegative().safe()
const knownProvenanceSchema = z.object({ source: z.string().min(1), asOf: z.iso.date().optional() })
const assumptionProvenanceSchema = z.object({ source: z.string().min(1), createdFor: z.string().min(1) })

export const planningMoneySchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('known'), value: moneyCentsSchema, provenance: knownProvenanceSchema }),
  z.object({ status: z.literal('assumed'), value: moneyCentsSchema, explanation: z.string().min(1), provenance: assumptionProvenanceSchema }),
  z.object({ status: z.literal('unknown'), reason: z.string().min(1) }),
])

const componentsSchema = z.object({
  tuitionAndRequiredFeesCents: planningMoneySchema,
  housingAndFoodCents: planningMoneySchema,
  booksAndSuppliesCents: planningMoneySchema,
  transportationCents: planningMoneySchema,
  otherEducationCostsCents: planningMoneySchema,
})

export const annualCostInputSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('total'), totalCostCents: planningMoneySchema }).strict(),
  z.object({ mode: z.literal('components'), components: componentsSchema }).strict(),
])

export const growthAssumptionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('flat'), explanation: z.string().min(1), provenance: assumptionProvenanceSchema }),
  z.object({ kind: z.literal('percentage'), annualPercent: z.number().finite().min(-100).max(1000), explanation: z.string().min(1), provenance: assumptionProvenanceSchema }),
])

export const costProjectionInputSchema = z.object({
  baseCost: annualCostInputSchema,
  horizonYears: z.number().int().min(1).max(5).default(4),
  growth: growthAssumptionSchema,
  annualOverrides: z.array(z.object({ year: z.number().int().min(1).max(5), amountCents: planningMoneySchema })).default([]),
}).superRefine((value, ctx) => {
  const years = value.annualOverrides.map((override) => override.year)
  if (new Set(years).size !== years.length) ctx.addIssue({ code: 'custom', message: 'Each projection year may have at most one override.' })
  if (years.some((year) => year > value.horizonYears)) ctx.addIssue({ code: 'custom', message: 'An annual override cannot fall outside the planning horizon.' })
})

export const nonLoanFundingEntrySchema = z.object({
  id: z.string().min(1),
  category: z.enum(['pell', 'institutional_grant', 'outside_scholarship', 'other_grant', 'family_cash']),
  label: z.string().min(1),
  schedule: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('one_time'), year: z.number().int().min(1).max(5), amountCents: planningMoneySchema }),
    z.object({ kind: z.literal('recurring'), startYear: z.number().int().min(1).max(5), endYear: z.number().int().min(1).max(5).optional(), amountCents: planningMoneySchema }).refine((value) => value.endYear === undefined || value.startYear <= value.endYear, { message: 'Recurring funding end year must not precede its start year.' }),
    z.object({ kind: z.literal('custom_yearly'), amounts: z.array(z.object({ year: z.number().int().min(1).max(5), amountCents: planningMoneySchema })).min(1).superRefine((amounts, ctx) => {
      if (new Set(amounts.map((amount) => amount.year)).size !== amounts.length) ctx.addIssue({ code: 'custom', message: 'Custom funding may contain only one amount per year.' })
    }) }),
  ]),
})

export const fundingPlanInputSchema = z.object({
  costProjection: costProjectionInputSchema,
  nonLoanFunding: z.array(nonLoanFundingEntrySchema).superRefine((entries, ctx) => {
    if (new Set(entries.map((entry) => entry.id)).size !== entries.length) ctx.addIssue({ code: 'custom', message: 'Funding entry IDs must be unique.' })
  }),
}).superRefine((value, ctx) => {
  const horizon = value.costProjection.horizonYears
  for (const entry of value.nonLoanFunding) {
    const years = entry.schedule.kind === 'one_time' ? [entry.schedule.year]
      : entry.schedule.kind === 'recurring' ? [entry.schedule.startYear, entry.schedule.endYear ?? horizon]
        : entry.schedule.amounts.map((amount) => amount.year)
    if (years.some((year) => year > horizon)) ctx.addIssue({ code: 'custom', message: `Funding entry ${entry.id} falls outside the planning horizon.` })
  }
})
