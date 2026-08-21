import fs from "fs";
import path from "path";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DocsBackLink } from "@/components/DocsBackLink";

export const metadata = {
  title: "The Severity Ladder | The Metascience Observatory",
  description:
    "The 1–9 scale the forensic metascience agent assigns to every finding, defined by what a " +
    "journal would do about it: from a cosmetic slip to extreme misconduct.",
};

interface Level {
  n: number;
  slug: string;
  label: string;
  web_summary: string;
  finding_rubric: string;
  correction_outcome: string;
  boundaries: string[];
  colors: { light: string; dark: string };
}

interface Ladder {
  ladder_version: string;
  levels: Level[];
  caps: {
    accusatory_min: number;
    adjudicator_max_default: number;
    adjudicator_max_manipulation: number;
    agent_code: number;
    fast_screen: number;
    model_knowledge: number;
    pipeline_max: number;
    quarantine: number;
    provisional: Record<string, number>;
  };
  five_to_nine: Record<string, number>;
  outcome_from_five: Record<string, string>;
}

function getLadder(): Ladder {
  const p = path.join(process.cwd(), "data/forensic_severity_ladder.json");
  return JSON.parse(fs.readFileSync(p, "utf-8")) as Ladder;
}

/** "Down to 3 if: the error is in the reporting" -> ["Down to 3", "the error is..."]. */
function splitBoundary(b: string): [string, string] {
  const m = /^(.*?)\s+if:\s*(.*)$/.exec(b);
  return m ? [m[1], m[2]] : ["", b];
}

