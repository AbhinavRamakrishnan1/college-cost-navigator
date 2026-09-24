# College Cost & Aid Navigator

Privacy-first college planning for 2026–27 federal aid, public College Scorecard school data, four-/five-year funding plans, graduation-debt estimates, and carefully scoped repayment scenarios.

## Commands

- `npm run dev` — local development
- `npm run build` — type-check and production build
- `npm test` — Vitest and React Testing Library
- `npm run test:e2e` — Playwright + axe smoke tests
- `npm run lint` — Oxlint

Household profiles are validated and stored locally in IndexedDB with Dexie. Funding plans, decision checklists, and what-if scenarios exist only in React memory and clear on reload. The browser consumes a same-origin College Scorecard snapshot; household financial values are not sent to Scorecard or analytics.

The app supports dependent-student Formula A SAI/Pell estimates, school search and factual comparison, a four-/five-year funding planner, and scoped federal repayment tools. It does not produce aid offers, affordability scores, rankings, private-loan projections, or college recommendations.

Key references:

- `docs/calculation-contract-v1.0.md` — authoritative SAI/Pell calculation contract
- `docs/funding-origination-contract-v1.0.md` — reviewed federal origination scope
- `docs/v1.1-release-report.md` — v1.1 scope, limitations, and release verification
- `/methodology` in the application — dated methods and primary sources
- `/about` — builder and project background
