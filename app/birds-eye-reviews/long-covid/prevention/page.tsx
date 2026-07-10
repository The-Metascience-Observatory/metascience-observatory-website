import fs from "fs";
import path from "path";
import Link from "next/link";
import { BirdsEyeNavbar } from "@/components/BirdsEyeNavbar";
import { Footer } from "@/components/Footer";
import { BreakdownChart } from "@/components/BreakdownChart";
import { VERDICT_SEGMENTS, interventionVerdictsFromRows } from "../constants";
import { parseCSV } from "../screening/csv-utils";
import type { TrialTableRow } from "../types";

export const metadata = {
  title: "Long Covid Prevention Trials (prototype) | Bird's Eye Reviews | The Metascience Observatory",
  description:
    "Prototype dashboard of trials testing whether interventions given around acute COVID-19 prevent Long Covid (PASC).",
};

const DIR = "data/birds_eye_reviews/long_covid";
const dataPath = (f: string) => path.join(process.cwd(), DIR, f);

const VERDICT_KEYS = new Set([
  "favors_treatment", "favors_control", "no_difference", "mixed", "inconclusive",
]);
const VERDICT_COLOR: Record<string, string> = Object.fromEntries(VERDICT_SEGMENTS.map((s) => [s.key, s.color]));
const VERDICT_LABEL: Record<string, string> = Object.fromEntries(VERDICT_SEGMENTS.map((s) => [s.key, s.label]));

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

interface PrevRow {
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

/** "Journal Year;Vol(Issue):Pages." from whatever citation parts are present. */
function citationTail(r: PrevRow): string {
  let s = r.journal || "";
  if (r.year) s += `${s ? " " : ""}${r.year}`;
  if (r.volume) s += `;${r.volume}`;
  if (r.issue) s += `(${r.issue})`;
  if (r.pages) s += `:${r.pages}`;
  return s ? s + "." : "";
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
    const ref = firstAuthor ? `${firstAuthor} et al.${year ? ` ${year}` : ""}` : (year ? String(year) : pid);
    const journal = (meta.journal || r.journal || "").trim();
    const n = r.sample_sizes?.n_randomized_total ?? r.sample_sizes?.n_enrolled_total ?? null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const primary = (r.outcomes ?? []).find((o: any) => o.is_primary) ?? (r.outcomes ?? [])[0];
    const rawVerdict = verdicts.get(pid)?.verdict ?? "";
    const verdict = VERDICT_KEYS.has(rawVerdict) ? rawVerdict : "unknown";

    rows.push({
      paper_id: pid,
      url: String(r.url || `https://doi.org/${pid}`),
      ref, title: String(r.title ?? ""), journal,
      design: fmtDesign(sd.design_type ?? ""),
      n,
      countries: (sd.countries ?? []) as string[],
      primaryOutcome: String(primary?.name ?? ""),
      interventionNames: ivs.map((i) => i.name),
      verdict,
    });

    chartRows.push({
      paper_id: pid, verdict, first_author: firstAuthor,
      title: String(r.title ?? ""), year, journal,
      n_randomized: n, design_type: fmtDesign(sd.design_type ?? ""),
      verdict_rationale: verdicts.get(pid)?.rationale ?? "",
      interventions: ivs,
    });
  }

  // Summary stats
  const interventions = new Set<string>();
  const countries = new Set<string>();
  let participants = 0, nRct = 0;
  for (const row of rows) {
    row.interventionNames.forEach((n) => interventions.add(n));
    row.countries.forEach((c) => countries.add(c));
    if (row.n) participants += row.n;
    if (/rct/i.test(row.design)) nRct++;
  }

  const { byNameVerdicts, trialsByName } = interventionVerdictsFromRows(chartRows as TrialTableRow[]);

  rows.sort((a, b) => (b.n ?? 0) - (a.n ?? 0) || a.ref.localeCompare(b.ref));

