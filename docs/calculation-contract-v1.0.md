# College Cost & Aid Navigator — Calculation Contract v1.0.0

**Status:** frozen for implementation within the declared v1 scope  
**Verified:** August 7, 2026  
**Policy scope:** 2026–27 dependent-student SAI/Pell; 2026 federal repayment rules; 2026–27 Direct Loan rates

## V1 scope guardrails

Supported:
- SAI Formula A — dependent students only
- Pell: dependent-student Max Pell, Min Pell, and Calculated Pell scheduled-award estimate
- Repayment: Direct Loans only, with Tiered Standard, IBR (where eligible), and RAP
- Rates: Direct Loans first disbursed July 1, 2026–June 30, 2027

Explicitly unsupported in v1:
- Formula B/C SAI for independent students
- FFEL repayment calculations
- PAYE/ICR monthly simulation
- Institutional aid guarantees

## Global SAI arithmetic
Use decimal-safe arithmetic. Round each calculation result to 3 decimal places, then to the nearest whole number, with half values rounded away from zero. Final SAI bounds: -1,500 to 999,999.

## 2026–27 Formula A highlights
- Parent Income Protection Allowance: family size 2=$29,190; 3=$36,330; 4=$44,880; 5=$52,950; 6=$61,930; each additional +$6,990.
- Parent Asset Protection Allowance: $0.
- Parent asset conversion rate: 12%.
- Student Income Protection Allowance: $11,770.
- Student income assessment rate: 50%.
- Student asset assessment rate: 20%.
- Number in college is not used in SAI.
- SAI floor: -$1,500.

## Pell 2026–27
- Maximum Pell: $7,395.
- Minimum Pell: $740.
- Calculated Pell: max Pell minus SAI, subject to minimum eligibility and COA cap.
- Pell ineligible if SAI >= $14,790 except statutory special-rule cases.
- Use 2024 HHS poverty guidelines for 2026–27 Pell Max/Min tests.

## RAP
- Effective July 1, 2026.
- Whole-AGI tier lookup, not marginal brackets.
- Minimum monthly payment generally $10 after dependent reduction and spousal proration.
- Include interest protection and principal match in projections.
- 360 qualifying monthly payments / at least 30 years for forgiveness.

## IBR
- Discretionary income = max(0, AGI - 150% × applicable HHS poverty guideline).
- New IBR: 10% / 20 years.
- Old IBR: 15% / 25 years.
- Apply 10-year-standard-equivalent cap.
- Monthly result below $5 -> $0; $5 to <$10 -> $10.
- Only Direct Loans made before July 1, 2026 may be repaid under IBR.

## Tiered Standard
Term by total Direct Loan balance at repayment entry:
- < $25,000: 120 months
- $25,000–<$50,000: 180 months
- $50,000–<$100,000: 240 months
- >= $100,000: 300 months

## 2026–27 Direct Loan rates
- Undergraduate Direct Subsidized/Unsubsidized: 6.52%
- Graduate/Professional Direct Unsubsidized: 8.07%
- Direct PLUS (Parent or Grad/Professional transition): 9.07%

## Source/version rule
Never silently reuse an expired policy constant. Exact award-year, disbursement cohort, and poverty-guideline year matches are required; otherwise return `POLICY_VERSION_UNAVAILABLE`.
