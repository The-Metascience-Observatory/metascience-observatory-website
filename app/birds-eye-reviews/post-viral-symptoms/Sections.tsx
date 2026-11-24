/** Server-rendered sections of the post-viral symptoms page: headline cards,
 *  "why estimates disagree", the sensitivity table. Everything is read from
 *  page.json; nothing here is typed in by hand. */
import type { PageData, PaperLite, Pool, PoolStudy, SensitivityAnalysis, TimeBin } from "./types";
import type { RawVsExcess, SensitivityRow, Spread } from "./derive";
import {
  comparatorClassLabel, comparatorKindLabel, estimandShort, exposureLabel, familyLabel, fmt, fmtCI,
  fmtInt, fmtValue, measureLabel, severityLabel,
} from "./labels";
import { QuoteToggle } from "./EvidenceQuotes";

const SEV_ORDER = ["non_hospitalised", "hospitalised", "all_severities", "asymptomatic"];

function binSorter(bins: TimeBin[]) {
  const order = new Map(bins.map((b, i) => [b.id, i]));
  return (a: Pool, b: Pool) => (order.get(a.bin) ?? 0) - (order.get(b.bin) ?? 0) || SEV_ORDER.indexOf(a.sev) - SEV_ORDER.indexOf(b.sev);
}

/** A one-line caveat derived from the pool itself. */
function caveat(p: Pool, papers: Record<string, PaperLite>): string {
  if (p.k === 1) {
    const s = p.studies?.[0];
    return `Single study (${s ? papers[s.p]?.label ?? s.p : "?"}); not pooled.`;
  }
  const v = p.pooled;
  if (!v) return p.note ?? "Not pooled.";
  const parts: string[] = [];
  if (v.lo <= (p.unit === "ratio" ? 1 : 0) && v.hi >= (p.unit === "ratio" ? 1 : 0)) parts.push("CI includes no difference");
  if ((v.i2 ?? 0) >= 75) parts.push(`studies disagree strongly (I² ${fmt(v.i2)}%)`);
  if (v.pil != null) parts.push(`a new cohort could plausibly show ${fmtCI(v.pil, v.pih, p.unit)}${p.unit === "percentage_points" ? " pp" : ""}`);
  else if (p.k === 2) parts.push("two cohorts only: the Knapp–Hartung interval is wide by design");
  const rec = (p.studies ?? []).filter((s) => s.rec).length;
  if (rec > 0) parts.push(`${rec} of ${p.k} from health-record codes`);
  return parts.length ? `${parts.join("; ")}.` : `I² ${fmt(v.i2)}%.`;
}

function PoolValue({ p }: { p: Pool }) {
  const one: PoolStudy | undefined = p.k === 1 ? p.studies?.[0] : undefined;
  const v = p.pooled?.v ?? one?.v;
  const lo = p.pooled?.lo ?? one?.lo;
  const hi = p.pooled?.hi ?? one?.hi;
  return (
    <span className="tabular-nums">
      <strong className="text-base">{fmtValue(v, p.unit)}</strong>{" "}
      <span className="text-muted-foreground">(95% CI {fmtCI(lo, hi, p.unit)})</span>
    </span>
  );
}

