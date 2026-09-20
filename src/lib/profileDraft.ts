import { calculateProfileAid } from './calculations'
import { CURRENT_PROFILE_ID,householdProfileSchema,type HouseholdProfileInput } from './storage/schema'

export function evaluateProfileDraft(input:HouseholdProfileInput){
  const parsed=householdProfileSchema.safeParse({...input,id:CURRENT_PROFILE_ID,schemaVersion:3,updatedAt:'2026-09-19T00:00:00.000Z'})
  if(!parsed.success)return {status:'incomplete' as const,missing:parsed.error.issues.map(issue=>issue.path.join('.'))}
  return calculateProfileAid(parsed.data)
}
