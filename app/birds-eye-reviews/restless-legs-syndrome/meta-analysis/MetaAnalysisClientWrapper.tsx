"use client";

import { useMemo, useState } from "react";
import { ForestPlot, ForestGroup } from "../ForestPlot";

/** Pretty drug label (matches the dashboard's prettyLabel / fmtIngredient). */
const fmtIngredient = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Opt-in meta-analysis view: one forest plot per (drug × outcome × measure), with
 *  a unified standardized (SMD) plot leading each drug×domain cluster. A lightweight
 *  drug filter narrows the plots; nothing else on the page depends on it. */
export function MetaAnalysisClientWrapper({
  groups,
  minTrials,
}: {
  groups: ForestGroup[];
  minTrials: number;
}) {
  const [ingredient, setIngredient] = useState<string | undefined>(undefined);

  // Drug options: every drug that has at least one poolable group, by trial volume.
  const ingredientOptions = useMemo(() => {
    const weight = new Map<string, number>();
    for (const g of groups) {
      if (g.n_trials < 2) continue;
      weight.set(g.ingredient, (weight.get(g.ingredient) ?? 0) + g.n_trials);
    }
    return [...weight.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key]) => key);
  }, [groups]);

  // Plots: groups with >=2 trials, optionally filtered by drug. Clustered by drug
  // (most-studied first), then outcome domain; within a domain the unified
  // standardized (SMD) plot leads, followed by the per-measure plots.
  const shownGroups = useMemo(() => {
    let g = groups.filter((x) => x.n_trials >= 2);
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
        One forest plot per drug × outcome × effect measure with ≥2 trials. A pooled
        random-effects diamond (DerSimonian–Laird) is shown when {minTrials}+ trials report the
        same comparable estimate. A standardized (SMD) plot — combining continuous and binary
        outcomes onto one Cohen&apos;s-d scale — leads each drug×outcome group.
        {" "}({pooledCount} pooled.)
      </p>

      {ingredientOptions.length > 0 && (
        <div className="mb-6">
          <label className="text-sm text-foreground/70 mr-2">Filter by drug:</label>
          <select
            value={ingredient ?? ""}
            onChange={(e) => setIngredient(e.target.value || undefined)}
            className="rounded-md border border-border bg-white px-2 py-1 text-sm"
          >
            <option value="">All drugs</option>
            {ingredientOptions.map((k) => (
              <option key={k} value={k}>{fmtIngredient(k)}</option>
            ))}
          </select>
        </div>
      )}

      {shownGroups.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg bg-foreground/[0.02] px-4 py-8 text-center text-sm text-foreground/60">
          No drug yet has ≥2 trials reporting a comparable outcome and effect measure
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
