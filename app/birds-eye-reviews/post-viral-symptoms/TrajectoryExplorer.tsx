"use client";

import { useMemo, useState } from "react";
import type { PaperLite, Pool, Series } from "./types";
import { excessLines } from "./derive";
import {
  EXPOSURE_ORDER, HEADLINE_FAMILIES, baselineLabel, comparatorClassLabel, definitionLabel,
  doiHref, estimandLabel, exposureColor, exposureLabel, familyLabel, fmt, fmtInt, severityLabel,
  sourceLabel,
} from "./labels";
import { EvidenceQuotes } from "./EvidenceQuotes";
import { Marker, SHAPES, type Shape } from "./Marker";

/** The centrepiece: one connected line per cohort group, months after
 *  infection on a log axis, % with the outcome (raw) or percentage points
 *  above the cohort's own comparison group (excess).
 *
 *  Estimand families never share an axis: point prevalence, "symptoms that
 *  lasted at least t" and cumulative incidence are separate views (the x
 *  axis even means different things), and incidence rates are not plotted. */

const W = 760;
const H = 420;
const M = { top: 16, right: 18, bottom: 48, left: 58 };

type Mode = "raw" | "excess";
type Sev = "all" | "non_hospitalised" | "hospitalised";

const ESTIMANDS = ["prevalence", "duration_at_least", "cumulative_incidence"] as const;
const COMPARATORS = ["uninfected", "other_infection", "hospitalised_other_cause"];

interface Pt {
  key: string;
  x: number;
  y: number;
  lo?: number;
  hi?: number;
  lineId: string;
  rowIds: string[];
  paper: string;
  // raw
  group?: string;
  outcome?: string;
  num?: number;
  den?: number;
  ciSource?: string;
  // excess
  ep?: number;
  cp?: number;
  ne?: number;
  nc?: number;
  src?: string;
}

interface Line {
  id: string;
  cohort: string;
  exp: string;
  sev: string;
  dashed: boolean;
  title: string;
  detail: string;
  definition: string;
  n?: number;
  papers: string[];
  pts: Pt[];
  shape: Shape;
}

function niceMax(v: number): number {
  if (v <= 0) return 10;
  const step = v > 60 ? 20 : v > 30 ? 10 : v > 12 ? 5 : v > 5 ? 2 : 1;
  return Math.ceil(v / step) * step;
}