function PoolRows({ pools, papers, bins, showMeasure = false }: { pools: Pool[]; papers: Record<string, PaperLite>; bins: TimeBin[]; showMeasure?: boolean }) {
  const label = new Map(bins.map((b) => [b.id, b.label]));
  return (
    <ul className="mt-2 divide-y divide-border">
      {pools.map((p) => {
        const quoteIds = p.k === 1 && p.studies?.[0] ? (p.studies[0].er && p.studies[0].cr ? [p.studies[0].er, p.studies[0].cr] : [p.studies[0].r]) : null;
        return (
          <li key={p.id} className="py-2 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-medium">
                {label.get(p.bin) ?? p.bin}
                <span className="font-normal text-muted-foreground"> · {severityLabel(p.sev)}{showMeasure ? ` · ${measureLabel(p.meas).replace(" (percentage points)", "")} · ${estimandShort(p.est)}` : ""}</span>
              </span>
              <span className={`rounded px-1.5 py-0.5 text-xs ${p.k >= 2 ? "bg-blue-100 text-blue-900" : "bg-amber-100 text-amber-900"}`}>
                {p.k >= 2 ? `pooled · k = ${p.k}` : "single study · k = 1"}
              </span>
            </div>
            <PoolValue p={p} />
            {p.nt ? <span className="text-xs text-muted-foreground"> · n = {fmtInt(p.nt)}</span> : null}
            <p className="text-xs text-muted-foreground">{caveat(p, papers)}</p>
            {quoteIds && <QuoteToggle ids={quoteIds} />}
          </li>
        );
      })}
    </ul>
  );
}

export function HeadlineCards({ data, papers }: { data: PageData; papers: Record<string, PaperLite> }) {
  const bins = data.meta.time_bins;
  const sorter = binSorter(bins);
  const excessFor = (fam: string) => data.pools.excess
    .filter((p) => p.exp === "covid" && p.comp === "uninfected" && p.meas === "risk_difference" && p.est === "prevalence" && p.fam === fam && p.k >= 1)
    .sort(sorter);
  const h2h = data.pools.head_to_head
    .filter((p) => p.exp === "covid" && p.comp === "influenza" && (p.fam === "fatigue" || p.fam === "any_symptom") && p.k >= 1)
    .sort((a, b) => a.fam.localeCompare(b.fam) || (a.meas === "risk_difference" ? -1 : 0) - (b.meas === "risk_difference" ? -1 : 0) || sorter(a, b));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {(["fatigue", "any_symptom"] as const).map((fam) => {
        const pools = excessFor(fam);
        return (
          <article key={fam} className="rounded-lg border border-border bg-muted/30 p-4">
            <h3 className="font-semibold">Excess {fam === "fatigue" ? "fatigue" : "persistent symptoms (any)"} after COVID-19</h3>
            <p className="text-xs text-muted-foreground">
              Percentage points above comparable uninfected or test-negative people, point prevalence, by time since infection.
            </p>
            {pools.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No estimate in this release.</p> : <PoolRows pools={pools} papers={papers} bins={bins} />}
          </article>
        );
      })}
      <article className="rounded-lg border border-border bg-muted/30 p-4">
        <h3 className="font-semibold">COVID-19 vs influenza, head to head</h3>
        <p className="text-xs text-muted-foreground">
          Within-study contrasts: COVID-19 minus influenza (percentage points), or a ratio (1 = same). Each row names its measure; rows are never combined across measures.
        </p>
        {h2h.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No head-to-head estimate in this release.</p> : (
          (["fatigue", "any_symptom"] as const).map((fam) => {
            const rows = h2h.filter((p) => p.fam === fam);
            return rows.length ? (
              <div key={fam} className="mt-2">
                <h4 className="text-sm font-semibold">{familyLabel(fam)}</h4>
                <PoolRows pools={rows} papers={papers} bins={bins} showMeasure />
              </div>
            ) : null;
          })
        )}
      </article>
    </div>
  );
}

// ---------------------------------------------------------------- why estimates disagree

