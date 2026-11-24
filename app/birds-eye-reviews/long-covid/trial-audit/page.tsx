import fs from "fs";
import path from "path";
import { longCovidDataPath } from "@/lib/long-covid/data-path";
import { releaseVersion, publishedArticles } from "@/lib/long-covid/articles-server";
import { publicationFor } from "@/lib/long-covid/publications-server";
import { normalizePaperId } from "@/lib/long-covid/article-detail";
import { parseCSV } from "../screening/csv-utils";
import { PaperAudit } from "@/components/paper-audit/PaperAudit";
import type {
  AuditIssue, AuditPageData, AuditTrial, IssueFamily, SeverityLevel,
} from "@/components/paper-audit/types";
import { fmtDesign } from "@/components/paper-audit/types";

export const metadata = {
  title: "Long Covid Trial Audit and Treatment Map | Bird's Eye Reviews | The Metascience Observatory",
  description:
    "An AI audit of Long Covid treatment trials: a map of what has been tested, the most rigorously " +
    "reported trials, and the errors and limitations a two-stage AI review found in each paper.",
};

const baseId = (id: unknown) => String(id ?? "").trim().toLowerCase().split("#")[0];
const readJson = (name: string) => {
  const file = longCovidDataPath(name);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, "utf-8")); } catch { return null; }
};
const RANDOMIZED = /\b(rct|randomi[sz]ed|crossover|cross-over)\b/i;
const VERDICT_KEYS = new Set(["favors_treatment", "favors_control", "no_difference", "mixed", "inconclusive"]);
const FAMILIES = new Set(["numeric", "design", "spin", "integrity"]);

function loadVerdicts(): Map<string, string> {
  const out = new Map<string, string>();
  const file = longCovidDataPath("trial_verdicts.csv");
  if (!fs.existsSync(file)) return out;
  const rows = parseCSV(fs.readFileSync(file, "utf-8"));
  const head = (rows[0] ?? []).map((x) => x.trim());
  const pi = head.indexOf("paper_id"), vi = head.indexOf("verdict");
  if (pi < 0 || vi < 0) return out;
  for (const row of rows.slice(1)) {
    const id = baseId(row[pi]);
    if (id && !out.has(id)) out.set(id, (row[vi] ?? "").trim());
  }
  return out;
}

function loadLadder(): SeverityLevel[] {
  const file = path.join(process.cwd(), "data/forensic_severity_ladder.json");
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (JSON.parse(fs.readFileSync(file, "utf-8")).levels as any[]).map((l) => ({
      n: l.n, slug: l.slug, label: l.label, summary: l.web_summary, color: l.colors.light,
    }));
  } catch { return []; }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toIssue(raw: any): AuditIssue | null {
  if (!raw || !FAMILIES.has(raw.family) || !["confirmed", "judgement_call", "disputed"].includes(raw.status)) return null;
  return {
    id: String(raw.id),
    family: raw.family as IssueFamily,
    subtype: String(raw.subtype ?? "other"),
    kind: raw.kind === "debatable" ? "debatable" : "clear",
    severity: Number(raw.severity) || 0,
    direction: raw.direction === "overstates" || raw.direction === "understates" ? raw.direction : "neutral",
    title: String(raw.title ?? ""),
    explanation: String(raw.explanation ?? ""),
    status: raw.status,
    checkedBy: { script: !!raw.checked_by?.script, secondReader: String(raw.checked_by?.second_reader ?? "not_run") },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    quotes: (raw.quotes ?? []).slice(0, 3).map((q: any) => ({ text: String(q.text ?? ""), location: String(q.location ?? "") })),
    ...(raw.script ? { script: { tool: String(raw.script.tool), verdict: String(raw.script.verdict ?? ""), explanation: String(raw.script.explanation ?? "") } } : {}),
    ...(raw.second_reader?.what_stands ? { secondReaderNote: String(raw.second_reader.what_stands) } : {}),
  };
}

