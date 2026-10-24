# Validation record

Validated 2026-10-24 using Node.js v24.22.1. `npm test` runs 44 passing tests with Node's built-in test runner, requiring no installed packages. The raw run output is included in `tests/test-results.txt`.

Covered: all eight class progressions, all table boundaries, class-specific reference examples, high Wisdom/overrides, all additive bonus combinations, retroactive changes, before-named and including-named qualification, manual confirmation separation, custom bonuses, shared/individual/custom allocations, untracked shares, category snapshots and explicit historical recalculation, zero-XP magic items, fractional arithmetic, scientific-notation decimal inputs, rounding policies, safe display limits, exact adjusted resets, named discontinuity rejection, mass common/per-recipient corrections, signed changes, chronological insertion, stable ordering, edits before resets, reset deletion, named activation/revocation, archived references, malformed import rejection, duplicate treasure prevention, immutable operations, JSON roundtrip, CSV formula protection, previews, and illustrative sample reconciliation.

`campaign.schema.json` is a JSON Schema 2020-12 structural contract. Included tests exercise the dependency-free runtime validator and deterministic replay; the project does not bundle a third-party JSON Schema validator. Cross-record relationships and calculated snapshot consistency are enforced by runtime replay, not JSON Schema alone.

No UI/device testing, network/GitHub saving, workbook reconciliation, or deployment has been performed in Phase 1.

## Phase 2 interface validation

The suite now contains 50 passing tests: the original 44 engine tests plus adjustment input-change detection (including metadata-only preservation), combined ledger filters/sorting, rendering escape protection and single-row shared events, complete browser-local adapter roundtrip/corrupt data rejection, and save failure propagation.

Manual browser QA in the managed preview verified dashboard totals, adding a 20,000 XP shared pool with four shares (5,000 base XP per tracked recipient), live retroactive stronghold preview, a mass adjusted-XP reset with a common amount and a different per-character override, ledger description search, local save and reload, and restoring the illustrative sample. Responsive rendering was inspected in real 390×844 and 768×1024 iframe viewports, including the iPhone XP modal. These are browser viewport checks, not physical iOS/Safari device testing.

No production deployment, campaign GitHub synchronization or workbook migration occurred in this phase. The local UI shows this limitation explicitly.

## Phase 3 persistence validation

78 automated tests pass: 44 XP-engine tests, nine view/local-adapter tests, and 25 GitHub adapter/settings tests. The latter simulate GitHub responses and validate load/save, UTF-8/base64 content, subsequent-save SHAs, changed/deleted files, write races, missing-file initialization, initialization collisions, load-before-save, private-only targets, privacy changes, invalid remote/local data, campaign ID mismatches, sanitized token/permission/rate/network errors, uncertain commits, concurrent operations, disconnect, isolated reload sessions, snapshots during in-flight saves, target restrictions, file-size limits, secret-free preferences, timeouts and unreadable responses. View tests include connection-form escaping, no persisted token value, conflict recovery instructions and disabled initialization controls while busy.

Manual browser inspection verified the connection/settings layout, remembered non-secret target defaults, blank password field, missing-token validation and retention of the open sample campaign. No real token was entered and no live campaign-data API save was performed. A real cross-device roundtrip remains pending creation of the separate private data repository and user-entered app credentials. The source code is saved to GitHub; no website deployment or workbook migration occurred.

## Workbook migration validation

84 Node tests pass, including six migration checks. One of those invokes five additional Python tests for shared-formula translation, exact arithmetic/SUM, Excel ROUND ties, split detection, unsupported expressions and circular references. Synthetic fixtures exercise fractional shared awards, source metadata, unknown dates/CSV fields, pre-book edits versus the later reset, changed-control rejection, nonempty-starter protection and unknown Wisdom with explicit overrides.

For the real workbook, all 261 source award rows occur exactly once in the imported provenance. All three controls reconcile with exact fractions: the current Diemer total, Callista's pre-book adjusted total and Callista's explicit post-book reset. The complete source fingerprint and detailed controls/review items are kept in the private data repository, not bundled into the frontend.

Manual browser QA imported the reconciled JSON, verified both displayed totals, reviewed the unknown-date banner/filter, opened an original fractional-share calculation for both recipients, and checked that editing retains the unknown-date checkbox, fractional divisor and original source metadata. No workbook changes or deployment occurred.
