"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { ExternalLink } from "lucide-react";

export interface ScreeningRow {
  doi: string;
  spray_type: string;
  agent: string;
  agent_canonical: string;
  study_design: string;
  organism: string;
  indication: string;
  source_folder: string;
  is_relevant: string;
  studies_treatment: string;
  trial_type: string;
  phase: string;
  is_excluded: string;
  exclusion_reason: string;
  topics: string[];
  title: string;
  authors: string;
  journal: string;
  volume: string;
  issue: string;
  pages: string;
  year: string;
  url: string;
}

/** Resolve the best outbound link for a row. Real DOIs (10.x) go to doi.org;
 *  grey literature / non-DOI identifiers use the explicit paper_url instead. */
function rowHref(row: ScreeningRow): string | null {
  if (row.doi.startsWith("10.")) return `https://doi.org/${row.doi}`;
  if (row.url) return row.url;
  return null;
}

const PAGE_SIZE = 100;

function formatLabel(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bRct\b/g, "RCT");
}

/** Clinical-trial phase enum -> display label (shared with the chart). */
export const PHASE_LABELS: Record<string, string> = {
  phase_1: "Phase 1",
  phase_1_2: "Phase 1/2",
  phase_2: "Phase 2",
  phase_2_3: "Phase 2/3",
  phase_3: "Phase 3",
  phase_4: "Phase 4",
  not_applicable: "Not applicable",
  unclear: "Unclear",
};
const phaseLabel = (p: string) => PHASE_LABELS[p] ?? formatLabel(p);

/** Format a single author entry as "Last, F." across the formats present in the data. */
function formatAuthorName(entry: string): string {
  const trimmed = entry.trim();
  if (!trimmed) return "";
  // already an abbreviated form, or an organization — leave untouched
  if (/et al/i.test(trimmed)) return trimmed;
  if (/\b(corp|inc|ltd|llc|gmbh|company|university|institute|research|laboratories|labs|pharmaceuticals|consortium)\b/i.test(trimmed)) {
    return trimmed;
  }
  // "Last, First ..." comma form
  if (trimmed.includes(",")) {
    const idx = trimmed.indexOf(",");
    const last = trimmed.slice(0, idx).trim();
    const initial = (trimmed.slice(idx + 1).match(/[A-Za-z]/) ?? [""])[0];
    return initial ? `${last}, ${initial.toUpperCase()}.` : last;
  }
  let toks = trimmed.split(/\s+/).filter(Boolean);
  // drop a generational suffix (Jr, Sr, II, III, IV)
  if (toks.length > 1 && /^(jr|sr|ii|iii|iv)\.?$/i.test(toks[toks.length - 1])) {
    toks = toks.slice(0, -1);
  }
  if (toks.length === 1) return toks[0];
  const lastTok = toks[toks.length - 1];
  // PubMed abbreviated form: "Surname INITIALS" (e.g. "Sperber SJ", "Hayden FG")
  if (toks.length === 2 && /^[A-Z]{1,3}\.?$/.test(lastTok)) {
    return `${toks[0]}, ${lastTok[0].toUpperCase()}.`;
  }
  // "First [Middle...] Last"
  const initial = (toks[0].match(/[A-Za-z]/) ?? [""])[0];
  return initial ? `${lastTok}, ${initial.toUpperCase()}.` : lastTok;
}

/** "Last, F. et al." (or "Last, F." for a single author) from a "First Last; ..." list. */
function formatAuthors(authors: string): string {
  const list = authors.split(";").map((a) => a.trim()).filter(Boolean);
  if (list.length === 0) return "";
  const first = formatAuthorName(list[0]);
  return list.length > 1 && !/et al/i.test(list[0]) ? `${first} et al.` : first;
}

