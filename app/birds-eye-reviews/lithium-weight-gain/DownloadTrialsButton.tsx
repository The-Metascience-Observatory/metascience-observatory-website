"use client";

import { Download } from "lucide-react";
import { TrialRow } from "./ResultsTable";

/** Every column the trials table carries, in reading order. */
const COLUMNS: { key: keyof TrialRow; header: string }[] = [
  { key: "doi", header: "doi" },
  { key: "title", header: "paper_title" },
  { key: "authors", header: "paper_authors" },
  { key: "journal", header: "paper_journal" },
  { key: "year", header: "paper_year" },
  { key: "volume", header: "paper_volume" },
  { key: "issue", header: "paper_issue" },
  { key: "pages", header: "paper_pages" },
  { key: "url", header: "paper_url" },
  { key: "design", header: "design" },
  { key: "interventions", header: "interventions" },
  { key: "countries", header: "countries" },
  { key: "setting", header: "setting" },
  { key: "settingText", header: "setting_text" },
  { key: "diagnosis", header: "diagnosis" },
  { key: "diagnosisText", header: "diagnosis_text" },
  { key: "n", header: "n" },
  { key: "rob", header: "risk_of_bias" },
  { key: "exposureStratum", header: "exposure_stratum" },
  { key: "elementalMgPerDay", header: "elemental_mg_per_day" },
  { key: "saltAssumed", header: "salt_assumed_carbonate" },
  { key: "serumMmolL", header: "serum_mmol_L" },
  { key: "serumBand", header: "serum_band" },
  { key: "durationWeeks", header: "duration_weeks" },
  { key: "outcomeName", header: "weight_outcome" },
  { key: "weightMetric", header: "weight_metric" },
  { key: "effMeasure", header: "effect_measure" },
  { key: "effVal", header: "effect_value" },
  { key: "ciLo", header: "ci_95_low" },
  { key: "ciHi", header: "ci_95_high" },
  { key: "pVal", header: "p_value" },
  { key: "pText", header: "p_value_text" },
  { key: "seFromP", header: "se_from_p_value" },
  { key: "isPoolable", header: "is_poolable" },
  { key: "summary", header: "summary" },
];

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Downloads every trial in the table — all rows, ignoring the filters. */
export function DownloadTrialsButton({ rows }: { rows: TrialRow[] }) {
  const handleDownload = () => {
    const header = COLUMNS.map((c) => c.header).join(",");
    const lines = rows.map((row) =>
      COLUMNS.map((c) => {
        const v = row[c.key];
        return csvCell(Array.isArray(v) ? v.join(" | ") : v == null ? "" : String(v));
      }).join(","),
    );
    // BOM so Excel reads the UTF-8 (en dashes, accented author names) correctly.
    const blob = new Blob(["﻿" + [header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lithium_weight_gain_trials.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleDownload}
      className="mb-3 inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
    >
      <Download size={14} />
      Download CSV (all {rows.length} trials)
    </button>
  );
}
