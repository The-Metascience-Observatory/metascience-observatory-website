"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { ExternalLink } from "lucide-react";
import { prettyMeasure, prettyDomain } from "./ForestPlot";
import { fmt, formatLabel } from "./utils";

/** A secondary publication of the same trial (follow-up / commentary), surfaced
 *  as a labelled "see also" link next to the primary's reference. */
export interface RelatedPub {
  doi: string;
  relation: string; // "follow_up" | "commentary"
  label: string;
}

export interface TrialRow {
  doi: string;
  armLabel: string;
  relatedPubs: RelatedPub[];
  ingredient: string;
  indication: string;
  countries: string[];
  drug_class: string;
  design: string;
  n: number | null;
  rob: string;
  verdict: string;
  verdictRationale: string;
  hoverLabel: string;        // "Surname et al." for the chart hover panel (derived from authors)
  hoverPhase: string | null; // trial phase for the chart hover panel (from the citation)
  abstractOnly: boolean;
  primaryDomain: string;
  primaryName: string;
  effMeasure: string;
  effVal: number | null;
  ciLo: number | null;
  ciHi: number | null;
  pVal: number | null;
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

/** Relation -> short prefix for a "see also" secondary-publication link. */
const RELATION_LABEL: Record<string, string> = {
  follow_up: "Follow-up",
  commentary: "Commentary",
};

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

/** Real DOIs -> doi.org; grey-lit / PMIDs -> explicit url; else no link.
 *  Strips an arm-split "#<arm>" suffix so the DOI resolves. */
function rowHref(row: TrialRow): string | null {
  const base = row.doi.split("#")[0];
  if (base.startsWith("10.")) return `https://doi.org/${base}`;
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
  const volParts = [row.volume, row.issue && `(${row.issue})`].filter(Boolean).join("");
  const volPages = [volParts, row.pages].filter(Boolean).join(" ");
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

function MobileCard({ row }: { row: TrialRow }) {
  const href = rowHref(row);
  return (
    <div className="border border-border rounded-lg p-3 bg-white space-y-1.5">
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-700 font-medium leading-snug text-sm">
          {row.title || row.doi}{" "}
          <ExternalLink size={10} className="inline align-baseline ml-0.5" />
        </a>
      ) : (
        <span className="font-medium leading-snug text-sm">{row.title || row.doi}</span>
      )}
      {(row.authors || row.journal || row.year) && (
        <div className="text-xs"><CitationLine row={row} /></div>
      )}
      {row.armLabel && (
        <div>
          <span className="inline-block rounded border border-blue-200 bg-blue-50 text-blue-700 px-1.5 py-0.5 text-[10px]">
            {row.armLabel}
          </span>
        </div>
      )}
      {row.abstractOnly && (
        <div className="text-[10px] tracking-wide text-amber-600/80">(Extracted from abstract only)</div>
      )}
      {row.relatedPubs.length > 0 && (
        <div className="text-[10px] text-foreground/55 leading-snug">
          See also:{" "}
          {row.relatedPubs.map((p, i) => (
            <span key={p.doi}>
              {i > 0 && " · "}
              <span className="text-foreground/45">{RELATION_LABEL[p.relation] ?? p.relation}: </span>
              <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700">
                {p.label}<ExternalLink size={9} className="inline align-baseline ml-0.5" />
              </a>
            </span>
          ))}
        </div>
      )}
      <div className="text-xs text-foreground/70 space-y-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="capitalize">{row.ingredient || "unspecified"}</span>
        </div>
        {(row.design || row.n != null) && (
          <div className="flex flex-wrap gap-x-3">
            {row.design && <span>{formatLabel(row.design)}</span>}
            {row.n != null && <span>N = {row.n.toLocaleString()}</span>}
          </div>
        )}
      </div>
      {row.primaryName && (
        <div className="text-xs">
          <span className="text-foreground/80">{row.primaryName}</span>
          {row.effMeasure && row.effVal != null && (
            <span className="text-foreground/60 tabular-nums ml-1">
              — {prettyMeasure(row.effMeasure)} {fmt(row.effVal)}
              {row.ciLo != null && row.ciHi != null && ` (${fmt(row.ciLo)}–${fmt(row.ciHi)})`}
              {row.pVal != null && `, p=${fmt(row.pVal)}`}
            </span>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 text-xs flex-wrap">
        <VerdictBadge row={row} />
        {row.rob && (
          <span className={ROB_STYLE[row.rob] ?? "text-foreground/50"}>
            RoB: {formatLabel(row.rob)}
          </span>
        )}
      </div>
    </div>
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
  externalDomain,
  externalRob,
}: {
  rows: TrialRow[];
  externalDomain?: string;
  externalRob?: string;
}) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState(externalDomain ?? "all");
  const [rob, setRob] = useState(externalRob ?? "all");
  const [verdict, setVerdict] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };

  useEffect(() => {
    setDomain(externalDomain ?? "all");
    setRob(externalRob ?? "all");
  }, [externalDomain, externalRob]);

  const uniq = (sel: (r: TrialRow) => string) =>
    [...new Set(rows.map(sel).filter(Boolean))].sort();
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
    if (domain !== "all") r = r.filter((row) => row.primaryDomain === domain);
    if (rob !== "all") r = r.filter((row) => row.rob === rob);
    if (verdict !== "all") r = r.filter((row) => row.verdict === verdict);
    return r;
  }, [rows, search, domain, rob, verdict]);

