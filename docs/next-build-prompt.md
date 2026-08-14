# Next Build Prompt

Read every file in `/docs` and every file in the policy pack before changing code.

The authoritative policy contract is `calculation-contract-v1.0.md`. Do not use an older draft.

## Phase 1 only
Scaffold the College Cost & Aid Navigator shell using React + TypeScript + Vite + React Router + Tailwind v4.

Create routes:
- `/`
- `/how-it-works`
- `/methodology`
- `/policy-changes`
- `/privacy`
- `/profile`
- `/app/aid-estimate`
- `/app/schools`
- `/app/compare`
- `/app/repayment`
- `/app/settings`

Add:
- accessible responsive shell/navigation
- privacy-first design tokens
- fictional demo household entry point
- Vitest + React Testing Library
- Playwright + axe smoke coverage
- CI
- decimal.js dependency reserved for federal SAI arithmetic

Do not implement SAI, Pell, net-price, repayment, or College Scorecard calculations in Phase 1.

Create policy boundaries:
- `src/data/policy/`
- `src/lib/policy/selectors.ts`
- `src/lib/policy/types.ts`
- `src/lib/calculations/README.md`

Policy selectors must fail closed when an exact policy version is unavailable. Never silently use the latest.

At the end:
1. list every changed file;
2. report test/build results exactly;
3. report unresolved decisions;
4. stop before Phase 2.
