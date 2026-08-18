"use client";

import React, { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { fmt, formatLabel } from "./utils";

export interface TrialRow {
  doi: string;
  countries: string[];
  hoverLabel: string;
  design: string;
  /** Intervention buckets (a study can carry several, e.g. a trial with both
   *  a monotherapy and an adjunctive lithium arm). */
  interventions: string[];
  /** Care-setting bucket + the verbatim setting text (from paper_facets.json). */
  setting: string;
  settingText: string;
  /** Psychiatric-diagnosis bucket + the verbatim diagnosis. */
  diagnosis: string;
  diagnosisText: string;
  n: number | null;
  rob: string;

  // dose
  elementalMgPerDay: number | null;
  serumMmolL: number | null;
  serumBand: string;
  saltAssumed: boolean;
  isPoolable: boolean;
  exposureStratum: string;

  // duration
  durationWeeks: number | null;

  // weight result
  weightMetric: string;
  weightMetricLabel: string;
  outcomeName: string;
  effMeasure: string;
  effVal: number | null;
  ciLo: number | null;
  ciHi: number | null;
  pVal: number | null;
  seFromP: boolean;

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

type SortKey =
  | "year" | "title" | "design" | "n" | "rob"
  | "elementalMgPerDay" | "serumMmolL" | "durationWeeks" | "effVal"
  | "outcomeName" | "serumBand" | "exposureStratum"
  | "diagnosisText" | "setting";

/** Achieved serum lithium, banded. This review is about dose-response, so the
 *  band is the axis that matters — but only ~48% of studies report a level at
 *  all, and a blank cell must read as "never measured", not "zero". */
const SERUM_BAND_LABEL: Record<string, string> = {
  low: "low",
  medium: "medium",
  high: "high",
};
const SERUM_BAND_STYLE: Record<string, string> = {
  low: "border-sky-200 bg-sky-50 text-sky-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  high: "border-red-200 bg-red-50 text-red-700",
};

/** How the lithium exposure arose. Nearly all studies are therapeutic dosing;
 *  the handful that are not (trace levels in drinking water, anorexia
 *  treatment, sub-therapeutic clinical doses, supplements) are not comparable
 *  to them and were previously indistinguishable in this table. */
const EXPOSURE_LABEL: Record<string, string> = {
  therapeutic: "therapeutic",
  drinking_water: "drinking water",
  low_dose_clinical: "low-dose clinical",
  anorexia_treatment: "anorexia tx",
  supplement: "supplement",
};
const EXPOSURE_STYLE: Record<string, string> = {
  // The overwhelming majority — muted so the exceptions carry the eye.
  therapeutic: "border-border text-foreground/45",
};
const EXPOSURE_STYLE_DEFAULT = "border-violet-200 bg-violet-50 text-violet-700";

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] leading-tight ${className}`}
    >
      {label}
    </span>
  );
}

/** The outcome the study actually measured.
 *
 *  Only ~21% of rows carry a usable between-group effect, so most Weight-change
 *  cells read "—". Naming the outcome here is what makes those rows
 *  informative: "no pooled effect" and "nothing was measured" are very
 *  different claims, and the table previously could not tell them apart (the
 *  name existed only in a hover tooltip, and only on the null branch). */
function OutcomeCell({ row }: { row: TrialRow }) {
  if (!row.outcomeName) return <span className="text-foreground/40">—</span>;
  return (
    <div className="leading-tight">
      <div className="text-foreground/80">{row.outcomeName}</div>
      {row.weightMetricLabel && (
        <div className="text-[10px] text-foreground/40">{row.weightMetricLabel}</div>
      )}
    </div>
  );
}

function SerumBandCell({ row }: { row: TrialRow }) {
  const band = row.serumBand;
  if (!band || band === "not_reported")
    return (
      <span className="text-foreground/40" title="No serum lithium level reported.">
        —
      </span>
    );
  return (
    <Badge
      label={SERUM_BAND_LABEL[band] ?? formatLabel(band)}
      className={SERUM_BAND_STYLE[band] ?? "border-border text-foreground/60"}
    />
  );
}

function ExposureCell({ row }: { row: TrialRow }) {
  const ex = row.exposureStratum;
  if (!ex) return <span className="text-foreground/40">—</span>;
  return (
    <Badge
      label={EXPOSURE_LABEL[ex] ?? formatLabel(ex)}
      className={EXPOSURE_STYLE[ex] ?? EXPOSURE_STYLE_DEFAULT}
    />
  );
}

/** Short setting labels for the table cell; the verbatim text is the tooltip. */
const SETTING_CELL: Record<string, string> = {
  inpatient: "Inpatient",
  outpatient: "Outpatient",
  mixed: "In-/outpatient",
  community: "Community",
  other: "—",
};

function rowHref(row: TrialRow): string | null {
  const base = row.doi.split("#")[0];
  if (base.startsWith("10.")) return `https://doi.org/${base}`;
  if (base.startsWith("pmid_")) return `https://pubmed.ncbi.nlm.nih.gov/${base.slice(5)}/`;
  if (row.url) return row.url;
  return null;
}

