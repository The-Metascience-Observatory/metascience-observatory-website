"use client";

import { useEffect, useMemo, useState } from "react";
import { ReplicationsNavbar } from "@/components/ReplicationsNavbar";
import { Footer } from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";

// Define slugify locally to avoid import issues
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");
}

type AnyRecord = Record<string, unknown>;

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

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
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

// Compute p-value from t-statistic (approximate two-tailed)
function pValueFromT(t: number, df: number): number {
  const z = Math.abs(t);
  if (df > 30) {
    if (z > 6) return 0;
    const x = z / Math.SQRT2;
    const erf = 1 - 1 / (1 + 0.278393 * x + 0.230389 * x * x + 0.000972 * x * x * x + 0.078108 * x * x * x * x) ** 4;
    return 2 * (1 - erf);
  }
  if (z > 3) return 0.01;
  if (z > 2.5) return 0.02;
  if (z > 2) return 0.05;
  if (z > 1.96) return 0.06;
  if (z > 1.5) return 0.15;
  return 0.5;
}

function computeSignificanceOutcome(
  origES: number,
  repES: number,
  origN: number,
  repN: number,
  origESType: string,
  repESType: string
): "success" | "failure" | "inconclusive" {
  const sameDirection = (origES > 0 && repES > 0) || (origES < 0 && repES < 0);
  const oppositeDirection = (origES > 0 && repES < 0) || (origES < 0 && repES > 0);
  
  if (oppositeDirection && Math.abs(repES) > 0.01) {
    return "failure";
  }

  if (Math.abs(repES) < 0.001) {
    if (Math.abs(origES) < 0.001) {
      return "inconclusive";
    }
    return "failure";
  }

  let tRep: number | null = null;
  let dfRep: number | null = null;

  const repType = (repESType || "").toLowerCase();
  
  if (repType === "r" || repType === "") {
    if (Math.abs(repES) < 0.999 && repN > 2) {
      const denom = 1 - repES * repES;
      if (denom > 0.001) {
        tRep = repES * Math.sqrt((repN - 2) / denom);
        dfRep = repN - 2;
      }
    }
  } else if (repType === "d") {
    if (repN > 2) {
      tRep = repES * Math.sqrt(repN / 2);
      dfRep = repN - 2;
    }
  } else if (repType === "etasq" || repType === "eta squared") {
    if (repES > 0 && repES < 1 && repN > 2) {
      const r = Math.sqrt(repES);
      const denom = 1 - r * r;
      if (denom > 0.001) {
        tRep = r * Math.sqrt((repN - 2) / denom);
        dfRep = repN - 2;
      }
    }
  } else {
    if (Math.abs(repES) < 0.999 && repN > 2) {
      const denom = 1 - repES * repES;
      if (denom > 0.001) {
        tRep = repES * Math.sqrt((repN - 2) / denom);
        dfRep = repN - 2;
      }
    }
  }

  if (tRep == null || dfRep == null || dfRep <= 0) {
    return "inconclusive";
  }

  const pRep = pValueFromT(tRep, dfRep);
  const isSignificant = pRep < 0.05;

  if (sameDirection && isSignificant) {
    return "success";
  } else if (sameDirection && !isSignificant) {
    return "inconclusive";
  } else {
    return "failure";
  }
}

