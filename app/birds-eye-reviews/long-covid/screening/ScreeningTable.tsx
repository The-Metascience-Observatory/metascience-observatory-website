"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";

interface ScreeningRow {
  doi: string;
  source_folder: string;
  is_long_covid: string;
  studies_treatment: string;
  trial_type: string;
  is_excluded: string;
  exclusion_reason: string;
  topics: string[];
  summary: string;
  title: string;
  authors: string;
  journal: string;
  volume: string;
  issue: string;
  pages: string;
  year: string;
}

function formatLabel(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ReferenceLabel({ row }: { row: ScreeningRow }) {
  const authors = row.authors?.trim();
  const journal = row.journal?.trim();
  const year = row.year?.trim();

  if (!authors) return <span>{row.doi}</span>;

  // Extract last name of first author from "First Last; ..." format
  const firstAuthor = authors.split(";")[0].trim();
  const nameParts = firstAuthor.split(/\s+/);
  const lastName = nameParts[nameParts.length - 1];
  const authorCount = authors.split(";").length;
  const authorStr = authorCount > 1 ? `${lastName} et al.` : lastName;

  return (
    <span>
      {authorStr}
      {(journal || year) && ", "}
      {journal && <em>{journal}</em>}
      {journal && year && ", "}
      {year && year}
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

export function ScreeningTable({ initialRows, totalCount }: { initialRows: ScreeningRow[]; totalCount: number }) {
  const [rows, setRows] = useState<ScreeningRow[]>(initialRows);
  const [filteredTotal, setFilteredTotal] = useState(totalCount);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [longCovidFilter, setLongCovidFilter] = useState("all");
  const [treatmentFilter, setTreatmentFilter] = useState("all");
  const [trialTypeFilter, setTrialTypeFilter] = useState("all");
  const [excludedFilter, setExcludedFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const sources = useMemo(
    () => ["Observational_Cohort_Study", "Original_Research", "Cross-Sectional_Study", "Qualitative_Study", "Clinical_Trial", "Case-Control_Study", "Case_Report", "Mixed_Methods_Study"],
    []
  );
  const trialTypes = useMemo(
    () => ["cross_sectional", "observational_cohort", "retrospective_cohort", "other", "case_series", "case_control", "non_randomized_trial", "rct", "prospective_cohort"],
    []
  );

  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (sourceFilter !== "all") p.set("source", sourceFilter);
    if (longCovidFilter !== "all") p.set("longCovid", longCovidFilter);
    if (treatmentFilter !== "all") p.set("treatment", treatmentFilter);
    if (trialTypeFilter !== "all") p.set("trialType", trialTypeFilter);
    if (excludedFilter !== "all") p.set("excluded", excludedFilter);
    return p;
  }, [search, sourceFilter, longCovidFilter, treatmentFilter, trialTypeFilter, excludedFilter]);

  const fetchRows = useCallback(async (offset: number, append: boolean) => {
    setLoading(true);
    try {
      const p = buildParams();
      p.set("offset", String(offset));
      p.set("limit", "100");
      const res = await fetch(`/api/screening?${p.toString()}`);
      const data = await res.json();
      setFilteredTotal(data.total);
      if (append) {
        setRows((prev) => [...prev, ...data.rows]);
      } else {
        setRows(data.rows);
      }
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  // Refetch when filters change
  const applyFilters = useCallback(() => {
    fetchRows(0, false);
  }, [fetchRows]);

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    fetchRows(0, false);
  }, [sourceFilter, longCovidFilter, treatmentFilter, trialTypeFilter, excludedFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpand = (doi: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(doi)) next.delete(doi);
      else next.add(doi);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="text-xs text-foreground/50 block mb-1">Search</label>
          <input
            type="text"
            placeholder="DOI, topic, summary... (press Enter)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
            className="border border-border rounded px-3 py-1.5 text-sm bg-background w-64"
          />
        </div>
        <FilterSelect
          label="Source"
          value={sourceFilter}
          onChange={setSourceFilter}
          options={[{ value: "all", label: "All" }, ...sources.map((s) => ({ value: s, label: formatLabel(s) }))]}
        />
        <FilterSelect
          label="Long Covid"
          value={longCovidFilter}
          onChange={setLongCovidFilter}
          options={[
            { value: "all", label: "All" },
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
        />
        <FilterSelect
          label="Studies Treatment"
          value={treatmentFilter}
          onChange={setTreatmentFilter}
          options={[
            { value: "all", label: "All" },
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
        />
        <FilterSelect
          label="Trial Type"
          value={trialTypeFilter}
          onChange={setTrialTypeFilter}
          options={[{ value: "all", label: "All" }, ...trialTypes.map((t) => ({ value: t, label: formatLabel(t) }))]}
        />
        <FilterSelect
          label="Excluded"
          value={excludedFilter}
          onChange={setExcludedFilter}
          options={[
            { value: "all", label: "All" },
            { value: "yes", label: "Excluded" },
            { value: "no", label: "Included" },
          ]}
        />
      </div>

      <p className="text-sm text-foreground/50">
        Showing {rows.length.toLocaleString()} of {filteredTotal.toLocaleString()} articles
        {loading && " — loading..."}
      </p>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-foreground border-collapse">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="p-2 w-8" />
              <th className="p-2 w-[30%]">Reference</th>
              <th className="p-2">Source</th>
              <th className="p-2">Trial Type</th>
              <th className="p-2">Long Covid</th>
              <th className="p-2">Treatment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isExpanded = expanded.has(row.doi);
              return (
                <ScreeningRowItem
                  key={row.doi}
                  row={row}
                  isExpanded={isExpanded}
                  onToggle={() => toggleExpand(row.doi)}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length < filteredTotal && (
        <button
          onClick={() => fetchRows(rows.length, true)}
          disabled={loading}
          className="w-full py-2 text-sm text-foreground/60 hover:text-foreground border border-border rounded disabled:opacity-50"
        >
          {loading ? "Loading..." : `Show more (${(filteredTotal - rows.length).toLocaleString()} remaining)`}
        </button>
      )}
    </div>
  );
}

function ScreeningRowItem({
  row,
  isExpanded,
  onToggle,
}: {
  row: ScreeningRow;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="border-b border-border/50 hover:bg-foreground/5 cursor-pointer"
        onClick={onToggle}
      >
        <td className="p-2">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </td>
        <td className="p-2">
          <a
            href={`https://doi.org/${row.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <ReferenceLabel row={row} />
            {" "}<ExternalLink size={10} className="inline align-baseline ml-0.5" />
          </a>
        </td>
        <td className="p-2 text-xs">{formatLabel(row.source_folder)}</td>
        <td className="p-2 text-xs">{formatLabel(row.trial_type)}</td>
        <td className="p-2">
          <span
            className="inline-block px-2 py-0.5 rounded text-xs font-medium"
            style={{
              backgroundColor: row.is_long_covid === "yes" ? "#22c55e20" : "#94a3b840",
              color: row.is_long_covid === "yes" ? "#16a34a" : "#64748b",
            }}
          >
            {row.is_long_covid === "yes" ? "Yes" : "No"}
          </span>
        </td>
        <td className="p-2">
          <span
            className="inline-block px-2 py-0.5 rounded text-xs font-medium"
            style={{
              backgroundColor: row.studies_treatment === "yes" ? "#3b82f620" : "#94a3b840",
              color: row.studies_treatment === "yes" ? "#2563eb" : "#64748b",
            }}
          >
            {row.studies_treatment === "yes" ? "Yes" : "No"}
          </span>
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-border/50">
          <td colSpan={6} className="p-4 bg-foreground/[0.02]">
            <div className="space-y-3 text-xs">
              {/* Reference */}
              {(row.title || row.authors || row.journal) && (
                <div>
                  {row.title && (
                    <p className="text-foreground font-medium leading-snug">{row.title}</p>
                  )}
                  <p className="text-foreground/70 mt-0.5">
                    {[
                      row.authors,
                      [row.journal, row.volume && `${row.volume}${row.issue ? `(${row.issue})` : ""}`, row.pages].filter(Boolean).join(" "),
                      row.year && `(${row.year})`,
                    ].filter(Boolean).join(". ")}
                  </p>
                </div>
              )}
              {row.summary && (
                <div>
                  <div className="text-foreground font-medium uppercase tracking-wide text-[10px] mb-0.5">
                    AI Summary of Abstract
                  </div>
                  <p className="text-foreground leading-relaxed">{row.summary}</p>
                </div>
              )}
              <div className="flex gap-6 flex-wrap">
                {row.exclusion_reason && (
                  <div>
                    <div className="text-foreground font-medium uppercase tracking-wide text-[10px] mb-0.5">
                      Exclusion Reason
                    </div>
                    <p>{formatLabel(row.exclusion_reason)}</p>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
