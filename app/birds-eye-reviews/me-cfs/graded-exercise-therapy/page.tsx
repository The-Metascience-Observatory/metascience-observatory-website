import fs from "fs";
import path from "path";
import { ReactNode } from "react";
import Link from "next/link";
import { BirdsEyeNavbar } from "@/components/BirdsEyeNavbar";
import { Footer } from "@/components/Footer";
import { GetForestPlot } from "./GetForestPlot";
import { GetPrismaDiagram } from "./GetPrismaDiagram";
import { MiniForest, MiniRow } from "./MiniForest";
import {
  GetMetaAnalysis,
  GetGroup,
  GetPrisma,
  GetSubgroupCell,
  fmt,
  fmtSmd,
  prettyDomain,
  gradeBadge,
} from "./types";

export const metadata = {
  title: "Graded Exercise Therapy — Meta-Analysis | ME/CFS | Bird's Eye Reviews | The Metascience Observatory",
  description:
    "Rapid AI-assisted random-effects meta-analysis of graded exercise therapy (GET) for ME/CFS: fatigue, physical function and harms, all very-low-certainty (GRADE).",
};

const DATA_DIR = "data/birds_eye_reviews/me_cfs";
const dataPath = (f: string) => path.join(process.cwd(), DATA_DIR, f);

/** Read + JSON-parse a data file, returning null when it is missing or invalid,
 *  so the page still renders a graceful "not generated yet" state. */
function safeReadJson<T>(fp: string): T | null {
  try {
    if (!fs.existsSync(fp)) return null;
    return JSON.parse(fs.readFileSync(fp, "utf-8")) as T;
  } catch {
    return null;
  }
}

const BACK = "/birds-eye-reviews/me-cfs";

/** Stat card: value + CI + optional GRADE badge, tinted by whether the CI
 *  excludes the null (benefit = emerald, harm-signal RR>1 = amber, otherwise
 *  neutral/slate). Theme-aware. */
