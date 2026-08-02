import fs from "fs";
import path from "path";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SurveyDashboard } from "./SurveyDashboard";
import type {
  DisciplineFailureBar,
  DisciplineReproducibleDist,
  LikertBar,
  OpinionSlice,
  SurveyDashboardProps,
} from "./types";

export const metadata = {
  title: "Nature's 2016 Reproducibility Survey | The Metascience Observatory",
  description:
    "Interactive dashboard of Nature's 2016 survey of 1,576 researchers on the reproducibility crisis, recomputed from the raw data — including how many researchers have published a replication attempt.",
};

// ── Column indices (0-based) in the raw tab-delimited export ─────────
// The file has two header rows: row 1 is the question text, row 2 the
// sub-question for grid questions. All 1,576 data rows have exactly 118 fields.
const COL = {
  crisisOpinion: 19,
  proportionReproducible: 21,
  proceduresEstablished: 39,
  proceduresWhen: 41,
  contributingFactorsStart: 51, // 51–64, one column per factor
  improvementFactorsStart: 66, // 66–76, one column per factor
  failedOwn: 78,
  failedSomeoneElse: 79,
  publishedSuccessful: 80,
  publishedFailed: 81,
  failedToPublishSuccessful: 82,
  failedToPublishUnsuccessful: 83,
  discipline: 90,
} as const;

// Short chart labels for the 14 "contributes to irreproducibility" grid columns,
// in file order (cols 51–64). Wording condensed from the questionnaire.
const CONTRIBUTING_FACTOR_LABELS = [
  "Fraud",
  "Pressure to publish",
  "Insufficient oversight/mentoring",
  "Insufficient peer review",
  "Selective reporting",
  "Not replicated enough in original lab",
  "Low statistical power or poor analysis",
  "Mistakes in reproduction efforts",
  "Raw data not available from original lab",
  "Methods, code unavailable",
  "Technique requires specialist expertise",
  "Variability of standard reagents",
  "Poor experimental design",
  "Bad luck",
];

// Short chart labels for the 11 "would improve reproducibility" grid columns,
// in file order (cols 66–76).
const IMPROVEMENT_FACTOR_LABELS = [
  "Incentives for formal replication",
  "Incentives for better practice",
  "Better teaching of science students",
  "Better mentorship",
  "Better understanding of statistics",
  "More robust experimental design",
  "More within-lab validation",
  "More external-lab replication",
  "Journal checklists / enforced standards",
  "More time for mentoring",
  "More time checking notebooks, raw data",
];

// The article groups the raw disciplines into six; this mapping reproduces its
// published Ns exactly (e.g. Physics and engineering = 236).
const DISCIPLINE_GROUPS: Record<string, string> = {
  Physics: "Physics and engineering",
  Engineering: "Physics and engineering",
  "Materials Science": "Physics and engineering",
  "Astronomy and planetary science": "Physics and engineering",
  "Earth and Environmental Science": "Earth and environment",
};

// Panel order for the reproducibility-estimate small multiples: most to least
// confident in the literature, matching the article's figure.
const REPRODUCIBLE_PANEL_ORDER = [
  "Chemistry",
  "Physics and engineering",
  "Earth and environment",
  "Biology",
  "Medicine",
  "Other",
];

/** Strip surrounding quotes and non-breaking-space mojibake from a raw cell. */
function clean(cell: string): string {
  return cell.trim().replace(/^"|"$/g, "").replace(/\u00a0/g, " ").trim();
}

function pct(count: number, total: number): number {
  return Math.round((count / total) * 1000) / 10;
}

