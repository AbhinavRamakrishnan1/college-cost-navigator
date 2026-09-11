import type { NavigatorDatabase } from './database'
import { navigatorDatabase } from './database'
import { CURRENT_PROFILE_ID, STORAGE_METADATA, householdProfileSchema, savedSchoolSchema, storageMetadataSchema, type HouseholdProfile, type HouseholdProfileInput, type SavedSchool, type StorageMetadata } from './schema'
import { loanScenarioSchema,projectionAssumptionsSchema,type LoanScenario,type LoanScenarioInput,type ProjectionAssumptions } from '../repayment/schema'

export class HouseholdRepository {
  private readonly database: NavigatorDatabase

  constructor(database: NavigatorDatabase = navigatorDatabase) {
    this.database = database
  }

  async save(input: HouseholdProfileInput): Promise<HouseholdProfile> {
    const profile = householdProfileSchema.parse({ ...input, id: CURRENT_PROFILE_ID, schemaVersion: 2, updatedAt: new Date().toISOString() })
    await this.database.transaction('rw', this.database.profiles, this.database.metadata, async () => {
      await this.database.profiles.put(profile)
      await this.database.metadata.put(STORAGE_METADATA)
    })
    return profile
  }

  async load(): Promise<HouseholdProfile | undefined> {
    const stored = await this.database.profiles.get(CURRENT_PROFILE_ID)
    return stored ? householdProfileSchema.parse(stored) : undefined
  }

  async getMetadata(): Promise<StorageMetadata> {
    const stored = await this.database.metadata.get(STORAGE_METADATA.id)
    return storageMetadataSchema.parse(stored ?? STORAGE_METADATA)
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
  async list():Promise<SavedSchool[]>{const rows=await this.database.savedSchools.orderBy('addedAt').toArray();return rows.map((row)=>savedSchoolSchema.parse(row))}
  async save(unitId:number,snapshotVersion:string):Promise<SavedSchool>{
    const existing=await this.database.savedSchools.get(unitId);if(existing)return savedSchoolSchema.parse(existing)
    if(await this.database.savedSchools.count()>=SAVED_SCHOOL_LIMIT)throw new SavedSchoolLimitError()
    const saved=savedSchoolSchema.parse({unitId,snapshotVersion,addedAt:new Date().toISOString()});await this.database.savedSchools.put(saved);return saved
  }
  async remove(unitId:number):Promise<void>{await this.database.savedSchools.delete(unitId)}
}
export const savedSchoolRepository=new SavedSchoolRepository()

export class LoanScenarioRepository{
  private readonly database:NavigatorDatabase
  constructor(database:NavigatorDatabase=navigatorDatabase){this.database=database}
  async list():Promise<LoanScenario[]>{return (await this.database.loanScenarios.orderBy('updatedAt').reverse().toArray()).map((row)=>loanScenarioSchema.parse(row))}
  async load(id:string):Promise<{scenario:LoanScenario;assumptions:ProjectionAssumptions}|undefined>{const [scenario,assumptions]=await Promise.all([this.database.loanScenarios.get(id),this.database.projectionAssumptions.get(id)]);return scenario&&assumptions?{scenario:loanScenarioSchema.parse(scenario),assumptions:projectionAssumptionsSchema.parse(assumptions)}:undefined}
  async save(input:LoanScenarioInput,assumptions:Omit<ProjectionAssumptions,'scenarioId'>):Promise<LoanScenario>{const existing=await this.database.loanScenarios.get(input.id),now=new Date().toISOString(),scenario=loanScenarioSchema.parse({...input,createdAt:existing?.createdAt??now,updatedAt:now}),projection=projectionAssumptionsSchema.parse({...assumptions,scenarioId:scenario.id});await this.database.transaction('rw',this.database.loanScenarios,this.database.projectionAssumptions,this.database.metadata,async()=>{await Promise.all([this.database.loanScenarios.put(scenario),this.database.projectionAssumptions.put(projection),this.database.metadata.put(STORAGE_METADATA)])});return scenario}
  async remove(id:string){await this.database.transaction('rw',this.database.loanScenarios,this.database.projectionAssumptions,async()=>{await Promise.all([this.database.loanScenarios.delete(id),this.database.projectionAssumptions.delete(id)])})}
}
export const loanScenarioRepository=new LoanScenarioRepository()
