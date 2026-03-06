"use client";

import { useState, useMemo } from "react";
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
}

function formatLabel(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
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

export function ScreeningTable({ rows }: { rows: ScreeningRow[] }) {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [longCovidFilter, setLongCovidFilter] = useState("all");
  const [treatmentFilter, setTreatmentFilter] = useState("all");
  const [trialTypeFilter, setTrialTypeFilter] = useState("all");
  const [excludedFilter, setExcludedFilter] = useState("all");
  const [showCount, setShowCount] = useState(100);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const sources = useMemo(
    () => [...new Set(rows.map((r) => r.source_folder))].sort(),
    [rows]
  );
  const trialTypes = useMemo(
    () => [...new Set(rows.map((r) => r.trial_type))].filter(Boolean).sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    let result = rows;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.doi.toLowerCase().includes(s) ||
          r.summary.toLowerCase().includes(s) ||
          r.topics.some((t) => t.toLowerCase().includes(s))
      );
    }
    if (sourceFilter !== "all") result = result.filter((r) => r.source_folder === sourceFilter);
    if (longCovidFilter !== "all") result = result.filter((r) => r.is_long_covid === longCovidFilter);
    if (treatmentFilter !== "all") result = result.filter((r) => r.studies_treatment === treatmentFilter);
    if (trialTypeFilter !== "all") result = result.filter((r) => r.trial_type === trialTypeFilter);
    if (excludedFilter !== "all") result = result.filter((r) => r.is_excluded === excludedFilter);
    return result;
  }, [rows, search, sourceFilter, longCovidFilter, treatmentFilter, trialTypeFilter, excludedFilter]);

  const visible = filtered.slice(0, showCount);

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
            placeholder="DOI, topic, summary..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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

      <p className="text-sm text-foreground/50">{filtered.length.toLocaleString()} articles match</p>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-foreground border-collapse">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="p-2 w-8" />
              <th className="p-2">DOI</th>
              <th className="p-2">Source</th>
              <th className="p-2">Trial Type</th>
              <th className="p-2">Long Covid</th>
              <th className="p-2">Treatment</th>
              <th className="p-2">Status</th>
              <th className="p-2">Topics</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const isExpanded = expanded.has(row.doi);
              return (
                <ScreeningRow
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

      {filtered.length > showCount && (
        <button
          onClick={() => setShowCount((c) => c + 100)}
          className="w-full py-2 text-sm text-foreground/60 hover:text-foreground border border-border rounded"
        >
          Show more ({filtered.length - showCount} remaining)
        </button>
      )}
    </div>
  );
}

function ScreeningRow({
  row,
  isExpanded,
  onToggle,
}: {
  row: ScreeningRow;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const excluded = row.is_excluded === "yes";
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
            className="text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {row.doi.length > 35 ? row.doi.slice(0, 35) + "…" : row.doi}
            <ExternalLink size={10} />
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
        <td className="p-2">
          <span
            className="inline-block px-2 py-0.5 rounded text-xs font-medium"
            style={{
              backgroundColor: excluded ? "#ef444420" : "#22c55e20",
              color: excluded ? "#dc2626" : "#16a34a",
            }}
          >
            {excluded ? "Excluded" : "Included"}
          </span>
        </td>
        <td className="p-2 text-xs max-w-[250px]">
          <span className="line-clamp-1">{row.topics.join(", ")}</span>
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-border/50">
          <td colSpan={8} className="p-4 bg-foreground/[0.02]">
            <div className="space-y-3 text-xs">
              {row.summary && (
                <div>
                  <div className="text-foreground font-medium uppercase tracking-wide text-[10px] mb-0.5">
                    Summary
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
                <div>
                  <div className="text-foreground font-medium uppercase tracking-wide text-[10px] mb-0.5">
                    Topics
                  </div>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {row.topics.map((t, i) => (
                      <span
                        key={i}
                        className="inline-block px-2 py-0.5 rounded bg-foreground/5 text-foreground/80"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
