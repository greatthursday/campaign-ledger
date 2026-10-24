# Rules, provenance, and explicit assumptions

## Verified edition and source

AD&D **2nd Edition** Player's Handbook, Chapter 3:

- Table 14: Warrior Experience Levels (Fighter; Paladin/Ranger).
- Table 20: Wizard Experience Levels (Mage/Specialist).
- Table 23: Priest Experience Levels (Cleric; Druid).
- Table 25: Rogue Experience Levels (Thief/Bard).
- Cleric description: Wisdom 16+ grants +10% XP.
- Druid description: restricted high ranks, Grand Druid succession and hierophant XP reset.

Primary rulebook text, Premium 2nd Edition reprint (ISBN 9780786964451), consulted 2026-10-24:
https://dokumen.pub/premium-2nd-edition-advanced-dungeons-amp-dragons-players-handbook-hardcovernbsped-0786964456-9780786964451.html

These are the PHB thresholds, **not** 1E or Baldur's Gate adaptations. Tests check every table boundary and one XP below. Scope stops at PHB level 20 (standard Druid transition at 16); no extrapolated high-level tables, multiclass splitting, racial caps, or automatic training/rank approval. `atTableLimit` means the implemented table ends, not that the DM prohibits further advancement.

## Campaign rules, distinct from published rules

Named +15%, Cleric Wisdom +10%, stronghold +25% are additive and retroactive. Their combined maximum is +50%; an explicit custom bonus can go beyond this. Only the specified Cleric Wisdom bonus is automatic; other classes' prime-requisite bonuses require custom adjustments. Named and stronghold XP percentages are campaign rules, not universal 2E rules. Category treasure multipliers are also campaign defaults.

The specification did not establish named-level thresholds for each class. The sample defaults are **provisional campaign configuration**, not a claimed 2E rule: Cleric 9, Fighter 9, Ranger 10, Paladin 9, Mage 9, Thief 10, Bard 9, Druid 12. Confirm these with the DM before migrating. Each is editable in `settings.namedLevels`; `namedOverride` can force eligibility on/off per profile. Confirmed/manual level never affects XP qualification or automatically grants a bonus.

Automatic named qualification compares exact cumulative base XP times all current bonuses **except named** against that class's configured named-level XP threshold. `includingNamed` explicitly permits self-qualification using the candidate named multiplier, without iterative feedback. Eligibility is recalculated after losses/resets and is not permanently latched. Use an explicit override if earned named status should survive a loss of XP.

## Exact arithmetic and rounding

Base balances, splits, adjustment conversions and multipliers use exact BigInt fractions. They serialize as `numerator/denominator`. Every intermediate fraction is reduced; no rounding on individual shares or events. Only the final adjusted XP is rounded: `nearest` (half toward positive infinity), `floor`, or `ceil`, selected at campaign level. Qualifying levels/progress use that final displayed integer; automatic named qualification uses the exact pre-named amount. Negative resulting base balances are rejected. Zero balances are allowed. Safe integer overflow in displayed totals is rejected.

## Adjustments and retroactive changes

`setBase` replaces the base balance. `setAdjusted` freezes an exact base target computed from a consistent active multiplier for that requested total. `addAdjusted` freezes the signed amount divided by the active multiplier immediately **before** the adjustment. Each conversion is recorded in the event. Later changes to bonuses recalculate the resulting base balance; they do not reconvert old adjustments. Editing an earlier award never changes the base target stored in a later reset.

Named activation is discontinuous: if pre-named multiplier is 1.10 and named threshold is 225,000, a base at that threshold becomes 255,681.818... adjusted XP after +15% activates. Some requested adjusted totals in that gap have no consistent solution. `setAdjusted` tries both multiplier states and rejects unsatisfiable targets with an actionable override error. Force named on/off explicitly if the DM needs an exact target there. This avoids hidden baselines or duplicated authoritative totals.

Similarly, an `addAdjusted` that crosses named eligibility can change the total by **more than** the entered amount, because the named bonus then applies retroactively. The preview exposes the full before/after effect. Future bonus changes may also change a previously exact reset's adjusted result, as explicitly required by the retroactive-baseline model.

Replay starts at zero base XP. Order is event calendar date (ISO YYYY-MM-DD), persisted nonnegative `order`, then ID in code-point order. Creation/modification timestamps are metadata and never reorder replay. New events default to the next order; editing preserves order unless explicitly changed. Duplicate order values are permitted because ID provides the final tie-breaker. Baselines supersede previous awards without deleting them; deleting a baseline exposes earlier history again. Event editing/deletion is copy-on-write and validates the whole resulting history.

## Druid special handling

A standard Druid uses the published thresholds through 16th (3,500,000 XP). Becoming hierophant is an explicit DM-approved transition: record a reset leaving 1 XP and change the profile's `progressionTrack` to `hierophant`. The separate track has 16th at 1 XP, 17th at 500,000, 18th at 1,000,000, 19th at 1,500,000 and 20th at 2,000,000. Never sort the printed Druid column into one monotonic array: its post-reset values describe a different track. Choose base/adjusted reset and bonus overrides according to the campaign's DM ruling.

Rank/transition flags signal that qualifying XP alone does not grant a restricted rank. Manual confirmed level represents approval. Profile settings/track are current settings, so replay history uses them retroactively; it is not a historical profile-version ledger. This limitation is explicit. The reset reason/notes preserve the transition decision; a later phase may add dated profile changes if needed.

## Treasure and audit scope

Input value and unit are preserved. The multiplier is a direct conversion from that unit to XP; there is no implicit coin-exchange table. Use a stable `treasureKey` to prevent XP being awarded twice for the same treasure. Duplicate keys are rejected campaign-wide; sale/exchange/redistribution should be noted on the existing event or recorded outside the XP ledger. Unkeyed duplicate descriptions cannot be inferred reliably. This is not inventory management.

JSON is the complete portable source of truth. CSV expands shared awards into recipient rows for review, while the actual ledger stores each shared award once. CSV protects formula-like text; retain JSON for faithful restore. GitHub commits, remote conflicts, persistent storage and workbook migration belong to later phases and are not present here.
