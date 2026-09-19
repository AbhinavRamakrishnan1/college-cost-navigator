# College Cost & Aid Navigator — Calculation Contract v1.0.0

**Status:** frozen for implementation within the declared v1 scope
**Verified:** August 7, 2026
**Policy scope:** 2026–27 dependent-student SAI/Pell; 2026 federal repayment rules; 2026–27
Direct Loan rates
**Rule:** If code disagrees with this file, code is wrong. If this file disagrees with a cited primary
source, this file is wrong and must be version-bumped after correction.

## 0. V1 scope guardrails

### Supported
- SAI: **Formula A — dependent students only**
- Pell: dependent-student Max Pell, Min Pell, and Calculated Pell scheduled-award estimate
- Repayment: **Direct Loans only**, with Tiered Standard, IBR (where legally eligible), and RAP
- Rates: Direct Loans first disbursed July 1, 2026–June 30, 2027

### Explicitly unsupported in v1
- Formula B/C SAI for independent students. Return `unsupported_dependency_status`; never
run Formula A.


- FFEL repayment calculations.
- PAYE/ICR monthly simulation. Legacy transition eligibility may be surfaced as an informational
note.
- Institutional aid guarantees.
- Exact servicer-cent payoff quotes. Long-horizon repayment is an estimate because income,
dependents, poverty guidelines, timing, daily interest, recertification, deferment/forbearance,
and borrower behavior can change.

---

# 1. Global SAI arithmetic

Primary source: U.S. Department of Education, Federal Student Aid, *2026–27 Student Aid
Index (SAI) and Pell Grant Eligibility Guide*, Version 1.1, August 2025.
https://fsapartners.ed.gov/sites/default/files/2025-06/202627StudentAidIndexSAIandPellGrantEligibilityGuide.pdf

Unless a worksheet states otherwise:

1. Round each calculation result to **three decimal places**.
2. Then round it to the nearest whole number.
3. `.500` through `.999` round **away from zero**.
4. `.001` through `.499` round **toward zero**.
5. Each intermediate worksheet step therefore ends as a whole-dollar value.

Do **not** implement this with JavaScript `Math.round()` alone; negative half-ties are
asymmetric. Use decimal-safe arithmetic (recommended: `decimal.js`) and
`ROUND_HALF_UP`/half-away-from-zero semantics.