/** Render a p-value the way journals do. "<0.001" rather than "0.000" (which
 *  reads as exactly zero), and an em dash — never 1.0 — when none was reported:
 *  an unreported p-value is missing data, not a null result. */
function formatP(p: number | null): string {
  if (p == null) return "—";
  if (p < 0.001) return "<0.001";
  return p.toFixed(3);
}

function CitationLine({ row }: { row: TrialRow }) {
  const volParts = [row.volume, row.issue && `(${row.issue})`].filter(Boolean).join("");
  const volPages = [volParts, row.pages].filter(Boolean).join(" ");
  const segs: React.ReactNode[] = [];
  if (row.authors)
    segs.push(row.authors.split(";")[0].trim() + (row.authors.includes(";") ? " et al." : ""));
  if (row.journal || volPages)
    segs.push(
      <>
        {row.journal && <em>{row.journal}</em>}
        {row.journal && volPages ? " " : ""}
        {volPages}
      </>,
    );
  if (row.year) segs.push(`(${row.year})`);
  if (segs.length === 0) return null;
  return (
    <span className="text-foreground/70">
      {segs.map((s, i) => (
        <span key={i}>
          {i > 0 && ". "}
          {s}
        </span>
      ))}
    </span>
  );
}

function Reference({ row }: { row: TrialRow }) {
  const href = rowHref(row);
  return (
    <>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-700 font-medium leading-snug"
        >
          {row.title || row.doi} <ExternalLink size={10} className="inline align-baseline ml-0.5" />
        </a>
      ) : (
        <span className="font-medium leading-snug">{row.title || row.doi}</span>
      )}
      {(row.authors || row.journal || row.year) && (
        <div className="mt-0.5 text-xs">
          <CitationLine row={row} />
        </div>
      )}
    </>
  );
}

/** Dose cell: elemental mg/day over achieved serum level.
 *
 *  Both are shown because neither is available for most studies — 96% of arms
 *  were titrated to a serum target rather than a fixed mg/day, so for many
 *  trials a trial-level mg/day simply does not exist. An assumed salt (the
 *  bipolar-population carbonate assumption) is marked so an imputed dose is
 *  never read as a reported one. */
function DoseCell({ row }: { row: TrialRow }) {
  if (row.elementalMgPerDay == null && row.serumMmolL == null)
    return <span className="text-foreground/40">—</span>;
  return (
    <div className="leading-tight">
      {row.elementalMgPerDay != null && (
        <div className="tabular-nums">
          {fmt(row.elementalMgPerDay)} mg
          {row.saltAssumed && (
            <span
              title="Salt form not stated; read as carbonate (bipolar population). Elemental dose is inferred, not reported."
              className="ml-1 text-amber-600/80 text-[10px]"
            >
              ~
            </span>
          )}
          <span className="text-foreground/40 text-[10px]"> elem./day</span>
        </div>
      )}
      {row.serumMmolL != null && (
        <div className="tabular-nums text-xs text-foreground/60">
          {fmt(row.serumMmolL)} mmol/L
        </div>
      )}
    </div>
  );
}

/** Weight result in the study's OWN metric.
 *
 *  Deliberately not converted to a common unit: kg change and "proportion
 *  gaining >=7%" answer different questions, and the disagreement between them
 *  is the substantive finding of this literature, not a formatting nuisance. */
