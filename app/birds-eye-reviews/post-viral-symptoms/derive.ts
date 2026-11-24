/** Pure functions that reshape `page.json` into the lean props each section
 *  needs. They select and regroup; the only arithmetic is descriptive
 *  (medians and quartiles for the "why estimates disagree" section, and
 *  months = days / 30.4375). Every value keeps the row id it came from. */
import type { PageData, Paper, PaperLite, Pool, PoolStudy, Series, Sensitivity } from "./types";
import { DAYS_PER_MONTH, paperLabel } from "./labels";

export function paperLite(papers: Record<string, Paper>): Record<string, PaperLite> {
  const out: Record<string, PaperLite> = {};
  for (const [id, p] of Object.entries(papers)) {
    out[id] = {
      label: paperLabel(p, id),
      journal: p.journal,
      title: p.title,
      doi: p.doi ?? (id.startsWith("10.") ? id : undefined),
      data_source: p.data_source,
      n: p.n,
      rob: p.rob,
      figure_only: p.figure_only,
    };
  }
  return out;
}

// ---------------------------------------------------------------- client payloads

/** Series as the trajectory explorer needs them: no long ids (the index is
 *  the key), no fields it never shows, a point's group label only when it
 *  differs from the line's first group. */
export function clientSeries(series: Series[]): Series[] {
  return series.map((s, i) => {
    const g0 = s.groups?.[0];
    return {
      id: String(i), cohort: s.cohort, role: s.role, exp: s.exp, sev: s.sev, fam: s.fam, est: s.est,
      defc: s.defc, base: s.base, groups: s.groups,
      pts: s.pts.map(({ g, bin: _bin, ...p }) => (g && g !== g0 ? { ...p, g } : p)),
    };
  });
}

/** Excess / head-to-head pools without their long ids (rows key by index). */
export function clientPools(pools: Pool[]): Pool[] {
  return pools.map((p, i) => ({ ...p, id: String(i) }));
}

// ---------------------------------------------------------------- excess lines

export interface ExcessPoint {
  r: string;
  p: string;
  tm: number;
  bin?: string;
  v: number;
  lo?: number;
  hi?: number;
  ep?: number;
  cp?: number;
  ne?: number;
  nc?: number;
  src?: string;
  o?: string;
  er?: string;
  cr?: string;
}

export interface ExcessLine {
  id: string;
  cohort: string;
  exp: string;
  sev: string;
  comp: string;
  fam: string;
  est: string;
  pts: ExcessPoint[];
}

/** Per-cohort excess (risk difference) lines for the trajectory explorer's
 *  "excess" mode. Each point is exactly one study of one excess pool (the
 *  one candidate per cohort and time bin the synthesis chose), so the line
 *  shows the same numbers the pooled panel uses. */
export function excessLines(pools: Pool[]): ExcessLine[] {
  const lines = new Map<string, ExcessLine>();
  for (const pool of pools) {
    if (pool.meas !== "risk_difference" || !pool.comp) continue;
    for (const s of pool.studies ?? []) {
      if (s.td == null) continue;
      const cohort = s.c ?? s.p;
      const id = [cohort, pool.exp, pool.sev, pool.comp, pool.fam, pool.est].join("|");
      let line = lines.get(id);
      if (!line) {
        line = { id, cohort, exp: pool.exp, sev: pool.sev, comp: pool.comp, fam: pool.fam, est: pool.est, pts: [] };
        lines.set(id, line);
      }
      line.pts.push({
        r: s.r, p: s.p, tm: s.td / DAYS_PER_MONTH, bin: s.bin ?? pool.bin, v: s.v, lo: s.lo, hi: s.hi,
        ep: s.ep, cp: s.cp, ne: s.ne, nc: s.nc, src: s.src, o: s.o, er: s.er, cr: s.cr,
      });
    }
  }
  for (const l of lines.values()) l.pts.sort((a, b) => a.tm - b.tm);
  return [...lines.values()];
}

// ---------------------------------------------------------------- heatmap

export interface HeatCell {
  fam: string;
  exp: string;
  sev: string;
  bin: string;
  est: string;
  role: string;
  k: number;
  nt?: number;
  v?: number;
  lo?: number;
  hi?: number;
  pil?: number;
  pih?: number;
  i2?: number;
  single?: number;
  nnp?: number;
}

export function heatCells(pools: Pool[]): HeatCell[] {
  return pools
    // The heatmap shows infected (exposed) groups and the uninfected background.
    .filter((p) => (p.role === "exposed" || p.exp === "none") && (p.k >= 1 || (p.n_np ?? 0) > 0))
    .map((p) => ({
      fam: p.fam, exp: p.exp, sev: p.sev, bin: p.bin, est: p.est, role: p.role ?? "exposed",
      k: p.k, nt: p.nt, v: p.pooled?.v, lo: p.pooled?.lo, hi: p.pooled?.hi,
      pil: p.pooled?.pil, pih: p.pooled?.pih, i2: p.pooled?.i2, single: p.single, nnp: p.n_np,
    }));
}

