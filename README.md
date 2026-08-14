# College Cost & Aid Navigator

Phase 2 application shell with browser-local household persistence for a privacy-first, policy-aware college planning experience.

## Commands

- `npm run dev` — local development
- `npm run build` — type-check and production build
- `npm test` — Vitest and React Testing Library
- `npm run test:e2e` — Playwright + axe smoke tests
- `npm run lint` — Oxlint

Household profiles are validated locally and stored in IndexedDB with Dexie. Phase 2 intentionally does not implement aid, cost, school comparison, or repayment calculations. See `docs/calculation-contract-v1.0.md` for the authoritative future calculation contract.