/** Authors. Journal vol(issue) pages. (year) — with the journal name italicized. */
function CitationLine({ row }: { row: ScreeningRow }) {
  const volPages = [
    row.volume && `${row.volume}${row.issue ? `(${row.issue})` : ""}`,
    row.pages,
  ].filter(Boolean).join(" ");

  const authors = formatAuthors(row.authors);
  const segments = [];
  if (authors) segments.push(authors);
  if (row.journal || volPages) {
    segments.push(
      <>
        {row.journal && <em>{row.journal}</em>}
        {row.journal && volPages ? " " : ""}
        {volPages}
      </>
    );
  }
  if (row.year) segments.push(`(${row.year})`);
  if (segments.length === 0) return null;

  return (
    <span className="text-foreground/70">
      {segments.map((seg, i) => (
        <span key={i}>
          {i > 0 && ". "}
          {seg}
        </span>
      ))}
    </span>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-xs text-foreground/50 block mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-border rounded px-3 py-1.5 text-sm bg-background"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ScreeningTable({
  rows,
  externalSprayFilter,
  externalAgentFilter,
  externalDesignFilter,
  externalIndicationFilter,
  externalPhaseFilter,
  sprayTypes,
  compounds,
}: {
  rows: ScreeningRow[];
  externalSprayFilter?: string;
  externalAgentFilter?: string;
  externalDesignFilter?: string;
  externalIndicationFilter?: string;
  externalPhaseFilter?: string;
  sprayTypes?: string[];
  compounds?: string[];
}) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sprayFilter, setSprayFilter] = useState(externalSprayFilter ?? "all");
  const [agentFilter, setAgentFilter] = useState(externalAgentFilter ?? "all");
  const [designFilter, setDesignFilter] = useState(externalDesignFilter ?? "all");
  const [indicationFilter, setIndicationFilter] = useState(externalIndicationFilter ?? "all");
  const [phaseFilter, setPhaseFilter] = useState(externalPhaseFilter ?? "all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const sprays = sprayTypes ?? [];
  const agents = useMemo(
    () => (compounds ?? []).slice().sort((a, b) => a.localeCompare(b)),
    [compounds]
  );
  const designs = useMemo(
    () => [...new Set(rows.map((r) => r.study_design).filter(Boolean))].sort(),
    [rows]
  );
  const indications = useMemo(
    () => [...new Set(rows.map((r) => r.indication).filter(Boolean))].sort(),
    [rows]
  );
  const phases = useMemo(
    () => [...new Set(rows.map((r) => r.phase).filter(Boolean))].sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    let r = rows;
    if (search) {
      const s = search.toLowerCase();
      r = r.filter(
        (row) =>
          row.doi.toLowerCase().includes(s) ||
          row.title.toLowerCase().includes(s) ||
          row.authors.toLowerCase().includes(s) ||
          row.journal.toLowerCase().includes(s) ||
          row.spray_type.toLowerCase().includes(s) ||
          row.agent.toLowerCase().includes(s) ||
          row.agent_canonical.toLowerCase().includes(s) ||
          row.study_design.toLowerCase().includes(s)
      );
    }
    if (sprayFilter !== "all") r = r.filter((row) => row.spray_type === sprayFilter);
    if (agentFilter !== "all") r = r.filter((row) => row.agent_canonical === agentFilter);
    if (designFilter !== "all") r = r.filter((row) => row.study_design === designFilter);
    if (indicationFilter !== "all") r = r.filter((row) => row.indication === indicationFilter);
    if (phaseFilter !== "all") r = r.filter((row) => row.phase === phaseFilter);
    return r;
  }, [rows, search, sprayFilter, agentFilter, designFilter, indicationFilter, phaseFilter]);

  // Reset pagination whenever the filtered set changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, sprayFilter, agentFilter, designFilter, indicationFilter, phaseFilter]);

  // If mounted with an external filter (bar click), scroll into view
  useEffect(() => {
    if (externalSprayFilter || externalAgentFilter || externalDesignFilter
        || externalIndicationFilter || externalPhaseFilter) {
      setTimeout(() => {
        tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
    // eslint-disable-line react-hooks/exhaustive-deps
  }, [externalSprayFilter, externalAgentFilter, externalDesignFilter,
      externalIndicationFilter, externalPhaseFilter]);

  const visible = filtered.slice(0, visibleCount);

  return (
    <div ref={tableRef} className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="text-xs text-foreground/50 block mb-1">Search</label>
          <input
            type="text"
            placeholder="DOI, title, author... (press Enter)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") setSearch(searchInput); }}
            className="border border-border rounded px-3 py-1.5 text-sm bg-background w-64"
          />
        </div>
        <FilterSelect
          label="Drug Class"
          value={sprayFilter}
          onChange={setSprayFilter}
          options={[{ value: "all", label: "All" }, ...sprays.map((s) => ({ value: s, label: formatLabel(s) }))]}
        />
        {agents.length > 0 && (
          <FilterSelect
            label="Compound"
            value={agentFilter}
            onChange={setAgentFilter}
            options={[
              { value: "all", label: "All" },
              // an externally-clicked compound may be a single-paper bar not in
              // the dropdown list; keep it selectable so the filter stays visible
              ...(agentFilter !== "all" && !agents.includes(agentFilter)
                ? [{ value: agentFilter, label: formatLabel(agentFilter) }]
                : []),
              ...agents.map((a) => ({ value: a, label: formatLabel(a) })),
            ]}
          />
        )}
        <FilterSelect
          label="Study Design"
          value={designFilter}
          onChange={setDesignFilter}
          options={[{ value: "all", label: "All" }, ...designs.map((t) => ({ value: t, label: formatLabel(t) }))]}
        />
        {indications.length > 0 && (
          <FilterSelect
            label="Prevention / Treatment"
            value={indicationFilter}
            onChange={setIndicationFilter}
            options={[{ value: "all", label: "All" }, ...indications.map((i) => ({ value: i, label: formatLabel(i) }))]}
          />
        )}
        {phases.length > 0 && (
          <FilterSelect
            label="Phase"
            value={phaseFilter}
            onChange={setPhaseFilter}
            options={[{ value: "all", label: "All" }, ...phases.map((p) => ({ value: p, label: phaseLabel(p) }))]}
          />
        )}
      </div>

      <div className="flex items-center gap-4 text-sm text-foreground/50">
        <p>
          Showing {visible.length.toLocaleString()} of {filtered.length.toLocaleString()} articles
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-foreground border-collapse">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="p-2 w-[35%]">Reference</th>
              <th className="p-2">Drug Class</th>
              <th className="p-2">Drug</th>
              <th className="p-2">Study Design</th>
              <th className="p-2">Phase</th>
              <th className="p-2">Prevention / Treatment</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <ScreeningRowItem key={row.doi} row={row} />
            ))}
          </tbody>
        </table>
      </div>

      {visible.length < filtered.length && (
        <button
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="w-full py-2 text-sm text-foreground/60 hover:text-foreground border border-border rounded"
        >
          {`Show more (${(filtered.length - visible.length).toLocaleString()} remaining)`}
        </button>
      )}
    </div>
  );
}

