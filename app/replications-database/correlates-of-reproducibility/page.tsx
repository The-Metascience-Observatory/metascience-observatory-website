import Link from "next/link";
import { ReplicationsNavbar } from "@/components/ReplicationsNavbar";
import { Footer } from "@/components/Footer";
import { SUCCESS_RATE_DEFINITION } from "@/lib/replicationOutcome";
import type { LogitFit } from "@/lib/logit";
import { buildDataset } from "./data";
import { buildCorrelationTable, fitModel, LOG10P_FLOOR, type ModelResult, type ModelScale } from "./stats";
import { CorrTable } from "./CorrTable";
import { signClass } from "./format";
import { ForestPlot, MODEL_A_COLOR, MODEL_B_COLOR, type ForestTerm } from "./ForestPlot";

export const metadata = {
  title: "Correlates of Reproducibility | The Metascience Observatory",
  description:
    "Which features of a study predict whether it replicates? Correlation coefficients (Pearson r, Spearman rho with cluster-bootstrap CIs) for p-value, year, journal impact factor and rank, citations, author h-index and author overlap — plus an interpretable fractional logistic regression combining them.",
};

const fmt = (v: number, dp = 3) => (Number.isFinite(v) ? v.toFixed(dp) : "—");
const fmtCI = (lo: number, hi: number) =>
  Number.isFinite(lo) ? `[${fmt(lo, 2)}, ${fmt(hi, 2)}]` : "—";
const fmtP = (p: number) => (p < 0.001 ? "< 0.001" : p.toFixed(3));
const fmtN = (n: number) => n.toLocaleString("en-US");

// Translate "+1 SD" of each (transformed) model covariate into natural units.
function sdGloss(scale: ModelScale): string {
  const fold = (sd: number) => {
    const f = Math.pow(10, sd);
    return f >= 10 ? `×${f.toFixed(0)}` : `×${f.toFixed(1)}`;
  };
  switch (scale.key) {
    case "year":
      return `${scale.sd.toFixed(1)} years later`;
    case "impactFactor":
      return `≈ ${fold(scale.sd)} higher impact factor`;
    case "sjrPct":
      return `${scale.sd.toFixed(1)} SJR percentile points higher`;
    case "citations":
      return `≈ ${fold(scale.sd)} the first-2-year citations (+1)`;
    case "hMean":
      return `≈ ${fold(scale.sd)} the mean author h-index (+1)`;
    case "overlap":
      return `${scale.sd.toFixed(1)} more shared authors`;
    case "exactP":
      return `≈ ${fold(scale.sd)} larger p-value`;
    default:
      return `+1 SD`;
  }
}

