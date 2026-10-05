import fs from "fs";
import path from "path";
import { loadAePoints, loadDoseSerumRatio } from "./ae-points";
import type { AePoint } from "./stats";

export interface DoseResponseData {
  /** Every lithium and placebo arm's side-effect count (therapeutic stratum).
   *  Summaries and curves are computed from these in summarize.ts — in the
   *  browser, after the page's table filters are applied. */
  points: AePoint[];
  /** Population-weighted spread of tap-water lithium intake across US
   *  counties at 2 L/day, mg/day; null when the snapshot is missing. */
  water: { p5: number; p50: number; p95: number; counties: number } | null;
  /** Base DOIs of every paper this section draws on — lithium arms that are
   *  plotted (have a dose or serum level) and the placebo arms behind the grey
   *  bands — so the page's trial table can list them all. */
  paperDois: string[];
  /** Empirical elemental mg/day per mmol/L serum (see loadDoseSerumRatio). */
  doseSerum: ReturnType<typeof loadDoseSerumRatio>;
}

const WATER_SNAPSHOT = "data/birds_eye_reviews/lithium_drinking_water/snapshot.v1.json";

/** UCMR5 modeled geometric mean (µg/L) per county, population-weighted
 *  quantiles, × 2 L/day. Below the 9 µg/L reporting limit the GM is a model
 *  estimate, so the low end is order-of-magnitude only. */
function loadWaterIntake(): DoseResponseData["water"] {
  const fp = path.join(process.cwd(), WATER_SNAPSHOT);
  try {
    if (!fs.existsSync(fp)) return null;
    const snap = JSON.parse(fs.readFileSync(fp, "utf-8")) as {
      counties: { ucmr5_all_li_gm?: number | null; totalpopulation?: number | null }[];
    };
    const rows = snap.counties
      .filter((c) => typeof c.ucmr5_all_li_gm === "number" && isFinite(c.ucmr5_all_li_gm) &&
                     typeof c.totalpopulation === "number" && c.totalpopulation > 0)
      .map((c) => [c.ucmr5_all_li_gm as number, c.totalpopulation as number] as const)
      .sort((a, b) => a[0] - b[0]);
    if (rows.length === 0) return null;
    const tot = rows.reduce((s, [, w]) => s + w, 0);
    const q = (f: number) => {
      let acc = 0;
      for (const [v, w] of rows) {
        acc += w;
        if (acc >= f * tot) return (v * 2) / 1000;
      }
      return (rows[rows.length - 1][0] * 2) / 1000;
    };
    return { p5: q(0.05), p50: q(0.5), p95: q(0.95), counties: rows.length };
  } catch {
    return null;
  }
}

export function loadDoseResponse(
  dataDir: string,
  decorate: (p: AePoint) => AePoint = (p) => p,
): DoseResponseData {
  const points = loadAePoints(dataDir).map(decorate);
  const used = new Set<string>();
  for (const p of points) {
    if (p.role === "placebo" || p.doseMg != null || p.serum != null) used.add(p.doi.split("#")[0]);
  }
  return {
    points,
    paperDois: [...used].sort(),
    water: loadWaterIntake(),
    doseSerum: loadDoseSerumRatio(dataDir),
  };
}
