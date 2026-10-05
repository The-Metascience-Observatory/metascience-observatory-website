"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { fmt } from "../utils";
import type { DoseResponseData } from "./load";
import type { AePoint, CurveFit, Link, Weighting } from "./stats";
import { EffectSummary, fitEffect, summarizeEffects, trialDoseRange } from "./summarize";
import { SUPPLEMENT_SURVEY } from "./supplement-survey";

/** Self-contained "dose-response by side effect" section. Remove it by
 *  deleting this folder and its one mount line in ResultsClientWrapper.tsx
 *  (plus the loadDoseResponse call in page.tsx).
 *
 *  Driven by the table filters at the top of the page: only arms whose paper
 *  passes the filters are summarized and fitted, and the curves are refitted
 *  in the browser whenever the filters (or the toggles) change.
 *
 *  Not driven by the table filters above: the fits are computed once on the
 *  server from every eligible arm. */

type XMode = "dose" | "serum";

const pct = (p: number) => `${(100 * p).toFixed(p < 0.1 ? 1 : 0)}%`;
const pFmt = (p: number) => (p < 0.001 ? "<0.001" : p.toFixed(3));
// SVG coordinates are rounded so server and client render identical strings —
// Math.log10 can differ in the last bit between the two and trip hydration.
const r2 = (v: number) => Math.round(v * 100) / 100;

// ---------------------------------------------------------------- panel ---

const PW = 340;
const PH = 230;
const PM = { top: 12, right: 12, bottom: 38, left: 44 };

const X_AXES: Record<XMode, { lo: number; hi: number; log: boolean; ticks: number[]; label: string }> = {
  dose: { lo: 40, hi: 400, log: true, ticks: [50, 100, 200, 300], label: "Elemental lithium (mg/day, log scale)" },
  serum: { lo: 0.3, hi: 1.2, log: false, ticks: [0.4, 0.6, 0.8, 1.0, 1.2], label: "Achieved serum lithium (mmol/L)" },
};

function niceCeil(v: number): number {
  for (const s of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1]) if (v <= s) return s;
  return 1;
}

