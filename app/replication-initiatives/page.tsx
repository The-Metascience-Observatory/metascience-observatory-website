import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { InitiativesList } from "./InitiativesList";
import { DocsBackLink } from "@/components/DocsBackLink";
import { loadInitiatives } from "./loadInitiatives";

// Map project names to their database initiative tags
const PROJECT_TO_TAG: Record<string, string> = {
  "Reproducibility Project: Psychology": "RP:P",
  "Camerer et al. – Experimental Economics Replication Project": "ExECON",
  "Camerer et al. – Nature/Science Social Science Replication Project": "SSRP",
  "Many Labs 1": "ML1",
  "Many Labs 2": "ML2",
  "Many Labs 5": "ML5",
  "Experimental Philosophy – Reproducibility Project": "XPHIR",
  "Brazilian Reproducibility Initiative": "BRI",
  "Reproducibility Project: Cancer Biology": "RP:CB",
  "Boyce et al. – Student Replication Projects": "SRP",
  "Motoki and Iseki – Sensory Marketing Replication": "SMR",
  "Soto – Life Outcomes of Personality Replication Project": "Soto et al LOPPRP",
  "Estimating the Replicability of Sports and Exercise Science Research": "RSESR",
  "Examining Replicability of Online Experiments (Holzmeister et al.)": "EROE",
  "Social Psychology Special Issue on Registered Replication Reports": "SPRRR",
  "Clearer Thinking's Transparent Replication Project": "TRs",
  "Tyner et al. – DARPA SCORE Social & Behavioural Sciences Replication Project": "socsci_2026",
  "International Initiative for Impact Evaluation Replication Paper Series": "3ie",
  "Sobkow et al. – Fifteen JDM Effects Conceptual Replication (Polish Sample)": "JDM:PL",
};

export default function ReplicationProjectsPage() {
  const fieldGroups = loadInitiatives(
    "previous_replication_initiatives.csv",
    PROJECT_TO_TAG
  );

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-4 py-12 max-w-5xl">
          <DocsBackLink href="/articles" label="return to articles" />
          <h1 className="text-4xl font-bold mb-4 text-foreground">
            Replication initiatives
          </h1>
          <p className="text-foreground/70 leading-relaxed mb-8">
            Initiatives that primarily re-run studies on newly collected data.
            For initiatives centered on computational reproduction, robustness
            checks, and other re-analyses of the original data, see our{" "}
            <a
              href="/reanalysis-initiatives"
              className="text-primary hover:underline"
            >
              re-analysis initiatives
            </a>{" "}
            page.
          </p>

          {fieldGroups.length === 0 ? (
            <p className="text-foreground/60">
              No data found. Make sure{" "}
              <code className="font-mono">
                data/previous_replication_initiatives.csv
              </code>{" "}
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
