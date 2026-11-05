# Build pipeline

These are the scripts that turn the Airtable base into the data the site loads.
They are in version control from 5 November 2026. Before that they existed only
in `Dashboard/Claude Code/hrc-dataset/scripts/` on Helena's machine, synced to
Drive — which meant that a change made in a cloud session and published to the
site was not reflected in any copy she could run.

## Order

    python3 scripts/fetch_airtable.py        # refresh data/airtable/*.json from the base
    python3 scripts/export.py                # data/airtable/*.json -> export/*.json
    python3 scripts/build_dashboard_data.py  # export/*.json        -> dashboard/data/*.js

`fetch_airtable.py` and `build_paragraphs.py` are not in this repository yet;
they are on the machine and in Drive. Airtable stays the single source of truth —
nothing here writes back to it.

## What the two committed scripts do

**`export.py`** reads the cached Airtable tables and writes six JSON files plus
`excluded.json`. Three things live here rather than in the base:

- `EXCLUDED_RESOLUTIONS` — texts kept in Airtable but not exported, each with the
  reason, which the site shows on the **Excluded mechanisms** tab. Nine symbols:
  56/13 (thematic, July 2026), S-23/1 (no body created, 4 November 2026) and the
  seven Syria texts removed on 5 November 2026 for failing limb (c).
- `TERM_OVERRIDES` — the hand decisions on mandate term, which beat the regex
  rules. Each is `(value, phrase)`.
- `PROTECTED_FILL` — analytical values for the two hand-written records (4/8 and
  OM/1/3) that were computed but never written to Airtable. No-ops once they are.

**`build_dashboard_data.py`** re-encodes the export into `window.*` script files,
because the site has to work from `file://` where `fetch()` of local JSON fails.

## Provenance, and the one thing to check before you run this

`export.py` was recovered byte-for-byte from the Drive backup of 4 November 2026
17:48, then brought up to the state the live site was already in. The following
had been applied only inside a cloud session that no longer exists:

| Change | Where |
|---|---|
| Seven Syria exclusions | `EXCLUDED_RESOLUTIONS` |
| Term retagging of 25/23, 39/14, 42/26; phrase for S-35/1 | `TERM_OVERRIDES` |
| Agenda item, agenda item title, vote requested by, State concerned position, State concerned source, investigated conduct State position | the resolutions record in `main()` |

**Diff this against your own copy before running it. If yours is newer, yours wins.**

`build_dashboard_data.py` needed no changes: the 4 November copy already carries
`excluded_texts`, and it is the version that produced the published `core.js`.

## Verification

`term_of()` as committed here was run against all 142 rows of the published
`dashboard/data/core.js` and reproduces every `mandate_term` value, with no
mismatches. That covers the part of the file that was changed. The rest of
`export.py` could not be executed here, because `data/airtable/*.json` is not in
this repository and the Airtable API is not reachable from the build environment.

## Two hand edits to `data/core.js` that must survive the next rebuild

Made directly in the built file on 5 November because the pipeline was not
runnable here. `export.py` as committed already produces the first; the second
comes from Airtable and will come back on the next `fetch_airtable.py`:

1. Term values and phrases for 25/23, 39/14, 42/26 and S-35/1 — in `TERM_OVERRIDES`.
2. `assess` removed from the action verbs of 52/28 and 58/17 — already written to
   Airtable, so a fresh fetch carries it.
