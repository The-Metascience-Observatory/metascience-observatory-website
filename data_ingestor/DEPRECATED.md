# DEPRECATED — moved to ../../mo_pipeline

As of 2026-07-13, the ingestion code here was consolidated into
[`../../mo_pipeline/`](../../mo_pipeline/) (the unified MO replication pipeline).

- `data_ingestor.py`, the PyQt GUIs (`add_entry_gui.py`, `duplicate_review_gui.py`),
  `plot_database_growth.py`, and the author/URL/journal helper scripts →
  `mo_pipeline/mo_pipeline/ingest/`.
- `api_cache.json` → `mo_pipeline/mo_pipeline/ingest/`.

**Unchanged:** ingest still reads/writes the website database in
`metascience_observatory_website/data/` (`replications_database_*.csv`,
`version_history.txt`, growth PNGs) — the site serves those. That path is now
`config.WEBSITE_DATA_DIR` in `mo_pipeline`.

Run ingestion from the new home:

```bash
python -m mo_pipeline.ingest.data_ingestor collated_results_X.csv --no-gui
```

An archival snapshot of this directory's git repo was committed before the move
(the repo's remote pointed at the wrong project and its history is not carried
forward). The code files here are frozen and will be removed after a few weeks of
successful runs from `mo_pipeline/`.
