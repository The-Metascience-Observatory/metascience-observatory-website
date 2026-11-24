"use client";

import { useMemo, useState } from "react";
import type { PaperLite, Pool, PoolStudy, TimeBin } from "./types";
import {
  EXPOSURE_ORDER, ESTIMAND_ORDER, HEADLINE_FAMILIES, MEASURE_ORDER, baselineLabel, comparatorClassLabel,
  comparatorKindLabel, doiHref, estimandLabel, exposureLabel, familyLabel, fmt, fmtCI, fmtInt, fmtValue,
  measureLabel, robLabel, severityLabel, sourceLabel, verificationLabel,
} from "./labels";
import { QuoteToggle } from "./EvidenceQuotes";

/** Pooled excess (or head-to-head) estimates by time bin, split by
 *  comparison group and severity, each row expandable into the forest of
 *  contributing cohorts. Differences are in percentage points on a linear
 *  axis; ratios on a log axis around 1. A pool of one cohort is shown as a
 *  single study (square), never as a pooled result (diamond). */

type Kind = "excess" | "head_to_head";

const EXCESS_COMPS = ["uninfected", "other_infection", "hospitalised_other_cause"];
const H2H_COMPS = ["influenza", "other_acute_respiratory", "sepsis_or_critical_illness", "ebv", "other_viral", "non_viral", "mixed_infections"];
const SEV_ORDER = ["non_hospitalised", "hospitalised", "all_severities", "asymptomatic", "not_applicable"];

interface Domain { lo: number; hi: number; log: boolean }

function pos(v: number, d: Domain): number {
  const t = d.log ? (Math.log(v) - Math.log(d.lo)) / (Math.log(d.hi) - Math.log(d.lo)) : (v - d.lo) / (d.hi - d.lo);
  return Math.max(0, Math.min(1, t)) * 100;
}

