# Funding origination contract v1.0

**Status:** Phase 3 policy-foundation contract; no funding planner or loan allocation is implemented by this contract  
**Version:** 1.0.1  
**Verified:** September 21, 2026  
**Policy baseline:** federal rules in effect for the supported post-July 1, 2026 planning scope

This contract is additive to `calculation-contract-v1.0.md`. It does not duplicate or amend the SAI, Pell, or repayment formulas. If this contract conflicts with a cited primary federal source, the source controls and this contract must be corrected through a dated version change.

## 1. Supported scope

The initial Phase 3 funding planner may apply this policy only to:

- a dependent undergraduate;
- full-time enrollment;
- standard academic years;
- an initial four-year planning horizon; and
- explicit institution and program identifiers; and
- an institutional loan-limit status represented as `none_confirmed`, `known_total_limit`, or `unknown`.

The fourth planning year uses the third-year-and-beyond Direct Loan limit. Grade level is a policy fact; a future planner must not infer it solely from a calendar-year index.

The following cases return an explicit `unsupported` result rather than an estimate:

- independent students;
- graduate or professional students;
- part-time enrollment;
- summer-only or other nonstandard enrollment;
- transfer-specific borrowing determinations;
- shortened or nonterm programs; and
- unresolved program changes or other cases requiring institution/COD determination.

An institutionally determined program-level limit may be used only when represented explicitly. Under the federal rule, a known limit is a shared annual total across Direct Subsidized, Direct Unsubsidized, and PLUS borrowing for the program. Because this foundation does not allocate that total among loan types, `known_total_limit` returns `requires_institutional_allocation` with the federal ceilings and known total, not independently usable Direct or Parent PLUS amounts. `unknown` returns `insufficient_information`; `none_confirmed` permits the ordinary federal-ceiling selectors.

## 2. Origination eligibility is not repayment eligibility

**Origination eligibility** determines whether, and within what limits, a school may originate a new loan for a period of enrollment. It depends on student/program eligibility, academic year and grade level, annual and aggregate borrowing history, other financial assistance, cost of attendance, Parent PLUS credit outcomes, and any applicable transition exception.

**Repayment eligibility** determines which repayment plans may be used for an existing loan or borrower portfolio. It depends on loan type, disbursement date, consolidation and Parent-PLUS-derived history, borrower-wide post-2026 borrowing, repayment history, and other plan-specific facts.

The two decisions are separate. Phase 3 must not call the repayment-eligibility functions to grant permission to originate a loan, and repayment-plan availability must not be inferred from this origination policy.

## 3. Direct Subsidized and Unsubsidized Loan limits

For a dependent undergraduate in a supported full standard academic year:

| Grade level | Combined annual maximum | Subsidized maximum within combined amount |
|---|---:|---:|
| First year | $5,500 | $3,500 |
| Second year | $6,500 | $4,500 |
| Third year and beyond | $7,500 | $5,500 |

The standard dependent undergraduate aggregate maximum is $31,000, of which no more than $23,000 may be subsidized.

### Higher-limit dependent cases

The higher combined limits are available only after an explicit qualifying determination:

| Grade level | Higher combined annual maximum | Subsidized maximum |
|---|---:|---:|
| First year | $9,500 | $3,500 |
| Second year | $10,500 | $4,500 |
| Third year and beyond | $12,500 | $5,500 |

The higher combined aggregate maximum is $57,500; the subsidized aggregate maximum remains $23,000.

A Parent PLUS denial for adverse credit or a documented financial-aid-administrator determination of qualifying exceptional circumstances can support a school determination for the higher limit. The limit selector requires that separate determination to be verified for the requested academic year. A raw denial does not select the higher tier: when parents apply independently and one is approved while another is denied, the denial does not establish higher-limit eligibility. A parent's refusal to borrow and exhaustion of the new Parent PLUS aggregate cap do not qualify the student. An unresolved or prior-year determination returns `insufficient_information`.

Ordinary undergraduate aggregate usage is **aggregate-countable outstanding principal**, not cumulative historical borrowing and not an undifferentiated servicer balance. Repayment of countable principal can restore ordinary undergraduate aggregate headroom. Interest, capitalized interest, other charges, and other federally noncounting amounts do not consume this headroom. Consolidation must be attributed to its underlying qualifying outstanding principal without double counting.

