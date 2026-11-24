"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { FindingsDisclaimer } from "@/app/forensic-metascience-ai-toolkit/findings/FindingsDisclaimer";
import { ArticleDetailPanel } from "@/app/birds-eye-reviews/long-covid/ArticleDetailPanel";
import dynamic from "next/dynamic";
import { TreatmentMap, RESULT_COLOURS, rigorColour } from "./TreatmentMap";
import { relayout } from "./relayout";
import {
  FAMILY_BLURB, FAMILY_LABEL, statusLabel, subtypeLabel,
  type AuditIssue, type AuditPageData, type AuditTrial, type IssueFamily, type SeverityLevel,
} from "./types";

// WebGL only exists in the browser, and three.js is large: load the cloud on demand.
const TreatmentCloud = dynamic(() => import("./TreatmentCloud").then((m) => m.TreatmentCloud), {
  ssr: false,
  loading: () => <div className="flex h-[70vh] min-h-[420px] items-center justify-center rounded-lg bg-black text-sm text-slate-400">Loading the 3D view…</div>,
});

/** Review-agnostic audit page: treatment map, strongest trials, and the issues a
 *  two-stage AI audit confirmed. Everything shown as an issue carries a label
 *  saying what checked it; unverified screening flags are never listed. */

const FAMILIES: IssueFamily[] = ["numeric", "design", "spin", "integrity"];
const MAJOR = 4;
const RIGOR_PARTS: [string, string, number][] = [
  ["randomization", "Randomization and concealment", 30], ["blinding", "Blinding", 15],
  ["registration", "Registration", 15], ["size", "Sample size", 12], ["control", "Control group", 10],
  ["attrition_analysis", "Attrition and analysis set", 10], ["outcome", "Validated outcome", 5],
  ["multiplicity", "Multiple testing", 3],
];

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const confirmedIssues = (t: AuditTrial) => t.issues.filter((i) => i.status === "confirmed");
const cite = (t: AuditTrial) =>
  [t.authors, t.journal, t.year].map((part) => String(part ?? "").trim().replace(/\.+$/, "")).filter(Boolean).join(". ");

function SeverityPill({ n, ladder }: { n: number; ladder: SeverityLevel[] }) {
  const level = ladder.find((l) => l.n === n);
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-white"
      style={{ background: level?.color ?? "#64748b" }} title={level?.summary}>
      {n} · {level?.label ?? "Severity"}
    </span>
  );
}

