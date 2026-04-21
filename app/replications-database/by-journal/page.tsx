"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

type AnyRecord = Record<string, unknown>;

type FredResponse = {
  columns: string[];
  rows: AnyRecord[];
};

type JournalRow = {
  journal: string;
  replicated: number;
  notReplicated: number;
  total: number;
  replicatedPct: number;
  notReplicatedPct: number;
  ciLow: number;
  ciHigh: number;
};

// Wilson score 95% CI for a proportion k/n
function wilsonCI(k: number, n: number): [number, number] {
  if (n === 0) return [0, 100];
  const z = 1.96;
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, center - margin) * 100, Math.min(1, center + margin) * 100];
}

type SortKey = "journal" | "replicatedPct" | "total";
type SortDir = "asc" | "desc";

const THRESHOLD_OPTIONS = [
  { value: 0.5, label: "50%" },
  { value: 0.75, label: "75%" },
  { value: 0.9, label: "90%" },
  { value: 1.0, label: "100%" },
];

const MIN_PAPERS = 15;

export default function ByJournalPage() {
  const [data, setData] = useState<FredResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(0.75);
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "journal" ? "asc" : "desc");
    }
  }

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/fred", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as FredResponse;
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const byJournal: JournalRow[] = useMemo(() => {
    if (!data) return [];

    // Step 1: Group rows by original_url (paper), collect journal + results
    const papers = new Map<
      string,
      { journal: string; successCount: number; totalCount: number }
    >();

    for (const r of data.rows) {
      const url = String(r.original_url ?? "").trim();
      const journal = String(r.original_journal ?? "").trim();
      const result = String(r.result ?? "").toLowerCase();

      if (!url || !journal) continue;

      const hasOutcome =
        result.includes("success") || result.includes("failure");
      if (!hasOutcome) continue;

      let paper = papers.get(url);
      if (!paper) {
        paper = { journal, successCount: 0, totalCount: 0 };
        papers.set(url, paper);
      }

      paper.totalCount++;
      if (result.includes("success")) {
        paper.successCount++;
      }
    }

    // Step 2: Classify each paper at the current threshold
    const journalCounts = new Map<
      string,
      { replicated: number; notReplicated: number }
    >();

    for (const paper of papers.values()) {
      if (paper.totalCount === 0) continue;

      const entry = journalCounts.get(paper.journal) || {
        replicated: 0,
        notReplicated: 0,
      };

      const rate = paper.successCount / paper.totalCount;
      if (rate >= threshold) {
        entry.replicated++;
      } else {
        entry.notReplicated++;
      }

      journalCounts.set(paper.journal, entry);
    }

    // Step 3: Filter to journals with MIN_PAPERS+ papers, compute percentages + CI
    return Array.from(journalCounts.entries())
      .map(([journal, v]) => {
        const total = v.replicated + v.notReplicated;
        const [ciLow, ciHigh] = wilsonCI(v.replicated, total);
        return {
          journal,
          ...v,
          total,
          replicatedPct: total > 0 ? (v.replicated / total) * 100 : 0,
          notReplicatedPct: total > 0 ? (v.notReplicated / total) * 100 : 0,
          ciLow,
          ciHigh,
        };
      })
      .filter((d) => d.total >= MIN_PAPERS);
  }, [data, threshold]);

  const sortedJournals = useMemo(() => {
    const sorted = [...byJournal].sort((a, b) => {
      if (sortKey === "journal") return a.journal.localeCompare(b.journal);
      return a[sortKey] - b[sortKey];
    });
    if (sortDir === "desc") sorted.reverse();
    return sorted;
  }, [byJournal, sortKey, sortDir]);

  const totalPapers = byJournal.reduce((sum, d) => sum + d.total, 0);

  if (loading)
    return <main className="min-h-screen px-6 py-10">Loading…</main>;
  if (error || !data)
    return (
      <main className="min-h-screen px-6 py-10">
        Failed to load: {error || "No data"}
      </main>
    );

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="pt-24 px-6 sm:px-8 md:px-12 lg:px-16 xl:px-24 py-10 flex-1">
        <div className="max-w-5xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Paper Replication Success by Journal
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Paper-level analysis: a paper is considered &ldquo;replicated&rdquo; if at
              least {Math.round(threshold * 100)}% of its effect replications
              were successful. Only journals with {MIN_PAPERS}+ original papers
              shown. Click a journal name to view corresponding entries in the database explorer.
            </p>
          </div>

          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-6">
            {/* Threshold selector */}
            <label className="flex items-center gap-2 text-sm">
              <span className="text-gray-600 dark:text-gray-300">
                Success threshold:
              </span>
              <select
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-sm"
              >
                {THRESHOLD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            {/* Legend */}
            <div className="flex gap-6 text-sm">
              <span className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded"
                  style={{ background: "#10b981" }}
                />{" "}
                Replicated
              </span>
              <span className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded"
                  style={{ background: "#f87171" }}
                />{" "}
                Not replicated
              </span>
            </div>

            <span className="text-sm text-gray-500 dark:text-gray-400">
              {byJournal.length} journals &middot; {totalPapers} papers
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <SortHeader label="Journal" sortKey="journal" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" />
                  <SortHeader label="Replication Success Rate" sortKey="replicatedPct" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" style={{ minWidth: "12rem" }} />
                  <SortHeader label="Total Papers" sortKey="total" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {sortedJournals.map((d) => (
                  <tr key={d.journal} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/40">
                    <td className="p-2 text-left italic">
                      <Link
                        href={`/replications-database?original_journal_search=${encodeURIComponent(d.journal)}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {d.journal}
                      </Link>
                    </td>
                    <td className="p-2">
                      <div
                        className="relative h-7"
                        title={`Replicated: ${d.replicated}/${d.total} (${d.replicatedPct.toFixed(1)}%) · 95% CI: [${d.ciLow.toFixed(1)}%–${d.ciHigh.toFixed(1)}%]`}
                      >
                        <div className="absolute inset-0 rounded overflow-hidden">
                          <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800" />
                          {d.replicatedPct > 0 && (
                            <div className="absolute top-0 left-0 h-full" style={{ width: `${d.replicatedPct}%`, background: "#10b981" }} />
                          )}
                          {d.notReplicatedPct > 0 && (
                            <div className="absolute top-0 h-full" style={{ left: `${d.replicatedPct}%`, width: `${d.notReplicatedPct}%`, background: "#f87171" }} />
                          )}
                        </div>
                        <div className="absolute bg-white" style={{ top: "calc(50% - 1px)", height: "2px", left: `${d.ciLow}%`, width: `${d.ciHigh - d.ciLow}%`, zIndex: 9 }} />
                        <div className="absolute bg-white" style={{ top: "25%", height: "50%", width: "2px", left: `${d.ciLow}%`, zIndex: 10 }} />
                        <div className="absolute bg-white" style={{ top: "25%", height: "50%", width: "2px", left: `${d.ciHigh}%`, zIndex: 10 }} />
                        <div className="absolute top-0 h-full flex items-center text-base font-bold text-gray-900 dark:text-gray-100 pointer-events-none" style={{ left: `${d.replicatedPct}%`, transform: "translateX(-50%)", zIndex: 12, textShadow: "0 0 4px rgba(255,255,255,0.9), 0 0 8px rgba(255,255,255,0.7)" }}>{d.replicatedPct.toFixed(0)}%</div>
                      </div>
                    </td>
                    <td className="p-2 text-right tabular-nums">{d.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function SortHeader({ label, sortKey: key, currentKey, dir, onSort, align, style }: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  align: "left" | "right";
  style?: React.CSSProperties;
}) {
  const active = key === currentKey;
  return (
    <th
      className={`p-2 font-medium text-gray-600 dark:text-gray-300 cursor-pointer select-none hover:text-gray-900 dark:hover:text-white whitespace-nowrap ${align === "right" ? "text-right" : "text-left"}`}
      onClick={() => onSort(key)}
      style={style}
    >
      {label}{" "}
      <span className={`inline-block w-3 ${active ? "opacity-100" : "opacity-30"}`}>
        {active ? (dir === "asc" ? "\u25B2" : "\u25BC") : "\u25BC"}
      </span>
    </th>
  );
}
