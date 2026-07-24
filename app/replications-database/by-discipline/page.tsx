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

type DisciplineRow = {
  discipline: string;
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

type SortKey = "discipline" | "replicatedPct" | "total";
type SortDir = "asc" | "desc";

const MIN_PAPERS = 20;
const MIN_PAPERS_SUBDISCIPLINE = 20;

const THRESHOLD_OPTIONS = [
  { value: 0.5, label: "50%" },
  { value: 0.75, label: "75%" },
  { value: 0.9, label: "90%" },
  { value: 1.0, label: "100%" },
];

function BarCell({ d, showCI }: { d: DisciplineRow; showCI: boolean }) {
  return (
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
        {showCI && (
          <>
            <div className="absolute bg-white" style={{ top: "calc(50% - 1px)", height: "2px", left: `${d.ciLow}%`, width: `${d.ciHigh - d.ciLow}%`, zIndex: 9 }} />
            <div className="absolute bg-white" style={{ top: "25%", height: "50%", width: "2px", left: `${d.ciLow}%`, zIndex: 10 }} />
            <div className="absolute bg-white" style={{ top: "25%", height: "50%", width: "2px", left: `${d.ciHigh}%`, zIndex: 10 }} />
          </>
        )}
        <div className="absolute top-0 h-full flex items-center text-base font-bold text-gray-900 dark:text-gray-100 pointer-events-none" style={{ left: `${d.replicatedPct}%`, transform: "translateX(-50%)", zIndex: 12, textShadow: "0 0 4px rgba(255,255,255,0.9), 0 0 8px rgba(255,255,255,0.7)" }}>{d.replicatedPct.toFixed(0)}%</div>
      </div>
    </td>
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

export default function ByDisciplinePage() {
  const [data, setData] = useState<FredResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(0.75);
  const [replicationType, setReplicationType] = useState("all");
  const [showCI, setShowCI] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [subSortKey, setSubSortKey] = useState<SortKey>("total");
  const [subSortDir, setSubSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "discipline" ? "asc" : "desc");
    }
  }

  function toggleSubSort(key: SortKey) {
    if (subSortKey === key) {
      setSubSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSubSortKey(key);
      setSubSortDir(key === "discipline" ? "asc" : "desc");
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

  // Distinct replication types present in the data, most common first.
  const replicationTypeOptions = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const r of data.rows) {
      const t = String(r.replication_type ?? "").trim();
      if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [data]);

  // Rows kept under the current replication-type filter. Filtering happens
  // before the paper-level roll-up, so a paper's success rate reflects only
  // the replication attempts of the selected type.
  const filteredRows = useMemo(() => {
    if (!data) return [];
    if (replicationType === "all") return data.rows;
    return data.rows.filter(
      (r) => String(r.replication_type ?? "").trim() === replicationType
    );
  }, [data, replicationType]);

  const byDiscipline: DisciplineRow[] = useMemo(() => {
    if (!data) return [];

    const papers = new Map<
      string,
      { disciplines: string[]; successCount: number; totalCount: number }
    >();

    for (const r of filteredRows) {
      const url = String(r.original_url ?? "").trim();
      const raw = String(r.discipline ?? "");
      const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
      const disciplines = parts.length > 0 ? parts : ["Unspecified"];
      const result = String(r.result ?? "").toLowerCase();

      if (!url) continue;

      const hasOutcome =
        result.includes("success") || result.includes("failure");
      if (!hasOutcome) continue;

      let paper = papers.get(url);
      if (!paper) {
        paper = { disciplines, successCount: 0, totalCount: 0 };
        papers.set(url, paper);
      }

      paper.totalCount++;
      if (result.includes("success")) {
        paper.successCount++;
      }
    }

    const disciplineCounts = new Map<
      string,
      { replicated: number; notReplicated: number }
    >();

    for (const paper of papers.values()) {
      if (paper.totalCount === 0) continue;

      const rate = paper.successCount / paper.totalCount;
      const isReplicated = rate >= threshold;

      for (const d of paper.disciplines) {
        const entry = disciplineCounts.get(d) || {
          replicated: 0,
          notReplicated: 0,
        };

        if (isReplicated) {
          entry.replicated++;
        } else {
          entry.notReplicated++;
        }

        disciplineCounts.set(d, entry);
      }
    }

    return Array.from(disciplineCounts.entries())
      .map(([discipline, v]) => {
        const total = v.replicated + v.notReplicated;
        const [ciLow, ciHigh] = wilsonCI(v.replicated, total);
        return {
          discipline,
          ...v,
          total,
          replicatedPct: total > 0 ? (v.replicated / total) * 100 : 0,
          notReplicatedPct: total > 0 ? (v.notReplicated / total) * 100 : 0,
          ciLow,
          ciHigh,
        };
      })
      .filter((d) => d.total >= MIN_PAPERS);
  }, [data, filteredRows, threshold]);

  const bySubdiscipline: DisciplineRow[] = useMemo(() => {
    if (!data) return [];

    const papers = new Map<
      string,
      { subdisciplines: string[]; successCount: number; totalCount: number }
    >();

    for (const r of filteredRows) {
      const url = String(r.original_url ?? "").trim();
      const raw = String(r.subdiscipline ?? "");
      const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
      const subdisciplines = parts.length > 0 ? parts : [];
      const result = String(r.result ?? "").toLowerCase();

      if (!url || subdisciplines.length === 0) continue;

      const hasOutcome =
        result.includes("success") || result.includes("failure");
      if (!hasOutcome) continue;

      let paper = papers.get(url);
      if (!paper) {
        paper = { subdisciplines, successCount: 0, totalCount: 0 };
        papers.set(url, paper);
      }

      paper.totalCount++;
      if (result.includes("success")) {
        paper.successCount++;
      }
    }

    const subdisciplineCounts = new Map<
      string,
      { replicated: number; notReplicated: number }
    >();

    for (const paper of papers.values()) {
      if (paper.totalCount === 0) continue;

      const rate = paper.successCount / paper.totalCount;
      const isReplicated = rate >= threshold;

      for (const s of paper.subdisciplines) {
        const entry = subdisciplineCounts.get(s) || {
          replicated: 0,
          notReplicated: 0,
        };

        if (isReplicated) {
          entry.replicated++;
        } else {
          entry.notReplicated++;
        }

        subdisciplineCounts.set(s, entry);
      }
    }

    return Array.from(subdisciplineCounts.entries())
      .map(([discipline, v]) => {
        const total = v.replicated + v.notReplicated;
        const [ciLow, ciHigh] = wilsonCI(v.replicated, total);
        return {
          discipline,
          ...v,
          total,
          replicatedPct: total > 0 ? (v.replicated / total) * 100 : 0,
          notReplicatedPct: total > 0 ? (v.notReplicated / total) * 100 : 0,
          ciLow,
          ciHigh,
        };
      })
      .filter((d) => d.total >= MIN_PAPERS_SUBDISCIPLINE);
  }, [data, filteredRows, threshold]);

  const sortedDisciplines = useMemo(() => {
    const sorted = [...byDiscipline].sort((a, b) => {
      if (sortKey === "discipline") return a.discipline.localeCompare(b.discipline);
      return a[sortKey] - b[sortKey];
    });
    if (sortDir === "desc") sorted.reverse();
    return sorted;
  }, [byDiscipline, sortKey, sortDir]);

  const sortedSubdisciplines = useMemo(() => {
    const sorted = [...bySubdiscipline].sort((a, b) => {
      if (subSortKey === "discipline") return a.discipline.localeCompare(b.discipline);
      return a[subSortKey] - b[subSortKey];
    });
    if (subSortDir === "desc") sorted.reverse();
    return sorted;
  }, [bySubdiscipline, subSortKey, subSortDir]);

  const totalPapers = byDiscipline.reduce((sum, d) => sum + d.total, 0);
  const totalSubdisciplinePapers = bySubdiscipline.reduce((sum, d) => sum + d.total, 0);

  if (loading) return <main className="min-h-screen px-6 py-10">Loading…</main>;
  if (error || !data) return <main className="min-h-screen px-6 py-10">Failed to load: {error || "No data"}</main>;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="pt-24 px-6 sm:px-8 md:px-12 lg:px-16 xl:px-24 py-10 flex-1">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Paper Replication Success by Discipline
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Paper-level analysis: a paper is considered &ldquo;replicated&rdquo; if at
              least {Math.round(threshold * 100)}% of its effect replications
              were successful. Only disciplines with {MIN_PAPERS}+ papers shown.
              Click a discipline name to view its entries in the database explorer.
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

            {/* Replication type selector */}
            <label className="flex items-center gap-2 text-sm">
              <span className="text-gray-600 dark:text-gray-300">
                Replication type{" "}
                <Link href="/docs/defining-replication" className="text-xs text-gray-500 dark:text-gray-400 underline hover:opacity-80">
                  (more info)
                </Link>
                :
              </span>
              <select
                value={replicationType}
                onChange={(e) => setReplicationType(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-sm max-w-md"
              >
                <option value="all">All types</option>
                {replicationTypeOptions.map((opt) => (
                  <option key={opt.name} value={opt.name}>
                    {opt.name} ({opt.count.toLocaleString()})
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showCI}
                onChange={(e) => setShowCI(e.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
              <span className="text-gray-600 dark:text-gray-300">
                Show Wilson 95% confidence intervals
              </span>
            </label>

            {/* Legend */}
            <div className="flex gap-6 text-sm">
              <span className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded" style={{ background: "#10b981" }} /> Replicated
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded" style={{ background: "#f87171" }} /> Not replicated
              </span>
            </div>

            <span className="text-sm text-gray-500 dark:text-gray-400">
              {byDiscipline.length} disciplines &middot; {totalPapers} papers
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <SortHeader label="Discipline" sortKey="discipline" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" />
                  <SortHeader label="Replication Success Rate" sortKey="replicatedPct" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="left" style={{ minWidth: "12rem" }} />
                  <SortHeader label="Total Papers" sortKey="total" currentKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {sortedDisciplines.map((d) => (
                  <tr key={d.discipline} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/40">
                    <td className="p-2 text-left">
                      <Link
                        href={`/replications-database?discipline=${encodeURIComponent(d.discipline)}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {d.discipline}
                      </Link>
                    </td>
                    <BarCell d={d} showCI={showCI} />
                    <td className="p-2 text-right tabular-nums">{d.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Subdiscipline section */}
        <div className="max-w-4xl mx-auto space-y-8 mt-16">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Paper Replication Success by Subdiscipline
            </h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Same paper-level methodology as above. Only subdisciplines with {MIN_PAPERS_SUBDISCIPLINE}+ papers shown.
              Click a subdiscipline name to view its entries in the database explorer.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex gap-6 text-sm">
              <span className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded" style={{ background: "#10b981" }} /> Replicated
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded" style={{ background: "#f87171" }} /> Not replicated
              </span>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {bySubdiscipline.length} subdisciplines &middot; {totalSubdisciplinePapers} papers
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <SortHeader label="Subdiscipline" sortKey="discipline" currentKey={subSortKey} dir={subSortDir} onSort={toggleSubSort} align="left" />
                  <SortHeader label="Replication Success Rate" sortKey="replicatedPct" currentKey={subSortKey} dir={subSortDir} onSort={toggleSubSort} align="left" style={{ minWidth: "12rem" }} />
                  <SortHeader label="Total Papers" sortKey="total" currentKey={subSortKey} dir={subSortDir} onSort={toggleSubSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {sortedSubdisciplines.map((d) => (
                  <tr key={d.discipline} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/40">
                    <td className="p-2 text-left">
                      <Link
                        href={`/replications-database?subdiscipline=${encodeURIComponent(d.discipline)}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {d.discipline}
                      </Link>
                    </td>
                    <BarCell d={d} showCI={showCI} />
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
