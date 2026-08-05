"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ReplicationsNavbar } from "@/components/ReplicationsNavbar";
import { Footer } from "@/components/Footer";
import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";
import { Input } from "@/components/ui/input";
import { generateCitationHtml, transformCitationHtmlToExplorer, citationSearchText } from "@/lib/citations";
import {
  classifyReportedResult,
  getOutcomeForRow,
  isOriginalSignificant,
  toBinary,
  toNumber,
  toValidR,
} from "@/lib/replicationOutcome";
import INITIATIVE_TAG_NAMES from "@/data/initiative_tag_names.json";
import TOPIC_ONTOLOGY from "@/data/metascience_observatory_topic_ontology.json";

type AnyRecord = Record<string, unknown>;

const ES_TYPE_COLORS: Record<string, string> = {
  "d": "#3b82f6",
  "r": "#10b981",
  "Glass' delta": "#8b5cf6",
  "w": "#ec4899",
  "Cliff's delta": "#14b8a6",
  "OR": "#f59e0b",
  "Other": "#9ca3af",
};
const NAMED_ES_TYPES = new Set(Object.keys(ES_TYPE_COLORS).filter(k => k !== "Other"));
// ES types with incompatible scales (e.g. percentage-point differences) excluded from raw scatterplot
const EXCLUDED_ES_TYPES = new Set(["IRD"]);

type FredResponse = {
  columns: string[];
  rows: AnyRecord[];
  lastUpdated?: string;
};

type Option = { value: string; label: string };

function uniqueValues(rows: AnyRecord[], key: string): string[] {
  const s = new Set<string>();
  for (const r of rows) {
    const v = String(r[key] ?? "");
    if (v) s.add(v);
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b));
}

function formatSig4(value: unknown): string {
  const n = toNumber(value);
  if (n == null) return "";
  const s = Number(n).toPrecision(4);
  if (!/e/i.test(s)) {
    return s.replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, ".0").replace(/\.$/u, "");
  }
  return s;
}

function MiniBar({ value, max, color }: { value: number; max: number; color?: string }) {
  const widthPct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="h-2 bg-black/10 dark:bg-white/10 rounded">
      <div 
        className={`h-2 rounded ${color ? "" : "bg-black/60 dark:bg-white/60"}`}
        style={{ 
          width: `${widthPct}%`,
          ...(color ? { backgroundColor: color } : {})
        }} 
      />
    </div>
  );
}

type ColumnKey =
  | "index"
  | "original_citation_html"
  | "replication_citation_html"
  | "description"
  | "field"
  | "discipline"
  | "subdiscipline"
  | "result"
  | "original_n"
  | "replication_n"
  | "original_es"
  | "replication_es"
  | "original_es_r"
  | "replication_es_r"
  | "original_es_type"
  | "replication_es_type"
  | "original_es_95_CI"
  | "replication_es_95_CI"
  | "original_p_value"
  | "replication_p_value"
  | "original_p_value_type"
  | "replication_p_value_type"
  | "original_p_value_tails"
  | "replication_p_value_tails"
  | "original_authors"
  | "replication_authors"
  | "original_title"
  | "replication_title"
  | "original_journal"
  | "replication_journal"
  | "original_volume"
  | "replication_volume"
  | "original_issue"
  | "replication_issue"
  | "original_pages"
  | "replication_pages"
  | "original_year"
  | "replication_year"
  | "original_url"
  | "replication_url"
  | "tags"
  | "validated"
  | "validated_person"
  | "replication_initiative_tag"
  | "source"
  | "explanation"
  | "ai_version";

const ALL_COLUMNS: Array<{ key: ColumnKey; label: string }> = [
  { key: "index", label: "#" },
  { key: "original_citation_html", label: "Original publication" },
  { key: "replication_citation_html", label: "Replication publication" },
  { key: "description", label: "Description of the original effect" },
  { key: "field", label: "Field" },
  { key: "discipline", label: "Discipline" },
  { key: "subdiscipline", label: "Subdiscipline" },
  { key: "result", label: "Result" },
  { key: "original_n", label: "N (orig)" },
  { key: "replication_n", label: "N (rep)" },
  { key: "original_es", label: "ES (orig)" },
  { key: "replication_es", label: "ES (rep)" },
  { key: "original_es_r", label: "ES_r (orig)" },
  { key: "replication_es_r", label: "ES_r (rep)" },
  { key: "original_es_type", label: "ES type (orig)" },
  { key: "replication_es_type", label: "ES type (rep)" },
  { key: "original_es_95_CI", label: "ES 95% CI (orig)" },
  { key: "replication_es_95_CI", label: "ES 95% CI (rep)" },
  { key: "original_p_value", label: "p-value (orig)" },
  { key: "replication_p_value", label: "p-value (rep)" },
  { key: "original_p_value_type", label: "p-value type (orig)" },
  { key: "replication_p_value_type", label: "p-value type (rep)" },
  { key: "original_p_value_tails", label: "p-value tails (orig)" },
  { key: "replication_p_value_tails", label: "p-value tails (rep)" },
  { key: "original_authors", label: "Original authors" },
  { key: "replication_authors", label: "Replication authors" },
  { key: "original_title", label: "Original title" },
  { key: "replication_title", label: "Replication title" },
  { key: "original_journal", label: "Original journal" },
  { key: "replication_journal", label: "Replication journal" },
  { key: "original_volume", label: "Original volume" },
  { key: "replication_volume", label: "Replication volume" },
  { key: "original_issue", label: "Original issue" },
  { key: "replication_issue", label: "Replication issue" },
  { key: "original_pages", label: "Original pages" },
  { key: "replication_pages", label: "Replication pages" },
  { key: "original_year", label: "Original year" },
  { key: "replication_year", label: "Replication year" },
  { key: "original_url", label: "Original URL" },
  { key: "replication_url", label: "Replication URL" },
  { key: "tags", label: "Tags" },
  { key: "validated", label: "Human Validated" },
  { key: "validated_person", label: "Validated Person" },
  { key: "replication_initiative_tag", label: "Replication Initiative" },
  { key: "source", label: "Source" },
  { key: "explanation", label: "Explanation" },
  { key: "ai_version", label: "AI Version" },
];

const DEFAULT_COLUMNS: ColumnKey[] = [
  "index",
  "original_citation_html",
  "replication_citation_html",
  "description",
  "result",
  "original_n",
  "replication_n",
  "original_es",
  "replication_es",
  "original_es_r",
  "replication_es_r",
  "validated",
];

export default function ReplicationsDatabasePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ReplicationsDatabaseContent />
    </Suspense>
  );
}

function ReplicationsDatabaseContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [data, setData] = useState<FredResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [field, setField] = useState<string>("");
  const [discipline, setDiscipline] = useState<string>(searchParams.get("discipline") || "");
  const [subdiscipline, setSubdiscipline] = useState<string>(searchParams.get("subdiscipline") || "");
  const [result, setResult] = useState<string>("");
  const [initiative, setInitiative] = useState<string>(searchParams.get("initiative") || "");
  const [replicationType, setReplicationType] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState<string>("");
  const [originalAuthorSearch, setOriginalAuthorSearch] = useState<string>(searchParams.get("original_author_search") || "");
  const [originalJournalSearch, setOriginalJournalSearch] = useState<string>(searchParams.get("original_journal_search") || "");
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    new Set(DEFAULT_COLUMNS)
  );
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [outcomeMethod, setOutcomeMethod] = useState<"significance" | "orig_in_rep_ci" | "rep_in_orig_ci">("significance");

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/fred", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as FredResponse;
        setData(json);
        setLastUpdated(json.lastUpdated || null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // One-time effect: derive field (and discipline) from URL params on mount
  useEffect(() => {
    const initDisc = searchParams.get("discipline") || "";
    const initSub = searchParams.get("subdiscipline") || "";
    const ont = TOPIC_ONTOLOGY as Record<string, Record<string, string[]>>;

    if (initSub) {
      for (const [fieldName, disciplines] of Object.entries(ont)) {
        for (const [discName, subs] of Object.entries(disciplines as Record<string, string[]>)) {
          if ((subs as string[]).includes(initSub)) {
            if (!initDisc) setDiscipline(discName);
            setField(fieldName);
            return;
          }
        }
      }
    } else if (initDisc) {
      for (const [fieldName, disciplines] of Object.entries(ont)) {
        if (initDisc in (disciplines as Record<string, string[]>)) {
          setField(fieldName);
          return;
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync initiative filter to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (initiative) {
      params.set("initiative", initiative);
    } else {
      params.delete("initiative");
    }
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    router.replace(newUrl, { scroll: false });
  }, [initiative, searchParams, router]);

  // Build ontology lookup maps
  const ontologyMaps = useMemo(() => {
    const disciplineToField = new Map<string, string>();
    const disciplineToSubs = new Map<string, string[]>();

    const ont = TOPIC_ONTOLOGY as Record<string, Record<string, string[]>>;
    for (const [fieldName, disciplines] of Object.entries(ont)) {
      for (const [discName, subs] of Object.entries(disciplines)) {
        disciplineToField.set(discName, fieldName);
        disciplineToSubs.set(discName, subs);
      }
    }
    return { disciplineToField, disciplineToSubs };
  }, []);

  // Field options: count rows per field, only show fields with data
  const fieldOptions: Option[] = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const r of data.rows) {
      const f = String(r.field ?? "").trim();
      if (f) counts.set(f, (counts.get(f) || 0) + 1);
    }
    const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return [
      { value: "", label: "All fields" },
      ...entries.map(([k, c]) => ({ value: k, label: `${k} (${c})` })),
    ];
  }, [data]);

  // Discipline options: constrained by selected field, count from data
  const disciplineOptions: Option[] = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const r of data.rows) {
      const disc = String(r.discipline ?? "").trim();
      if (!disc) continue;
      if (field && String(r.field ?? "").trim() !== field) continue;
      counts.set(disc, (counts.get(disc) || 0) + 1);
    }
    const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return [
      { value: "", label: "All disciplines" },
      ...entries.map(([k, c]) => ({ value: k, label: `${k} (${c})` })),
    ];
  }, [data, field]);

  // Subdiscipline options: constrained by selected discipline (or field), count from data
  const subdisciplineOptions: Option[] = useMemo(() => {
    if (!data) return [];
    // Constrain to ontology-defined subs when a discipline is selected
    const allowedSubs: Set<string> | null = discipline
      ? new Set(ontologyMaps.disciplineToSubs.get(discipline) || [])
      : null;
    // Filter rows by field/discipline to get accurate counts
    const counts = new Map<string, number>();
    for (const r of data.rows) {
      const rowDisc = String(r.discipline ?? "").trim();
      if (field && String(r.field ?? "").trim() !== field) continue;
      if (discipline && rowDisc !== discipline) continue;
      const raw = String(r.subdiscipline ?? "").trim();
      if (!raw) continue;
      const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
      for (const part of parts) {
        if (allowedSubs && !allowedSubs.has(part)) continue;
        counts.set(part, (counts.get(part) || 0) + 1);
      }
    }
    const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return [
      { value: "", label: "All subdisciplines" },
      ...entries.map(([k, c]) => ({ value: k, label: `${k} (${c})` })),
    ];
  }, [data, field, discipline, ontologyMaps]);

  const resultOptions: Option[] = useMemo(() => {
    if (!data) return [];
    return ["", ...uniqueValues(data.rows, "result")].map((v) => ({ value: v, label: v || "All results" }));
  }, [data]);

  const replicationTypeOptions: Option[] = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const r of data.rows) {
      const v = String(r.replication_type ?? "").trim();
      if (v) counts.set(v, (counts.get(v) || 0) + 1);
    }
    const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return [
      { value: "", label: "All types" },
      ...entries.map(([k, c]) => ({ value: k, label: `${k} (${c})` })),
    ];
  }, [data]);

  const initiativeOptions: Option[] = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const r of data.rows) {
      const tag = String(r.replication_initiative_tag ?? "").trim();
      if (tag) counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    const entries = Array.from(counts.entries());
    const tagNames: Record<string, string> = INITIATIVE_TAG_NAMES;
    entries.sort((a, b) => {
      const nameA = tagNames[a[0]] || a[0];
      const nameB = tagNames[b[0]] || b[0];
      return nameA.localeCompare(nameB);
    });
    return [
      { value: "", label: "All initiatives" },
      ...entries.map(([tag, count]) => ({
        value: tag,
        label: `${tagNames[tag] || tag} (${count})`,
      })),
    ];
  }, [data]);

  const filteredRows = useMemo(() => {
    if (!data) return [] as AnyRecord[];
    return data.rows.filter((r) => {
      if (field && String(r.field ?? "").trim() !== field) return false;
      if (discipline && !String(r.discipline ?? "").split(",").map((s) => s.trim()).includes(discipline)) return false;
      if (subdiscipline && !String(r.subdiscipline ?? "").split(",").map((s) => s.trim()).includes(subdiscipline)) return false;
      if (result && String(r.result ?? "") !== result) return false;
      if (initiative && String(r.replication_initiative_tag ?? "").trim() !== initiative) return false;
      if (replicationType.size > 0 && !replicationType.has(String(r.replication_type ?? "").trim())) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = `${r.original_title ?? ""} ${r.replication_title ?? ""} ${r.description ?? ""} ${r.tags ?? ""} ${citationSearchText(r.original_authors as string, r.original_journal as string, r.original_year as string)} ${citationSearchText(r.replication_authors as string, r.replication_journal as string, r.replication_year as string)}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      if (originalAuthorSearch) {
        const s = originalAuthorSearch.toLowerCase();
        const authors = String(r.original_authors ?? "").toLowerCase();
        if (!authors.includes(s)) return false;
      }
      if (originalJournalSearch) {
        const s = originalJournalSearch.toLowerCase();
        const journal = String(r.original_journal ?? "").toLowerCase();
        if (journal !== s) return false;
      }
      return true;
    });
  }, [data, field, discipline, subdiscipline, result, initiative, replicationType, search, originalAuthorSearch, originalJournalSearch]);

  // Compute outcomes once and share between stats and scatterplot
  // Includes rows with es_r (plottable on scatterplot) AND rows with only raw ES (stats only)
  // oAdj/rAdj are NaN for rows without es_r — scatterplot filters these out
  const computedOutcomes = useMemo(() => {
    const results: Array<{
      row: AnyRecord;
      outcome: "success" | "failure" | "reversal" | "inconclusive";
      // Scatterplot coordinates: NaN when es_r not available (raw-ES-only rows)
      oAdj: number;
      rAdj: number;
      desc: string;
      origNonsig: boolean;
    }> = [];

    for (const r of filteredRows) {
      const eO = toValidR(r.original_es_r);
      const eR = toValidR(r.replication_es_r);
      const hasESR = eO != null && eR != null && eO !== 0 && eR !== 0;

      // Also check if row has raw ES data (for CI/significance fallback)
      const eO_raw = toNumber(r.original_es);
      const eR_raw = toNumber(r.replication_es);
      const hasRawES = eO_raw != null && eR_raw != null;

      // Skip rows with neither es_r nor raw ES
      if (!hasESR && !hasRawES) continue;

      const outcome = getOutcomeForRow(r, outcomeMethod);

      // Skip rows that produce inconclusive AND have no es_r (nothing useful to contribute)
      if (outcome === "inconclusive" && !hasESR) continue;

      // Scatterplot coordinates: only when es_r available
      const oAdj = hasESR ? Math.abs(eO!) : NaN;
      const rAdj = hasESR ? (eO! >= 0 ? eR! : -eR!) : NaN;

      results.push({
        row: r,
        outcome,
        oAdj,
        rAdj,
        desc: String(r.description || r.tags || ""),
        origNonsig: isOriginalSignificant(r) === false,
      });
    }

    return results;
  }, [filteredRows, outcomeMethod]);

  const rawESPoints = useMemo(() => {
    const results: Array<{ origES: number; repES: number; esType: string; desc: string }> = [];
    for (const r of filteredRows) {
      const oRaw = toNumber(r.original_es);
      const rRaw = toNumber(r.replication_es);
      if (oRaw == null || rRaw == null) continue;
      const rawType = String(r.original_es_type ?? "").trim();
      if (EXCLUDED_ES_TYPES.has(rawType)) continue;
      const esType = NAMED_ES_TYPES.has(rawType) ? rawType : "Other";
      results.push({ origES: oRaw, repES: rRaw, esType, desc: String(r.description || r.tags || "") });
    }
    return results;
  }, [filteredRows]);

  // Stat for outcome mix - uses precomputed outcomes
  // For significance method: sample sizes needed (to compute p from r)
  // For CI methods: pre-computed CIs don't need sample sizes, so skip the gate
  const outcomeStat = useMemo(() => {
    let n = 0;
    let success = 0;
    let failure = 0;
    let reversal = 0;
    let inconclusive = 0;

    for (const { row, outcome } of computedOutcomes) {
      // For significance method, require sample sizes (needed to compute p from r)
      if (outcomeMethod === "significance") {
        const nO = toNumber(row.original_n ?? row.n_original);
        const nR = toNumber(row.replication_n ?? row.n_replication);
        if (nO == null || nR == null || nO <= 0 || nR <= 0) continue;
      }

      n++;

      if (outcome === "success") success++;
      else if (outcome === "failure") failure++;
      else if (outcome === "reversal") reversal++;
      else inconclusive++;
    }

    const pct = (v: number) => (n > 0 ? Math.round((v / n) * 1000) / 10 : 0);
    const rateN = success + failure + reversal;
    return {
      n,
      success,
      failure,
      reversal,
      inconclusive,
      pctSuccess: pct(success),
      pctFailure: pct(failure),
      pctReversal: pct(reversal),
      pctInconclusive: pct(inconclusive),
      rateN,
      rate: rateN > 0 ? Math.round((success / rateN) * 1000) / 10 : null,
    };
  }, [computedOutcomes, outcomeMethod]);

  // Stat for result column-based display.
  //
  // Two distinct quantities live here and must not be confused:
  //  - the OUTCOME MIX, whose denominator `n` is every row with a recorded
  //    result (inconclusive included) — this is a composition, not a rate;
  //  - the SUCCESS RATE, whose denominator `rateN` is success+failure+reversal,
  //    per SUCCESS_RATE_DEFINITION. This is the number every other page shows.
  const resultStat = useMemo(() => {
    let n = 0;
    let success = 0;
    let failure = 0;
    let reversal = 0;
    let inconclusive = 0;

    for (const r of filteredRows) {
      const outcome = classifyReportedResult(r.result);
      // Skip rows with no result at all — they belong to neither quantity.
      if (!String(r.result ?? "").trim()) continue;
      n++;
      if (outcome === "success") {
        success++;
      } else if (outcome === "failure") {
        failure++;
      } else if (outcome === "reversal") {
        reversal++;
      } else {
        inconclusive++;
      }
    }
    const pct = (v: number) => (n > 0 ? Math.round((v / n) * 1000) / 10 : 0);
    const rateN = success + failure + reversal;
    return {
      n,
      success,
      failure,
      reversal,
      inconclusive,
      pctSuccess: pct(success),
      pctFailure: pct(failure),
      pctReversal: pct(reversal),
      pctInconclusive: pct(inconclusive),
      rateN,
      rate: rateN > 0 ? Math.round((success / rateN) * 1000) / 10 : null,
    };
  }, [filteredRows]);

  const yearBins = useMemo(() => {
    const entries: Array<{ year: number; outcome: "success" | "failure" | null }> = [];
    for (const r of filteredRows) {
      const yearRaw = toNumber(r.original_year);
      if (yearRaw == null || yearRaw < 1900 || yearRaw > 2030) continue;
      const year = Math.floor(yearRaw);
      const res = String(r.result ?? "").trim();
      if (!res) continue;
      entries.push({ year, outcome: toBinary(classifyReportedResult(res)) });
    }
    if (entries.length === 0) return [];

    const minYear = Math.min(...entries.map(e => e.year));
    const maxYear = Math.max(...entries.map(e => e.year));
    const binStart = Math.floor(minYear / 5) * 5;
    const binEnd = Math.floor(maxYear / 5) * 5;

    const bins: Array<{
      label: string;
      total: number;
      success: number;
      failure: number;
      inconclusive: number;
      rateN: number;
      rate: number;
    }> = [];

    for (let start = binStart; start <= binEnd; start += 5) {
      const end = start + 4;
      const inBin = entries.filter(e => e.year >= start && e.year <= end);
      const total = inBin.length;
      // Canonical rate: reversal counts as a failure and inconclusive rows are
      // excluded from the denominator, so `rateN` (not `total`) is the base.
      const success = inBin.filter(e => e.outcome === "success").length;
      const failure = inBin.filter(e => e.outcome === "failure").length;
      const inconclusive = total - success - failure;
      const rateN = success + failure;
      const rate = rateN >= 20 ? Math.round((success / rateN) * 1000) / 10 : -1;
      bins.push({
        label: `${start}-${String(end).slice(2)}`,
        total,
        success,
        failure,
        inconclusive,
        rateN,
        rate,
      });
    }
    // Trim leading and trailing bins that lack sufficient data
    const firstValid = bins.findIndex(b => b.rate >= 0);
    const lastValid = bins.length - 1 - [...bins].reverse().findIndex(b => b.rate >= 0);
    if (firstValid < 0) return [];
    return bins.slice(firstValid, lastValid + 1);
  }, [filteredRows]);

  // Count unique papers for the subtitle
  const uniquePaperCount = useMemo(() => {
    const urls = new Set<string>();
    for (const r of filteredRows) {
      const url = String(r.original_url ?? "").trim();
      const res = String(r.result ?? "").trim();
      const yearRaw = toNumber(r.original_year);
      if (url && res && yearRaw != null && yearRaw >= 1900 && yearRaw <= 2030) {
        urls.add(url);
      }
    }
    return urls.size;
  }, [filteredRows]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <ReplicationsNavbar />
        <main className="pt-24 px-6 sm:px-8 md:px-12 lg:px-16 xl:px-24 py-10">
          <div className="mx-auto max-w-[90%]">
            <p className="opacity-70">Loading data…</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen">
        <ReplicationsNavbar />
        <main className="pt-24 px-6 sm:px-8 md:px-12 lg:px-16 xl:px-24 py-10">
          <div className="mx-auto max-w-[90%]">
            <p className="text-red-600 dark:text-red-400">Failed to load: {error || "No data"}</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <ReplicationsNavbar />
      <main className="pt-24 px-6 sm:px-8 md:px-12 lg:px-16 xl:px-24 py-10">


      {/* Controls */}
      <section className="mx-auto max-w-[90%] mt-6">
        <div className="grid gap-3 md:grid-cols-7 items-end">
          <div className="md:col-span-1">
            <label htmlFor="field" className="block text-sm font-medium opacity-80 mb-1">Field</label>
            <select
              id="field"
              value={field}
              onChange={(e) => {
                setField(e.target.value);
                setDiscipline("");
                setSubdiscipline("");
              }}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {fieldOptions.map((opt) => (
                <option key={opt.value || "__all"} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label htmlFor="discipline" className="block text-sm font-medium opacity-80 mb-1">Discipline</label>
            <select
              id="discipline"
              value={discipline}
              onChange={(e) => {
                const val = e.target.value;
                setDiscipline(val);
                setSubdiscipline("");
                if (val) {
                  const parentField = ontologyMaps.disciplineToField.get(val);
                  if (parentField) setField(parentField);
                }
              }}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {disciplineOptions.map((opt) => (
                <option key={opt.value || "__all"} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label htmlFor="subdiscipline" className="block text-sm font-medium opacity-80 mb-1">Subdiscipline</label>
            <select
              id="subdiscipline"
              value={subdiscipline}
              onChange={(e) => {
                const val = e.target.value;
                setSubdiscipline(val);
                if (val) {
                  // Find parent discipline and field from ontology
                  for (const [discName, subs] of ontologyMaps.disciplineToSubs.entries()) {
                    if (subs.includes(val)) {
                      setDiscipline(discName);
                      const parentField = ontologyMaps.disciplineToField.get(discName);
                      if (parentField) setField(parentField);
                      break;
                    }
                  }
                }
              }}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {subdisciplineOptions.map((opt) => (
                <option key={opt.value || "__all"} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label htmlFor="initiative" className="block text-sm font-medium opacity-80 mb-1">
              Replication Initiative <Link href="/replication-initiatives" className="text-xs opacity-60 hover:opacity-80 underline">(more info)</Link>
            </label>
            <select
              id="initiative"
              value={initiative}
              onChange={(e) => setInitiative(e.target.value)}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {initiativeOptions.map((opt) => (
                <option key={opt.value || "__all"} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label htmlFor="replication-type" className="block text-sm font-medium opacity-80 mb-1">
              Replication Type <Link href="/docs/defining-replication" className="text-xs opacity-60 hover:opacity-80 underline">(more info)</Link>
            </label>
            <MultiSelectDropdown
              id="replication-type"
              label="All types"
              options={replicationTypeOptions}
              selected={replicationType}
              onChange={setReplicationType}
            />
          </div>
          <div className="md:col-span-2">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label htmlFor="search" className="block text-sm font-medium opacity-80 mb-1">Search</label>
                <Input
                  id="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search titles, authors, description, tags, or references"
                  className="h-10 w-full"
                />
              </div>
              <div className="flex flex-col items-end shrink-0">
                <a href="/replications-database/by-discipline" className="text-sm underline hover:opacity-80 whitespace-nowrap">
                  Replication rate by discipline
                </a>
                <a href="/replications-database/by-journal" className="text-sm underline hover:opacity-80 whitespace-nowrap">
                  Replication rate by journal
                </a>
                <details className="relative">
                  <summary className="text-sm underline hover:opacity-80 whitespace-nowrap cursor-pointer list-none text-right">
                    Show other pages
                  </summary>
                  <div className="absolute right-0 z-20 mt-1 flex w-max flex-col items-start gap-1 rounded-md border bg-background p-3 shadow-md">
                    <a href="/replications-database/by-p-value" className="text-sm underline hover:opacity-80 whitespace-nowrap">
                      Replication rate by original p-value
                    </a>
                    <a href="/replications-database/by-impact-factor" className="text-sm underline hover:opacity-80 whitespace-nowrap">
                      Replication rate by journal impact factor
                    </a>
                    <a href="/replications-database/by-journal-rank" className="text-sm underline hover:opacity-80 whitespace-nowrap">
                      Replication rate by journal rank
                    </a>
                    <a href="/replications-database/by-citation-count" className="text-sm underline hover:opacity-80 whitespace-nowrap">
                      Replication rate by citation count
                    </a>
                    <a href="/replications-database/by-h-index" className="text-sm underline hover:opacity-80 whitespace-nowrap">
                      Replication rate by author h-index
                    </a>
                    <a href="/replications-database/by-author-overlap" className="text-sm underline hover:opacity-80 whitespace-nowrap">
                      Replication rate by author overlap
                    </a>
                    <a href="/replications-database/by-year" className="text-sm underline hover:opacity-80 whitespace-nowrap">
                      Replication rate by year
                    </a>
                    <a href="/replications-database/correlates-of-reproducibility" className="text-sm underline hover:opacity-80 whitespace-nowrap">
                      Correlates of reproducibility (summary)
                    </a>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </div>
      </section>

      {(originalAuthorSearch || originalJournalSearch) && (
        <section className="mx-auto max-w-[90%] mt-4 space-y-2">
          {originalAuthorSearch && (
            <div className="flex items-center gap-2 text-sm bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded px-3 py-2">
              <span>Filtered to original author: <strong>{originalAuthorSearch}</strong></span>
              <button
                onClick={() => setOriginalAuthorSearch("")}
                className="ml-1 text-blue-600 dark:text-blue-400 hover:underline"
              >
                Clear
              </button>
            </div>
          )}
          {originalJournalSearch && (
            <div className="flex items-center gap-2 text-sm bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded px-3 py-2">
              <span>Filtered to original journal: <strong>{originalJournalSearch}</strong></span>
              <button
                onClick={() => setOriginalJournalSearch("")}
                className="ml-1 text-blue-600 dark:text-blue-400 hover:underline"
              >
                Clear
              </button>
            </div>
          )}
        </section>
      )}

      <section className="mx-auto max-w-[90%] grid md:grid-cols-3 gap-4 mt-6">
        <div className="border rounded p-4">
          <div className="text-xs font-medium mb-2">Outcome mix -- human or AI judgement <span className="font-bold">({resultStat.n} effect replications)</span></div>
          <div className="space-y-1">
            {(["success", "inconclusive", "failure"] as const).map((outcome) => {
              const label = outcome.charAt(0).toUpperCase() + outcome.slice(1);
              const color = outcome === "success" ? "#10b981" : outcome === "inconclusive" ? "#9ca3af" : "#f87171";
              const pct = outcome === "success" ? resultStat.pctSuccess : outcome === "inconclusive" ? resultStat.pctInconclusive : resultStat.pctFailure;
              const count = outcome === "success" ? resultStat.success : outcome === "inconclusive" ? resultStat.inconclusive : resultStat.failure;
              const isActive = result === outcome;
              return (
                <button
                  key={outcome}
                  onClick={() => setResult(isActive ? "" : outcome)}
                  className={`flex items-center gap-2 w-full rounded px-1 py-0.5 text-left transition-colors ${isActive ? "bg-black/10 dark:bg-white/10 ring-1 ring-inset ring-black/20 dark:ring-white/20" : "hover:bg-black/5 dark:hover:bg-white/5"}`}
                  title={isActive ? `Clear filter` : `Filter table to ${label} replications`}
                >
                  <div className="w-20 text-xs">{label}</div>
                  <div className="flex-1"><MiniBar value={pct} max={100} color={color} /></div>
                  <div className="w-20 text-right text-xs">{count} ({pct}%)</div>
                </button>
              );
            })}
            {resultStat.reversal > 0 && (() => {
              const isActive = result === "reversal";
              return (
                <button
                  onClick={() => setResult(isActive ? "" : "reversal")}
                  className={`flex items-center gap-2 w-full rounded px-1 py-0.5 text-left transition-colors ${isActive ? "bg-black/10 dark:bg-white/10 ring-1 ring-inset ring-black/20 dark:ring-white/20" : "hover:bg-black/5 dark:hover:bg-white/5"}`}
                  title={isActive ? `Clear filter` : `Filter table to Reversal replications`}
                >
                  <div className="w-20 text-xs">Reversal</div>
                  <div className="flex-1"><MiniBar value={resultStat.pctReversal} max={100} color="#b91c1c" /></div>
                  <div className="w-20 text-right text-xs">{resultStat.reversal} ({resultStat.pctReversal}%)</div>
                </button>
              );
            })()}
          </div>
          <div className="border-t mt-3 pt-3">
            <div className="text-xs font-medium mb-2">Outcome mix - computed from stats when available <span className="font-bold">({outcomeStat.n} effect replications)</span></div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-20 text-xs">Success</div>
                <div className="flex-1"><MiniBar value={outcomeStat.pctSuccess} max={100} color="#10b981" /></div>
                <div className="w-20 text-right text-xs">{outcomeStat.success} ({outcomeStat.pctSuccess}%)</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-20 text-xs">Failure</div>
                <div className="flex-1"><MiniBar value={outcomeStat.pctFailure} max={100} color="#f87171" /></div>
                <div className="w-20 text-right text-xs">{outcomeStat.failure} ({outcomeStat.pctFailure}%)</div>
              </div>
              {outcomeMethod === "significance" && (
                <div className="flex items-center gap-2">
                  <div className="w-20 text-xs">Reversal</div>
                  <div className="flex-1"><MiniBar value={outcomeStat.pctReversal} max={100} color="#b91c1c" /></div>
                  <div className="w-20 text-right text-xs">{outcomeStat.reversal} ({outcomeStat.pctReversal}%)</div>
                </div>
              )}
            </div>
            <div className="mt-2">
              <label className="block text-xs font-medium opacity-80 mb-1">
                Method for determining replication outcome from stats{" "}
                <a
                  href="/docs/replication-outcome-classification"
                  className="text-[10px] opacity-60 hover:opacity-80 underline"
                >
                  more info
                </a>
              </label>
              <select
                value={outcomeMethod}
                onChange={(e) => setOutcomeMethod(e.target.value as "significance" | "orig_in_rep_ci" | "rep_in_orig_ci")}
                className="w-full h-6 text-[9px] rounded-md border border-border bg-background px-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="significance">Statistically significant effect in the same direction?</option>
                <option value="orig_in_rep_ci">Original effect size in replication 95% confidence interval?</option>
                <option value="rep_in_orig_ci">Replication effect size in original 95% confidence interval?</option>
              </select>
            </div>
          </div>
        </div>
        <div className="border rounded p-4">
          <div className="text-xs font-medium mb-2">Replication Effect Size vs Original Effect Size - Converted to Standard Scale <span className="font-bold">({computedOutcomes.filter(p => p.outcome !== "inconclusive" && Number.isFinite(p.oAdj)).length} effect replications)</span></div>
          <div className="mt-2">
            <InlineScatter points={computedOutcomes.filter(p => p.outcome !== "inconclusive" && Number.isFinite(p.oAdj) && Number.isFinite(p.rAdj))} showReversal={outcomeMethod === "significance"} markOrigNonsig={outcomeMethod === "significance"} />
          </div>
        </div>
        <div className="border rounded p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="text-xs font-medium">
              Experiment Replication Success Rate by Year of Original Publication{" "}
              <span className="font-bold">
                ({`${yearBins.filter(b => b.rate >= 0).reduce((s, b) => s + b.rateN, 0)} classified effect replications from ${uniquePaperCount} original papers`})
              </span>
            </div>
            <a
              href="/replications-database/by-year"
              className="text-xs underline hover:opacity-80 ml-4 shrink-0"
            >
              more info
            </a>
          </div>
          <div className="mt-2">
            <InlineYearBars bins={yearBins} threshold={20} binSize={5} />
          </div>
        </div>
        {/* Raw effect sizes scatterplot - hidden for now
        <div className="border rounded p-4">
          <div className="text-sm opacity-70">Raw Effect Sizes ({rawESPoints.length} replications)</div>
          <div className="mt-2">
            <RawESScatter points={rawESPoints} />
          </div>
        </div>
        */}
      </section>

      <section className="mx-auto max-w-[90%] border rounded mt-6">
        <div className="p-2 border-b flex items-center justify-between">
          <h3 className="font-medium">Data Table</h3>
          <div className="relative">
            <button
              onClick={() => setShowColumnSelector(!showColumnSelector)}
              className="px-3 py-1 text-sm border rounded hover:bg-black/5 dark:hover:bg-white/5"
            >
              Columns ({visibleColumns.size})
            </button>
            {showColumnSelector && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowColumnSelector(false)}
                />
                <div className="absolute right-0 mt-2 w-64 bg-background border rounded shadow-lg z-20 p-3 max-h-96 overflow-y-auto">
                  <div className="mb-2 text-xs font-semibold opacity-70">Select columns to display</div>
                  {ALL_COLUMNS.map((col) => (
                    <label key={col.key} className="flex items-center gap-2 p-1 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(col.key)}
                        onChange={(e) => {
                          const newSet = new Set(visibleColumns);
                          if (e.target.checked) {
                            newSet.add(col.key);
                          } else {
                            newSet.delete(col.key);
                          }
                          setVisibleColumns(newSet);
                        }}
                        className="cursor-pointer"
                      />
                      <span className="text-sm">{col.label}</span>
                    </label>
                  ))}
                  <div className="mt-2 pt-2 border-t flex gap-2">
                    <button
                      onClick={() => setVisibleColumns(new Set(DEFAULT_COLUMNS))}
                      className="text-xs px-2 py-1 border rounded hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => setVisibleColumns(new Set(ALL_COLUMNS.map(c => c.key)))}
                      className="text-xs px-2 py-1 border rounded hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      Select All
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="overflow-x-auto overflow-y-auto h-[calc(100vh-400px)] max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b bg-background dark:bg-background">
                {visibleColumns.has("index") && <th className="text-right p-2">#</th>}
                {visibleColumns.has("original_citation_html") && <th className="text-left p-2">Original publication</th>}
                {visibleColumns.has("replication_citation_html") && <th className="text-left p-2">Replication publication</th>}
                {visibleColumns.has("description") && <th className="text-left p-2">Description of the original effect</th>}
                {visibleColumns.has("field") && <th className="text-left p-2">Field</th>}
                {visibleColumns.has("discipline") && <th className="text-left p-2">Discipline</th>}
                {visibleColumns.has("subdiscipline") && <th className="text-left p-2">Subdiscipline</th>}
                {visibleColumns.has("result") && <th className="text-left p-2">Result</th>}
                {visibleColumns.has("original_n") && <th className="text-right p-2">N (orig)</th>}
                {visibleColumns.has("replication_n") && <th className="text-right p-2">N (rep)</th>}
                {visibleColumns.has("original_es") && <th className="text-right p-2">ES (orig)</th>}
                {visibleColumns.has("replication_es") && <th className="text-right p-2">ES (rep)</th>}
                {visibleColumns.has("original_es_r") && <th className="text-right p-2"><a href="/docs/effect-size-normalization" className="underline hover:opacity-80">ES_r(orig)</a></th>}
                {visibleColumns.has("replication_es_r") && <th className="text-right p-2"><a href="/docs/effect-size-normalization" className="underline hover:opacity-80">ES_r(rep)</a></th>}
                {visibleColumns.has("original_es_type") && <th className="text-right p-2">ES type (orig)</th>}
                {visibleColumns.has("replication_es_type") && <th className="text-right p-2">ES type (rep)</th>}
                {visibleColumns.has("original_es_95_CI") && <th className="text-right p-2">ES 95% CI (orig)</th>}
                {visibleColumns.has("replication_es_95_CI") && <th className="text-right p-2">ES 95% CI (rep)</th>}
                {visibleColumns.has("original_p_value") && <th className="text-right p-2">p-value (orig)</th>}
                {visibleColumns.has("replication_p_value") && <th className="text-right p-2">p-value (rep)</th>}
                {visibleColumns.has("original_p_value_type") && <th className="text-left p-2">p-value type (orig)</th>}
                {visibleColumns.has("replication_p_value_type") && <th className="text-left p-2">p-value type (rep)</th>}
                {visibleColumns.has("original_p_value_tails") && <th className="text-left p-2">p-value tails (orig)</th>}
                {visibleColumns.has("replication_p_value_tails") && <th className="text-left p-2">p-value tails (rep)</th>}
                {visibleColumns.has("original_authors") && <th className="text-left p-2">Original authors</th>}
                {visibleColumns.has("replication_authors") && <th className="text-left p-2">Replication authors</th>}
                {visibleColumns.has("original_title") && <th className="text-left p-2">Original title</th>}
                {visibleColumns.has("replication_title") && <th className="text-left p-2">Replication title</th>}
                {visibleColumns.has("original_journal") && <th className="text-left p-2">Original journal</th>}
                {visibleColumns.has("replication_journal") && <th className="text-left p-2">Replication journal</th>}
                {visibleColumns.has("original_volume") && <th className="text-right p-2">Original volume</th>}
                {visibleColumns.has("replication_volume") && <th className="text-right p-2">Replication volume</th>}
                {visibleColumns.has("original_issue") && <th className="text-left p-2">Original issue</th>}
                {visibleColumns.has("replication_issue") && <th className="text-left p-2">Replication issue</th>}
                {visibleColumns.has("original_pages") && <th className="text-left p-2">Original pages</th>}
                {visibleColumns.has("replication_pages") && <th className="text-left p-2">Replication pages</th>}
                {visibleColumns.has("original_year") && <th className="text-right p-2">Original year</th>}
                {visibleColumns.has("replication_year") && <th className="text-right p-2">Replication year</th>}
                {visibleColumns.has("original_url") && <th className="text-left p-2">Original URL</th>}
                {visibleColumns.has("replication_url") && <th className="text-left p-2">Replication URL</th>}
                {visibleColumns.has("tags") && <th className="text-left p-2">Tags</th>}
                {visibleColumns.has("validated") && <th className="text-left p-2">Human Validated</th>}
                {visibleColumns.has("validated_person") && <th className="text-left p-2">Validated Person</th>}
                {visibleColumns.has("replication_initiative_tag") && <th className="text-left p-2">Replication Initiative</th>}
                {visibleColumns.has("source") && <th className="text-left p-2">Source</th>}
                {visibleColumns.has("explanation") && <th className="text-left p-2">Explanation</th>}
                {visibleColumns.has("ai_version") && <th className="text-left p-2">AI Version</th>}
              </tr>
            </thead>
            <tbody>
              {filteredRows.slice(0, 2000).map((r, i) => {
                // Check if original data exists (not just empty strings)
                const origNVal = r.original_n ?? r.n_original;
                const repNVal = r.replication_n ?? r.n_replication;
                const origESVal = r.original_es_r ?? r.es_original;
                const repESVal = r.replication_es_r ?? r.es_replication;
                
                // Only convert to number if value exists and is not empty
                // Don't convert "0" strings if they represent missing data (empty in CSV = missing)
                const nO = origNVal != null && String(origNVal).trim() !== "" ? toNumber(origNVal) : null;
                const nR = repNVal != null && String(repNVal).trim() !== "" ? toNumber(repNVal) : null;
                const eO = origESVal != null && String(origESVal).trim() !== "" ? toNumber(origESVal) : null;
                const eR = repESVal != null && String(repESVal).trim() !== "" ? toNumber(repESVal) : null;
                
                const esOType = String(r.original_es_type ?? "");
                const esRType = String(r.replication_es_type ?? "");
                const citationO = transformCitationHtmlToExplorer(generateCitationHtml(r.original_authors as string, r.original_journal as string, r.original_year as string, r.original_url as string));
                const citationR = transformCitationHtmlToExplorer(generateCitationHtml(r.replication_authors as string, r.replication_journal as string, r.replication_year as string, r.replication_url as string));
                return (
                  <tr key={i} className="border-b hover:bg-black/5 dark:hover:bg-white/5">
                    {visibleColumns.has("index") && (
                    <td className="align-top p-2 text-right">{i + 1}</td>
                    )}
                    {visibleColumns.has("original_citation_html") && (
                    <td className="align-top p-2" style={{ width: 240 }}>
                        {citationO ? (
                          <span dangerouslySetInnerHTML={{ __html: citationO }} />
                        ) : (
                          <span className="opacity-80">—</span>
                      )}
                    </td>
                    )}
                    {visibleColumns.has("replication_citation_html") && (
                    <td className="align-top p-2" style={{ width: 240 }}>
                        {citationR ? (
                          <span dangerouslySetInnerHTML={{ __html: citationR }} />
                        ) : (
                          <span className="opacity-80">—</span>
                      )}
                    </td>
                    )}
                    {visibleColumns.has("description") && (
                    <td className="align-top p-2">
                      <div className="font-medium">{String(r.description || r.tags || "—")}</div>
                    </td>
                    )}
                    {visibleColumns.has("field") && (
                      <td className="align-top p-2">{String(r.field || "")}</td>
                    )}
                    {visibleColumns.has("discipline") && (
                    <td className="align-top p-2">{String(r.discipline || "")}</td>
                    )}
                    {visibleColumns.has("subdiscipline") && (
                      <td className="align-top p-2">{String(r.subdiscipline || "")}</td>
                    )}
                    {visibleColumns.has("result") && (
                    <td className="align-top p-2">{String(r.result || "")}</td>
                    )}
                    {visibleColumns.has("original_n") && (
                      <td className="align-top p-2 text-right">{nO != null && nO !== 0 ? nO : ""}</td>
                    )}
                    {visibleColumns.has("replication_n") && (
                      <td className="align-top p-2 text-right">{nR != null && nR !== 0 ? nR : ""}</td>
                    )}
                    {visibleColumns.has("original_es") && (() => {
                      const rawVal = r.original_es;
                      const rawES = rawVal != null && String(rawVal).trim() !== "" ? toNumber(rawVal) : null;
                      return <td className="align-top p-2 text-right">{rawES != null ? `${formatSig4(rawES)}${esOType ? ` (${esOType})` : ""}` : ""}</td>;
                    })()}
                    {visibleColumns.has("replication_es") && (() => {
                      const rawVal = r.replication_es;
                      const rawES = rawVal != null && String(rawVal).trim() !== "" ? toNumber(rawVal) : null;
                      return <td className="align-top p-2 text-right">{rawES != null ? `${formatSig4(rawES)}${esRType ? ` (${esRType})` : ""}` : ""}</td>;
                    })()}
                    {visibleColumns.has("original_es_r") && (
                      <td className="align-top p-2 text-right">{eO != null && eO !== 0 ? formatSig4(eO) : ""}</td>
                    )}
                    {visibleColumns.has("replication_es_r") && (
                      <td className="align-top p-2 text-right">{eR != null && eR !== 0 ? formatSig4(eR) : ""}</td>
                    )}
                    {visibleColumns.has("original_es_type") && (
                      <td className="align-top p-2 text-right">{esOType || ""}</td>
                    )}
                    {visibleColumns.has("replication_es_type") && (
                      <td className="align-top p-2 text-right">{esRType || ""}</td>
                    )}
                    {visibleColumns.has("original_es_95_CI") && (
                      <td className="align-top p-2 text-right">{String(r.original_es_95_CI || "")}</td>
                    )}
                    {visibleColumns.has("replication_es_95_CI") && (
                      <td className="align-top p-2 text-right">{String(r.replication_es_95_CI || "")}</td>
                    )}
                    {visibleColumns.has("original_p_value") && (
                      <td className="align-top p-2 text-right">{String(r.original_p_value || "")}</td>
                    )}
                    {visibleColumns.has("replication_p_value") && (
                      <td className="align-top p-2 text-right">{String(r.replication_p_value || "")}</td>
                    )}
                    {visibleColumns.has("original_p_value_type") && (
                      <td className="align-top p-2">{String(r.original_p_value_type || "")}</td>
                    )}
                    {visibleColumns.has("replication_p_value_type") && (
                      <td className="align-top p-2">{String(r.replication_p_value_type || "")}</td>
                    )}
                    {visibleColumns.has("original_p_value_tails") && (
                      <td className="align-top p-2">{String(r.original_p_value_tails || "")}</td>
                    )}
                    {visibleColumns.has("replication_p_value_tails") && (
                      <td className="align-top p-2">{String(r.replication_p_value_tails || "")}</td>
                    )}
                    {visibleColumns.has("original_authors") && (
                      <td className="align-top p-2">{String(r.original_authors || "")}</td>
                    )}
                    {visibleColumns.has("replication_authors") && (
                      <td className="align-top p-2">{String(r.replication_authors || "")}</td>
                    )}
                    {visibleColumns.has("original_title") && (
                      <td className="align-top p-2">{String(r.original_title || "")}</td>
                    )}
                    {visibleColumns.has("replication_title") && (
                      <td className="align-top p-2">{String(r.replication_title || "")}</td>
                    )}
                    {visibleColumns.has("original_journal") && (
                      <td className="align-top p-2">{String(r.original_journal || "")}</td>
                    )}
                    {visibleColumns.has("replication_journal") && (
                      <td className="align-top p-2">{String(r.replication_journal || "")}</td>
                    )}
                    {visibleColumns.has("original_volume") && (
                      <td className="align-top p-2 text-right">{String(r.original_volume || "")}</td>
                    )}
                    {visibleColumns.has("replication_volume") && (
                      <td className="align-top p-2 text-right">{String(r.replication_volume || "")}</td>
                    )}
                    {visibleColumns.has("original_issue") && (
                      <td className="align-top p-2">{String(r.original_issue || "")}</td>
                    )}
                    {visibleColumns.has("replication_issue") && (
                      <td className="align-top p-2">{String(r.replication_issue || "")}</td>
                    )}
                    {visibleColumns.has("original_pages") && (
                      <td className="align-top p-2">{String(r.original_pages || "")}</td>
                    )}
                    {visibleColumns.has("replication_pages") && (
                      <td className="align-top p-2">{String(r.replication_pages || "")}</td>
                    )}
                    {visibleColumns.has("original_year") && (
                      <td className="align-top p-2 text-right">{String(r.original_year || "").replace(/\.0$/, "")}</td>
                    )}
                    {visibleColumns.has("replication_year") && (
                      <td className="align-top p-2 text-right">{String(r.replication_year || "").replace(/\.0$/, "")}</td>
                    )}
                    {visibleColumns.has("original_url") && (
                      <td className="align-top p-2">{String(r.original_url || "")}</td>
                    )}
                    {visibleColumns.has("replication_url") && (
                      <td className="align-top p-2">{String(r.replication_url || "")}</td>
                    )}
                    {visibleColumns.has("tags") && (
                      <td className="align-top p-2">{String(r.tags || "")}</td>
                    )}
                    {visibleColumns.has("validated") && (
                      <td className="align-top p-2">{String(r.validated || "")}</td>
                    )}
                    {visibleColumns.has("validated_person") && (
                      <td className="align-top p-2">{String(r.validated_person || "")}</td>
                    )}
                    {visibleColumns.has("replication_initiative_tag") && (
                      <td className="align-top p-2">{(INITIATIVE_TAG_NAMES as Record<string, string>)[String(r.replication_initiative_tag || "")] || String(r.replication_initiative_tag || "")}</td>
                    )}
                    {visibleColumns.has("source") && (
                      <td className="align-top p-2">{String(r.source || "")}</td>
                    )}
                    {visibleColumns.has("explanation") && (
                      <td className="align-top p-2">{String(r.explanation || "")}</td>
                    )}
                    {visibleColumns.has("ai_version") && (
                      <td className="align-top p-2">{String(r.ai_version || "")}</td>
                    )}
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={visibleColumns.size} className="p-6 text-center opacity-70">
                    No rows matching{" "}
                    {[
                      field && `Field = "${field}"`,
                      discipline && `Discipline = "${discipline}"`,
                      subdiscipline && `Subdiscipline = "${subdiscipline}"`,
                      result && `Result = "${result}"`,
                      initiative && `Initiative = "${initiative}"`,
                      replicationType.size > 0 && `Replication Type = "${Array.from(replicationType).join(", ")}"`,
                      search && `Search = "${search}"`,
                    ].filter(Boolean).join(", ") || "current filters"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-2 flex justify-between items-center">
          <div className="text-xs opacity-60">Showing {Math.min(filteredRows.length, 2000)} of {filteredRows.length} rows.</div>
          {lastUpdated && (
            <div className="text-xs opacity-60">Last updated {lastUpdated}</div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-[90%] mt-6 space-y-3">
        <p className="opacity-80 text-xs">
          Some data shown here is derived from the <a className="underline" href="https://forrt.org/apps/fred_explorer.html" target="_blank" rel="noreferrer">FReD replication dataset</a>. If you use that data, please cite <a className="underline" href="https://openpsychologydata.metajnl.com/articles/10.5334/jopd.101" target="_blank" rel="noreferrer">Röseler et al., <em>Journal of Open Psychology Data</em>, 12: 8, pp. 1–23 (2024)</a> and their <a className="underline" href="https://osf.io/preprints/metaarxiv/me2ub_v1" target="_blank" rel="noreferrer">more recent preprint</a>. For more info on the original FReD dataset, see this OSF repository: <a className="underline" href="https://osf.io/9r62x" target="_blank" rel="noreferrer">https://osf.io/9r62x</a>. That data is © 2024 The Author(s) and licensed under <a className="underline" href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International (CC‑BY 4.0)</a>. You must credit the original authors and source if you use that data. Data that comes from FReD is tagged in the "Validated Person" column as "FoRRT FReD team", "forrt.org team: LK", "FReD_API_team", or similarly. 
        </p>
      </section>
      </main>
      <Footer />
    </div>
  );
}

/**
 * InlineScatter component - displays scatterplot of original vs replication effect sizes
 *
 * Uses precomputed points from computedOutcomes to avoid duplicate computation.
 * The coordinate system is normalized so that:
 * - Original effect direction is ALWAYS considered "positive" (X-axis shows |original ES|)
 * - Replication ES is adjusted so same-direction effects are positive, opposite-direction are negative
 * - This means points above y=0 replicated in same direction, below y=0 replicated in opposite direction
 */
type ScatterPoint = {
  oAdj: number;
  rAdj: number;
  desc: string;
  outcome: "success" | "failure" | "reversal" | "inconclusive";
  origNonsig: boolean;
};

function InlineScatter({ points, showReversal = true, markOrigNonsig = false }: { points: ScatterPoint[]; showReversal?: boolean; markOrigNonsig?: boolean }) {
  const width = 600;
  const height = 428;
  const margin = { top: 10, right: 10, bottom: 45, left: 58 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  // Axis ranges - original ES is always positive (0 to 1), replication can be -1 to 1
  const xMin: number = 0;
  const xMax: number = 1;
  const yMin: number = -1;
  const yMax: number = 1;

  const x = (v: number) => {
    if (xMax === xMin) return innerW / 2;
    return ((v - xMin) / (xMax - xMin)) * innerW;
  };
  const y = (v: number) => {
    if (yMax === yMin) return innerH / 2;
    return innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  };

  const allTicks: number[] = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1];
  const xTicks = allTicks.filter((t) => t >= xMin && t <= xMax);
  const yTicks = allTicks.filter((t) => t >= yMin && t <= yMax);

  function color(res: "success" | "failure" | "reversal" | "inconclusive"): string {
    if (res === "success") return "#10b981"; // Green for success
    if (res === "failure") return "#f87171"; // Light red for failure
    if (res === "reversal") return "#b91c1c"; // Dark red for reversal
    return "#9ca3af"; // Gray for inconclusive or other
  }

  return (
    <div className="relative">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="max-w-full h-auto">
        <g transform={`translate(${margin.left},${margin.top})`}>
          {xTicks.map((t) => (
            <g key={`x-${t}`} transform={`translate(${x(t)},${innerH})`}>
              <line y1={0} y2={6} stroke="#000000" strokeWidth={1} />
              <text y={20} textAnchor="middle" className="text-xs" fill="#000000">{t}</text>
            </g>
          ))}
          {yTicks.map((t) => (
            <g key={`y-${t}`} transform={`translate(0,${y(t)})`}>
              <line x1={-6} x2={0} stroke="#000000" strokeWidth={1} />
              <text x={-10} dy="0.32em" textAnchor="end" className="text-xs" fill="#000000">{t}</text>
            </g>
          ))}
          {/* Diagonal line representing perfect replication */}
          {(() => {
            const tMin = Math.max(xMin, yMin);
            const tMax = Math.min(xMax, yMax);
            return (
              <line x1={x(tMin)} y1={y(tMin)} x2={x(tMax)} y2={y(tMax)} stroke="#6b7280" strokeDasharray="4 4" />
            );
          })()}
          {/* Horizontal line at y=0 showing direction boundary */}
          <line x1={0} y1={y(0)} x2={innerW} y2={y(0)} stroke="#9ca3af" strokeWidth={1} strokeDasharray="2 2" />
          {/* Axis spines */}
          <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#000000" strokeWidth={1} />
          <line x1={0} y1={0} x2={0} y2={innerH} stroke="#000000" strokeWidth={1} />
          {/* X-axis label */}
          <text x={innerW / 2} y={innerH + 40} textAnchor="middle" className="text-xs" fill="#000000" style={{ fontSize: 12 }}>Original Effect Size (Pearson's r equivalent)</text>
          {/* Y-axis label */}
          <text x={-innerH / 2} y={-46} textAnchor="middle" transform="rotate(-90)" className="text-xs" fill="#000000" style={{ fontSize: 12 }}>Replication Effect Size (Pearson's r equivalent)</text>
          {points.map((p, i) => {
            const hollow = markOrigNonsig && p.origNonsig;
            return (
              <g key={i} transform={`translate(${x(p.oAdj)},${y(p.rAdj)})`}>
                <title>{p.desc}</title>
                {hollow ? (
                  <circle r={2} fill="#9ca3af" fillOpacity={0.85} />
                ) : (
                  <circle r={2} fill={color(p.outcome)} fillOpacity={0.85} />
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "#10b981" }} />
          <span>Success</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "#f87171" }} />
          <span>Failure</span>
        </div>
        {showReversal && (
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "#b91c1c" }} />
            <span>Reversal</span>
          </div>
        )}
        {markOrigNonsig && (
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "#9ca3af" }} />
            <span>Original effect not significant</span>
          </div>
        )}
      </div>
    </div>
  );
}

type YearBin = {
  label: string;
  /** Every row in the bin with a recorded result, inconclusive included. */
  total: number;
  success: number;
  failure: number;
  inconclusive: number;
  /** Denominator of `rate`: success + failure (reversals already folded in). */
  rateN: number;
  rate: number;
};

// Wilson score 95% CI for a proportion k/n, returned as percentages.
function wilsonCI(k: number, n: number): [number, number] {
  if (n === 0) return [0, 100];
  const z = 1.96;
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, center - margin) * 100, Math.min(1, center + margin) * 100];
}

function InlineYearBars({ bins, threshold, binSize }: { bins: YearBin[]; threshold: number; binSize: number }) {
  const width = 600;
  const height = 240;
  const margin = { top: 10, right: 10, bottom: 60, left: 50 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  if (bins.length === 0) {
    return <div className="text-sm opacity-50">Not enough data -- need at least {threshold} papers in a {binSize} year time interval</div>;
  }

  const barGap = 4;
  const barWidth = Math.max(12, Math.min(50, (innerW - barGap * (bins.length - 1)) / bins.length));
  const totalBarsWidth = bins.length * barWidth + (bins.length - 1) * barGap;
  const offsetX = (innerW - totalBarsWidth) / 2;

  const yScale = (v: number) => innerH - (v / 100) * innerH;
  const yTicks = [0, 20, 40, 60, 80, 100];

  return (
    <div className="relative">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="max-w-full h-auto">
        <g transform={`translate(${margin.left},${margin.top})`}>
          {yTicks.map((t) => (
            <g key={`y-${t}`}>
              <line x1={0} y1={yScale(t)} x2={innerW} y2={yScale(t)} stroke="#d1d5db" strokeWidth={0.5} />
              <line x1={-6} x2={0} y1={yScale(t)} y2={yScale(t)} stroke="#000000" strokeWidth={1} />
              <text x={-10} y={yScale(t)} dy="0.32em" textAnchor="end" className="text-xs" fill="#000000">{t}%</text>
            </g>
          ))}
          {bins.map((bin, i) => {
            const bx = offsetX + i * (barWidth + barGap);
            const cx = bx + barWidth / 2;
            const insufficientData = bin.rate < 0;
            const barH = insufficientData ? 0 : (bin.rate / 100) * innerH;
            const by = innerH - barH;
            // CI and label share the rate's denominator (rateN), not the bin's
            // full row count, so the interval matches the bar it sits on.
            const [ciLow, ciHigh] = wilsonCI(bin.success, bin.rateN);
            return (
              <g key={bin.label}>
                <title>{insufficientData ? `${bin.label}: insufficient data (${bin.rateN} classified replications)` : `${bin.label}: ${bin.rate}% success (${bin.success}/${bin.rateN} classified; ${bin.inconclusive} inconclusive excluded) · 95% CI [${ciLow.toFixed(1)}%–${ciHigh.toFixed(1)}%]`}</title>
                {insufficientData ? (
                  <text x={cx} y={innerH - 24} textAnchor="middle" className="fill-current" style={{ fontSize: 7, opacity: 0.4 }}>
                    <tspan x={cx} dy="0">not</tspan>
                    <tspan x={cx} dy="9">enough</tspan>
                    <tspan x={cx} dy="9">data</tspan>
                  </text>
                ) : (
                  <>
                    <rect x={bx} y={by} width={barWidth} height={Math.max(barH, 2)} fill="#2563eb" fillOpacity={0.85} rx={1} />
                    <text x={cx} y={by - 4} textAnchor="middle" className="fill-current" style={{ fontSize: 9, opacity: 0.7 }}>{bin.rateN}</text>
                  </>
                )}
                <text x={bx + barWidth / 2} y={innerH + 12} textAnchor="end" transform={`rotate(-45, ${bx + barWidth / 2}, ${innerH + 12})`} fill="#000000" style={{ fontSize: 9 }}>{bin.label}</text>
              </g>
            );
          })}
          {/* Axis spines */}
          <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#000000" strokeWidth={1} />
          <line x1={0} y1={0} x2={0} y2={innerH} stroke="#000000" strokeWidth={1} />
          <text x={-innerH / 2} y={-42} textAnchor="middle" transform="rotate(-90)" className="text-xs" fill="#000000" style={{ fontSize: 10 }}>Replication Success Rate (%)</text>
          <text x={innerW / 2} y={innerH + 56} textAnchor="middle" className="text-xs" fill="#000000" style={{ fontSize: 10 }}>Year of Original Publication (5-year bins)</text>
        </g>
      </svg>
    </div>
  );
}

type RawScatterPoint = {
  origES: number;
  repES: number;
  esType: string;
  desc: string;
};

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

function niceStep(range: number): number {
  const rough = range / 5;
  const pow = Math.pow(10, Math.floor(Math.log10(Math.abs(rough))));
  const normalized = rough / pow;
  if (normalized <= 1) return pow;
  if (normalized <= 2) return 2 * pow;
  if (normalized <= 5) return 5 * pow;
  return 10 * pow;
}

function RawESScatter({ points }: { points: RawScatterPoint[] }) {
  const width = 600;
  const height = 240;
  const margin = { top: 10, right: 10, bottom: 45, left: 58 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  if (points.length === 0) {
    return <div className="text-sm opacity-50">No data with raw effect sizes</div>;
  }

  // Dynamic axis range using percentile clamping
  const allX = points.map(p => p.origES);
  const allY = points.map(p => p.repES);

  let xMin: number, xMax: number, yMin: number, yMax: number;
  if (points.length <= 2) {
    const allVals = [...allX, ...allY];
    const lo = Math.min(...allVals) - 1;
    const hi = Math.max(...allVals) + 1;
    xMin = lo; xMax = hi; yMin = lo; yMax = hi;
  } else {
    const p2x = percentile(allX, 2.5);
    const p97x = percentile(allX, 97.5);
    const p2y = percentile(allY, 2.5);
    const p97y = percentile(allY, 97.5);
    const padX = Math.max((p97x - p2x) * 0.05, 0.1);
    const padY = Math.max((p97y - p2y) * 0.05, 0.1);
    xMin = p2x - padX;
    xMax = p97x + padX;
    yMin = p2y - padY;
    yMax = p97y + padY;
  }

  const clampX = (v: number) => Math.max(xMin, Math.min(xMax, v));
  const clampY = (v: number) => Math.max(yMin, Math.min(yMax, v));
  const isClamped = (p: RawScatterPoint) =>
    p.origES < xMin || p.origES > xMax || p.repES < yMin || p.repES > yMax;

  const x = (v: number) => {
    if (xMax === xMin) return innerW / 2;
    return ((v - xMin) / (xMax - xMin)) * innerW;
  };
  const y = (v: number) => {
    if (yMax === yMin) return innerH / 2;
    return innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  };

  // Generate nice tick marks
  const stepX = niceStep(xMax - xMin);
  const stepY = niceStep(yMax - yMin);
  const xTicks: number[] = [];
  const yTicks: number[] = [];
  for (let t = Math.ceil(xMin / stepX) * stepX; t <= xMax; t += stepX) xTicks.push(Math.round(t * 1000) / 1000);
  for (let t = Math.ceil(yMin / stepY) * stepY; t <= yMax; t += stepY) yTicks.push(Math.round(t * 1000) / 1000);

  // Legend: only show types present, sorted by count descending
  const typeCounts = new Map<string, number>();
  for (const p of points) typeCounts.set(p.esType, (typeCounts.get(p.esType) || 0) + 1);
  const presentTypes = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);

  // Diagonal line range (y=x)
  const diagMin = Math.max(xMin, yMin);
  const diagMax = Math.min(xMax, yMax);

  return (
    <div className="relative">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="max-w-full h-auto">
        <g transform={`translate(${margin.left},${margin.top})`}>
          {xTicks.map((t) => (
            <g key={`x-${t}`} transform={`translate(${x(t)},${innerH})`}>
              <line y1={0} y2={6} stroke="#000000" strokeWidth={1} />
              <text y={20} textAnchor="middle" className="text-xs" fill="#000000">{t}</text>
            </g>
          ))}
          {yTicks.map((t) => (
            <g key={`y-${t}`} transform={`translate(0,${y(t)})`}>
              <line x1={-6} x2={0} stroke="#000000" strokeWidth={1} />
              <text x={-10} dy="0.32em" textAnchor="end" className="text-xs" fill="#000000">{t}</text>
            </g>
          ))}
          {/* Diagonal y=x line */}
          {diagMin < diagMax && (
            <line x1={x(diagMin)} y1={y(diagMin)} x2={x(diagMax)} y2={y(diagMax)} stroke="#6b7280" strokeDasharray="4 4" />
          )}
          {/* y=0 line if in range */}
          {yMin <= 0 && yMax >= 0 && (
            <line x1={0} y1={y(0)} x2={innerW} y2={y(0)} stroke="#9ca3af" strokeWidth={1} strokeDasharray="2 2" />
          )}
          {/* x=0 line if in range */}
          {xMin <= 0 && xMax >= 0 && (
            <line x1={x(0)} y1={0} x2={x(0)} y2={innerH} stroke="#9ca3af" strokeWidth={1} strokeDasharray="2 2" />
          )}
          <text x={innerW / 2} y={innerH + 40} textAnchor="middle" className="text-xs" fill="#000000" style={{ fontSize: 12 }}>Original Effect Size (raw)</text>
          <text x={-innerH / 2} y={-46} textAnchor="middle" transform="rotate(-90)" className="text-xs" fill="#000000" style={{ fontSize: 12 }}>Replication Effect Size (raw)</text>
          {points.map((p, i) => {
            const cx = x(clampX(p.origES));
            const cy = y(clampY(p.repES));
            const fill = ES_TYPE_COLORS[p.esType] || ES_TYPE_COLORS["Other"];
            const clamped = isClamped(p);
            return (
              <g key={i} transform={`translate(${cx},${cy})`}>
                <title>{`${p.desc}\n${p.esType}: orig=${p.origES}, rep=${p.repES}`}</title>
                {clamped ? (
                  <polygon points="0,-2.7 2.3,2 -2.3,2" fill={fill} fillOpacity={0.6} />
                ) : (
                  <circle r={2} fill={fill} fillOpacity={0.85} />
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        {presentTypes.map(type => (
          <div key={type} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded" style={{ background: ES_TYPE_COLORS[type] || ES_TYPE_COLORS["Other"] }} />
            <span>{type} ({typeCounts.get(type)})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