  return {
    rows,
    byNameVerdicts,
    trialsByName,
    stats: {
      total: rows.length,
      participants,
      interventions: interventions.size,
      countries: countries.size,
      pctRct: rows.length ? Math.round((nRct / rows.length) * 100) : 0,
    },
  };
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-border rounded-lg bg-white p-3">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-foreground/60 mt-0.5">{label}</div>
    </div>
  );
}

export default function PreventionPage() {
  const data = loadData();

  return (
    <div className="min-h-screen">
      <BirdsEyeNavbar subtitle="Long Covid" />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-2 py-8 max-w-7xl">
          <Link href="/birds-eye-reviews/long-covid" className="text-sm text-blue-600 hover:text-blue-700 mb-3 inline-block">
            &larr; Long Covid treatment trials
          </Link>

          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="font-clarendon font-bold text-3xl">Long Covid — Prevention Trials</h1>
            <span className="text-[11px] uppercase tracking-wide font-semibold text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">Prototype</span>
          </div>
          <p className="text-sm text-foreground/70 max-w-3xl mb-6">
            These trials test whether an intervention given <em>around the time of acute COVID-19</em> (or before
            Long Covid onset) <strong>prevents</strong> Long Covid / PASC — a different question from the main
            dashboard, which is about <em>treating</em> people who already have Long Covid. Records are routed here
            automatically by the indication classifier (<code>classify_intervention_indication.py</code>).
          </p>

          {!data || data.rows.length === 0 ? (
            <div className="border border-border rounded-lg bg-white p-8 text-center text-foreground/60">
              No prevention trials available yet. Run the indication classifier and re-export
              (<code>long_covid_prevention_trials.jsonl</code>) to populate this page.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
                <StatCard label="Prevention trials" value={data.stats.total} />
                <StatCard label="Participants" value={data.stats.participants.toLocaleString()} />
                <StatCard label="Interventions" value={data.stats.interventions} />
                <StatCard label="Countries" value={data.stats.countries} />
                <StatCard label="Randomized (RCT)" value={`${data.stats.pctRct}%`} />
              </div>

              {Object.keys(data.byNameVerdicts).length > 0 && (
                <BreakdownChart
                  title="Prevention trials by intervention"
                  breakdown={data.byNameVerdicts}
                  segments={VERDICT_SEGMENTS}
                  hoverTrials={data.trialsByName}
                  collapseSingletons
                  collapseMaxTrials={2}
                />
              )}

              {/* Trials table */}
              <div className="border border-border rounded-lg bg-white p-3 sm:p-4 mt-2 overflow-x-auto">
                <h2 className="text-lg font-semibold mb-3">All prevention trials ({data.rows.length})</h2>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border text-left text-foreground/60">
                      <th className="p-2">Reference</th>
                      <th className="p-2">Intervention(s)</th>
                      <th className="p-2">Design</th>
                      <th className="p-2 text-right">N</th>
                      <th className="p-2">Primary outcome</th>
                      <th className="p-2">Result</th>
                      <th className="p-2">Countries</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr key={r.paper_id} className="border-b border-border/50 align-top">
                        <td className="p-2 whitespace-nowrap">
                          <a href={r.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-700 hover:underline font-medium">
                            {r.ref}
                          </a>
                          {r.journal && <div className="text-xs text-foreground/45 italic max-w-[16rem] truncate">{r.journal}</div>}
                        </td>
                        <td className="p-2">{r.interventionNames.join(", ") || "—"}</td>
                        <td className="p-2 whitespace-nowrap">{r.design}</td>
                        <td className="p-2 text-right tabular-nums">{r.n != null ? r.n.toLocaleString() : "—"}</td>
                        <td className="p-2 max-w-[20rem]">{r.primaryOutcome || "—"}</td>
                        <td className="p-2 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: VERDICT_COLOR[r.verdict] ?? "#e2e8f0" }} />
                            <span className="text-xs text-foreground/70">{VERDICT_LABEL[r.verdict] ?? "Result unknown"}</span>
                          </span>
                        </td>
                        <td className="p-2 text-xs text-foreground/60 max-w-[12rem]">{r.countries.join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
