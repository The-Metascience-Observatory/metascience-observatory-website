"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { Download, RotateCcw } from "lucide-react";
import { completePairs, correlations, filterCounties } from "./stats";
import { numberValue, type County, type Exposure } from "./types";
import { useTexasComparison } from "./TexasComparison";

const COLORS = { county: "#087e8b", selected: "#d97706", axisLabel: "#000000" };
const control = "mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
const button = "inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
const number = (value: number, digits = 0) => value.toLocaleString("en-US", { maximumFractionDigits: digits });
const statistic = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(3)}`;
const concentration = (county: County, exposure: Exposure) => {
  const value = numberValue(county[exposure.raw]);
  return value === null ? "No data" : exposure.kind === "fraction" ? `${number(value * 100, 1)}%` : `${number(value, 3)} µg/L`;
};

interface Point { x: number; y: number; county: County }
interface PlotProps {
  title: string;
  counties: County[];
  exposure: Exposure;
  weighted: boolean;
  selected: string[];
  onSelect: (fips: string) => void;
  domains: { x: [number, number]; y: [number, number] };
}

function CountyTooltip({ active, payload, exposure }: { active?: boolean; payload?: { payload?: Point }[]; exposure: Exposure }) {
  const point = payload?.[0]?.payload;
  if (!active || !point?.county) return null;
  const row = point.county;
  return <div className="max-w-64 rounded-md border border-border bg-popover p-3 text-xs text-popover-foreground shadow-md">
    <p className="font-semibold">{row.countyname}, {row.state} · {row.fips}</p>
    <p className="mt-1">Lithium: {concentration(row, exposure)}</p>
    <p>Age-adjusted obesity: {number(point.y, 1)}%</p>
    <p>Coverage: {number(Number(row[exposure.count]), 1)} {exposure.countLabel}</p>
    <p className="mt-1 text-muted-foreground">Click to select this county.</p>
  </div>;
}

function CountyPlot({ title, counties, exposure, weighted, selected, onSelect, domains }: PlotProps) {
  const stats = useMemo(() => correlations(counties, exposure.column, "obesity_adjprev", weighted), [counties, exposure.column, weighted]);
  const points = useMemo(() => completePairs(counties, exposure.column, "obesity_adjprev").map(county => ({
    x: (county[exposure.column] as number) * (exposure.kind === "fraction" ? 100 : 1),
    y: county.obesity_adjprev as number,
    county,
  })).sort((a, b) => Number(selected.includes(a.county.fips)) - Number(selected.includes(b.county.fips))), [counties, exposure, selected]);
  const unavailable = !stats.n ? "No counties have both measurements for this selection." : stats.n < 3 ? "At least three complete county pairs are needed for a correlation." : stats.spearman === null ? "A correlation is undefined because one of the measures is constant." : null;

  return <section className="min-w-0 rounded-lg border border-foreground-strong/85 bg-card p-3 sm:p-5" aria-label={`${title} scatterplot`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-[1.3125rem] leading-snug font-medium text-foreground">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{number(stats.n)} complete pairs / {number(counties.length)} counties meeting coverage</p></div>
      <dl className="flex gap-4 text-sm tabular-nums"><div><dt className="text-xs text-muted-foreground">Spearman ρ</dt><dd className="mt-1 font-semibold">{statistic(stats.spearman)}</dd></div><div><dt className="text-xs text-muted-foreground">Pearson r</dt><dd className="mt-1 font-semibold">{statistic(stats.pearson)}</dd></div></dl>
    </div>
    {points.length ? <div className="mt-3 h-[340px] w-full sm:h-[380px]" role="img" aria-label={`${title}: ${number(stats.n)} counties, Spearman ${statistic(stats.spearman)}.`}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 15, bottom: 38, left: 5 }}>
          <CartesianGrid stroke="currentColor" className="text-border" strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" domain={domains.x} tickCount={5} tick={{ fontSize: 11, fill: "currentColor" }} stroke="currentColor" name="Lithium" label={{ value: exposure.kind === "fraction" ? "Samples with detected lithium (%)" : "Lithium concentration (log₁₀ µg/L)", position: "bottom", offset: 15, fontSize: 12, fill: COLORS.axisLabel }} />
          <YAxis type="number" dataKey="y" domain={domains.y} width={52} tick={{ fontSize: 11, fill: "currentColor" }} stroke="currentColor" name="Obesity" unit="%" label={{ value: "Age-adjusted obesity (%)", angle: -90, position: "insideLeft", fontSize: 12, fill: COLORS.axisLabel, offset: 0 }} />
          <ZAxis range={[16, 16]} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<CountyTooltip exposure={exposure} />} />
          <Scatter data={points} isAnimationActive={false} onClick={(entry: unknown) => {
            const point = entry as { county?: County; payload?: Point };
            const county = point.county ?? point.payload?.county;
            if (county) onSelect(county.fips);
          }}>
            {points.map(point => <Cell key={point.county.fips} fill={selected.includes(point.county.fips) ? COLORS.selected : COLORS.county} fillOpacity={selected.includes(point.county.fips) ? 1 : 0.5} stroke={selected.includes(point.county.fips) ? COLORS.selected : "none"} strokeWidth={3} cursor="pointer" />)}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div> : <div className="mt-3 flex h-[340px] items-center justify-center rounded-md bg-muted/30 p-6 text-center text-sm text-muted-foreground sm:h-[380px]">No complete pairs to plot. Try another state or a lower coverage minimum.</div>}
    {unavailable && <p role="status" className="mt-2 text-sm text-muted-foreground">{unavailable}</p>}
    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">One point per county. {exposure.note} {exposure.kind === "log" && "The axis and Pearson correlation use log₁₀ concentration; hover values show µg/L."}</p>
  </section>;
}

export function CountyExplorer({ counties, exposures }: { counties: County[]; exposures: Exposure[] }) {
  const [state, setState] = useState("ALL");
  const [minimums, setMinimums] = useState({ samples: 0, sites: 0, wells: 0 });
  const [weighted, setWeighted] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const { request: texasRequest } = useTexasComparison();
  const explorerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!texasRequest) return;
    setState("TX");
    setMinimums({ samples: 0, sites: 0, wells: 0 });
    setSelected(["48215", "48029"]);
    explorerRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    explorerRef.current?.focus({ preventScroll: true });
  }, [texasRequest]);
  const states = useMemo(() => [...new Set(counties.map(county => county.state))].sort(), [counties]);
  const geographic = useMemo(() => state === "ALL" ? counties : counties.filter(county => county.state === state), [counties, state]);
  const panels = useMemo(() => exposures.map(exposure => ({
    exposure,
    counties: filterCounties(geographic, states, exposure.count, minimums[exposure.countLabel as keyof typeof minimums]),
  })), [exposures, geographic, states, minimums]);
  const profiles = selected.map(fips => geographic.find(county => county.fips === fips)).filter((county): county is County => county !== undefined);
  const yDomain = useMemo<[number, number]>(() => {
    const ys = geographic.map(row => numberValue(row.obesity_adjprev)).filter((value): value is number => value !== null);
    return ys.length ? [Math.floor(Math.min(...ys) / 5) * 5, Math.ceil(Math.max(...ys) / 5) * 5 + 1] : [10, 60];
  }, [geographic]);
  function meetsCoverage(row: County, exposure: Exposure) {
    const minimum = minimums[exposure.countLabel as keyof typeof minimums];
    return minimum <= 0 || (numberValue(row[exposure.count]) ?? -1) >= minimum;
  }
  function reset() { setState("ALL"); setMinimums({ samples: 0, sites: 0, wells: 0 }); setWeighted(false); setSelected([]); }
  const downloadHref = `/api/lithium-drinking-water/download?${new URLSearchParams({ state, samples: String(minimums.samples), sites: String(minimums.sites), wells: String(minimums.wells) })}`;

  return <section ref={explorerRef} tabIndex={-1} className="scroll-mt-24" aria-label="County correlation explorer">
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto]">
        <label className="text-xs font-medium">State<select className={control} value={state} onChange={event => { setState(event.target.value); setSelected([]); }}><option value="ALL">All states + DC</option>{states.map(item => <option key={item} value={item}>{item === "TX" ? "Texas (TX)" : item}</option>)}</select></label>
        <label className="text-xs font-medium">Correlation weighting<select className={control} value={weighted ? "population" : "county"} onChange={event => setWeighted(event.target.value === "population")}><option value="county">Equal county weights</option><option value="population">Population weights</option></select></label>
        <a href={downloadHref} download className={button}><Download size={15} aria-hidden="true" />download selected data</a>
        <button type="button" className={button} onClick={reset}><RotateCcw size={14} aria-hidden="true" />Reset</button>
      </div>
      <fieldset className="mt-4" aria-label="Minimum coverage per county">
        <div className="grid gap-4 sm:grid-cols-3">
          {([['samples', 'EPA UCMR5', 'Water sample results, including repeated samples from the same system. Applies to the four EPA charts.'], ['sites', 'Water Quality Portal', 'Distinct groundwater monitoring sites represented in the county summary. Applies to the WQP chart.'], ['wells', 'USGS domestic supply', 'Domestic-supply wells represented in the county summary. Applies to the USGS chart.']] as const).map(([unit, source, description]) => <div key={unit}>
            <label className="text-xs font-medium">Minimum {unit} per county<input type="number" min={0} step="any" className={control} value={minimums[unit]} onChange={event => { const value = Number(event.target.value); setMinimums(current => ({ ...current, [unit]: Number.isFinite(value) ? Math.max(0, value) : 0 })); }} /></label>
            <p className="mt-1 text-xs font-medium text-muted-foreground">{source}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
          </div>)}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Zero means no minimum. Each chart uses its own source count: the groundwater-fed chart counts groundwater-fed samples only. These filters affect plots and correlations. Downloads include all counties in the selected geography, with source counts and per-measure flags showing whether they meet the minimum. Connecticut counts can be fractional because they are estimated from a geographic crosswalk.</p>
      </fieldset>
    </div>
    {profiles.length > 0 && <aside className="my-5 rounded-lg border border-border bg-muted/20 p-4" aria-label="Selected county details" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{profiles.length > 1 ? "Hidalgo and Bexar comparison" : "Selected county"}</h3><button type="button" className={button} onClick={() => setSelected([])}>Clear selection</button></div>
      <div className={`mt-3 grid gap-4 ${profiles.length > 1 ? "lg:grid-cols-2" : ""}`}>
        {profiles.map(profile => <section key={profile.fips} aria-label={`${profile.countyname} county details`} className="min-w-0 rounded-md border border-border bg-background p-3">
          <h4 className="font-semibold">{profile.countyname}, {profile.state} <span className="text-xs font-normal text-muted-foreground">· FIPS {profile.fips}</span></h4>
          <p className="mt-2 text-sm"><strong>{numberValue(profile.obesity_adjprev) === null ? "No outcome data" : `${number(Number(profile.obesity_adjprev), 1)}%`}</strong> age-adjusted obesity · {number(profile.totalpopulation)} residents</p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">{exposures.map(exposure => <div key={exposure.column}><dt className="text-xs text-muted-foreground">{exposure.label}</dt><dd className="mt-1 text-sm font-semibold">{concentration(profile, exposure)}</dd><dd className="text-xs text-muted-foreground">{numberValue(profile[exposure.count]) === null ? "No coverage data" : `${number(Number(profile[exposure.count]), 1)} ${exposure.countLabel} per county`}{!meetsCoverage(profile, exposure) && " · below minimum"}</dd></div>)}</dl>
        </section>)}
      </div>
    </aside>}
    <div className="mb-3 mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
      <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: COLORS.county }} />{state === "ALL" ? "All states + DC" : `${state} counties`}</span>
      <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: COLORS.selected }} />{selected.length > 1 ? "Selected counties" : "Selected county"}</span>
    </div>
    <div className="grid gap-4 md:grid-cols-2" aria-label="Six lithium measures">
      {panels.map(({ exposure, counties: rows }) => {
        const xs = completePairs(rows, exposure.column, "obesity_adjprev").map(row => row[exposure.column] as number);
        const x: [number, number] = exposure.kind === "fraction" ? [0, 100] : xs.length ? [Math.floor(Math.min(...xs) * 2) / 2 - 0.1, Math.ceil(Math.max(...xs) * 2) / 2 + 0.1] : [0, 1];
        return <CountyPlot key={exposure.column} title={exposure.label} counties={rows} exposure={exposure} weighted={weighted} selected={selected} onSelect={fips => setSelected([fips])} domains={{ x, y: yDomain }} />;
      })}
    </div>



  </section>;
}
