import { z } from 'zod'
import type { NavigatorDatabase } from './database'
import { navigatorDatabase } from './database'
import { BACKUP_FORMAT,BACKUP_FORMAT_VERSION,DATABASE_VERSION,STORAGE_METADATA,householdProfileSchema,savedSchoolSchema } from './schema'
import { loanScenarioSchema,projectionAssumptionsSchema } from '../repayment/schema'

export const navigatorBackupSchema=z.object({
  format:z.literal(BACKUP_FORMAT),formatVersion:z.literal(BACKUP_FORMAT_VERSION),databaseVersion:z.literal(DATABASE_VERSION),exportedAt:z.string().datetime(),
  data:z.object({profiles:z.array(householdProfileSchema).max(1),savedSchools:z.array(savedSchoolSchema).max(10),loanScenarios:z.array(loanScenarioSchema),projectionAssumptions:z.array(projectionAssumptionsSchema)}),
}).superRefine((backup,context)=>{
  for(const [rows,key] of [[backup.data.savedSchools,'unitId'],[backup.data.loanScenarios,'id'],[backup.data.projectionAssumptions,'scenarioId']] as const){
    const identifiers=rows.map(row=>(row as unknown as Record<string,unknown>)[key])
    if(new Set(identifiers).size!==identifiers.length)context.addIssue({code:'custom',message:'Duplicate record identifiers in backup.'})
  }
  const scenarioIds=new Set(backup.data.loanScenarios.map((scenario)=>scenario.id))
  const assumptionIds=new Set(backup.data.projectionAssumptions.map((assumption)=>assumption.scenarioId))
  for(const scenarioId of scenarioIds)if(!assumptionIds.has(scenarioId))context.addIssue({code:'custom',path:['data','projectionAssumptions'],message:`Missing assumptions for scenario ${scenarioId}`})
  for(const scenarioId of assumptionIds)if(!scenarioIds.has(scenarioId))context.addIssue({code:'custom',path:['data','projectionAssumptions'],message:`Orphan assumptions for scenario ${scenarioId}`})
})

export type NavigatorBackup=z.infer<typeof navigatorBackupSchema>
export type LocalDataSummary={profiles:number;savedSchools:number;loanScenarios:number;projectionAssumptions:number;total:number}
// Only the shipped v4 backup format is supported; no earlier backup format was released.
export const parseNavigatorBackup=(value:unknown):NavigatorBackup=>navigatorBackupSchema.parse(value)

export class BackupService{
  private readonly database:NavigatorDatabase
  constructor(database:NavigatorDatabase=navigatorDatabase){this.database=database}
  async summarize():Promise<LocalDataSummary>{const [profiles,savedSchools,loanScenarios,projectionAssumptions]=await Promise.all([this.database.profiles.count(),this.database.savedSchools.count(),this.database.loanScenarios.count(),this.database.projectionAssumptions.count()]);return {profiles,savedSchools,loanScenarios,projectionAssumptions,total:profiles+savedSchools+loanScenarios+projectionAssumptions}}
  async create():Promise<NavigatorBackup>{const [profiles,savedSchools,loanScenarios,projectionAssumptions]=await this.database.transaction('r',this.database.profiles,this.database.savedSchools,this.database.loanScenarios,this.database.projectionAssumptions,()=>Promise.all([this.database.profiles.toArray(),this.database.savedSchools.toArray(),this.database.loanScenarios.toArray(),this.database.projectionAssumptions.toArray()]));return navigatorBackupSchema.parse({format:BACKUP_FORMAT,formatVersion:BACKUP_FORMAT_VERSION,databaseVersion:DATABASE_VERSION,exportedAt:new Date().toISOString(),data:{profiles,savedSchools,loanScenarios,projectionAssumptions}})}
  async restore(value:unknown):Promise<LocalDataSummary>{const backup=parseNavigatorBackup(value),{profiles,savedSchools,loanScenarios,projectionAssumptions}=backup.data;await this.database.transaction('rw',this.database.profiles,this.database.metadata,this.database.savedSchools,this.database.loanScenarios,this.database.projectionAssumptions,async()=>{await Promise.all([this.database.profiles.clear(),this.database.savedSchools.clear(),this.database.loanScenarios.clear(),this.database.projectionAssumptions.clear()]);await this.database.profiles.bulkPut(profiles);await this.database.savedSchools.bulkPut(savedSchools);await this.database.loanScenarios.bulkPut(loanScenarios);await this.database.projectionAssumptions.bulkPut(projectionAssumptions);await this.database.metadata.put(STORAGE_METADATA)});return this.summarize()}
}

export const backupService=new BackupService()
