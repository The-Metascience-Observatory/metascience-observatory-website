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

type AuthorRow = {
  author: string;
  replicated: number;
  notReplicated: number;
  total: number;
  replicatedPct: number;
  notReplicatedPct: number;
};

type SortKey = "author" | "replicatedPct" | "total";
type SortDir = "asc" | "desc";

const THRESHOLD_OPTIONS = [
  { value: 0.5, label: "50%" },
  { value: 0.75, label: "75%" },
  { value: 0.9, label: "90%" },
  { value: 1.0, label: "100%" },
];

const MIN_PAPERS_OPTIONS = [3, 5, 8, 10, 15];

export default function ByAuthorPage() {
  const [data, setData] = useState<FredResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(0.75);
  const [minPapers, setMinPapers] = useState(5);
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "author" ? "asc" : "desc");
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

  const byAuthor: AuthorRow[] = useMemo(() => {
    if (!data) return [];

    // Step 1: Group rows by original_url (paper), collect authors + results
    const papers = new Map<
      string,
      { authors: string[]; successCount: number; totalCount: number }
    >();

    for (const r of data.rows) {
      const url = String(r.original_url ?? "").trim();
      const authorsStr = String(r.original_authors ?? "").trim();
      const result = String(r.result ?? "").toLowerCase();

      if (!url || !authorsStr) continue;

      const hasOutcome =
        result.includes("success") || result.includes("failure");
      if (!hasOutcome) continue;

      const authorList = authorsStr
        .split(";")
        .map((a) => a.trim())
        .filter(Boolean);

      let paper = papers.get(url);
      if (!paper) {
        paper = { authors: authorList, successCount: 0, totalCount: 0 };
        papers.set(url, paper);
      }

      paper.totalCount++;
      if (result.includes("success")) {
        paper.successCount++;
      }
    }

    // Step 2: Classify each paper at the current threshold, attribute to authors
    const authorCounts = new Map<
      string,
      { replicated: number; notReplicated: number }
    >();

    for (const paper of papers.values()) {
      if (paper.totalCount === 0) continue;

      const rate = paper.successCount / paper.totalCount;
      const replicated = rate >= threshold;

      for (const author of paper.authors) {
        const entry = authorCounts.get(author) || {
          replicated: 0,
          notReplicated: 0,
        };

        if (replicated) {
          entry.replicated++;
        } else {
          entry.notReplicated++;
        }

        authorCounts.set(author, entry);
      }
    }

    // Step 3: Filter to authors with minPapers+ papers, compute percentages
    return Array.from(authorCounts.entries())
      .map(([author, v]) => {
        const total = v.replicated + v.notReplicated;
        return {
          author,
          ...v,
          total,
          replicatedPct: total > 0 ? (v.replicated / total) * 100 : 0,
          notReplicatedPct: total > 0 ? (v.notReplicated / total) * 100 : 0,
        };
      })
      .filter((d) => d.total >= minPapers);
  }, [data, threshold, minPapers]);

  const sortedAuthors = useMemo(() => {
    const sorted = [...byAuthor].sort((a, b) => {
      if (sortKey === "author") {
        return a.author.localeCompare(b.author);
      }
      return a[sortKey] - b[sortKey];
    });
    if (sortDir === "desc") sorted.reverse();
    return sorted;
  }, [byAuthor, sortKey, sortDir]);

  const totalPaperAuthorships = byAuthor.reduce((sum, d) => sum + d.total, 0);

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
              Paper Replication Success by Author
            </h1>
            <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">
              Experimental
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Paper-level analysis: a paper is considered &ldquo;replicated&rdquo; if at
              least {Math.round(threshold * 100)}% of its effect replications
              were successful. Each co-author on the original paper is credited.
              Only authors with {minPapers}+ original papers shown.
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

            {/* Min papers selector */}
            <label className="flex items-center gap-2 text-sm">
              <span className="text-gray-600 dark:text-gray-300">
                Min. papers:
              </span>
              <select
                value={minPapers}
                onChange={(e) => setMinPapers(Number(e.target.value))}
                className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-sm"
              >
                {MIN_PAPERS_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
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
              {byAuthor.length} authors &middot; {totalPaperAuthorships} paper-authorships
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <SortHeader label="Author" sortKey="author" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" />
                  <SortHeader label="Breakdown" sortKey="replicatedPct" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" style={{ minWidth: "12rem" }} />
                  <SortHeader label="Total Papers" sortKey="total" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {sortedAuthors.map((d) => {
                  return (
                    <tr key={d.author} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/40">
                      <td className="p-2 text-left">
                        <Link
                          href={`/replications-database?original_author_search=${encodeURIComponent(d.author)}`}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {d.author}
                        </Link>
                      </td>
                      <td className="p-2">
                        <div className="h-5 flex rounded overflow-hidden bg-gray-100 dark:bg-gray-800 text-xs font-medium text-white">
                          {d.replicatedPct > 0 && (
                            <div
                              className="h-full flex items-center justify-center overflow-hidden"
                              style={{ width: `${d.replicatedPct}%`, background: "#10b981" }}
                              title={`Replicated: ${d.replicated} (${d.replicatedPct.toFixed(1)}%)`}
                            >
                              {d.replicatedPct >= 15 && `${d.replicatedPct.toFixed(0)}%`}
                            </div>
                          )}
                          {d.notReplicatedPct > 0 && (
                            <div
                              className="h-full flex items-center justify-center overflow-hidden"
                              style={{ width: `${d.notReplicatedPct}%`, background: "#f87171" }}
                              title={`Not replicated: ${d.notReplicated} (${d.notReplicatedPct.toFixed(1)}%)`}
                            >
                              {d.notReplicatedPct >= 15 && `${d.notReplicatedPct.toFixed(0)}%`}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-right tabular-nums">{d.total}</td>
                    </tr>
                  );
                })}
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
