import type { Metadata } from "next";
import Link from "next/link";
import { ReplicationsNavbar } from "@/components/ReplicationsNavbar";
import { Footer } from "@/components/Footer";
import {
  FredAcknowledgment,
  PerryAcknowledgment,
} from "@/components/ReplicationAcknowledgments";
import { initiativeReferences } from "./references";

export const metadata: Metadata = {
  title: "Sources | Metascience Observatory",
  description:
    "Data acknowledgments and references for the replication initiatives represented in the Metascience Observatory Replications Database.",
};

export default function SourcesPage() {
  return (
    <div className="min-h-screen">
      <ReplicationsNavbar />
      <main className="container mx-auto max-w-5xl px-4 pt-28 pb-16">
        <h1 className="text-4xl font-bold text-foreground mb-4">Sources used to assemble the replications database</h1>
        <section aria-labelledby="forrt-heading" className="space-y-4 text-sm leading-relaxed text-foreground-strong mb-12">
          <h2 id="forrt-heading" className="text-2xl font-semibold">
            FORRT FReD and FLoRA
          </h2>
          <div className="space-y-4"><FredAcknowledgment expanded /></div>
        </section>

        <section aria-labelledby="education-heading" className="space-y-4 text-sm leading-relaxed text-foreground-strong mb-12">
          <h2 id="education-heading" className="text-2xl font-semibold">
            "A decade of replication study in education.."
          </h2>
          <div className="space-y-4"><PerryAcknowledgment expanded /></div>
        </section>

        <section aria-labelledby="initiative-references-heading">
          <h2 id="initiative-references-heading" className="text-2xl font-semibold mb-3">
            Replication initiatives
          </h2>
          <p className="text-foreground-strong leading-relaxed mb-8">
            Data from {initiativeReferences.length} replication initiatives was imported
            with the help of Claude Code. After each import some manual checks were
            done to verify the integrity of the import. Here we provide references
            for each source. See <Link href="/replication-initiatives" className="underline">replication initiatives page</Link> for
            more info on these initiatives.
          </p>
          <ul className="space-y-6">
            {initiativeReferences.map((reference) => (
              <li key={reference.tag} className="border-b border-border pb-6">
                <h3 className="font-semibold text-foreground mb-2">
                  {reference.initiative}{" "}
                  <span className="font-normal text-sm text-muted-foreground">
                    ({reference.tag})
                  </span>
                </h3>
                <p className="leading-relaxed text-foreground/90">
                  {reference.authors},{" "}
                  <a href={reference.url} className="underline underline-offset-2 hover:text-primary">
                    “{reference.title}”
                  </a>
                  , <em>{reference.venue}</em>
                  {reference.volume && <>, <strong>{reference.volume}</strong></>}
                  {reference.issue && <>({reference.issue})</>}
                  {reference.pages && <>, pp. {reference.pages}</>}
                  {reference.articleNumber && <>, {reference.articleNumber}</>}, {reference.year}.
                </p>
                {reference.note && (
                  <p className="mt-2 text-sm text-muted-foreground">{reference.note}</p>
                )}
              </li>
            ))}
          </ul>
        </section>

        <Link href="/replications-database" className="mt-8 inline-block text-primary underline">
          ← Back to the Replications Database
        </Link>
      </main>
      <Footer />
    </div>
  );
}
