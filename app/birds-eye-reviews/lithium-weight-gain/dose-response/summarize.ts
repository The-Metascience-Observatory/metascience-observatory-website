import { EFFECTS } from "./effects";
import { AePoint, CurveFit, Link, Rate, Weighting, fitCurve, wilson } from "./stats";

/** Pure per-effect summaries — no fs, so the browser can recompute them when
 *  the page's table filters change. The server loader (load.ts) only reads
 *  the arm counts; everything shown is derived here from whichever arms pass
 *  the filters. */

export interface EffectSummary {
  key: string;
  label: string;
  isControl: boolean;
  lithium: AePoint[];
  lithiumPapers: number;
  lithiumCrude: Rate | null;
  placeboArms: number;
  placebo: Rate | null;
}

export type Axis = "dose" | "serum";

export function summarizeEffects(points: AePoint[]): EffectSummary[] {
  const sum = (xs: AePoint[], f: (p: AePoint) => number) => xs.reduce((s, p) => s + f(p), 0);
  return EFFECTS.map((e) => {
    const mine = points.filter((p) => p.effect === e.key);
    const li = mine.filter((p) => p.role === "lithium");
    const pl = mine.filter((p) => p.role === "placebo");
    return {
      key: e.key,
      label: e.label,
      isControl: Boolean(e.isControl),
      lithium: li,
      lithiumPapers: new Set(li.map((p) => p.doi.split("#")[0])).size,
      lithiumCrude: wilson(sum(li, (p) => p.events), sum(li, (p) => p.n)),
      placeboArms: pl.length,
      placebo: wilson(sum(pl, (p) => p.events), sum(pl, (p) => p.n)),
    };
  });
}

/** The curve for one effect under one weighting / link / x-axis. */
export function fitEffect(e: EffectSummary, weighting: Weighting, link: Link, axis: Axis): CurveFit {
  return axis === "dose"
    ? fitCurve(e.lithium, "doseMg", true, link, weighting)
    : fitCurve(e.lithium, "serum", false, link, weighting);
}

/** Elemental dose range of the plotted lithium arms, mg/day. */
export function trialDoseRange(effects: EffectSummary[]): [number, number] | null {
  const d = effects.flatMap((e) => e.lithium.map((p) => p.doseMg)).filter((x): x is number => x != null);
  return d.length ? [Math.min(...d), Math.max(...d)] : null;
}
