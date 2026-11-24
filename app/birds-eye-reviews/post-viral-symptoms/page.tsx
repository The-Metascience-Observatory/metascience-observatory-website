import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { BirdsEyeWarning } from "@/components/BirdsEyeWarning";
import { loadLastUpdated, loadPageData } from "./data";
import { clientPools, clientSeries, heatCells, lineValues, paperLite, rawVsExcess, sensitivityRows, spreads } from "./derive";
import { baselineLabel, dataSourceLabel, definitionLabel, fmtInt, humanize } from "./labels";
import { TrajectoryExplorer } from "./TrajectoryExplorer";
import { ForestPanel } from "./ForestPanel";
import { Heatmap } from "./Heatmap";
import { EvidenceTable } from "./EvidenceTable";
import { HeadlineCards, RawVsExcessChart, SensitivityTable, SpreadChart } from "./Sections";

export const metadata = {
  title: "Post-viral symptoms | Bird's Eye Reviews | The Metascience Observatory",
  description:
    "How common are persistent symptoms after COVID-19, influenza, mononucleosis and other infections, and how much above the background rate in comparable uninfected people? Every number traces to a paper and a quote.",
};

const linkStyle = "underline underline-offset-4 hover:text-primary";
const DOWNLOAD = "/birds-eye-reviews/post-viral-symptoms/download";