// ---------------------------------------------------------------- why estimates disagree

export interface Spread {
  label: string;
  code: string;
  values: number[];
  cohorts: number;
  median: number;
  q1: number;
  q3: number;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export interface LineValue {
  value: number;
  cohort: string;
  paper: string;
  defc?: string;
  base?: string;
  dataSource?: string;
  tm: number;
}

/** One raw-prevalence value per cohort line: the exposed group's report
 *  closest to 6 months, among reports at 3-12 months (bins 3m, 6m, 12m). */
export function lineValues(series: Series[], papers: Record<string, Paper>, fam: string, exp = "covid"): LineValue[] {
  const out: LineValue[] = [];
  for (const s of series) {
    if (s.role !== "exposed" || s.exp !== exp || s.fam !== fam || s.est !== "prevalence") continue;
    const window = s.pts.filter((p) => p.bin === "3m" || p.bin === "6m" || p.bin === "12m");
    if (window.length === 0) continue;
    const pt = window.reduce((a, b) => (Math.abs(Math.log(b.tm / 6)) < Math.abs(Math.log(a.tm / 6)) ? b : a));
    const paper = pt.r.split("#")[0];
    out.push({
      value: pt.pct, cohort: s.cohort, paper, defc: s.defc, base: s.base,
      dataSource: papers[paper]?.data_source, tm: pt.tm,
    });
  }
  return out;
}

export function spreads(values: LineValue[], by: (v: LineValue) => string | undefined, label: (code: string) => string): Spread[] {
  const groups = new Map<string, LineValue[]>();
  for (const v of values) {
    const code = by(v) ?? "not_stated";
    groups.set(code, [...(groups.get(code) ?? []), v]);
  }
  return [...groups.entries()]
    .map(([code, vs]) => {
      const sorted = vs.map((v) => v.value).sort((a, b) => a - b);
      return {
        code, label: label(code), values: sorted, cohorts: new Set(vs.map((v) => v.cohort)).size,
        median: quantile(sorted, 0.5), q1: quantile(sorted, 0.25), q3: quantile(sorted, 0.75),
      };
    })
    .sort((a, b) => b.values.length - a.values.length);
}

export interface RawVsExcess {
  r: string;
  p: string;
  fam: string;
  bin: string;
  sev: string;
  ep: number;
  cp: number;
  rd: number;
  o?: string;
}

/** Pairs where both the raw prevalence and the comparison group's are known:
 *  derived-pair studies of COVID excess pools over uninfected people. */
export function rawVsExcess(pools: Pool[]): RawVsExcess[] {
  const seen = new Set<string>();
  const out: RawVsExcess[] = [];
  for (const pool of pools) {
    if (pool.exp !== "covid" || pool.comp !== "uninfected" || pool.meas !== "risk_difference" || pool.est !== "prevalence") continue;
    for (const s of pool.studies ?? []) {
      if (s.ep == null || s.cp == null || seen.has(s.r)) continue;
      seen.add(s.r);
      out.push({ r: s.r, p: s.p, fam: pool.fam, bin: pool.bin, sev: pool.sev, ep: s.ep, cp: s.cp, rd: s.v, o: s.o });
    }
  }
  return out.sort((a, b) => b.ep - a.ep);
}

// ---------------------------------------------------------------- sensitivity

export interface SensitivityRow {
  pool: Pool;
  kind: "excess" | "head_to_head" | "trajectory";
  sens: Sensitivity;
}

export function sensitivityRows(data: PageData): SensitivityRow[] {
  const byId = new Map<string, { pool: Pool; kind: SensitivityRow["kind"] }>();
  for (const p of data.pools.excess) byId.set(p.id, { pool: p, kind: "excess" });
  for (const p of data.pools.head_to_head) byId.set(p.id, { pool: p, kind: "head_to_head" });
  for (const p of data.pools.trajectories) byId.set(p.id, { pool: p, kind: "trajectory" });
  const rows: SensitivityRow[] = [];
  for (const [id, sens] of Object.entries(data.pools.sensitivity)) {
    const hit = byId.get(id);
    if (hit) rows.push({ ...hit, sens });
  }
  const order = { excess: 0, head_to_head: 1, trajectory: 2 };
  return rows.sort((a, b) => order[a.kind] - order[b.kind] || a.pool.fam.localeCompare(b.pool.fam) || a.pool.id.localeCompare(b.pool.id));
}

/** Studies of a pool, with the paper's label, for forests. */
export type StudyWithLabel = PoolStudy & { label: string };