function computeConfidenceIntervalOutcome(
  origES: number,
  repES: number,
  origN: number,
  repN: number,
  origESType: string,
  repESType: string
): "success" | "failure" | "inconclusive" {
  if (!Number.isFinite(origES) || !Number.isFinite(repES) || !Number.isFinite(origN) || !Number.isFinite(repN)) {
    return "inconclusive";
  }
  
  let seRep: number | null = null;
  const repType = (repESType || "").toLowerCase();
  
  if (repType === "r" || repType === "") {
    if (repN > 3 && Math.abs(repES) < 0.999) {
      try {
        const zRep = 0.5 * Math.log((1 + repES) / (1 - repES));
        const seZ = 1 / Math.sqrt(repN - 3);
        const rSquared = repES * repES;
        seRep = (1 - rSquared) * seZ;
        if (seRep <= 0 || !Number.isFinite(seRep)) seRep = null;
      } catch (e) {
        seRep = null;
      }
    }
    if (seRep == null && repN > 2 && Math.abs(repES) < 0.999) {
      const rSquared = repES * repES;
      seRep = Math.sqrt((1 - rSquared) * (1 - rSquared) / (repN - 1));
    }
  } else if (repType === "d") {
    if (repN > 2) {
      seRep = Math.sqrt(2 / repN);
    }
  } else if (repType === "etasq" || repType === "eta squared") {
    if (repES > 0 && repES < 1 && repN > 3) {
      try {
        const r = Math.sqrt(repES);
        if (Math.abs(r) < 0.999) {
          const z = 0.5 * Math.log((1 + r) / (1 - r));
          const seZ = 1 / Math.sqrt(repN - 3);
          const rSquared = r * r;
          seRep = (1 - rSquared) * seZ;
          if (seRep <= 0 || !Number.isFinite(seRep)) seRep = null;
        }
      } catch (e) {
        seRep = null;
      }
    }
  } else {
    if (repN > 3 && Math.abs(repES) < 0.999) {
      try {
        const zRep = 0.5 * Math.log((1 + repES) / (1 - repES));
        const seZ = 1 / Math.sqrt(repN - 3);
        const rSquared = repES * repES;
        seRep = (1 - rSquared) * seZ;
        if (seRep <= 0 || !Number.isFinite(seRep)) seRep = null;
      } catch (e) {
        seRep = null;
      }
    }
  }

  if (seRep == null || seRep <= 0 || !Number.isFinite(seRep)) {
    return "inconclusive";
  }

  const z95 = 1.96;
  const ciLower = repES - z95 * seRep;
  const ciUpper = repES + z95 * seRep;

  if (!Number.isFinite(ciLower) || !Number.isFinite(ciUpper) || ciLower > ciUpper) {
    return "inconclusive";
  }

  if (origES >= ciLower && origES <= ciUpper) {
    return "success";
  } else {
    return "failure";
  }
}

type ColumnKey = 
  | "index"
  | "original_citation_html"
  | "replication_citation_html"
  | "description"
  | "discipline"
  | "result"
  | "original_n"
  | "replication_n"
  | "original_es_r"
  | "replication_es_r"
  | "original_es_type"
  | "replication_es_type"
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
  | "validated_person";

const ALL_COLUMNS: Array<{ key: ColumnKey; label: string }> = [
  { key: "index", label: "#" },
  { key: "original_citation_html", label: "Original publication" },
  { key: "replication_citation_html", label: "Replication publication" },
  { key: "description", label: "Description of the original effect" },
  { key: "discipline", label: "Discipline" },
  { key: "result", label: "Result" },
  { key: "original_n", label: "N (orig)" },
  { key: "replication_n", label: "N (rep)" },
  { key: "original_es_r", label: "ES (orig)" },
  { key: "replication_es_r", label: "ES (rep)" },
  { key: "original_es_type", label: "ES type (orig)" },
  { key: "replication_es_type", label: "ES type (rep)" },
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
];

const DEFAULT_COLUMNS: ColumnKey[] = [
  "index",
  "original_citation_html",
  "replication_citation_html",
  "description",
  "discipline",
  "result",
  "original_n",
  "replication_n",
  "validated",
];

