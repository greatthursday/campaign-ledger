# Validation record

Validated 2026-10-24 using Node.js v24.22.1. `npm test` runs 44 passing tests with Node's built-in test runner, requiring no installed packages. The raw run output is included in `tests/test-results.txt`.

Covered: all eight class progressions, all table boundaries, class-specific reference examples, high Wisdom/overrides, all additive bonus combinations, retroactive changes, before-named and including-named qualification, manual confirmation separation, custom bonuses, shared/individual/custom allocations, untracked shares, category snapshots and explicit historical recalculation, zero-XP magic items, fractional arithmetic, scientific-notation decimal inputs, rounding policies, safe display limits, exact adjusted resets, named discontinuity rejection, mass common/per-recipient corrections, signed changes, chronological insertion, stable ordering, edits before resets, reset deletion, named activation/revocation, archived references, malformed import rejection, duplicate treasure prevention, immutable operations, JSON roundtrip, CSV formula protection, previews, and illustrative sample reconciliation.

`campaign.schema.json` is a JSON Schema 2020-12 structural contract. Included tests exercise the dependency-free runtime validator and deterministic replay; the project does not bundle a third-party JSON Schema validator. Cross-record relationships and calculated snapshot consistency are enforced by runtime replay, not JSON Schema alone.

No UI/device testing, network/GitHub saving, workbook reconciliation, or deployment has been performed in Phase 1.
