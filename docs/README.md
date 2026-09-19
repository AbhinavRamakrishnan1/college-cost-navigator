# College Cost & Aid Navigator — Policy Pack v1.0.0

Generated/verified baseline: August 7, 2026.

Start with:
1. `contract-audit-from-uploaded-draft.md`
2. `calculation-contract-v1.0.md`
3. `calculation-test-vectors-v1.0.json`
4. `ship-gates.md`
5. `next-build-prompt.md`
6. policy JSON files

## Phase 7 source traceability

The public `/methodology` sections explain the implemented SAI, Pell, school data,
comparison, and Direct Loan repayment methods. `/policy-changes` records dated
events from the frozen contract, not live legal status. Presentation source links
in `src/data/methodology.ts` supplement the read-only source manifest using URLs
already recorded in the contract and Scorecard metadata.

On September 14, 2026, the canonical regression JSON gained a `repayment` section
reconciled from existing passing Phase 6 tests and contract §§5–9. Its integer-cent
inputs and expectations are exercised by `src/lib/repayment/vectors.test.ts`.
This fixture addition does not change contract version 1.0.0 or calculation behavior.
Phase 7 used a three-school development fixture, retained for fixture unit tests.

## Phase 8 release preparation

Production routes now load the national June 10, 2026 institution snapshot from
same-origin static data. See `production-operations.md` for regeneration, verification,
deployment instructions, and the manual accessibility checklist. The only federal
calculation changes are the explicitly approved RAP final-boundary rounding and
projected-outstanding-debt proration corrections; policy JSON remains untouched.