  useEffect(() => {
    if (externalDomain || externalRob) {
      setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, [externalDomain, externalRob]);

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
        <Select label="Outcome domain" value={domain} onChange={setDomain}
          options={[{ value: "all", label: "All" }, ...domains.map((s) => ({ value: s, label: prettyDomain(s) }))]} />
        <Select label="Risk of bias" value={rob} onChange={setRob}
          options={[{ value: "all", label: "All" }, ...robs.map((s) => ({ value: s, label: formatLabel(s) }))]} />
        {verdicts.length > 0 && (
          <Select label="Result" value={verdict} onChange={setVerdict}
            options={[{ value: "all", label: "All" }, ...verdicts.map((s) => ({ value: s, label: VERDICT_LABEL[s] ?? formatLabel(s) }))]} />
        )}
      </div>

      <div className="flex md:hidden flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/60">
        <span>Sort:</span>
        {(["ingredient", "design", "n"] as SortKey[]).map((k) => (
          <button key={k} onClick={() => toggleSort(k)}
            className={`hover:text-foreground ${sortKey === k ? "font-semibold text-foreground" : ""}`}>
            {k === "n" ? "N" : k === "ingredient" ? "Drug" : k.charAt(0).toUpperCase() + k.slice(1)}
            {sortKey === k ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
          </button>
        ))}
      </div>

      <p className="text-sm text-foreground/50">
        Showing {visible.length.toLocaleString()} of {filtered.length.toLocaleString()} trials
      </p>

      <div className="block md:hidden space-y-3">
        {visible.map((row) => <MobileCard key={row.doi} row={row} />)}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm text-foreground border-collapse">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="p-2 w-[34%]">Reference</th>
              <SortTh label="Drug" sortKey="ingredient" active={sortKey === "ingredient"} dir={sortDir} onSort={toggleSort} />
              <SortTh label="Design" sortKey="design" active={sortKey === "design"} dir={sortDir} onSort={toggleSort} />
              <SortTh label="N" sortKey="n" active={sortKey === "n"} dir={sortDir} onSort={toggleSort} align="right" />
              <th className="p-2">Primary outcome &amp; effect</th>
              <th className="p-2">Result</th>
              <th className="p-2">
                <TooltipPrimitive.Root>
                  <TooltipPrimitive.Trigger asChild>
                    <span className="cursor-default underline decoration-dotted">RoB</span>
                  </TooltipPrimitive.Trigger>
                  <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content
                      className="z-50 rounded bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
                      sideOffset={4}
                    >
                      Risk of Bias
                      <TooltipPrimitive.Arrow className="fill-popover" />
                    </TooltipPrimitive.Content>
                  </TooltipPrimitive.Portal>
                </TooltipPrimitive.Root>
              </th>
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
                    {row.armLabel && (
                      <div className="mt-0.5">
                        <span className="inline-block rounded border border-blue-200 bg-blue-50 text-blue-700 px-1.5 py-0.5 text-[10px]">
                          {row.armLabel}
                        </span>
                      </div>
                    )}
                    {row.abstractOnly && (
                      <div className="mt-0.5 text-[10px] tracking-wide text-amber-600/80">
                        (Extracted from abstract only)
                      </div>
                    )}
                    {row.relatedPubs.length > 0 && (
                      <div className="mt-0.5 text-[10px] text-foreground/55 leading-snug">
                        See also:{" "}
                        {row.relatedPubs.map((p, i) => (
                          <span key={p.doi}>
                            {i > 0 && " · "}
                            <span className="text-foreground/45">
                              {RELATION_LABEL[p.relation] ?? p.relation}:{" "}
                            </span>
                            <a
                              href={`https://doi.org/${p.doi}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700"
                            >
                              {p.label}
                              <ExternalLink size={9} className="inline align-baseline ml-0.5" />
                            </a>
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-2 text-xs">
                    <div className="capitalize">{row.ingredient || "unspecified"}</div>
                  </td>
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
                            {row.pVal != null && `, p=${fmt(row.pVal)}`}
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
      </div>  {/* end desktop overflow-x-auto */}
    </div>
  );
}