export default function ReplicationsDatabaseV2Page() {
  const router = useRouter();
  const [data, setData] = useState<FredResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [discipline, setDiscipline] = useState<string>("");
  const [openAlexField, setOpenAlexField] = useState<string>("");
  const [openAlexSubfield, setOpenAlexSubfield] = useState<string>("");
  const [result, setResult] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    new Set(DEFAULT_COLUMNS)
  );
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [outcomeMethod, setOutcomeMethod] = useState<"significance" | "confidence">("significance");

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

  const disciplineOptions: Option[] = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const r of data.rows) {
      const key = String(r.discipline ?? "");
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const entries = Array.from(counts.entries()).filter(([k]) => k !== "");
    entries.sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });
    return entries.map(([k, c]) => ({ value: k, label: `${k} (${c})` }));
  }, [data]);

  const openAlexFieldOptions: Option[] = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const r of data.rows) {
      const key = String(r.openalex_field ?? "");
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const entries = Array.from(counts.entries()).filter(([k]) => k !== "");
    entries.sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });
    return entries.map(([k, c]) => ({ value: k, label: `${k} (${c})` }));
  }, [data]);

  const openAlexSubfieldOptions: Option[] = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const r of data.rows) {
      const key = String(r.openalex_subfield ?? "");
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const entries = Array.from(counts.entries()).filter(([k]) => k !== "");
    entries.sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });
    return entries.map(([k, c]) => ({ value: k, label: `${k} (${c})` }));
  }, [data]);

  const filteredRows = useMemo(() => {
    if (!data) return [] as AnyRecord[];
    return data.rows.filter((r) => {
      if (discipline && String(r.discipline ?? "") !== discipline) return false;
      if (openAlexField && String(r.openalex_field ?? "") !== openAlexField) return false;
      if (openAlexSubfield && String(r.openalex_subfield ?? "") !== openAlexSubfield) return false;
      if (result && String(r.result ?? "") !== result) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = `${r.description ?? ""} ${r.tags ?? ""} ${r.original_citation_html ?? ""} ${r.replication_citation_html ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [data, discipline, openAlexField, openAlexSubfield, result, search]);

  const outcomeStat = useMemo(() => {
    let n = 0;
    let success = 0;
    let failure = 0;
    let inconclusive = 0;
    let withEffectSizes = 0;
    for (const r of filteredRows) {
      const eO = toNumber(r.original_es_r ?? r.es_original);
      const eR = toNumber(r.replication_es_r ?? r.es_replication);
      const nO = toNumber(r.original_n ?? r.n_original);
      const nR = toNumber(r.replication_n ?? r.n_replication);
      const esOType = String(r.original_es_type ?? "");
      const esRType = String(r.replication_es_type ?? "");
      
      if (eO == null || eR == null || nO == null || nR == null || nO <= 0 || nR <= 0) {
        continue;
      }
      
      n++;
      let res: "success" | "failure" | "inconclusive";
      if (outcomeMethod === "significance") {
        res = computeSignificanceOutcome(eO, eR, nO, nR, esOType, esRType);
      } else { 
        res = computeConfidenceIntervalOutcome(eO, eR, nO, nR, esOType, esRType);
      }
      
      if (res === "success") success++;
      else if (res === "failure") failure++;
      else inconclusive++;
      
      if (eO != null && eR != null && eO !== 0 && eR !== 0) {
        withEffectSizes++;
      }
    }
    const pct = (v: number) => (n > 0 ? Math.round((v / n) * 1000) / 10 : 0);
    return { n, success, failure, inconclusive, pctSuccess: pct(success), pctFailure: pct(failure), pctInconclusive: pct(inconclusive), withEffectSizes };
  }, [filteredRows, outcomeMethod]);

  const resultStat = useMemo(() => {
    const n = filteredRows.length;
    let success = 0;
    let failure = 0;
    let inconclusive = 0;
    
    for (const r of filteredRows) {
      const res = String(r.result ?? "").trim();
      if (res === "success") success++;
      else if (res === "failure") failure++;
      else inconclusive++;
    }
    const pct = (v: number) => (n > 0 ? Math.round((v / n) * 1000) / 10 : 0);
    return { n, success, failure, inconclusive, pctSuccess: pct(success), pctFailure: pct(failure), pctInconclusive: pct(inconclusive) };
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
      
      <div className="mx-auto max-w-[90%] mb-8">
        <h1 className="text-3xl font-bold mb-4">Replications Database v2</h1>
        <p className="opacity-80">
          This is an experimental version of the database with an expanded view for each effect. 
          Click on any row to view details about the effect and its replications.
        </p>
      </div>

      {/* Controls */}
      <section className="mx-auto max-w-[90%] mt-6">
        <div className="grid gap-3 md:grid-cols-5 items-end">
          <div className="md:col-span-1">
            <label htmlFor="discipline" className="block text-sm font-medium opacity-80 mb-1">Discipline</label>
            <select
              id="discipline"
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All disciplines</option>
              {disciplineOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label htmlFor="openAlexField" className="block text-sm font-medium opacity-80 mb-1">OpenAlex Field</label>
            <select
              id="openAlexField"
              value={openAlexField}
              onChange={(e) => setOpenAlexField(e.target.value)}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All fields</option>
              {openAlexFieldOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label htmlFor="openAlexSubfield" className="block text-sm font-medium opacity-80 mb-1">OpenAlex Subfield</label>
            <select
              id="openAlexSubfield"
              value={openAlexSubfield}
              onChange={(e) => setOpenAlexSubfield(e.target.value)}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All subfields</option>
              {openAlexSubfieldOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="search" className="block text-sm font-medium opacity-80 mb-1">Search</label>
            <Input
              id="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description, tags, or references"
              className="h-10"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[90%] grid md:grid-cols-4 gap-4 mt-6">
        <div className="border rounded p-4 col-span-1">
          <div className="text-sm opacity-70">Effect replications</div>
          <div className="text-3xl font-semibold">{resultStat.n}</div>
          <div className="text-sm opacity-70 mt-2">Outcome mix (human judgement)</div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-24 text-sm">Success</div>
              <div className="flex-1"><MiniBar value={resultStat.pctSuccess} max={100} color="#10b981" /></div>
              <div className="w-24 text-right text-sm">{resultStat.success} ({resultStat.pctSuccess}%)</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24 text-sm">Inconclusive</div>
              <div className="flex-1"><MiniBar value={resultStat.pctInconclusive} max={100} color="#9ca3af" /></div>
              <div className="w-24 text-right text-sm">{resultStat.inconclusive} ({resultStat.pctInconclusive}%)</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24 text-sm">Failure</div>
              <div className="flex-1"><MiniBar value={resultStat.pctFailure} max={100} color="#f87171" /></div>
              <div className="w-24 text-right text-sm">{resultStat.failure} ({resultStat.pctFailure}%)</div>
            </div>
          </div>
        </div>
        <div className="border rounded p-4 col-span-1">
          <div className="text-sm opacity-70 mb-2">Outcome mix - computed ({outcomeStat.n})</div>
          <div className="mb-3">
            <select
              value={outcomeMethod}
              onChange={(e) => setOutcomeMethod(e.target.value as "significance" | "confidence")}
              className="w-full h-8 text-xs rounded-md border border-border bg-background px-2"
            >
              <option value="significance">Repeated significance</option>
              <option value="confidence">CI Consistency</option>
            </select>
          </div>
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-24 text-sm">Success</div>
              <div className="flex-1"><MiniBar value={outcomeStat.pctSuccess} max={100} color="#10b981" /></div>
              <div className="w-24 text-right text-sm">{outcomeStat.success} ({outcomeStat.pctSuccess}%)</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24 text-sm">Inconclusive</div>
              <div className="flex-1"><MiniBar value={outcomeStat.pctInconclusive} max={100} color="#9ca3af" /></div>
              <div className="w-24 text-right text-sm">{outcomeStat.inconclusive} ({outcomeStat.pctInconclusive}%)</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24 text-sm">Failure</div>
              <div className="flex-1"><MiniBar value={outcomeStat.pctFailure} max={100} color="#f87171" /></div>
              <div className="w-24 text-right text-sm">{outcomeStat.failure} ({outcomeStat.pctFailure}%)</div>
            </div>
          </div>
        </div>
        <div className="border rounded p-4 col-span-2">
           <div className="text-sm opacity-70">Replication vs Original Effect Size</div>
            <div className="mt-2">
                <InlineScatter rows={filteredRows} outcomeMethod={outcomeMethod} />
            </div>
        </div>
      </section>

      <section className="mx-auto max-w-[90%] border rounded mt-6">
        <div className="p-2 border-b flex items-center justify-between">
          <h3 className="font-medium">Data Table (Click row for details)</h3>
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
                  {ALL_COLUMNS.map((col) => (
                    <label key={col.key} className="flex items-center gap-2 p-1 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(col.key)}
                        onChange={(e) => {
                          const newSet = new Set(visibleColumns);
                          if (e.target.checked) newSet.add(col.key);
                          else newSet.delete(col.key);
                          setVisibleColumns(newSet);
                        }}
                        className="cursor-pointer"
                      />
                      <span className="text-sm">{col.label}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="overflow-x-auto overflow-y-auto h-[calc(100vh-400px)] max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b bg-background dark:bg-background">
                {ALL_COLUMNS.filter(c => visibleColumns.has(c.key)).map(c => (
                  <th key={c.key} className={`p-2 ${["original_n", "replication_n", "original_es_r", "replication_es_r"].includes(c.key) ? "text-right" : "text-left"}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.slice(0, 2000).map((r, i) => {
                const titleSlug = slugify(String(r.original_title || ""));
                return (
                  <tr 
                    key={i} 
                    className="border-b hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
                    onClick={() => router.push(`/replications-database-v2/${titleSlug}`)}
                  >
                    {ALL_COLUMNS.filter(c => visibleColumns.has(c.key)).map(c => {
                       let val: React.ReactNode = String(r[c.key] || "");
                       if (c.key === "index") val = i + 1;
                       else if (c.key.includes("citation_html")) {
                          const html = String(r[c.key] || "");
                          val = html ? <span dangerouslySetInnerHTML={{ __html: html }} /> : <span className="opacity-80">—</span>;
                       }
                       else if (["original_n", "replication_n"].includes(c.key)) {
                          const n = toNumber(r[c.key]);
                          val = n != null && n !== 0 ? n : "";
                       }
                       else if (["original_es_r", "replication_es_r"].includes(c.key)) {
                          const e = toNumber(r[c.key]);
                          val = e != null && e !== 0 ? formatSig4(e) : "";
                       }
                       return (
                         <td key={c.key} className={`align-top p-2 ${["original_n", "replication_n", "original_es_r", "replication_es_r", "index"].includes(c.key) ? "text-right" : "text-left"}`}>
                           {val}
                         </td>
                       );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      </main>
      <Footer />
    </div>
  );
}

function InlineScatter({ rows, outcomeMethod }: { rows: AnyRecord[]; outcomeMethod: "significance" | "confidence" }) {
  const width = 600;
  const height = 220;
  const margin = { top: 10, right: 10, bottom: 30, left: 30 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  
  const pts = rows.map((r) => {
      const o = toNumber(r.original_es_r ?? r.es_original);
      const rv = toNumber(r.replication_es_r ?? r.es_replication);
      if (o == null || rv == null) return null;
      const oAdj = o >= 0 ? o : -o;
      const rAdj = o >= 0 ? rv : -rv;
      
      const nO = toNumber(r.original_n ?? r.n_original);
      const nR = toNumber(r.replication_n ?? r.n_replication);
      const esOType = String(r.original_es_type ?? "");
      const esRType = String(r.replication_es_type ?? "");
      
      let res: "success" | "failure" | "inconclusive";
      if (nO == null || nR == null || nO <= 0 || nR <= 0) {
        res = "inconclusive";
      } else if (outcomeMethod === "significance") {
        res = computeSignificanceOutcome(o, rv, nO, nR, esOType, esRType);
      } else { 
        res = computeConfidenceIntervalOutcome(o, rv, nO, nR, esOType, esRType);
      }
      return { o: oAdj, r: rAdj, res };
  }).filter(Boolean) as Array<{ o: number; r: number; res: string }>;

  const x = (v: number) => ((v + 0.1) / 1.1) * innerW; 
  const y = (v: number) => innerH - ((v + 0.75) / 1.75) * innerH;

  return (
    <div className="relative">
      <svg width={width} height={height} className="max-w-full bg-[#f3f4f6]">
         <g transform={`translate(${margin.left},${margin.top})`}>
           {pts.map((p, i) => (
             <circle key={i} cx={x(p.o)} cy={y(p.r)} r={3} fill={p.res === "success" ? "#10b981" : p.res === "failure" ? "#f87171" : "#9ca3af"} fillOpacity={0.6} />
           ))}
         </g>
      </svg>
    </div>
  );
}
