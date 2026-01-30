# PDF Processing Pipeline — Context for AI Coding Agent

## 1. Project Mission

The **Metascience Observatory** (metascience-observatory.org) is building a public database of experimental replications across all scientific fields. The core question: *"Is science healthy? How do rigor and reproducibility vary across fields, journals, and institutions?"*

The project uses AI to analyze scientific papers at scale, classifying replication outcomes into four categories:
- **Successful** — statistically significant evidence the effect exists
- **Inconclusive** — cannot determine significance
- **Unsuccessful** — statistically significant evidence the effect does NOT exist
- **Reversal** — significant evidence for the opposite effect

The unit of analysis is individual *effects* (not entire papers). Each record in the database pairs an original study with a replication attempt, capturing effect sizes normalized to Pearson's r for cross-study comparison.

**Current database**: ~1,091 replication records across psychology, economics, biology, neuroscience, materials science, and more.

---

## 2. Pipeline Goal

Build a Python pipeline that processes academic PDFs into structured formats for downstream data extraction:

```
PDF file (input)
    → GROBID (PDF → TEI XML with semantic markup)
    → Markdown (clean, readable, structured text)
    → Claude API (LLM-based structured data extraction)
    → JSON (statistical results, metadata, methodology)
```

### Stage 1: PDF → Markdown via GROBID

