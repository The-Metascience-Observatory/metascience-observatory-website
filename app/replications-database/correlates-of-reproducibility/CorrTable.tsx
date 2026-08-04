"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CorrTableRow } from "./stats";
import { signStyle } from "./format";

/**
 * The correlation table with sortable r / Spearman ρ columns. Rows arrive
 * fully computed from the server component — this is presentation-only state.
 */

type SortKey = "default" | "pearsonR" | "spearmanR";
type SortDir = "asc" | "desc";

const fmt = (v: number, dp = 3) => (Number.isFinite(v) ? v.toFixed(dp) : "—");
const fmtCI = (lo: number, hi: number) =>
  Number.isFinite(lo) ? `[${fmt(lo)}, ${fmt(hi)}]` : "—";
const fmtN = (n: number) => n.toLocaleString("en-US");

function SortHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  column: Exclude<SortKey, "default">;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (column: Exclude<SortKey, "default">) => void;
}) {
  const active = sortKey === column;
  return (
    <th
      className="py-2 pr-3 font-medium text-right"
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="underline decoration-dotted hover:opacity-80 whitespace-nowrap"
        title={`Sort by ${label}`}
      >
        {label}
        <span className="inline-block w-3 text-muted-foreground">
          {active ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </span>
      </button>
    </th>
  );
}

export function CorrTable({ rows }: { rows: CorrTableRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Click a new column → sort ascending (most-negative correlation first);
  // click again → flip; the header order is restored via the third click.
  const onSort = (column: Exclude<SortKey, "default">) => {
    if (sortKey !== column) {
      setSortKey(column);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey("default");
    }
  };

  const sorted = useMemo(() => {
    if (sortKey === "default") return rows;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => dir * (a[sortKey] - b[sortKey]));
  }, [rows, sortKey, sortDir]);

  return (
    <div className="overflow-x-auto">
      <table className="text-sm border-collapse">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-2 pr-3 font-medium">Predictor</th>
            <th className="py-2 pr-3 font-medium">Pearson scale</th>
            <th className="py-2 pr-3 font-medium text-right">n (effects)</th>
            <th className="py-2 pr-3 font-medium text-right">Papers</th>
            <SortHeader label="r" column="pearsonR" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <th className="py-2 pr-3 font-medium">95% CI</th>
            <SortHeader
              label="Spearman ρ"
              column="spearmanR"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
            <th className="py-2 font-medium">95% CI</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.key} className="border-b border-border/60">
              <td className="py-1.5 pr-3">
                <Link href={row.href} className="underline decoration-dotted hover:opacity-80">
                  {row.label}
                </Link>
              </td>
              <td className="py-1.5 pr-3 text-muted-foreground">{row.transformLabel}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{fmtN(row.n)}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{fmtN(row.nClusters)}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums" style={signStyle(row.pearsonR)}>
                {fmt(row.pearsonR)}
              </td>
              <td className="py-1.5 pr-3 tabular-nums">{fmtCI(row.pearsonLo, row.pearsonHi)}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums" style={signStyle(row.spearmanR)}>
                {fmt(row.spearmanR)}
              </td>
              <td className="py-1.5 tabular-nums">{fmtCI(row.spearmanLo, row.spearmanHi)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
