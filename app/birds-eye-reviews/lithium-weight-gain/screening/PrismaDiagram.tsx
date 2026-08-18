import { ReactNode } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";

export interface PrismaCounts {
  sources: string[];
  identified: number;
  deduplicated: number;
  excluded_materials_science: number;
  relevant: number;
  not_retrieved: number;
  retrieved: number;
  screened_fulltext: number;
  screen_parse_failed: number;
  excluded_no_weight_outcome: number;
  has_weight_outcome: number;
  excluded_not_human_lithium: number;
  excluded_not_primary_research: number;
  extractable: number;
  extracted: number;
  with_weight_outcome: number;
  poolable: number;
  study_design_breakdown: Record<string, number>;
  exposure_stratum_breakdown?: Record<string, number>;
  weight_metric_breakdown?: Record<string, number>;
}

function MainBox({ stage, title, n, sub, accent = false }: {
  stage?: string; title: ReactNode; n: number; sub?: string; accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-4 py-3 text-center shadow-sm ${
        accent ? "border-2 border-blue-400 bg-blue-50/60" : "border border-border bg-white"
      }`}
    >
      {stage && (
        <div className="text-[10px] uppercase tracking-wide text-foreground/40 mb-1">{stage}</div>
      )}
      <div className="text-2xl font-bold text-foreground leading-none">{n.toLocaleString()}</div>
      <div className="text-sm text-foreground/80 mt-1">{title}</div>
      {sub && <div className="text-xs text-foreground/50 mt-1">{sub}</div>}
    </div>
  );
}

function ExcludedBox({ items }: { items: { title: string; n: number }[] }) {
  return (
    <div className="flex items-center">
      <div className="hidden md:flex items-center shrink-0 text-foreground/30">
        <div className="h-px w-8 bg-foreground/25" />
        <ArrowRight size={16} className="-ml-1" />
      </div>
      <div className="flex-1 space-y-1 md:ml-1">
        {items.map((it) => (
          <div
            key={it.title}
            className="border border-dashed border-border rounded-lg bg-foreground/[0.03] px-3 py-2 text-left"
          >
            <span className="font-semibold text-foreground/70">{it.n.toLocaleString()}</span>
            <span className="text-xs text-foreground/55"> — {it.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpineArrow() {
  return (
    <div className="flex flex-col items-center text-foreground/30">
      <div className="w-px h-8 bg-foreground/25" />
      <ArrowDown size={18} className="-mt-2" />
    </div>
  );
}

function DownArrow() {
  return (
    <div className="grid md:grid-cols-2">
      <SpineArrow />
    </div>
  );
}

function StageRow({ stage, title, n, sub, excluded, align = "center", accent = false }: {
  stage?: string;
  title: ReactNode;
  n: number;
  sub?: string;
  excluded?: { title: string; n: number }[];
  align?: "center" | "start";
  accent?: boolean;
}) {
  return (
    <div
      className={`grid md:grid-cols-2 gap-3 md:gap-0 ${
        align === "start" ? "items-start" : "items-center"
      }`}
    >
      <MainBox stage={stage} title={title} n={n} sub={sub} accent={accent} />
      <div className="md:pr-2">{excluded ? <ExcludedBox items={excluded} /> : null}</div>
    </div>
  );
}

const DESIGN_LABELS: Record<string, string> = {
  rct: "Randomized controlled trial",
  crossover: "Crossover trial",
  non_randomized_trial: "Non-randomized trial",
  prospective_cohort: "Prospective cohort",
  retrospective_cohort: "Retrospective cohort",
  cross_sectional: "Cross-sectional",
  case_series: "Case series",
  case_report: "Case report",
  case_control: "Case-control",
  ecological: "Ecological",
  before_after: "Before / after",
  other: "Other",
  unclear: "Unclear",
};

const STRATUM_LABELS: Record<string, string> = {
  therapeutic: "Therapeutic (≥300 mg carbonate)",
  low_dose_clinical: "Low-dose clinical",
  supplement: "Supplement / microdose",
  drinking_water: "Drinking water (ecological)",
  anorexia_treatment: "Anorexia (weight gain desired)",
  not_reported: "Not reported",
  unclear: "Unclear",
};

const METRIC_LABELS: Record<string, string> = {
  change_kg: "Weight change (kg)",
  absolute_kg: "Absolute weight (kg)",
  bmi_kg_m2: "BMI (kg/m²)",
  bmi_change: "BMI change",
  percent_change: "Percent change",
  proportion_gaining_7pct: "Proportion gaining ≥7%",
  proportion_gaining_5pct: "Proportion gaining ≥5%",
  waist_cm: "Waist circumference",
  other: "Other / unspecified",
  not_applicable: "Not applicable",
};

function Breakdown({ title, data, labels, note }: {
  title: string;
  data: Record<string, number>;
  labels: Record<string, string>;
  note?: string;
}) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return null;
  const max = rows[0][1];
  return (
    <div className="mt-8">
      <h3 className="text-sm font-medium text-foreground mb-1">{title}</h3>
      {note && <p className="mb-2 text-xs text-foreground/50">{note}</p>}
      <div className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 text-sm">
            <div className="w-56 shrink-0 text-foreground/70">{labels[k] ?? k}</div>
            <div className="h-4 flex-1 rounded bg-foreground/[0.04]">
              <div
                className="h-4 rounded bg-blue-500/40"
                style={{ width: `${(v / max) * 100}%` }}
              />
            </div>
            <div className="w-12 shrink-0 text-right tabular-nums text-foreground/60">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PrismaDiagram({ c }: { c: PrismaCounts }) {
  return (
    <div>
      <div className="flex flex-col">
        <StageRow
          stage="Identification"
          title="Records returned by the searches"
          n={c.identified}
          sub={c.sources.join(" · ")}
          excluded={[
            {
              title: `duplicates across sources (${c.deduplicated.toLocaleString()} unique remained)`,
              n: c.identified - c.deduplicated,
            },
          ]}
          align="start"
        />
        <DownArrow />

        <StageRow
          stage="Deterministic prune"
          title="Unique records after removing materials science"
          n={c.relevant}
          sub="Title + journal filter — no model involved"
          excluded={[
            {
              title:
                "battery / electrochemistry / geology papers — searching “lithium” merges two unrelated literatures",
              n: c.excluded_materials_science,
            },
          ]}
          align="start"
        />
        <DownArrow />

        <StageRow
          stage="Retrieval"
          title="Full texts obtained and converted"
          n={c.retrieved}
          sub={`${Math.round((c.retrieved / c.relevant) * 100)}% of records sought`}
          excluded={[
            {
              title:
                "full text not obtainable (paywalled, pre-digital, or no DOI) — stated openly rather than silently dropped",
              n: c.not_retrieved,
            },
          ]}
          align="start"
        />
        <DownArrow />

        <StageRow
          stage="Eligibility"
          title="Full texts screened"
          n={c.screened_fulltext}
          sub="Every paper read in full — no abstract-level gate"
          excluded={[
            { title: "no weight, BMI or weight-related adverse event reported", n: c.excluded_no_weight_outcome },
            { title: "screen returned no parsable answer", n: c.screen_parse_failed },
          ]}
          align="start"
        />
        <DownArrow />

        <StageRow
          stage="Included"
          title="Report a weight outcome in humans taking lithium"
          n={c.extractable}
          sub="Primary research only"
          excluded={[
            { title: "not humans taking lithium", n: c.excluded_not_human_lithium },
            { title: "review, editorial or news digest, not primary research", n: c.excluded_not_primary_research },
          ]}
          align="start"
        />
        <DownArrow />

        <StageRow
          stage="Extracted"
          title={<>Studies <strong className="font-bold">displayed on dashboard</strong></>}
          accent
          n={c.with_weight_outcome}
          sub={`${c.extracted.toLocaleString()} papers underwent full data extraction`}
          excluded={[
            {
              title:
                "extracted, but the weight signal did not survive as a usable outcome (reported in text only, or no comparison group)",
              n: c.extracted - c.with_weight_outcome,
            },
          ]}
          align="start"
        />
        <DownArrow />

        <StageRow
          stage="Pooled"
          title="Eligible for the meta-analysis"
          n={c.poolable}
          sub="Lithium vs non-lithium, monotherapy, n>2, serum ≤1.5 mmol/L"
        />
      </div>

      <p className="mt-6 max-w-3xl text-xs text-foreground/50">
        The full-text screen <em>is</em> this review&apos;s eligibility pass. An
        abstract-level relevance gate was deliberately skipped: weight is usually
        reported only in a safety table, so an abstract screen would reject
        exactly the papers the review exists to find — a false negative that no
        later stage can recover.
      </p>

      <Breakdown
        title="Study designs among eligible papers"
        data={c.study_design_breakdown}
        labels={DESIGN_LABELS}
      />
      {c.exposure_stratum_breakdown && (
        <Breakdown
          title="Exposure strata"
          data={c.exposure_stratum_breakdown}
          labels={STRATUM_LABELS}
          note="Never pooled together: drinking-water studies associate higher lithium with LOWER obesity, and anorexia trials give lithium in order to induce weight gain."
        />
      )}
      {c.weight_metric_breakdown && (
        <Breakdown
          title="How weight was measured"
          data={c.weight_metric_breakdown}
          labels={METRIC_LABELS}
          note="Continuous kg and “proportion gaining ≥7%” are different questions — the disagreement between the two is the central finding of this literature, so they are never merged."
        />
      )}
    </div>
  );
}
