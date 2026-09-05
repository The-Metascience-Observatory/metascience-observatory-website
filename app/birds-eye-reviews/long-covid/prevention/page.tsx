import { publicationFor } from "@/lib/long-covid/publications-server";
import type { PublicationMetadata } from "@/lib/long-covid/publications";
import { PreventionResults } from "./PreventionResults";
import fs from "fs";
import path from "path";
import { interventionVerdictsFromRows } from "../constants";
import { parseCSV } from "../screening/csv-utils";
import type { TrialTableRow } from "../types";

export const metadata = {
  title: "Long Covid Prevention Trials | Bird's Eye Reviews | The Metascience Observatory",
  description:
    "Trials testing whether interventions given around acute COVID-19 prevent Long Covid (PASC).",
};

const DIR = "data/birds_eye_reviews/long_covid";
const dataPath = (f: string) => path.join(process.cwd(), DIR, f);

const VERDICT_KEYS = new Set([
  "favors_treatment", "favors_control", "no_difference", "mixed", "inconclusive",
]);
const fmtDesign = (s: string) =>
  (s || "unknown").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bRct\b/g, "RCT");

/** paper_id -> {verdict, rationale} from trial_verdicts.csv (same file the treatment
 *  dashboard uses; it covers every extracted study including prevention ones). */
function loadVerdicts(): Map<string, { verdict: string; rationale: string }> {
  const m = new Map<string, { verdict: string; rationale: string }>();
  const fp = dataPath("trial_verdicts.csv");
  if (!fs.existsSync(fp)) return m;
  const rows = parseCSV(fs.readFileSync(fp, "utf-8"));
  if (rows.length === 0) return m;
  const h = rows[0].map((x) => x.trim());
  const idx = (n: string) => h.indexOf(n);
  const pi = idx("paper_id");
  if (pi === -1) return m;
  for (const r of rows.slice(1)) {
    const id = (r[pi] ?? "").trim();
    if (!id || m.has(id)) continue;
    m.set(id, { verdict: (r[idx("verdict")] ?? "").trim(), rationale: (r[idx("rationale")] ?? "").trim() });
  }
  return m;
}

export interface PrevRow {
  publicationMetadata?: PublicationMetadata;
  paper_id: string;
  url: string;
  authors: string;        // full author list
  title: string;
  journal: string;
  year: number | string | null;
  volume: string;
  issue: string;
  pages: string;
  design: string;
  n: number | null;
  countries: string[];
  primaryOutcome: string;
  interventionNames: string[];
  verdict: string;
}

function loadData() {
  const fp = dataPath("long_covid_prevention_trials.jsonl");
  if (!fs.existsSync(fp)) return null;
  let doiMeta: Record<string, { first_author?: string; journal?: string; year?: number | null }> = {};
  try { doiMeta = JSON.parse(fs.readFileSync(dataPath("doi_metadata.json"), "utf-8")); } catch { /* ok */ }
  const verdicts = loadVerdicts();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recs: any[] = fs.readFileSync(fp, "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));

  const rows: PrevRow[] = [];
  // Rows shaped for interventionVerdictsFromRows (reuses the treatment chart builder).
  const chartRows: Partial<TrialTableRow>[] = [];

  for (const r of recs) {
    const pid = String(r.paper_id ?? "");
    const sd = r.study_design ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const armList = (sd.arms ?? []).filter((a: any) => a.type === "intervention");
    const seen = new Set<string>();
    const ivs: { name: string; category: string }[] = [];
    for (const a of armList) {
      const name = (a.intervention_canonical ?? a.intervention_name ?? "").trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      ivs.push({ name, category: a.intervention_category ?? "unknown" });
    }
    const meta = doiMeta[pid] ?? {};
    const firstAuthor = (meta.first_author || String(r.authors ?? "").split(/[;]| and /)[0] || "").trim();
    const year = r.year ?? meta.year ?? null;
    const journal = (publicationFor(pid)?.journalTitle || r.journal || meta.journal || "").trim();
    const n = r.sample_sizes?.n_randomized_total ?? r.sample_sizes?.n_enrolled_total ?? null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const primary = (r.outcomes ?? []).find((o: any) => o.is_primary) ?? (r.outcomes ?? [])[0];
    const rawVerdict = verdicts.get(pid)?.verdict ?? "";
    const verdict = VERDICT_KEYS.has(rawVerdict) ? rawVerdict : "unknown";

    rows.push({
      publicationMetadata: publicationFor(pid),
      paper_id: pid,
      url: String(r.url || `https://doi.org/${pid}`),
      authors: String(r.authors ?? "").trim(),
      title: String(r.title ?? ""),
      journal,
      year,
      volume: String(r.volume ?? "").trim(),
      issue: String(r.issue ?? "").trim(),
      pages: String(r.pages ?? "").trim(),
      design: fmtDesign(sd.design_type ?? ""),
      n,
      countries: (sd.countries ?? []) as string[],
      primaryOutcome: String(primary?.name ?? ""),
      interventionNames: ivs.map((i) => i.name),
      verdict,
    });

    chartRows.push({
      publicationMetadata: publicationFor(pid),
      paper_id: pid, verdict, first_author: firstAuthor,
      title: String(r.title ?? ""), year, journal,
      n_randomized: n, design_type: fmtDesign(sd.design_type ?? ""),
      verdict_rationale: verdicts.get(pid)?.rationale ?? "",
      interventions: ivs,
    });
  }

  const { byNameVerdicts, trialsByName } = interventionVerdictsFromRows(chartRows as TrialTableRow[]);

  rows.sort((a, b) => (b.n ?? 0) - (a.n ?? 0) || a.authors.localeCompare(b.authors));

  return { rows, chartRows: chartRows as TrialTableRow[], byNameVerdicts, trialsByName };
}

export default function PreventionPage() { return <PreventionResults initialData={loadData()}/>; }
