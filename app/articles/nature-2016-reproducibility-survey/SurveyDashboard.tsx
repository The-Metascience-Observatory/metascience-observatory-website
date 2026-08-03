"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import type { SurveyDashboardProps } from "./types";

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

/** Slice label in a text token rather than the slice color. */
const renderPieLabel = ({
  cx,
  cy,
  midAngle,
  outerRadius,
  percent,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  outerRadius: number;
  percent: number;
}) => {
  const RADIAN = Math.PI / 180;
  const r = outerRadius + 18;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      fontSize={12}
      className="fill-foreground/70"
    >
      {`${Math.round((percent ?? 0) * 100)}%`}
    </text>
  );
};

/** Donut for the two part-to-whole opinion questions. */
function OpinionDonut({
  data,
  colors,
}: {
  data: SurveyDashboardProps["crisis"];
  colors: Record<string, string>;
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={data}
          dataKey="pct"
          nameKey="label"
          innerRadius="52%"
          outerRadius="78%"
          paddingAngle={2}
          label={renderPieLabel}
        >
          {data.map((slice) => (
            <Cell key={slice.key} fill={colors[slice.key]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, _name, entry) => [
            `${value}% (${entry.payload.count} of 1,576)`,
            entry.payload.label,
          ]}
        />
        <Legend
          iconType="circle"
          iconSize={9}
          formatter={(value: string) => (
            <span className="text-xs text-foreground/70">{value}</span>
          )}
        />
      </PieChart>
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
          type="number"
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          fontSize={12}
        />
        <YAxis
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

// ── Main dashboard ───────────────────────────────────────────────────
export function SurveyDashboard(props: SurveyDashboardProps) {
  const { summary, publishedAny } = props;

  const publishingSeriesLabels: Record<string, string> = {
    publishedPct: "Published",
    failedToPublishPct: "Tried and failed to publish",
  };

  const disciplineSeriesLabels: Record<string, string> = {
    someoneElsePct: "Someone else's experiment",
    ownPct: "My own experiment",
  };

  // Shared y-scale across the small-multiple panels so shapes are comparable.
  const REPRODUCIBLE_Y_MAX =
    Math.ceil(
      Math.max(...props.reproducibleByDiscipline.flatMap((p) => p.buckets.map((b) => b.pct))) / 5
    ) * 5;

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

      {/* Opinion donuts */}
      <div className="grid md:grid-cols-2 gap-8">
        <ChartSection
          id="reproducibility-crisis"
          title="Is there a reproducibility crisis?"
          subtitle="Which statement about a 'crisis of reproducibility' do you agree with?"
        >
          <OpinionDonut data={props.crisis} colors={CRISIS_COLORS} />
        </ChartSection>
        <ChartSection
          id="established-procedures"
          title="Have you established procedures for reproducibility?"
          subtitle="Share of all respondents, by when the procedures were established"
        >
          <OpinionDonut data={props.procedures} colors={PROCEDURE_COLORS} />
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
                  type="number"
                  domain={[0, 30]}
                  tickFormatter={(v) => `${v}%`}
                  fontSize={12}
                />
                <YAxis type="category" dataKey="label" width={110} fontSize={12} interval={0} />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  formatter={(value: number, name: string) => [
                    pctLabel(value),
                    publishingSeriesLabels[name] ?? name,
                  ]}
                />
                <Legend
                  iconType="circle"
                  iconSize={9}
                  formatter={(value: string) => (
                    <span className="text-xs text-foreground/70">
                      {publishingSeriesLabels[value] ?? value}
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
              type="number"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              fontSize={12}
            />
            <YAxis type="category" dataKey="discipline" width={150} fontSize={12} interval={0} />
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
      </ChartSection>

      {/* Estimated reproducibility of the field, by discipline */}
      <ChartSection
        id="how-much-is-reproducible"
        title="How much published work in your field is reproducible?"
        subtitle="Distribution of answers within each discipline, ordered from most to least confident in the literature. Each panel shows the share of that discipline's respondents giving each estimate."
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
                    dataKey="bucket"
                    fontSize={10}
                    ticks={["0%", "20%", "40%", "60%", "80%", "100%"]}
                    interval={0}
                  />
                  <YAxis
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
          researchers already concerned with the issue. Percentages use all 1,576 respondents as
          the denominator; &ldquo;I can&rsquo;t remember&rdquo; and blank answers count as no.
        </p>
      </div>
    </div>
  );
}