function WeightCell({ row }: { row: TrialRow }) {
  if (row.effVal == null)
    return (
      <span
        className="text-foreground/40"
        title={row.outcomeName ? `Reported: ${row.outcomeName}` : undefined}
      >
        —
      </span>
    );
  const ci =
    row.ciLo != null && row.ciHi != null ? `[${fmt(row.ciLo)}, ${fmt(row.ciHi)}]` : "";
  return (
    <div className="leading-tight">
      <div className="tabular-nums">
        {fmt(row.effVal)}
        {row.weightMetricLabel && (
          <span className="text-foreground/40 text-[10px]"> {row.weightMetricLabel}</span>
        )}
      </div>
      {ci && <div className="text-xs text-foreground/50 tabular-nums">{ci}</div>}
      <div className="text-[10px] text-foreground/40">
        p {formatP(row.pVal)}
        {row.seFromP && (
          <span title="Standard error derived from the reported p-value (no CI given)."> †</span>
        )}
      </div>
    </div>
  );
}

export function ResultsTable({ rows, pageSize = 100 }: { rows: TrialRow[]; pageSize?: number }) {
  const [sortKey, setSortKey] = useState<SortKey>("year");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(pageSize);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.journal.toLowerCase().includes(q) ||
        (r.authors ?? "").toLowerCase().includes(q) ||
        r.doi.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const sorted = useMemo(() => {
    const mult = dir === "asc" ? 1 : -1;
    // Copy before sorting — mutating would reorder the array the charts index into.
    return [...searched].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // Nulls always last, regardless of direction: "not reported" is not a value.
      if (av == null || av === "") return 1;
      if (bv == null || bv === "") return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * mult;
      return String(av).localeCompare(String(bv)) * mult;
    });
  }, [searched, sortKey, dir]);

  const visible = sorted.slice(0, shown);

  function sortBy(key: SortKey) {
    if (key === sortKey) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setDir("desc");
    }
  }

  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, author, journal, DOI…"
          className="w-full max-w-sm rounded border border-border px-2 py-1 text-sm"
        />
        <span className="text-xs text-foreground/50">
          {visible.length < sorted.length
            ? `showing ${visible.length.toLocaleString()} of ${sorted.length.toLocaleString()} studies`
            : `${sorted.length.toLocaleString()} stud${sorted.length === 1 ? "y" : "ies"}`}
        </span>
      </div>

      {/* Desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <SortTh label="Reference" k="title" active={sortKey} dir={dir} onSort={sortBy} className="w-[22%]" />
              <SortTh label="Design" k="design" active={sortKey} dir={dir} onSort={sortBy} />
              <SortTh label="Diagnosis" k="diagnosisText" active={sortKey} dir={dir} onSort={sortBy} />
              <SortTh label="Setting" k="setting" active={sortKey} dir={dir} onSort={sortBy} />
              <SortTh label="N" k="n" active={sortKey} dir={dir} onSort={sortBy} align="right" />
              <SortTh label="Dose" k="elementalMgPerDay" active={sortKey} dir={dir} onSort={sortBy} />
              <SortTh label="Serum" k="serumBand" active={sortKey} dir={dir} onSort={sortBy} />
              <SortTh label="Duration" k="durationWeeks" active={sortKey} dir={dir} onSort={sortBy} align="right" />
              <SortTh label="Outcome" k="outcomeName" active={sortKey} dir={dir} onSort={sortBy} className="w-[18%]" />
              <SortTh label="Weight change" k="effVal" active={sortKey} dir={dir} onSort={sortBy} />
              <SortTh label="Exposure" k="exposureStratum" active={sortKey} dir={dir} onSort={sortBy} />
              <SortTh label="Risk of bias" k="rob" active={sortKey} dir={dir} onSort={sortBy} />
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.doi} className="border-b border-border/50 align-top hover:bg-foreground/5">
                <td className="px-2 py-2">
                  <Reference row={r} />
                </td>
                <td className="px-2 py-2 text-foreground/70">{formatLabel(r.design)}</td>
                <td className="px-2 py-2 text-xs text-foreground/70">
                  {r.diagnosisText || <span className="text-foreground/40">—</span>}
                </td>
                <td className="px-2 py-2 text-xs text-foreground/70">
                  {/* Bucket label; the verbatim setting is the hover title. */}
                  <span title={r.settingText || undefined}>
                    {SETTING_CELL[r.setting] ?? formatLabel(r.setting)}
                  </span>
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-foreground/70">
                  {r.n?.toLocaleString() ?? "—"}
                </td>
                <td className="px-2 py-2 text-foreground/70">
                  <DoseCell row={r} />
                </td>
                <td className="px-2 py-2">
                  <SerumBandCell row={r} />
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-foreground/70">
                  {r.durationWeeks != null ? `${fmt(r.durationWeeks)} wk` : "—"}
                </td>
                <td className="px-2 py-2 text-xs text-foreground/70">
                  <OutcomeCell row={r} />
                </td>
                <td className="px-2 py-2 text-foreground/70">
                  <WeightCell row={r} />
                </td>
                <td className="px-2 py-2">
                  <ExposureCell row={r} />
                </td>
                <td className="px-2 py-2 text-foreground/70">{formatLabel(r.rob)}</td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={12} className="py-6 text-center text-sm text-foreground/45">
                  No studies match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="space-y-3 md:hidden">
        {visible.map((r) => (
          <div key={r.doi} className="rounded border border-border p-2.5">
            <Reference row={r} />
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/60">
              <span>{formatLabel(r.design)}</span>
              {r.diagnosisText && <span>{r.diagnosisText}</span>}
              {SETTING_CELL[r.setting] && SETTING_CELL[r.setting] !== "—" && (
                <span>{SETTING_CELL[r.setting]}</span>
              )}
              {r.n != null && <span className="tabular-nums">N = {r.n.toLocaleString()}</span>}
              {r.durationWeeks != null && (
                <span className="tabular-nums">{fmt(r.durationWeeks)} wk</span>
              )}
              <span>RoB: {formatLabel(r.rob)}</span>
            </div>
            {/* Badges only when they carry information: a serum band is absent
                on ~half the studies, and "therapeutic" is the unremarkable
                default — showing either would just pad every card. */}
            {(r.exposureStratum && r.exposureStratum !== "therapeutic") ||
            (r.serumBand && r.serumBand !== "not_reported") ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {r.serumBand && r.serumBand !== "not_reported" && (
                  <SerumBandCell row={r} />
                )}
                {r.exposureStratum && r.exposureStratum !== "therapeutic" && (
                  <ExposureCell row={r} />
                )}
              </div>
            ) : null}
            {r.outcomeName && (
              <div className="mt-1.5 text-xs">
                <span className="text-foreground/40">Outcome: </span>
                <span className="text-foreground/70">{r.outcomeName}</span>
                {r.weightMetricLabel && (
                  <span className="text-foreground/40"> ({r.weightMetricLabel})</span>
                )}
              </div>
            )}
            <div className="mt-1.5 flex flex-wrap gap-x-4 text-xs">
              <div>
                <span className="text-foreground/40">Dose: </span>
                <DoseCell row={r} />
              </div>
              <div>
                <span className="text-foreground/40">Weight: </span>
                <WeightCell row={r} />
              </div>
            </div>
          </div>
        ))}
        {!visible.length && (
          <p className="py-6 text-center text-sm text-foreground/45">
            No studies match the current filters.
          </p>
        )}
      </div>

      {sorted.length > shown && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setShown((n) => n + pageSize)}
            className="flex-1 rounded border border-border py-1.5 text-sm text-foreground/70 hover:bg-foreground/5"
          >
            Show {Math.min(pageSize, sorted.length - shown).toLocaleString()} more
          </button>
          <button
            type="button"
            onClick={() => setShown(sorted.length)}
            className="flex-1 rounded border border-border py-1.5 text-sm text-foreground/70 hover:bg-foreground/5"
          >
            Show all {sorted.length.toLocaleString()}
          </button>
        </div>
      )}

      <p className="mt-3 text-xs text-foreground/45">
        Weight is shown in each study&apos;s own metric — kg, BMI, and
        &ldquo;proportion gaining ≥7%&rdquo; are not interchangeable, and the
        disagreement between them is itself a finding. &ldquo;~&rdquo; marks a dose
        inferred from an assumed carbonate salt; &ldquo;†&rdquo; marks a standard
        error derived from a reported p-value. <em>Outcome</em> names what the
        study measured, which is why a row can carry an outcome while its weight
        change reads &ldquo;—&rdquo;: the outcome was reported, but no usable
        between-group effect was. An empty <em>Serum</em> cell means the study
        never reported an achieved lithium level — about half of them do not —
        not that the level was low.
      </p>
    </section>
  );
}

function SortTh({
  label, k, active, dir, onSort, align = "left", className = "",
}: {
  label: string;
  k: SortKey;
  active: SortKey;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const on = active === k;
  return (
    <th
      className={`border-b border-border px-2 py-1.5 text-xs font-semibold text-foreground/60 ${
        align === "right" ? "text-right" : "text-left"
      } ${className}`}
    >
      <button type="button" onClick={() => onSort(k)} className="hover:text-foreground">
        {label}
        {on && <span className="ml-0.5 text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}
