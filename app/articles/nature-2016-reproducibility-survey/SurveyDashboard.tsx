"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import type { DisciplineCrisisBar, DisciplineProceduresBar, DisciplinePublishingStats, OpinionSlice, PublishingBar, SurveyDashboardProps } from "./types";

// ── Color constants ──────────────────────────────────────────────────
// Categorical pairs and the one-hue ordinal ramp were validated with the
// dataviz palette checker (CVD separation, lightness band, contrast) in
// both light and dark modes.
const BLUE = "#2a78d6"; // primary series
const ORANGE = "#eb6834"; // second series in grouped bars
const RED = "#e34948"; // "tried and failed to publish"
const BLUE_DARK = "#1c5cab"; // ordinal ramp, strongest step
const BLUE_MID = "#5598e7";
const BLUE_LIGHT = "#86b6ef"; // ordinal ramp, lightest step (2.06:1 on light surface)
const GRAY = "#94a3b8"; // "don't know" / "no"
const AXIS_COLOR = "#000000";
const AXIS_STYLE = {
  stroke: AXIS_COLOR,
  tick: { fill: AXIS_COLOR },
  axisLine: { stroke: AXIS_COLOR },
  tickLine: { stroke: AXIS_COLOR },
};

const CRISIS_COLORS: Record<string, string> = {
  significant: BLUE_DARK,
  slight: BLUE_MID,
  no_crisis: BLUE_LIGHT,
  dont_know: GRAY,
};

const PROCEDURE_COLORS: Record<string, string> = {
  no: GRAY,
  within_5: BLUE_LIGHT,
  over_5: BLUE_MID,
  since_start: BLUE_DARK,
};

const pctLabel = (v: number) => `${v.toFixed(1)}%`;

const PUBLISHING_SERIES_LABELS: Record<string, string> = {
  publishedPct: "Published",
  failedToPublishPct: "Tried and failed to publish",
};

