"use client";

import { useMemo, useState } from "react";
import type { HeatCell } from "./derive";
import type { TimeBin } from "./types";
import { EXPOSURE_ORDER, HEADLINE_FAMILIES, exposureLabel, familyLabel, fmt, fmtInt, severityLabel } from "./labels";

/** Symptom x time: raw prevalence in the infected (exposed) groups, or in the
 *  uninfected comparison groups, per outcome family and time bin. A cell is
 *  the random-effects pooled percentage when k >= 2 cohorts, otherwise the
 *  single cohort's value (dashed outline, italic). These are raw
 *  percentages: they include background symptoms. */

const ESTS = [
  { id: "prevalence", label: "Point prevalence" },
  { id: "duration_at_least", label: "Lasting ≥ t" },
  { id: "cumulative_incidence", label: "Cumulative incidence (records)" },
];

/** One-hue sequential ramp (light -> dark blue) on the percentage. */
function cellStyle(v: number, max: number) {
  const t = Math.max(0, Math.min(1, Math.sqrt(v / max)));
  const light = 96 - t * 62;
  return {
    background: `hsl(212 70% ${light}%)`,
    color: light < 58 ? "white" : "hsl(215 25% 15%)",
  };
}

export function Heatmap({ cells, timeBins }: { cells: HeatCell[]; timeBins: TimeBin[] }) {
  const exps = EXPOSURE_ORDER.filter((e) => cells.some((c) => c.exp === e && (e === "none" ? c.role === "comparator" : c.role === "exposed")));
  const [exp, setExp] = useState("covid");
  const [est, setEst] = useState("prevalence");
  const role = exp === "none" ? "comparator" : "exposed";
  const pool = cells.filter((c) => c.exp === exp && c.role === role && c.est === est);
  const sevs = [...new Set(pool.map((c) => c.sev))].sort((a, b) =>
    pool.filter((c) => c.sev === b).length - pool.filter((c) => c.sev === a).length);
  const [sevPick, setSev] = useState<string>("");
  const sev = sevs.includes(sevPick) ? sevPick : sevs[0] ?? "";
  const shown = pool.filter((c) => c.sev === sev);

  const fams = useMemo(() => {
    const present = [...new Set(shown.map((c) => c.fam))];
    const head = HEADLINE_FAMILIES.filter((f) => present.includes(f));
    const rest = present.filter((f) => !(HEADLINE_FAMILIES as readonly string[]).includes(f)).sort();
    return [...head, ...rest];
  }, [shown]);
  const bins = timeBins.filter((b) => shown.some((c) => c.bin === b.id));
  const get = (fam: string, bin: string) => shown.find((c) => c.fam === fam && c.bin === bin);
  const max = Math.max(20, ...shown.map((c) => c.v ?? c.single ?? 0));

  const select = "w-full min-w-0 rounded border border-border bg-background px-2 py-1.5";
  return (
    <div className="rounded-lg border border-foreground-strong/85 bg-card p-3 sm:p-4">
      <div className="grid gap-3 text-sm sm:grid-cols-3">
        <label className="flex min-w-0 flex-col gap-1"><span className="text-xs font-semibold">Group</span>
          <select className={select} value={exp} onChange={(e) => setExp(e.target.value)}>
            {exps.map((e) => <option key={e} value={e}>{e === "none" ? "Uninfected comparison groups (background)" : `${exposureLabel(e)} (infected groups)`}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1"><span className="text-xs font-semibold">Severity</span>
          <select className={select} value={sev} onChange={(e) => setSev(e.target.value)}>
            {sevs.map((s) => <option key={s} value={s}>{severityLabel(s)}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1"><span className="text-xs font-semibold">What is measured</span>
          <select className={select} value={est} onChange={(e) => setEst(e.target.value)}>
            {ESTS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </label>
      </div>
      {fams.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No estimates for this combination.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] border-separate border-spacing-[2px] text-xs">
            <caption className="sr-only">Raw percentage by outcome and time since infection</caption>
            <thead>
              <tr>
                <th scope="col" className="text-left font-semibold">Outcome</th>
                {bins.map((b) => <th key={b.id} scope="col" className="px-1 text-center font-semibold">{b.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {fams.map((f) => (
                <tr key={f}>
                  <th scope="row" className="max-w-[12rem] pr-2 text-left font-normal">{familyLabel(f)}</th>
                  {bins.map((b) => {
                    const c = get(f, b.id);
                    const v = c?.v ?? c?.single;
                    if (!c || v == null) {
                      return <td key={b.id} className="rounded bg-muted/40 text-center text-muted-foreground">{c && (c.nnp ?? 0) > 0 ? <span title="Reported without CI or denominator; not pooled">n/p</span> : "·"}</td>;
                    }
                    const title = c.k >= 2
                      ? `${familyLabel(f)}, ${b.label}: pooled ${fmt(v)}% (95% CI ${fmt(c.lo)}–${fmt(c.hi)}${c.pil != null ? `; PI ${fmt(c.pil)}–${fmt(c.pih)}` : ""}; I² ${fmt(c.i2)}%), k = ${c.k} cohorts, n = ${fmtInt(c.nt)}`
                      : `${familyLabel(f)}, ${b.label}: single study ${fmt(v)}%, n = ${fmtInt(c.nt)}`;
                    return (
                      <td key={b.id} title={title} style={cellStyle(v, max)}
                          className={`rounded px-1 py-1.5 text-center tabular-nums ${c.k < 2 ? "italic outline-dashed outline-1 -outline-offset-2 outline-foreground/40" : ""}`}>
                        <span className="block font-semibold">{fmt(v)}%</span>
                        <span className="block text-[10px] opacity-90">k={c.k}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Cell = pooled % when k ≥ 2 cohorts (random effects on the logit scale), else the single cohort&apos;s value (italic, dashed). Hover a cell for the 95% CI, prediction interval, I² and n. “n/p” = reported without a CI or denominator, so not poolable. Darker = higher %. Each row&apos;s outcome definitions vary between cohorts; see the trajectory explorer and evidence table for the wording.
      </p>
    </div>
  );
}