When a borrower returns from higher-limit to standard dependent status, only the amounts federal rules count against the standard dependent aggregate are supplied as the aggregate-countable outstanding principal. Previously permissible additional unsubsidized borrowing is not automatically reclassified by this selector.

## 4. Lifetime federal student borrowing

For borrowers subject to the post-July 1, 2026 rule, the federal lifetime maximum is $257,500. Counted history includes applicable student Direct and FFEL borrowing and graduate/professional PLUS borrowed as a student. It excludes Parent PLUS borrowed by the person as a parent, HEAL and specified excluded health-profession borrowing, and converted TEACH Grants. Returned loan funds do not count. Repayment, forgiveness, cancellation, or discharge does not restore lifetime capacity, and a consolidation loan must not double-count the underlying loans.

The categorized relevant history and consolidation attribution must be confirmed complete. `confirmed_complete` structurally requires every category amount and confirmed inclusion of underlying consolidation principal; `incomplete` permits missing values but cannot produce a definitive headroom result. A repayment scenario or outstanding balance is not a substitute for NSLDS/school counted usage.

## 5. Parent PLUS limits and decision states

For covered periods of enrollment beginning on or after July 1, 2026:

- annual maximum: $20,000 per dependent student across all parents;
- aggregate maximum: $65,000 per dependent student across all parents;
- both remain subject to cost of attendance minus other financial assistance;
- returned loan funds do not count toward the aggregate; and
- repayment, forgiveness, cancellation, or discharge does not restore the aggregate allowance.

All parents borrowing for one student share the same annual and aggregate usage. Parent identity cannot create a second cap.

The canonical Parent PLUS policy states are:

- `eligible`: credit eligibility and cap history are sufficiently known and positive headroom remains;
- `credit_denied`: a credit denial is represented separately and requires a distinct academic-year-specific school determination before it can support higher student limits;
- `cap_exhausted`: annual or aggregate statutory cap headroom is zero; this is not a credit denial and does not itself produce higher student limits;
- `transition_exception`: all transition predicates and continued eligibility are established; the new caps do not apply during the remaining expected time to credential, but COA minus other aid still applies;
- `insufficient_information`: a required credit, cap, or transition fact is missing; and
- `unsupported`: the student or enrollment case is outside this contract.

No policy result should reduce missing usage, credit, or transition facts to zero or false.

## 6. Parent PLUS transition exception

The transition exception requires a verified determination whose institution identifier, program identifier, and enrollment period exactly match the requested context, supported by evidence that:

1. the student was enrolled in the program at an institution as of June 30, 2026;
2. a Direct Loan was disbursed before July 1, 2026 either to the student for that program or to the current parent borrower for that student and program;
3. the student remains enrolled in the same program; and
4. the requested period is within the student's expected time to credential.

The expected time to credential is determined by the institution as the lesser of three academic years or the published program length minus time completed before July 1, 2026. The application does not independently calculate this expiry. A later estimated graduation date does not extend it. Withdrawal or otherwise ceasing enrollment ends the exception. An approved Title IV leave of absence is represented as not withdrawn, with timely return to the same program confirmed; withdrawal and approved-leave facts cannot both be true. A major change within the same degree or certificate remains the same program under the cited rule.

A qualifying loan must have been disbursed. A canceled loan is not treated as made for this exception; repayment of a loan that was made is not the same as cancellation and does not by itself defeat the exception.

The application must not reconstruct or guess COD's determination. Missing facts return `insufficient_information`. Unresolved grandfathering remains outside the numeric funding plan.

## 7. Interest-rate cohorts

Interest rates are selected through the existing canonical `selectFederalLoanRates(firstDisbursementDate)` policy path. A loan's first disbursement fixes its rate for the life of that loan. The known July 1, 2026 through June 30, 2027 cohort is not reused for a later cohort. A future unknown rate returns `POLICY_VERSION_UNAVAILABLE`; a later planning layer may separately accept a clearly labeled user assumption.

Multiple annual cohorts must remain separate. This contract does not authorize rate blending.

## 8. Origination fees

For loans first disbursed on or after October 1, 2020 and before October 1, 2027:

