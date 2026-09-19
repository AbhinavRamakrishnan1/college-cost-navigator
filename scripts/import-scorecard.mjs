import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { schoolRecordSchema } from '../src/lib/scorecard/schema.ts'

if(process.argv[2]==='--csv'){
  process.argv.splice(2,1)
  await import('./import-scorecard-csv.mjs')
}else{
const apiKey=process.env.COLLEGE_SCORECARD_API_KEY
const output=resolve(process.argv[2]??'src/data/scorecard/generated-snapshot.json')
if(!apiKey) throw new Error('COLLEGE_SCORECARD_API_KEY is required for development-time ingestion')
const incomeKeys=['0-30000','30001-48000','48001-75000','75001-110000','110001-plus']
const incomeFields=incomeKeys.flatMap((key)=>[`latest.cost.net_price.public.by_income_level.${key}`,`latest.cost.net_price.private.by_income_level.${key}`])
const fields=['id','school.name','school.state','school.ownership','latest.cost.attendance.academic_year','latest.cost.tuition.in_state','latest.cost.tuition.out_of_state','latest.cost.avg_net_price.overall','latest.completion.rate_suppressed.overall','latest.aid.median_debt.completers.overall','latest.earnings.10_yrs_after_entry.median',...incomeFields]
const results=[];let page=0,total=Number.POSITIVE_INFINITY
while(results.length<total){
  const url=new URL('https://api.data.gov/ed/collegescorecard/v1/schools.json');url.searchParams.set('api_key',apiKey);url.searchParams.set('per_page','100');url.searchParams.set('page',String(page));url.searchParams.set('fields',fields.join(','))
  const response=await fetch(url);if(!response.ok)throw new Error(`Scorecard request failed on page ${page}: ${response.status}`)
  const body=await response.json();if(!Array.isArray(body.results)||!Number.isInteger(body.metadata?.total))throw new Error(`Malformed Scorecard response on page ${page}`)
  total=body.metadata.total;results.push(...body.results);page+=1;if(body.results.length===0&&results.length<total)throw new Error('Scorecard pagination ended before declared total')
}
const control=(value)=>value===1?'public':value===2?'private_nonprofit':value===3?'private_for_profit':'unknown'
const nullable=(value)=>typeof value==='number'&&Number.isFinite(value)?value:null
const records=results.map((row)=>{const prefix=row['school.ownership']===1?'latest.cost.net_price.public.by_income_level.':'latest.cost.net_price.private.by_income_level.';return {unitId:row.id,name:row['school.name'],state:row['school.state'],control:control(row['school.ownership']),costOfAttendance:nullable(row['latest.cost.attendance.academic_year']),tuitionInState:nullable(row['latest.cost.tuition.in_state']),tuitionOutOfState:nullable(row['latest.cost.tuition.out_of_state']),averageNetPrice:nullable(row['latest.cost.avg_net_price.overall']),averageNetPriceByIncome:Object.fromEntries(incomeKeys.map((key)=>[key,nullable(row[`${prefix}${key}`])])),graduationRate:nullable(row['latest.completion.rate_suppressed.overall']),medianFederalDebtAtGraduation:nullable(row['latest.aid.median_debt.completers.overall']),earnings:row['latest.earnings.10_yrs_after_entry.median']==null?[]:[{label:'Median earnings 10 years after entry',yearsAfterEntry:10,value:row['latest.earnings.10_yrs_after_entry.median']}],fieldOfStudyEarnings:[],dataYear:'latest cohorts in selected Scorecard release'}})
for(const record of records)schoolRecordSchema.parse(record)
const checksumSha256=createHash('sha256').update(JSON.stringify(records)).digest('hex')
const snapshot={metadata:{source:'U.S. Department of Education College Scorecard API',sourceUrl:'https://api.data.gov/ed/collegescorecard/v1/schools.json',retrievalDate:new Date().toISOString().slice(0,10),scorecardDataYear:process.env.COLLEGE_SCORECARD_DATA_YEAR??'latest mixed cohorts',snapshotVersion:process.env.COLLEGE_SCORECARD_SNAPSHOT_VERSION??'generated-full',datasetKind:'full_snapshot',recordCount:records.length,checksumSha256},records}
await mkdir(dirname(output),{recursive:true});await writeFile(output,`${JSON.stringify(snapshot,null,2)}\n`,'utf8');console.log(`Wrote ${records.length} validated Scorecard records to ${output}`)
}
