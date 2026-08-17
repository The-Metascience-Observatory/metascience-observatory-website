import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { DocsBackLink } from "@/components/DocsBackLink";
import { Finding, postedFindings, otherFindings } from "./findings";

export const metadata = {
  title: "Findings and PubPeer Comments | The Metascience Observatory",
  description:
    "A running list of what the Forensic Metascience Agent has found — including the comments we have posted on PubPeer.",
};

/** More than two authors → "LastName, F. et al."; one or two authors are shown as stored. */
function formatAuthors(authors: string): string {
  const entries = authors
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const named = entries.filter((e) => !/^et al\.?$/i.test(e));
  if (named.length <= 2 && named.length === entries.length) return authors;
  const tokens = named[0].split(/\s+/);
  if (tokens.length < 2) return `${named[0]} et al.`;
  const lastName = tokens.slice(0, -1).join(" ");
  const firstInitial = tokens[tokens.length - 1][0];
  return `${lastName}, ${firstInitial}. et al.`;
}

/** Standardized citation line: Authors. <i>Journal</i> <b>volume</b>(issue): pages (year). doi link. */
function Citation({ finding }: { finding: Finding }) {
  return (
    <p className="text-sm text-foreground/70 leading-relaxed">
      {formatAuthors(finding.authors)}. <i>{finding.journal}</i>
      {finding.volume && (
        <>
          {" "}
          <b>{finding.volume}</b>
          {finding.issue && <>({finding.issue})</>}
        </>
      )}
      {finding.pages && <>: {finding.pages}</>} ({finding.year}).{" "}
      <a
        href={`https://doi.org/${finding.doi}`}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-foreground underline decoration-foreground/30 underline-offset-2 break-all"
      >
        doi:{finding.doi}
      </a>
    </p>
  );
}

function PostedCard({ finding }: { finding: Finding }) {
  return (
    <Card className="p-5 border-black bg-white">
      <div className="flex items-center gap-5">
        <div className="min-w-0 flex-1">
          <h3 className="font-clarendon font-semibold text-[1.0625rem] text-foreground mb-1">
            {finding.title}
          </h3>
          <Citation finding={finding} />
          <p className="mt-3 text-sm text-foreground/90 leading-relaxed">
            <span className="font-semibold">Issue(s) submitted:</span> {finding.summary}
            {finding.submitted && (
              <span className="text-xs text-foreground/60"> Submitted {finding.submitted}.</span>
            )}
          </p>
        </div>
        <a
          href={finding.pubpeerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex flex-col items-center rounded border border-primary bg-white px-3 py-2 text-center text-sm font-medium leading-tight text-cyan-800 hover:bg-primary/10 transition-colors"
        >
          <span>View on</span>
          <span>PubPeer</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 32 24"
            className="mt-1 h-6 w-8"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 12h20" />
            <path d="M21 5.5l9 6.5-9 6.5z" fill="currentColor" stroke="none" />
          </svg>
        </a>
      </div>
    </Card>
  );
}

function OtherCard({ finding }: { finding: Finding }) {
  return (
    <Card className="p-5 border-black bg-white">
      <h3 className="font-clarendon font-semibold text-[1.0625rem] text-foreground mb-1">
        {finding.title}
      </h3>
      <Citation finding={finding} />
      <p className="mt-3 text-sm text-foreground/90 leading-relaxed">
        <span className="font-semibold">Main issues surfaced:</span> {finding.summary}
      </p>
      {finding.analyzed && (
        <p className="mt-3 text-xs text-foreground/60 mb-0">Analyzed on {finding.analyzed}</p>
      )}
    </Card>
  );
}

export default function ForensicAgentFindingsPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-4 py-12">
          <DocsBackLink
            href="/forensic-metascience-agent"
            label="return to the forensic metascience agent"
          />
          <h1 className="text-4xl font-bold mb-6 mt-0 text-foreground leading-tight">
            FMA Findings and PubPeer comments
          </h1>
          <p className="mb-4 leading-relaxed text-foreground/90 max-w-3xl">
            A running list of what the{" "}
            <a href="/forensic-metascience-agent" className="text-blue-600 hover:text-blue-700">
              Forensic Metascience Agent
            </a>{" "}
            has found. Every finding surfaced by the agent undergoes human review before anything is
            made public, and it takes a lot for something to rise to the level of a PubPeer report:
            most errors are simple mistakes.
          </p>

          <h2 className="text-2xl font-semibold mb-4 mt-10 text-foreground border-b border-border pb-2">
            Findings submitted to PubPeer
          </h2>
          <div className="space-y-4">
            {postedFindings.map((finding) => (
              <PostedCard key={finding.doi} finding={finding} />
            ))}
          </div>

          <h2 className="text-2xl font-semibold mb-4 mt-10 text-foreground border-b border-border pb-2">
            Not submitted to PubPeer
          </h2>
          <div className="space-y-4">
            {otherFindings.map((finding) => (
              <OtherCard key={finding.doi} finding={finding} />
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