function ModelTable({ title, subtitle, model }: { title: string; subtitle: string; model: ModelResult }) {
  const fit = model.fit;
  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
      {!fit ? (
        <p className="text-sm text-muted-foreground italic">
          The model did not converge on this sample; no estimates are shown.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-3 font-medium">Covariate</th>
                  <th className="py-2 pr-3 font-medium text-right">β per +1 SD</th>
                  <th className="py-2 pr-3 font-medium text-right">SE</th>
                  <th className="py-2 pr-3 font-medium text-right">z</th>
                  <th className="py-2 pr-3 font-medium text-right">p</th>
                  <th className="py-2 pr-3 font-medium text-right">AME (pp per +1 SD)</th>
                  <th className="py-2 font-medium">+1 SD means…</th>
                </tr>
              </thead>
              <tbody>
                {fit.terms.map((t, j) => (
                  <tr key={t.name} className="border-b border-border/60">
                    <td className="py-1.5 pr-3">{t.name}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{fmt(t.beta)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{fmt(t.se)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{fmt(t.z, 2)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{fmtP(t.p)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{(t.ame * 100).toFixed(1)}</td>
                    <td className="py-1.5 text-muted-foreground">{sdGloss(model.scales[j])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Fractional logit (quasi-MLE), n = {fmtN(fit.nObs)} effects in {fmtN(fit.nClusters)} original
            papers; standard errors clustered on the original paper. Covariates are z-scored on this
            model&apos;s own estimation sample, so coefficients are comparable within the table. AME =
            average marginal effect, in percentage points of predicted replication score per +1 SD.
          </p>
        </>
      )}
    </div>
  );
}

function forestTerms(a: LogitFit | null, b: LogitFit | null): ForestTerm[] {
  const names: string[] = [];
  for (const fit of [a, b]) {
    for (const t of fit?.terms ?? []) if (!names.includes(t.name)) names.push(t.name);
  }
  return names.map((name) => {
    const ta = a?.terms.find((t) => t.name === name);
    const tb = b?.terms.find((t) => t.name === name);
    return {
      name,
      a: ta ? { beta: ta.beta, se: ta.se, p: ta.p, ame: ta.ame } : undefined,
      b: tb ? { beta: tb.beta, se: tb.se, p: tb.p, ame: tb.ame } : undefined,
    };
  });
}

// Computed once per server process and reused (the bootstraps and model fits
// take seconds) — the same module-scope caching /api/fred uses. In production
// the page is prerendered at build time anyway; this mainly keeps dev fast.
let cachedPageData: {
  meta: ReturnType<typeof buildDataset>["meta"];
  table: ReturnType<typeof buildCorrelationTable>;
  modelA: ModelResult;
  modelB: ModelResult;
} | null = null;

function getPageData() {
  if (!cachedPageData) {
    const { rows, meta } = buildDataset();
    cachedPageData = {
      meta,
      table: buildCorrelationTable(rows),
      modelA: fitModel(rows, false),
      modelB: fitModel(rows, true),
    };
  }
  return cachedPageData;
}

export default function CorrelatesPage() {
  const { meta, table, modelA, modelB } = getPageData();

  const overlapRow = table.find((r) => r.key === "overlap");
  const pRow = table.find((r) => r.key === "exactP");

  return (
    <div className="min-h-screen flex flex-col">
      <ReplicationsNavbar />
      <main className="pt-24 px-6 sm:px-8 md:px-12 lg:px-16 xl:px-24 py-10 flex-1">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="space-y-3">
            <h1 className="text-2xl md:text-3xl font-bold">Correlates of Reproducibility</h1>
            <p className="text-muted-foreground">
              Each page of the replications database looks at one predictor of replication success at a
              time. This page puts them side by side: first as simple correlations between each
              predictor and the replication outcome, then jointly in an interpretable regression model
              that shows how much each factor contributes once the others are held fixed.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2 text-sm">
            <p className="font-medium">How the outcome is coded on this page</p>
            <p className="text-muted-foreground">
              Analyses here score each replication attempt as <strong>1</strong> = success,{" "}
              <strong>0</strong> = failure or reversal, and <strong>0.5</strong> = recorded as
              inconclusive, using the stored result (the &ldquo;reported&rdquo; criterion; rows with no
              recorded result are dropped, n = {fmtN(meta.droppedBlankResult)}). This differs from the
              site-wide success-rate definition (&ldquo;{SUCCESS_RATE_DEFINITION}&rdquo;), which
              excludes inconclusive attempts entirely — see{" "}
              <Link href="/docs/replication-outcome-classification" className="underline hover:opacity-80">
                how outcomes are classified
              </Link>
              . Analyses are at the effect level; because one original paper can be replicated many
              times, all confidence intervals are paper-cluster bootstrap intervals (1,000 draws,
              resampling original papers), which are wider and more honest than intervals that assume
              independent rows.
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Correlation table</h2>
            <p className="text-sm text-muted-foreground">
              Pearson r is computed on the transformed predictor shown in the second column (heavily
              skewed predictors are log-scaled); Spearman&apos;s ρ is rank-based, so it uses the raw
              values and is unaffected by any monotone transform. Each row links to the page that
              examines that predictor in depth, and each uses every effect for which that predictor is
              available, so n varies by row.
            </p>
            <CorrTable rows={table} />
            <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
              <li>
                Outcome coded 1 / 0.5 / 0 as described above; 95% CIs are paper-cluster bootstrap
                percentile intervals.
              </li>
              <li>
                The p-value row uses only exactly reported p-values (type &ldquo;=&rdquo;,{" "}
                {pRow ? fmtN(pRow.n) : "—"} effects) — stricter than the{" "}
                <Link href="/replications-database/by-p-value" className="underline hover:opacity-80">
                  by-p-value page
                </Link>
                , which also admits p-values whose reporting type is unrecorded. Reported p-values run
                down to the smallest representable number, so for the Pearson correlation log₁₀ p is
                floored at {LOG10P_FLOOR} (p &lt; 10<sup>{LOG10P_FLOOR}</sup> treated as 10
                <sup>{LOG10P_FLOOR}</sup>); Spearman&apos;s ρ is unaffected.
              </li>
              <li>
                SJR percentile is oriented so higher = better-ranked journal. Journals whose OpenAlex
                impact factor is exactly 0 are excluded from the impact-factor row (
                {fmtN(meta.droppedIfZero)} effects), since a log scale cannot represent them.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Summary table</h2>
            <p className="text-sm text-muted-foreground">
              The same estimates in a compact, shareable form.
            </p>
            <div className="w-fit max-w-full rounded-lg border border-border px-5 pt-5 pb-2.5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="font-semibold">Correlates of reproducibility</p>
                  <p className="text-[11px] text-muted-foreground">
                    across {fmtN(meta.usableRows)} replicated effects from {fmtN(meta.papers)} papers
                  </p>
                </div>
                {/* Same mark as ChartWatermark on the by-* chart pages. */}
                <div className="flex items-center gap-1.5 shrink-0 opacity-80" style={{ color: "#4b5563" }}>
                  <svg
                    viewBox="0 0 16 16"
                    width={13}
                    height={13}
                    stroke="currentColor"
                    strokeWidth={0.9}
                    strokeLinecap="round"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle cx={8} cy={8} r={7.35} />
                    <ellipse cx={8} cy={8} rx={3} ry={7.35} />
                    <ellipse cx={8} cy={8} rx={7.35} ry={3} />
                  </svg>
                  <span className="text-[10px] whitespace-nowrap">The Metascience Observatory</span>
                </div>
              </div>
              <table className="text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-1.5 pr-3 font-medium">Predictor</th>
                    <th className="py-1.5 pr-3 font-medium text-right">r</th>
                    <th className="py-1.5 pr-3 font-medium">95% CI</th>
                    <th className="py-1.5 pr-3 font-medium text-right">Spearman ρ</th>
                    <th className="py-1.5 font-medium">95% CI</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Sorted by Spearman ρ — the more robust metric for an
                      ordinal 0/0.5/1 outcome and heavy-tailed predictors. */}
                  {[...table]
                    .sort((a, b) => b.spearmanR - a.spearmanR)
                    .map((row) => (
                    <tr key={row.key} className="border-b border-border/60 last:border-b-0">
                      <td className="py-1 pr-3">{row.label}</td>
                      <td className={`py-1 pr-3 text-right tabular-nums ${signClass(row.pearsonR)}`}>
                        {fmt(row.pearsonR, 2)}
                      </td>
                      <td className="py-1 pr-3 tabular-nums text-muted-foreground">
                        {fmtCI(row.pearsonLo, row.pearsonHi)}
                      </td>
                      <td className={`py-1 pr-3 text-right tabular-nums ${signClass(row.spearmanR)}`}>
                        {fmt(row.spearmanR, 2)}
                      </td>
                      <td className="py-1 tabular-nums text-muted-foreground">
                        {fmtCI(row.spearmanLo, row.spearmanHi)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">What the correlations say</h2>
            <p className="text-sm text-muted-foreground">
              Every prestige-flavored predictor — journal impact factor, journal rank, citations, and
              author h-index in all four variants — correlates <em>negatively</em> with replication:
              more prestigious venues and more eminent, more-cited work replicate slightly less often.
              The single strongest correlate is author overlap
              {overlapRow ? ` (ρ = ${fmt(overlapRow.spearmanR)})` : ""}: replications that share
              authors with the original succeed far more often than independent ones. Smaller original
              p-values predict success{overlapRow && pRow ? ` (ρ = ${fmt(pRow.spearmanR)} on the
              exactly-reported subset)` : ""}, and publication year has at most a weak positive trend.
              All of these are small by conventional standards — no single feature of a paper comes
              close to determining whether it replicates.
            </p>
          </section>

          <section className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">A simple joint model</h2>
              <p className="text-sm text-muted-foreground">
                The correlations above are pairwise, and the predictors overlap (highly cited papers
                sit in high-impact journals written by high-h authors). To see what each factor
                contributes with the others held fixed, we fit a fractional logistic regression of the
                0 / 0.5 / 1 outcome on all predictors at once. Covariates are standardized, so
                coefficients read as log-odds per one standard deviation and are directly comparable;
                the AME column converts each into percentage points of predicted replication score.
                Only mean author h-index enters (the four h-index variants are too collinear to
                separate, r ≈ 0.9), and the p-value — missing for most rows — is added only in Model
                B, which is restricted to the much smaller exactly-reported-p subset.
              </p>
            </div>

            <ModelTable
              title="Model A — all effects with complete predictors"
              subtitle="Publication year, journal impact factor and rank, first-2-year citations, mean author h-index, and author overlap."
              model={modelA}
            />
            <ModelTable
              title="Model B — adds the original p-value"
              subtitle={`Same covariates plus log₁₀ p (floored at ${LOG10P_FLOOR}), on the small subset with an exactly reported original p-value — read with caution.`}
              model={modelB}
            />

            <div className="space-y-2">
              <h3 className="text-base font-semibold">Coefficients at a glance</h3>
              <ForestPlot
                terms={forestTerms(modelA.fit, modelB.fit)}
                legendA={`Model A (n = ${fmtN(modelA.nObs)})`}
                legendB={`Model B (n = ${fmtN(modelB.nObs)})`}
              />
              <p className="text-[11px] text-muted-foreground">
                Points are standardized coefficients; horizontal lines are cluster-robust 95%
                confidence intervals. <span style={{ color: MODEL_A_COLOR }}>●</span> Model A,{" "}
                <span style={{ color: MODEL_B_COLOR }}>◆</span> Model B. Hover a point for details.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-semibold">Reading the model</h3>
              <p className="text-sm text-muted-foreground">
                Author overlap dominates Model A: it is by far the largest coefficient, echoing the{" "}
                <Link href="/replications-database/by-author-overlap" className="underline hover:opacity-80">
                  by-author-overlap page
                </Link>
                . Journal rank and mean author h-index retain small negative effects once everything
                else is held fixed, while impact factor and citations — strongly correlated with both —
                contribute little of their own. In Model B the original p-value is the strongest
                predictor in the model, and it absorbs much of what the prestige variables appeared to
                carry; but Model B rests on a small, unrepresentative subset (initiatives that report
                exact p-values), so treat it as suggestive. As always, these are observational
                associations, not causal effects.
              </p>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">Coverage</h2>
            <p className="text-[11px] text-muted-foreground">
              Source: {meta.csvName} — {fmtN(meta.totalRows)} effect rows, of which{" "}
              {fmtN(meta.usableRows)} have a recorded result ({fmtN(meta.papers)} original papers).
              Predictor coverage among those rows: publication year {fmtN(meta.coverage.year)};
              journal impact factor {fmtN(meta.coverage.impactFactor)} (after excluding{" "}
              {fmtN(meta.droppedIfZero)} with IF = 0); journal rank {fmtN(meta.coverage.sjrPct)};
              citations in the first two years {fmtN(meta.coverage.citations)}; author h-index{" "}
              {fmtN(meta.coverage.hMean)}{" "}
              (first author {fmtN(meta.coverage.hFirst)}, last author {fmtN(meta.coverage.hLast)});
              author overlap {fmtN(meta.coverage.overlap)}; exactly reported p-value{" "}
              {fmtN(meta.coverage.exactP)}. Impact factors and citation counts come from OpenAlex,
              journal ranks from SCImago, and author h-indexes from SciSciNet; all joins are by DOI or
              normalized journal name. Statistics on this page are verified against an independent
              Python implementation (scripts/check_logit.py).
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
