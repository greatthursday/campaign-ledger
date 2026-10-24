# Public API

All exports are available from `js/index.js`. Functions are synchronous and independent of storage. They do not mutate their inputs. Errors throw `Error`, except `validateCampaign`, which returns diagnostics. Callers supply unique IDs and UTC ISO timestamps; no hidden clock or random generator is used.

## Model

A campaign record contains `schemaVersion: 1`, `id`, `name`, `settings`, `categories`, `characters`, `events`, and optional notes/illustrative markers. A single file holds one campaign; all child records carry that campaign's ID. Separate campaign files keep the architecture simple.

Characters store identity, class, race, Wisdom, current bonus eligibility settings, progression track, optional confirmed level, notes and active status. **They do not store independent base XP or adjusted XP.** Use a `setBase` opening adjustment for a historical starting balance. Base and adjusted XP come from replay. Optional `namedOverride` and `wisdomOverride` values are `null` (automatic), `true`, or `false`.

Awards record `id`, `campaignId`, `date`, `order`, `createdAt`, `modifiedAt`, `description`, `notes`, `type: 'award'`, `categoryId`, numeric `inputValue`, numeric multiplier snapshot, `distribution`, `divisor`, `unit`, `itemDescription`, optional `treasureKey`, and `allocations: [{characterId, baseXp}]`.

The event base XP is calculated by `eventBaseXp(event)`; it is not independently persisted. Each allocation stores its original exact base award. Standard allocation snapshots must agree with the recorded input/multiplier/divisor or import fails. This intentional redundancy preserves original recipient awards and detects incomplete edits. For custom distribution, explicit allocations are authoritative and cannot exceed the total pool; unused shares are allowed.

Adjustment records use the common event metadata plus `type: 'adjustment'`, `method`, `reason`, and `allocations: [{characterId, amount, conversionMultiplier, baseXp}]`. `amount` is the requested total/change; `baseXp` is its exact, frozen base equivalent. Adjustment category multipliers never apply. No separate recipient-ID array is maintained; allocation IDs are the source of truth.

Exact fractions serialize as strings such as `"8000000/11"`. Inputs are finite JSON numbers with magnitude <= 1e12. Creation functions canonicalize fractions. Derived character states include `baseXp`, `adjustedXpExact`, rounded `adjustedXp`, `multiplier`, bonus flags, `qualifyingLevel`, `confirmedLevel`, `currentLevelThreshold`, `nextLevelXp`, `xpRemaining`, `progressPercent`, and table/rank flags. Derived totals should not be saved back as character fields.

## Functions

| Function | Purpose |
| --- | --- |
| `createCampaign({id, name})` | New campaign with configurable defaults and empty records. |
| `createCharacter({id, campaignId, name, classId, ...settings})` | New profile. Supported class IDs are lowercase. |
| `validateCampaign(c)` | Structural/identity checks, `{valid, errors}`. For complete replay validation use `replayCampaign`. |
| `assertCampaign(c)` | Throw for invalid structure/identities. |
| `createAward(c, input)` | Create/validate one award; snapshots the category default unless input supplies a multiplier. |
| `createAdjustment(c, input)` | Create/validate mass adjustment and freeze conversions. |
| `upsertEvent(c, event)` | Return a validated campaign with event inserted/replaced. |
| `removeEvent(c, id)` | Return campaign without event, recalculating all effects. Caller handles confirmation. |
| `archiveCharacter(c, id)` | Set active false; retain ledger references and calculations. |
| `replayCampaign(c)` | Validate and return `{characters, history}` in stable chronological order. |
| `calculateCharacter(character, baseXp, settings)` | Pure state calculation, assuming valid profile/settings. |
| `bonusInfo(character, baseXp, settings)` | Exact multiplier and qualification details. |
| `levelInfo(classId, xp, progressionTrack?)` | Level qualification from rounded XP, independent of bonuses. |
| `progression(classId, track?)` | Thresholds and first level for a supported track. |
| `eventBaseXp(event)` | Exact converted event amount before distribution. |
| `awardAllocations(event)` | Recalculate allocations for a changed standard award. |
| `compareEvents(a,b)` | Stable chronological comparator. |
| `previewEvent(c, event)` | Replay candidate and return its per-recipient before/after entries. |
| `recalculateCategory(c, id, multiplier, modifiedAt)` | Explicitly update default AND all matching historical standard awards. Custom awards require explicit reallocation. |
| `exportJSON(c)` / `importJSON(text)` | Validated, lossless portable JSON. |
| `exportCSV(c)` | One history row per recipient/event, with before/after XP and calculation fields. CSV is for spreadsheet review, not lossless reimport. |

