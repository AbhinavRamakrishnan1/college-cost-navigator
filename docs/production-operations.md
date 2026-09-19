# v1 production operations and manual QA

Use Node 24.14.0 (`.nvmrc`) and `npm ci`. The database and backup formats remain v4.
The optional spouse-debt assumption is backward-compatible: old joint-filing records
keep their current payment, but their RAP projection is unavailable until an explicit
assumption is supplied. Only shipped v4 backup files are supported; older/future
versions are rejected without altering local data. No older released backup format
requires migration.

## Reproduce the national institution snapshot

Source: [official College Scorecard data page](https://collegescorecard.ed.gov/data/).
Download the June 10, 2026 institution archive referenced in
`src/data/scorecard/production-metadata.json`, extract its CSV, then run:

```powershell
npm run scorecard:import -- --csv path/to/Most-Recent-Cohorts-Institution.csv
node scripts/verify-scorecard.mjs
```

Generated normalized JSON and metadata are versioned. Source archives belong in
ignored `.scorecard-cache`, not Git. The importer validates all records with the
application Zod schema and rejects malformed values/duplicates. Null and suppressed
metrics stay unavailable. Metadata records the source CSV hash and normalized-record
hash; the latter is SHA-256 over `JSON.stringify(records)` in UNITID order.

The runtime downloads a 3.63 MB static JSON snapshot only on school/comparison routes,
validates it and verifies its checksum, then caches it for that page session. It is
not part of the initial JS. Search renders at most 50 results and asks users to narrow
the search. This is one lazy snapshot rather than a state-sharded catalog.
The full source universe is retained, including records that may no longer be operating;
inclusion is not an accreditation/current-operation endorsement.

Field-of-study data does not ship in v1. The official separate download exists, but
its completion-based cohorts must not be mislabeled as institution years-after-entry.
The UI does not promise complete field coverage. The national snapshot includes only
the selected institution fields; academic-year COA can be unavailable for program-year
institutions. No missing values are synthesized.

## Verification and deployment

```powershell
npm ci
npm run lint
npm test
npm run build
node scripts/verify-scorecard.mjs
node scripts/security-scan.mjs
npm audit --omit=dev --audit-level=high
npx playwright install chromium
npm run test:e2e
```

Playwright serves `dist` using `scripts/serve-production.mjs`, which applies the exact
headers in `vercel.json`. Static data misses return 404; nested application routes
fall back to `index.html`. CI installs Chromium with Linux dependencies and fails on
any command failure. Hosted GitHub Actions and Vercel have not been executed merely
by preparing configuration.

After all release gates pass and credentials are available:

```powershell
npx vercel login
npx vercel link
npx vercel deploy
# Review the preview, headers and nested routes before publishing:
npx vercel deploy --prod
```

Do not set any Scorecard key as a VITE_* variable. No key is needed for this CSV source
or for runtime. Deployment configuration enforces self-hosted scripts/styles/fonts,
same-origin connections, no framing/objects, no referrer, and restricted permissions.

## Manual accessibility checklist (not completed by automation)

- NVDA/Firefox and VoiceOver/Safari: headings, fieldsets, numbers, errors and status
  announcements on every route; verify currency/index distinctions are understandable.
- Keyboard-only: all controls, file chooser, native confirmation dialogs, cancel/Escape,
  restored focus, mobile navigation, and horizontally scrolling comparison cards.
- Actual browser 200% and 400% zoom: no loss of content/control access; compare at
  narrow width and landscape orientation. Viewport reflow automation is not browser zoom.
- High contrast/forced colors, reduced motion, focus visibility and touch targets.
- Inspect manually for issues axe cannot detect, including sensible reading/focus order.
- Verify the deployed preview's HTTP headers and direct nested-route refreshes in an
  independent browser. No manual screen-reader validation is claimed.

Any serious accessibility defect blocks public release. Never call an unexecuted
manual check a pass. Local-first does not mean encrypted: exported JSON contains
financial values and users must protect downloaded files.