// ── Shared building blocks ───────────────────────────────────────────
function ChartSection({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-24">
      <h3 className="group font-semibold text-lg text-foreground">
        {title}{" "}
        <a
          href={`#${id}`}
          aria-label={`Link to section: ${title}`}
          className="text-foreground/40 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:text-foreground"
        >
          #
        </a>
      </h3>
      {subtitle && <p className="text-sm text-foreground/50 mb-3">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <Card className="p-4 md:p-5">
      <div className="text-3xl font-bold text-foreground">{value}</div>
      <div className="text-sm text-foreground/60 mt-1">{label}</div>
    </Card>
  );
}

/** Horizontal response distributions, with counts normalized to 100% per field. */
function StackedFieldChart({
  data,
  options,
  colors,
}: {
  data: (DisciplineCrisisBar | DisciplineProceduresBar)[];
  options: OpinionSlice[];
  colors: Record<string, string>;
}) {
  return (
    <ResponsiveContainer width="100%" height={data.length * 50 + 90}>
      <BarChart
        data={data}
        layout="vertical"
        stackOffset="expand"
        margin={{ left: 0, right: 20, top: 5, bottom: 5 }}
        barCategoryGap="22%"
      >
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
        <XAxis
          {...AXIS_STYLE}
          type="number"
          domain={[0, 1]}
          ticks={[0, 0.25, 0.5, 0.75, 1]}
          tickFormatter={(value) => `${Math.round(value * 100)}%`}
          fontSize={12}
        />
        <YAxis
          {...AXIS_STYLE}
          type="category"
          dataKey="discipline"
          width={160}
          fontSize={12}
          interval={0}
          tickFormatter={(label: string) => `${label} (n = ${data.find((row) => row.discipline === label)?.n})`}
        />
        <Tooltip
          cursor={{ fill: "transparent" }}
          formatter={(value: number, name: string, entry) => {
            const row = entry.payload as (typeof data)[number];
            return [`${pctLabel((value / row.n) * 100)} (${value} of ${row.n})`, name];
          }}
        />
        <Legend
          iconType="circle"
          iconSize={9}
          formatter={(value: string) => <span className="text-xs text-foreground/70">{value}</span>}
        />
        {options.map((option, index) => (
          <Bar
            key={option.key}
            dataKey={option.key}
            name={option.label}
            stackId="responses"
            fill={colors[option.key]}
            radius={index === options.length - 1 ? [0, 4, 4, 0] : 0}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Stacked horizontal Likert chart (contributing factors / improvements). */
function LikertChart({
  data,
  strongLabel,
  softLabel,
  strongColor,
  softColor,
}: {
  data: SurveyDashboardProps["contributingFactors"];
  strongLabel: string;
  softLabel: string;
  strongColor: string;
  softColor: string;
}) {
  const seriesLabels: Record<string, string> = {
    strongPct: strongLabel,
    softPct: softLabel,
  };
  return (
    <ResponsiveContainer width="100%" height={data.length * 34 + 60}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 10, right: 30, top: 5, bottom: 5 }}
        barCategoryGap="25%"
      >
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
        <XAxis
          {...AXIS_STYLE}
          type="number"
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          fontSize={12}
        />
        <YAxis
          {...AXIS_STYLE}
          type="category"
          dataKey="label"
          width={230}
          fontSize={12}
          interval={0}
        />
        <Tooltip
          cursor={{ fill: "transparent" }}
          formatter={(value: number, name: string) => [
            pctLabel(value),
            seriesLabels[name] ?? name,
          ]}
        />
        <Legend
          iconType="circle"
          iconSize={9}
          formatter={(value: string) => (
            <span className="text-xs text-foreground/70">
              {seriesLabels[value] ?? value}
            </span>
          )}
        />
        <Bar dataKey="strongPct" stackId="a" fill={strongColor} />
        <Bar dataKey="softPct" stackId="a" fill={softColor} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function PublishingByDisciplineChart({
  data,
  outcome,
  xMax,
}: {
  data: DisciplinePublishingStats[];
  outcome: PublishingBar["key"];
  xMax: number;
}) {
  const rows = data
    .map((row) => ({ discipline: row.discipline, n: row.n, ...row[outcome] }))
    .sort((a, b) => b.publishedPct - a.publishedPct || a.discipline.localeCompare(b.discipline));
  return (
    <div>
      <h4 className="text-sm font-medium text-foreground mb-2">
        {outcome === "successful" ? "Successful reproduction" : "Unsuccessful reproduction"}
      </h4>
      <ResponsiveContainer width="100%" height={rows.length * 56 + 65}>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ left: 0, right: 15, top: 5, bottom: 5 }}
          barCategoryGap="25%"
          barGap={0}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
          <XAxis
            {...AXIS_STYLE}
            type="number"
            domain={[0, xMax]}
            tickFormatter={(value) => `${value}%`}
            fontSize={12}
          />
          <YAxis
            {...AXIS_STYLE}
            type="category"
            dataKey="discipline"
            width={160}
            fontSize={12}
            interval={0}
            tickFormatter={(label: string) => `${label} (n = ${rows.find((row) => row.discipline === label)?.n})`}
          />
          <Tooltip
            cursor={{ fill: "transparent" }}
            formatter={(value: number, name: string, entry) => {
              const row = entry.payload as (typeof rows)[number];
              const count = name === "publishedPct" ? row.publishedCount : row.failedToPublishCount;
              return [`${pctLabel(value)} (${count} of ${row.n})`, PUBLISHING_SERIES_LABELS[name] ?? name];
            }}
          />
          <Legend
            iconType="circle"
            iconSize={9}
            formatter={(value: string) => (
              <span className="text-xs text-foreground/70">
                {PUBLISHING_SERIES_LABELS[value] ?? value}
              </span>
            )}
          />
          <Bar dataKey="publishedPct" fill={BLUE} radius={[0, 4, 4, 0]} />
          <Bar dataKey="failedToPublishPct" fill={RED} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main dashboard ───────────────────────────────────────────────────
export function SurveyDashboard(props: SurveyDashboardProps) {
  const { summary, publishedAny } = props;

  const disciplineSeriesLabels: Record<string, string> = {
    someoneElsePct: "Someone else's experiment",
    ownPct: "My own experiment",
  };

  // Shared y-scale across the small-multiple panels so shapes are comparable.
  const REPRODUCIBLE_Y_MAX =
    Math.ceil(
      Math.max(...props.reproducibleByDiscipline.flatMap((p) => p.buckets.map((b) => b.pct))) / 5
    ) * 5;

  const PUBLISHING_X_MAX = Math.max(10, Math.ceil(Math.max(
    ...props.publishingByDiscipline.flatMap((row) => [
      row.successful.publishedPct,
      row.successful.failedToPublishPct,
      row.unsuccessful.publishedPct,
      row.unsuccessful.failedToPublishPct,
    ])
  ) / 10) * 10);

  return (
    <div className="space-y-12 mt-8">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          value={summary.totalRespondents.toLocaleString()}
          label="researchers surveyed"
        />
        <StatTile
          value={`${Math.round(summary.anyCrisisPct)}%`}
          label="say there is a significant or slight reproducibility crisis"
        />
        <StatTile
          value={`${Math.round(summary.failedSomeoneElsePct)}%`}
          label="have tried and failed to reproduce another scientist's experiment"
        />
        <StatTile
          value={`${Math.round(summary.publishedAnyPct)}%`}
          label="have published a replication attempt (successful or failed)"
        />
      </div>

      {/* Crisis opinions, replication experience, and reproducibility procedures */}
      <div className="space-y-8">
        <ChartSection
          id="reproducibility-crisis"
          title="Is there a reproducibility crisis?"
          subtitle="Which statement about a 'crisis of reproducibility' do you agree with? Each bar shows the response distribution and adds to 100%."
        >
          <StackedFieldChart
            data={props.crisisByDiscipline}
            options={props.crisis}
            colors={CRISIS_COLORS}
          />
          <p className="text-xs text-foreground/60 mt-3 max-w-3xl">
            Fields use the same groups as the publishing breakdown below, including Physics
            and engineering combined and Other split into Psychology &amp; social sciences and Other.
            Overall includes all {summary.totalRespondents.toLocaleString()} respondents.
          </p>
        </ChartSection>
        {/* Failed to reproduce by discipline */}
        <ChartSection
          id="failed-to-reproduce"
          title="Have you failed to reproduce an experiment?"
          subtitle="Share answering yes, by discipline &mdash; most scientists have experienced failure to reproduce results"
        >
          <ResponsiveContainer width="100%" height={props.failedByDiscipline.length * 56 + 60}>
            <BarChart
              data={props.failedByDiscipline}
              layout="vertical"
              margin={{ left: 10, right: 30, top: 5, bottom: 5 }}
              barCategoryGap="25%"
              barGap={0}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
              <XAxis
                {...AXIS_STYLE}
                type="number"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                fontSize={12}
              />
              <YAxis {...AXIS_STYLE} type="category" dataKey="discipline" width={150} fontSize={12} interval={0} />
              <Tooltip
                cursor={{ fill: "transparent" }}
                formatter={(value: number, name: string) => [
                  pctLabel(value),
                  disciplineSeriesLabels[name] ?? name,
                ]}
                labelFormatter={(label: string) => {
                  const row = props.failedByDiscipline.find((d) => d.discipline === label);
                  return row ? `${label} (n = ${row.n})` : label;
                }}
              />
              <Legend
                iconType="circle"
                iconSize={9}
                formatter={(value: string) => (
                  <span className="text-xs text-foreground/70">
                    {disciplineSeriesLabels[value] ?? value}
                  </span>
                )}
              />
              <Bar dataKey="someoneElsePct" fill={BLUE} radius={[0, 4, 4, 0]} />
              <Bar dataKey="ownPct" fill={ORANGE} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p id="discipline-grouping" className="text-xs text-foreground/60 mt-3 max-w-3xl">
            In the experiment-failure and reproducibility-estimate charts, Physics &amp; astronomy combines physics with astronomy
            and planetary science; Engineering and Materials science are shown separately.
            Psychology &amp; social sciences groups write-in responses
            for psychology, cognitive science, economics, sociology, anthropology, political science, linguistics,
            communication, education and related fields from the survey&rsquo;s original
            &ldquo;Other&rdquo; category. Mixed responses naming these fields are included;
            neuroscience-only responses remain in Other.
          </p>
        </ChartSection>

        <ChartSection
          id="established-procedures"
          title="Have you established procedures for reproducibility?"
          subtitle="Share of respondents in each field, by when procedures were established. Each bar adds to 100%."
        >
          <StackedFieldChart
            data={props.proceduresByDiscipline}
            options={props.procedures}
            colors={PROCEDURE_COLORS}
          />
          <p className="text-xs text-foreground/60 mt-3 max-w-3xl">
            Overall includes all {summary.totalRespondents.toLocaleString()} respondents.
            Fields use the same groups as the crisis and publishing breakdowns.
          </p>
        </ChartSection>
      </div>

      {/* Publishing replication attempts */}
      <ChartSection
        id="publishing-replication-attempts"
        title="Publishing replication attempts"
        subtitle="Have you ever tried to publish a reproduction attempt? Share of all 1,576 respondents"
      >
        <div className="grid md:grid-cols-5 gap-6 items-center">
          <div className="md:col-span-3">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={props.publishing}
                layout="vertical"
                margin={{ left: 10, right: 45, top: 5, bottom: 5 }}
                barCategoryGap="25%"
                barGap={0}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
                <XAxis
                  {...AXIS_STYLE}
                  type="number"
                  domain={[0, 30]}
                  tickFormatter={(v) => `${v}%`}
                  fontSize={12}
                />
                <YAxis {...AXIS_STYLE} type="category" dataKey="label" width={110} fontSize={12} interval={0} />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  formatter={(value: number, name: string) => [
                    pctLabel(value),
                    PUBLISHING_SERIES_LABELS[name] ?? name,
                  ]}
                />
                <Legend
                  iconType="circle"
                  iconSize={9}
                  formatter={(value: string) => (
                    <span className="text-xs text-foreground/70">
                      {PUBLISHING_SERIES_LABELS[value] ?? value}
                    </span>
                  )}
                />
                <Bar dataKey="publishedPct" fill={BLUE} radius={[0, 4, 4, 0]}>
                  <LabelList
                    dataKey="publishedPct"
                    position="right"
                    formatter={(v: number) => pctLabel(v)}
                    className="fill-foreground"
                    fontSize={12}
                  />
                </Bar>
                <Bar dataKey="failedToPublishPct" fill={RED} radius={[0, 4, 4, 0]}>
                  <LabelList
                    dataKey="failedToPublishPct"
                    position="right"
                    formatter={(v: number) => pctLabel(v)}
                    className="fill-foreground"
                    fontSize={12}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Card className="md:col-span-2 p-5 bg-muted/40">
            <div className="text-4xl font-bold text-foreground">
              {publishedAny.anyPct.toFixed(1)}%
            </div>
            <p className="text-sm text-foreground/70 mt-2">
              of researchers ({publishedAny.anyCount.toLocaleString()} of 1,576) have published a
              replication attempt of some kind.
            </p>
          </Card>
        </div>
      </ChartSection>

      <ChartSection
        id="publishing-replication-attempts-by-field"
        title="Publishing replication attempts by field"
        subtitle="Share of respondents in each field, ordered from highest to lowest published percentage in each panel. Successful and unsuccessful refer to the replication outcome."
      >
        <div className="grid lg:grid-cols-2 gap-8">
          <PublishingByDisciplineChart
            data={props.publishingByDiscipline}
            outcome="successful"
            xMax={PUBLISHING_X_MAX}
          />
          <PublishingByDisciplineChart
            data={props.publishingByDiscipline}
            outcome="unsuccessful"
            xMax={PUBLISHING_X_MAX}
          />
        </div>
        <p className="text-xs text-foreground/60 mt-3 max-w-3xl">
          Fields follow Nature&rsquo;s original chart groups, including a combined Physics
          and engineering group. Other is split using the{" "}
          <a href="#discipline-grouping" className="underline hover:text-foreground">
            write-in areas of interest
          </a>
          . Each percentage uses all respondents in that field; a respondent can report
          more than one publication experience.
        </p>
      </ChartSection>

      {/* Estimated reproducibility of the field, by discipline */}
      <ChartSection
        id="how-much-is-reproducible"
        title="How much published work in your field is reproducible?"
        subtitle="Distribution of answers within each discipline. Each panel shows the share of that discipline's respondents giving each estimate."
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
          {props.reproducibleByDiscipline.map((panel) => (
            <div key={panel.discipline}>
              <div className="text-sm font-medium text-foreground">{panel.discipline}</div>
              <div className="text-xs text-foreground/50 mb-1">
                n = {panel.n} &middot; median estimate {panel.median}%
              </div>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart
                  data={panel.buckets}
                  margin={{ left: -20, right: 5, top: 5, bottom: 0 }}
                  barCategoryGap="20%"
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                  <XAxis
                    {...AXIS_STYLE}
                    dataKey="bucket"
                    fontSize={10}
                    ticks={["0%", "20%", "40%", "60%", "80%", "100%"]}
                    interval={0}
                  />
                  <YAxis
                    {...AXIS_STYLE}
                    fontSize={10}
                    domain={[0, REPRODUCIBLE_Y_MAX]}
                    ticks={Array.from(
                      { length: REPRODUCIBLE_Y_MAX / 5 + 1 },
                      (_, i) => i * 5
                    )}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Bar dataKey="pct" fill={BLUE} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      </ChartSection>

      {/* Likert grids */}
      <ChartSection
        id="contributing-factors"
        title="What factors contribute to irreproducible research?"
        subtitle="Share of all respondents rating each factor's contribution to failures to reproduce"
      >
        <LikertChart
          data={props.contributingFactors}
          strongLabel="Always / very often contributes"
          softLabel="Sometimes contributes"
          strongColor={BLUE}
          softColor={BLUE_LIGHT}
        />
      </ChartSection>

      <ChartSection
        id="what-would-improve"
        title="What would improve reproducibility?"
        subtitle="Share of all respondents rating how likely each approach is to improve reproducibility"
      >
        <LikertChart
          data={props.improvementFactors}
          strongLabel="Very likely"
          softLabel="Likely"
          strongColor={BLUE}
          softColor={BLUE_LIGHT}
        />
      </ChartSection>

      {/* Methodology note */}
      <div className="text-sm text-foreground/60 border-t border-border pt-6 space-y-2">
        <p>
          <span className="font-semibold text-foreground/80">Source:</span> Baker, M.{" "}
          &ldquo;1,500 scientists lift the lid on reproducibility.&rdquo; <em>Nature</em> 533,
          452&ndash;454 (2016).{" "}
          <a
            href="https://doi.org/10.1038/533452a"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            doi:10.1038/533452a
          </a>
          . All figures on this page are computed from the{" "}
          <a
            href="https://figshare.com/articles/dataset/Nature_Reproducibility_survey/3394951/1?file=5304313"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            raw survey data
          </a>{" "}
          released alongside the article.
        </p>
        <p>
          <span className="font-semibold text-foreground/80">Caveat:</span> the survey was e-mailed
          to <em>Nature</em> readers and advertised on affiliated websites and social media as
          being about reproducibility, so the sample is self-selected and likely over-represents
          researchers already concerned with the issue.  For yes/no questions, &ldquo;I can&rsquo;t remember&rdquo; and blank answers count as no.
        </p>
      </div>
    </div>
  );
}