```ts
function saiWhole(value: Decimal): number {
const three = value.toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
return three.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}
Special Table A1 rounding is in §1.3.
Final SAI bounds:
SAI floor = -1,500
SAI ceiling = 999,999

2. 2026–27 Formula A — dependent
student SAI
SAI =
Parents' Contribution
+ Student Contribution from Income
+ Student Contribution from Assets
Then apply Max-Pell override logic (§3) and final bounds.

2.1 Parent income
Parent Income Additions =
Parent AGI
+ deductible IRA/KEOGH/other qualified-plan payments
+ tax-exempt interest


+ max(0, untaxed IRA distributions - IRA rollover)
+ max(0, untaxed pensions - pension rollover)
+ abs(foreign income exclusion)

Parent Income Offsets =
taxable college grant/scholarship aid reported as income
+ education credits
+ Federal Work-Study

Total Parent Income =
Parent Income Additions - Parent Income Offsets
Total Parent Income may be negative.

2.2 Parent allowances
Parent Allowances =
U.S. income tax paid (or foreign equivalent)
+ Medicare HI allowance
+ OASDI allowance
+ Income Protection Allowance
+ Employment Expense Allowance

Parent Available Income (PAI) =
Total Parent Income - Parent Allowances
PAI may be negative.
Employment Expense Allowance:


EEA = max(0, min(35% × combined parent income earned from work, $5,000))
The 2026–27 FSA Handbook states the employment expense allowance is never below zero.

2.3 Table A1 — payroll tax allowance
Medicare HI
HI =
1.45% × min(work income, threshold)
+ 2.35% × max(work income - threshold, 0)

Filing status

Threshold

Single

$200,000

Head of household

$200,000

Qualifying surviving spouse

$200,000

Married filing jointly

$250,000

Married filing separately

$125,000

Dependent student

$200,000

OASDI
OASDI = 6.2% × min(work income, contribution base)
2024 contribution bases:


Filing status

Base

Single / MFS / HoH / qualifying surviving spouse

$168,600

MFJ

$337,200

Dependent student

$168,600

Special multiple-return rule — implementation-critical
If spouses filed different tax returns and more than one work-income value exists:
1.​ Calculate each filer's HI separately.
2.​ Round each individual HI to 3 decimals only.
3.​ Add individual HI amounts; round Total Parent HI to whole dollars.
4.​ Calculate each filer's OASDI separately.
5.​ Round each individual OASDI to 3 decimals only.
6.​ Add individual OASDI amounts; round Total Parent OASDI to whole dollars.
7.​ Add the whole-dollar Total HI and Total OASDI in the worksheet allowance step.
If two different returns both have filing status MFJ, combine income earned from work first, then
calculate.
Official regression examples:
●​ HI example -> $7,367
●​ OASDI example -> $24,837

2.4 Table A2 — parent Income Protection Allowance
Family size (including
student)

IPA


2

$29,190

3

$36,330

4

$44,880

5

$52,950

6

$61,930

each additional member

+$6,990

For Formula A, reject an impossible family size below 2 rather than silently coercing it.

2.5 Asset-reporting gate — dependent student
Source: 2026–27 FSA Handbook, Application and Verification Guide, Chapter 3.​
https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/application-and-verification-guide/ch3-student-aid-index-sai-and-pell-grant-eligibility
A dependent applicant is exempt from asset reporting if any of these is true:
1.​ Applicant qualifies for Maximum Pell; OR
2.​ Parents' combined 2024 AGI < $60,000, parents did not file Schedule A, B, D, E, F, or
H, AND either:
○​ did not file Schedule C, OR
○​ filed Schedule C with net business income of not more than a $10,000 loss or
gain; OR
3.​ Applicant or applicant's parent received a qualifying means-tested federal benefit during
2024 or 2025.
Exception: a dependent student is not asset-exempt if parents live outside the U.S. or do not file
taxes in the U.S./territory, unless nonfiling is because income is below the filing threshold.
Means-tested benefits listed by FSA:


●​
●​
●​
●​
●​
●​
●​
●​
●​

EIC/EITC
federal housing assistance
income-eligible free/reduced-price school lunch
Medicaid
refundable QHP coverage credit
SNAP
SSI
TANF
WIC

If asset-exempt, parent and student asset contributions are $0 and the UI should not require
asset entry.

2.6 Reportable assets and 2026–27 business/farm
exclusions
Before Table A3, exclude from reportable business/farm net worth:
●​ family-owned business with 100 or fewer FTE employees
●​ farm on which the family resides
●​ family-owned/controlled commercial fishing business and related expenses
Source: FSA APP-25-23, Aug. 15, 2025.​
https://fsapartners.ed.gov/knowledge-center/library/electronic-announcements/2025-08-15/2026-27-fafsa-form-and-pell-grant-eligibility-updates
Do not use one generic assetExclusionsApply flag. Model reportable asset categories
explicitly.
Parent net worth:
Parent Net Worth =
annual child support received for last complete calendar year
+ cash/savings/checking
+ max(0, current investment net worth)
+ adjusted reportable business/farm net worth
Primary residence is not a reportable investment.

2.7 Table A3 — business/farm net-worth adjustment


Reportable net worth

Adjusted net worth

< $1

$0

$1–$175,000

40% × net worth

$175,001–$520,000

$70,000 + 50% × amount over $175,000

$520,001–$870,000

$242,500 + 60% × amount over $520,000

$870,001+

$452,500 + 100% × amount over
$870,000

Apply SAI intermediate-step rounding.

2.8 Table A4 and parent contribution from assets
For every parent age in 2026–27:
Parent Asset Protection Allowance = $0
If no DOB is available, the guide says use age 45; the result remains $0.
Parent Contribution from Assets =
max(0, (Parent Net Worth - $0) × 12%)

2.9 Parent Adjusted Available Income and Table A5
PAAI = Parent Available Income + Parent Contribution from Assets
PAAI may be negative.


PAAI

Parent contribution

< -$8,500

-$1,870

-$8,500–$21,800

22% × PAAI

$21,801–$27,300

$4,796 + 25% × amount over $21,800

$27,301–$32,800

$6,171 + 29% × amount over $27,300

$32,801–$38,400

$7,766 + 34% × amount over $32,800

$38,401–$43,900

$9,670 + 40% × amount over $38,400

$43,901+

$11,870 + 47% × amount over
$43,900

Do not clamp Parent Contribution to zero.

2.10 Student contribution from income
Student Income Additions =
student AGI
+ deductible IRA/KEOGH/other qualified-plan payments
+ tax-exempt interest


+ max(0, untaxed IRA distributions - rollover)
+ max(0, untaxed pensions - rollover)
+ abs(foreign income exclusion)

Student Income Offsets =
taxable college grant/scholarship aid reported as income
+ education credits
+ Federal Work-Study

Total Student Income =
additions - offsets

Student Allowances =
U.S. income tax paid
+ student Medicare HI
+ student OASDI
+ $11,770
+ (abs(PAAI) if PAAI < 0 else 0)

Student Available Income =
Total Student Income - Student Allowances

Student Contribution from Income =
max(0, 50% × Student Available Income)


2.11 Student assets
Student Net Worth =
cash/savings/checking
+ max(0, current investment net worth)
+ adjusted reportable business/farm net worth

Student Contribution from Assets =
max(0, 20% × Student Net Worth)
If asset-reporting gate says exempt, this contribution is $0.

2.12 Number in college
Not used in SAI. Do not divide Parent Contribution by number in college.
FSA still asks the question and schools may use it for professional judgment.​
https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/application-and-verification-guide/ch2-filling-out-fafsa-form

3. Maximum Pell SAI overrides
From the SAI Guide:
●​ Max Pell Indicator 1 (qualifying nonfilers): SAI = -1,500; do not run the ordinary formula.
●​ Max Pell Indicator 2 or 3: run the full SAI formula; final SAI is min(calculatedSai,
0).
Then enforce the global SAI floor/ceiling where applicable.

4. 2026–27 Pell Grant estimate —
dependent students


Primary amount source: FSA GEN-26-01, updated Feb. 18, 2026.​
https://fsapartners.ed.gov/knowledge-center/library/dear-colleague-letters/2026-01-30/2026-27-federal-pell-grant-maximum-and-minimum-award-amounts
Maximum Pell = $7,395
Minimum Pell = $740
Pell ineligible if SAI >= $14,790
The $14,790 rule has a statutory Special Rule exception for qualifying dependents of certain
deceased servicemembers/public-safety officers. If v1 does not collect enough information to
evaluate that rule, return an explicit specialRuleNotModeled flag rather than asserting
ineligibility for such a user.

4.1 Poverty guideline vintage
For 2026–27 Pell Max/Min tests, use 2024 HHS poverty guidelines, not 2026 guidelines. See
hhs-poverty-guidelines-2024-pell.json.
The SAI Guide directs FAFSA to use:
●​ Alaska table for Alaska
●​ Hawaii table for Hawaii
●​ “Other” for the 48 contiguous states, U.S. territories, foreign addresses, unknown/blank
The applicable poverty multiple result is first rounded to a whole dollar using the SAI rounding
rule before the comparison.

4.2 Max Pell — dependent student
Use:
pellAgi = Parent AGI + Parent Foreign Income Exclusion
Qualifies for Max Pell if:
●​ qualifying parent nonfiler; OR
●​ single parent and pellAgi > 0 and pellAgi <= 225% × poverty; OR
●​ not single parent and pellAgi > 0 and pellAgi <= 175% × poverty.

4.3 Min Pell — dependent student
If not already Max/Calculated Pell eligible, Min Pell AGI route:


●​ single parent: pellAgi <= 325% × poverty
●​ not single parent: pellAgi <= 275% × poverty
A Minimum Pell recipient retains the calculated SAI.

4.4 Calculated Pell order of operations
Source: 2026–27 FSA Handbook, Volume 7, Chapter 2.​
https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/vol7/ch2-calculating-pell-grants
rawCalculatedPell = 7395 - SAI

if rawCalculatedPell < 740:
no Calculated Pell
evaluate Min Pell route
else:
roundedCalculatedPell = round to nearest $5
scheduledAward = min(roundedCalculatedPell, Pell COA)
If Pell COA is the smaller amount, use that COA without rounding it to $5.
The app should label this a Scheduled Award estimate. Actual annual/disbursed Pell can
depend on enrollment intensity, eligibility-used (LEU), program eligibility, COA, and other
statutory restrictions.

5. Repayment Assistance Plan (RAP)
Primary source: Department of Education RISE Final Rule, 91 FR 23768, published May 1,
2026; effective July 1, 2026; 34 CFR §685.209.​
https://www.federalregister.gov/documents/2026/05/01/2026-08556/reimagining-and-improving-student-education-federal-student-loan-program-final-regulations​
Official GPO PDF: https://www.govinfo.gov/content/pkg/FR-2026-05-01/pdf/2026-08556.pdf

5.1 Annual base payment — whole-AGI tier lookup


These are not marginal tax brackets.

AGI

Annual base
payment

<= $10,000

$120

>$10k–$20k

1% × AGI

>$20k–$30k

2% × AGI

>$30k–$40k

3% × AGI

>$40k–$50k

4% × AGI

>$50k–$60k

5% × AGI

>$60k–$70k

6% × AGI

>$70k–$80k

7% × AGI

>$80k–$90k

8% × AGI

>$90k–$100k

9% × AGI

>$100k

10% × AGI


5.2 Monthly payment
preProration =
annualBasePayment / 12
- $50 × numberOfRapDependents
RAP dependent = IRC §152 dependent claimed on the borrower's federal tax return. For
MFS, only dependents on that borrower's own return count.
If spouse income/debt is included:
share =
borrower eligible outstanding principal + interest
--------------------------------------------------couple combined eligible outstanding principal + interest

adjustedPayment = preProration × share
Then:
if adjustedPayment < $10:
monthlyPayment = $10
else:
monthlyPayment = adjustedPayment
The final payoff payment may be below $10.

5.3 Married-income rule
●​ unmarried / MFS / qualifying separated or inaccessible-spouse-income case -> borrower
income
●​ MFJ -> combined borrower + spouse income
●​ when spouse income is included, eligible spouse debt is included for proration

5.4 RAP loan eligibility


RAP-eligible Direct Loan types include, including defaulted qualifying loans:
●​
●​
●​
●​

Direct Subsidized
Direct Unsubsidized
Direct PLUS to graduate/professional borrower
Direct Consolidation that is not an excepted consolidation loan

Direct Parent PLUS itself is not RAP-eligible.

Parent-PLUS-derived consolidation nuance
Do not infer “Parent PLUS origin = permanently RAP-ineligible.”
The regulation defines a Parent-PLUS-derived consolidation as excepted unless the loan was
being repaid under ICR, PAYE, or IBR on any date on/after July 4, 2025 through June 30,
2028, where “being repaid” means at least one payment was made under one of those plans.
Therefore store explicit consolidation history:
type ParentPlusConsolidationHistory = {
repaidParentPlus: boolean;
hadQualifyingIdrPaymentBetween2025_07_04And2028_06_30: boolean;
};

5.5 Disbursement-date plan rule
●​ RAP is not limited to post-7/1/2026 loans.
●​ Only Direct Loans made before July 1, 2026 may be repaid under PAYE/IBR/ICR.
●​ A borrower with Direct Loans made on/after July 1, 2026 generally chooses between
Tiered Standard and RAP, subject to loan-type eligibility.

5.6 RAP interest protection — required for projection
engine
For an on-time required RAP payment, any accrued interest not covered by that payment is not
charged to the borrower's account.
If an excess payment advances the due date, the final rule contains special rules that can
eliminate this benefit for future-payment periods. V1 should assume ordinary on-time monthly
payments and display that assumption.


5.7 RAP principal match — required for projection engine
When not in deferment/forbearance, and the borrower makes an on-time RAP payment, and
that payment reduces outstanding principal by less than $50:
principalMatch =
min($50, monthlyPaymentMade)
- amountOfMonthlyPaymentAppliedToPrincipal
No match if the payment is credited to a future monthly payment as specified in the rule.

5.8 RAP forgiveness
360 qualifying monthly payments
over at least 30 years
Additionally:
●​ borrower must have participated in RAP; and
●​ the final payment before cancellation must be under RAP.
Qualifying RAP-forgiveness credit includes, among other categories:
●​
●​
●​
●​

on-time RAP payments
on-time Tiered Standard payments
qualifying IBR payments
before July 1, 2028, qualifying PAYE/ICR income-contingent-plan payments

RAP payments do not count toward legacy IBR/PAYE/ICR forgiveness.

6. Income-Based Repayment (IBR)
Primary source: same RISE Final Rule.​
Partial-financial-hardship removal: FSA GEN-25-04, July 18, 2025.​
https://fsapartners.ed.gov/knowledge-center/library/dear-colleague-letters/2025-07-18/federal-student-loan-program-provisions-effective-upon-enactment-under-one-big-beautiful-bill-act

6.1 Discretionary income


Discretionary Income =
max(0, applicable income - 150% × applicable HHS poverty guideline)
Use the current applicable HHS guideline by family size/state and version it annually.
hhs-poverty-guidelines-2026-idr.json contains the 2026 values.

6.2 New IBR legal cohort — do not approximate by one
date
The final rule defines an IBR new borrower as an individual who:
●​ has no outstanding Direct/FFEL balance before July 1, 2014 and obtains no new loan
on/after July 1, 2026; OR
●​ has no outstanding Direct/FFEL balance on the date the borrower obtains a loan after
July 1, 2014 but before July 1, 2026.
Do not implement this as only:
hadOutstandingBalanceBefore2014 === false
Use loan-history data sufficient to evaluate the regulatory definition, or require an explicit verified
ibrCohort: "new" | "old" input for legacy borrowers.

6.3 Payment formula
New IBR:
monthly =
min(
10% × discretionary income / 12,
10-year-standard-equivalent payment based on eligible balances
and interest rates when borrower began IBR
)
Old IBR:
monthly =
min(


15% × discretionary income / 12,
same type of 10-year-standard-equivalent entry cap
)
If spouse debt/income is included under the rule, apply the regulatory proportional-debt
adjustment.
After applicable IBR adjustments:
if monthly < $5: monthly = $0
if $5 <= monthly < $10: monthly = $10

6.4 Eligibility
●​ Partial financial hardship requirement: false, effective July 4, 2025.
●​ Only Direct Loans made before July 1, 2026 may be repaid under IBR.
●​ A borrower with 60+ qualifying REPAYE payments on/after July 1, 2024 may not enroll in
IBR.
●​ V1 supports eligible Direct Loan types only; do not silently model FFEL.

6.5 Forgiveness
New IBR: 240 qualifying monthly payments / at least 20 years
Old IBR: 300 qualifying monthly payments / at least 25 years

6.6 IBR interest subsidy
For IBR, uncovered accrued interest on Direct Subsidized Loans and eligible subsidized
consolidation portions is not charged during the first three consecutive years of repayment
under the plan; qualifying economic-hardship deferment periods are excluded from that
three-year clock.
If v1 projects balances through IBR, model this. If v1 only computes the current required
monthly payment, this rule may stay in the projection layer.

7. Tiered Standard Repayment Plan


Primary source: RISE Final Rule, 34 CFR §685.208(c).​
https://www.federalregister.gov/documents/2026/05/01/2026-08556/reimagining-and-improving-student-education-federal-student-loan-program-final-regulations
For borrowers subject to Tiered Standard:
fixed monthly payments
minimum generally $50/month
if remaining balance < $50, final amount due = outstanding balance
Term is determined by total Direct Loan amount at repayment entry:

Total Direct Loans

Maximum term

< $25,000

10 years / 120
months

$25,000–<$50,000

15 years / 180
months

$50,000–<$100,000

20 years / 240
months

>= $100,000

25 years / 300
months

For Direct Loans made on/after July 1, 2026, Tiered Standard is the default plan if no plan is
selected.

Important precision note
The regulation states the fixed-payment/term requirement; it does not publish a literal annuity
equation. For an app estimate, calculate a fixed amortizing payment for each loan over the
applicable term and sum them, then apply the $50 aggregate minimum. Label that payment as
an estimate, because federal student-loan interest accrues daily and a servicer payoff schedule
may differ slightly.


Do not present the annuity equation as “the government formula.”
Tiered Standard payments do not qualify for PSLF under the final rule, but on-time Tiered
Standard payments can count toward RAP's 360-payment forgiveness clock.

8. 2026–27 Direct Loan rates
Source: FSA GENERAL-26-33, posted June 4, 2026.​
https://fsapartners.ed.gov/knowledge-center/library/electronic-announcements/2026-06-04/interest-rates-federal-direct-loans-first-disbursed-between-july-1-2026-and-june-30-2027
For loans first disbursed on/after July 1, 2026 and before July 1, 2027:

Loan type

Fixed rate

Direct Subsidized / Unsubsidized,
undergraduate

6.52%

Direct Unsubsidized, graduate/professional

8.07%

Direct PLUS, parent or grad/professional

9.07%

Treasury high yield: 4.468%. Rates are fixed for the life of each loan.
Data model must distinguish:
type DirectLoanType =
| "direct_subsidized_undergrad"
| "direct_unsubsidized_undergrad"
| "direct_unsubsidized_grad_professional"
| "direct_plus_parent"
| "direct_plus_grad_professional"


| "direct_consolidation";
Do not use one generic "plus" value.

9. Repayment projection contract
A policy-exact current monthly required payment is different from a long-horizon projection.
Every projection must carry:
interface ProjectionAssumptions {
incomePath: Array<{ year: number; agiCents: number }>;
dependentPath: Array<{ year: number; dependents: number }>;
povertyGuidelineVersionByYear: Record<number, string>;
recertificationAssumption: "annual_on_time";
paymentTimingAssumption: "on_time_monthly";
extraPayments: "none" | ExtraPaymentSchedule;
}
If user supplies no future path, default to constant real inputs only if UI says:
“Projection assumes your AGI and dependents stay constant. Actual IDR payments
are recalculated and can change.”
RAP projection must apply:
1.​ required monthly payment
2.​ payment allocation
3.​ RAP uncovered-interest protection
4.​ RAP principal match
5.​ forgiveness-credit counter
IBR projection must apply its eligible subsidized-interest rule and the selected new/old cohort.


10. Data-model corrections before coding
Recommended policy-facing models:
interface SaiDependentInputs2026_27 {
familySize: number;

// >= 2 for Formula A

numberInCollege?: number;

// informational only; NEVER used in SAI

parentStateForPell: string;
parentSingleParentIndicator: boolean;
parentTaxFilingFacts: ParentTaxFacts;
parentIncome: ParentIncomeInputs;
parentAssets?: ParentAssetInputs; // omitted when asset-exempt
studentIncome: StudentIncomeInputs;
studentAssets?: StudentAssetInputs; // omitted when asset-exempt
meansTestedBenefits2024or2025: string[];
}

interface LoanScenario {
id: string;
type: DirectLoanType;
principalCents: number;
accruedInterestCents: number;
disbursementDate: string;
fixedApr: number;
enteredRepaymentAt?: string;
ibrEnrollmentSnapshot?: {


eligibleBalanceCents: number;
tenYearStandardCapCents: number;
cohort: "new" | "old";
};
parentPlusConsolidationHistory?: ParentPlusConsolidationHistory;
}
Money: integer cents for storage/display.​
SAI worksheet math: decimal-safe dollar calculations following federal intermediate rounding.

11. Source/version fail-closed rule
Policy selectors must not silently reuse an expired constant.
selectSaiPolicy("2026-27")

// exact award-year match required

selectLoanRate(disbursementDate) // exact disbursement cohort required
selectPovertyGuideline(year)

// exact guideline vintage required

If no matching policy version exists:
return POLICY_VERSION_UNAVAILABLE
Do not “use the latest.”

12. Litigation / unsettled-policy flag
As of Aug. 7, 2026, a June 24, 2026 D.D.C. preliminary stay affects part of the RISE
professional-degree definition used for graduate/professional loan limits. FSA says the vast
majority of the final rule remains effective, explicitly including RAP and Tiered Standard.
Source: https://fsapartners.ed.gov/knowledge-center/library/electronic-announcements/2026-06-29/update-list-professional-degree-programs-due-court-order-updated-july-10-2026
Impact on this contract:


●​
●​
●​
●​
●​
●​

SAI/Pell formulas: no identified stay
RAP: effective
Tiered Standard: effective
IBR formulas: effective
2026–27 interest rates: effective
professional-degree borrowing-limit classification: track separately; litigated

13. Mandatory regression suite before UI
integration
Load calculation-test-vectors-v1.0.json and require:
●​
●​
●​
●​
●​
●​
●​
●​
●​
●​

every SAI rounding vector
both official Table A1 payroll examples
every A5 boundary vector
zero-income Formula A floor vector
asset-exemption path tests
Pell threshold/rounding/COA tests
every RAP tier boundary, dependent reduction, spouse proration, $10 floor
RAP interest protection/principal-match tests
IBR 10%/15%, 150%-poverty, cap, and $0/$10 adjustment tests
Tiered Standard balance-term boundaries

Add property tests:
●​
●​
●​
●​
●​
●​
●​

final SAI is always [-1500, 999999]
student income/assets contributions never negative
parent contribution may be negative
RAP current required payment is never below $10 except final payoff
IBR new monthly <= its 10-year entry cap
IBR old monthly <= its 10-year entry cap
Tiered Standard term selector returns only 120/180/240/300 months

14. Freeze record
{


"contractVersion": "1.0.0",
"verifiedAt": "2026-08-07",
"awardYear": "2026-27",
"repaymentRuleEffectiveDate": "2026-07-01",
"status": "FROZEN_FOR_V1_IMPLEMENTATION_WITH_SCOPE_GUARDS"
}
Any policy correction changes the version and adds an entry to /policy-changes.​

```

