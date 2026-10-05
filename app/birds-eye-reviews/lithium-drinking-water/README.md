# Lithium in drinking water and obesity

Route: `/birds-eye-reviews/lithium-drinking-water`.

This companion to the clinical lithium review compares US county water summaries with age-adjusted obesity. It uses Recharts and existing site components; no new dependencies or API credentials are required.

## Refresh the data explicitly

First run the exporter in the lithium analysis repository:

```sh
.venv/bin/python scripts/export_dashboard.py
.venv/bin/python scripts/export_dashboard.py --check
```

Then from the website root, import that export:

```sh
python3 scripts/import-lithium-drinking-water.py /path/to/lithium_obesity_weight_gain
node_modules/.bin/tsx --test tests/lithium-drinking-water.test.ts
npm run build
```

Version the imported `data/birds_eye_reviews/lithium_drinking_water/` and `public/data/lithium-drinking-water/` files along with the page. Website builds require only Node. The import script preserves snapshot timestamps, source fingerprints, nulls, and full floating-point precision. The import timestamp does not replace the source export time.

## Interpretation and interactions

- Headline cards always display saved, unweighted UCMR5 detection-fraction results. Controls recalculate descriptive correlations in the charts only.
- Six charts show every supported measure except USGS all-well median in a two-column, three-row grid (one column on mobile). The state filter defaults to all states plus DC and applies to every chart; equal county weighting is the default. Obesity estimates remain at county level.
- Coverage thresholds are separate for EPA sample results, WQP monitoring sites, and USGS domestic-supply wells, each per county. Each chart uses its own count column. The default threshold is zero; all charts share the obesity axis.
- Population weighting changes statistics, not point size. Weighted Spearman is weighted Pearson on ordinary average ranks, matching the original Python analysis.
- Logarithmic measures use the saved log10 columns for plotting and Pearson. Tooltips and county profiles display original concentrations in µg/L.
- The download selected data button exports every county in the selected geography, including missing measurements and counties below coverage thresholds. CSV downloads include all six raw/log measures, counts, and per-measure meets-minimum flags. Point selection is linked across all eligible plots. The page has no county table. The download uses `/api/lithium-drinking-water/download` with state, samples, sites, and wells query parameters; coverage flags reflect those minimums.
- The SMTM section includes a shortcut that selects Texas, clears coverage minimums, and highlights Hidalgo (48215) and Bexar (48029) together. Weighting is preserved. Both county profiles appear above the charts; correlations still include every eligible Texas county. Point selection replaces the pair with one county, and Reset returns to all states plus DC.
- No inference intervals are estimated for filtered subsets. Regression output is offered as a saved CSV and uses HC3, not state-clustered errors.
- The Python references exercise national, Texas, filtered, weighted, and missing-outcome cases. Tests also cover tied ranks and constant inputs.

The county analysis is not a clinical review, an individual-level exposure estimate, or an exact replication of the SMTM city comparison. Original analysis outputs remain in the source repository.
