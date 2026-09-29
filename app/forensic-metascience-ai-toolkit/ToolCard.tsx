import { Card } from "@/components/ui/card";
import type { Tool, ToolInput } from "./tools";

// The card used by both the main toolkit list and the pipeline pages, so a
// stage and a registered tool are described in exactly the same shape.

const LABEL = "text-xs font-medium uppercase tracking-wide text-foreground";
const PROSE = "text-sm leading-relaxed text-foreground";

function InputRow({ input }: { input: ToolInput }) {
  return (
    <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-[minmax(0,13rem)_1fr]">
      <dt className="font-mono text-xs leading-relaxed text-foreground">
        {input.name}
        {!input.required && (
          <span className="ml-1 font-sans text-[10px] uppercase tracking-wide text-foreground/40">
            optional
          </span>
        )}
      </dt>
      <dd className="mb-1.5 text-xs leading-relaxed text-foreground sm:mb-0">
        {input.type}
        {input.note && <span className="block text-foreground">{input.note}</span>}
      </dd>
    </div>
  );
}

export function ToolCard({ tool }: { tool: Tool }) {
  const required = tool.inputs.filter((i) => i.required);
  const optional = tool.inputs.filter((i) => !i.required);

  return (
    <Card
      id={tool.slug}
      className="scroll-mt-24 border-border bg-white p-5 shadow-none"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-clarendon text-lg font-semibold text-foreground">{tool.name}</h3>
        {tool.registryName && (
          <code className="font-mono text-xs text-foreground/45">{tool.registryName}</code>
        )}
        {tool.partOf && (
          <span className="text-xs text-foreground/45">
            step {tool.step} of{" "}
            <code className="font-mono">{tool.partOf}</code>
          </span>
        )}
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <p className={LABEL}>When it applies</p>
          <p className={`mt-1 ${PROSE}`}>{tool.whenToApply}</p>
        </div>
        <div>
          <p className={LABEL}>How it works</p>
          <p className={`mt-1 ${PROSE}`}>{tool.howItWorks}</p>
        </div>
        <div>
          <p className={LABEL}>Inputs</p>
          <dl className="mt-1.5 space-y-1.5">
            {required.map((i) => (
              <InputRow key={i.name} input={i} />
            ))}
            {optional.map((i) => (
              <InputRow key={i.name} input={i} />
            ))}
          </dl>
        </div>
        <div>
          <p className={LABEL}>Output</p>
          <p className={`mt-1 ${PROSE}`}>{tool.output}</p>
        </div>
      </div>

      {tool.references && tool.references.length > 0 && (
        <div className="mt-3">
          <p className={LABEL}>{tool.references.length > 1 ? "References" : "Reference"}</p>
          <div className="mt-1 space-y-1.5">
            {tool.references.map((ref) => (
              <p key={ref.title} className={PROSE}>
                {ref.authors}{" "}
                {ref.doi ? (
                  <a
                    href={`https://doi.org/${ref.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-foreground/30 underline-offset-2 hover:text-primary"
                  >
                    {ref.title}
                  </a>
                ) : (
                  ref.title
                )}
                {". "}
                {ref.journal && (
                  <>
                    <i>{ref.journal}</i>{" "}
                  </>
                )}
                {ref.volume && <b>{ref.volume}</b>}
                {ref.issue && `(${ref.issue})`}
                {ref.pages && `${ref.volume ? ", " : ""}${ref.pages}`}
                {(ref.journal || ref.volume || ref.pages) && ". "}
                {ref.year}.
              </p>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
