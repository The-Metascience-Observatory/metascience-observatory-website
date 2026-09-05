# Long COVID publication and MEDLINE filters

The treatment dashboard and prevention view filter all charts and rows together. The screening table filters the complete server-side result set before pagination; screening decisions, original funnel/PRISMA totals, and the raw screening CSV are not changed. Filters default to All and use `medline` and `publication` URL parameters. Existing design/duration defaults remain.

## Status definitions

- `medline=yes`: resolved journal is in the pinned NLM **currentlyindexed** snapshot. This does not assert coverage at publication, article-level MEDLINE indexing, peer review, or study quality.
- `medline=no`: a resolved journal is absent from the complete current MEDLINE snapshot and its NLM record reports `N` or a blank indexing status. Also supported: a confirmed DOI journal identity with valid ISSNs, successful exact NLM searches returning no records, and no conflicting identity. The latter is explicitly recorded as an inference with sources.
- `medline=unknown`: unresolved identity, conflict, or failed/incomplete lookup. An unmatched journal name alone is insufficient to set `no`.
- `medline=not_applicable`: a preprint or a verified non-journal item such as a thesis or standalone conference proceedings.
- `journal_published`: confirmed journal publication, treated as peer-reviewed for this dashboard at the project owner's request. Individual peer review is not independently audited. Legacy `journal_unverified` and manually verified `peer_reviewed` records also pass this filter; the old `publication=peer_reviewed` URL remains supported.
- `preprint_only`: identified preprint, successful publication-link check, no verified journal counterpart known at that check. This is not proof of nonpublication.
- `linked_preprint`: a journal counterpart is verified but the displayed extraction is still the preprint. It passes neither peer-reviewed-only nor preprint-only.
- `other` and `unknown`, plus linked preprint extractions, appear under Other or unverified. A failed check does not establish preprint-only status.

The publication card uses a `[?]` tooltip for the requested definition. Intervention category (`intCat`) and intervention name (`intName`) narrow the full treatment dashboard together; the category dropdown also narrows intervention choices. Changing category clears the selected intervention name.

## Refresh (review-code repository)

```bash
python enrich_publications.py --project projects/long_covid --dashboard ../metascience_observatory_website/data/birds_eye_reviews/long_covid
python resolve_journal_catalog.py --project projects/long_covid --dashboard ../metascience_observatory_website/data/birds_eye_reviews/long_covid
python complete_journal_indexing.py --project projects/long_covid --dashboard ../metascience_observatory_website/data/birds_eye_reviews/long_covid
```

The first command reads source and website records, caches Crossref and preprint API lookups, and writes versioned DOI metadata. The second resolves remaining identities against the broader NLM Catalog and writes reconciled audit counts. The third checks remaining dashboard ISSNs, applies curated DOI identity corrections, and regenerates the final audit. All three support `--offline`; the first two support `--refresh` for renewed online lookups (enrichment also refreshes the current MEDLINE snapshot). Successful lookup dates are retained. Fetch errors never establish a negative classification. No external metadata lookups occur in normal website builds or browsers.

The existing `13_export_dashboard.py` copies enriched metadata and audit files when present. It does not trigger enrichment or alter the screening rules. This feature does not implicitly refresh the older website extraction/screening bundle. The local server reloads changed metadata on the next request (checked at most once per second); refresh the browser. Build a fresh deployment from the pinned files.

## Journal identity and aliases

Resolution uses exact ISSNs, then unique normalized canonical names and NLM abbreviations, then curated aliases. Normalization handles Unicode, case, whitespace, punctuation, HTML entities, and ampersands. It does not discard subtitles or parenthesized qualifiers. Title/identifier conflicts and ambiguous aliases remain unknown. Former titles and fuzzy matches are review candidates only.

The tracked defaults live in `publication_rules/long_covid/` in the review-code repository; project data files override those defaults when present.

`journal_aliases.json` maps a literal observed journal name to `{ "nlmId": "…", "source": "https://…", "rationale": "…" }`. Targets missing from the initial snapshot are deferred until the broader catalog stage fetches them. Use the NLM record/ISSN to verify expansions; never map an entire publisher or use an invented abbreviation expansion. The audit lists unresolved names, affected record counts, and candidate NLM IDs.

`indexing_overrides.json` stores DOI-specific journal identities or verified non-journal types with source, rationale, and check date. It is applied in the final completion stage; it does not infer review quality.

`J_Medline.txt` is used only to discover journal identifiers for further NLM lookup. Membership in that file is never interpreted as current MEDLINE indexing.

## Versions and reproducibility

Only explicit preprint/publication relations are grouped; title similarity is not enough. The published extraction replaces its preprint only if it exists in the same eligible dashboard feed. Missing published extractions leave the preprint visible with a link and warning. Distinct trial reports and arm splits remain separate; screening keeps both version records for audit.

Raw response caches remain in the review project's ignored `publication_cache/`. Durable NLM snapshots, alias/peer-review overrides, `publication_metadata.json`, and `publication_audit.json` live in its data directory. The website stores only the compact metadata and audit exports. Source paths and PDFs are not distributed.

## Checks

```bash
# review-code repository
python -m unittest test_publication_enrichment -v
# website
npm run test:publications
npm run test:publication-ui
npx tsc --noEmit
npm run build
```

## Snapshot coverage (2026-09-05)

The dashboard feed contains 775 distinct base DOIs: 350 resolve to currently indexed journals, 396 to not-currently-indexed journals, and 29 are not applicable (26 preprint records, three non-journal items). No dashboard base DOI has unresolved indexing. Broader screening feeds can still contain unknowns. There are 25 preprint-only records and one linked preprint. The journal-publication filter includes 737 records, including four with additional manual peer-review provenance. These are report counts, not independent trials; WHO/design filters narrow the initial display further. See `publication_audit.json` for source and website screening denominators.