function LevelCard({ level }: { level: Level }) {
  const accent = level.colors.light;
  return (
    <section
      id={level.slug}
      className="scroll-mt-24 rounded-lg border border-border bg-white"
      style={{ borderLeft: `6px solid ${accent}` }}
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row">
        <div className="flex shrink-0 sm:w-24 sm:flex-col sm:items-center">
          <span
            className="font-clarendon text-5xl font-bold leading-none"
            style={{ color: accent }}
          >
            {level.n}
          </span>
        </div>

        <div className="min-w-0">
          <h3 className="font-clarendon text-lg font-semibold leading-snug text-foreground">
            {level.label}
          </h3>
          <p className="mt-1 text-sm font-medium" style={{ color: accent }}>
            {level.web_summary}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-foreground/85">
            {level.finding_rubric}
          </p>

          <p className="mt-3 text-xs text-foreground/60">
            <span className="font-semibold uppercase tracking-wide text-foreground/45">
              If confirmed and alone
            </span>
            {" — "}
            {level.correction_outcome}
          </p>

          {level.boundaries.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
              {level.boundaries.map((b) => {
                const [rule, condition] = splitBoundary(b);
                return (
                  <li key={b} className="flex flex-wrap gap-x-2 text-xs leading-relaxed">
                    <span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground/70">
                      {rule}
                    </span>
                    <span className="min-w-0 flex-1 text-foreground/70">{condition}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function CapRow({ name, value, note }: { name: string; value: number; note: string }) {
  return (
    <tr className="border-t border-border align-top">
      <td className="py-2.5 pr-4 font-mono text-xs text-foreground">{name}</td>
      <td className="py-2.5 pr-4 text-center font-clarendon text-base font-semibold text-foreground">
        {value}
      </td>
      <td className="py-2.5 text-sm leading-relaxed text-foreground/75">{note}</td>
    </tr>
  );
}

export default function SeverityLadderPage() {
  const ladder = getLadder();
  const { caps, five_to_nine, outcome_from_five } = ladder;

  // Glosses for the cap constants. Kept beside the numbers rather than in the
  // JSON: the file is the agent's source of truth for the VALUES, and it
  // carries no prose for them.
  const evidenceCaps: Array<[string, number, string]> = [
    ["absolute", caps.provisional.absolute, "A check whose maths admits no other reading — a mean that cannot arise from the reported n, a total that does not add up."],
    ["probabilistic", caps.provisional.probabilistic, "A check that says a pattern is unlikely, not impossible. Unlikely is never proof."],
    ["descriptive", caps.provisional.descriptive, "A check that reports a property without judging it."],
    ["not_computational", caps.provisional.not_computational, "A finding no tool could have produced — a contradiction a reader sees by reading."],
    ["no_tool_exists", caps.provisional.no_tool_exists, "The claim is checkable in principle, but nothing in the toolkit checks it."],
    ["tool_existed_unused", caps.provisional.tool_existed_unused, "A tool could have settled it and was not run, so the finding rests on reading alone."],
  ];

  const channelCaps: Array<[string, number, string]> = [
    ["agent_code", caps.agent_code, "Analysis the agent wrote itself. It can support an argument for a correction; it can never establish the impossible."],
    ["fast_screen", caps.fast_screen, "A screen is a funnel, not evidence — it decides what to look at, not what is true."],
    ["model_knowledge", caps.model_knowledge, "A factual claim from the model's memory with no recorded lookup behind it."],
    ["quarantine", caps.quarantine, "A detector whose precision has not been measured. Its findings stay visible but never headline."],
  ];

  const ceilings: Array<[string, number, string]> = [
    ["adjudicator_max_default", caps.adjudicator_max_default, "The adjudicator's ordinary ceiling."],
    ["adjudicator_max_manipulation", caps.adjudicator_max_manipulation, "Reachable only through the manipulation gate: positive evidence of manipulation, never mere improbability."],
    ["pipeline_max", caps.pipeline_max, "Nothing machine-assigned exceeds 8. Level 9 is a human's call, recorded through review."],
    ["accusatory_min", caps.accusatory_min, "At and above this a finding is accusation-grade: it must carry a verified quote or a validated tool verdict. Levels 1–2 are record-keeping, not accusations."],
  ];

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto max-w-4xl px-4 py-12">
          <DocsBackLink
            href="/forensic-metascience-agent"
            label="return to the forensic metascience agent"
          />

          <h1 className="mb-4 mt-0 text-4xl font-bold leading-tight text-foreground">
            The severity ladder
          </h1>

          <p className="mb-4 leading-relaxed text-foreground">
            Every finding the agent reports carries a severity from 1 to 9. The number is not a
            measure of how confident the agent is, and not a measure of how unusual the statistic
            looks. It answers one question: <em>if this finding were confirmed, and it were the
            only thing wrong with the paper, what would the journal have to do about it?</em> That
            is why the rungs are named after outcomes — an erratum, a corrigendum, a retraction —
            rather than after feelings about the paper.
          </p>

          <p className="mb-8 leading-relaxed text-foreground">
            Two consequences follow. A finding can be certain and still sit low: a typo is a typo
            however sure you are of it. And a finding can be alarming and still be capped, because
            what an individual check is able to <em>establish</em> is bounded by the kind of
            evidence it produces — the ceilings are listed further down, and they are enforced in
            code rather than requested in a prompt.
          </p>

          <h2 className="mb-6 mt-10 border-b border-border pb-2 text-2xl font-semibold text-foreground">
            The nine rungs
          </h2>

          <div className="space-y-4">
            {ladder.levels.map((level) => (
              <LevelCard key={level.slug} level={level} />
            ))}
          </div>

          <h2 className="mb-4 mt-12 border-b border-border pb-2 text-2xl font-semibold text-foreground">
            What a check is allowed to claim
          </h2>

          <p className="mb-6 leading-relaxed text-foreground">
            A producer proposes a severity; it does not get the last word. Every proposal is
            clamped by the kind of evidence behind it, and the clamps compose — a finding takes the
            lowest ceiling that applies to it. The point is that no prompt can talk a check into
            claiming more than its method supports.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wide text-foreground/45">
                    Evidence class
                  </th>
                  <th className="pb-2 pr-4 text-center text-xs font-semibold uppercase tracking-wide text-foreground/45">
                    Max
                  </th>
                  <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-foreground/45">
                    What it means
                  </th>
                </tr>
              </thead>
              <tbody>
                {evidenceCaps.map(([name, value, note]) => (
                  <CapRow key={name} name={name} value={value} note={note} />
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mb-3 mt-8 text-xl font-semibold text-foreground">
            Caps on how the finding was produced
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <tbody>
                {channelCaps.map(([name, value, note]) => (
                  <CapRow key={name} name={name} value={value} note={note} />
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mb-3 mt-8 text-xl font-semibold text-foreground">
            Ceilings on the whole pipeline
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <tbody>
                {ceilings.map(([name, value, note]) => (
                  <CapRow key={name} name={name} value={value} note={note} />
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mb-4 mt-12 border-b border-border pb-2 text-2xl font-semibold text-foreground">
            From a check&rsquo;s verdict to a rung
          </h2>

          <p className="mb-6 leading-relaxed text-foreground">
            Each tool returns one of five outcomes rather than a number. Those five map onto the
            ladder, and onto whether the paper-level result counts the finding as a problem at all.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground/45">
                Outcome &rarr; severity
              </p>
              <ul className="space-y-2">
                {Object.entries(five_to_nine).map(([outcome, n]) => (
                  <li key={outcome} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-mono text-xs text-foreground/80">{outcome}</span>
                    <span className="font-clarendon text-base font-semibold text-foreground">
                      {n}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-foreground/60">
                The two non-accusatory outcomes — <span className="font-mono">consistent</span> and{" "}
                <span className="font-mono">indeterminate</span> — get no severity at all.
              </p>
            </div>

            <div className="rounded-lg border border-border p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground/45">
                Outcome &rarr; how it is counted
              </p>
              <ul className="space-y-2">
                {Object.entries(outcome_from_five).map(([outcome, bucket]) => (
                  <li key={outcome} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-mono text-xs text-foreground/80">{outcome}</span>
                    <span className="text-foreground/70">{bucket}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-foreground/60">
                A check that ran and found nothing is a{" "}
                <span className="font-mono">pass</span>, and is reported as such — silence and
                &ldquo;we did not look&rdquo; are different facts.
              </p>
            </div>
          </div>

          <p className="mt-10 border-t border-border pt-4 text-xs text-foreground/50">
            Ladder version {ladder.ladder_version}. This page is generated from{" "}
            <span className="font-mono">severity_ladder.json</span>, the same file the agent reads
            at run time, so the rungs and ceilings shown here are the ones that actually applied.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
