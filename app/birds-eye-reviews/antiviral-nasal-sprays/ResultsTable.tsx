"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { ExternalLink } from "lucide-react";
import { prettyMeasure, prettyDomain } from "./ForestPlot";

export interface TrialRow {
  doi: string;
  ingredient: string;
  indication: string;
  spray_type: string;
  design: string;
  n: number | null;
  rob: string;
  verdict: string;
  verdictRationale: string;
  abstractOnly: boolean;
  primaryDomain: string;
  primaryName: string;
  effMeasure: string;
  effVal: number | null;
  ciLo: number | null;
  ciHi: number | null;
  pVal: number | null;
  summary: string;
  title: string;
  authors: string;
  journal: string;
  year: string;
  volume: string;
  issue: string;
  pages: string;
  url: string;
}

type SortKey = "ingredient" | "design" | "n";

/** A clickable, sortable column header with an asc/desc/idle indicator. */
function SortTh({
  label, sortKey, active, dir, onSort, align,
}: {
  label: string; sortKey: SortKey; active: boolean; dir: "asc" | "desc";
  onSort: (k: SortKey) => void; align?: "right";
}) {
  return (
    <th className={`p-2 ${align === "right" ? "text-right" : ""}`}>
      <button
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 font-semibold hover:text-foreground ${active ? "text-foreground" : "text-foreground/70"}`}
      >
        {label}
        <span className="text-[10px] text-foreground/40">{active ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

function formatLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bRct\b/g, "RCT");
}
function fmt(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "—";
  const a = Math.abs(n);
  return a >= 100 ? n.toFixed(0) : a >= 10 ? n.toFixed(1) : n.toFixed(2);
}

/** Real DOIs -> doi.org; grey-lit / PMIDs -> explicit url; else no link. */
function rowHref(row: TrialRow): string | null {
  if (row.doi.startsWith("10.")) return `https://doi.org/${row.doi}`;
  if (row.url) return row.url;
  return null;
}

const ROB_STYLE: Record<string, string> = {
  low: "text-green-700",
  some_concerns: "text-amber-600",
  moderate: "text-amber-600",
  high: "text-red-700",
  serious: "text-red-700",
  critical: "text-red-800",
};

/** Result-of-trial verdict (direction of effect on the primary outcome). */
const VERDICT_LABEL: Record<string, string> = {
  favors_treatment: "Favors treatment",
  favors_control: "Favors control",
  no_difference: "No difference",
  mixed: "Mixed",
  inconclusive: "Inconclusive",
};
const VERDICT_STYLE: Record<string, string> = {
  favors_treatment: "bg-green-50 text-green-700 border-green-200",
  favors_control: "bg-red-50 text-red-700 border-red-200",
  no_difference: "bg-foreground/[0.04] text-foreground/60 border-border",
  mixed: "bg-amber-50 text-amber-700 border-amber-200",
  inconclusive: "bg-foreground/[0.02] text-foreground/45 border-border",
};
function VerdictBadge({ row }: { row: TrialRow }) {
  if (!row.verdict) return <span className="text-foreground/40">—</span>;
  const label = VERDICT_LABEL[row.verdict] ?? formatLabel(row.verdict);
  const style = VERDICT_STYLE[row.verdict] ?? "bg-foreground/[0.04] text-foreground/60 border-border";
  return (
    <span
      title={row.verdictRationale || undefined}
      className={`inline-block rounded border px-1.5 py-0.5 text-[11px] leading-tight ${style}`}
    >
      {label}
    </span>
  );
}

function CitationLine({ row }: { row: TrialRow }) {
  const volPages = [row.volume && `${row.volume}${row.issue ? `(${row.issue})` : ""}`, row.pages]
    .filter(Boolean).join(" ");
  const segs: React.ReactNode[] = [];
  if (row.authors) segs.push(row.authors.split(";")[0].trim() + (row.authors.includes(";") ? " et al." : ""));
  if (row.journal || volPages) segs.push(<>{row.journal && <em>{row.journal}</em>}{row.journal && volPages ? " " : ""}{volPages}</>);
  if (row.year) segs.push(`(${row.year})`);
  if (segs.length === 0) return null;
  return (
    <span className="text-foreground/70">
      {segs.map((s, i) => <span key={i}>{i > 0 && ". "}{s}</span>)}
    </span>
  );
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-xs text-foreground/50 block mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="border border-border rounded px-3 py-1.5 text-sm bg-background">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function ResultsTable({
  rows,
  externalIngredient,
  externalDomain,
  externalRob,
}: {
  rows: TrialRow[];
  externalIngredient?: string;
  externalDomain?: string;
  externalRob?: string;
}) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [ingredient, setIngredient] = useState(externalIngredient ?? "all");
  const [domain, setDomain] = useState(externalDomain ?? "all");
  const [rob, setRob] = useState(externalRob ?? "all");
  const [verdict, setVerdict] = useState("all");
  const [abstractOnly, setAbstractOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };

  useEffect(() => { if (externalIngredient !== undefined) setIngredient(externalIngredient); }, [externalIngredient]);
  useEffect(() => { if (externalDomain !== undefined) setDomain(externalDomain); }, [externalDomain]);
  useEffect(() => { if (externalRob !== undefined) setRob(externalRob); }, [externalRob]);

  const uniq = (sel: (r: TrialRow) => string) =>
    [...new Set(rows.map(sel).filter(Boolean))].sort();
  // Empty ingredient -> "unspecified" so it matches the chart's "unspecified"
  // bar (clicking which filters here) and appears as a dropdown option.
  const ingredients = useMemo(() => uniq((r) => r.ingredient || "unspecified"), [rows]);
  const domains = useMemo(() => uniq((r) => r.primaryDomain), [rows]);
  const robs = useMemo(() => uniq((r) => r.rob), [rows]);
  // Order verdicts by evidence direction rather than alphabetically.
  const VERDICT_ORDER = ["favors_treatment", "favors_control", "no_difference", "mixed", "inconclusive"];
  const verdicts = useMemo(() => {
    const present = new Set(rows.map((r) => r.verdict).filter(Boolean));
    return VERDICT_ORDER.filter((v) => present.has(v));
  }, [rows]);

  const filtered = useMemo(() => {
    let r = rows;
    if (search) {
      const s = search.toLowerCase();
      r = r.filter((row) =>
        row.doi.toLowerCase().includes(s) || row.title.toLowerCase().includes(s) ||
        row.authors.toLowerCase().includes(s) || row.ingredient.toLowerCase().includes(s) ||
        row.primaryName.toLowerCase().includes(s));
    }
    if (ingredient !== "all") r = r.filter((row) => (row.ingredient || "unspecified") === ingredient);
    if (domain !== "all") r = r.filter((row) => row.primaryDomain === domain);
    if (rob !== "all") r = r.filter((row) => row.rob === rob);
    if (verdict !== "all") r = r.filter((row) => row.verdict === verdict);
    if (abstractOnly) r = r.filter((row) => row.abstractOnly);
    return r;
  }, [rows, search, ingredient, domain, rob, verdict, abstractOnly]);

  useEffect(() => {
    if (externalIngredient || externalDomain || externalRob) {
      setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, [externalIngredient, externalDomain, externalRob]);

  // Sorting (Ingredient / Design alphabetical, N numeric with nulls last).
  const visible = useMemo(() => {
    if (!sortKey) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    const arr = [...filtered];
    arr.sort((a, b) => {
      if (sortKey === "n") {
        if (a.n == null && b.n == null) return 0;
        if (a.n == null) return 1; // nulls always last
        if (b.n == null) return -1;
        return (a.n - b.n) * dir;
      }
      const av = (sortKey === "ingredient" ? a.ingredient : a.design) || "";
      const bv = (sortKey === "ingredient" ? b.ingredient : b.design) || "";
      return av.localeCompare(bv) * dir;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  return (
    <div ref={tableRef} className="space-y-4">
      <h2 className="text-lg font-semibold">Trials</h2>
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-foreground/50 block mb-1">Search</label>
          <input type="text" placeholder="DOI, title, author... (Enter)" value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") setSearch(searchInput); }}
            className="border border-border rounded px-3 py-1.5 text-sm bg-background w-56" />
        </div>
        <Select label="Ingredient" value={ingredient} onChange={setIngredient}
          options={[{ value: "all", label: "All" }, ...ingredients.map((s) => ({ value: s, label: formatLabel(s) }))]} />
        <Select label="Outcome domain" value={domain} onChange={setDomain}
          options={[{ value: "all", label: "All" }, ...domains.map((s) => ({ value: s, label: prettyDomain(s) }))]} />
        <Select label="Risk of bias" value={rob} onChange={setRob}
          options={[{ value: "all", label: "All" }, ...robs.map((s) => ({ value: s, label: formatLabel(s) }))]} />
        {verdicts.length > 0 && (
          <Select label="Result" value={verdict} onChange={setVerdict}
            options={[{ value: "all", label: "All" }, ...verdicts.map((s) => ({ value: s, label: VERDICT_LABEL[s] ?? formatLabel(s) }))]} />
        )}
        <label className="flex items-center gap-1.5 text-sm text-foreground/70 pb-1.5">
          <input type="checkbox" checked={abstractOnly} onChange={(e) => setAbstractOnly(e.target.checked)} />
          Abstract-only
        </label>
      </div>

      <p className="text-sm text-foreground/50">
        Showing {visible.length.toLocaleString()} of {filtered.length.toLocaleString()} trials
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-foreground border-collapse">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="p-2 w-[34%]">Reference</th>
              <SortTh label="Ingredient" sortKey="ingredient" active={sortKey === "ingredient"} dir={sortDir} onSort={toggleSort} />
              <SortTh label="Design" sortKey="design" active={sortKey === "design"} dir={sortDir} onSort={toggleSort} />
              <SortTh label="N" sortKey="n" active={sortKey === "n"} dir={sortDir} onSort={toggleSort} align="right" />
              <th className="p-2">Primary outcome &amp; effect</th>
              <th className="p-2">Result</th>
              <th className="p-2">RoB</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const href = rowHref(row);
              return (
                <tr key={row.doi} className="border-b border-border/50 hover:bg-foreground/5 align-top">
                  <td className="p-2">
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 font-medium leading-snug">
                        {row.title || row.doi}{" "}
                        <ExternalLink size={10} className="inline align-baseline ml-0.5" />
                      </a>
                    ) : (
                      <span className="font-medium leading-snug">{row.title || row.doi}</span>
                    )}
                    {(row.authors || row.journal || row.year) && (
                      <div className="mt-0.5 text-xs"><CitationLine row={row} /></div>
                    )}
                    {row.abstractOnly && (
                      <div className="mt-0.5 text-[10px] tracking-wide text-amber-600/80">
                        (Extracted from abstract only)
                      </div>
                    )}
                  </td>
                  <td className="p-2 text-xs capitalize">{row.ingredient || "—"}</td>
                  <td className="p-2 text-xs">{row.design ? formatLabel(row.design) : "—"}</td>
                  <td className="p-2 text-xs text-right tabular-nums">{row.n ?? "—"}</td>
                  <td className="p-2 text-xs">
                    {row.primaryName ? (
                      <>
                        <div className="text-foreground/80">{row.primaryName}</div>
                        {row.effMeasure && row.effVal != null && (
                          <div className="text-foreground/60 tabular-nums mt-0.5">
                            {prettyMeasure(row.effMeasure)} {fmt(row.effVal)}
                            {row.ciLo != null && row.ciHi != null && ` (${fmt(row.ciLo)}–${fmt(row.ciHi)})`}
                            {row.pVal != null && `, p=${row.pVal}`}
                          </div>
                        )}
                      </>
                    ) : "—"}
                  </td>
                  <td className="p-2 text-xs"><VerdictBadge row={row} /></td>
                  <td className={`p-2 text-xs ${ROB_STYLE[row.rob] ?? "text-foreground/50"}`}>
                    {row.rob ? formatLabel(row.rob) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
