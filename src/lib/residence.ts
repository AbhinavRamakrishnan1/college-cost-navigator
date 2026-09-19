import { z } from 'zod'

// Explicit non-state FAFSA locations use the contract's Other poverty table.
export const residences: Record<string,string> = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',AS:'American Samoa',GU:'Guam',MP:'Northern Mariana Islands',PR:'Puerto Rico',VI:'U.S. Virgin Islands',FM:'Federated States of Micronesia',MH:'Marshall Islands',PW:'Palau',FOREIGN:'Foreign address',UNKNOWN:'Unknown location',
}
export function normalizeResidence(value:string):string|null {
  const trimmed=value.trim(),code=trimmed.toUpperCase()
  if(Object.hasOwn(residences,code))return code
  return Object.entries(residences).find(([,name])=>name.toLowerCase()===trimmed.toLowerCase())?.[0]??null
}
export const residenceSchema=z.string().transform((value,context)=>{
  const code=normalizeResidence(value)
  if(code===null){context.addIssue({code:'custom',message:'Choose a valid state, territory, foreign address, or explicit unknown location.'});return z.NEVER}
  return code
})
