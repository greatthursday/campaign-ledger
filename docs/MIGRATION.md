# Historical workbook migration

The migration runs offline and never writes to GitHub itself. The original XLSX is opened read-only with Python's standard ZIP/XML libraries; shared Excel formulas are expanded and arithmetic/SUM/ROUND evaluated exactly. No workbook is rewritten or recalculated in place.

```sh
python3 scripts/migration/extract-workbook.py /path/to/DND.xlsx /tmp/source-workbook.json
node scripts/migration/migrate-workbook.mjs /tmp/source-workbook.json data/empty-campaign.json /tmp/migrated
```

The supplied mapping handles the two Cleric ledgers on Experience. It deliberately fails if control formulas change, an existing starter contains history, a source allocation cannot be reconstructed exactly, or new post-book rows require a different conversion interpretation. It does not guess unsupported formulas.

The output contains a complete campaign JSON, reconciliation controls, Markdown report and per-cell review CSV. Keep these outputs and the complete extracted workbook in the **private data repository**, never bundle actual campaign records into a public frontend. The app source retains only illustrative sample data and an empty starter.

Migration rules:

- Convert each opening adjusted baseline using its recorded original scale. Preserve exact underlying fractions.
- Store historical base awards and original adjusted awards separately. Never apply current category defaults to old records.
- Combine only explicitly matched split formulas and descriptions. Preserve both original source-cell records and per-character ordering.
- Preserve rounded historical share awards without recomputing their old rounding policy.
- Retain the explicit post-book baseline as an adjustment after all pre-book source rows. Earlier edits cannot bypass that later reset while their chronological position is preserved.
- Use a historical category rather than guessing combat/treasure/roleplay labels for ambiguous descriptions.
- Mark unrecorded dates as unknown. Internal sorting anchors maintain source order; they are not invented session dates. Source-known dates are retained exactly.
- Use neutral placeholders for blank descriptions and keep the originals in source metadata.
- Keep an unknown Wisdom score unknown; use an explicit bonus override when the original formula establishes bonus eligibility.
- Preserve separate character/inventory areas in the extracted source. Do not count their treasure valuations a second time as XP awards.

The UI offers a migration-review filter and per-event source details. An imported event's source metadata survives subsequent form edits. To confirm an actual historical date, edit the entry and clear the unknown-date checkbox; review the ordering of any later unknown-date reset and use the before/after preview before recording changes.

The private repository's migration/report.md and migration/review.csv hold the actual reconciliation results and remaining review items. Original input and evaluated formulas are retained in source-workbook.json.gz, a standard gzip-compressed JSON archive. The source XLSX remains unchanged in its original location.