function Track({ v, lo, hi, pil, pih, d, pooled }: {
  v: number; lo?: number; hi?: number; pil?: number; pih?: number; d: Domain; pooled: boolean;
}) {
  const ref = d.log ? 1 : 0;
  const clippedL = (x?: number) => x != null && x < d.lo;
  const clippedR = (x?: number) => x != null && x > d.hi;
  return (
    <div className="relative h-5 w-full" aria-hidden>
      <div className="absolute inset-y-0 border-l border-dashed border-foreground/50" style={{ left: `${pos(ref, d)}%` }} />
      {pil != null && pih != null && (
        <div className="absolute top-1/2 h-[2px] -translate-y-1/2 bg-sky-400/50" style={{ left: `${pos(pil, d)}%`, width: `${pos(pih, d) - pos(pil, d)}%` }} />
      )}
      {lo != null && hi != null && (
        <div className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded bg-foreground/80" style={{ left: `${pos(lo, d)}%`, width: `${Math.max(0.5, pos(hi, d) - pos(lo, d))}%` }} />
      )}
      {(clippedL(lo) || clippedL(pil)) && <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] leading-none">◀</span>}
      {(clippedR(hi) || clippedR(pih)) && <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[10px] leading-none">▶</span>}
      <div
        className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 ${pooled ? "h-3.5 w-3.5 rotate-45 bg-blue-700" : "h-2.5 w-2.5 bg-foreground"}`}
        style={{ left: `${pos(v, d)}%` }}
      />
    </div>
  );
}

function Axis({ d, unit }: { d: Domain; unit: string }) {
  const ticks: number[] = [];
  if (d.log) {
    for (const t of [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50]) if (t >= d.lo && t <= d.hi) ticks.push(t);
  } else {
    const span = d.hi - d.lo;
    const step = span > 200 ? 50 : span > 80 ? 20 : span > 40 ? 10 : span > 16 ? 5 : span > 6 ? 2 : 1;
    for (let t = Math.ceil(d.lo / step) * step; t <= d.hi; t += step) ticks.push(t);
  }
  return (
    <div className="relative h-5 w-full text-[10px] text-muted-foreground" aria-hidden>
      {ticks.map((t) => (
        <span key={t} className="absolute -translate-x-1/2" style={{ left: `${pos(t, d)}%` }}>
          {unit === "ratio" ? t : t > 0 ? `+${t}` : t}
        </span>
      ))}
    </div>
  );
}

function StudyRow({ s, papers, unit, d }: { s: PoolStudy; papers: Record<string, PaperLite>; unit: string; d: Domain }) {
  const pl = papers[s.p];
  const href = doiHref(pl?.doi);
  const ids = s.er && s.cr ? [s.er, s.cr] : [s.r];
  return (
    <li className="grid gap-1 border-t border-border/70 py-1.5 sm:grid-cols-[13rem_minmax(0,1fr)_12rem] sm:items-center sm:gap-3">
      <div className="text-xs">
        {href ? <a href={href} target="_blank" rel="noreferrer" className="font-medium text-blue-700 underline">{pl?.label ?? s.p}</a> : <span className="font-medium">{pl?.label ?? s.p}</span>}
        <span className="block text-muted-foreground">“{s.o}”</span>
      </div>
      <Track v={s.v} lo={s.lo} hi={s.hi} d={d} pooled={false} />
      <div className="text-xs tabular-nums">
        <strong>{fmtValue(s.v, unit)}</strong> <span className="text-muted-foreground">({fmtCI(s.lo, s.hi, unit)})</span>
        {s.w != null && <span className="text-muted-foreground"> · weight {fmt(s.w)}%</span>}
      </div>
      <div className="text-[11px] text-muted-foreground sm:col-span-3">
        {sourceLabel(s.src)}
        {s.ep != null && s.cp != null ? <> · {fmt(s.ep)}% vs {fmt(s.cp)}%</> : null}
        {s.ne != null ? <> · n = {fmtInt(s.ne)} vs {fmtInt(s.nc)}</> : s.n != null ? <> · n = {fmtInt(s.n)}</> : null}
        {s.td != null ? <> · {fmt(s.td / 30.4375)} months</> : null}
        {" · "}{baselineLabel(s.base)} · risk of bias {robLabel(s.rob)}{s.rec ? " · health-record outcome" : ""} · {verificationLabel(s.vs)}
        {s.reason ? <> · <span className="text-red-800">{s.reason}</span></> : null}
        <div className="mt-1"><QuoteToggle ids={ids} /></div>
      </div>
    </li>
  );
}

export function ForestPanel({
  kind, pools, papers, timeBins,
}: {
  kind: Kind;
  pools: Pool[];
  papers: Record<string, PaperLite>;
  timeBins: TimeBin[];
}) {
  const [fam, setFam] = useState<string>("fatigue");
  const exps = EXPOSURE_ORDER.filter((e) => pools.some((p) => p.exp === e && p.fam === fam));
  const [expPick, setExp] = useState<string>("covid");
  const exp = exps.includes(expPick) ? expPick : exps[0] ?? "covid";
  const ests = ESTIMAND_ORDER.filter((e) => pools.some((p) => p.exp === exp && p.fam === fam && p.est === e));
  const [estPick, setEst] = useState<string>("prevalence");
  const est = ests.includes(estPick) ? estPick : ests[0] ?? "prevalence";
  const meass = MEASURE_ORDER.filter((m) => pools.some((p) => p.exp === exp && p.fam === fam && p.est === est && p.meas === m));
  const [measPick, setMeas] = useState<string>("risk_difference");
  const meas = meass.includes(measPick) ? measPick : meass[0] ?? "risk_difference";

  const binOrder = useMemo(() => new Map(timeBins.map((b, i) => [b.id, i])), [timeBins]);
  const binLabel = useMemo(() => new Map(timeBins.map((b) => [b.id, b.label])), [timeBins]);
  const compOrder = kind === "excess" ? EXCESS_COMPS : H2H_COMPS;
  const compLabel = kind === "excess" ? comparatorClassLabel : comparatorKindLabel;

  const shown = pools
    .filter((p) => p.fam === fam && p.exp === exp && p.est === est && p.meas === meas && (p.k > 0 || (p.np?.length ?? 0) > 0))
    .sort((a, b) =>
      compOrder.indexOf(a.comp ?? "") - compOrder.indexOf(b.comp ?? "") ||
      SEV_ORDER.indexOf(a.sev) - SEV_ORDER.indexOf(b.sev) ||
      (binOrder.get(a.bin) ?? 0) - (binOrder.get(b.bin) ?? 0));

  const unit = shown[0]?.unit ?? (meas === "risk_difference" ? "percentage_points" : "ratio");
  const log = unit === "ratio";
  const d: Domain = useMemo(() => {
    const vals: number[] = [];
    for (const p of shown) {
      if (p.pooled) vals.push(p.pooled.v, p.pooled.lo, p.pooled.hi);
      for (const s of p.studies ?? []) vals.push(s.v, ...(s.lo != null ? [s.lo] : []), ...(s.hi != null ? [s.hi] : []));
    }
    const ok = vals.filter((v) => Number.isFinite(v) && (!log || v > 0));
    if (log) {
      const lo = Math.min(0.8, ...ok);
      const hi = Math.max(1.25, ...ok);
      return { lo: lo / 1.1, hi: hi * 1.1, log };
    }
    // Clamp extreme two-study intervals so the bulk of the rows stays legible;
    // clipped ends get an arrow.
    const lo = Math.max(-60, Math.min(0, ...ok));
    const hi = Math.min(80, Math.max(5, ...ok));
    const pad = (hi - lo) * 0.05;
    return { lo: lo - pad, hi: hi + pad, log };
  }, [shown, log]);

  const groups: { comp: string; sev: string; pools: Pool[] }[] = [];
  for (const p of shown) {
    const last = groups[groups.length - 1];
    if (last && last.comp === p.comp && last.sev === p.sev) last.pools.push(p);
    else groups.push({ comp: p.comp ?? "", sev: p.sev, pools: [p] });
  }

  const select = "w-full min-w-0 rounded border border-border bg-background px-2 py-1.5";
  return (
    <div className="rounded-lg border border-foreground-strong/85 bg-card p-3 sm:p-4">
      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex min-w-0 flex-col gap-1"><span className="text-xs font-semibold">Outcome</span>
          <select className={select} value={fam} onChange={(e) => setFam(e.target.value)}>
            {HEADLINE_FAMILIES.map((f) => <option key={f} value={f}>{familyLabel(f)}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1"><span className="text-xs font-semibold">{kind === "excess" ? "Infection" : "Infection compared"}</span>
          <select className={select} value={exp} onChange={(e) => setExp(e.target.value)}>
            {exps.map((e) => <option key={e} value={e}>{exposureLabel(e)}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1"><span className="text-xs font-semibold">What is measured</span>
          <select className={select} value={est} onChange={(e) => setEst(e.target.value)}>
            {ests.map((e) => <option key={e} value={e}>{estimandLabel(e)}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1"><span className="text-xs font-semibold">Effect measure</span>
          <select className={select} value={meas} onChange={(e) => setMeas(e.target.value)}>
            {meass.map((m) => <option key={m} value={m}>{measureLabel(m)}</option>)}
          </select>
        </label>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        <span className="mr-1 inline-block h-2.5 w-2.5 rotate-45 bg-blue-700 align-middle" aria-hidden /> pooled (k ≥ 2 cohorts; random effects, REML, Knapp–Hartung 95% CI, black bar)
        {" · "}<span className="mr-1 inline-block h-2 w-2 bg-foreground align-middle" aria-hidden /> single study
        {" · "}<span className="mr-1 inline-block h-[2px] w-4 bg-sky-400 align-middle" aria-hidden /> 95% prediction interval (k ≥ 3)
        {" · "}dashed line = no difference{log ? " (ratio 1, log axis)" : " (0 percentage points)"}. ◀ ▶ = interval runs off the axis. Click a row to see its cohorts and their quotes.
      </p>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No estimates for this combination.</p>
      ) : (
        <div className="mt-3 space-y-5">
          <div className="hidden sm:grid sm:grid-cols-[13rem_minmax(0,1fr)_12rem] sm:gap-3">
            <span className="text-xs font-semibold">{measureLabel(meas)}</span>
            <Axis d={d} unit={unit} />
            <span />
          </div>
          {groups.map((g) => (
            <section key={`${g.comp}|${g.sev}`} aria-label={`${compLabel(g.comp)}, ${severityLabel(g.sev)}`}>
              <h4 className="text-sm font-semibold">{exposureLabel(exp)} {compLabel(g.comp)} <span className="font-normal text-muted-foreground">· {severityLabel(g.sev)}</span></h4>
              <ul>
                {g.pools.map((p) => {
                  const one = p.k === 1 ? p.studies?.[0] : undefined;
                  const v = p.pooled?.v ?? one?.v;
                  return (
                    <li key={p.id} className="border-t border-border">
                      <details className="group">
                        <summary className="grid cursor-pointer list-none gap-1 py-1.5 hover:bg-muted/40 sm:grid-cols-[13rem_minmax(0,1fr)_12rem] sm:items-center sm:gap-3">
                          <span className="text-xs">
                            <span className="mr-1 inline-block transition-transform group-open:rotate-90" aria-hidden>▸</span>
                            <strong>{binLabel.get(p.bin) ?? p.bin}</strong>
                            <span className="text-muted-foreground"> · k = {p.k}{p.k === 1 ? " (single study)" : ""}{p.nt ? ` · n = ${fmtInt(p.nt)}` : ""}</span>
                          </span>
                          {v != null ? (
                            <Track v={v} lo={p.pooled?.lo ?? one?.lo} hi={p.pooled?.hi ?? one?.hi} pil={p.pooled?.pil} pih={p.pooled?.pih} d={d} pooled={!!p.pooled} />
                          ) : <span className="text-xs text-muted-foreground">no poolable estimate</span>}
                          <span className="text-xs tabular-nums">
                            {p.pooled ? (
                              <>
                                <strong>{fmtValue(p.pooled.v, p.unit)}</strong> <span className="text-muted-foreground">({fmtCI(p.pooled.lo, p.pooled.hi, p.unit)})</span>
                                <span className="block text-muted-foreground">
                                  {p.pooled.pil != null ? `PI ${fmtCI(p.pooled.pil, p.pooled.pih, p.unit)} · ` : ""}I² {fmt(p.pooled.i2)}%
                                </span>
                              </>
                            ) : one ? (
                              <>
                                <strong>{fmtValue(one.v, p.unit)}</strong> <span className="text-muted-foreground">({fmtCI(one.lo, one.hi, p.unit)})</span>
                                <span className="block text-muted-foreground">single study: {papers[one.p]?.label ?? one.p}</span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">{p.np?.length ?? 0} reported without a CI or n</span>
                            )}
                          </span>
                        </summary>
                        <div className="mb-2 rounded bg-muted/20 px-2 pb-2">
                          <ul>
                            {(p.studies ?? []).map((s) => <StudyRow key={s.r} s={s} papers={papers} unit={p.unit} d={d} />)}
                          </ul>
                          {(p.np?.length ?? 0) > 0 && (
                            <>
                              <p className="mt-2 text-xs font-semibold">Shown, not pooled (no standard error):</p>
                              <ul>{p.np!.map((s) => <StudyRow key={s.r} s={s} papers={papers} unit={p.unit} d={d} />)}</ul>
                            </>
                          )}
                          {(p.nd ?? 0) > 0 && <p className="mt-1 text-[11px] text-muted-foreground">{p.nd} other candidate estimate{p.nd === 1 ? "" : "s"} not used (another estimate of the same paper or cohort was chosen); all are in the evidence table.</p>}
                          {p.note && <p className="mt-1 text-[11px] text-muted-foreground">Note: {p.note}</p>}
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
