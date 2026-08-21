import { Node, Down, Fan, Band, Legend } from "../diagramPrimitives";
import { PipelineDiagram } from "../PipelineDiagram";

/* ══════════════════════════════════════════════════════════════════════
   A — COARSE. Five stages, one line. For a reader who wants the shape.
   ══════════════════════════════════════════════════════════════════════ */

const COARSE = [
  { t: "Read the paper", s: "PDF, publisher XML, HTML, supplements" },
  { t: "Four analysers", s: "two LLM agents, two deterministic screens — concurrently" },
  { t: "Merge", s: "one set of findings, deduplicated" },
  { t: "Adjudicate", s: "a referee assigns the final severity" },
  { t: "Report", s: "structured review, archive, database" },
];

export function DiagramCoarse() {
  return (
    <div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-5 sm:gap-0">
        {COARSE.map((c, i) => (
          <div key={c.t} className="flex items-stretch">
            <Node
              title={c.t}
              sub={c.s}
              tone={i === 3 ? "accent" : "neutral"}
              className="flex-1"
            />
            {i < COARSE.length - 1 && (
              <div className="hidden shrink-0 items-center px-1.5 text-border sm:flex">
                <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden>
                  <path d="M0 5h9M9 5l-4-4M9 5l-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
      <Legend>
        The whole system in one line. Everything interesting is inside “four analysers” and
        “adjudicate”.
      </Legend>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   B — MEDIUM. The producer fan-out/fan-in, which is the actual shape.
   ══════════════════════════════════════════════════════════════════════ */

// Variant B is the component that actually ships on the agent page, re-exported
// here rather than duplicated, so the demo cannot drift from what readers see.
export const DiagramMedium = PipelineDiagram;

/* ══════════════════════════════════════════════════════════════════════
   C — DETAILED, BLUEPRINT STYLE. Monospace, thin rules, every pass named.
   ══════════════════════════════════════════════════════════════════════ */

const PRE_PASSES = [
  "quotes — provenance adjudication",
  "reproductions — reproduction strings",
  "exhaustive checks — coverage census",
  "consequence — what the finding implies",
  "severity reconciliation — tool-verdict join",
  "clamps — uncomputed / supplied-norm / unanchored",
  "sourcing — quote verdicts onto findings",
  "second_look — worklist for the adjudicator",
  "web_unbacked / code_unbacked — fabrication guards",
];

const POST_PASSES = [
  "titles — final records, adjudicator rewrites preserved",
  "severity9 caps — PIPELINE_MAX, quarantine, 8-gate",
  "anchors — persisted locations (never fails the run)",
];

function Rule({ label }: { label: string }) {
  return (
    <div className="my-2 flex items-center gap-2">
      <span className="h-px flex-1 bg-border" />
      <span className="font-mono text-[10px] uppercase tracking-widest text-foreground/40">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function Pass({ text }: { text: string }) {
  const [head, ...rest] = text.split(" — ");
  return (
    <li className="flex gap-2 font-mono text-[11px] leading-relaxed">
      <span className="select-none text-foreground/30">│</span>
      <span className="text-foreground">{head}</span>
      {rest.length > 0 && <span className="text-foreground/50">— {rest.join(" — ")}</span>}
    </li>
  );
}

export function DiagramBlueprint() {
  return (
    <div className="rounded-lg border border-border bg-white p-4 sm:p-6">
      <Rule label="ingest" />
      <p className="font-mono text-[11px] text-foreground">
        resolve_sources → extraction (XML primary; PDF / HTML / supplements)
      </p>

      <Rule label="producers · concurrent" />
      <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
        {[
          ["image_track", "subprocess · quarantined · 12 stages"],
          ["text_track", "subprocess · quarantined · dictionary + 5 guards"],
          ["tool_expert", "54 tools · no web · no code · 0.40 × budget"],
          ["science_error", "15 tools · web ON · run_python_script · 0.25 × budget"],
        ].map(([a, b]) => (
          <p key={a} className="font-mono text-[11px] leading-relaxed">
            <span className="text-primary">{a}</span>
            <span className="text-foreground/50"> {b}</span>
          </p>
        ))}
      </div>

      <Rule label="merge" />
      <p className="font-mono text-[11px] text-foreground">
        findings(4 producers) + image_adjudication + checks_tally → one set
      </p>

      <Rule label="pre-adjudication annotators · on the merged set, once" />
      <ul className="space-y-0.5">
        {PRE_PASSES.map((p) => (
          <Pass key={p} text={p} />
        ))}
      </ul>

      <Rule label="adjudicator · one llm pass" />
      <div className="rounded border border-cyan-900/30 bg-cyan-900/[0.04] p-3">
        <p className="font-mono text-[11px] leading-relaxed text-foreground">
          docket ≤ 120 rows (ranked, remainder named) · paper text ≤ 40,000 chars ·{" "}
          <span className="text-foreground/60">Read</span> access · second_look · checks_tally
        </p>
        <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-foreground/60">
          40 tools · no web · no code — the surface is escalation-safe because every bound is
          enforced by <span className="text-foreground">apply()</span> in code, not by the prompt
        </p>
        <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-foreground/60">
          pass rows are counted, never itemised · over-cap rows resolve by the silence rule
        </p>
      </div>

      <Rule label="post-adjudication annotators" />
      <ul className="space-y-0.5">
        {POST_PASSES.map((p) => (
          <Pass key={p} text={p} />
        ))}
      </ul>

      <Rule label="emit" />
      <p className="font-mono text-[11px] leading-relaxed text-foreground">
        render_report (structural) → run archive → db-push (best-effort) → Neon → webapp
      </p>

      <Legend>
        Every pass named, in execution order. The clamps appear twice on purpose: applied to the
        provisional severity before adjudication, and re-applied to the final 1–9 afterwards, so
        a clamp can never come out weaker than it went in.
      </Legend>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   D — DATA LIFECYCLE. Where the evidence physically goes.
   ══════════════════════════════════════════════════════════════════════ */

export function DiagramLifecycle() {
  const stores = [
    { t: "Run archive (files)", s: "prompts-as-sent · tool-call ledgers · transcripts · findings.json · analysis_code/", badge: "master" },
    { t: "Neon Postgres", s: "every finding mirrored as JSONB, upserted by natural key — replayable, drift detectable", badge: "queryable" },
    { t: "Webapp & dashboards", s: "review workbench · fire-rate dashboards · findings-query", badge: "read" },
  ];
  return (
    <div>
      <Node title="One analysed paper" sub="findings, each with a location anchor and two severity axes" tone="accent" />
      <Down label="written as the run completes" />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {stores.map((s, i) => (
          <div key={s.t} className="relative">
            <Node title={s.t} sub={s.s} badge={s.badge} tone={i === 2 ? "neutral" : "muted"} />
            {i < 2 && (
              <div className="mt-2 flex justify-center lg:absolute lg:-right-2.5 lg:top-1/2 lg:mt-0 lg:-translate-y-1/2 lg:rotate-[-90deg]">
                <svg width="18" height="12" viewBox="0 0 18 12" className="text-border" aria-hidden>
                  <path d="M9 12V2M9 2L4 7M9 2l5 5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
      <Legend>
        The files are the master, not a cache: the archive can always rebuild the database. A
        push that cannot reach the database records a pending state and is retried — an
        unreachable database never fails a paid run.
      </Legend>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   E — HOW A FINDING GETS ITS SEVERITY. Two axes, and where each is set.
   ══════════════════════════════════════════════════════════════════════ */

export function DiagramSeverity() {
  return (
    <div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-white p-4">
          <p className="font-clarendon text-sm font-semibold text-foreground">
            Axis 1 — the tool&rsquo;s verdict about a number
          </p>
          <p className="mt-1 text-xs leading-relaxed text-foreground/65">
            Set by the deterministic tool. Epistemic: what the arithmetic can support.
          </p>
          <div className="mt-3 space-y-1">
            {["impossible", "highly suspicious", "suspicious", "indeterminate", "consistent"].map(
              (v, i) => (
                <div
                  key={v}
                  className={`rounded border px-2 py-1 font-mono text-[11px] ${
                    i === 0 ? "border-primary/40 bg-primary/10" : "border-border bg-muted/40"
                  }`}
                >
                  {v}
                </div>
              ),
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-white p-4">
          <p className="font-clarendon text-sm font-semibold text-foreground">
            Axis 2 — what a journal would have to do
          </p>
          <p className="mt-1 text-xs leading-relaxed text-foreground/65">
            A 1&ndash;9 correction-outcome ranking. The webapp sorts on this.
          </p>
          <div className="mt-3 flex flex-wrap gap-1">
            {Array.from({ length: 9 }, (_, i) => (
              <span
                key={i}
                className={`flex h-7 w-7 items-center justify-center rounded border font-mono text-[11px] ${
                  i >= 5
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-muted/40 text-foreground/60"
                }`}
              >
                {i + 1}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-foreground/65">
            Neither axis is derivable from the other, and a finding carries both.
          </p>
        </div>
      </div>

      <Down label="the finding is created" />
      <Node title="Provisional severity" sub="assigned by the producer, then clamped by the pre-adjudication passes" tone="muted" />
      <Down />
      <Node
        title="Adjudicator may move it"
        sub="Up or down — but never by more than a bounded amount, and the bound is enforced in code rather than requested in a prompt"
        tone="dark"
      />
      <Down label="then clamped again" />
      <Node title="Final severity" sub="Post-adjudication caps re-applied; a clamp may never be weaker after adjudication than before" tone="accent" />
      <Down label="if the adjudicator never ran" />
      <Node
        title="Fail open, and say so"
        sub="Findings still ship, marked provisional. Anything claiming `impossible` is stamped cross-check-not-run and barred from the headline — an unrun cross-check must never read as a passed one."
        tone="warn"
      />
      <Legend>
        The two axes exist because they answer different questions. “Could this number have come
        from any dataset?” is not the same question as “what should the journal do about it?”,
        and collapsing them loses one or the other.
      </Legend>
    </div>
  );
}
