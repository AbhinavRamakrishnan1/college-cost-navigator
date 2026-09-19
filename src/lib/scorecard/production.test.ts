/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe,expect,it } from 'vitest'
import metadata from '../../data/scorecard/production-metadata.json'
import { scorecardSnapshotSchema } from './schema'
describe('national production data integrity',()=>{
  it('validates every record, version, unique identifier and checksum',()=>{
    const raw=JSON.parse(readFileSync(`public/scorecard/${metadata.snapshotVersion}.json`,'utf8'))
    const data=scorecardSnapshotSchema.parse(raw)
    expect(data.records).toHaveLength(6273)
    expect(new Set(data.records.map(record=>record.unitId)).size).toBe(6273)
    expect(raw.metadata).toEqual(metadata)
    expect(createHash('sha256').update(JSON.stringify(raw.records)).digest('hex')).toBe(metadata.checksumSha256)
    expect(data.records.find(record=>record.name==='Stanford University')).toBeDefined()
    expect(data.records.some(record=>record.averageNetPrice===null)).toBe(true)
    expect(data.records.every(record=>record.fieldOfStudyEarnings.length===0)).toBe(true)
  })
})
