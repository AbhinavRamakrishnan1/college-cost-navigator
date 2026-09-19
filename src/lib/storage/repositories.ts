import type { ZodType } from 'zod'
import type { NavigatorDatabase } from './database'
import { navigatorDatabase } from './database'
import { CURRENT_PROFILE_ID, STORAGE_METADATA, householdProfileSchema, savedSchoolSchema, storageMetadataSchema, type HouseholdProfile, type HouseholdProfileInput, type SavedSchool, type StorageMetadata } from './schema'
import { loanScenarioSchema,projectionAssumptionsSchema,type LoanScenario,type LoanScenarioInput,type ProjectionAssumptions } from '../repayment/schema'

function parseLocal<T>(schema:ZodType<T>,value:unknown):T{
  const result=schema.safeParse(value)
  if(!result.success)throw new Error('Local data is invalid or unsupported. No estimate was calculated.')
  return result.data
}

export class HouseholdRepository {
  private readonly database: NavigatorDatabase

  constructor(database: NavigatorDatabase = navigatorDatabase) {
    this.database = database
  }

  async save(input: HouseholdProfileInput): Promise<HouseholdProfile> {
    const profile = parseLocal(householdProfileSchema,{ ...input, id: CURRENT_PROFILE_ID, schemaVersion: 3, updatedAt: new Date().toISOString() })
    await this.database.transaction('rw', this.database.profiles, this.database.metadata, async () => {
      await this.database.profiles.put(profile)
      await this.database.metadata.put(STORAGE_METADATA)
    })
    return profile
  }

  async load(): Promise<HouseholdProfile | undefined> {
    const stored = await this.database.profiles.get(CURRENT_PROFILE_ID)
    return stored ? parseLocal(householdProfileSchema,stored) : undefined
  }

  async getMetadata(): Promise<StorageMetadata> {
    const stored = await this.database.metadata.get(STORAGE_METADATA.id)
    return parseLocal(storageMetadataSchema,stored ?? STORAGE_METADATA)
  }

  async deleteAll(): Promise<void> {
    await this.database.transaction('rw', this.database.profiles, this.database.metadata, this.database.savedSchools,this.database.loanScenarios,this.database.projectionAssumptions, async () => {
      await this.database.profiles.clear()
      await this.database.metadata.clear()
      await this.database.savedSchools.clear()
      await this.database.loanScenarios.clear()
      await this.database.projectionAssumptions.clear()
    })
  }
}

export const householdRepository = new HouseholdRepository()

export const SAVED_SCHOOL_LIMIT=10
export class SavedSchoolLimitError extends Error { constructor(){super(`You can save up to ${SAVED_SCHOOL_LIMIT} schools.`);this.name='SavedSchoolLimitError'} }
export class SavedSchoolRepository {
  private readonly database:NavigatorDatabase
  constructor(database:NavigatorDatabase=navigatorDatabase){this.database=database}
  async list():Promise<SavedSchool[]>{const rows=await this.database.savedSchools.toArray();return rows.map((row)=>parseLocal(savedSchoolSchema,row)).sort((a,b)=>a.addedAt.localeCompare(b.addedAt))}
  async save(unitId:number,snapshotVersion:string):Promise<SavedSchool>{
    return this.database.transaction('rw',this.database.savedSchools,async()=>{
    const existing=await this.database.savedSchools.get(unitId);if(existing)return parseLocal(savedSchoolSchema,existing)
    if(await this.database.savedSchools.count()>=SAVED_SCHOOL_LIMIT)throw new SavedSchoolLimitError()
    const saved=parseLocal(savedSchoolSchema,{unitId,snapshotVersion,addedAt:new Date().toISOString()});await this.database.savedSchools.put(saved);return saved
    })
  }
  async remove(unitId:number):Promise<void>{await this.database.savedSchools.delete(unitId)}
}
export const savedSchoolRepository=new SavedSchoolRepository()

export class LoanScenarioRepository{
  private readonly database:NavigatorDatabase
  constructor(database:NavigatorDatabase=navigatorDatabase){this.database=database}
  async list():Promise<LoanScenario[]>{return (await this.database.loanScenarios.toArray()).map((row)=>parseLocal(loanScenarioSchema,row)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))}
  async load(id:string):Promise<{scenario:LoanScenario;assumptions:ProjectionAssumptions}|undefined>{const [scenario,assumptions]=await Promise.all([this.database.loanScenarios.get(id),this.database.projectionAssumptions.get(id)]);return scenario&&assumptions?{scenario:parseLocal(loanScenarioSchema,scenario),assumptions:parseLocal(projectionAssumptionsSchema,assumptions)}:undefined}
  async save(input:LoanScenarioInput,assumptions:Omit<ProjectionAssumptions,'scenarioId'>):Promise<LoanScenario>{const existing=await this.database.loanScenarios.get(input.id),now=new Date().toISOString(),scenario=parseLocal(loanScenarioSchema,{...input,createdAt:existing?.createdAt??now,updatedAt:now}),projection=parseLocal(projectionAssumptionsSchema,{...assumptions,scenarioId:scenario.id});await this.database.transaction('rw',this.database.loanScenarios,this.database.projectionAssumptions,this.database.metadata,async()=>{await Promise.all([this.database.loanScenarios.put(scenario),this.database.projectionAssumptions.put(projection),this.database.metadata.put(STORAGE_METADATA)])});return scenario}
  async remove(id:string){await this.database.transaction('rw',this.database.loanScenarios,this.database.projectionAssumptions,async()=>{await Promise.all([this.database.loanScenarios.delete(id),this.database.projectionAssumptions.delete(id)])})}
}
export const loanScenarioRepository=new LoanScenarioRepository()
