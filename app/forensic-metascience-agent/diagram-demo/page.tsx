import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DocsBackLink } from "@/components/DocsBackLink";
import {
  DiagramCoarse,
  DiagramMedium,
  DiagramBlueprint,
  DiagramLifecycle,
  DiagramSeverity,
} from "./diagrams";

// Review surface: pick a diagram, then this route can go (or keep the winner).
export const metadata = {
  title: "Pipeline diagrams (demo) | The Metascience Observatory",
  robots: { index: false, follow: false },
};

const VARIANTS = [
  {
    id: "a",
    label: "A",
    title: "One line",
    granularity: "Coarsest",
    style: "Linear, five boxes",
    fits: "A reader who wants the shape and nothing else — an intro paragraph, a slide, the top of a page.",
    Diagram: DiagramCoarse,
  },
  {
    id: "b",
    label: "B",
    title: "The fan-out",
    granularity: "Medium",
    style: "Vertical flow with a concurrency band",
    fits: "The default. Shows the one structural fact that matters — four independent producers, then a referee.",
    Diagram: DiagramMedium,
  },
  {
    id: "c",
    label: "C",
    title: "Every pass named",
    granularity: "Full",
    style: "Blueprint — monospace, thin rules",
    fits: "Documentation for someone who will work on it. Dense on purpose; reads as a spec, not an illustration.",
    Diagram: DiagramBlueprint,
  },
  {
    id: "d",
    label: "D",
    title: "Where the evidence goes",
    granularity: "Medium",
    style: "Horizontal lifecycle",
    fits: "A different cut entirely — storage and reachability rather than control flow. Pairs with B rather than competing with it.",
    Diagram: DiagramLifecycle,
  },
  {
    id: "e",
    label: "E",
    title: "How a finding gets its severity",
    granularity: "Medium, one subsystem",
    style: "Two-column comparison, then a flow",
    fits: "The two-axis severity model, which is the part most likely to be misread. Also a different cut, not a rival to B.",
    Diagram: DiagramSeverity,
  },
];

export default function DiagramDemoPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto max-w-5xl px-4 py-12">
          <DocsBackLink href="/forensic-metascience-agent" label="return to the forensic metascience agent" />

          <h1 className="mb-4 mt-0 text-4xl font-bold leading-tight text-foreground">
            Pipeline diagrams
          </h1>

          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-semibold leading-relaxed text-foreground">
              These describe a system that does not exist yet.
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">
              Every diagram below is drawn from the approved specifications in{" "}
              <code className="font-mono text-xs">docs/specs/</code> &mdash; the parallel
              pipeline, the adjudicator contract, the findings-v2 record, the anchor contract and
              the database topology. That work is being implemented now. What runs today is the
              serial two-stage pipeline, which is a different shape: one sweep, then one editorial
              pass, with no adjudicator and no science-error agent. Nothing here should be
              published as a description of the current system until the implementation lands.
            </p>
          </div>

          <p className="mb-8 leading-relaxed text-foreground">
            Five options, at three levels of coarse-graining and in different styles. A, B and C
            are the same story at increasing detail &mdash; pick one. D and E are different cuts
            through the system and could sit alongside whichever of A/B/C you choose rather than
            competing with it.
          </p>

          <nav aria-label="Diagrams" className="mb-4 flex flex-wrap gap-2">
            {VARIANTS.map((v) => (
              <a
                key={v.id}
                href={`#${v.id}`}
                className="rounded border border-border bg-white px-2.5 py-1 text-xs font-medium text-foreground/70 transition-colors hover:border-primary hover:text-primary"
              >
                {v.label} &middot; {v.title}
              </a>
            ))}
          </nav>

          {VARIANTS.map(({ id, label, title, granularity, style, fits, Diagram }) => (
            <section key={id} id={id} className="scroll-mt-24">
              <h2 className="mb-1 mt-12 border-b border-border pb-2 text-2xl font-semibold text-foreground">
                <span className="mr-2 text-foreground/40">{label}</span>
                {title}
              </h2>
              <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/55">
                <span>
                  <span className="font-medium text-foreground/70">Granularity:</span>{" "}
                  {granularity}
                </span>
                <span>
                  <span className="font-medium text-foreground/70">Style:</span> {style}
                </span>
              </div>
              <p className="mb-5 text-sm leading-relaxed text-foreground/75">{fits}</p>
              <Diagram />
            </section>
          ))}

          <h2 className="mb-4 mt-14 border-b border-border pb-2 text-2xl font-semibold text-foreground">
            What I left out, and why
          </h2>
          <ul className="space-y-2 text-sm leading-relaxed text-foreground">
            <li>
              <span className="font-medium">The budget split</span> (0.40 / 0.25 / remainder, with
              a floor under the adjudicator) is in C only. It is a real constraint but it is not
              structure, and putting numbers on a flow chart invites reading them as fixed.
            </li>
            <li>
              <span className="font-medium">The failure matrix.</span> Only the adjudicator&rsquo;s
              fail-open path is drawn (in E), because it is the one whose behaviour changes what a
              reader should believe. The rest is better as a table than as boxes.
            </li>
            <li>
              <span className="font-medium">Modes and migration.</span> The parallel/two-stage
              alias and the phase ordering are project state, not architecture, and would date the
              diagram within weeks.
            </li>
          </ul>
        </div>
      </main>
      <Footer />
    </div>
  );
}
