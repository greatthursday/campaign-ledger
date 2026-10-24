# Campaign Ledger

A lightweight, buildless AD&D 2E experience tracker. Phase 3 includes the responsive dark fantasy interface, independent tested XP engine, and private GitHub campaign persistence.

## Run locally

Install Node.js 20 or later, then run from this folder:

```sh
npm run dev
```

Open the Local URL printed in the terminal (normally http://localhost:3000). No npm install or build is required. To choose a port, use `npm run dev -- --port 4173`. Serve over HTTP; opening index.html directly cannot load sample JSON reliably.

```sh
npm test
```

Tests use Node's built-in test runner. Production files are static and will work on GitHub Pages; no Node server is needed for production hosting.

## Current features

- Overview, Characters, XP Ledger and Settings tabs, including on mobile.
- Character cards with XP progress, qualifying versus confirmed level, retroactive bonuses and archival via active status.
- Popup XP awards with shared/individual distribution, conversion multipliers, treasure identity and notes.
- Mass XP adjustments with per-character overrides, baseline resets and live before/after/current-total previews.
- Full ledger search, character/category filters, date sorting, detail view, editing and confirmed deletion.
- Editable category defaults, custom categories and explicitly confirmed historical recalculation.
- Campaign rounding, timeline length and provisional per-class named thresholds.
- Explicit local device save, unsaved indicators, reload protection, JSON import/export and CSV export.

`data/sample-campaign.json` is **illustrative**, not a workbook migration. Sample balances: Callista 906,563 adjusted XP; Diemer 706,563 adjusted XP. Regenerate with `node data/generate-sample.mjs`.

## Saving and privacy

**Save on this device** stores the complete campaign in this browser's localStorage. It does not sync between browsers, devices, or GitHub. Browser data clearing/private mode can remove local saves. Export JSON for a portable backup. Import validates the full ledger before replacing the open campaign. Loading a sample/new campaign/import does not overwrite the last device save until Save is clicked.

GitHub campaign saving is now implemented in Settings. It uses a separate private data repository, an in-memory fine-grained token, explicit commits, and SHA-based conflict detection. The ChatGPT connection used to maintain this source repository is separate from the app's campaign-data token. No credentials are included in source or campaign exports.

See [GitHub setup and storage API](docs/GITHUB_SETUP.md) for the exact repository/token steps, conflict recovery, 1 MiB file limit and verification scope. `data/empty-campaign.json` is an empty starter awaiting migration; it is safe to use instead of illustrative balances.

## Structure

- `index.html`, `css/theme.css`: accessible page shell and responsive visual theme.
- `js/app.js`: browser event handling and forms; calculations call the engine.
- `js/ui.js`: view rendering and ledger filters; all user-supplied HTML text is escaped.
- `js/local-storage.js`: independent browser-local persistence adapter.
- `js/github-storage.js`: private GitHub Contents API adapter and conflict detection.
- `js/github-ui.js`, `connection-settings.js`: connection controls and secret-free target preferences.
- `js/xp-engine.js`, `rational.js`, `level-tables.js`: independent exact calculations and verified 2E thresholds.
- `js/data-model.js`, `validation.js`, `serialization.js`: records, validation and portable data.
- `data/campaign.schema.json`: JSON Schema 2020-12 structural contract.
- `docs/API.md`, `RULES.md`, `TESTING.md`: public engine API, assumptions, rules sources and validation record.
- `scripts/serve.mjs`: dependency-free local development server only.

## Remaining phases

The private data repository must be created/authorized and the real app-token roundtrip verified. Workbook migration/reconciliation and GitHub Pages deployment remain for later phases. No production site has been published.

Custom unequal awards are preserved, displayed, exported and calculated; their allocation editing remains a JSON-level extension in this interface. Druid hierophant transitions require the explicit profile track and DM-approved reset described in `docs/RULES.md`.