- Direct Subsidized and Direct Unsubsidized fee: 1.057%;
- Direct PLUS fee: 4.228%; and
- a fee result with fractional cents is truncated, not rounded, to cents.

The verified inclusive selector window is October 1, 2020 through September 30, 2027. October 1, 2027 and later return `POLICY_VERSION_UNAVAILABLE` until a new source-backed window is added. Fee policy is selected from the first disbursement date.

This foundation may calculate the total fee on a supplied gross loan amount to test the federal truncation rule. It does not implement fee gross-up, disbursement allocation, or a funding plan.

## 9. Accounting vocabulary

- **Gross principal:** the face amount originated and owed by the borrower.
- **Origination fee:** the amount withheld from the disbursement under the applicable fee policy.
- **Net proceeds:** gross disbursement minus the fee withheld from that disbursement.
- **Funding gap:** supported projected cost not covered by grants, scholarships, family cash, or net loan proceeds.

Future planning must present gross principal, fees, and net proceeds separately. It must not describe net proceeds as principal or treat a fee as grant aid.

No gap is filled automatically with a private loan. No institutional-aid award is estimated from SAI, Pell, Scorecard net price, or another federal result.

## 10. Known, assumed, unknown, and fail-closed behavior

- `known`: established by stored facts or source-backed policy.
- `assumed`: explicitly supplied by the user for planning and labeled as an assumption.
- `unknown`: absent or not established; never converted to zero, false, eligible, or ineligible.

Federal policy data and user assumptions must remain separate in types and output. Direct annual policy uses academic-year start, Parent PLUS policy uses enrollment-period start, and fee policy uses first-disbursement date; the dates are not assumed equal. Policy selection uses exact effective-date boundaries. An unsupported case returns `unsupported`; missing facts return `insufficient_information`; a missing date/version window returns `POLICY_VERSION_UNAVAILABLE`.

This foundation does not determine Title IV eligibility, subsidized financial need, COA-minus-aid loan amounts, or actual loan allocation. Those require later approved Phase 3 work.

## 11. Versioned policy datasets

The contract is implemented by three additive datasets and one integrity manifest:

- `direct-loan-origination-limits-2026-07-01.v1.json`;
- `parent-plus-origination-limits-2026-07-01.v1.json`;
- `direct-loan-origination-fees-2026.v1.json`; and
- `origination-policy-integrity-v1.0.json`.

Each policy dataset declares its schema and policy versions, effective window and date basis, verification date, primary sources, and source locators. The integrity manifest associates each dataset with its LF-normalized SHA-256 hash. The six pre-existing frozen policy files remain unchanged.

## 12. Primary sources

- [34 CFR 685.203, Loan limits](https://www.ecfr.gov/current/title-34/subtitle-B/chapter-VI/part-685/subpart-B/section-685.203), especially paragraphs (a)-(j) and (m).
- [34 CFR 685.202, borrower charges](https://www.ecfr.gov/current/title-34/subtitle-B/chapter-VI/part-685/subpart-B/section-685.202), especially the loan-fee provisions.
- [FSA 2025-2026 Handbook, Volume 8, Chapter 4](https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2025-2026/vol8/ch4-annual-and-aggregate-loan-limits).
- [FSA Frequently Asked Questions - Loan Limits, May 20, 2026](https://fsapartners.ed.gov/sites/default/files/2026-05/FrequentlyAskedQuestionsLoanLimits.pdf).
- [FSA NSLDS Eligibility Processing Updates, April 24/May 7, 2026](https://fsapartners.ed.gov/knowledge-center/library/electronic-announcements/2026-04-24/one-big-beautiful-bill-act-nslds-eligibility-processing-updates-updated-may-7-2026).
- [FSA GENERAL-26-28, FY27 sequester-required changes](https://fsapartners.ed.gov/knowledge-center/library/electronic-announcements/2026-05-13/fy27-sequester-required-changes-title-iv-student-aid-programs).
- [FSA GENERAL-26-33, 2026-27 Direct Loan interest rates](https://fsapartners.ed.gov/knowledge-center/library/electronic-announcements/2026-06-04/interest-rates-federal-direct-loans-first-disbursed-between-july-1-2026-and-june-30-2027).

No secondary-source statement is encoded as a numeric policy constant.
