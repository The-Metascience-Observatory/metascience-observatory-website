import fs from "fs";
import path from "path";
import Link from "next/link";
import { BirdsEyeNavbar } from "@/components/BirdsEyeNavbar";
import { Footer } from "@/components/Footer";
import { parseCSV, stripTags, normalizeTitle } from "./screening/csv-utils";
import { ResultsClientWrapper } from "./ResultsClientWrapper";
import { TrialRow } from "./ResultsTable";

export const metadata = {
  title: "Clinical Trial Results | Antiviral Nasal Sprays | Bird's Eye Reviews | The Metascience Observatory",
  description:
    "Extracted outcomes from the human clinical trials of antiviral and barrier nasal sprays.",
};

const DATA_DIR = "data/birds_eye_reviews/antiviral_nasal_sprays";
const dataPath = (f: string) => path.join(process.cwd(), DATA_DIR, f);

interface Citation {
  title: string;
  authors: string;
  journal: string;
  year: string;
  volume: string;
  issue: string;
  pages: string;
  url: string;
}

/** First-author surname from a "First Last; ..." or "Last, F; ..." author list. */
function firstAuthorSurname(authors: string): string {
  if (!authors) return "";
  const first = authors.split(/[;]| and /)[0].trim();
  if (first.includes(",")) return first.slice(0, first.indexOf(",")).trim();
  const toks = first.split(/\s+/).filter(Boolean);
  if (toks.length === 0) return "";
  // "Surname IN" (PubMed) -> Surname; "First Last" -> Last
  const lastTok = toks[toks.length - 1];
  if (toks.length >= 2 && /^[A-Z]{1,3}\.?$/.test(lastTok)) return toks[0];
  return lastTok;
}

/** "Smith et al. 2023" label for hover tooltip. */
function hoverLabel(authors: string): string {
  const s = firstAuthorSurname(authors);
  return s ? `${s} et al.` : "";
}

/** doi -> citation metadata from trial_screening.csv (reused screening feed). */
function loadCitations(): Map<string, Citation> {
  const map = new Map<string, Citation>();
  const fp = dataPath("trial_screening.csv");
  if (!fs.existsSync(fp)) return map;
  const records = parseCSV(fs.readFileSync(fp, "utf-8"));
  if (records.length === 0) return map;
  const h = records[0].map((x) => x.trim());
  const idx = (name: string) => h.indexOf(name);
  const di = idx("doi");
  for (const row of records.slice(1)) {
    const doi = (row[di] ?? "").trim();
    if (!doi || map.has(doi)) continue;
    map.set(doi, {
      title: normalizeTitle(stripTags(row[idx("paper_title")] ?? "")).slice(0, 250),
      authors: stripTags(row[idx("paper_authors")] ?? "").slice(0, 200),
      journal: stripTags(row[idx("paper_journal")] ?? "").slice(0, 120),
      year: (row[idx("paper_year")] ?? "").trim(),
      volume: (row[idx("paper_volume")] ?? "").trim(),
      issue: (row[idx("paper_issue")] ?? "").trim(),
      pages: (row[idx("paper_pages")] ?? "").trim(),
      url: (row[idx("paper_url")] ?? "").trim(),
    });
  }
  return map;
}

/** doi -> indication (prevention / treatment / both / ...) from indications.csv. */
function loadIndications(): Map<string, string> {
  const map = new Map<string, string>();
  const fp = dataPath("indications.csv");
  if (!fs.existsSync(fp)) return map;
  const records = parseCSV(fs.readFileSync(fp, "utf-8"));
  if (records.length === 0) return map;
  const h = records[0].map((x) => x.trim());
  const di = h.indexOf("doi");
  const ii = h.indexOf("indication");
  if (di === -1 || ii === -1) return map;
  for (const row of records.slice(1)) {
    const doi = (row[di] ?? "").trim();
    const ind = (row[ii] ?? "").trim();
    if (doi && ind && !map.has(doi)) map.set(doi, ind);
  }
  return map;
}

interface Verdict {
  verdict: string;
  rationale: string;
  confidence: string;
}

/** paper_id -> result verdict from trial_verdicts.csv (LLM direction-of-effect
 *  pass with a statistical-significance guardrail; see classify_trial_verdicts.py). */
