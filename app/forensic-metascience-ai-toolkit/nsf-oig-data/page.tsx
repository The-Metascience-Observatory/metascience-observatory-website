import Link from "next/link";
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

const REPORTS = [
  {
    name: "NSF OIG Semiannual Report 56 (Oct 2016 – Mar 2017)",
    covers: "research misconduct statistics, FY2005–FY2016",
    url: "https://www.oversight.gov/sites/default/files/documents/reports/2017-07/OIG_SAR_56.pdf",
  },
  {
    name: "NSF OIG Semiannual Report 60 (Oct 2018 – Mar 2019)",
    covers: "research misconduct statistics, FY2010–FY2019",
    url: "https://www.oversight.gov/sites/default/files/documents/reports/2019-06/NSF_OIG_SAR_60.pdf",
  },
  {
    name: "NSF OIG Semiannual Report 63 (Apr – Sep 2020)",
    covers: "research misconduct statistics, FY2011–FY2020",
    url: "https://www.oversight.gov/sites/default/files/documents/reports/2020-11/NSF_OIG_SAR_63.pdf",
  },
  {
    name: "NSF OIG Semiannual Report, Fall 2025 (Apr – Sep 2025)",
    covers: "most recent period",
    url: "https://www.oversight.gov/sites/default/files/documents/reports/2026-01/Semiannual%20Report%20to%20Congress%20-%20Fall%202025.pdf",
  },
];

function SourceCell({ v }: { v: SourcedValue | null }) {
  if (!v) return <span className="text-foreground/40">not found</span>;
  return (
    <>
      <a href={v.url} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
        {v.source}
      </a>
      {v.sourceType === "secondary" && (
        <span className="ml-1 text-foreground/50">(secondary; not plotted)</span>
      )}
    </>
  );
}

function yearText(r: NsfOigYearDatum): string {
  return r.yearBasis === "fiscal" ? `FY${r.year}` : `${r.year}*`;
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
            NSF OIG research misconduct data: sources
          </h1>

          <p className="mb-4 leading-relaxed text-foreground">
            The National Science Foundation&rsquo;s Office of Inspector General (NSF OIG) handles
            allegations of research misconduct in NSF-funded work. This page documents the
            figures behind the allegations and findings chart on the{" "}
            <Link href="/forensic-metascience-ai-toolkit#the-oversight-problem" className={LINK_CLASS}>
              Forensic Metascience AI toolkit
            </Link>{" "}
            page.
          </p>

          <div className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-foreground">
            <strong>Provisional.</strong> These figures were compiled from excerpts of the
            reports and articles below and have not yet been checked line by line against the
            full report tables. Several years are missing, and some sources do not say whether
            a year is a fiscal or calendar year.
          </div>

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
          <p className="mb-4 leading-relaxed text-foreground">
            Most allegations never become findings. Cases also take a year or more, so a
            year&rsquo;s findings mostly stem from allegations received in earlier years. Roughly
            80% of NSF allegations and findings involve plagiarism. In early 2025{" "}
            <a
              href="https://www.science.org/content/article/exclusive-nsf-watchdog-unit-no-longer-investigating-research-misconduct"
              target="_blank"
              rel="noopener noreferrer"
              className={LINK_CLASS}
            >
              NSF OIG stopped investigating research misconduct
            </a>{" "}
            and began referring allegations to grantee institutions.
          </p>

          <h2 className="mb-4 mt-10 border-b border-border pb-2 text-2xl font-semibold text-foreground">
            Figures by year
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-foreground/70">
            &ldquo;Secondary&rdquo; marks a figure taken from a source that cites NSF OIG rather
            than from NSF OIG itself. These are listed here but not plotted on the chart until
            they are checked against NSF OIG&rsquo;s own reports. A range in parentheses means
            sources disagree.
          </p>
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
          <p className="mt-2 text-xs text-foreground/60">
            * Source does not say whether this is a fiscal or calendar year. NSF&rsquo;s fiscal
            year runs October to September (FY2022 = Oct 2021 – Sep 2022).
          </p>

          <h2 className="mb-4 mt-10 border-b border-border pb-2 text-2xl font-semibold text-foreground">
            Known gaps and caveats
          </h2>
          <ul className="mb-4 list-disc space-y-2 pl-6 leading-relaxed text-foreground">
            <li>No figures yet for 2006–2009, 2017–2018, 2020–2021, or 2024–2025.</li>
            <li>
              2014 findings are given as 20, 22, or 26 depending on the source. The 2014
              allegation count (49) is low next to 2013 and 2015 and may reflect a
              calendar/fiscal year mismatch.
            </li>
            <li>
              The FY2011 allegation peak coincides with NSF OIG&rsquo;s proactive plagiarism
              review of its FY2011 awards, so it partly reflects OIG searching for cases rather
              than more misconduct.
            </li>
            <li>
              A 2017{" "}
              <a
                href="https://www.science.org/content/article/data-check-nsf-sends-congress-garbled-message-misconduct-numbers"
                target="_blank"
                rel="noopener noreferrer"
                className={LINK_CLASS}
              >
                Science data check
              </a>{" "}
              reported 169 NSF findings since 2005, 82% for plagiarism, with annual findings
              &ldquo;in the teens&rdquo; over the preceding decade.
            </li>
          </ul>

          <h2 className="mb-4 mt-10 border-b border-border pb-2 text-2xl font-semibold text-foreground">
            Primary reports for filling the gaps
          </h2>
          <ul className="mb-4 list-disc space-y-2 pl-6 leading-relaxed text-foreground">
            {REPORTS.map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
                  {r.name}
                </a>{" "}
                — {r.covers}
              </li>
            ))}
            <li>
              <a
                href="https://oig.nsf.gov/investigations/research-misconduct/by-the-numbers"
                target="_blank"
                rel="noopener noreferrer"
                className={LINK_CLASS}
              >
                NSF OIG, Research misconduct by the numbers
              </a>
            </li>
          </ul>
          <p className="mt-6 text-sm text-foreground/60">
            Data file: <code>data/nsf_oig_misconduct_by_year.csv</code>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
