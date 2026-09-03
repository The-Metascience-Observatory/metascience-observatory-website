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
        </div>
      </div>
    </section>
  );
}

export default function SeverityLadderPage() {
  const ladder = getLadder();

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
            Our "Forensic Metascience Agent" tags every finding with a severity score between 1 to 9. This ranking system was developed from the 1-11 severity ranking system developed at the{" "}
            <a
              href="https://the-black-spatula-project.github.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:no-underline"
            >
              Black Spatula Project
            </a>
            .
          </p>

          <p className="mb-8 leading-relaxed text-foreground">
            Two consequences follow. A finding can be certain and still sit low: a typo is a typo
            however sure you are of it. And a finding can be alarming and still be capped, because
            what an individual check is able to <em>establish</em> is bounded by the kind of
            evidence it produces — ceilings that are enforced in code rather than requested in a
            prompt.
          </p>

          <h2 className="mb-6 mt-10 border-b border-border pb-2 text-2xl font-semibold text-foreground">
            The nine rungs
          </h2>

          <div className="space-y-4">
            {ladder.levels.map((level) => (
              <LevelCard key={level.slug} level={level} />
            ))}
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}