function Section({ id, title, intro, children }: { id: string; title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="mt-12 scroll-mt-24">
      <h2 id={`${id}-h`} className="font-clarendon text-2xl font-bold">{title}</h2>
      {intro && <div className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground/80">{intro}</div>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function PostViralSymptomsPage() {
  const data = loadPageData();
  const last = loadLastUpdated();
  const { meta } = data;
  const c = meta.counts;
  const papers = paperLite(data.papers);
  const bins = meta.time_bins;

  // Client payloads: only the fields each chart reads.
  const excessPools = clientPools(data.pools.excess);
  const cells = heatCells(data.pools.trajectories);

  // "Why estimates disagree": one raw value per COVID cohort line.
  const fatigueVals = lineValues(data.series, data.papers, "fatigue");
  const anyVals = lineValues(data.series, data.papers, "any_symptom");
  const pairs = rawVsExcess(data.pools.excess);
  const sens = sensitivityRows(data);

  const usablePapers = Object.values(data.papers).filter((p) => p.usable);
  const figureOnly = usablePapers.filter((p) => p.figure_only).length;
  const dataSources = new Map<string, number>();
  for (const p of usablePapers) dataSources.set(p.data_source ?? "not_stated", (dataSources.get(p.data_source ?? "not_stated") ?? 0) + 1);
  const generated = (last.generated_at ?? meta.generated_at ?? "").slice(0, 10);
  const m = meta.methods;

  return (
    <>
      <Navbar />
      <main className="mx-auto min-h-screen w-full max-w-[1200px] px-4 pb-16 pt-24 sm:px-8">
        <BirdsEyeWarning />
        <Link href="/birds-eye-reviews" className="text-sm text-blue-600 hover:text-blue-700">&larr; Back to Bird&apos;s Eye Reviews</Link>
        <h1 className="mt-2 font-clarendon text-3xl font-bold sm:text-4xl">
          Post-viral symptoms: how common, and how much above background?{" "}
          <span className="align-middle font-sans text-base font-semibold text-red-800 sm:text-lg">
            (AI-extracted; numbers checked against source quotes)
          </span>
        </h1>
        <div className="mt-3 max-w-3xl space-y-2 text-sm leading-relaxed text-foreground/80">
          <p>
            Months after an infection, how many people still have fatigue, brain fog, post-exertional malaise or other symptoms, or meet a
            case definition such as ME/CFS? This page collects follow-up studies of COVID-19, influenza, infectious mononucleosis (EBV),
            other viral and non-viral infections, and people hospitalised for other causes, and lines their results up at about 1, 2, 3,
            6, 12, 24 and 36+ months after the infection.
          </p>
          <p>
            <strong>The central idea:</strong> a raw percentage (&ldquo;30% still tired at 6 months&rdquo;) also counts tiredness people would have
            had anyway. The number that answers &ldquo;what did the infection do?&rdquo; is the <em>excess</em>: the infected group&apos;s percentage
            minus that of comparable uninfected people measured the same way at the same time. Both are shown, never mixed.
          </p>
          <p className="text-xs text-muted-foreground">
            This release: {fmtInt(c.n_papers_usable)} usable papers ({fmtInt(c.n_papers)} assessed) covering {fmtInt(c.n_cohorts)} distinct cohorts,
            {" "}{fmtInt(c.n_estimates_usable)} usable group estimates and {fmtInt(c.n_contrasts_usable)} between-group contrasts.
            {meta.origin === "gold" && <> Built from the hand-checked reference set of papers; the full search-based release will replace it.</>}
            {generated && <> Data generated {generated}.</>}
            {" "}k = number of independent cohorts behind a number. Every number links to the paper and the sentence or table cell it came from.
          </p>
        </div>
        <nav aria-label="On this page" className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {[["headline", "Headline"], ["trajectories", "Trajectories"], ["excess", "Excess over background"], ["head-to-head", "Head to head"],
            ["heatmap", "Symptom × time"], ["disagree", "Why estimates disagree"], ["sensitivity", "Sensitivity"], ["evidence", "Evidence"], ["methods", "Methods"]]
            .map(([id, t]) => <a key={id} href={`#${id}`} className={`text-blue-700 ${linkStyle}`}>{t}</a>)}
        </nav>

        <Section id="headline" title="Headline numbers"
          intro={<>Pooled excess over comparable uninfected (or test-negative) people, for COVID-19, wherever the studies allow it, and the direct COVID-19 vs influenza comparisons. Random-effects pools with 95% confidence intervals; a number from one cohort is labelled <em>single study</em>.</>}>
          <HeadlineCards data={data} papers={papers} />
        </Section>

        <Section id="trajectories" title="Trajectories: each cohort over time"
          intro={<>One line per group of one cohort, coloured by infection, with a different marker per line. Switch between the raw percentage and the excess over that cohort&apos;s own comparison group. Hover or tap a point for the paper, group, n/N, definition and quote.</>}>
          <TrajectoryExplorer series={clientSeries(data.series)} excessPools={excessPools} papers={papers} cohorts={data.cohorts} />
        </Section>

        <Section id="excess" title="Excess over background"
          intro={<>Pooled difference between infected and comparison groups, by time since infection, split by what the comparison group is (uninfected, a different acute illness, or hospitalised for another cause) and by severity. One estimate per cohort; repeat reports of a cohort are counted once.</>}>
          <ForestPanel kind="excess" pools={excessPools} papers={papers} timeBins={bins} />
        </Section>

        <Section id="head-to-head" title="Head to head: COVID-19 vs other acute illnesses"
          intro={<>Studies that followed people after COVID-19 and after another infection or critical illness side by side. Positive differences (or ratios above 1) mean more symptoms after the first-named infection.</>}>
          <ForestPanel kind="head_to_head" pools={clientPools(data.pools.head_to_head)} papers={papers} timeBins={bins} />
        </Section>

        <Section id="heatmap" title="Symptom × time"
          intro={<>Raw percentages for every outcome family with data, by time since infection. Compare a row with the same row for the uninfected comparison groups to see how much is background.</>}>
          <Heatmap cells={cells} timeBins={bins} />
        </Section>

        <Section id="disagree" title="Why estimates disagree"
          intro={<>Published figures for &ldquo;long COVID fatigue&rdquo; range widely. Much of the spread follows from how the outcome was defined and counted. Below, each dot is one COVID-19 cohort line (its report closest to 6 months, within 3–12 months), point prevalence only; bars span the middle half, the black tick is the median. These are descriptive, unadjusted comparisons: the groups also differ in population, severity and timing.</>}>
          <div className="grid gap-4 lg:grid-cols-2">
            <SpreadChart title="Fatigue: raw prevalence by how fatigue was defined" spreads={spreads(fatigueVals, (v) => v.defc, definitionLabel)} />
            <SpreadChart title="Any symptom: raw prevalence by how it was defined" spreads={spreads(anyVals, (v) => v.defc, definitionLabel)} />
            <SpreadChart title="Fatigue: by handling of pre-infection symptoms" spreads={spreads(fatigueVals, (v) => v.base, baselineLabel)}
              note="New-onset counting excludes people who already had the symptom before infection." />
            <SpreadChart title="Any symptom: by handling of pre-infection symptoms" spreads={spreads(anyVals, (v) => v.base, baselineLabel)} />
            <SpreadChart title="Fatigue: by data source" spreads={spreads(fatigueVals, (v) => v.dataSource, dataSourceLabel)}
              note="Questionnaires ask everyone; health-record codes count only people who sought care and were coded." />
            <SpreadChart title="Any symptom: by data source" spreads={spreads(anyVals, (v) => v.dataSource, dataSourceLabel)} />
          </div>
          <div className="mt-4">
            <RawVsExcessChart pairs={pairs} papers={papers} bins={bins} />
          </div>
        </Section>

        <Section id="sensitivity" title="Sensitivity analyses"
          intro={<>Every pooled result (k ≥ 2) for the six headline outcomes, re-run with restrictions. A result that changes a lot when one kind of study is dropped rests on that kind of study.</>}>
          <SensitivityTable rows={sens} bins={bins} />
        </Section>

        <Section id="evidence" title="Evidence table"
          intro={<>Every extracted estimate and contrast, including those excluded from the analysis (with the reason). Each row carries the verbatim quote, where in the paper it is, the extractor&apos;s confidence and the verification status.</>}>
          <EvidenceTable papers={papers} timeBins={bins} />
        </Section>

        <Section id="methods" title="Methods and limitations">
          <div className="grid gap-6 text-sm leading-relaxed md:grid-cols-2">
            <div className="space-y-3">
              <p><strong>Search and screening.</strong> Bibliographic searches (PubMed and other scholarly indexes) for follow-up studies of each infection, phrased for persistent symptoms, recovery and sequelae; the COVID-19 side reuses the search of our Long COVID review. Titles and abstracts were screened by an AI model; full texts were then checked for eligibility. Eligible: studies that report the share of an infected group with a symptom or case definition at least 4 weeks after infection. Excluded: samples recruited because they already had persistent symptoms (clinic samples), modelling studies, trials, and acute-phase-only reports.</p>
              <p><strong>Extraction and checking.</strong> A cheaper model extracts every group × outcome × time point with its numerator, denominator, CI, outcome definition, how pre-infection symptoms were handled, and a verbatim quote with its location; a stronger model re-checks headline outcomes, low-confidence entries and a random sample, confirming, correcting or removing them. Verification status is shown on every row.{meta.origin === "gold" && " In this release every entry was checked by hand."}</p>
              <p><strong>Cohort de-duplication.</strong> Several papers often report one cohort (e.g. at 6, 12 and 24 months). Papers are linked to cohorts by name or acronym, country, infection and overlapping recruitment (with one AI pass over ambiguous pairs); each pool uses one estimate per cohort. {fmtInt(c.n_papers_usable)} papers map to {fmtInt(c.n_cohorts)} cohorts.</p>
              <p><strong>Pooling.</strong> {humanize(m.model)}-effects meta-analysis ({m.tau2_method} between-study variance; {m.ci_method === "modified_hksj" ? "Knapp–Hartung confidence intervals, never narrower than the Wald interval" : m.ci_method}; {Math.round((m.level ?? 0.95) * 100)}% level; at least {m.min_k} cohorts to pool). Proportions are pooled on the logit scale, risk differences in percentage points, ratios on the log scale; prediction intervals need k ≥ 3. Differences are the paper&apos;s own adjusted contrast where reported, else its crude contrast, else computed from the two groups&apos; percentages measured within {Math.round((m.time_tolerance ?? 0.15) * 100)}% of the same time ({fmtInt(c.n_derived_pairs)} such pairs). Point prevalence, cumulative incidence, &ldquo;lasting at least t&rdquo; and incidence rates are never pooled together, nor are different effect measures.</p>
            </div>
            <div className="space-y-3">
              <p><strong>Time bins.</strong> {bins.map((b) => `${b.label} (${b.low_days}${b.high_days != null ? `–${b.high_days - 1}` : "+"} days)`).join("; ")}. Time is counted from infection or the positive test, with any stated offset added. Charts plot each report at its exact time.</p>
              <p><strong>Exclusions.</strong> {Object.entries(meta.exclusions).filter(([k]) => !k.endsWith(":kept")).map(([k, v]) => `${fmtInt(v)} ${k.replace(":", " rows: ").replace(/_/g, " ")}`).join("; ") || "none"}. Rows whose denominator is people who already have the outcome are dropped, as are entries the verifier removed. Subgroup rows and censored values (“&lt; x%”) are listed but not pooled.</p>
              <p><strong>Limitations.</strong> Outcome definitions differ widely (a single questionnaire item vs a validated scale cut-off vs a diagnosis code), and many studies count symptoms regardless of whether they existed before infection. Participation and follow-up are selective: people with ongoing symptoms may be more likely to answer. Symptoms are mostly self-reported and recalled. {figureOnly > 0 && <>{fmtInt(figureOnly)} of {fmtInt(usablePapers.length)} usable papers are flagged as giving some data only in figures; values read from plots are less precise. </>}Comparison groups are the studies&apos; own (uninfected people may include undetected infections, which biases excess towards zero); there are no general-population background surveys here. Health-record studies ({fmtInt(dataSources.get("health_records_or_claims") ?? 0)} papers) measure recorded diagnoses, not symptoms. Pools of two cohorts have very wide intervals by design. Risk of bias was judged per paper during extraction (shown in each forest row).</p>
              <p><strong>Data sources of usable papers:</strong> {[...dataSources.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${dataSourceLabel(k)} ${v}`).join(", ")}.</p>
              <p><strong>Downloads.</strong> <a href={`${DOWNLOAD}/estimates.csv`} download className={`text-blue-700 ${linkStyle}`}>all estimates (CSV)</a>, <a href={`${DOWNLOAD}/contrasts.csv`} download className={`text-blue-700 ${linkStyle}`}>all contrasts (CSV)</a>, <a href={`${DOWNLOAD}/last_updated.json`} download className={`text-blue-700 ${linkStyle}`}>release metadata</a>. Bundle schema {meta.bundle_schema}{meta.extraction_schema ? `, extraction ${meta.extraction_schema}` : ""}{last.published_at ? `; published ${last.published_at.slice(0, 10)}` : ""}.</p>
              <p className="text-xs text-muted-foreground">Percentages are of the group as the paper reports them (weighted or modelled where the paper says so; the evidence table shows which).</p>
            </div>
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}
