import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { InitiativesList } from "../replication-initiatives/InitiativesList";
import { DocsBackLink } from "@/components/DocsBackLink";
import { loadInitiatives } from "../replication-initiatives/loadInitiatives";

// Map project names to their database initiative tags (only initiatives with
// rows in the replications database belong here).
const PROJECT_TO_TAG: Record<string, string> = {};

export default function ReanalysisInitiativesPage() {
  const fieldGroups = loadInitiatives(
    "reanalysis_initiatives.csv",
    PROJECT_TO_TAG
  );

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-4 py-12 max-w-5xl">
          <DocsBackLink href="/articles" label="return to articles" />
          <h1 className="text-4xl font-bold mb-4 text-foreground">
            Re-analysis initiatives
          </h1>
          <p className="text-foreground/70 leading-relaxed mb-8">
            Initiatives that assess published research by re-analyzing the
            original study&apos;s data rather than collecting new data: computational
            reproduction (re-running the original code and data),{" "}
            <a
              href="/docs/defining-replication"
              className="text-primary hover:underline"
            >
              technical replication
            </a>
            , robustness checks that vary analytical decisions, and similar
            re-analyses. For initiatives that re-run studies on newly collected
            data, see our{" "}
            <a
              href="/replication-initiatives"
              className="text-primary hover:underline"
            >
              replication initiatives
            </a>{" "}
            page.
          </p>

          {fieldGroups.length === 0 ? (
            <p className="text-foreground/60">
              No data found. Make sure{" "}
              <code className="font-mono">data/reanalysis_initiatives.csv</code>{" "}
              exists and has at least one row.
            </p>
          ) : (
            <InitiativesList fieldGroups={fieldGroups} />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