function ScreeningRowItem({ row }: { row: ScreeningRow }) {
  const href = rowHref(row);
  return (
    <tr className="border-b border-border/50 hover:bg-foreground/5 align-top">
      <td className="p-2">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 font-medium leading-snug"
          >
            {row.title || row.doi}
            {" "}<ExternalLink size={10} className="inline align-baseline ml-0.5" />
          </a>
        ) : (
          <span className="font-medium leading-snug text-foreground">
            {row.title || row.doi}
          </span>
        )}
        {(row.authors || row.journal || row.year) && (
          <div className="mt-0.5 text-xs">
            <CitationLine row={row} />
          </div>
        )}
        {row.source_folder === "abstract_only" && (
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-amber-600/80">
            screened on abstract only
          </div>
        )}
      </td>
      <td className="p-2 text-xs">{row.spray_type ? formatLabel(row.spray_type) : "—"}</td>
      <td className="p-2 text-xs capitalize">{row.agent || "—"}</td>
      <td className="p-2 text-xs">{row.study_design ? formatLabel(row.study_design) : "—"}</td>
      <td className="p-2 text-xs">
        {row.phase && row.phase !== "not_applicable" && row.phase !== "unclear" ? phaseLabel(row.phase) : "—"}
      </td>
      <td className="p-2 text-xs">
        {row.indication && row.indication !== "unclassified" ? formatLabel(row.indication) : "—"}
      </td>
    </tr>
  );
}