function ticks(lo: number, hi: number): number[] {
  const span = hi - lo;
  const step = span > 120 ? 40 : span > 60 ? 20 : span > 30 ? 10 : span > 12 ? 5 : span > 5 ? 2 : 1;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

const uniq = <T,>(xs: (T | undefined)[]) => [...new Set(xs.filter((x): x is T => x != null && x !== ""))];

export function TrajectoryExplorer({
  series, excessPools, papers, cohorts,
}: {
  series: Series[];
  /** The excess pools; each study is one cohort's excess at one time. */
  excessPools: Pool[];
  papers: Record<string, PaperLite>;
  cohorts: Record<string, string>;
}) {
  const excess = useMemo(() => excessLines(excessPools), [excessPools]);
  const [fam, setFam] = useState<string>("fatigue");
  const [est, setEst] = useState<(typeof ESTIMANDS)[number]>("prevalence");
  const [mode, setMode] = useState<Mode>("raw");
  const [sev, setSev] = useState<Sev>("all");
  const availableExps = useMemo(
    () => EXPOSURE_ORDER.filter((e) => series.some((s) => s.exp === e) || excess.some((l) => l.exp === e)),
    [series, excess],
  );
  // Start with the main comparison (COVID-19, influenza, mononucleosis and
  // the uninfected background); the other infections are one click away.
  const [exps, setExps] = useState<Set<string>>(() => new Set(["covid", "influenza", "ebv", "none"]));
  const [comps, setComps] = useState<Set<string>>(() => new Set(["uninfected"]));
  const [focus, setFocus] = useState<string | null>(null);
  const [hover, setHover] = useState<Pt | null>(null);
  const [selected, setSelected] = useState<Pt | null>(null);

  const toggle = (set: Set<string>, v: string, update: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    update(next);
  };

  const lines: Line[] = useMemo(() => {
    const shapeCount = new Map<string, number>();
    const nextShape = (exp: string) => {
      const i = shapeCount.get(exp) ?? 0;
      shapeCount.set(exp, i + 1);
      return SHAPES[i % SHAPES.length];
    };
    if (mode === "raw") {
      const passes = (s: Series) => s.fam === fam && s.est === est && exps.has(s.exp);
      const exposedOk = (s: Series) => sev === "all" || s.sev === sev;
      const cohortsShown = new Set(series.filter((s) => s.role === "exposed" && passes(s) && exposedOk(s)).map((s) => s.cohort));
      return series
        .filter((s) => passes(s) && (s.role === "exposed" ? exposedOk(s) : sev === "all" || cohortsShown.has(s.cohort)))
        .sort((a, b) => EXPOSURE_ORDER.indexOf(a.exp) - EXPOSURE_ORDER.indexOf(b.exp) || a.cohort.localeCompare(b.cohort))
        .map((s) => {
          const outcomes = uniq(s.pts.map((p) => p.o));
          return {
            id: s.id,
            cohort: s.cohort,
            exp: s.exp,
            sev: s.sev,
            dashed: s.role === "comparator",
            title: cohorts[s.cohort] ?? s.cohort,
            detail: (s.groups ?? []).join("; "),
            definition: `${outcomes.slice(0, 2).join("; ")}${outcomes.length > 2 ? ` (+${outcomes.length - 2} more)` : ""} · ${definitionLabel(s.defc)} · ${baselineLabel(s.base)}`,
            n: Math.max(0, ...s.pts.map((p) => p.den ?? 0)) || undefined,
            papers: uniq(s.pts.map((p) => p.r.split("#")[0])),
            shape: nextShape(s.exp),
            pts: s.pts.map((p) => ({
              key: `${s.id}@${p.r}`, x: p.tm, y: p.pct, lo: p.lo, hi: p.hi, lineId: s.id, rowIds: [p.r],
              paper: p.r.split("#")[0], group: p.g ?? s.groups?.[0], outcome: p.o, num: p.num, den: p.den, ciSource: p.cs,
            })),
          };
        });
    }
    return excess
      .filter((l) => l.fam === fam && l.est === est && exps.has(l.exp) && comps.has(l.comp) && (sev === "all" || l.sev === sev))
      .sort((a, b) => EXPOSURE_ORDER.indexOf(a.exp) - EXPOSURE_ORDER.indexOf(b.exp) || a.cohort.localeCompare(b.cohort))
      .map((l) => {
        const outcomes = uniq(l.pts.map((p) => p.o));
        return {
          id: l.id,
          cohort: l.cohort,
          exp: l.exp,
          sev: l.sev,
          dashed: false,
          title: cohorts[l.cohort] ?? l.cohort,
          detail: `${severityLabel(l.sev)} ${comparatorClassLabel(l.comp)}`,
          definition: outcomes.slice(0, 2).join("; ") + (outcomes.length > 2 ? ` (+${outcomes.length - 2} more)` : ""),
          n: Math.max(0, ...l.pts.map((p) => (p.ne ?? 0) + (p.nc ?? 0))) || undefined,
          papers: uniq(l.pts.map((p) => p.p)),
          shape: nextShape(l.exp),
          pts: l.pts.map((p) => ({
            key: `${l.id}@${p.r}`, x: p.tm, y: p.v, lo: p.lo, hi: p.hi, lineId: l.id,
            rowIds: p.er && p.cr ? [p.er, p.cr] : [p.r], paper: p.p, outcome: p.o,
            ep: p.ep, cp: p.cp, ne: p.ne, nc: p.nc, src: p.src,
          })),
        };
      });
  }, [mode, series, excess, fam, est, exps, comps, sev, cohorts]);

  const allPts = lines.flatMap((l) => l.pts);
  const xs = allPts.map((p) => p.x).filter((x) => x > 0);
  const xLo = Math.min(0.8, ...(xs.length ? xs.map((x) => x * 0.85) : [0.8]));
  const xHi = Math.max(40, ...(xs.length ? xs.map((x) => x * 1.15) : [40]));
  const xTicks = [1, 3, 6, 12, 24, 36, 60, 120].filter((t) => t >= xLo && t <= xHi);
  const yVals = allPts.flatMap((p) => [p.y, p.lo ?? p.y, p.hi ?? p.y]);
  const yLo = mode === "raw" ? 0 : Math.min(0, Math.floor(Math.min(...(yVals.length ? yVals : [0])) / 5) * 5);
  const yHi = niceMax(Math.max(mode === "raw" ? 10 : 5, ...(yVals.length ? yVals : [0])));
  // Rounded to 0.01 px: Math.log can differ in the last bit between the
  // server and the browser, which would be a hydration mismatch.
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const sx = (v: number) => r2(M.left + ((Math.log(v) - Math.log(xLo)) / (Math.log(xHi) - Math.log(xLo))) * (W - M.left - M.right));
  const sy = (v: number) => r2(H - M.bottom - ((v - yLo) / (yHi - yLo || 1)) * (H - M.top - M.bottom));

  const shown = selected ?? hover;
  const shownLine = shown ? lines.find((l) => l.id === shown.lineId) : undefined;
  const xLabel = est === "duration_at_least"
    ? "Minimum duration of symptoms, months (log scale)"
    : est === "cumulative_incidence"
      ? "Months after infection: diagnoses recorded up to this time (log scale)"
      : "Months after infection (log scale)";
  const yLabel = mode === "raw"
    ? est === "cumulative_incidence" ? "% with a new recorded diagnosis" : est === "duration_at_least" ? "% whose symptoms lasted at least this long" : "% of the group with the outcome"
    : "Excess over comparison group (percentage points)";

  const chip = (active: boolean) =>
    `rounded-full border px-2.5 py-1 text-xs transition-colors ${active ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground hover:border-foreground/60"}`;

  return (
    <div className="rounded-lg border border-foreground-strong/85 bg-card p-3 sm:p-4">
      <fieldset className="grid gap-3 text-sm md:grid-cols-2">
        <legend className="sr-only">Chart controls</legend>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-semibold">Outcome</span>
          <select value={fam} onChange={(e) => { setFam(e.target.value); setSelected(null); }} className="w-full min-w-0 rounded border border-border bg-background px-2 py-1.5">
            {HEADLINE_FAMILIES.map((f) => <option key={f} value={f}>{familyLabel(f)}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-semibold">What is measured (never mixed on one axis)</span>
          <select value={est} onChange={(e) => { setEst(e.target.value as typeof est); setSelected(null); }} className="w-full min-w-0 rounded border border-border bg-background px-2 py-1.5">
            {ESTIMANDS.map((x) => <option key={x} value={x}>{estimandLabel(x)}</option>)}
          </select>
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold">Show</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Raw prevalence or excess over controls">
            <button type="button" className={chip(mode === "raw")} aria-pressed={mode === "raw"} onClick={() => { setMode("raw"); setSelected(null); }}>Raw prevalence</button>
            <button type="button" className={chip(mode === "excess")} aria-pressed={mode === "excess"} onClick={() => { setMode("excess"); setSelected(null); }}>Excess over controls</button>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold">Severity of the acute illness</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Severity">
            {(["all", "non_hospitalised", "hospitalised"] as Sev[]).map((s) => (
              <button key={s} type="button" className={chip(sev === s)} aria-pressed={sev === s} onClick={() => setSev(s)}>
                {s === "all" ? "All" : s === "non_hospitalised" ? "Community" : "Hospitalised"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs font-semibold">Infection</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Infections shown">
            {availableExps.map((e) => (
              <button key={e} type="button" className={chip(exps.has(e))} aria-pressed={exps.has(e)} onClick={() => toggle(exps, e, setExps)}>
                <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: exposureColor(e) }} aria-hidden />
                {exposureLabel(e)}
              </button>
            ))}
          </div>
        </div>
        {mode === "excess" && (
          <div className="flex flex-col gap-1 md:col-span-2">
            <span className="text-xs font-semibold">Comparison group</span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Comparison groups">
              {COMPARATORS.map((c) => (
                <button key={c} type="button" className={chip(comps.has(c))} aria-pressed={comps.has(c)} onClick={() => toggle(comps, c, setComps)}>
                  {comparatorClassLabel(c)}
                </button>
              ))}
            </div>
          </div>
        )}
      </fieldset>

      <p className="mt-3 text-xs text-muted-foreground">
        {mode === "raw"
          ? <>Each line is one group of one cohort followed over time; repeat reports of the same cohort are joined. Solid lines are infected groups; dashed lines are the cohorts&apos; comparison groups. Whiskers are 95% CIs (the paper&apos;s own, or a Wilson interval from n/N). A raw percentage includes symptoms people would have had anyway.</>
          : <>Only cohorts with a comparison group appear. Each point is the exposed group&apos;s percentage minus its comparison group&apos;s at that time (the paper&apos;s own adjusted or crude difference when reported), in percentage points; 0 = no excess.</>}
        {est === "duration_at_least" && <> <strong>Here the x axis is how long symptoms lasted, not when they were measured.</strong></>}
        {est === "cumulative_incidence" && <> <strong>Health-record studies: the share with a new diagnosis code by that time, not symptoms present at that time.</strong></>}
        {" "}Incidence rates are not plotted (they are in the evidence table).
      </p>

      <div className="relative mt-2">
        {lines.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No cohort reports this combination. Try another outcome, measure or infection.</p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
               aria-label={`${familyLabel(fam)}: ${mode === "raw" ? "raw percentage" : "excess percentage points"} by months after infection, ${lines.length} cohort lines`}>
            {xTicks.map((t) => (
              <g key={`x${t}`}>
                <line x1={sx(t)} x2={sx(t)} y1={M.top} y2={H - M.bottom} stroke="currentColor" className="text-foreground/10" />
                <text x={sx(t)} y={H - M.bottom + 16} textAnchor="middle" fontSize={12} className="fill-current text-foreground">{t}</text>
              </g>
            ))}
            {ticks(yLo, yHi).map((t) => (
              <g key={`y${t}`}>
                <line x1={M.left} x2={W - M.right} y1={sy(t)} y2={sy(t)} stroke="currentColor"
                      className={t === 0 && mode === "excess" ? "text-foreground/60" : "text-foreground/10"}
                      strokeDasharray={t === 0 && mode === "excess" ? "4 3" : undefined} />
                <text x={M.left - 6} y={sy(t) + 4} textAnchor="end" fontSize={12} className="fill-current text-foreground">{t}</text>
              </g>
            ))}
            <line x1={M.left} x2={M.left} y1={M.top} y2={H - M.bottom} stroke="currentColor" className="text-foreground" />
            <line x1={M.left} x2={W - M.right} y1={H - M.bottom} y2={H - M.bottom} stroke="currentColor" className="text-foreground" />
            <text x={(M.left + W - M.right) / 2} y={H - 8} textAnchor="middle" fontSize={13} fontWeight={700} className="fill-current text-foreground">{xLabel}</text>
            <text x={14} y={(M.top + H - M.bottom) / 2} textAnchor="middle" fontSize={13} fontWeight={700} className="fill-current text-foreground"
                  transform={`rotate(-90 14 ${(M.top + H - M.bottom) / 2})`}>{yLabel}</text>

            {lines.map((l) => {
              const faded = focus != null && focus !== l.id;
              const color = exposureColor(l.exp);
              const pts = l.pts.filter((p) => p.x > 0);
              return (
                <g key={l.id} opacity={faded ? 0.12 : 1}>
                  {pts.length >= 2 && (
                    <polyline fill="none" stroke={color} strokeWidth={focus === l.id ? 3 : 2} strokeDasharray={l.dashed ? "5 4" : undefined}
                              points={pts.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ")} />
                  )}
                  {pts.map((p) => (
                    <g key={p.key}>
                      {p.lo != null && p.hi != null && (
                        <line x1={sx(p.x)} x2={sx(p.x)} y1={sy(Math.max(p.lo, yLo))} y2={sy(Math.min(p.hi, yHi))} stroke={color} strokeWidth={1.2} opacity={0.7} />
                      )}
                      <Marker shape={l.shape} x={sx(p.x)} y={sy(p.y)} r={selected?.key === p.key ? 6.5 : 4.8} color={color} hollow={l.dashed} />
                      <circle cx={sx(p.x)} cy={sy(p.y)} r={11} fill="transparent" className="cursor-pointer"
                              tabIndex={0} role="button"
                              aria-label={`${l.title}: ${fmt(p.y)}${mode === "raw" ? "%" : " percentage points"} at ${fmt(p.x)} months`}
                              onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)}
                              onFocus={() => setHover(p)} onBlur={() => setHover(null)}
                              onClick={() => setSelected(selected?.key === p.key ? null : p)}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(p); } }} />
                    </g>
                  ))}
                </g>
              );
            })}
          </svg>
        )}
      </div>

      <div className="mt-2 min-h-[5rem] rounded border border-border bg-muted/20 p-3 text-sm" aria-live="polite">
        {!shown || !shownLine ? (
          <p className="text-xs text-muted-foreground">Hover a point for its numbers; click (or tap) it to pin it and load the paper&apos;s quote.</p>
        ) : (
          <div>
            <p className="font-semibold">
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: exposureColor(shownLine.exp) }} aria-hidden />
              {shownLine.title}
              {" · "}
              {(() => { const pl = papers[shown.paper]; const href = doiHref(pl?.doi); return href ? <a href={href} target="_blank" rel="noreferrer" className="text-blue-700 underline">{pl?.label}</a> : pl?.label ?? shown.paper; })()}
              {papers[shown.paper]?.journal ? <span className="font-normal text-muted-foreground">, {papers[shown.paper]?.journal}</span> : null}
            </p>
            {mode === "raw" ? (
              <p className="mt-1 text-xs">
                <strong>{fmt(shown.y)}%</strong>
                {shown.num != null && shown.den != null ? <> ({fmtInt(shown.num)} of {fmtInt(shown.den)})</> : shown.den != null ? <> (N = {fmtInt(shown.den)})</> : null}
                {shown.lo != null && shown.hi != null ? <>, 95% CI {fmt(shown.lo)}–{fmt(shown.hi)} ({shown.ciSource === "wilson" ? "Wilson, from n/N" : "reported"})</> : null}
                {" at "}{fmt(shown.x)} months · group: {shown.group} · outcome: “{shown.outcome}” · {severityLabel(shownLine.sev)}
              </p>
            ) : (
              <p className="mt-1 text-xs">
                <strong>{shown.y > 0 ? "+" : ""}{fmt(shown.y)} percentage points</strong>
                {shown.lo != null && shown.hi != null ? <> (95% CI {fmt(shown.lo)} to {fmt(shown.hi)})</> : null}
                {" at "}{fmt(shown.x)} months · {sourceLabel(shown.src)}
                {shown.ep != null && shown.cp != null ? <> · exposed {fmt(shown.ep)}% (n = {fmtInt(shown.ne)}) vs comparison {fmt(shown.cp)}% (n = {fmtInt(shown.nc)})</> : shown.ne != null ? <> · n = {fmtInt(shown.ne)} vs {fmtInt(shown.nc)}</> : null}
                {" · outcome: “"}{shown.outcome}{"” · "}{shownLine.detail}
              </p>
            )}
            {selected?.key === shown.key && <div className="mt-2"><EvidenceQuotes ids={shown.rowIds} /></div>}
          </div>
        )}
      </div>

      {lines.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold">Legend: {lines.length} line{lines.length === 1 ? "" : "s"} (click one to highlight it)</p>
          <ul className="max-h-72 space-y-1 overflow-y-auto pr-1 text-xs">
            {lines.map((l) => (
              <li key={l.id}>
                <button type="button" onClick={() => setFocus(focus === l.id ? null : l.id)} aria-pressed={focus === l.id}
                        className={`flex w-full items-start gap-2 rounded px-1 py-0.5 text-left hover:bg-muted/50 ${focus === l.id ? "bg-muted" : ""}`}>
                  <svg width={30} height={14} className="mt-0.5 shrink-0" aria-hidden>
                    <line x1={1} x2={29} y1={7} y2={7} stroke={exposureColor(l.exp)} strokeWidth={2} strokeDasharray={l.dashed ? "4 3" : undefined} />
                    <Marker shape={l.shape} x={15} y={7} r={4.5} color={exposureColor(l.exp)} hollow={l.dashed} />
                  </svg>
                  <span>
                    <strong>{l.title}</strong>
                    {" "}<span className="text-muted-foreground">({exposureLabel(l.exp)}{l.dashed ? ", comparison group" : ""}; {l.n ? `n up to ${fmtInt(l.n)}` : "n not given"}; {l.papers.map((p) => papers[p]?.label ?? p).join(", ")})</span>
                    {l.detail && <span className="block text-muted-foreground">{l.detail}</span>}
                    <span className="block text-muted-foreground">Definition: {l.definition}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
