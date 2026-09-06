import { describe,expect,it } from 'vitest'
import rawSnapshot from '../../data/scorecard/development-snapshot-v1.0.0.json'
import { SCORECARD_SNAPSHOT_VERSION,scorecardSnapshot,searchSchools,selectScorecardSnapshot,validateSnapshot } from './catalog'

describe('Scorecard static snapshot',()=>{
  it('validates metadata, records, and record count',()=>expect(validateSnapshot(rawSnapshot).metadata).toMatchObject({datasetKind:'development_fixture',recordCount:3,snapshotVersion:SCORECARD_SNAPSHOT_VERSION}))
  it('rejects malformed and mismatched records',()=>{expect(()=>validateSnapshot({...rawSnapshot,metadata:{...rawSnapshot.metadata,recordCount:4}})).toThrow();expect(()=>validateSnapshot({...rawSnapshot,records:[{...rawSnapshot.records[0],graduationRate:2}]})).toThrow()})
  it('fails closed for an unavailable snapshot version',()=>expect(selectScorecardSnapshot('latest')).toBeNull())
  it('searches names case-insensitively',()=>expect(searchSchools(scorecardSnapshot.records,'technology').map((x)=>x.unitId)).toEqual([166683]))
  it('filters by state and combines filters',()=>expect(searchSchools(scorecardSnapshot.records,'university','OH').map((x)=>x.unitId)).toEqual([204796]))
  it('preserves missing data as null or empty',()=>{const school={...scorecardSnapshot.records[0],averageNetPrice:null,earnings:[]};expect(school.averageNetPrice).toBeNull();expect(school.earnings).toEqual([])})
})