function loadVerdicts(): Map<string, Verdict> {
  const map = new Map<string, Verdict>();
  const fp = dataPath("trial_verdicts.csv");
  if (!fs.existsSync(fp)) return map;
  const records = parseCSV(fs.readFileSync(fp, "utf-8"));
  if (records.length === 0) return map;
  const h = records[0].map((x) => x.trim());
  const idx = (name: string) => h.indexOf(name);
  const pi = idx("paper_id");
  if (pi === -1) return map;
  for (const row of records.slice(1)) {
    const id = (row[pi] ?? "").trim();
    if (!id || map.has(id)) continue;
    map.set(id, {
      verdict: (row[idx("verdict")] ?? "").trim(),
      rationale: (row[idx("rationale")] ?? "").trim(),
      confidence: (row[idx("confidence")] ?? "").trim(),
    });
  }
  return map;
}


/** Raw extracted arm `route` -> delivery-device bucket for the spray/drops filter. */
const ROUTE_TO_DELIVERY: Record<string, string> = {
  nasal_spray: "spray",
  nasal_drops: "drops",
  nasal_irrigation: "irrigation",
};

/** base DOI -> manual delivery-method override (delivery_overrides.json). Used
 *  where the extracted arm `route` was a generic "intranasal" but the abstract /
 *  full text explicitly states a spray or drops device. */
function loadDeliveryOverrides(): Map<string, string> {
  const map = new Map<string, string>();
  const fp = dataPath("delivery_overrides.json");
  if (!fs.existsSync(fp)) return map;
  try {
    const raw = JSON.parse(fs.readFileSync(fp, "utf-8")) as { overrides?: Record<string, string> };
    for (const [doi, method] of Object.entries(raw.overrides ?? {})) {
      if (doi && method) map.set(doi, method);
    }
  } catch (e) {
    console.error("Failed to load delivery_overrides.json:", e);
  }
  return map;
}

/** Delivery device of a trial = the route of its intervention arm (the active
 *  spray/drops/etc.), normalized. Generic "intranasal", "inhaled", "oral", etc.
 *  and missing routes bucket as "other" so spray vs drops stays a clean split. */
function deliveryMethodOf(sd: Record<string, unknown>): string {
  const arms = Array.isArray(sd.arms) ? (sd.arms as Record<string, unknown>[]) : [];
  const pick = arms.find((a) => String(a.type ?? "").startsWith("interv")) ?? arms[0];
  const route = String(pick?.route ?? "").trim().toLowerCase();
  return ROUTE_TO_DELIVERY[route] ?? (route ? "other" : "");
}

const RATIO = new Set([
  "risk_ratio", "odds_ratio", "hazard_ratio", "rate_ratio", "incidence_rate_ratio",
  "adjusted_odds_ratio", "adjusted_risk_ratio", "adjusted_hazard_ratio", "adjusted_rate_ratio",
]);
const DIFF = new Set([
  "mean_difference", "adjusted_mean_difference", "smd", "standardized_mean_difference",
  "risk_difference", "rate_difference",
]);

