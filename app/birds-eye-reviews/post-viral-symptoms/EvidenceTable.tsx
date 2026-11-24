"use client";

import { useEffect, useState } from "react";
import type { EvidenceRow, PaperLite, TimeBin } from "./types";
import { EVIDENCE_URL } from "./EvidenceQuotes";
import {
  baselineLabel, definitionLabel, doiHref, estimandShort, exposureLabel, familyLabel, fmt, quoteText,
  verificationLabel,
} from "./labels";

/** Every extracted estimate (or contrast), paginated on the server so the
 *  quotes never travel with the page. */

interface Resp {
  total: number;
  totalOfKind: number;
  page: number;
  pageSize: number;
  rows: EvidenceRow[];
  facets: { exp: string[]; fam: string[]; bin: string[] };
}

const DOWNLOAD = "/birds-eye-reviews/post-viral-symptoms/download";

export function EvidenceTable({ papers, timeBins }: { papers: Record<string, PaperLite>; timeBins: TimeBin[] }) {
  const [kind, setKind] = useState<"estimate" | "contrast">("estimate");
  const [exp, setExp] = useState("");
  const [fam, setFam] = useState("");
  const [bin, setBin] = useState("");
  const [ctrl, setCtrl] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(0), [kind, exp, fam, bin, ctrl, status, qDebounced]);

  useEffect(() => {
    const params = new URLSearchParams({ kind, exp, fam, bin, ctrl, status, q: qDebounced, page: String(page) });
    let live = true;
    setLoading(true);
    fetch(`${EVIDENCE_URL}?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: Resp) => { if (live) { setData(j); setError(false); } })
      .catch(() => live && setError(true))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [kind, exp, fam, bin, ctrl, status, qDebounced, page]);

  const binLabel = new Map(timeBins.map((b) => [b.id, b.label]));
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const select = "w-full min-w-0 rounded border border-border bg-background px-2 py-1.5 text-sm";

  return (
    <div className="rounded-lg border border-foreground-strong/85 bg-card p-3 sm:p-4">
      <div className="flex flex-wrap gap-2 text-sm">
        <div role="group" aria-label="Row type" className="flex gap-1">
          {(["estimate", "contrast"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
                    className={`rounded-full border px-3 py-1 text-xs ${kind === k ? "border-foreground bg-foreground text-background" : "border-border"}`}>
              {k === "estimate" ? "Group estimates (%)" : "Between-group contrasts"}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold">Infection
          <select className={select} value={exp} onChange={(e) => setExp(e.target.value)}>
            <option value="">All</option>
            {data?.facets.exp.map((e) => <option key={e} value={e}>{exposureLabel(e)}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold">Outcome
          <select className={select} value={fam} onChange={(e) => setFam(e.target.value)}>
            <option value="">All</option>
            {data?.facets.fam.map((f) => <option key={f} value={f}>{familyLabel(f)}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold">Time
          <select className={select} value={bin} onChange={(e) => setBin(e.target.value)}>
            <option value="">All</option>
            {timeBins.filter((b) => !data || data.facets.bin.includes(b.id)).map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold">Comparison group
          <select className={select} value={ctrl} onChange={(e) => setCtrl(e.target.value)}>
            <option value="">Any paper</option>
            <option value="with">Paper has a comparison group</option>
            <option value="without">Paper has none</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold">Status
          <select className={select} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All rows</option>
            <option value="usable">Usable</option>
            <option value="excluded">Excluded (with reason)</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold">Search
          <input className={select} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="paper, outcome, quote…" />
        </label>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span aria-live="polite">
          {error ? "Could not load the evidence." : data ? `${data.total.toLocaleString("en-US")} of ${data.totalOfKind.toLocaleString("en-US")} ${kind === "estimate" ? "estimates" : "contrasts"}${loading ? " · loading…" : ""}` : "Loading…"}
        </span>
        <span className="flex flex-wrap gap-3">
          <a href={`${DOWNLOAD}/estimates.csv`} download className="text-blue-700 underline">Download all estimates (CSV)</a>
          <a href={`${DOWNLOAD}/contrasts.csv`} download className="text-blue-700 underline">Download all contrasts (CSV)</a>
        </span>
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="border-b border-foreground/40">
            <tr className="align-bottom">
              <th scope="col" className="py-1 pr-2">Paper</th>
              <th scope="col" className="py-1 pr-2">Group</th>
              <th scope="col" className="py-1 pr-2">Outcome and definition</th>
              <th scope="col" className="py-1 pr-2">Time</th>
              <th scope="col" className="py-1 pr-2 text-right">{kind === "estimate" ? "n/N" : "Measure"}</th>
              <th scope="col" className="py-1 pr-2 text-right">{kind === "estimate" ? "%" : "Value"}</th>
              <th scope="col" className="py-1 pr-2">95% CI</th>
              <th scope="col" className="py-1 pr-2 w-[34%]">Quote, location, checks</th>
            </tr>
          </thead>
          <tbody>
            {data?.rows.map((r) => {
              const pl = papers[r.paper_id];
              const href = doiHref(pl?.doi ?? r.paper_id);
              return (
                <tr key={r.row_id} className={`border-b border-border align-top ${r.excluded_reason ? "opacity-60" : ""}`}>
                  <td className="py-1.5 pr-2">
                    {href ? <a href={href} target="_blank" rel="noreferrer" className="text-blue-700 underline">{pl?.label ?? r.key}</a> : pl?.label ?? r.key}
                    <span className="block font-mono text-[10px] text-muted-foreground">{r.row_id.split("#")[1]}</span>
                  </td>
                  <td className="py-1.5 pr-2">
                    {r.group_label}
                    {r._kind === "contrast" && <span className="block text-muted-foreground">vs {r.comparator_group_label}</span>}
                    <span className="block text-muted-foreground">{exposureLabel(r.exposure_class)}{r.role === "comparator" ? " · comparison group" : ""}{r.subgroup_label ? ` · subgroup: ${r.subgroup_label}` : ""}</span>
                  </td>
                  <td className="py-1.5 pr-2">
                    {r.outcome_label}
                    <span className="block text-muted-foreground">{familyLabel(r.outcome_family)} · {estimandShort(r.estimand_family)}{r.definition_class ? ` · ${definitionLabel(r.definition_class)}` : ""}{r.baseline_handling ? ` · ${baselineLabel(r.baseline_handling)}` : ""}</span>
                  </td>
                  <td className="py-1.5 pr-2">
                    {r.time_months ? `${fmt(Number(r.time_months))} mo` : "—"}
                    <span className="block text-muted-foreground">{binLabel.get(r.time_bin) ?? ""}</span>
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">
                    {r._kind === "estimate"
                      ? r.numerator && r.denominator ? `${r.numerator}/${r.denominator}` : r.denominator ? `—/${r.denominator}` : "—"
                      : <>{r.measure?.replace(/_/g, " ")}{r.adjusted === "True" ? " (adj.)" : ""}</>}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-semibold tabular-nums">
                    {r._kind === "estimate" ? (r.percent_value ? `${r.value_operator === "<" ? "<" : ""}${fmt(Number(r.percent_value))}` : "—") : r.value || "—"}
                  </td>
                  <td className="py-1.5 pr-2 tabular-nums">{r.ci_low && r.ci_high ? `${r.ci_low} to ${r.ci_high}` : "—"}</td>
                  <td className="py-1.5 pr-2">
                    <details>
                      <summary className="cursor-pointer text-blue-700">{quoteText(r.quote).slice(0, 90)}{(r.quote?.length ?? 0) > 90 ? "…" : ""}</summary>
                      <blockquote className="mt-1 whitespace-pre-line border-l-2 border-foreground/30 pl-2 italic">“{quoteText(r.quote)}”</blockquote>
                      {r.time_label && <p className="mt-1 text-muted-foreground">Time as stated: {r.time_label}</p>}
                      {r.model_label && <p className="mt-1 text-muted-foreground">Model: {r.model_label}</p>}
                    </details>
                    <span className="block text-muted-foreground">
                      {r.location}{r.location ? " · " : ""}confidence {r.confidence || "—"} · {verificationLabel(r.verification_status)}{r.value_source ? ` · value ${r.value_source}` : ""}
                      {r.excluded_reason ? <span className="text-red-800"> · excluded: {r.excluded_reason}</span> : null}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center justify-end gap-2 text-xs">
        <button type="button" className="rounded border border-border px-2 py-1 disabled:opacity-40" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page + 1} of {pages}</span>
        <button type="button" className="rounded border border-border px-2 py-1 disabled:opacity-40" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}
