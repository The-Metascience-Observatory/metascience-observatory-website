# Long COVID local release — 23 September 2026

Release: `20260923-b15cd955376c`. Installed locally; not committed, pushed, published, or deployed.

## Result

- Treatment: 922 publications, including 26 without extracted outcomes.
- Prevention: 151 publications, including six without extracted outcomes.
- 1,068 unique publication IDs across both feeds; five occur in both. These are publications, not necessarily independent studies.
- 206 additions; 11 removals, each documented in `reconciliation.json`. Existing retained outcome arrays are byte-equivalent after JSON parsing: no published statistics replaced or lost.
- All ten targeted retries (two parse failures and eight no-text failures) succeeded using the existing readable sources, producing separate `retry_observational.jsonl`. Original extraction files were not overwritten. Seven other historical no-text records remain outside the release.
- 24 website-only olfactory records remain preserved in the ancillary olfactory dataset and explicitly held out of the refreshed main feeds pending source eligibility review; seven shared records remain included. See `olfactory_reconciliation.json`.
- The frozen run manifests identify 175 unique successful records with no outcomes (the earlier status reported 176). This count discrepancy is retained explicitly: 119 have exclusion/conflicting screening, 35 unresolved source eligibility/indication, and 21 are included with missing-outcomes labels. See `new_no_outcomes_audit.json`; broader inventory is `no_outcomes_audit.json`.

## Evidence policy and remaining work

Extraction success is not release eligibility. New publications require high-confidence human intervention eligibility, treatment/prevention routing, and an exact supporting source quote from the targeted Terra audit. This is AI-assisted adjudication, not independent human validation of every numerical result. Existing richer records are retained. Unknown metadata stays unknown. Manual exclusions and existing screening exclusions are respected; no manual inclusion file was present in the input snapshot.

`unresolved.json` has 1,970 held/excluded records: 1,299 excluded or conflicting screening; 660 unresolved source eligibility/indication; seven historical no-text failures; four missing study design. This is not a claim that 1,970 eligible studies still need extraction. These records remain outside the release.

The 20-paper pilot was compared conservatively by outcome/instrument, arm, timepoint, comparison, and exact source quotation. No automatic field additions passed all guards. Existing outcomes remain intact; conflicts remain in `pilot_reconciliation.json`. One manually checked cacao finding is added separately with its source quote: percentage fatigue reductions at three months. The pilot's conversion of percentages into raw score means/mean difference was rejected. Reported/calculated provenance and inequality p-values remain in article details. Non-exact p-values are not coerced into exact chart values.

Old pooled estimates are withheld pending compatibility review and recomputation. `bundle_changes.json` records this deliberate ancillary change. Individual-study results remain available. Verdicts are rebuilt conservatively from reconciled primary between-group results; unsupported direction/comparison/statistics are inconclusive.

## Interface

Both dashboards share the website-local article panel. Desktop uses an independently scrolling right panel; mobile uses a full-screen dialog. Article/reference selection, switching, Escape, close/focus restoration, loading and retry states are supported. Table state remains mounted. Publisher and Explorer are explicit links.

`GET /api/long-covid/article?id=<encoded-paper-id>&version=<release-version>` exposes the typed public projection only for included publications. It returns 400 for invalid input, 404 for unpublished IDs, and 409 for a stale release. Details are fetched on demand and cached by release and ID. No raw extraction download, local source path, local PDF, or Studio authenticated API is exposed.

## Reproduction and validation

Inputs and source excerpts are frozen under `inputs/`, with SHA-256 hashes in `input_hashes.json`. Adjudications, retry results, and the checked finding are hashed too. The builder does not require the live paper store after this snapshot.

From the pipeline repository:

```sh
python scripts/build_long_covid_release.py --release projects/long_covid/recovery_reports/release_20260923
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python -m pytest tests/test_long_covid_release.py -q -o addopts=''
```

Builder output is confined to staging; it does not install or deploy. Five reconciliation tests cover normalized/arm-specific identity, conservative merging, conflicts, quotes/timepoints, incomplete outcomes, overlap, exclusions, duplicates, and uncertain eligibility. Eleven website projection/publication unit tests passed. Three browser tests passed for desktop, mobile, keyboard/switching/close and request failure/retry. All 1,068 public article IDs returned matching details without private paths (`endpoint_validation.json`). TypeScript checks passed. Production build uses the repository's `npm run build:safe`; see `final_build.log`. Screenshots are in `artifacts/`.

PRISMA is reconciled to one search/release cohort, with explicit pending decisions and a note distinguishing historical extraction from current intervention eligibility. Main displayed counts equal the full feeds before user filters; extracted totals intentionally describe the larger historical pipeline cohort.

## Preview and rollback

Preview: http://127.0.0.1:3417/birds-eye-reviews/long-covid
Prevention: http://127.0.0.1:3417/birds-eye-reviews/long-covid/prevention

The preview reads the staged bundle, identical to the locally installed release. `preview.pid` / `preview.log` identify the preview process.

Staging: `/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/birds_eye_review_code/projects/long_covid/recovery_reports/release_20260923/bundle`
Installed data: `/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/metascience_observatory_website/data/birds_eye_reviews/long_covid`
Rollback snapshot: `/home/dan/Dropbox/AAA_METASCIENCE_OBSERVATORY/birds_eye_review_code/projects/long_covid/recovery_reports/release_20260923/website_before_install`

To roll back the data, copy the snapshot files over their matching installed filenames, restoring `last_updated.json` last. Preserve unrelated newly created ancillary files. UI/code rollback must target only this change; both repositories contain unrelated ongoing work. Concurrent INSPECT-SR changes and its ancillary dataset were preserved.
