# Ship Gates

No public v1 release until all of these are satisfied.

## Calculation correctness
- Decimal-safe SAI arithmetic is used.
- Formula A tests pass.
- Asset-reporting gate is tested.
- Number-in-college never enters SAI math.
- Independent students fail closed.
- Pell Max/Min/Calculated paths are tested.
- 2024 HHS poverty table is used for Pell.
- 2026 HHS poverty table is used for IBR.
- RAP boundaries, dependent reduction, spouse proration, interest protection, and principal match are tested.
- IBR cohort logic and $0/$10 adjustment are tested.
- Parent PLUS and Grad/Professional PLUS are separate loan types.
- Tiered Standard balance tiers are tested.
- Loan rate selector keys to disbursement date.

## Product truthfulness
- SAI is labeled as an index, not a bill.
- Pell is labeled as a Scheduled Award estimate.
- Long-horizon projections display assumptions.
- Tiered Standard payment is labeled an app estimate.
- Unsupported cases fail closed with useful UI copy.

## Engineering
- No financial input in network requests, console logs, or analytics.
- Policy JSON is read-only and versioned.
- Missing policy versions fail closed.
- Calculation functions are pure.
- Regression suite runs in CI.
- Backup/restore schema is versioned.
- Delete-all is tested.