function Panel({ e, mode, fit }: { e: EffectSummary; mode: XMode; fit: CurveFit }) {
  const ax = X_AXES[mode];
  const xOf = (p: AePoint) => (mode === "dose" ? p.doseMg : p.serum);
  const pts = e.lithium.filter((p) => xOf(p) != null);

  const t = (v: number) => (ax.log ? Math.log10(v) : v);
  const sx = (v: number) =>
    r2(PM.left + ((t(v) - t(ax.lo)) / (t(ax.hi) - t(ax.lo))) * (PW - PM.left - PM.right));
  const yMax = niceCeil(
    Math.max(0.1, ...pts.map((p) => p.events / p.n), e.placebo ? e.placebo[2] : 0) * 1.1,
  );
  const sy = (v: number) => r2(PH - PM.bottom - (Math.min(v, yMax) / yMax) * (PH - PM.top - PM.bottom));
  const yTicks = [0, yMax / 2, yMax];
  const maxN = Math.max(...pts.map((p) => p.n), 1);
  const r = (n: number) => r2(2.5 + 5.5 * Math.sqrt(n / maxN));
  const clipId = `clip-${e.key}-${mode}`;

  const band = fit.band ?? [];
  const bandPath =
    band.length > 1
      ? `M${band.map((b) => `${sx(b.x)},${sy(b.hi)}`).join("L")}` +
        `L${[...band].reverse().map((b) => `${sx(b.x)},${sy(b.lo)}`).join("L")}Z`
      : "";
  const linePath = band.length > 1 ? `M${band.map((b) => `${sx(b.x)},${sy(b.p)}`).join("L")}` : "";

  return (
    <div className="rounded-lg border border-foreground-strong/85 bg-white p-3">
      <h3 className={`text-sm font-semibold ${e.isControl ? "text-foreground/60" : "text-foreground"}`}>
        {e.label}
      </h3>
      <p className="mb-1 text-[11px] leading-snug text-foreground/55">
        {fit.gated
          ? fit.failed
            ? `No curve: the model did not converge (${fit.arms} arms, ${fit.papers} papers).`
            : `No curve: ${fit.arms} arm${fit.arms === 1 ? "" : "s"} from ${fit.papers} paper${fit.papers === 1 ? "" : "s"} (need ≥5 arms, ≥4 papers).`
          : `${fit.arms} arms, ${fit.papers} papers · across-study trend p = ${pFmt(fit.p1!)}`}
      </p>
      <svg width={PW} height={PH} viewBox={`0 0 ${PW} ${PH}`} className="max-w-full h-auto">
        <defs>
          <clipPath id={clipId}>
            <rect x={PM.left} y={PM.top} width={PW - PM.left - PM.right} height={PH - PM.top - PM.bottom} />
          </clipPath>
        </defs>
        {/* placebo base rate: pooled across placebo arms, Wilson 95% CI */}
        {e.placebo && (
          <g>
            <rect x={PM.left} width={PW - PM.left - PM.right}
                  y={sy(e.placebo[2])} height={Math.max(1, sy(e.placebo[1]) - sy(e.placebo[2]))}
                  className="fill-stone-400/20" />
            <line x1={PM.left} x2={PW - PM.right} y1={sy(e.placebo[0])} y2={sy(e.placebo[0])}
                  stroke="currentColor" className="text-stone-500" strokeDasharray="4 3" />
          </g>
        )}
        <line x1={PM.left} x2={PM.left} y1={PM.top} y2={PH - PM.bottom}
              stroke="currentColor" className="text-foreground-strong" />
        <line x1={PM.left} x2={PW - PM.right} y1={PH - PM.bottom} y2={PH - PM.bottom}
              stroke="currentColor" className="text-foreground-strong" />
        {ax.ticks.map((v) => (
          <g key={v}>
            <line x1={sx(v)} x2={sx(v)} y1={PH - PM.bottom} y2={PH - PM.bottom + 4}
                  stroke="currentColor" className="text-foreground/40" />
            <text x={sx(v)} y={PH - PM.bottom + 15} textAnchor="middle" fontSize={11}
                  className="fill-current text-foreground">{v}</text>
          </g>
        ))}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PM.left - 4} x2={PM.left} y1={sy(v)} y2={sy(v)}
                  stroke="currentColor" className="text-foreground/40" />
            <text x={PM.left - 7} y={sy(v) + 3} textAnchor="end" fontSize={11}
                  className="fill-current text-foreground">{Math.round(v * 100)}%</text>
          </g>
        ))}
        <text x={(PM.left + PW - PM.right) / 2} y={PH - 6} textAnchor="middle" fontSize={11}
              className="fill-current text-foreground/70">{ax.label}</text>

        <g clipPath={`url(#${clipId})`}>
          {bandPath && <path d={bandPath} className="fill-blue-500/15" />}
          {linePath && <path d={linePath} fill="none" stroke="currentColor" strokeWidth={2} className="text-blue-700" />}
          {pts.map((p, i) => (
            <circle key={i} cx={sx(xOf(p)!)} cy={sy(p.events / p.n)} r={r(p.n)}
                    className="fill-blue-500/50 stroke-blue-600/70" strokeWidth={1}>
              <title>
                {`${p.label || p.doi}\n${p.events}/${p.n} (${pct(p.events / p.n)}) · ${
                  mode === "dose" ? `${fmt(p.doseMg)} mg/day` : `${fmt(p.serum)} mmol/L`}`}
              </title>
            </circle>
          ))}
        </g>
      </svg>
    </div>
  );
}

// ------------------------------------------------------- context strip ---

/** Where the doses sit on one log axis: background tap-water intake, the
 *  over-the-counter supplement range, and the clinical arms plotted below. */