export function SpreadChart({ title, spreads, note, max = 100 }: { title: string; spreads: Spread[]; note?: string; max?: number }) {
  if (spreads.length === 0) return null;
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  return (
    <figure className="rounded-lg border border-border p-3">
      <figcaption className="text-sm font-semibold">{title}</figcaption>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      <ul className="mt-2 space-y-2">
        {spreads.map((s) => (
          <li key={s.code} className="grid gap-1 sm:grid-cols-[11rem_minmax(0,1fr)_7rem] sm:items-center sm:gap-2">
            <span className="text-xs">{s.label} <span className="text-muted-foreground">({s.values.length} line{s.values.length === 1 ? "" : "s"}, {s.cohorts} cohort{s.cohorts === 1 ? "" : "s"})</span></span>
            <div className="relative h-5 rounded bg-muted/50" aria-hidden>
              {s.values.length >= 3 && <div className="absolute top-1 h-3 rounded bg-blue-200" style={{ left: pct(s.q1), width: `calc(${pct(s.q3)} - ${pct(s.q1)})` }} />}
              {s.values.map((v, i) => <div key={i} className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-700/70 ring-1 ring-card" style={{ left: pct(v) }} />)}
              <div className="absolute inset-y-0 w-[2px] bg-foreground" style={{ left: pct(s.median) }} />
            </div>
            <span className="text-xs tabular-nums">median {fmt(s.median)}%</span>
          </li>
        ))}
      </ul>
      <div className="mt-1 hidden justify-between text-[10px] text-muted-foreground sm:ml-[11.5rem] sm:mr-[7.5rem] sm:flex" aria-hidden>
        <span>0%</span><span>{max / 2}%</span><span>{max}%</span>
      </div>
    </figure>
  );
}

export function RawVsExcessChart({ pairs, papers, bins }: { pairs: RawVsExcess[]; papers: Record<string, PaperLite>; bins: TimeBin[] }) {
  if (pairs.length === 0) return null;
  const label = new Map(bins.map((b) => [b.id, b.label]));
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = (s.length - 1) / 2;
    return (s[Math.floor(m)] + s[Math.ceil(m)]) / 2;
  };
  const shares = pairs.filter((p) => p.ep > 0).map((p) => (100 * p.rd) / p.ep);
  const max = Math.max(50, ...pairs.map((p) => Math.max(p.ep, p.cp)));
  const pos = (v: number) => `${(Math.max(0, v) / max) * 100}%`;
  return (
    <figure className="rounded-lg border border-border p-3">
      <figcaption className="text-sm font-semibold">Raw prevalence vs excess, same study, same outcome, same time</figcaption>
      <p className="text-xs text-muted-foreground">
        {pairs.length} COVID-19 pairs where both the infected group&apos;s and the uninfected comparison group&apos;s percentages are known (the differences used in the excess pools).
        Median raw prevalence {fmt(median(pairs.map((p) => p.ep)))}%, median in the comparison group {fmt(median(pairs.map((p) => p.cp)))}%,
        median excess {fmt(median(pairs.map((p) => p.rd)))} percentage points; median share of the raw figure that is excess: {fmt(median(shares))}%.
      </p>
      <ul className="mt-2 max-h-96 space-y-1 overflow-y-auto pr-1">
        {pairs.map((p) => {
          const lo = Math.min(p.ep, p.cp);
          const hi = Math.max(p.ep, p.cp);
          return (
            <li key={p.r} className="grid gap-1 text-xs sm:grid-cols-[14rem_minmax(0,1fr)_9rem] sm:items-center sm:gap-2">
              <span className="truncate" title={p.o}>{papers[p.p]?.label ?? p.p} · {familyLabel(p.fam)} · {label.get(p.bin)}</span>
              <div className="relative h-4 rounded bg-muted/40" aria-hidden>
                <div className="absolute top-1/2 h-[2px] -translate-y-1/2 bg-foreground/40" style={{ left: pos(lo), width: `calc(${pos(hi)} - ${pos(lo)})` }} />
                <div className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-stone-500 bg-card" style={{ left: pos(p.cp) }} />
                <div className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2a78d6]" style={{ left: pos(p.ep) }} />
              </div>
              <span className="tabular-nums">{fmt(p.ep)}% vs {fmt(p.cp)}% → <strong>{p.rd > 0 ? "+" : ""}{fmt(p.rd)} pp</strong></span>
            </li>
          );
        })}
      </ul>
      <p className="mt-1 text-[11px] text-muted-foreground">
        <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#2a78d6] align-middle" aria-hidden />COVID-19 group
        <span className="ml-3 mr-1 inline-block h-2.5 w-2.5 rounded-full border-2 border-stone-500 align-middle" aria-hidden />uninfected comparison group · axis 0 to {fmt(max)}%. Hover a row label for the outcome wording.
      </p>
    </figure>
  );
}