function processData(): SurveyDashboardProps {
  const filePath = path.join(
    process.cwd(),
    "data/nature_2016_survey_data/Reproducibilitysurveyrawdata20160523.txt"
  );
  const raw = fs.readFileSync(filePath, "utf-8");
  // Two header rows, then one row per respondent; no embedded newlines/tabs.
  const rows = raw
    .split("\n")
    .slice(2)
    .filter((line) => line.trim() !== "")
    .map((line) => line.split("\t"));
  const n = rows.length;
  const cell = (row: string[], col: number) => clean(row[col] ?? "");
  const countYes = (col: number) => rows.filter((r) => cell(r, col) === "Yes").length;

  // ── Crisis opinion ─────────────────────────────────────────────────
  const crisisCounts: Record<string, number> = {};
  for (const r of rows) {
    const v = cell(r, COL.crisisOpinion);
    if (v) crisisCounts[v] = (crisisCounts[v] ?? 0) + 1;
  }
  const crisis: OpinionSlice[] = [
    { key: "significant", label: "Yes, a significant crisis", raw: "There is a significant crisis of reproducibility" },
    { key: "slight", label: "Yes, a slight crisis", raw: "There is a slight crisis of reproducibility" },
    { key: "no_crisis", label: "No, there is no crisis", raw: "There is no crisis of reproducibility" },
    { key: "dont_know", label: "Don't know", raw: "I don't know" },
  ].map(({ key, label, raw: rawLabel }) => ({
    key,
    label,
    count: crisisCounts[rawLabel] ?? 0,
    pct: pct(crisisCounts[rawLabel] ?? 0, n),
  }));

  // ── Procedures for reproducibility ─────────────────────────────────
  // "Yes" answers split by when they were established (col 41); the three
  // "within the last 1/2/5 years" options are combined, as in the article.
  const whenCounts: Record<string, number> = {};
  for (const r of rows) {
    if (cell(r, COL.proceduresEstablished) !== "Yes") continue;
    const v = cell(r, COL.proceduresWhen);
    if (v) whenCounts[v] = (whenCounts[v] ?? 0) + 1;
  }
  const withinFive =
    (whenCounts["Within the last year"] ?? 0) +
    (whenCounts["Within the last 2 years"] ?? 0) +
    (whenCounts["Within the last 5 years"] ?? 0);
  const noProcedures = rows.filter((r) => cell(r, COL.proceduresEstablished) === "No").length;
  const procedures: OpinionSlice[] = [
    { key: "no", label: "No", count: noProcedures, pct: pct(noProcedures, n) },
    {
      key: "within_5",
      label: "Within the past 5 years",
      count: withinFive,
      pct: pct(withinFive, n),
    },
    {
      key: "over_5",
      label: "More than 5 years ago",
      count: whenCounts["Within the last 10 years or longer"] ?? 0,
      pct: pct(whenCounts["Within the last 10 years or longer"] ?? 0, n),
    },
    {
      key: "since_start",
      label: "In place since I started in my lab",
      count: whenCounts["The procedures have been in place since I started working in my lab"] ?? 0,
      pct: pct(whenCounts["The procedures have been in place since I started working in my lab"] ?? 0, n),
    },
  ];

  // ── Publishing replication attempts (the page's headline calculation) ──
  const publishedSuccessful = countYes(COL.publishedSuccessful);
  const publishedFailed = countYes(COL.publishedFailed);
  const failedToPublishSuccessful = countYes(COL.failedToPublishSuccessful);
  const failedToPublishUnsuccessful = countYes(COL.failedToPublishUnsuccessful);
  const publishedAnyCount = rows.filter(
    (r) => cell(r, COL.publishedSuccessful) === "Yes" || cell(r, COL.publishedFailed) === "Yes"
  ).length;
  const publishedBothCount = rows.filter(
    (r) => cell(r, COL.publishedSuccessful) === "Yes" && cell(r, COL.publishedFailed) === "Yes"
  ).length;

  // ── Failed to reproduce, by discipline ─────────────────────────────
  const byDiscipline = new Map<string, { n: number; someoneElse: number; own: number }>();
  for (const r of rows) {
    const rawDiscipline = cell(r, COL.discipline);
    if (!rawDiscipline) continue;
    const group = DISCIPLINE_GROUPS[rawDiscipline] ?? rawDiscipline;
    const entry = byDiscipline.get(group) ?? { n: 0, someoneElse: 0, own: 0 };
    entry.n += 1;
    if (cell(r, COL.failedSomeoneElse) === "Yes") entry.someoneElse += 1;
    if (cell(r, COL.failedOwn) === "Yes") entry.own += 1;
    byDiscipline.set(group, entry);
  }
  const failedByDiscipline: DisciplineFailureBar[] = [...byDiscipline.entries()]
    .map(([discipline, v]) => ({
      discipline,
      n: v.n,
      someoneElsePct: pct(v.someoneElse, v.n),
      ownPct: pct(v.own, v.n),
    }))
    .sort((a, b) => b.someoneElsePct - a.someoneElsePct);

  // ── Estimated % of the field that is reproducible, by discipline ───
  // One small-multiple panel per discipline group; bucket percentages use the
  // discipline's own answered count as the denominator so panels are comparable.
  const estimatesByDiscipline = new Map<string, number[]>();
  for (const r of rows) {
    const rawDiscipline = cell(r, COL.discipline);
    const v = cell(r, COL.proportionReproducible);
    if (!rawDiscipline || !v) continue;
    const group = DISCIPLINE_GROUPS[rawDiscipline] ?? rawDiscipline;
    const estimate = parseInt(v.replace("%", ""), 10);
    if (Number.isNaN(estimate)) continue;
    const list = estimatesByDiscipline.get(group) ?? [];
    list.push(estimate);
    estimatesByDiscipline.set(group, list);
  }
  const reproducibleByDiscipline: DisciplineReproducibleDist[] = REPRODUCIBLE_PANEL_ORDER.filter(
    (d) => estimatesByDiscipline.has(d)
  ).map((discipline) => {
    const values = estimatesByDiscipline.get(discipline)!;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = sorted.length / 2;
    const median =
      sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[Math.floor(mid)];
    return {
      discipline,
      n: values.length,
      median,
      buckets: Array.from({ length: 11 }, (_, i) => {
        const count = values.filter((v) => v === i * 10).length;
        return { bucket: `${i * 10}%`, count, pct: pct(count, values.length) };
      }),
    };
  });

  // ── Likert grids ───────────────────────────────────────────────────
  const likert = (
    startCol: number,
    labels: string[],
    strongValues: string[],
    softValues: string[]
  ): LikertBar[] =>
    labels
      .map((label, i) => {
        const values = rows.map((r) => cell(r, startCol + i));
        const strong = values.filter((v) => strongValues.includes(v)).length;
        const soft = values.filter((v) => softValues.includes(v)).length;
        return { label, strongPct: pct(strong, n), softPct: pct(soft, n) };
      })
      .sort((a, b) => b.strongPct - a.strongPct || b.softPct - a.softPct);

  const contributingFactors = likert(
    COL.contributingFactorsStart,
    CONTRIBUTING_FACTOR_LABELS,
    ["Always contributes", "Very often contributes"],
    ["Sometimes contributes"]
  );
  const improvementFactors = likert(
    COL.improvementFactorsStart,
    IMPROVEMENT_FACTOR_LABELS,
    ["Very likely"],
    ["Likely"]
  );

  return {
    summary: {
      totalRespondents: n,
      significantCrisisPct: crisis[0].pct,
      anyCrisisPct: pct(crisis[0].count + crisis[1].count, n),
      failedSomeoneElsePct: pct(countYes(COL.failedSomeoneElse), n),
      publishedAnyPct: pct(publishedAnyCount, n),
      publishedAnyCount,
    },
    crisis,
    procedures,
    publishing: [
      {
        key: "successful",
        label: "Successful reproduction",
        publishedCount: publishedSuccessful,
        publishedPct: pct(publishedSuccessful, n),
        failedToPublishCount: failedToPublishSuccessful,
        failedToPublishPct: pct(failedToPublishSuccessful, n),
      },
      {
        key: "unsuccessful",
        label: "Unsuccessful reproduction",
        publishedCount: publishedFailed,
        publishedPct: pct(publishedFailed, n),
        failedToPublishCount: failedToPublishUnsuccessful,
        failedToPublishPct: pct(failedToPublishUnsuccessful, n),
      },
    ],
    publishedAny: {
      anyCount: publishedAnyCount,
      anyPct: pct(publishedAnyCount, n),
      successfulCount: publishedSuccessful,
      successfulPct: pct(publishedSuccessful, n),
      failedCount: publishedFailed,
      failedPct: pct(publishedFailed, n),
      bothCount: publishedBothCount,
      bothPct: pct(publishedBothCount, n),
    },
    failedByDiscipline,
    reproducibleByDiscipline,
    contributingFactors,
    improvementFactors,
  };
}

