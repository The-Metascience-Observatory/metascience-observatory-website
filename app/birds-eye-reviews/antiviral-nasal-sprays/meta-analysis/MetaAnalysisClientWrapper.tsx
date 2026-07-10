"use client";

import { useMemo, useState } from "react";
import { ForestPlot, ForestGroup } from "../ForestPlot";

/** Pretty ingredient label (matches the dashboard's prettyLabel / fmtIngredient). */
const fmtIngredient = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Opt-in meta-analysis view: one forest plot per (ingredient × outcome × measure),
 *  with a unified standardized (SMD) plot leading each ingredient×domain cluster. A
 *  lightweight ingredient filter narrows the plots; nothing else depends on it. */
export function MetaAnalysisClientWrapper({
  groups,
  minTrials,
}: {
  groups: ForestGroup[];
  minTrials: number;
}) {
  const [ingredient, setIngredient] = useState<string | undefined>(undefined);

  // Cross-compound (all-ingredient) standardized plots — the headline "compare the
  // compounds" figures. Ordered symptom duration, then viral load, then any others.
  const crossGroups = useMemo(() => {
    const order = ["symptom_duration", "viral_load"];
    return groups
      .filter((g) => g.cross_ingredient && g.n_trials >= 2)
      .sort((a, b) =>
        (order.indexOf(a.outcome_domain) + 1 || 99) - (order.indexOf(b.outcome_domain) + 1 || 99) ||
        b.n_trials - a.n_trials);
  }, [groups]);

  // Ingredient options: every (non-cross) ingredient with a poolable group, by volume.
  const ingredientOptions = useMemo(() => {
    const weight = new Map<string, number>();
    for (const g of groups) {
      if (g.n_trials < 2 || g.cross_ingredient) continue;
      weight.set(g.ingredient, (weight.get(g.ingredient) ?? 0) + g.n_trials);
    }
    return [...weight.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key]) => key);
  }, [groups]);

  // Per-compound plots: groups with >=2 trials, optionally filtered by ingredient.
  // Clustered by ingredient (most-studied first), then outcome domain; within a
  // domain the standardized (SMD) plot leads, followed by the per-measure plots.
  const shownGroups = useMemo(() => {
    let g = groups.filter((x) => x.n_trials >= 2 && !x.cross_ingredient);
    if (ingredient) g = g.filter((x) => x.ingredient === ingredient);
    const ingWeight = new Map<string, number>();
    for (const x of g) ingWeight.set(x.ingredient, (ingWeight.get(x.ingredient) ?? 0) + x.n_trials);
    return g.sort(
      (a, b) =>
        (ingWeight.get(b.ingredient)! - ingWeight.get(a.ingredient)!) ||
        a.ingredient.localeCompare(b.ingredient) ||
        a.outcome_domain.localeCompare(b.outcome_domain) ||
        Number(Boolean(b.standardized)) - Number(Boolean(a.standardized)) ||
        Number(Boolean(b.pooled)) - Number(Boolean(a.pooled)) ||
        b.n_trials - a.n_trials
    );
  }, [groups, ingredient]);
  const pooledCount = groups.filter((g) => g.pooled).length;

  return (
    <>
      <p className="text-sm text-foreground/60 mb-4 max-w-3xl">
        The top <strong>&ldquo;across all compounds&rdquo;</strong> plots compare every nasal spray on one
        outcome, standardized to Cohen&apos;s d (positive = favors treatment) so different scales and units
        pool together; each compound is a subgroup with its own subtotal. Below, one forest plot per
        ingredient × outcome × effect measure (≥2 trials), with a standardized plot leading each
        ingredient×outcome group. Pooled diamonds are random-effects (DerSimonian–Laird).
        {" "}({pooledCount} pooled.)
      </p>

      {crossGroups.length > 0 && (
        <section className="mb-8">
          <h2 className="font-clarendon font-bold text-xl mb-1">Across all compounds</h2>
          <p className="text-xs text-foreground/50 mb-3 max-w-3xl">
            Exploratory class-level pools — antivirals differ, so heterogeneity is high; read the
            prediction interval, per-compound subtotals, and the not-poolable appendix, not just the diamond.
          </p>
          {crossGroups.map((g, i) => (
            <ForestPlot key={`cross-${g.outcome_domain}-${i}`} group={g} />
          ))}
        </section>
      )}

      {shownGroups.length > 0 && (
        <h2 className="font-clarendon font-bold text-xl mb-3">By compound</h2>
      )}

      {ingredientOptions.length > 0 && (
        <div className="mb-6">
          <label className="text-sm text-foreground/70 mr-2">Filter by ingredient:</label>
          <select
            value={ingredient ?? ""}
            onChange={(e) => setIngredient(e.target.value || undefined)}
            className="rounded-md border border-border bg-white px-2 py-1 text-sm"
          >
            <option value="">All ingredients</option>
            {ingredientOptions.map((k) => (
              <option key={k} value={k}>{fmtIngredient(k)}</option>
            ))}
          </select>
        </div>
      )}

      {shownGroups.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg bg-foreground/[0.02] px-4 py-8 text-center text-sm text-foreground/60">
          No ingredient yet has ≥2 trials reporting a comparable outcome and effect measure
          {ingredient ? ` for “${fmtIngredient(ingredient)}”` : ""}.
        </div>
      ) : (
        shownGroups.map((g, i) => (
          <ForestPlot key={`${g.ingredient}-${g.outcome_domain}-${g.effect_measure}-${i}`} group={g} />
        ))
      )}
    </>
  );
}