// ---------------------------------------------------------------- sensitivity

const SENS_COLS: { key: "exclude_high_risk_of_bias" | "new_onset_or_worsened_only" | "laboratory_confirmed_only" | "exclude_records_based_outcomes"; label: string }[] = [
  { key: "exclude_high_risk_of_bias", label: "Without high risk of bias" },
  { key: "new_onset_or_worsened_only", label: "New-onset / worsened only" },
  { key: "laboratory_confirmed_only", label: "Lab-confirmed infection only" },
  { key: "exclude_records_based_outcomes", label: "Without health-record outcomes" },
];

function SensCell({ a, unit }: { a?: SensitivityAnalysis; unit: string }) {
  if (!a || a.k === 0) return <span className="text-muted-foreground">k = 0</span>;
  if (a.v == null) return <span>{a.single != null ? fmtValue(a.single, unit) : "—"} <span className="text-muted-foreground">single study</span></span>;
  return <span>{fmtValue(a.v, unit)} <span className="text-muted-foreground">({fmtCI(a.lo, a.hi, unit)}) k = {a.k}</span></span>;
}

export function SensitivityTable({ rows, bins }: { rows: SensitivityRow[]; bins: TimeBin[] }) {
  const label = new Map(bins.map((b) => [b.id, b.label]));
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No pooled result has k ≥ 2, so there is nothing to re-analyse.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-xs">
        <thead className="border-b border-foreground/40">
          <tr className="align-bottom">
            <th scope="col" className="py-1 pr-2">Result</th>
            <th scope="col" className="py-1 pr-2">Main analysis</th>
            {SENS_COLS.map((c) => <th key={c.key} scope="col" className="py-1 pr-2">{c.label}</th>)}
            <th scope="col" className="py-1 pr-2">Leave one out (range)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ pool: p, kind, sens }) => {
            const loo = (sens.leave_one_out ?? []).filter((x) => x.v != null);
            return (
              <tr key={p.id} className="border-b border-border align-top">
                <td className="py-1.5 pr-2">
                  <strong>{kind === "trajectory" ? "Raw prevalence" : kind === "excess" ? "Excess" : "Head to head"}</strong>: {familyLabel(p.fam)}, {exposureLabel(p.exp)}
                  {p.comp ? ` ${kind === "excess" ? comparatorClassLabel(p.comp) : comparatorKindLabel(p.comp)}` : ""}
                  <span className="block text-muted-foreground">{label.get(p.bin)} · {severityLabel(p.sev)} · {estimandShort(p.est)}{kind !== "trajectory" ? ` · ${measureLabel(p.meas)}` : ""}</span>
                </td>
                <td className="py-1.5 pr-2 tabular-nums">
                  {p.pooled ? <><strong>{fmtValue(p.pooled.v, p.unit)}</strong> <span className="text-muted-foreground">({fmtCI(p.pooled.lo, p.pooled.hi, p.unit)}) k = {p.k}, I² {fmt(p.pooled.i2)}%</span></> : "—"}
                </td>
                {SENS_COLS.map((c) => <td key={c.key} className="py-1.5 pr-2 tabular-nums"><SensCell a={sens[c.key]} unit={p.unit} /></td>)}
                <td className="py-1.5 pr-2 tabular-nums">
                  {loo.length ? `${fmtValue(Math.min(...loo.map((x) => x.v!)), p.unit)} to ${fmtValue(Math.max(...loo.map((x) => x.v!)), p.unit)}` : <span className="text-muted-foreground">needs k ≥ 3</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