## v1.0.1 dated correctness addendum — 2026-09-19

This addendum supersedes only the identified v1.0.0 statements below. The original
text above is retained as history. Frozen policy JSON and its baseline version are
unchanged. The user explicitly approved the statutory D3 correction on this date.

### Calculated Pell: negative SAI (supersedes §4.4 subtraction)

20 U.S.C. §1070a(b)(1)(B)(ii) treats a negative SAI as zero solely for Calculated
Pell. Do not modify the actual Formula A SAI, which can remain −1,500.

1. pellSai = max(calculatedSAI, 0).
2. rawCalculatedPell = publishedMaxPell − pellSai.
3. Compare the raw result with the applicable minimum ($740 for 2026–27).
4. If eligible, round that result to the nearest $5.
5. Scheduled Award = min(roundedCalculatedPell, Pell COA). Do not round the COA.

This is statutory SAI treatment, not an arbitrary final maximum clamp. The ordinary
Scheduled Award consequently cannot exceed $7,395. Max Pell, Min Pell, the SAI
ceiling, and Special Rule remain separate eligibility rules. Possible Special Rule
qualification remains verification-required at any SAI; v1 does not certify it.

Sources:
- https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=granuleid%3AUSC-prelim-title20-section1070a
- https://fsapartners.ed.gov/knowledge-center/library/dear-colleague-letters/2026-01-30/2026-27-federal-pell-grant-maximum-and-minimum-award-amounts
- https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/vol7/ch2-calculating-pell-grants
- https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/vol7/ch1-student-eligibility-pell-grants

### Application-boundary and eligibility clarifications

Canonical household facts determine Max Pell indicators and asset-reporting flags.
Unknown answers are not zeros or false. Both tax returns must survive editing;
asset-exempt profiles need not supply asset objects. Residence uses validated
canonical state/territory codes or explicit FOREIGN/UNKNOWN locations; malformed
strings are not silently interpreted as the Other table.

Repayment applicability is resolved before arithmetic under the dated table in
[v1.0.1-policy-decisions.md](v1.0.1-policy-decisions.md). This supplements §§5.4,
5.5, 6.4 and 7 with consolidation transition dates and borrower-wide facts. Missing
facts return cannot-determine; independent saved scenarios are not a portfolio.
Legacy Standard is distinguished informationally and is not newly simulated.
Existing RAP/IBR arithmetic, spouse-debt projection rules, rates and forgiveness
crediting are unchanged. Separate unresolved projection questions are not amended.
