import fs from "fs";
import path from "path";
import { ReactNode } from "react";
import Link from "next/link";
import { BirdsEyeNavbar } from "@/components/BirdsEyeNavbar";
import { Footer } from "@/components/Footer";
import { EXCLUDED_DOIS } from "../utils";

export const metadata = {
  title:
    "Does lithium cause weight gain, and does it depend on dose? | Bird's Eye Reviews | The Metascience Observatory",
  description:
    "A rapid, AI-assisted review of 5,951 full texts: lithium's average effect on weight is small and statistically null, and the dose-response question has never actually been measured.",
};

const DATA_DIR = "data/birds_eye_reviews/lithium_weight_gain";

interface Prisma {
  identified: number;
  relevant: number;
  retrieved: number;
  screened_fulltext: number;
  extractable: number;
  extracted: number;
  with_weight_outcome: number;
  poolable: number;
}

function loadPrisma(): Prisma | null {
  const fp = path.join(process.cwd(), DATA_DIR, "prisma.json");
  try {
    if (!fs.existsSync(fp)) return null;
    return JSON.parse(fs.readFileSync(fp, "utf-8")) as Prisma;
  } catch {
    return null;
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-clarendon text-xl font-bold text-foreground mb-3">{title}</h2>
      {children}
    </section>
  );
}

