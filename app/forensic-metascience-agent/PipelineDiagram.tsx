import type { ReactNode } from "react";
import {
  Node,
  Down,
  Right,
  Fan,
  Stem,
  AgentIcon,
  DatabaseIcon,
  HumanIcon,
} from "./diagramPrimitives";

/**
 * How one paper moves through the system.
 *
 * Below the four-column breakpoint, group the independent analysis branches
 * explicitly. Fan connectors only describe the desktop row, not stacked cards.
 */

const PRODUCERS = [
  {
    t: "Image analysis module",
    tone: "neutral" as const,
  },
  {
    t: "Tortured phrases module",
    s: (
      <>
        Simple module for detecting{" "}
        <DiagramLink href="https://arxiv.org/abs/2107.06751">tortured phrases</DiagramLink>.
      </>
    ),
    tone: "neutral" as const,
  },
  {
    t: "Tool-expert agent",
    s: "Points the forensic toolkit at the paper's numbers. No web access.",
    tone: "accent" as const,
    agent: true,
  },
  {
    t: "Peer review agent",
    s: "Reads the paper as a scientist would, looking for internal contradictions, scientific mistakes, and severe methodological flaws.",
    tone: "accent" as const,
    agent: true,
  },
];

// The single-column boxes are sized against each other, not against the
// container: every step above and below the fan is exactly 3x the DOI box.
// Both cap rather than fix their width, so a narrow phone shrinks them
// instead of overflowing.
const DOI_W = "w-28";
const STEP_W = "w-full max-w-[21rem]";
// Three-column layout for rows that hang a box off to one side. The centre
// track matches STEP_W so the spine stays on the same centre line as every
// single-column row; minmax(0,…) stops a long side label widening a track.
const SPINE = "md:grid-cols-[minmax(0,1fr)_minmax(0,21rem)_minmax(0,1fr)]";

/** Inline link inside a diagram node's sub-text. */
function DiagramLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium underline decoration-foreground/30 underline-offset-2 hover:text-primary"
    >
      {children}
    </a>
  );
}