function DoseContext({ data, doseRange }: { data: DoseResponseData; doseRange: [number, number] | null }) {
  const W = 720;
  const L = 190;
  const R = 20;
  const lo = -4;
  const hi = 3;
  const sx = (mg: number) => r2(L + ((Math.log10(mg) - lo) / (hi - lo)) * (W - L - R));
  const rows: { label: string; refNum?: number; sub: string; a: number; b: number; mid?: number; cls: string }[] = [];
  if (data.water) {
    rows.push({
      label: "US tap water (2 L/day)",
      sub: `${data.water.counties.toLocaleString()} counties, 5th–95th pct`,
      a: data.water.p5, b: data.water.p95, mid: data.water.p50, cls: "fill-teal-500/60",
    });
  }
  rows.push({
    label: "OTC supplement survey",
    refNum: 1,
    sub: `N=${SUPPLEMENT_SURVEY.n}, label doses 5–20 mg`,
    a: SUPPLEMENT_SURVEY.doseLoMg, b: SUPPLEMENT_SURVEY.doseHiMg, mid: 10, cls: "fill-amber-500/60",
  });
  if (doseRange) {
    rows.push({
      label: "Clinical trial arms below",
      sub: `${fmt(doseRange[0])}–${fmt(doseRange[1])} mg/day`,
      a: doseRange[0], b: doseRange[1], cls: "fill-blue-500/60",
    });
  }
  const H = 52 + rows.length * 30;
  const ticks = [-4, -3, -2, -1, 0, 1, 2, 3];
  return (
    <div className="mb-4 rounded-lg border border-foreground-strong/85 bg-white p-3">
      <h3 className="mb-1 text-sm font-semibold text-foreground">Where the doses sit</h3>
      {/* On a phone the strip scrolls inside its card rather than shrinking
          its labels to an unreadable size. */}
      <div className="overflow-x-auto">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="min-w-[560px] max-w-full h-auto">
        {ticks.map((k) => (
          <g key={k}>
            <line x1={sx(10 ** k)} x2={sx(10 ** k)} y1={6} y2={H - 40}
                  stroke="currentColor" className="text-foreground/10" />
            <text x={sx(10 ** k)} y={H - 26} textAnchor="middle" fontSize={11}
                  className="fill-current text-foreground">
              {k < 0 ? (10 ** k).toFixed(-k) : String(10 ** k)}
            </text>
          </g>
        ))}
        {rows.map((row, i) => {
          const y = 14 + i * 30;
          return (
            <g key={row.label}>
              <text x={0} y={y + 4} fontSize={12} fontWeight={600} className="fill-current text-foreground">
                {row.label}
                {row.refNum != null && (
                  <a href={`#dose-response-ref-${row.refNum}`}>
                    <tspan dx={1} dy={-5} fontSize={9} className="fill-blue-600">{row.refNum}</tspan>
                  </a>
                )}
              </text>
              <text x={0} y={y + 17} fontSize={10} className="fill-current text-foreground/55">{row.sub}</text>
              <rect x={sx(row.a)} y={y - 3} width={Math.max(3, sx(row.b) - sx(row.a))} height={12} rx={3}
                    className={row.cls} />
              {row.mid != null && (
                <line x1={sx(row.mid)} x2={sx(row.mid)} y1={y - 6} y2={y + 12}
                      stroke="currentColor" strokeWidth={2} className="text-foreground/70" />
              )}
            </g>
          );
        })}
        <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize={12} fontWeight={700}
              className="fill-current text-foreground">
          Elemental lithium, mg/day, log scale
        </text>
      </svg>
      </div>
      <ol className="mt-1 text-[11px] leading-relaxed text-foreground">
        <li id="dose-response-ref-1">
          <sup>1</sup> {SUPPLEMENT_SURVEY.firstAuthor} et al.{" "}
          <a
            href={`https://doi.org/${SUPPLEMENT_SURVEY.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-700"
          >
            {SUPPLEMENT_SURVEY.title}
          </a>
          . <em>{SUPPLEMENT_SURVEY.journal}</em> <strong>{SUPPLEMENT_SURVEY.volume}</strong>(
          {SUPPLEMENT_SURVEY.issue}): {SUPPLEMENT_SURVEY.pages}, {SUPPLEMENT_SURVEY.year}.
        </li>
      </ol>
    </div>
  );
}

// ---------------------------------------------------- conversion scale ---

/** Elemental fraction by mass (PubChem): carbonate Li₂CO₃, anhydrous orotate. */
const CARBONATE_FRAC = 0.1879;
const OROTATE_FRAC = 0.0428;

/** Parallel log axes that line up equivalent amounts: elemental lithium,
 *  lithium carbonate, lithium orotate, and the steady-state serum level the
 *  empirical dose-to-serum ratio predicts. */
function ConversionScale({ data }: { data: DoseResponseData }) {
  const ratio = data.doseSerum;
  const W = 720;
  const L = 190;
  const R = 24;
  const lo = 0.5; // elemental mg/day
  const hi = 500;
  const sx = (mg: number) => r2(L + ((Math.log10(mg) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * (W - L - R));
  const rows: { label: string; sub: string; toMg: (v: number) => number }[] = [
    { label: "Elemental lithium", sub: "mg/day", toMg: (v) => v },
    { label: "Lithium carbonate", sub: "mg/day (18.8% lithium)", toMg: (v) => v * CARBONATE_FRAC },
    { label: "Lithium orotate", sub: "mg/day (4.3% lithium)", toMg: (v) => v * OROTATE_FRAC },
  ];
  if (ratio) {
    rows.push({ label: "Expected serum level", sub: "mmol/L at steady state", toMg: (v) => v * ratio.mgPerMmol });
  }
  // 1-2-5 ticks in each row's own unit, kept where they land inside the axis.
  const ticksFor = (toMg: (v: number) => number) => {
    const out: number[] = [];
    for (let k = -5; k <= 5; k++) {
      for (const m of [1, 2, 5]) {
        const v = m * 10 ** k;
        const mg = toMg(v);
        if (mg >= lo * 0.999 && mg <= hi * 1.001) out.push(v);
      }
    }
    return out;
  };
  const label = (v: number) => (v >= 1 ? v.toLocaleString() : String(Number(v.toPrecision(1))));
  const ROW = 40;
  const H = 12 + rows.length * ROW;
  return (
    <div className="mb-4 rounded-lg border border-foreground-strong/85 bg-white p-3">
      <h3 className="mb-1 text-sm font-semibold text-foreground">Converting between doses and serum level</h3>
      <div className="overflow-x-auto">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="min-w-[560px] max-w-full h-auto">
          {rows.map((row, i) => {
            const y = 18 + i * ROW;
            return (
              <g key={row.label}>
                <text x={0} y={y + 2} fontSize={12} fontWeight={600} className="fill-current text-foreground">
                  {row.label}
                </text>
                <text x={0} y={y + 15} fontSize={10} className="fill-current text-foreground/55">{row.sub}</text>
                <line x1={L} x2={W - R} y1={y} y2={y} stroke="currentColor" className="text-foreground-strong" />
                {ticksFor(row.toMg).map((v) => (
                  <g key={v}>
                    <line x1={sx(row.toMg(v))} x2={sx(row.toMg(v))} y1={y - 4} y2={y + 4}
                          stroke="currentColor" className="text-foreground-strong" />
                    <text x={sx(row.toMg(v))} y={y + 16} textAnchor="middle" fontSize={10}
                          className="fill-current text-foreground">{label(v)}</text>
                  </g>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      {ratio && (
        <p className="mt-1 text-[11px] leading-relaxed text-foreground">
          Serum level assumes about {Math.round(ratio.mgPerMmol)} mg elemental lithium per day for each
          1 mmol/L, the median across {ratio.arms} trial arms that report both a dose and a serum level
          (middle half {Math.round(ratio.q1)}–{Math.round(ratio.q3)}). Individuals vary 2–3× with kidney
          function, age and salt intake.
        </p>
      )}
    </div>
  );
}

// -------------------------------------------------------------- toggle ---

function Toggle<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-md px-3 py-1 ${value === v ? "bg-blue-600 text-white" : "text-foreground/70 hover:bg-muted"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// -------------------------------------------------------------- section ---

export function DoseResponseSection({ data, filteredDois }: {
  data: DoseResponseData;
  /** Base DOIs passing the page's table filters; undefined = no filtering. */
  filteredDois?: Set<string>;
}) {
  const [mode, setMode] = useState<XMode>("serum");
  const [link, setLink] = useState<Link>("logit");
  const [weighting, setWeighting] = useState<Weighting>("random");
  // Refitting takes a few hundred ms; deferring keeps filter clicks snappy
  // while the panels catch up.
  const deferredDois = useDeferredValue(filteredDois);
  const doiKey = deferredDois ? [...deferredDois].sort().join("|") : "";
  const effects = useMemo(() => {
    const pts = deferredDois
      ? data.points.filter((p) => deferredDois.has(p.doi.split("#")[0]))
      : data.points;
    return summarizeEffects(pts);
    // doiKey captures the set's contents; the Set itself is rebuilt each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.points, doiKey]);
  const fits = useMemo(
    () => effects.map((e) => fitEffect(e, weighting, link, mode)),
    [effects, weighting, link, mode],
  );
  const doseRange = useMemo(() => trialDoseRange(effects), [effects]);
  const stale = deferredDois !== filteredDois;
  const shown = effects.reduce((s, e) => s + e.lithium.length, 0);


  return (
    <section className="mx-auto mt-12 max-w-[1528px] border-t border-border pt-8">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="font-clarendon text-2xl font-bold">Dose-response by side effect</h2>
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
          Experimental
        </span>
      </div>
      <p className="mb-4 max-w-3xl text-sm text-foreground">
        Slime Mold Time Mold{" "}
        <a
          href="https://slimemoldtimemold.com/2022/10/21/study-subclinical-doses-of-lithium-have-plenty-of-effects/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline hover:text-blue-700"
        >
          argue
        </a>{" "} that each of lithium&apos;s effects has its own S-shaped dose-response curve, a very reasonable assumption. The graphs below show what the data in this review&apos;s trials can say about that. Each panel shows the share of patients in each lithium arm who reported a side effect, plotted against the arm&apos;s achieved serum lithium level (or, via the toggle, its daily dose). The grey band is the placebo rate 95% confidence interval pooled from the studies. The blue line is a logistic curve fitted across studies, fit to the doses from the relevant arms. By default it is a
        random-effects fit, where each study keeps its own baseline rate, so one study with a very large number of patients can&apos;t pull the curve to its own level. There is a toggle for weighting the studies by the number of patient. There is also a toggle to fitting a probit curve, which is very similar to a logistic curve. A probit curve is very similar to a logistic curve but becomes slightly different in the tails. 
      </p>

      <DoseContext data={data} doseRange={doseRange} />
      <ConversionScale data={data} />

      <div className="mb-3 flex flex-wrap gap-2">
        <Toggle
          value={mode}
          onChange={setMode}
          options={[["serum", "x = serum level"], ["dose", "x = daily dose"]]}
        />
        <Toggle
          value={link}
          onChange={setLink}
          options={[["logit", "Logistic curve"], ["probit", "Probit curve"]]}
        />
        <Toggle
          value={weighting}
          onChange={setWeighting}
          options={[["random", "Random effects (recommended)"], ["pooled", "Patient-weighted"]]}
        />
      </div>

      <p className="mb-2 text-xs text-foreground">
        The filters at the top of the page apply here too.
      </p>
      {shown === 0 ? (
        <p className="mb-2 rounded-lg border border-border px-4 py-6 text-center text-sm text-foreground">
          No lithium arms with side-effect counts pass the current filters.
        </p>
      ) : (
        <div className={`mb-2 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 transition-opacity ${stale ? "opacity-60" : ""}`}>
          {effects.map((e, i) => <Panel key={e.key} e={e} mode={mode} fit={fits[i]} />)}
        </div>
      )}

    </section>
  );
}