## Event edits

For standard awards, call `createAward(c, {...existingEvent, inputValue: newValue, modifiedAt: timestamp})`, then `upsertEvent`. Existing ID creation time/order are retained unless order is explicitly supplied. For adjustments, use `createAdjustment` with `recipients` (not the stored `allocations` array); rebuilding deliberately reconverts requested amounts using the chronological predecessor and current settings. To preserve an existing adjustment conversion when changing only notes, pass a cloned stored event directly to `upsertEvent` with updated notes/modifiedAt.

For character edits, clone the campaign, update the profile, and call `replayCampaign` before accepting. Archive referenced profiles instead of physically deleting them. Unreferenced profiles can be removed from the array and revalidated. Category IDs remain stable when renamed; defaults may change without rewriting historical multiplier snapshots. Retain/mark inactive categories referenced by old awards.

## Mass adjustments

```js
const event = createAdjustment(campaign, {
  id: 'correction-1', date: '2026-10-24',
  createdAt: '2026-10-24T18:00:00.000Z',
  description: 'DM balance correction', reason: 'Reviewed campaign notes',
  method: 'setAdjusted', amount: 1000000,
  recipients: [
    {characterId: 'callista'},
    {characterId: 'diemer', amount: 800000}
  ]
});
const preview = previewEvent(campaign, event);
```

Methods: `setAdjusted`, `addAdjusted` (signed change), `setBase`. All recipients must already belong to the campaign. Entire candidate is rejected atomically if any recipient produces invalid XP.

## Replay history

Each history entry contains `eventId`, `date`, `type`, and `entries`. Each recipient entry contains `before`, `after`, and exact `baseChange`. History uses **current character settings**, including retroactive bonuses, rather than pretending to reconstruct past ownership/Wisdom settings. Frozen adjustment conversion multipliers record the original conversion. A future UI can display one timeline row per event using the campaign event joined to this history.

For initial imports, create explicit baselines and frozen historical base awards. Never infer old multipliers from current defaults without reconciliation. JSON schema has no dependency on a specific JSON Schema validator; runtime validation is included without third-party packages.

## Historical import metadata

Shared divisors may be positive fractional share counts (for example 5.5), provided there are enough shares for all tracked recipients. This preserves fractional-share calculations in the original workbook.

A Wisdom score can be `null` when unknown, provided `wisdomOverride` explicitly enables/disables the bonus. Automatic bonus eligibility still requires a known score.

Imported events may have `dateStatus: 'unknown'` and a required internal `date` ordering anchor. The UI labels these as undated rather than presenting the anchor as a session date. `dateStatus: 'recorded'` identifies a recorded/confirmed date. `source` retains original workbook cell references, formulas, raw base XP, legacy adjusted awards, descriptions and recorded dates. `reviewFlags` mark specific gaps. Editing an imported event retains its source metadata.

CSV exports include explicit date status and ordering-anchor columns, plus original source values. An unknown event date is exported as blank in the actual date column. JSON remains the lossless backup. If a pre-reset event is assigned a real date, also review the reset's unknown date so actual chronological ordering is maintained; the live preview exposes any effect on current totals.
