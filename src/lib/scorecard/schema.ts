import { z } from 'zod'

const nullableMoney=z.number().finite().nullable()
export const schoolRecordSchema=z.object({
  unitId:z.number().int().positive(),name:z.string().trim().min(1),state:z.string().regex(/^[A-Z]{2}$/),
  control:z.enum(['public','private_nonprofit','private_for_profit','unknown']),costOfAttendance:nullableMoney,
  tuitionInState:nullableMoney,tuitionOutOfState:nullableMoney,averageNetPrice:nullableMoney,
  averageNetPriceByIncome:z.object({'0-30000':nullableMoney,'30001-48000':nullableMoney,'48001-75000':nullableMoney,'75001-110000':nullableMoney,'110001-plus':nullableMoney}),
  graduationRate:z.number().min(0).max(1).nullable(),medianFederalDebtAtGraduation:nullableMoney,
  earnings:z.array(z.object({label:z.string().min(1),yearsAfterEntry:z.number().int().positive().nullable(),value:nullableMoney})),
  fieldOfStudyEarnings:z.array(z.object({cipCode:z.string().min(1),credentialLevel:z.string().min(1),title:z.string().min(1).nullable(),medianEarnings:z.number().finite().nullable(),yearsAfterEntry:z.number().int().positive().nullable()})),
  dataYear:z.string().min(1),
})
export const snapshotMetadataSchema=z.object({source:z.string().min(1),sourceUrl:z.string().url(),retrievalDate:z.iso.date(),scorecardDataYear:z.string().min(1),snapshotVersion:z.string().min(1),datasetKind:z.enum(['development_fixture','full_snapshot']),recordCount:z.number().int().nonnegative(),checksumSha256:z.string().regex(/^[a-f0-9]{64}$/)})
export const scorecardSnapshotSchema=z.object({metadata:snapshotMetadataSchema,records:z.array(schoolRecordSchema)}).superRefine((value,ctx)=>{if(value.metadata.recordCount!==value.records.length)ctx.addIssue({code:'custom',path:['metadata','recordCount'],message:'record count does not match records'})})
export type SchoolRecord=z.infer<typeof schoolRecordSchema>
export type ScorecardSnapshot=z.infer<typeof scorecardSnapshotSchema>