export function PipelineDiagram() {
  return (
    <div>
      {/*
        The DOI sits beside fetchpdf, not above it: it is the run's input rather
        than a pipeline step. Below `md` there is no room next to a 21rem box,
        so it falls back to the stacked form.

        The three-column grid keeps fetchpdf on the same centre line as every
        box below it — putting the DOI in a plain flex row would shove the whole
        spine to the right.
      */}
      <div className="md:hidden">
        <div className="flex justify-center">
          <Node title="A DOI" tone="ink" center className={DOI_W} />
        </div>
        <Down />
      </div>

      <div className={`grid grid-cols-1 items-center ${SPINE}`}>
        <div className="hidden items-center justify-end md:flex">
          <Node title="A DOI" tone="ink" center className={DOI_W} />
          <Right />
        </div>
        <div className="flex justify-center">
        <Node
          title="fetchpdf"
          href="https://github.com/The-Metascience-Observatory/fetchpdf"
          tone="neutral"
          center
          className={STEP_W}
          sub="Attempts to pull the XML, HTML, and PDF as well as supplementary information and data. If it cannot pull from an API, it provides a list of missing PDFs for a human to try to obtain."
        />
        </div>
        <div className="hidden md:block" />
      </div>

      <Down />

      <div className="flex justify-center">
        <Node
          title="Extraction & conversion"
          sub={
            <>
              We use a combination of tools to convert the PDF into markdown and extract tables and
              images &mdash;{" "}
              <DiagramLink href="https://github.com/docling-project/docling">docling</DiagramLink>,{" "}
              <DiagramLink href="https://github.com/jsvine/pdfplumber">pdfplumber</DiagramLink>,{" "}
              <DiagramLink href="https://github.com/pymupdf/PyMuPDF">PyMuPDF</DiagramLink>, and{" "}
              <DiagramLink href="https://mistral.ai/news/mistral-ocr">Mistral OCR</DiagramLink>.
            </>
          }
          tone="neutral"
          center
          className={STEP_W}
        />
      </div>

      <Down />

      <div className="hidden lg:block">
        <Fan n={4} dir="out" />
      </div>

      <section aria-label="Parallel analysis branches" className="mx-auto max-w-md lg:max-w-none">
        <div className="pb-4 text-center lg:sr-only">
          <p className="text-sm font-semibold text-foreground">Parallel analysis</p>
          <p className="mt-1 text-xs text-muted-foreground">Four independent branches feed into one review.</p>
        </div>
        {/* On narrow screens, side rails distribute the input to each branch
            and collect its output. No arrow connects independent branches. */}
        <div aria-hidden className="h-5 w-1/2 rounded-tl-lg border-l-2 border-t-2 border-foreground/50 lg:hidden" />
        <div className="grid grid-cols-1 lg:grid-cols-4 lg:gap-2">
          {PRODUCERS.map((p, i) => (
            <div key={p.t} className="relative flex min-w-0 flex-col px-5 py-3 lg:p-0">
              <div aria-hidden className={`absolute left-0 top-0 border-l-2 border-foreground/50 lg:hidden ${i === PRODUCERS.length - 1 ? "h-9" : "bottom-0"}`} />
              <div aria-hidden className={`absolute right-0 bottom-0 border-r-2 border-foreground/50 lg:hidden ${i === 0 ? "top-[calc(100%-36px)]" : "top-0"}`} />
              <svg aria-hidden viewBox="0 0 20 12" className="absolute left-0 top-[30px] h-3 w-5 text-foreground/50 lg:hidden">
                <path d="M0 6H14" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M20 6L13 1V11Z" fill="currentColor" />
              </svg>
              <div aria-hidden className="absolute bottom-9 right-0 w-5 border-t-2 border-foreground/50 lg:hidden" />
              <Node
                title={p.t}
                sub={p.s}
                tone={p.tone}
                center
                icon={p.agent ? <AgentIcon /> : undefined}
                className="[&>p]:text-xs lg:[&>p]:text-[11px]"
              />
              {/*
                The image track alone carries a second stage. Its detector measures
                shared pixels correctly but cannot say WHY two panels share them, so
                a model pass answers that question before the finding leaves the
                track — and its verdict travels with the finding, which is what stops
                the main adjudicator re-litigating pixels later.
              */}
              {i === 0 && (
                <>
                  <Down h={22} />
                  <Node
                    title="Image finding adjudication agent"
                    sub="An agent to screen out false positives and innocuous duplications."
                    tone="accent"
                    center
                    icon={<AgentIcon />}
                    className="[&>p]:text-xs lg:[&>p]:text-[11px]"
                  />
                </>
              )}
              <div className="hidden grow lg:flex lg:flex-col">
                <Stem />
              </div>
            </div>
          ))}
        </div>
        <div aria-hidden className="ml-auto h-5 w-1/2 rounded-br-lg border-b-2 border-r-2 border-foreground/50 lg:hidden" />
      </section>

      <div className="hidden lg:block">
        <Fan n={4} dir="in" />
      </div>
      <div className="lg:hidden">
        <Down />
      </div>

      <div className="flex justify-center">
        <Node title="Join findings" tone="neutral" center className={STEP_W} />
      </div>

      <Down />

      <div className="flex justify-center">
        <Node
          title="Adjudicator agent"
          icon={<AgentIcon />}
          center
          sub="Deduplicates findings, triages out false positives, sets the final severity score for each finding, and writes the paper-level verdict."
          tone="accent"
          className={STEP_W}
        />
      </div>

      {/*
        Human review hangs off the side of the database step rather than below
        it: it is what people do with a saved run, not another stage the paper
        passes through. Same three-column spine as the DOI row above, so the
        database box keeps the centre line it shares with everything above it.
        Below `md` it drops back under the database box.

        The connector into the database box lives INSIDE the centre column and
        opens with a `Stem`, because the tall Human review box makes this row
        taller than the box it holds. A fixed-height arrow above the row would
        stop short and leave the adjudicator visibly unconnected; the stem takes
        up whatever slack the side box creates, at any width.
      */}
      <div className={`grid grid-cols-1 ${SPINE}`}>
        <div className="hidden md:block" />
        <div className="flex flex-col items-center">
          <Stem />
          <Down h={26} />
          <Node
            title="Save findings to database"
            icon={<DatabaseIcon />}
            center
            tone="neutral"
            className={STEP_W}
          />
          {/* Balances the stem above so the box sits on the row's centre line,
              level with the Human review box beside it. */}
          <div className="grow" />
        </div>
        <div className="min-w-0 md:flex md:items-center">
          <div className="md:hidden">
            <Down />
          </div>
          <div className="hidden md:block">
            <Right />
          </div>
          <Node
            title="Human review"
            icon={<HumanIcon />}
            sub="Humans review each finding in our rapid review web application. Human feedback on findings, including marking of false positives, is stored in the database to help inform improvements to the system. A human decides whether to submit to PubPeer or email the authors or an editor, and all PubPeer comments and emails are human-written, not AI-written."
            center
            tone="ink"
            className="mx-auto w-full max-w-[21rem] md:mx-0"
          />
        </div>
      </div>
    </div>
  );
}
