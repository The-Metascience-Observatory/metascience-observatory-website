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
};

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

    // Step 3: Filter to journals with MIN_PAPERS+ papers, compute percentages
    return Array.from(journalCounts.entries())
      .map(([journal, v]) => {
        const total = v.replicated + v.notReplicated;
        return {
          journal,
          ...v,
          total,
          replicatedPct: total > 0 ? (v.replicated / total) * 100 : 0,
          notReplicatedPct: total > 0 ? (v.notReplicated / total) * 100 : 0,
        };
      })
      .filter((d) => d.total >= MIN_PAPERS)
      .sort((a, b) => b.total - a.total);
  }, [data, threshold]);

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

          {/* Bars */}
          <div className="space-y-3">
            {byJournal.map((d) => (
              <div key={d.journal} className="flex items-center gap-3">
                <span className="text-sm italic text-right shrink-0" style={{ minWidth: "24rem" }}>
                  <Link
                    href={`/replications-database?original_journal_search=${encodeURIComponent(d.journal)}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {d.journal}
                  </Link>
                </span>
                <div className="flex-1 h-7 flex rounded overflow-hidden bg-gray-100 dark:bg-gray-800 text-xs font-medium text-white">
                  {d.replicatedPct > 0 && (
                    <div
                      className="h-full transition-all flex items-center justify-center overflow-hidden"
                      style={{
                        width: `${d.replicatedPct}%`,
                        background: "#10b981",
                      }}
                      title={`Replicated: ${d.replicated} (${d.replicatedPct.toFixed(1)}%)`}
                    >
                      {d.replicatedPct >= 10 &&
                        `${d.replicatedPct.toFixed(0)}%`}
                    </div>
                  )}
                  {d.notReplicatedPct > 0 && (
                    <div
                      className="h-full transition-all flex items-center justify-center overflow-hidden"
                      style={{
                        width: `${d.notReplicatedPct}%`,
                        background: "#f87171",
                      }}
                      title={`Not replicated: ${d.notReplicated} (${d.notReplicatedPct.toFixed(1)}%)`}
                    >
                      {d.notReplicatedPct >= 10 &&
                        `${d.notReplicatedPct.toFixed(0)}%`}
                    </div>
                  )}
                </div>
                <span className="w-20 text-sm text-right tabular-nums shrink-0">
                  {d.total} papers
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
