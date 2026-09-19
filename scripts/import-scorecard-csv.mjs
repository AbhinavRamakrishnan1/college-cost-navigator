import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { schoolRecordSchema, scorecardSnapshotSchema } from '../src/lib/scorecard/schema.ts'

// Official institution CSV only. No API key or household inputs are used.
const input=process.argv[2]
if(!input)throw new Error('Usage: node scripts/import-scorecard-csv.mjs path/to/Most-Recent-Cohorts-Institution.csv')
const source=await readFile(input,'utf8')
function* csv(text){let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(!quoted&&(c===','||c==='\n')){row.push(cell.replace(/\r$/,''));cell='';if(c==='\n'){yield row;row=[]}}else cell+=c}if(quoted)throw new Error('Unterminated CSV quote');if(cell||row.length){row.push(cell.replace(/\r$/,''));yield row}}
const rows=csv(source),headers=rows.next().value
const required=['UNITID','INSTNM','STABBR','CONTROL','COSTT4_A','NPT4_PUB','NPT4_PRIV','MD_EARN_WNE_P10','GRAD_DEBT_MDN_SUPP']
for(const key of required)if(!headers.includes(key))throw new Error(`Missing required column ${key}`)
const nullable=value=>{if(value===undefined||['','NULL','NA','PrivacySuppressed','PS'].includes(value))return null;const number=Number(value);if(!Number.isFinite(number))throw new Error('Malformed numeric Scorecard value');return number}
const records=[]
for(const values of rows){if(values.length===1&&!values[0])continue;if(values.length!==headers.length)throw new Error('CSV column count mismatch');const row=Object.fromEntries(headers.map((key,i)=>[key,values[i]])),publicSchool=row.CONTROL==='1',suffix=publicSchool?'PUB':'PRIV';records.push(schoolRecordSchema.parse({
  unitId:Number(row.UNITID),name:row.INSTNM,state:row.STABBR,control:publicSchool?'public':row.CONTROL==='2'?'private_nonprofit':row.CONTROL==='3'?'private_for_profit':'unknown',
  costOfAttendance:nullable(row.COSTT4_A),tuitionInState:nullable(row.TUITIONFEE_IN),tuitionOutOfState:nullable(row.TUITIONFEE_OUT),averageNetPrice:nullable(row[`NPT4_${suffix}`]),
  averageNetPriceByIncome:Object.fromEntries(['0-30000','30001-48000','48001-75000','75001-110000','110001-plus'].map((key,i)=>[key,nullable(row[`NPT4${i+1}_${suffix}`])])),
  graduationRate:nullable(row.C150_4_POOLED_SUPP)??nullable(row.C150_L4_POOLED_SUPP),medianFederalDebtAtGraduation:nullable(row.GRAD_DEBT_MDN_SUPP),
  earnings:[{label:'Median earnings 10 years after entry',yearsAfterEntry:10,value:nullable(row.MD_EARN_WNE_P10)}],fieldOfStudyEarnings:[],dataYear:'June 10, 2026 most-recent release; metric-specific mixed cohorts',
}))}
records.sort((a,b)=>a.unitId-b.unitId)
if(records.length<1000||new Set(records.map(r=>r.unitId)).size!==records.length)throw new Error('National count or unique UNITID validation failed')
const metadata={source:'U.S. Department of Education College Scorecard',sourceUrl:'https://ed-public-download.scorecard.network/downloads/Most-Recent-Cohorts-Institution_06102026.zip',retrievalDate:process.env.SCORECARD_RETRIEVAL_DATE??new Date().toISOString().slice(0,10),scorecardDataYear:'June 10, 2026 most-recent institution release; metric-specific mixed cohorts',snapshotVersion:'national-2026-06-10-v1',datasetKind:'full_snapshot',recordCount:records.length,checksumSha256:createHash('sha256').update(JSON.stringify(records)).digest('hex'),importerVersion:'csv-1',schemaVersion:1,sourceCsvSha256:createHash('sha256').update(source).digest('hex')}
scorecardSnapshotSchema.parse({metadata,records})
await mkdir('public/scorecard',{recursive:true})
await writeFile('public/scorecard/national-2026-06-10-v1.json',JSON.stringify({metadata,records})+'\n')
await writeFile('src/data/scorecard/production-metadata.json',JSON.stringify(metadata,null,2)+'\n')
console.log(JSON.stringify(metadata,null,2))