function StatCard({ value, label, note, tone = "neutral" }: {
  value: string;
  label: string;
  note?: string;
  tone?: "neutral" | "warn";
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        tone === "warn"
          ? "border-amber-200 bg-amber-50/50"
          : "border-border bg-foreground/[0.02]"
      }`}
    >
      <div className="text-2xl font-bold leading-none text-foreground">{value}</div>
      <div className="mt-1 text-sm text-foreground/75">{label}</div>
      {note && <div className="mt-1 text-xs text-foreground/50">{note}</div>}
    </div>
  );
}

export default function ReportPage() {
  const raw = loadPrisma();
  // Displayed-study count: the extraction total minus the hand-excluded
  // spurious records (EXCLUDED_DOIS in ../utils), so every number here
  // matches what the dashboard actually shows.
  const p = raw
    ? { ...raw, with_weight_outcome: raw.with_weight_outcome - EXCLUDED_DOIS.size }
    : null;

  return (
    <>
      <BirdsEyeNavbar />
      <main className="container mx-auto max-w-3xl px-4 pt-24 pb-16 min-h-screen">
        <div className="mb-2">
          <Link
            href="/birds-eye-reviews/lithium-weight-gain"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            &larr; Back to Lithium &amp; Weight Gain
          </Link>
        </div>

        <h1 className="font-clarendon font-bold text-3xl mb-1">
          Does lithium cause weight gain — and does it depend on dose?
        </h1>
        <p className="mb-4 text-base text-foreground/70">
          What 5,951 full texts actually say, and the question none of them answer.
        </p>

        {/* AI provenance — deliberately above the fold, not a footnote. */}
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
              AI-generated
            </span>
            <p className="text-sm leading-relaxed text-amber-900/90">
              This report was written by an AI system as part of a rapid, AI-assisted
              review. The searching, screening, data extraction, statistics and this
              summary were all produced automatically. It has <strong>not</strong> been
              verified line-by-line by a human expert, no GRADE certainty ratings have
              been assigned, and individual extractions may contain errors. Treat it as a
              structured starting point for reading the primary literature — not as
              settled evidence, and not as medical advice.
            </p>
          </div>
        </div>

        {p && (
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              value="+1.5 kg"
              label="Pooled effect on body weight"
              note="95% CI −1.4 to +4.5 · k=10 · not significant"
            />
            <StatCard
              value="27"
              label="Studies with a serum level AND a kg change"
              note={`of ${p.with_weight_outcome} reporting any weight outcome`}
              tone="warn"
            />
            <StatCard
              value="0"
              label="Studies at supplement doses"
              note="with a measured dose and a weight outcome"
              tone="warn"
            />
          </div>
        )}

        <Section title="The short answer">
          <p className="text-[15px] leading-relaxed text-foreground/80">
            Across this corpus, lithium&apos;s average effect on body weight is{" "}
            <strong>small and not statistically distinguishable from zero</strong> — a
            pooled mean difference of <strong>+1.5 kg</strong> (95% CI −1.4 to +4.5,
            10 studies), and <strong>−0.1 kg</strong> (CI −1.3 to +1.0) in the subset
            with almost no heterogeneity. Every pooled interval crosses no-effect.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-foreground/80">
            The more consequential finding is a negative one:{" "}
            <strong>
              whether that effect depends on dose has never actually been measured.
            </strong>{" "}
            Of {p?.with_weight_outcome ?? 213} studies reporting a weight outcome, only{" "}
            <strong>27</strong> report both an achieved serum lithium level and a
            weight change in kilograms (32 lithium arms), and <strong>30</strong>{" "}
            report a computable daily dose alongside one. Plotted as a rate — kg
            gained per week of treatment, the dashboard&apos;s dose-response charts —
            those arms cluster around a median of <strong>≈ 0.05 kg/week</strong>{" "}
            across the whole 0.3–1.0 mmol/L serum range, with no visible trend in
            either dose or achieved level.
          </p>
        </Section>

        <Section title="Why the field disagrees with itself">
          <p className="text-[15px] leading-relaxed text-foreground/80">
            The two prior reviews contradict each other. McKnight (2012, <em>Lancet</em>)
            pooled a <em>dichotomous</em> outcome — the proportion of patients gaining
            ≥7% of body weight — and found a near-doubling of risk. Gomes-da-Costa (2022)
            pooled <em>continuous</em> kilograms and found +0.46 kg, p=0.16: nothing.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-foreground/80">
            Our data reproduces that disagreement rather than resolving it, and suggests
            why. A drug that pushes a susceptible minority over a threshold while leaving
            everyone else unchanged produces a{" "}
            <strong>
              large risk ratio and a near-zero mean difference at the same time
            </strong>
            . Those are not conflicting results; they are different questions. Among
            studies here, 63 outcomes were continuous kilograms, 41 BMI, 34 absolute
            weight, and 15 the ≥7% threshold — and only <strong>11 papers report both
            forms</strong>, which is the only clean test of the hypothesis.
          </p>
        </Section>

        <Section title="What the raw exposure curves show">
          <p className="text-[15px] leading-relaxed text-foreground/80">
            Because most of this literature is single-arm, the dashboard also plots{" "}
            <em>within-arm</em> weight change — what patients on lithium experienced,
            with no comparison group — normalized to a rate. 71 lithium arms report a
            kg change over a known treatment window; 35 of them also carry a
            computable elemental dose and 32 a measured serum level.
          </p>
          <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-foreground/80">
            <li>
              The median rate is <strong>≈ +0.05 kg per week</strong> (interquartile
              range −0.04 to +0.22), and neither daily dose nor achieved serum level
              visibly shifts it within the narrow exposure range studies actually use.
            </li>
            <li>
              Total gain against treatment length is consistent with the common
              clinical description — most of the accrual is visible within the first
              6–12 months, with long cohorts adding little beyond it — though the
              long-duration data is thin.
            </li>
            <li>
              Cumulative exposure (daily elemental dose × days, spanning ~1 g to
              ~380 g) shows no visible relationship with total gain.
            </li>
          </ul>
          <p className="mt-3 text-[15px] leading-relaxed text-foreground/80">
            These are exposure curves, not causal effects: bipolar populations gain
            weight on comparator drugs too, and arms without a comparator cannot
            separate lithium from its context. No percent-of-body-weight version is
            possible — no study reports a numeric baseline weight or BMI.
          </p>
        </Section>

        <Section title="Why the dose question can't be answered">
          <p className="text-[15px] leading-relaxed text-foreground/80">
            Three structural features of how lithium is studied, all measured across this
            corpus:
          </p>
          <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-foreground/80">
            <li>
              <strong>Only 12 of 247 lithium arms used a fixed mg/day dose (5%).</strong>{" "}
              The rest were titrated — to a serum target, to clinical response, or at
              clinician discretion — so for most studies a single trial-level
              &ldquo;dose&rdquo; does not exist as a number. Not one study reports its
              dose as elemental lithium; every elemental value on the dashboard is
              converted from a stated salt.
            </li>
            <li>
              <strong>Only about a third of lithium arms state which salt was used</strong>{" "}
              (83 of 247; 152 leave it unstated). Without the salt you cannot convert
              milligrams of salt into milligrams of elemental lithium: carbonate is
              18.8% lithium, citrate 9.9%, orotate 4.3% — a 2–5× spread. The dashboard
              falls back on the bipolar-population convention of reading an unstated
              salt as carbonate, and marks every such dose as inferred.
            </li>
            <li>
              <strong>An achieved serum level — the actual exposure — is reported for
              only 97 of 247 arms (39%).</strong> Protocol target ranges are stated for
              75. A target is not an exposure measurement, and imputing the midpoint of
              a target range would manufacture data, so the dashboard plots only
              achieved levels.
            </li>
          </ul>
          <p className="mt-3 text-[15px] leading-relaxed text-foreground/80">
            The consequence: among the {p?.poolable ?? 64} studies clean enough to pool,
            the elemental dose band is <em>not reported</em> for 36 of them. There is no
            low-dose stratum to contrast against a high-dose one, and the meta-regression
            is suppressed as underpowered.
          </p>
        </Section>

        <Section title="What about very low doses — around 1 mg a day?">
          <p className="text-[15px] leading-relaxed text-foreground/80">
            <strong>There is no direct evidence.</strong> This review found zero
            supplement-dose studies with both a measured dose and a weight outcome.
            Anything said about 1 mg/day is extrapolation, and should be read as such.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-foreground/80">
            For scale: 1 mg of elemental lithium is about 5.3 mg of lithium carbonate —
            roughly <strong>1/169th</strong> of a standard 900 mg maintenance dose. The
            lowest <em>measured</em> serum level anywhere in this corpus is 0.31 mmol/L,
            already some 50–100× above what 1 mg/day would produce.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-foreground/80">
            The nearest evidence comes from drinking-water studies, and it points the{" "}
            <em>opposite</em> way from the therapeutic literature: higher trace lithium
            tends to be associated with <strong>lower</strong> obesity. A cross-sectional
            study of 202 Andean women across an 8–1,005 µg/L exposure gradient found no
            BMI association (adjusted mean difference +0.14, CI −0.06 to +0.35) — while
            successfully detecting lithium&apos;s thyroid effects in the same sample. That
            matters: the exposure was real and measurable, and weight simply did not move.
          </p>
          <div className="mt-4 rounded-lg border border-border bg-foreground/[0.02] px-4 py-3">
            <p className="text-sm leading-relaxed text-foreground/75">
              <strong>Best reading of the evidence:</strong> weight gain at ~1 mg/day is
              very unlikely to be clinically detectable. The effect at full therapeutic
              doses is already small and statistically null here; 1 mg/day is ~170× lower;
              and lithium&apos;s plausible weight mechanisms (hypothyroidism, thirst-driven
              caloric intake) are all dose-dependent and undemonstrated at trace exposure.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/75">
              <strong>But the caveats are load-bearing.</strong> This extrapolates across
              roughly two orders of magnitude with no bridging data. The drinking-water
              studies are ecological and confounded by geology, water source and diet — they
              cannot establish causation in either direction. A J-shaped or non-monotonic
              curve cannot be excluded; the inverse trace-level association is exactly the
              shape that would produce one. And absence of a detected effect at low doses
              partly reflects <em>absence of study</em>, not demonstrated safety.
            </p>
          </div>
        </Section>

        <Section title="What would settle it">
          <ol className="space-y-2 text-[15px] leading-relaxed text-foreground/80">
            <li>
              <strong>Report achieved serum levels, not just targets.</strong> The single
              highest-value change — 61% of lithium arms currently report no achieved
              level at all.
            </li>
            <li>
              <strong>State the salt form.</strong> One word per paper, and without it no
              elemental dose can be computed at all.
            </li>
            <li>
              <strong>Report weight both ways</strong> — mean change in kg <em>and</em>{" "}
              proportion exceeding ≥7%. Only 11 papers currently do.
            </li>
            <li>
              <strong>Report a numeric baseline weight or BMI.</strong> No study in
              this corpus does, which is why no percent-of-body-weight analysis is
              possible anywhere in this literature — a 3 kg gain means different
              things at 60 kg and at 110 kg.
            </li>
            <li>
              <strong>Run a dedicated low-dose study.</strong> The 1 mg/day question is
              genuinely unstudied and will not be answered by re-analysing the therapeutic
              literature.
            </li>
          </ol>
        </Section>

        <Section title="How this review was done">
          <p className="text-[15px] leading-relaxed text-foreground/80">
            {p && (
              <>
                {p.identified.toLocaleString()} search results were narrowed to{" "}
                {p.relevant.toLocaleString()} after removing battery and materials-science
                papers, {p.retrieved.toLocaleString()} full texts were retrieved, and{" "}
                <strong>every one was read in full</strong> — no abstract-level screen,
                because weight is usually reported only in a safety table where an abstract
                gate would reject exactly the papers this review exists to find. That left{" "}
                {p.extractable.toLocaleString()} eligible papers,{" "}
                {p.with_weight_outcome.toLocaleString()} with a usable weight outcome, and{" "}
                {p.poolable.toLocaleString()} clean enough to pool.
              </>
            )}
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-foreground/80">
            A small number of hand-verified corrections are applied on top of the
            automatic extraction: one record was removed outright (a metformin
            crossover in which lithium appears only as a renal clearance tracer),
            four antipsychotic studies with lithium only in the background regimen
            were reclassified as &ldquo;lithium + another drug&rdquo;, three
            studies the extraction left as design &ldquo;other&rdquo; were assigned
            their actual designs, and one trial&apos;s weight changes had their sign
            corrected against the original PDF (Abou-Saleh &amp; Coppen 1989 print
            deltas as before-minus-during, so the extraction had every arm&apos;s
            direction reversed). Each correction is keyed to the paper&apos;s DOI
            and documented in the dashboard source.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-foreground/80">
            Pooling is random-effects (DerSimonian–Laird with Hartung–Knapp intervals),
            restricted to lithium-versus-non-lithium comparisons in monotherapy, excluding
            case reports, studies of two or fewer people, serum levels above 1.5 mmol/L
            (toxicity rather than maintenance), and the drinking-water, supplement and
            anorexia strata — which are never pooled with the others because they run in
            different directions.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/birds-eye-reviews/lithium-weight-gain/screening"
              className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
            >
              See the full screening flow &rarr;
            </Link>
            <Link
              href="/birds-eye-reviews/lithium-weight-gain"
              className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
            >
              Browse all {p?.with_weight_outcome ?? 214} studies &rarr;
            </Link>
          </div>
        </Section>

        <p className="mt-10 border-t border-border pt-4 text-xs leading-relaxed text-foreground/50">
          Interim report, generated 28 July 2026, revised 18 August 2026 (arm-level
          exposure analyses, corrected arm counts, hand-verified exclusions).
          Pooled estimates are unadjudicated by a
          human reader and no GRADE certainty ratings have been assigned; given the
          heterogeneity and the dominance of observational designs, most would likely come
          out low or very low. Not medical advice — do not change lithium dosing without
          consulting the prescribing clinician.
        </p>
      </main>
      <Footer />
    </>
  );
}
