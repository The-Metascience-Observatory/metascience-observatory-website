import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DocsBackLink } from "@/components/DocsBackLink";
import { ToolCard } from "../../ToolCard";
import { toolFamilies, TOOLS_PATH } from "../../tools";

const family = toolFamilies.find((f) => f.slug === "image-integrity")!;
const parent = family.tools.find((t) => !t.partOf)!;
const stages = family.tools
  .filter((t) => t.partOf)
  .sort((a, b) => (a.step ?? 0) - (b.step ?? 0));

export const metadata = {
  title: "The Image Analysis Pipeline | The Metascience Observatory",
  description:
    `How the forensic metascience agent screens a paper's figures for duplicated panels: ${stages.length} ` +
    "discrete stages, four detection tiers, and the gates that decide what a match is allowed to mean.",
};

/** The stages that produce candidate matches, versus those that constrain them. */
const PHASES = [
  {
    title: "Getting the panels",
    steps: [1, 2, 3],
    blurb:
      "Before anything can be compared, the pictures have to be found — and the publisher's own furniture has to be taken back out, or every paper in an imprint matches every other one.",
  },
  {
    title: "The four detection tiers",
    steps: [4, 5, 6, 7],
    blurb:
      "Ordered strongest evidence first, each tier handing the next only the pairs it did not already claim. Tier 1 rests on the PDF's own assertion that two pictures are one object; tier 4 rests on recovered geometry. They are not interchangeable, and a finding should always be read with its tier.",
  },
  {
    title: "The gates",
    steps: [8, 9, 10, 11, 12],
    blurb:
      "Most of the engineering. The hard problem is not finding matches — it is refusing the ones that mean nothing: a shared axis label, an instrument overlay, a plot template, a figure that moved pages during typesetting. Every refusal is recorded by name, because a panel excluded here was not examined and cleared, it was not examined.",
  },
];

export default function ImageAnalysisPipelinePage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto max-w-4xl px-4 py-12">
          <DocsBackLink href={TOOLS_PATH} label="return to the toolkit" />

          <h1 className="mb-4 mt-0 text-4xl font-bold leading-tight text-foreground">
            The image analysis pipeline
          </h1>

          <p className="mb-4 leading-relaxed text-foreground">
            The agent&rsquo;s registry exposes image analysis as one tool. Internally it is{" "}
            {stages.length} discrete checks running in a fixed, deterministic order — no model
            chooses among them, and none of them is separately callable. This page documents each
            one in the sequence it runs.
          </p>
          <p className="mb-4 leading-relaxed text-foreground">
            The organising fact is that <em>finding</em> matching pixels is the easy half. A
            journal logo, a scale bar, a shared axis, a TEM instrument overlay and a reused plot
            template all produce perfect matches, and all of them are innocent. Nearly every stage
            after the detection tiers exists to refuse one measured class of false positive, and
            each carries the corpus evidence that put it there.
          </p>
          <p className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-foreground">
            <span className="font-semibold">This pipeline is quarantined.</span> It runs on every
            paper and reports its statistics, but its verdict is withheld — delivered severity is
            always <em>indeterminate</em>, with the uncalibrated grade preserved in a separate
            field. It will stay that way until the pre-registered calibration criteria are met.
            Nothing here should be read as an accusation against any paper.
          </p>

          <h2 className="mb-4 mt-12 border-b border-border pb-2 text-2xl font-semibold text-foreground">
            The registered tool
          </h2>
          <p className="mb-6 leading-relaxed text-foreground">{family.blurb}</p>
          <ToolCard tool={parent} />

          {PHASES.map((phase) => (
            <section key={phase.title}>
              <h2 className="mb-4 mt-12 border-b border-border pb-2 text-2xl font-semibold text-foreground">
                {phase.title}
                <span className="ml-2 align-middle text-sm font-normal text-foreground/45">
                  steps {phase.steps[0]}&ndash;{phase.steps[phase.steps.length - 1]}
                </span>
              </h2>
              <p className="mb-6 leading-relaxed text-foreground">{phase.blurb}</p>
              <div className="space-y-4">
                {stages
                  .filter((t) => phase.steps.includes(t.step ?? 0))
                  .map((tool) => (
                    <ToolCard key={tool.slug} tool={tool} />
                  ))}
              </div>
            </section>
          ))}

          <h2 className="mb-4 mt-12 border-b border-border pb-2 text-2xl font-semibold text-foreground">
            What this pipeline cannot see
          </h2>
          <ul className="mb-8 space-y-2 leading-relaxed text-foreground">
            <li>
              <span className="font-medium">Vector artwork.</span> Coverage is embedded rasters
              only. A chart drawn as linework, or a page flattened to a scan, carries no image
              stream to harvest — so zero findings on a vector-figure paper is coverage absence,
              not cleanliness. Read the panel and skip counts before reading the verdict.
            </li>
            <li>
              <span className="font-medium">Anything outside this paper.</span> Every comparison is
              within one paper and its supplements. Nothing is checked against other papers, other
              authors, or any external image index.
            </li>
            <li>
              <span className="font-medium">Low-texture panels.</span> Western blots and similar
              flat-field images are excluded from the perceptual tiers by design and wait on a
              separately calibrated channel — precisely the material that most often matters.
            </li>
            <li>
              <span className="font-medium">Legitimate re-use, unless it is declared.</span> A
              representative micrograph re-shown and <em>said</em> to be re-shown is not evidence.
              The caption scan and the stated-reuse flag discount those cases, but a paper that
              reuses a panel without saying so is indistinguishable, at the pixel level, from one
              that does so deliberately.
            </li>
          </ul>

          <p className="mt-12 border-t border-border pt-6 text-sm leading-relaxed text-foreground/60">
            Back to{" "}
            <Link
              href={TOOLS_PATH}
              className="underline decoration-foreground/30 underline-offset-2 hover:text-foreground"
            >
              the full toolkit
            </Link>
            , or see{" "}
            <Link
              href="/forensic-metascience-agent/findings"
              className="underline decoration-foreground/30 underline-offset-2 hover:text-foreground"
            >
              the findings the agent has reported
            </Link>
            .
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