export default function Nature2016SurveyPage() {
  let data: SurveyDashboardProps;
  try {
    data = processData();
  } catch (err) {
    console.error("Failed to process Nature 2016 survey data:", err);
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="pt-20 pb-16">
          <div className="container mx-auto px-4 py-12 max-w-4xl text-center">
            <h1 className="text-3xl font-bold mb-4 text-foreground">Data Unavailable</h1>
            <p className="text-foreground/60">
              The survey data could not be loaded. Please try again later.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <Link
            href="/articles"
            className="text-sm text-foreground/60 hover:text-foreground mb-6 inline-block"
          >
            &larr; Articles
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Nature&rsquo;s 2016 Reproducibility Survey
          </h1>
          <p className="text-foreground/70 max-w-3xl mb-2">
            In 2016, <em>Nature</em> surveyed 1,576 researchers about reproducibility in science
            for the feature{" "}
            <a
              href="https://doi.org/10.1038/533452a"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              &ldquo;1,500 scientists lift the lid on reproducibility&rdquo;
            </a>{" "}
            (Baker, M. <em>Nature</em> 533, 452&ndash;454). The charts below are recomputed
            directly from the{" "}
            <a
              href="https://figshare.com/articles/dataset/Nature_Reproducibility_survey/3394951/1?file=5304313"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              raw survey data
            </a>
            , which is licensed under CC BY 4.0.
          </p>
          <SurveyDashboard {...data} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