**GROBID** (https://github.com/kermitt2/grobid) is the chosen PDF processing tool. It is a machine learning library that extracts structured data from scholarly documents, outputting TEI XML with rich semantic markup.

GROBID can be run as a local service (Docker recommended):
```bash
docker run --rm --init --ulimit core=0 -p 8070:8070 lfoppiano/grobid:0.8.1
```

The Python client library is `grobid_client_python`.

**Task**: Write code that:
1. Sends PDFs to a running GROBID instance
2. Parses the returned TEI XML
3. Converts to clean Markdown preserving:
   - Document structure (title, abstract, sections, subsections)
   - Tables (as Markdown tables)
   - Figure/table captions
   - Equations (LaTeX notation where possible)
   - In-text citations and reference list
   - Author names, affiliations, journal, year, DOI

### Stage 2: Markdown → Structured JSON via Claude API

Use the **Anthropic Claude API** to extract structured data from the Markdown output.

**Task**: Write code that:
1. Sends the paper Markdown to Claude with a carefully designed prompt
2. Extracts a JSON object containing:

```json
{
  "metadata": {
    "title": "",
    "authors": [],
    "journal": "",
    "year": null,
    "doi": "",
    "abstract": ""
  },
  "statistical_results": [
    {
      "description": "Brief description of the effect tested",
      "effect_size_value": null,
      "effect_size_type": "d | r | eta_sq | f | f2 | or | R2 | phi | ...",
      "p_value": null,
      "p_value_type": "exact | less_than | ns",
      "p_value_tails": "one | two",
      "confidence_interval_95": "",
      "sample_size": null,
      "test_statistic": "e.g. t(45) = 2.31, F(1, 98) = 4.56, chi2(1, N=200) = 5.12"
    }
  ],
  "methodology": {
    "study_design": "",
    "sample_description": "",
    "key_variables": []
  },
  "claims": [
    "One-sentence summary of each key claim or hypothesis tested"
  ]
}
```

**Effect size types the system handles** (see `effect_size_conversions.md` for formulas):
- Cohen's d, Hedges' g
- Pearson's r, Spearman's r, Phi
- Eta-squared, Partial eta-squared
- Cohen's f, Cohen's f²
- Odds ratio (OR), Log odds ratio
- R-squared
- Beta (standardized/unstandardized)
- Test statistics in APA format: `t(df)=value`, `F(df1,df2)=value`, `z=value`, `chi2(df,N)=value`

---

## 3. Existing Infrastructure

### Key files in `data_ingestor/`:

| File | What it does |
|------|-------------|
| `data_ingestor.py` | Main ETL pipeline (914 lines). Reads CSV, enriches metadata via APIs, converts effect sizes, generates citations, detects duplicates, merges into database. |
| `fetch_pdf_from_doi.py` | Retrieves PDFs given a DOI. 8-step fallback: OSF → OpenAlex → Semantic Scholar → Unpaywall → Crossref → Europe PMC → DuckDuckGo → Sci-Hub. |
| `fetch_metadata_from_doi.py` | Enriches paper metadata from DOI using 6 APIs (OpenAlex, DataCite, Crossref, Unpaywall, Europe PMC, Semantic Scholar). |
| `fetch_metadata_from_title.py` | Finds DOI from paper title, then enriches metadata. |
| `generate_citation_html_for_website.py` | Generates formatted HTML citations for the website frontend. |
| `effect_size_conversions.md` | Reference doc with all effect size conversion formulas (to Pearson's r). |
| `effect_size_transformations.R` | R implementation of effect size conversions. |
| `replication_outcomes.R` | R implementation of outcome classification logic. |
| `data_dictionary.csv` | Schema definition — 44 columns with types, required flags, descriptions. |
| `ground_truth.csv` | 887 validated replication records. Has `original_pdf_exists` and `replication_pdf_exists` flags — use this for testing. |

### Database schema (key columns from `data_dictionary.csv`):

**Per study (original_ and replication_ prefixed):**
- `_url` — DOI link
- `_authors`, `_title`, `_journal`, `_volume`, `_issue`, `_pages`, `_year`
- `_n` — sample size
- `_es` — effect size value
- `_es_type` — effect size metric (d, r, etasq, f, f2, or, etc.)
- `_es_r` — normalized effect size (converted to Pearson's r)
- `_es_95_CI` — 95% confidence interval
- `_p_value`, `_p_value_type`, `_p_value_tails`
- `_citation_html` — auto-generated HTML citation

**Classification:**
- `description` — one-sentence summary of effect being tested
- `result` — success / failure / inconclusive / reversal
- `discipline` — field (lowercase)
- `tags` — semicolon-separated search terms
- `openalex_field`, `openalex_subfield` — OpenAlex taxonomy

---

## 4. Integration Points

The new PDF processing component should:

1. **Accept input from `fetch_pdf_from_doi.py`** — PDFs are already being fetched. The new code processes them after retrieval.

2. **Output JSON that maps to the database schema** — The extracted `statistical_results` fields should align with the `_es`, `_es_type`, `_p_value`, `_n`, etc. columns.

3. **Be callable from `data_ingestor.py`** — Design as importable Python functions:
   ```python
   def process_pdf_to_markdown(pdf_path: str, grobid_url: str = "http://localhost:8070") -> str:
       """Convert PDF to Markdown via GROBID."""
       ...

   def extract_data_from_markdown(markdown: str) -> dict:
       """Extract structured data from paper Markdown using Claude API."""
       ...

   def process_pdf(pdf_path: str) -> dict:
       """Full pipeline: PDF → Markdown → JSON."""
       ...
   ```

4. **Use `ground_truth.csv` for validation** — Run the pipeline on papers where `original_pdf_exists == "yes"` and compare extracted effect sizes / p-values against the human-validated values.

---

## 5. Technical Requirements

- **Python 3.10+**
- **GROBID** running as Docker service on port 8070
- **Dependencies**: `grobid_client_python`, `anthropic`, `lxml` or `beautifulsoup4` (for TEI XML parsing)
- **Anthropic API key** via environment variable `ANTHROPIC_API_KEY`
- **Error handling**: Papers vary wildly in format. Handle gracefully: missing sections, no statistical results, non-English papers, supplementary-only stats.
- **Rate limiting**: Respect Claude API rate limits. Add configurable delays.
- **Logging**: Log processing status per paper (success, partial extraction, failure with reason).

---

## 6. Suggested File Structure

```
data_ingestor/
├── pdf_processing/
│   ├── __init__.py
│   ├── grobid_client.py      # GROBID interaction + TEI XML → Markdown
│   ├── llm_extractor.py      # Claude API structured extraction
│   ├── pipeline.py            # Orchestrates full PDF → JSON flow
│   ├── prompts.py             # Claude prompt templates
│   └── schemas.py             # Pydantic models for extracted data
├── data_ingestor.py           # (existing) — will import from pdf_processing/
├── fetch_pdf_from_doi.py      # (existing)
└── ...
```

---

## 7. Testing Strategy

1. Pick 10-20 papers from `ground_truth.csv` where PDFs exist
2. Run full pipeline: PDF → Markdown → JSON
3. Compare extracted values against ground truth columns (`_es`, `_es_type`, `_p_value`, `_n`)
4. Report accuracy metrics (exact match rate, within-tolerance rate for numerical values)
