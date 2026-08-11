# Data Ingestor

An ETL (Extract, Transform, Load) pipeline for ingesting, enriching, and standardizing replication experiment data into the master replications database.

> **This directory is the canonical home of the ingestion code.** It was
> briefly consolidated into `mo_pipeline` (2026-07-13, see the old
> `DEPRECATED.md`), but development continued here and the consolidation was
> reversed on 2026-08-09: `mo_pipeline` now covers stages 1–8
> (search → … → extract/collate) only, and ingestion is run manually from
> here. `tag_disciplines.py` imports the topic-ontology helpers from the
> installed `mo_pipeline` package so discipline labels stay in sync with
> extraction.

## Overview

The data ingestor takes CSV files containing replication study data, automatically fetches missing metadata from academic APIs, converts effect sizes to a standardized format (Pearson's r), generates HTML citations, and appends new entries to the master database.

## Pipeline Steps

```
Input CSV
  → [1] Metadata Enrichment (fetch authors, titles, journals via DOI/title lookup)
  → [2] Effect Size Conversion (convert 20+ effect size types to Pearson's r)
  → [3] Citation Generation (APA-style HTML citations with DOI links)
  → [4] Column Filtering (validate against data_dictionary.csv)
  → [5] Duplicate Detection (skip entries already in the database)
  → [6] Save & Version (timestamped CSV export + version_history.txt update)
```

## Usage

```bash
python data_ingestor.py <input_csv> [--skip-api-calls] [--discipline "discipline_name"]
```

- `input_csv` — CSV file with new replication data to ingest
- `--skip-api-calls` — Skip metadata enrichment (faster, useful for re-processing)
- `--discipline` — Apply a discipline label to all rows (e.g., `"cancer biology"`)

## Key Files

| File | Description |
|------|-------------|
| `data_ingestor.py` | Main orchestration script; runs the 6-step pipeline, handles effect size conversions and validation |
| `fetch_metadata_from_doi.py` | Fetches metadata (authors, title, journal, year, etc.) from a DOI using a cascade of 6 APIs |
| `fetch_metadata_from_title.py` | Fetches metadata starting from a paper title when DOI is unavailable |
| `generate_citation_html_for_website.py` | Formats bibliographic data into APA-style HTML citations with clickable DOI links |
| `fetch_pdf_from_doi.py` | Downloads full-text PDFs using 8+ fallback sources |
| `pull_pdfs.ipynb` | Notebook for batch PDF downloading |
| `make_ground_truth_dataset.ipynb` | Notebook for creating a validated/curated subset of replications |
| `data_dictionary.csv` | Schema definition for all 42 database columns |
| `version_history.txt` | Tracks all database versions |

## External APIs

Metadata is fetched progressively—the system tries each API in order and stops when all fields are filled:

1. **OpenAlex** (`api.openalex.org`)
2. **Crossref** (`api.crossref.org`)
3. **DataCite** (`api.datacite.org`)
4. **Unpaywall** (`api.unpaywall.org`)
5. **Europe PMC** (`ebi.ac.uk/europepmc`)
6. **Semantic Scholar** (`api.semanticscholar.org`)

PDF retrieval additionally uses OSF, DuckDuckGo search, direct DOI resolution, and Sci-Hub as fallbacks.

## Effect Size Conversions

The pipeline normalizes effect sizes to Pearson's r from 20+ input types including Cohen's d, odds ratios, eta-squared, Cohen's f/f², R², and parsed test statistics (t, F, z, χ²). Conversion functions are defined in `data_ingestor.py`.

## Duplicate Detection

New rows are checked against the master database using a composite key of `original_url` + `replication_url` + `description`. Duplicates are skipped during ingestion.

## Output

Each run produces a timestamped CSV file (`replications_database_YYYY_MM_DD_HHMMSS.csv`) in the `../data/` directory and updates `version_history.txt`.

## Validation Gate (STEP 4v)

Every incoming row is checked against `codebook_rules.json` before the
duplicate scan. The legal range of an effect size is conditional on its
declared type (a correlation must lie in [−1, 1], an odds ratio is strictly
positive, a variance share in [0, 1]); p-values must lie in [0, 1]; sample
sizes must be positive numbers; and confidence intervals must be ordered and
contain their own estimate. Rules and severities live in
`validation_rules.py`, which can also audit any export standalone:

```bash
python validation_rules.py ../data/replications_database_<version>.csv [--out violations.csv]
```

Rows failing a **reject**-severity rule are not ingested. With the GUI
(`quarantine_review_gui.py`) each failing row can be fixed, have exactly the
offending cells blanked, or be rejected outright — and edits are re-validated
before they are accepted. With `--no-gui`, failing rows are written to
`quarantine_<timestamp>.csv` (with a `_violations` column) for repair and
re-ingestion. **Flag**-severity findings (p exactly 0, |d| > 6, enum drift…)
are printed and logged but do not block.

Every quarantine decision is appended to `../data/quarantine_log.jsonl`:
timestamp, input file, violations, the row's original values, the values as
ingested (blanked cells included), and a free-text comment.