function StatCard({
  title,
  value,
  ci,
  badge,
  tone,
  note,
}: {
  title: string;
  value: string;
  ci: string;
  badge?: { label: string; cls: string } | null;
  tone: "benefit" | "caution" | "neutral";
  note?: string;
}) {
  const toneCls =
    tone === "benefit"
      ? "border-emerald-300/70 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/30"
      : tone === "caution"
        ? "border-amber-300/70 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/30"
        : "border-border bg-foreground/[0.02]";
  return (
    <div className={`rounded-lg border p-4 ${toneCls}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-foreground/55">{title}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums text-foreground">{value}</div>
      <div className="text-sm text-foreground/60 tabular-nums">95% CI {ci}</div>
      {badge && (
        <span className={`mt-2 inline-block text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 ${badge.cls}`}>
          {badge.label} (GRADE)
        </span>
      )}
      {note && <div className="mt-1 text-xs text-foreground/50">{note}</div>}
    </div>
  );
}

function Section({
  title,
  children,
  sub,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="font-clarendon text-2xl font-bold text-foreground mb-1">{title}</h2>
      {sub && <p className="text-sm text-foreground/60 mb-4 max-w-3xl">{sub}</p>}
      {children}
    </section>
  );
}

/** Build the subgroup mini-forest rows (Oxford / non-Oxford, adult / paediatric)
 *  present for a given SMD group. */
function subgroupRows(g: GetGroup): MiniRow[] {
  const sg = g.subgroups;
  if (!sg) return [];
  const rows: MiniRow[] = [];
  const push = (label: string, c: GetSubgroupCell | undefined) => {
    if (c) rows.push({ label, k: c.k, effect: c.effect, ci_low: c.ci_low, ci_high: c.ci_high, i2: fmtRound(c.i2) });
  };
  push("Oxford criteria", sg.oxford);
  push("Non-Oxford criteria", sg.non_oxford);
  push("Adult", sg.adult);
  push("Paediatric", sg.pediatric);
  return rows;
}
const fmtRound = (n: number) => Math.round(n * 10) / 10;

export default function GetMetaAnalysisPage() {
  const meta = safeReadJson<GetMetaAnalysis>(dataPath("get_meta_analysis.json"));
  const prisma = safeReadJson<GetPrisma>(dataPath("get_prisma.json"));

  const groups = meta?.groups ?? [];
  const fatigue = groups.find((g) => g.outcome_domain === "fatigue") ?? null;
  const physical = groups.find((g) => g.outcome_domain === "physical_function") ?? null;
  const harms = groups.find((g) => g.outcome_domain === "harms") ?? null;
  const smdGroups = [fatigue, physical].filter((g): g is GetGroup => g != null);

  const hasAny = meta != null || prisma != null;

  return (
    <>
      <BirdsEyeNavbar />
      <main className="container mx-auto px-4 pt-24 pb-16 min-h-screen overflow-x-hidden">
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/birds-eye-reviews" className="text-sm text-blue-600 hover:text-blue-700">
            &larr; Back to Bird&apos;s Eye Reviews
          </Link>
          <Link href={BACK} className="text-sm text-blue-600 hover:text-blue-700">
            &larr; Back to ME/CFS clinical trials
          </Link>
        </div>

        {/* 1. Header */}
        <h1 className="font-clarendon font-bold text-3xl mb-1">Graded Exercise Therapy for ME/CFS</h1>
        <p className="text-base text-foreground/70 mb-3">Meta-analysis (very-low-certainty evidence)</p>
        <p className="text-sm text-foreground/65 max-w-3xl mb-6 leading-relaxed">
          A rapid, AI-assisted update pooling the randomised trials of graded exercise therapy (GET)
          for myalgic encephalomyelitis / chronic fatigue syndrome. Effects are standardised mean
          differences (Hedges&apos; <em>g</em>) where a <strong>positive SMD favours GET</strong>, plus a
          risk-ratio pool for serious-adverse-event harms. Every pooled estimate is graded{" "}
          <strong>very-low certainty</strong> under GRADE, so the point estimates below should be read as
          hypotheses, not settled effects.
        </p>

        {!hasAny ? (
          <div className="border border-dashed border-border rounded-lg bg-foreground/[0.02] px-4 py-10 text-center text-sm text-foreground/60">
            The graded-exercise-therapy meta-analysis has not been generated yet. Once the pipeline
            writes <code className="text-foreground/70">get_meta_analysis.json</code> and{" "}
            <code className="text-foreground/70">get_prisma.json</code>, this page will populate
            automatically.
          </div>
        ) : (
          <>
            {/* 2. Key-findings stat cards */}
            {(fatigue?.pooled || physical?.pooled || harms?.pooled) && (
              <Section title="Key findings">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {fatigue?.pooled && (
                    <StatCard
                      title="Fatigue (SMD)"
                      value={fmtSmd(fatigue.pooled.effect, true)}
                      ci={`${fmtSmd(fatigue.pooled.ci_low)} to ${fmtSmd(fatigue.pooled.ci_high)}`}
                      badge={gradeBadge(fatigue.certainty?.grade)}
                      tone={fatigue.pooled.ci_low > 0 ? "benefit" : "neutral"}
                      note={`I² = ${fmt(fatigue.pooled.i2)}% · ${fatigue.n_trials} trials · positive favours GET`}
                    />
                  )}
                  {physical?.pooled && (
                    <StatCard
                      title="Physical function (SMD)"
                      value={fmtSmd(physical.pooled.effect, true)}
                      ci={`${fmtSmd(physical.pooled.ci_low)} to ${fmtSmd(physical.pooled.ci_high)}`}
                      badge={gradeBadge(physical.certainty?.grade)}
                      tone={physical.pooled.ci_low > 0 ? "benefit" : "neutral"}
                      note={
                        physical.pooled.ci_low <= 0 && physical.pooled.ci_high >= 0
                          ? `I² = ${fmt(physical.pooled.i2)}% · CI crosses the null`
                          : `I² = ${fmt(physical.pooled.i2)}% · ${physical.n_trials} trials`
                      }
                    />
                  )}
                  {harms?.pooled && (
                    <StatCard
                      title="Harms — serious AEs (RR)"
                      value={fmt(harms.pooled.effect)}
                      ci={`${fmt(harms.pooled.ci_low)} to ${fmt(harms.pooled.ci_high)}`}
                      tone={harms.pooled.ci_low > 1 ? "caution" : "neutral"}
                      note={`RR > 1 favours control (more harm with GET) · ${harms.n_trials} trials`}
                    />
                  )}
                </div>
              </Section>
            )}

            {/* 3. Forest plots */}
            {(smdGroups.length > 0 || harms) && (
              <Section
                title="Forest plots"
                sub="One random-effects (DerSimonian–Laird, HKSJ confidence intervals) pool per outcome. Squares are per-trial estimates sized by pooled weight; the diamond is the pooled estimate. Positive SMD favours GET; for harms a risk ratio above 1 means more harm with GET."
              >
                {smdGroups.map((g) => (
                  <GetForestPlot key={g.outcome_domain} group={g} />
                ))}
                {harms && <GetForestPlot group={harms} />}
              </Section>
            )}

            {/* 4. Subgroup panel */}
            {smdGroups.some((g) => g.subgroups) && (
              <Section
                title="Subgroups: case definition and age"
                sub="Trials that used the broad Oxford criteria (which admit patients with chronic fatigue but not necessarily the post-exertional malaise that defines ME/CFS) show roughly twice the effect of non-Oxford trials — a key driver of the pooled estimate and of the case-definition controversy."
              >
                <div className="grid gap-6 lg:grid-cols-2">
                  {smdGroups.map((g) =>
                    g.subgroups ? (
                      <div key={g.outcome_domain} className="border border-border rounded-lg bg-card p-4 shadow-sm">
                        <h3 className="font-semibold text-foreground mb-3">{prettyDomain(g.outcome_domain)}</h3>
                        <MiniForest rows={subgroupRows(g)} />
                      </div>
                    ) : null
                  )}
                </div>
              </Section>
            )}

            {/* 5. Sensitivity panel */}
            {smdGroups.some((g) => g.sensitivity) && (
              <Section
                title="Sensitivity analyses"
                sub="Powell 2001 — an education-based, Oxford-criteria trial with the largest single effect — is a high-leverage outlier. Re-pooling without it roughly halves the estimate and cuts heterogeneity. The leave-one-out range shows how much each trial moves the pool."
              >
                <div className="grid gap-6 lg:grid-cols-2">
                  {smdGroups.map((g) => {
                    const s = g.sensitivity;
                    if (!s) return null;
                    const rows: MiniRow[] = [];
                    if (g.pooled) {
                      rows.push({
                        label: "Primary pool (all trials)",
                        k: g.n_trials,
                        effect: g.pooled.effect,
                        ci_low: g.pooled.ci_low,
                        ci_high: g.pooled.ci_high,
                        i2: fmtRound(g.pooled.i2),
                        emphasis: true,
                      });
                    }
                    if (s.exclude_powell) {
                      rows.push({
                        label: "Excluding Powell 2001",
                        k: s.exclude_powell.k,
                        effect: s.exclude_powell.effect,
                        ci_low: s.exclude_powell.ci_low,
                        ci_high: s.exclude_powell.ci_high,
                        i2: fmtRound(s.exclude_powell.i2),
                      });
                    }
                    if (s.fixed_or_dl_normal) {
                      rows.push({
                        label: "DL / normal-CI (no HKSJ)",
                        effect: s.fixed_or_dl_normal.effect,
                        ci_low: s.fixed_or_dl_normal.ci_low,
                        ci_high: s.fixed_or_dl_normal.ci_high,
                      });
                    }
                    // leave-one-out range summary
                    const loo = s.leave_one_out ?? [];
                    const looEffects = loo.map((x) => x.effect);
                    const looMin = looEffects.length ? Math.min(...looEffects) : null;
                    const looMax = looEffects.length ? Math.max(...looEffects) : null;
                    return (
                      <div key={g.outcome_domain} className="border border-border rounded-lg bg-card p-4 shadow-sm">
                        <h3 className="font-semibold text-foreground mb-3">{prettyDomain(g.outcome_domain)}</h3>
                        <MiniForest rows={rows} />
                        {loo.length > 0 && (
                          <div className="mt-3 border-t border-border pt-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-foreground/50 mb-1">
                              Leave-one-out
                            </div>
                            <p className="text-sm text-foreground/65">
                              Pooled SMD ranges{" "}
                              <span className="tabular-nums font-medium text-foreground/80">
                                {fmtSmd(looMin)} to {fmtSmd(looMax)}
                              </span>{" "}
                              across the {loo.length} single-trial exclusions. The lowest value drops out
                              when <span className="font-medium">Powell</span> is removed.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* 6. Harms narrative + forest */}
            {harms && (
              <Section
                title="Harms"
                sub="Serious adverse events and dropouts, pooled as a risk ratio (GET vs control). The pooled estimate points toward more harm with GET but the confidence interval crosses 1, so it is not statistically conclusive. PACE (White 2011) dominates the pool."
              >
                <div className="mb-4 overflow-x-auto">
                  <table className="w-full text-sm border-collapse min-w-[520px]">
                    <thead>
                      <tr className="text-left text-foreground/55 border-b border-border">
                        <th className="py-2 pr-3 font-medium">Trial</th>
                        <th className="py-2 pr-3 font-medium">GET</th>
                        <th className="py-2 pr-3 font-medium">Control</th>
                        <th className="py-2 pr-3 font-medium text-right">RR (95% CI)</th>
                        <th className="py-2 font-medium text-right">Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...harms.trials]
                        .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
                        .map((t) => (
                          <tr key={t.paper_id} className="border-b border-border/60">
                            <td className="py-2 pr-3 text-foreground/85">
                              {t.first_author} {t.year}
                            </td>
                            <td className="py-2 pr-3 tabular-nums text-foreground/70">{t.get ?? "—"}</td>
                            <td className="py-2 pr-3 tabular-nums text-foreground/70">{t.control ?? "—"}</td>
                            <td className="py-2 pr-3 tabular-nums text-right text-foreground/70">
                              {fmt(t.effect)} ({fmt(t.ci_low)}–{fmt(t.ci_high)})
                            </td>
                            <td className="py-2 tabular-nums text-right text-foreground/60">
                              {t.weight != null ? `${fmt(t.weight)}%` : "—"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <GetForestPlot group={harms} />
              </Section>
            )}

            {/* 7. PRISMA flow */}
            {prisma ? (
              <Section title="Study selection">
                <GetPrismaDiagram prisma={prisma} />
              </Section>
            ) : (
              <Section title="Study selection">
                <div className="border border-dashed border-border rounded-lg bg-foreground/[0.02] px-4 py-8 text-center text-sm text-foreground/60">
                  The PRISMA flow has not been generated yet.
                </div>
              </Section>
            )}

            {/* 8. Included-studies table */}
            {prisma?.included_trials?.length ? (
              <Section title="Included studies">
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm border-collapse min-w-[560px]">
                    <thead>
                      <tr className="text-left text-foreground/55 bg-foreground/[0.03] border-b border-border">
                        <th className="py-2 px-3 font-medium">Trial</th>
                        <th className="py-2 px-3 font-medium">Year</th>
                        <th className="py-2 px-3 font-medium">Case definition</th>
                        <th className="py-2 px-3 font-medium">Age</th>
                        <th className="py-2 px-3 font-medium text-right">n randomised</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...prisma.included_trials]
                        .sort((a, b) => a.year - b.year)
                        .map((t) => {
                          const href = t.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${t.pmid}/` : null;
                          return (
                            <tr key={`${t.trial}-${t.year}`} className="border-b border-border/60 last:border-0">
                              <td className="py-2 px-3 text-foreground/85">
                                {href ? (
                                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                    {t.trial}
                                  </a>
                                ) : (
                                  t.trial
                                )}
                              </td>
                              <td className="py-2 px-3 tabular-nums text-foreground/70">{t.year}</td>
                              <td className="py-2 px-3 text-foreground/70 capitalize">{t.criteria}</td>
                              <td className="py-2 px-3 text-foreground/70 capitalize">{t.age}</td>
                              <td className="py-2 px-3 tabular-nums text-right text-foreground/70">
                                {t.n_randomized.toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </Section>
            ) : null}

            {/* 9. GRADE + limitations */}
            <Section title="Certainty of evidence & limitations">
              {smdGroups.some((g) => g.certainty) && (
                <div className="grid gap-4 md:grid-cols-2 mb-5">
                  {smdGroups.map((g) =>
                    g.certainty ? (
                      <div key={g.outcome_domain} className="border border-border rounded-lg bg-card p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-foreground">{prettyDomain(g.outcome_domain)}</h3>
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 ${gradeBadge(g.certainty.grade).cls}`}
                          >
                            {gradeBadge(g.certainty.grade).label}
                          </span>
                        </div>
                        <div className="text-xs text-foreground/55 mb-1">
                          Started at {g.certainty.start} certainty; downgraded for:
                        </div>
                        <ul className="space-y-1">
                          {g.certainty.downgrades.map((d, i) => (
                            <li key={i} className="text-sm text-foreground/70">
                              <span className="font-medium text-foreground/85 capitalize">
                                {d.domain.replace(/_/g, " ")}
                              </span>
                              <span className="text-foreground/55"> — {d.reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null
                  )}
                </div>
              )}

              <div className="border border-border rounded-lg bg-foreground/[0.02] p-4 text-sm text-foreground/70 leading-relaxed space-y-2">
                <p>
                  <strong>Every trial was open-label with self-reported primary outcomes.</strong>{" "}
                  Patients and therapists knew the assignment, and fatigue and physical-function scales
                  are subjective, so response bias cannot be separated from a true treatment effect —
                  the reason all pools start high but land at very-low certainty.
                </p>
                <p>
                  <strong>Heterogeneity is considerable</strong> (I² around 87–89% for the SMD pools),
                  driven largely by broad Oxford-criteria trials and by the Powell 2001 outlier, an
                  education-based ("pragmatic rehabilitation") intervention rather than a supervised
                  exercise programme.
                </p>
                <p>
                  <strong>The FINE trial&apos;s primary paper is missing</strong> from the machine-readable
                  pool; its per-arm data could not be recovered in a form comparable to the other trials,
                  a known gap in this rapid update.
                </p>
                <p>
                  <strong>Methodology.</strong> Effect sizes were extracted by an AI pipeline with an
                  adversarial verification pass against the source PDFs. For PACE (White 2011) the primary
                  outcome tables were lost when GROBID parsed the layout, and were recovered directly from
                  the source before pooling — one worked example of the extraction-plus-verification loop
                  behind these numbers.
                </p>
                {meta?.generated_note && (
                  <p className="text-xs text-foreground/50 border-t border-border pt-2">
                    {meta.generated_note}
                  </p>
                )}
              </div>
            </Section>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
