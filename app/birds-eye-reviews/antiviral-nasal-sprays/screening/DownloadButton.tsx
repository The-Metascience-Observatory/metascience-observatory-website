"use client";

import { ScreeningRow } from "./ScreeningTable";

const COLUMNS: { key: keyof ScreeningRow; header: string }[] = [
  { key: "doi", header: "doi" },
  { key: "spray_type", header: "spray_type" },
  { key: "is_relevant", header: "is_relevant" },
  { key: "studies_treatment", header: "studies_treatment" },
  { key: "trial_type", header: "trial_type" },
  { key: "is_excluded", header: "is_excluded" },
  { key: "exclusion_reason", header: "exclusion_reason" },
  { key: "topics", header: "topics" },
  { key: "title", header: "paper_title" },
  { key: "authors", header: "paper_authors" },
  { key: "journal", header: "paper_journal" },
  { key: "year", header: "paper_year" },
];

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function DownloadButton({ rows }: { rows: ScreeningRow[] }) {
  const handleDownload = () => {
    const header = COLUMNS.map((c) => c.header).join(",");
    const lines = rows.map((row) =>
      COLUMNS.map((c) => {
        const v = row[c.key];
        return csvCell(Array.isArray(v) ? v.join(" | ") : String(v ?? ""));
      }).join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "antiviral_nasal_sprays_screening.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleDownload}
      className="text-blue-600 hover:text-blue-700 text-sm underline"
    >
      Download CSV
    </button>
  );
}