/** trial_extractions.jsonl -> one TrialRow per extracted trial. */
function loadTrials(cites: Map<string, Citation>, indications: Map<string, string>, verdicts: Map<string, Verdict>, deliveryOverrides: Map<string, string>): TrialRow[] {
  const fp = dataPath("trial_extractions.jsonl");
  if (!fs.existsSync(fp)) return [];
  const out: TrialRow[] = [];
  for (const line of fs.readFileSync(fp, "utf-8").split("\n")) {
    const s = line.trim();
    if (!s) continue;
    let r: Record<string, unknown>;
    try { r = JSON.parse(s); } catch { continue; }
    if (r._status && r._status !== "ok") continue;
    const doi = String(r.paper_id ?? "");
    // Arm-split records have paper_id "<doi>#<arm>"; resolve to the base DOI for
    // citation / verdict / indication / link lookups (those are keyed by DOI).
    const baseDoi = doi.split("#")[0];
    const sd = (r.study_design ?? {}) as Record<string, unknown>;
    const ss = (r.sample_sizes ?? {}) as Record<string, unknown>;
    const rob = (r.risk_of_bias ?? {}) as Record<string, unknown>;
    const outcomes = Array.isArray(r.outcomes) ? r.outcomes as Record<string, unknown>[] : [];
    const primary = outcomes.find((o) => o.is_primary) ?? outcomes[0];
    let effMeasure = "", effVal: number | null = null, ciLo: number | null = null,
      ciHi: number | null = null, pVal: number | null = null, primaryDomain = "", primaryName = "";
    if (primary) {
      primaryDomain = String(primary.outcome_domain ?? primary.symptom_domain ?? primary.category ?? "");
      primaryName = String(primary.name ?? "");
      const effs = Array.isArray(primary.between_group_effects)
        ? primary.between_group_effects as Record<string, unknown>[]
        : [];
      const e = effs.find((x) => RATIO.has(String(x.effect_measure)) || DIFF.has(String(x.effect_measure)));
      if (e) {
        effMeasure = String(e.effect_measure ?? "");
        effVal = (e.effect_value as number) ?? null;
        ciLo = (e.ci_95_low as number) ?? null;
        ciHi = (e.ci_95_high as number) ?? null;
        pVal = (e.p_value as number) ?? null;
      }
    }
    const c = cites.get(baseDoi);
    const v = verdicts.get(baseDoi);
    const n = (ss.n_randomized_total as number) ?? (ss.n_enrolled_total as number) ?? null;
    const relatedPubs = Array.isArray(r.related_publications)
      ? (r.related_publications as Record<string, unknown>[])
          .map((p) => ({
            doi: String(p.doi ?? ""),
            relation: String(p.relation ?? ""),
            label: String(p.label ?? ""),
          }))
          .filter((p) => p.doi && p.label)
      : [];
    out.push({
      doi,
      armLabel: String(r.arm_label ?? ""),
      relatedPubs,
      ingredient: String(r.agent_canonical ?? ""),
      indication: indications.get(baseDoi) ?? "",
      // Canonical country names (synonym-merged by the export step); drives the
      // "Trials by country" map and its click-to-filter.
      countries: Array.isArray(sd.countries)
        ? [...new Set((sd.countries as unknown[]).filter((c): c is string => typeof c === "string" && c.trim() !== ""))]
        : [],
      deliveryMethod: deliveryOverrides.get(baseDoi) ?? deliveryMethodOf(sd),
      verdict: v?.verdict ?? "",
      verdictRationale: v?.rationale ?? "",
      hoverLabel: hoverLabel(c?.authors ?? ""),
      spray_type: String(r.spray_type ?? ""),
      design: String(sd.design_type ?? (r.is_rct ? "RCT" : "")),
      n,
      rob: String(rob.overall_judgment ?? ""),
      abstractOnly: Boolean(r.source_is_abstract_only),
      primaryDomain,
      primaryName,
      effMeasure,
      effVal, ciLo, ciHi, pVal,
      summary: String(r.summary ?? "").slice(0, 400),
      title: c?.title ?? "",
      authors: c?.authors ?? "",
      journal: c?.journal ?? "",
      year: c?.year ?? "",
      volume: c?.volume ?? "",
      issue: c?.issue ?? "",
      pages: c?.pages ?? "",
      url: c?.url ?? "",
    });
  }
  return out;
}

export default function ResultsPage() {
  const cites = loadCitations();
  const indications = loadIndications();
  const verdicts = loadVerdicts();
  const deliveryOverrides = loadDeliveryOverrides();
  const trials = loadTrials(cites, indications, verdicts, deliveryOverrides);
  // The meta-analysis lives on a separate opt-in sub-page; only link to it when
  // the pipeline actually generated meta_analysis.json (off by default).
  const hasMetaAnalysis = fs.existsSync(dataPath("meta_analysis.json"));

  return (
    <>
      <BirdsEyeNavbar />
      <main className="container mx-auto px-2 pt-24 pb-16 min-h-screen">
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/birds-eye-reviews" className="text-sm text-blue-600 hover:text-blue-700">
            &larr; Back to Bird&apos;s Eye Reviews
          </Link>
        </div>

        <h1 className="font-clarendon font-bold text-3xl mb-2">
          Antiviral Nasal Sprays — Human Clinical Trials
        </h1>
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href="/birds-eye-reviews/antiviral-nasal-sprays/screening"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-sm font-medium"
          >
            View screening process and preclinical research &rarr;
          </Link>
          {hasMetaAnalysis && (
            <Link
              href="/birds-eye-reviews/antiviral-nasal-sprays/meta-analysis"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-sm font-medium"
            >
              View meta-analyses &rarr;
            </Link>
          )}
        </div>

        <ResultsClientWrapper trials={trials} />
      </main>
      <Footer />
    </>
  );
}
