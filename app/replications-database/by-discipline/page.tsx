"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";
import { RetentionSwarm } from "./RetentionSwarm";
import { classifyReportedResult, toBinary } from "@/lib/replicationOutcome";

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

type SubRow = Omit<DisciplineRow, "discipline"> & { subdiscipline: string };

type DisciplineNode = DisciplineRow & { subs: SubRow[] };

type BarStats = Pick<
  DisciplineRow,
  "replicated" | "notReplicated" | "total" | "replicatedPct" | "notReplicatedPct" | "ciLow" | "ciHigh"
>;

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
const SUB_MIN_PAPERS_OPTIONS = [5, 10, 20];

const REPLICATED_COLOR = "#10b981";
const NOT_REPLICATED_COLOR = "#f87171";
// Lighter shades for the subdiscipline child rows
const REPLICATED_COLOR_SUB = "#6ee7b7";
const NOT_REPLICATED_COLOR_SUB = "#fca5a5";

const THRESHOLD_OPTIONS = [
  { value: 0.5, label: "50%" },
  { value: 0.75, label: "75%" },
  { value: 0.9, label: "90%" },
  { value: 1.0, label: "100%" },
];

function BarCell({ d, showCI, compact }: { d: BarStats; showCI: boolean; compact?: boolean }) {
  return (
    <td className={compact ? "p-1" : "p-2"}>
      <div
        className={compact ? "relative h-5" : "relative h-7"}
        title={`Replicated: ${d.replicated}/${d.total} (${d.replicatedPct.toFixed(1)}%) · 95% CI: [${d.ciLow.toFixed(1)}%–${d.ciHigh.toFixed(1)}%]`}
      >
        <div className="absolute inset-0 rounded overflow-hidden">
          <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800" />
          {d.replicatedPct > 0 && (
            <div className="absolute top-0 left-0 h-full" style={{ width: `${d.replicatedPct}%`, background: compact ? REPLICATED_COLOR_SUB : REPLICATED_COLOR }} />
          )}
          {d.notReplicatedPct > 0 && (
            <div className="absolute top-0 h-full" style={{ left: `${d.replicatedPct}%`, width: `${d.notReplicatedPct}%`, background: compact ? NOT_REPLICATED_COLOR_SUB : NOT_REPLICATED_COLOR }} />
          )}
        </div>
        {showCI && (
          <>
            <div className="absolute bg-white" style={{ top: "calc(50% - 1px)", height: "2px", left: `${d.ciLow}%`, width: `${d.ciHigh - d.ciLow}%`, zIndex: 9 }} />
            <div className="absolute bg-white" style={{ top: "25%", height: "50%", width: "2px", left: `${d.ciLow}%`, zIndex: 10 }} />
            <div className="absolute bg-white" style={{ top: "25%", height: "50%", width: "2px", left: `${d.ciHigh}%`, zIndex: 10 }} />
          </>
        )}
        <div className={`absolute top-0 h-full flex items-center ${compact ? "text-xs font-semibold" : "text-base font-bold"} text-gray-900 dark:text-gray-100 pointer-events-none`} style={{ left: `${d.replicatedPct}%`, transform: "translateX(-50%)", zIndex: 12, textShadow: "0 0 4px rgba(255,255,255,0.9), 0 0 8px rgba(255,255,255,0.7)" }}>{d.replicatedPct.toFixed(0)}%</div>
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
  // Empty set = all replication types (the MultiSelectDropdown convention).
  const [replicationTypes, setReplicationTypes] = useState<Set<string>>(new Set());
  const [showCI, setShowCI] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [minSubPapers, setMinSubPapers] = useState(20);
  const [nestSubs, setNestSubs] = useState(true);
  // Disciplines whose subdiscipline rows are hidden. Empty = all expanded.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "discipline" ? "asc" : "desc");
    }
  }

  function toggleCollapsed(name: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
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
    if (replicationTypes.size === 0) return data.rows;
    return data.rows.filter(
      (r) => replicationTypes.has(String(r.replication_type ?? "").trim())
    );
  }, [data, replicationTypes]);

  const byDiscipline: DisciplineNode[] = useMemo(() => {
    if (!data) return [];

    const papers = new Map<
      string,
      { disciplines: string[]; sub: string; successCount: number; totalCount: number }
    >();

    for (const r of filteredRows) {
      const url = String(r.original_url ?? "").trim();
      const raw = String(r.discipline ?? "");
      const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
      const disciplines = parts.length > 0 ? parts : ["Unspecified"];
      // Subdiscipline is a single ontology term — never comma-split it: the
      // only comma-containing value is the term "management, monitoring,
      // policy and law", which splitting would shred into phantom subs.
      const sub = String(r.subdiscipline ?? "").trim();
      // Canonical rule: reversal counts as a failure, inconclusive and
      // unrecorded outcomes stay out of the denominator entirely.
      const outcome = toBinary(classifyReportedResult(r.result));

      if (!url) continue;
      if (outcome === null) continue;

      let paper = papers.get(url);
      if (!paper) {
        paper = { disciplines, sub, successCount: 0, totalCount: 0 };
        papers.set(url, paper);
      }

      paper.totalCount++;
      if (outcome === "success") {
        paper.successCount++;
      }
    }

    const disciplineCounts = new Map<
      string,
      {
        replicated: number;
        notReplicated: number;
        subs: Map<string, { replicated: number; notReplicated: number }>;
      }
    >();

    for (const paper of papers.values()) {
      if (paper.totalCount === 0) continue;

      const rate = paper.successCount / paper.totalCount;
      const isReplicated = rate >= threshold;

      for (const d of paper.disciplines) {
        let entry = disciplineCounts.get(d);
        if (!entry) {
          entry = { replicated: 0, notReplicated: 0, subs: new Map() };
          disciplineCounts.set(d, entry);
        }

        if (isReplicated) {
          entry.replicated++;
        } else {
          entry.notReplicated++;
        }

        // Papers without a subdiscipline count toward the parent only.
        if (paper.sub) {
          let subEntry = entry.subs.get(paper.sub);
          if (!subEntry) {
            subEntry = { replicated: 0, notReplicated: 0 };
            entry.subs.set(paper.sub, subEntry);
          }
          if (isReplicated) {
            subEntry.replicated++;
          } else {
            subEntry.notReplicated++;
          }
        }
      }
    }

    const toStats = (v: { replicated: number; notReplicated: number }): BarStats => {
      const total = v.replicated + v.notReplicated;
      const [ciLow, ciHigh] = wilsonCI(v.replicated, total);
      return {
        ...v,
        total,
        replicatedPct: total > 0 ? (v.replicated / total) * 100 : 0,
        notReplicatedPct: total > 0 ? (v.notReplicated / total) * 100 : 0,
        ciLow,
        ciHigh,
      };
    };

    return Array.from(disciplineCounts.entries())
      .map(([discipline, v]) => ({
        discipline,
        ...toStats(v),
        subs: Array.from(v.subs.entries())
          .map(([subdiscipline, sv]) => ({ subdiscipline, ...toStats(sv) }))
          // A sub identical in name to its parent (e.g. "sports and exercise
          // science") would just duplicate the parent row — suppress it.
          .filter((s) => s.total >= minSubPapers && s.subdiscipline !== discipline),
      }))
      .filter((d) => d.total >= MIN_PAPERS);
  }, [data, filteredRows, threshold, minSubPapers]);

  const sortedDisciplines = useMemo(() => {
    const cmpDiscipline = (a: DisciplineNode, b: DisciplineNode) =>
      sortKey === "discipline" ? a.discipline.localeCompare(b.discipline) : a[sortKey] - b[sortKey];
    const cmpSub = (a: SubRow, b: SubRow) =>
      sortKey === "discipline" ? a.subdiscipline.localeCompare(b.subdiscipline) : a[sortKey] - b[sortKey];

    const sorted = byDiscipline.map((d) => {
      const subs = [...d.subs].sort(cmpSub);
      if (sortDir === "desc") subs.reverse();
      return { ...d, subs };
    }).sort(cmpDiscipline);
    if (sortDir === "desc") sorted.reverse();
    return sorted;
  }, [byDiscipline, sortKey, sortDir]);

  const totalPapers = byDiscipline.reduce((sum, d) => sum + d.total, 0);
  const totalSubdisciplines = byDiscipline.reduce((sum, d) => sum + d.subs.length, 0);

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
              least {Math.round(threshold * 100)}% of the effect replications we have
              in our database for that paper were successful. (Replication work
              generally focuses on replicating the main effects found in papers, and
              some papers report more than one main effect.)
            </p>
          </div>

          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-6">
            {/* Nest subdisciplines toggle */}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <button
                type="button"
                role="switch"
                aria-checked={nestSubs}
                aria-label="Show subdisciplines"
                onClick={() => setNestSubs((v) => !v)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  nestSubs ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                    nestSubs ? "translate-x-[18px]" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span
                className="text-gray-600 dark:text-gray-300"
                onClick={() => setNestSubs((v) => !v)}
              >
                Show subdisciplines
              </span>
            </label>

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
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600 dark:text-gray-300">
                Replication type{" "}
                <Link href="/docs/defining-replication" className="text-xs text-gray-500 dark:text-gray-400 underline hover:opacity-80">
                  (more info)
                </Link>
                :
              </span>
              <div className="w-64">
                <MultiSelectDropdown
                  id="replication-type"
                  label="All types"
                  options={replicationTypeOptions.map((opt) => ({
                    value: opt.name,
                    label: `${opt.name} (${opt.count.toLocaleString()})`,
                  }))}
                  selected={replicationTypes}
                  onChange={setReplicationTypes}
                />
              </div>
            </div>

            {/* Subdiscipline min-papers selector */}
            {nestSubs && (
              <label className="flex items-center gap-2 text-sm">
                <span className="text-gray-600 dark:text-gray-300">
                  Min papers per subdiscipline:
                </span>
                <select
                  value={minSubPapers}
                  onChange={(e) => setMinSubPapers(Number(e.target.value))}
                  className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-sm"
                >
                  {SUB_MIN_PAPERS_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            )}

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

            <span className="text-sm text-gray-500 dark:text-gray-400">
              {byDiscipline.length} disciplines
              {nestSubs && <> &middot; {totalSubdisciplines} subdisciplines</>}
              {" "}&middot; {totalPapers} papers
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
                {sortedDisciplines.map((d) => {
                  const isCollapsed = collapsed.has(d.discipline);
                  const hasSubs = d.subs.length > 0;
                  return (
                    <Fragment key={d.discipline}>
                      <tr className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/40">
                        <td className="p-2 text-left">
                          <div className="flex items-center gap-1">
                            {nestSubs && hasSubs ? (
                              <button
                                type="button"
                                onClick={() => toggleCollapsed(d.discipline)}
                                aria-expanded={!isCollapsed}
                                aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${d.discipline} subdisciplines`}
                                className="shrink-0 p-0.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                              >
                                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                              </button>
                            ) : nestSubs ? (
                              <span className="shrink-0 w-[22px]" aria-hidden="true" />
                            ) : null}
                            <Link
                              href={`/replications-database?discipline=${encodeURIComponent(d.discipline)}`}
                              className="text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {d.discipline}
                            </Link>
                          </div>
                        </td>
                        <BarCell d={d} showCI={showCI} />
                        <td className="p-2 text-right tabular-nums">{d.total}</td>
                      </tr>
                      {nestSubs && !isCollapsed && d.subs.map((s) => (
                        <tr
                          key={`${d.discipline}::${s.subdiscipline}`}
                          className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-900/40 text-xs"
                        >
                          <td className="p-1 pl-8 text-left">
                            <Link
                              href={`/replications-database?discipline=${encodeURIComponent(d.discipline)}&subdiscipline=${encodeURIComponent(s.subdiscipline)}`}
                              className="text-blue-600/90 dark:text-blue-400/90 hover:underline"
                            >
                              {s.subdiscipline}
                            </Link>
                          </td>
                          <BarCell d={s} showCI={showCI} compact />
                          <td className="p-1 text-right tabular-nums text-gray-600 dark:text-gray-400">{s.total}</td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Effect-size retention. The tables above count OUTCOMES (did it
            replicate?); this shows MAGNITUDE (how much of the effect survived),
            which a success/failure split cannot express -- a replication that
            keeps 90% of the effect and one that keeps 20% can both be counted a
            success. Reads the same filtered rows, so the replication-type
            filter applies here too. */}
        <div className="max-w-4xl mx-auto mt-16">
          <RetentionSwarm rows={filteredRows} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