function loadData(): AuditPageData | null {
  const feed = longCovidDataPath("trial_extractions.jsonl");
  if (!fs.existsSync(feed)) return null;
  const audit = readJson("paper_audit.json");
  const map = readJson("trial_map.json");
  if (!audit && !map) return null;
  const published = publishedArticles().records;
  const verdicts = loadVerdicts();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const placed = new Map<string, any>((map?.studies ?? []).map((s: any) => [String(s.id), s]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const audited: Record<string, any> = audit?.papers ?? {};
  const trials = new Map<string, AuditTrial>();

  for (const line of fs.readFileSync(feed, "utf-8").split("\n")) {
    if (!line.trim()) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = JSON.parse(line);
    const paperId = String(r.paper_id ?? "");
    const id = baseId(paperId);
    if (!id || trials.has(id) || !published.has(normalizePaperId(paperId))) continue;
    const spot = placed.get(id), row = audited[id];
    if (!spot && !row) continue;
    const sd = r.study_design ?? {};
    const treatments: string[] = [];
    for (const arm of sd.arms ?? []) {
      const name = String(arm?.intervention_canonical ?? arm?.intervention_name ?? "").trim();
      if (arm?.type === "intervention" && name && !treatments.includes(name)) treatments.push(name);
    }
    const authors = String(r.authors ?? "").split(/;|,| and /).map((s) => s.trim()).filter(Boolean);
    const rawVerdict = verdicts.get(id) ?? "";
    const issues = ((row?.issues ?? []) as unknown[]).map(toIssue).filter((i): i is AuditIssue => !!i);
    const confirmed = issues.filter((i) => i.status === "confirmed");
    const year = Number(String(r.year ?? "").slice(0, 4));
    trials.set(id, {
      id, paperId,
      url: String(r.url || `https://doi.org/${id}`),
      title: String(r.title ?? ""),
      authors: authors.length > 1 ? `${authors[0]} et al.` : authors[0] ?? "",
      journal: String(publicationFor(paperId)?.journalTitle || r.journal || ""),
      year: year > 1900 ? year : null,
      n: r.sample_sizes?.n_randomized_total ?? r.sample_sizes?.n_enrolled_total ?? r.sample_sizes?.n_analyzed_total ?? null,
      design: fmtDesign(String(sd.design_type ?? "")),
      randomized: RANDOMIZED.test(String(sd.design_type ?? "")) || r.is_rct === true,
      treatments: treatments.slice(0, 4),
      verdict: VERDICT_KEYS.has(rawVerdict) ? rawVerdict : "unknown",
      ...(spot ? { cluster: spot.cluster, domain: spot.domain, x: spot.x, y: spot.y } : {}),
      stage: row ? row.stage : null,
      rigor: row?.rigor?.score ?? null,
      ...(row?.rigor?.parts ? { rigorParts: row.rigor.parts } : {}),
      ...(row?.best_rank ? { bestRank: row.best_rank } : {}),
      maxSeverity: confirmed.reduce((m, i) => Math.max(m, i.severity), 0),
      ...(row?.overall ? { overall: String(row.overall) } : {}),
      retracted: (row?.retraction ?? []).some((x: { nature?: string }) => /retract/i.test(String(x?.nature ?? ""))),
      ...(row?.checklist ? { checklist: row.checklist } : {}),
      issues,
    });
  }

  const present = new Set([...trials.values()].map((t) => t.cluster).filter(Boolean));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clusters = (map?.clusters ?? []).filter((c: any) => present.has(c.id));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const domainIds = new Set(clusters.map((c: any) => c.domain));
  return {
    reviewLabel: "Long Covid",
    releaseVersion: releaseVersion(),
    generatedAt: audit?.generated_at ?? null,
    models: audit?.models ?? {},
    funnel: audit?.funnel ?? {},
    control: audit?.control ?? null,
    tallies: audit?.tallies ?? {},
    ladder: loadLadder(),
    map: map ? {
      width: map.width, height: map.height, clusters,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      domains: (map.domains ?? []).filter((d: any) => domainIds.has(d.id)),
    } : null,
    trials: [...trials.values()],
  };
}

export default function TrialAuditPage() {
  return <PaperAudit data={loadData()} backHref="/birds-eye-reviews/long-covid" backLabel="Long Covid treatment trials" />;
}
