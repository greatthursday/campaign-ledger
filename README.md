# Campaign Ledger — Phase 1 core

Independent JavaScript ES modules for the specified AD&D 2E XP ledger. No runtime dependencies, DOM, database, network calls, credentials, UI, or deployment. The attached workbook has not been migrated or changed.

## Run

Requires Node.js 20+ for tests. The core also runs in modern browsers supporting ES modules, BigInt and structuredClone.

```sh
cd campaign-ledger
npm test
```

No npm install is needed. Import the public API from `js/index.js`.

```js
import {importJSON, replayCampaign, createAward, upsertEvent, exportJSON} from './js/index.js';
const campaign = importJSON(jsonText);
const event = createAward(campaign, {
  id: 'unique-event-id', date: '2026-10-24',
  createdAt: '2026-10-24T18:00:00.000Z',
  description: 'Shared encounter', categoryId: 'combat',
  inputValue: 20000, distribution: 'shared', divisor: 4,
  recipientIds: ['callista', 'diemer']
});
const updated = upsertEvent(campaign, event);
console.log(replayCampaign(updated).characters);
const backup = exportJSON(updated);
```

`data/sample-campaign.json` is **illustrative**, not migrated campaign data. Expected illustrative balances: Callista 906,563 adjusted XP; Diemer 706,563 adjusted XP. The sample generator is reproducible with `node data/generate-sample.mjs`.

## Contents

- `js/data-model.js`: campaign and character factories, editable campaign defaults.
- `js/xp-engine.js`: bonuses, award creation, adjustments, replay, previews and explicit historical recalculation.
- `js/level-tables.js`: class progression and XP qualification.
- `js/rational.js`: exact fraction arithmetic; no accumulated rounding drift.
- `js/validation.js`: import and semantic validation.
- `js/serialization.js`: pure JSON and CSV portability functions.
- `data/campaign.schema.json`: JSON Schema 2020-12 structural contract.
- `docs/API.md`: frontend-facing functions and record format.
- `docs/RULES.md`: sources, assumptions, boundary behavior and limitations.
- `tests/xp-engine.test.js`: automated engine/integration tests.

The schema describes record structure; runtime validation additionally checks identities, foreign keys, chronology, share counts, duplicate treasure keys, and snapshot consistency through replay. Always use `importJSON` at an untrusted data boundary, and replay an edited candidate before accepting it.

## Next phase

Build the local interface against this API. GitHub load/save, token handling, file SHA conflict checks, workbook reconciliation and deployment remain intentionally unimplemented.
