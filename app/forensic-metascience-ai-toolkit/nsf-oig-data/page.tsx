import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DocsBackLink } from "@/components/DocsBackLink";
import { getNsfOigMisconduct, NsfOigYearDatum, SourcedValue } from "../nsfOigData";

export const metadata = {
  title: "NSF OIG Misconduct Data Sources | The Metascience Observatory",
  description:
    "Year-by-year research misconduct allegations and findings at the NSF Office of Inspector " +
    "General, with the source behind every figure.",
};

const LINK_CLASS = "text-primary underline hover:no-underline";

function SourceCell({ v }: { v: SourcedValue | null }) {
  if (!v) return <span className="text-foreground/40">not found</span>;
  return (
    <>
      <a href={v.url} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
        {v.source}
      </a>
      {v.sourceType === "secondary" && (
        <span className="ml-1 text-foreground/50">(secondary source; not plotted)</span>
      )}
    </>
  );
}

function yearText(r: NsfOigYearDatum): string {
  return r.yearBasis === "fiscal" ? `FY${r.year}` : String(r.year);
}

function valueText(v: SourcedValue | null): string {
  if (!v) return "—";
  return v.high > v.low ? `${v.value} (${v.low}–${v.high})` : String(v.value);
}

export default function NsfOigDataPage() {
  const rows = getNsfOigMisconduct();

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto max-w-5xl px-4 py-12">
          <DocsBackLink
            href="/forensic-metascience-ai-toolkit#the-oversight-problem"
            label="return to the Forensic Metascience AI toolkit"
          />

          <h1 className="mb-4 mt-0 text-4xl font-bold leading-tight text-foreground">
            Sources for NSF OIG research misconduct findings over time chart
          </h1>

          <h2 className="mb-4 mt-10 border-b border-border pb-2 text-2xl font-semibold text-foreground">
            Allegations vs. findings
          </h2>
          <ul className="mb-4 list-disc space-y-2 pl-6 leading-relaxed text-foreground">
            <li>
              <strong>An allegation</strong> is a complaint received by NSF OIG that someone
              fabricated, falsified, or plagiarized in NSF-funded research or a proposal.
            </li>
            <li>
              <strong>A finding</strong> is NSF&rsquo;s formal decision that research misconduct
              occurred. OIG (or the researcher&rsquo;s institution) first runs an inquiry and an
              investigation; NSF management then makes the final decision, which requires a
              preponderance of the evidence that the act was intentional, knowing, or reckless
              and a significant departure from accepted practice.
            </li>
          </ul>

          <h2 className="mb-4 mt-10 border-b border-border pb-2 text-2xl font-semibold text-foreground">
            Figures by year
          </h2>
          <ul className="space-y-3 md:hidden">
            {rows.map((r) => (
              <li key={r.year} className="rounded-lg border border-border bg-white p-4 text-sm">
                <p className="m-0 text-base font-semibold text-foreground">{yearText(r)}</p>
                <dl className="mt-2 space-y-2">
                  <div>
                    <dt className="font-medium text-foreground">
                      Allegations: <span className="tabular-nums">{valueText(r.allegations)}</span>
                    </dt>
                    <dd className="m-0 text-foreground/80">
                      <SourceCell v={r.allegations} />
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">
                      Findings: <span className="tabular-nums">{valueText(r.findings)}</span>
                    </dt>
                    <dd className="m-0 text-foreground/80">
                      <SourceCell v={r.findings} />
                    </dd>
                  </div>
                </dl>
                {r.note && <p className="m-0 mt-2 text-foreground/70">{r.note}</p>}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-white md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="p-3 font-semibold">Year</th>
                  <th className="p-3 font-semibold">Allegations</th>
                  <th className="p-3 font-semibold">Source</th>
                  <th className="p-3 font-semibold">Findings</th>
                  <th className="p-3 font-semibold">Source</th>
                  <th className="p-3 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.year} className="border-b border-border align-top last:border-b-0">
                    <td className="whitespace-nowrap p-3 font-medium">{yearText(r)}</td>
                    <td className="p-3 tabular-nums">{valueText(r.allegations)}</td>
                    <td className="p-3">
                      <SourceCell v={r.allegations} />
                    </td>
                    <td className="p-3 tabular-nums">{valueText(r.findings)}</td>
                    <td className="p-3">
                      <SourceCell v={r.findings} />
                    </td>
                    <td className="p-3 text-foreground/70">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mb-4 mt-10 border-b border-border pb-2 text-2xl font-semibold text-foreground">
            Additional references
          </h2>
          <ul className="mb-4 list-disc space-y-2 pl-6 leading-relaxed text-foreground">
            <li>
              Mervis, Jeffrey. &ldquo;
              <a
                href="https://doi.org/10.1126/science.aal0958"
                target="_blank"
                rel="noopener noreferrer"
                className={LINK_CLASS}
              >
                Data Check: NSF Sends Congress a Garbled Message on Misconduct Numbers
              </a>
              .&rdquo; <em>Science</em>, Mar. 2017. Article reports there have been 169 NSF
              findings between 2005 and 2017, 82% for plagiarism, with annual findings &lsquo;in
              the teens&rsquo; over the preceding decade.
            </li>
          </ul>
        </div>
      </main>
      <Footer />
    </div>
  );
}