function IssueCard({ issue, ladder }: { issue: AuditIssue; ladder: SeverityLevel[] }) {
  return (
    <div className="rounded-md border border-border bg-white p-3">
      <div className="flex flex-wrap items-start gap-2">
        <SeverityPill n={issue.severity} ladder={ladder} />
        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-foreground/70">{subtypeLabel(issue.subtype)}</span>
        {issue.direction !== "neutral" && (
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-foreground/70">
            {issue.direction === "overstates" ? "Makes the treatment look better" : "Makes the treatment look worse"}
          </span>
        )}
      </div>
      <p className="mt-2 font-semibold leading-snug">{issue.title}</p>
      <p className="mt-1 text-sm text-foreground/85">{issue.explanation}</p>
      <p className="mt-2 text-xs italic text-foreground/60">{statusLabel(issue)}</p>
      {(issue.quotes.length > 0 || issue.script || issue.secondReaderNote) && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-blue-700 hover:underline">Evidence from the paper</summary>
          <div className="mt-2 space-y-2">
            {issue.quotes.map((q, i) => (
              <blockquote key={i} className="border-l-2 border-border pl-3 text-foreground/80">
                &ldquo;{q.text}&rdquo;{q.location && <span className="block text-xs text-foreground/50">{q.location}</span>}
              </blockquote>
            ))}
            {issue.script && (
              <p className="rounded bg-muted/50 p-2 text-xs"><span className="font-medium">Recomputed by script</span> ({issue.script.tool}): {issue.script.explanation}</p>
            )}
            {issue.secondReaderNote && (
              <p className="rounded bg-muted/50 p-2 text-xs"><span className="font-medium">Second AI reader:</span> {issue.secondReaderNote}</p>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

function RigorBar({ score }: { score: number | null }) {
  if (score == null) return <span className="text-foreground/40">n/a</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-block h-2 w-16 overflow-hidden rounded bg-slate-200">
        <span className="block h-full" style={{ width: `${score}%`, background: rigorColour(Math.max(score, 34)) }} />
      </span>
      <span className="tabular-nums">{Math.round(score)}</span>
    </span>
  );
}

function ResultDot({ verdict }: { verdict: string }) {
  const r = RESULT_COLOURS[verdict] ?? RESULT_COLOURS.unknown;
  return <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full border border-slate-500" style={{ background: r.color }} />{r.label}</span>;
}

function TrialCard({ trial, ladder, onOpen, onClose }: { trial: AuditTrial; ladder: SeverityLevel[]; onOpen: () => void; onClose: () => void }) {
  const confirmed = confirmedIssues(trial), other = trial.issues.filter((i) => i.status !== "confirmed");
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4" data-testid="audit-trial-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <a href={trial.url} target="_blank" rel="noopener noreferrer" className="font-semibold leading-snug text-blue-800 hover:underline">{trial.title}</a>
          <p className="mt-1 text-sm text-foreground/70">{cite(trial)}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close trial summary" className="rounded px-2 py-1 text-sm hover:bg-white">✕</button>
      </div>
      <p className="mt-2 text-sm">{trial.design}{trial.n ? ` · N ${trial.n}` : ""} · <ResultDot verdict={trial.verdict} /></p>
      {trial.treatments.length > 0 && <p className="mt-1 text-sm text-foreground/70">Tested: {trial.treatments.join("; ")}</p>}
      {!trial.stage && <p className="mt-3 text-sm text-foreground/60">This paper has not been through the AI audit yet.</p>}
      {trial.stage && (
        <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,15rem)_1fr]">
          <div className="text-sm">
            <p className="font-medium">Reported rigor: {trial.rigor == null ? "n/a" : `${Math.round(trial.rigor)} / 100`}</p>
            <ul className="mt-1 space-y-0.5 text-xs text-foreground/70">
              {RIGOR_PARTS.map(([key, label, max]) => (
                <li key={key} className="flex justify-between gap-2"><span>{label}</span><span className="tabular-nums">{trial.rigorParts?.[key] ?? 0} / {max}</span></li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-foreground/50">Scores what the paper reports, {trial.stage === "verified" ? "checked by the AI verifier" : "from the first-pass AI read only"}.</p>
          </div>
          <div className="space-y-2">
            {trial.overall && <p className="text-sm"><span className="font-medium">AI verifier&rsquo;s summary: </span>{trial.overall}</p>}
            {trial.stage !== "verified" && <p className="text-sm text-foreground/60">First-pass screening only; nothing here has been verified, so no issues are listed.</p>}
            {trial.stage === "verified" && confirmed.length === 0 && <p className="text-sm text-foreground/70">No issue was confirmed for this paper.</p>}
            {confirmed.map((i) => <IssueCard key={i.id} issue={i} ladder={ladder} />)}
            {other.length > 0 && (
              <details className="text-sm"><summary className="cursor-pointer text-foreground/70">{other.length} judgement call(s) or disputed point(s)</summary>
                <div className="mt-2 space-y-2">{other.map((i) => <IssueCard key={i.id} issue={i} ladder={ladder} />)}</div></details>
            )}
          </div>
        </div>
      )}
      <button type="button" onClick={onOpen} className="mt-3 rounded border border-blue-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50">
        Open the full extracted record
      </button>
    </div>
  );
}

export function PaperAudit({ data, backHref, backLabel, reviewSlug = "long-covid" }:
  { data: AuditPageData | null; backHref: string; backLabel: string; reviewSlug?: "long-covid" | "me-cfs" }) {
  const [cluster, setCluster] = useState<string | null>(null);
  const [trialId, setTrialId] = useState<string | null>(null);
  const [panel, setPanel] = useState<string | null>(null);
  const [family, setFamily] = useState<IssueFamily | "all">("all");
  const [minSeverity, setMinSeverity] = useState(MAJOR);
  const [shown, setShown] = useState(20);
  const [sort, setSort] = useState<"trials" | "rigor" | "major">("trials");
  const [view, setView] = useState<"cloud" | "flat">("cloud");
  // Shape of the space the map gets (section width : 78% of the window height);
  // the domain circles are re-packed to match it.
  const mapSection = useRef<HTMLElement>(null);
  const [aspect, setAspect] = useState(1.6);
  useEffect(() => {
    const node = mapSection.current;
    if (!node) return;
    const measure = () => setAspect(Math.max(0.5, node.clientWidth / Math.max(320, window.innerHeight * 0.78)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [data]);

  const trials = useMemo(() => data?.trials ?? [], [data]);
  const byId = useMemo(() => new Map(trials.map((t) => [t.id, t])), [trials]);
  const audited = useMemo(() => trials.filter((t) => t.stage), [trials]);
  const verified = useMemo(() => trials.filter((t) => t.stage === "verified"), [trials]);
  const hasAudit = audited.length > 0;
  const clusterLabel = useMemo(() => new Map((data?.map?.clusters ?? []).map((c) => [c.id, c.label])), [data]);
  const domainLabel = useMemo(() => new Map((data?.map?.domains ?? []).map((d) => [d.id, d.label])), [data]);

  const scoreboard = useMemo(() => {
    const rows = (data?.map?.clusters ?? []).map((c) => {
      const members = trials.filter((t) => t.cluster === c.id);
      const checked = members.filter((t) => t.stage === "verified");
      const verdicts: Record<string, number> = {};
      for (const t of members) verdicts[t.verdict] = (verdicts[t.verdict] ?? 0) + 1;
      return {
        id: c.id, label: c.label, domain: domainLabel.get(c.domain) ?? "", trials: members.length,
        randomized: members.filter((t) => t.randomized).length,
        participants: members.reduce((sum, t) => sum + (t.n ?? 0), 0), verdicts,
        rigor: median(members.filter((t) => t.stage && t.rigor != null).map((t) => t.rigor as number)),
        verified: checked.length, major: checked.filter((t) => t.maxSeverity >= MAJOR).length,
      };
    }).filter((r) => r.trials > 0);
    const key = sort === "rigor" ? (r: typeof rows[number]) => r.rigor ?? -1
      : sort === "major" ? (r: typeof rows[number]) => (r.verified ? r.major / r.verified : -1)
        : (r: typeof rows[number]) => r.trials;
    return rows.sort((a, b) => key(b) - key(a) || b.trials - a.trials);
  }, [data, trials, domainLabel, sort]);

  const layout = useMemo(() => (data?.map ? relayout(data.map, trials, aspect) : null), [data, trials, aspect]);

  const best = useMemo(() => trials.filter((t) => t.bestRank).sort((a, b) => a.bestRank! - b.bestRank!), [trials]);

  const issueRows = useMemo(() => {
    const rows: { trial: AuditTrial; issues: AuditIssue[]; top: number }[] = [];
    for (const t of verified) {
      if (cluster && t.cluster !== cluster) continue;
      const issues = confirmedIssues(t).filter((i) => i.severity >= minSeverity && (family === "all" || i.family === family))
        .sort((a, b) => b.severity - a.severity);
      if (issues.length) rows.push({ trial: t, issues, top: issues[0].severity });
    }
    return rows.sort((a, b) => b.top - a.top || b.issues.length - a.issues.length || (b.trial.n ?? 0) - (a.trial.n ?? 0));
  }, [verified, cluster, minSeverity, family]);

  const tallies = useMemo(() => {
    const out = new Map<string, { family: IssueFamily; subtype: string; trials: Set<string>; major: Set<string> }>();
    for (const t of verified) for (const i of confirmedIssues(t)) {
      const slot = out.get(i.subtype) ?? { family: i.family, subtype: i.subtype, trials: new Set<string>(), major: new Set<string>() };
      slot.trials.add(t.id);
      if (i.severity >= MAJOR) slot.major.add(t.id);
      out.set(i.subtype, slot);
    }
    return [...out.values()].sort((a, b) => b.trials.size - a.trials.size);
  }, [verified]);

  if (!data) {
    return (
      <div className="min-h-screen"><Navbar /><main className="pt-20 pb-16"><div className="container mx-auto px-4 py-8 max-w-7xl">
        <h1 className="font-clarendon font-bold text-3xl mb-4">Trial audit</h1>
        <p className="text-foreground/70">The audit data for this review has not been published yet.</p>
      </div></main><Footer /></div>
    );
  }

  const familyCount = (f: IssueFamily) => verified.reduce((n, t) => n + confirmedIssues(t).filter((i) => i.family === f && i.severity >= minSeverity).length, 0);
  const withMajor = verified.filter((t) => t.maxSeverity >= MAJOR).length;
  const selected = trialId ? byId.get(trialId) ?? null : null;
  const funnel = data.funnel;
  const stat = (value: string | number, label: string) => (
    <div className="rounded-lg border border-border bg-white px-4 py-3"><p className="text-2xl font-bold tabular-nums">{value}</p><p className="text-xs text-foreground/60">{label}</p></div>
  );

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-2 py-8 max-w-7xl">
          <Link href={backHref} className="text-sm text-blue-600 hover:text-blue-700 mb-3 inline-block">&larr; {backLabel}</Link>
          <h1 className="font-clarendon font-bold text-3xl mb-2">{data.reviewLabel} treatment trials: map and AI audit</h1>
          <p className="max-w-4xl text-sm text-foreground/80 mb-3">
            Every treatment study in this review, grouped by what was tested. {hasAudit && <>An AI audit then read the
            full text of each clinical trial: a fast model flagged possible problems, a stronger model re-examined each
            flag against the paper, printed calculations were recomputed by a script, and the most serious findings were
            put to a second, independent AI reader. Only issues that survived are listed, each with the passage it rests
            on. </>}Most problems in papers are honest mistakes or the limits of small studies.
          </p>
          {hasAudit && <FindingsDisclaimer />}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-6">
            {stat(trials.filter((t) => t.x != null).length, "studies on the map")}
            {stat(data.map?.clusters.length ?? 0, "distinct treatments")}
            {hasAudit && stat(verified.length, "trials audited in full by AI")}
            {hasAudit && stat(verified.reduce((n, t) => n + confirmedIssues(t).length, 0), "issues confirmed")}
            {hasAudit && stat(withMajor, `trials with an issue rated ${MAJOR} or higher`)}
          </div>

        </div>

          {/* The map breaks out of the page column so it can use a wide screen. */}
          {layout && (
            <section ref={mapSection} className="mb-8 px-2 sm:px-4 lg:px-6" aria-labelledby="map-heading">
              <div className="container mx-auto max-w-7xl px-0">
              <h2 id="map-heading" className="text-xl font-semibold mb-1">What has been tested</h2>
              <p className="text-sm text-foreground/70 mb-3 max-w-4xl">
                Each point is one study. Its place on the floor is the treatment it tested, grouped by kind of
                treatment; in the 3D view its height is the year it was published, so each treatment rises as a
                column. Click a point to see what the audit found. The flat map shows the same studies from above.
              </p>
              <div className="mb-2 flex gap-1" role="group" aria-label="Map view">
                {([["cloud", "3D cloud"], ["flat", "Flat map"]] as const).map(([key, text]) => (
                  <button key={key} type="button" onClick={() => setView(key)} aria-pressed={view === key}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${view === key ? "border-blue-600 bg-blue-600 text-white" : "border-border bg-white hover:bg-muted"}`}>
                    {text}
                  </button>
                ))}
              </div>
              </div>
              {view === "cloud" ? (
                <TreatmentCloud trials={layout.trials} domains={layout.domains} clusters={layout.clusters}
                  width={layout.width} height={layout.height} ladder={data.ladder} hasAudit={hasAudit}
                  selectedTrial={trialId} onSelectTrial={setTrialId} />
              ) : (
                <TreatmentMap trials={layout.trials} domains={layout.domains} clusters={layout.clusters}
                  width={layout.width} height={layout.height} ladder={data.ladder} hasAudit={hasAudit}
                  selectedCluster={cluster} onSelectCluster={(id) => { setCluster(id); setShown(20); }}
                  selectedTrial={trialId} onSelectTrial={setTrialId} />
              )}
              <div className="container mx-auto max-w-7xl px-0">
              {cluster && (
                <p className="mt-2 text-sm">Showing <span className="font-semibold">{clusterLabel.get(cluster)}</span> in the lists below.{" "}
                  <button type="button" className="text-blue-700 underline" onClick={() => setCluster(null)}>Show all treatments</button></p>
              )}
              {selected && <div className="mt-3"><TrialCard trial={selected} ladder={data.ladder} onOpen={() => setPanel(selected.paperId)} onClose={() => setTrialId(null)} /></div>}
              </div>
            </section>
          )}

        <div className="container mx-auto px-2 pb-8 max-w-7xl">

          {scoreboard.length > 0 && (
            <section className="mb-8" aria-labelledby="treatments-heading">
              <div className="flex flex-wrap items-end justify-between gap-2 mb-2">
                <h2 id="treatments-heading" className="text-xl font-semibold">Treatments at a glance</h2>
                <label className="text-sm text-foreground/70">Sort by{" "}
                  <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded border border-border bg-white px-2 py-1 text-sm">
                    <option value="trials">Number of studies</option>
                    {hasAudit && <option value="rigor">Median rigor</option>}
                    {hasAudit && <option value="major">Share with a major issue</option>}
                  </select></label>
              </div>
              <div className="border border-border rounded-lg bg-white overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead><tr className="border-b border-border text-left text-foreground/60">
                    <th className="p-2">Treatment</th><th className="p-2">Kind</th><th className="p-2 text-right">Studies</th>
                    <th className="p-2 text-right">Randomized</th><th className="p-2 text-right">Participants</th><th className="p-2">Results</th>
                    {hasAudit && <th className="p-2">Median rigor</th>}{hasAudit && <th className="p-2 text-right">Major issue</th>}
                  </tr></thead>
                  <tbody>
                    {scoreboard.map((r) => (
                      <tr key={r.id} onClick={() => { setCluster(cluster === r.id ? null : r.id); setShown(20); }}
                        className={`border-b border-border/60 cursor-pointer hover:bg-blue-50/50 ${cluster === r.id ? "bg-blue-50" : ""}`}>
                        <td className="p-2 font-medium">{r.label}</td><td className="p-2 text-foreground/60">{r.domain}</td>
                        <td className="p-2 text-right tabular-nums">{r.trials}</td><td className="p-2 text-right tabular-nums">{r.randomized}</td>
                        <td className="p-2 text-right tabular-nums">{r.participants.toLocaleString()}</td>
                        <td className="p-2"><span className="flex h-3 w-36 overflow-hidden rounded border border-slate-300" title={Object.entries(r.verdicts).map(([k, v]) => `${(RESULT_COLOURS[k] ?? RESULT_COLOURS.unknown).label}: ${v}`).join("; ")}>
                          {Object.keys(RESULT_COLOURS).filter((k) => r.verdicts[k]).map((k) => <span key={k} style={{ width: `${(100 * r.verdicts[k]) / r.trials}%`, background: RESULT_COLOURS[k].color }} />)}
                        </span></td>
                        {hasAudit && <td className="p-2"><RigorBar score={r.rigor} /></td>}
                        {hasAudit && <td className="p-2 text-right tabular-nums">{r.verified ? `${r.major} of ${r.verified}` : "n/a"}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-xs text-foreground/50">Results bar: {Object.values(RESULT_COLOURS).map((r) => r.label).join(" · ")}. Click a row to focus the map and the lists on that treatment.</p>
            </section>
          )}

          {hasAudit && (
            <section className="mb-8" aria-labelledby="best-heading">
              <h2 id="best-heading" className="text-xl font-semibold mb-1">Most rigorously reported trials</h2>
              <p className="text-sm text-foreground/70 mb-3 max-w-4xl">
                Ranked by a fixed 100-point score of what each paper reports (randomization, blinding, registration, sample
                size, control group, attrition, outcome measure), counted only where the paper&rsquo;s own text supports it and
                the AI verifier agreed. A trial is listed only if it scores at least 60 and the audit confirmed no issue rated {MAJOR} or higher. A high
                score describes how the trial was run and reported, not whether the treatment works.
              </p>
              {best.length === 0 ? <p className="text-sm text-foreground/60">No trial has completed verification yet.</p> : (
                <div className="border border-border rounded-lg bg-white overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead><tr className="border-b border-border text-left text-foreground/60">
                      <th className="p-2">#</th><th className="p-2">Trial</th><th className="p-2">Treatment</th><th className="p-2">Design</th>
                      <th className="p-2 text-right">N</th><th className="p-2">Result</th><th className="p-2">Rigor</th>
                    </tr></thead>
                    <tbody>
                      {best.filter((t) => !cluster || t.cluster === cluster).map((t) => (
                        <tr key={t.id} onClick={() => setTrialId(t.id)} className="border-b border-border/60 cursor-pointer hover:bg-blue-50/50 align-top">
                          <td className="p-2 tabular-nums text-foreground/60">{t.bestRank}</td>
                          <td className="p-2 max-w-md"><span className="font-medium">{t.title}</span><span className="block text-xs text-foreground/60">{cite(t)}</span></td>
                          <td className="p-2">{t.treatments.slice(0, 2).join("; ")}</td><td className="p-2">{t.design}</td>
                          <td className="p-2 text-right tabular-nums">{t.n ?? ""}</td><td className="p-2"><ResultDot verdict={t.verdict} /></td>
                          <td className="p-2"><RigorBar score={t.rigor} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {hasAudit && (
            <section className="mb-8" aria-labelledby="issues-heading">
              <h2 id="issues-heading" className="text-xl font-semibold mb-1">Issues the audit confirmed</h2>
              <p className="text-sm text-foreground/70 mb-3 max-w-4xl">
                Listed by paper, most serious first. Severity uses the same{" "}
                <Link href="/forensic-metascience-ai-toolkit/severity-ladder" className="text-blue-700 underline">1 to 7 ladder</Link>{" "}
                as our forensic work: 4 means one part of the work is flawed, 5 means a main claim does not survive. For
                design and interpretation problems the number says how much of the headline conclusion survives.
              </p>
              <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
                {(["all", ...FAMILIES] as const).map((f) => (
                  <button key={f} type="button" onClick={() => { setFamily(f); setShown(20); }} aria-pressed={family === f}
                    title={f === "all" ? undefined : FAMILY_BLURB[f]}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${family === f ? "border-blue-600 bg-blue-600 text-white" : "border-border bg-white hover:bg-muted"}`}>
                    {f === "all" ? "All kinds" : `${FAMILY_LABEL[f]} (${familyCount(f)})`}
                  </button>
                ))}
                <label className="ml-auto text-foreground/70">Severity at least{" "}
                  <select value={minSeverity} onChange={(e) => { setMinSeverity(Number(e.target.value)); setShown(20); }} className="rounded border border-border bg-white px-2 py-1">
                    {data.ladder.filter((l) => l.n >= 2 && l.n <= 6).map((l) => <option key={l.n} value={l.n}>{l.n} · {l.label}</option>)}
                  </select></label>
              </div>
              {family !== "all" && <p className="text-sm text-foreground/70 mb-3">{FAMILY_BLURB[family]}</p>}
              {issueRows.length === 0 && <p className="text-sm text-foreground/60">No confirmed issues match these filters.</p>}
              <div className="space-y-4">
                {issueRows.slice(0, shown).map(({ trial, issues }) => (
                  <article key={trial.id} className="rounded-lg border border-border bg-slate-50/60 p-3">
                    <header className="mb-2">
                      <a href={trial.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-800 hover:underline">{trial.title}</a>
                      <p className="text-xs text-foreground/60">{cite(trial)} · {trial.design}{trial.n ? ` · N ${trial.n}` : ""}
                        {trial.cluster && <> · {clusterLabel.get(trial.cluster)}</>} ·{" "}
                        <button type="button" className="text-blue-700 underline" onClick={() => setPanel(trial.paperId)}>full record</button></p>
                    </header>
                    <div className="space-y-2">{issues.map((i) => <IssueCard key={i.id} issue={i} ladder={data.ladder} />)}</div>
                  </article>
                ))}
              </div>
              {issueRows.length > shown && (
                <button type="button" onClick={() => setShown((n) => n + 20)} className="mt-3 rounded border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-muted">
                  Show more ({issueRows.length - shown} more papers)
                </button>
              )}
            </section>
          )}

          {hasAudit && tallies.length > 0 && (
            <section className="mb-8" aria-labelledby="tallies-heading">
              <h2 id="tallies-heading" className="text-xl font-semibold mb-1">How common each problem is</h2>
              <p className="text-sm text-foreground/70 mb-3">Share of the {verified.length} fully audited trials with at least one confirmed issue of each kind. The darker part is rated {MAJOR} or higher.</p>
              <div className="border border-border rounded-lg bg-white p-3 space-y-1.5">
                {tallies.map((t) => {
                  const share = (100 * t.trials.size) / Math.max(verified.length, 1), major = (100 * t.major.size) / Math.max(verified.length, 1);
                  return (
                    <div key={t.subtype} className="grid grid-cols-[minmax(0,19rem)_1fr_auto] items-center gap-3 text-sm">
                      <span className="truncate" title={FAMILY_LABEL[t.family]}>{subtypeLabel(t.subtype)}</span>
                      <span className="relative h-3 rounded bg-slate-100">
                        <span className="absolute inset-y-0 left-0 rounded bg-slate-300" style={{ width: `${share}%` }} />
                        <span className="absolute inset-y-0 left-0 rounded bg-orange-600" style={{ width: `${major}%` }} />
                      </span>
                      <span className="tabular-nums text-xs text-foreground/70">{t.trials.size} trials ({Math.round(share)}%), {t.major.size} major</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {hasAudit && (
            <section className="mb-4 max-w-4xl" aria-labelledby="method-heading">
              <h2 id="method-heading" className="text-xl font-semibold mb-2">How the audit was done, and what it cannot tell you</h2>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground/80">
                <li><span className="font-medium">Screen.</span> A fast model ({data.models.screen ?? "n/a"}) read each paper twice, once for numbers that disagree and once for design, interpretation and registration. It raised {(funnel.flags_raised ?? 0).toLocaleString()} flags across {funnel.papers_screened ?? audited.length} papers. A program searched each paper for every quoted passage and discarded {(funnel.flags_withheld_no_quote ?? 0).toLocaleString()} flags whose quotes were not there.</li>
                <li><span className="font-medium">Verify.</span> A stronger model ({data.models.verify ?? "n/a"}) re-examined each remaining flag against the paper, looking for an innocent explanation first. It rejected {(funnel.issues_rejected ?? 0).toLocaleString()}, called {(funnel.issues_judgement_call ?? 0).toLocaleString()} a matter of judgement, and upheld {((funnel.issues_confirmed ?? 0) + (funnel.issues_disputed ?? 0) + (funnel.issues_refuted_by_script ?? 0)).toLocaleString()}.</li>
                <li><span className="font-medium">Recompute.</span> Where an issue came down to arithmetic, a deterministic script from our forensic toolkit recomputed it. {funnel.confirmed_with_script ?? 0} confirmed issues carry a script result; {funnel.issues_refuted_by_script ?? 0} were dropped because the numbers turned out consistent.</li>
                <li><span className="font-medium">Second reader.</span> Issues rated {MAJOR} or higher went to a fresh AI session that saw only the passages and the claim, not the verifier&rsquo;s argument, and checked whether the paper says what the finding says. It agreed in full on {funnel.second_reader_stands ?? 0}, in part on {funnel.second_reader_stands_in_part ?? 0}, and disagreed on {funnel.issues_disputed ?? 0}, which are not listed as confirmed. This step checks the facts of a finding, not how much it matters.</li>
                {data.control && data.control.papers > 0 && (
                  <li><span className="font-medium">Control sample.</span> {data.control.papers} papers the screen did not flag were verified anyway and averaged {data.control.confirmed_issues_per_paper ?? "n/a"} confirmed issues each, against {data.control.flagged_confirmed_issues_per_paper ?? "n/a"} for flagged papers. Papers that were only screened can still contain problems.</li>
                )}
                <li><span className="font-medium">Limits.</span> No person has checked these findings. The models read text extracted from each paper, so a garbled table can create a false issue or hide a real one, and nothing here examines images, raw data or anything outside the published paper and its registry record. A paper with no listed issue has not been shown to be sound.</li>
              </ul>
              <p className="mt-3 text-sm text-foreground/70">If you are an author and believe a finding is wrong, tell us and we will correct it.</p>
            </section>
          )}
        </div>
      </main>
      <Footer />
      {panel && <ArticleDetailPanel paperId={panel} version={data.releaseVersion} onClose={() => setPanel(null)} reviewSlug={reviewSlug} />}
    </div>
  );
}
