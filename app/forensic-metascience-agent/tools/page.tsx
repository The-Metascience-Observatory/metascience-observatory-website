import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DocsBackLink } from "@/components/DocsBackLink";
import { ToolCard } from "../ToolCard";
import {
  catalogueFamilies,
  listedTools,
  REGISTRY_TOOL_COUNT,
  type ToolFamily,
} from "../tools";

export const metadata = {
  title: "The Toolkit | The Metascience Observatory",
  description:
    `The ${listedTools} forensic tools the metascience agent can call: what each one checks, ` +
    "how it works, what it takes in, what it returns, and where the method was published.",
};

function FamilySection({ family }: { family: ToolFamily }) {
  return (
    <section id={family.slug} className="scroll-mt-24">
      <h2 className="mb-4 mt-12 border-b border-border pb-2 text-2xl font-semibold text-foreground">
        {family.title}
        <span className="ml-2 align-middle text-sm font-normal text-foreground/45">
          {family.tools.length} {family.tools.length === 1 ? "tool" : "tools"}
        </span>
      </h2>
      <p className="mb-6 leading-relaxed text-foreground">{family.blurb}</p>
      <div className="space-y-4">
        {family.tools.map((tool) => (
          <ToolCard key={tool.slug} tool={tool} />
        ))}
      </div>
    </section>
  );
}

export default function ToolsPage() {
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
            The toolkit
          </h1>

          <p className="mb-4 leading-relaxed text-foreground">
            This page documents {listedTools} of the forensic metascience agent&rsquo;s tools. Every one is
            a deterministic function, not a language model: it takes numbers the paper already
            printed, does arithmetic, and returns a structured result with a severity. The agent
            chooses <em>which</em> tools to point at a paper and how to read what comes back — it
            never decides what a check concludes.
          </p>
          <p className="mb-4 leading-relaxed text-foreground">
            None of these need the raw data. That is the point of the field: a paper's own summary
            statistics constrain each other tightly enough that fabrication and error leave traces
            in the numbers as published.
          </p>
          <p className="mb-4 leading-relaxed text-foreground">
            The agent&rsquo;s registry holds {REGISTRY_TOOL_COUNT} tools. The ones not listed here
            are left out on purpose, and for three different reasons. Ten read PDFs, publisher XML,
            HTML and supplementary files into checkable numbers &mdash; that is how the figures are
            obtained, not a check on them. The image-integrity screen is a pipeline of twelve
            discrete stages rather than a single check, so it has{" "}
            <Link
              href="/forensic-metascience-agent/tools/image-analysis"
              className="underline decoration-foreground/30 underline-offset-2 hover:text-primary"
            >
              its own page
            </Link>
            {". "}
            And the tortured-phrases screen is withheld while it remains quarantined behind a seed
            dictionary &mdash; it runs, but it is not yet calibrated enough to describe as a working
            check.
          </p>
          <p className="mb-8 leading-relaxed text-foreground">
            Each card below states the worst verdict its tool can deliver. That ceiling is a real
            limit, not a formality — most of these tools <em>refuse</em> rather than guess when a
            premise they depend on is missing, and several are capped below what their arithmetic
            would technically license because an innocent explanation always remains. Two are
            marked <span className="font-medium">quarantined</span>: they run, but the pipeline
            deliberately withholds their verdicts until their calibration criteria are met.
          </p>

          <nav aria-label="Tool families" className="mb-4 flex flex-wrap gap-2">
            {catalogueFamilies.map((family) => (
              <a
                key={family.slug}
                href={`#${family.slug}`}
                className="rounded border border-border bg-white px-2.5 py-1 text-xs font-medium text-foreground/70 transition-colors hover:border-primary hover:text-primary"
              >
                {family.shortTitle}
                <span className="ml-1.5 text-foreground/40">{family.tools.length}</span>
              </a>
            ))}
          </nav>

          {catalogueFamilies.map((family) => (
            <FamilySection key={family.slug} family={family} />
          ))}

          <p className="mt-12 border-t border-border pt-6 text-sm leading-relaxed text-foreground/60">
            The toolkit as a whole follows James Heathers&rsquo;{" "}
            <a
              href="https://doi.org/10.5281/zenodo.14871843"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-foreground/30 underline-offset-2 hover:text-foreground"
            >
              <i>An Introduction to Forensic Metascience</i>
            </a>
            . Individual methods are credited on their own cards. See also the{" "}
            <Link
              href="/forensic-metascience-agent/findings"
              className="underline decoration-foreground/30 underline-offset-2 hover:text-foreground"
            >
              findings the agent has reported
            </Link>
            .
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
