import type { ReactNode } from "react";
import {
  Node,
  Down,
  Fan,
  Stem,
  AgentIcon,
  DatabaseIcon,
  HumanIcon,
} from "./diagramPrimitives";

/**
 * How one paper moves through the system.
 *
 * There is deliberately no "merge" box: the fan-in arrow IS the merge, and a
 * node for it only restated the geometry.
 *
 * The two validation boxes are deliberately NOT collapsed into one. The passes
 * split around the adjudicator, and the severity clamps run in both halves —
 * applied to the provisional severity, then re-applied to the final ranking —
 * so a clamp can never come out weaker than it went in. One box would hide the
 * reason the split exists.
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
      <div className="flex justify-center">
        <Node title="A DOI" tone="ink" center className={DOI_W} />
      </div>

      <Down />

      <div className="flex justify-center">
        <Node
          title="fetchpdf"
          href="https://github.com/The-Metascience-Observatory/fetchpdf"
          tone="neutral"
          center
          className={STEP_W}
          sub="Attempts to pull the XML, HTML, and PDF as well as supplementary information and data. If it cannot pull from an API it provides a list of missing PDFs for a human to try to obtain."
        />
      </div>

      <Down />

      <div className="flex justify-center">
        <Node
          title="Extraction & conversion"
          sub={
            <>
              We use a combination of tools to convert the PDF into more usable formats &mdash;{" "}
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

      <Fan n={4} dir="out" />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {PRODUCERS.map((p, i) => (
          <div key={p.t} className="flex flex-col">
            <Node
              title={p.t}
              sub={p.s}
              tone={p.tone}
              center
              icon={p.agent ? <AgentIcon /> : undefined}
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
                />
              </>
            )}
            <Stem />
          </div>
        ))}
      </div>

      <Fan n={4} dir="in" />

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

      <Down />

      <div className="flex justify-center">
        <Node
          title="Save findings to database"
          icon={<DatabaseIcon />}
          center
          tone="neutral"
          className={STEP_W}
        />
      </div>

      <Down />

      <div className="flex justify-center">
        <Node
          title="Human review"
          icon={<HumanIcon />}
          sub="Humans review each finding in our rapid review web application. Human feedback on findings, including marking of false positives, is stored in the database to help inform improvements to the system. A human decides whether to submit to PubPeer or email the authors or an editor, and all PubPeer comments and emails are human-written, not AI-written."
          center
          tone="ink"
          className={STEP_W}
        />
      </div>
    </div>
  );
}
