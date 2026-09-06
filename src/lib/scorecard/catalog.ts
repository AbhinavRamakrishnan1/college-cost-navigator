import rawSnapshot from '../../data/scorecard/development-snapshot-v1.0.0.json'
import { scorecardSnapshotSchema, type SchoolRecord, type ScorecardSnapshot } from './schema'

export const SCORECARD_SNAPSHOT_VERSION='development-1.0.0'
export function validateSnapshot(value:unknown):ScorecardSnapshot { return scorecardSnapshotSchema.parse(value) }
export function selectScorecardSnapshot(version:string):ScorecardSnapshot|null { return version===SCORECARD_SNAPSHOT_VERSION?validateSnapshot(rawSnapshot):null }
export const scorecardSnapshot=selectScorecardSnapshot(SCORECARD_SNAPSHOT_VERSION)!
export function searchSchools(records:SchoolRecord[],query:string,state=''):SchoolRecord[] {
  const needle=query.trim().toLocaleLowerCase(),normalizedState=state.trim().toLocaleUpperCase()
  return records.filter((school)=>(!needle||school.name.toLocaleLowerCase().includes(needle))&&(!normalizedState||school.state===normalizedState)).sort((a,b)=>a.name.localeCompare(b.name))
}
