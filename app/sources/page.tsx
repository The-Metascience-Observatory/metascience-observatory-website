import type { Metadata } from "next";
import Link from "next/link";
import { ReplicationsNavbar } from "@/components/ReplicationsNavbar";
import { Footer } from "@/components/Footer";
import {
  FredAcknowledgment,
  FloraAcknowledgment,
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
        <h1 className="text-4xl font-bold text-foreground mb-4">Sources</h1>
        <section aria-label="Data acknowledgments" className="space-y-4 text-sm leading-relaxed text-foreground/80 mb-12">
          <p><FredAcknowledgment /></p>
          <p><FloraAcknowledgment /></p>
          <p><PerryAcknowledgment /></p>
        </section>

        <section aria-labelledby="initiative-references-heading">
          <h2 id="initiative-references-heading" className="text-2xl font-semibold mb-3">
            Replication initiatives
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-8">
            References for the {initiativeReferences.length} replication initiatives
            represented in the database. For initiatives spanning multiple
            publications, we cite the project overview or series; individual study
            references are available in the database.
          </p>
          <ul className="space-y-6">
            {initiativeReferences.map((reference) => (
              <li key={reference.tag} className="border-b border-border pb-6 last:border-0">
                <h3 className="font-semibold text-foreground mb-2">
                  {reference.initiative}{" "}
                  <span className="font-normal text-sm text-muted-foreground">
                    ({reference.tag})
                  </span>
                </h3>
                <p className="leading-relaxed text-foreground/90">
                  {reference.authors} ({reference.year}).{" "}
                  <a href={reference.url} className="underline underline-offset-2 hover:text-primary">
                    {reference.title}
                  </a>
                  . <em>{reference.venue}</em>
                  {reference.volume && <>, <em>{reference.volume}</em></>}
                  {reference.issue && <>({reference.issue})</>}
                  {reference.pages && <>, {reference.pages}</>}
                  {reference.articleNumber && <>, {reference.articleNumber}</>}.
                </p>
                <a
                  href={reference.url}
                  className="mt-1 inline-block break-all text-sm text-primary underline underline-offset-2"
                >
                  {reference.url}
                </a>
                {reference.note && (
                  <p className="mt-2 text-sm text-muted-foreground">{reference.note}</p>
                )}
              </li>
            ))}
          </ul>
        </section>

        <Link href="/replications-database" className="mt-8 inline-block text-primary underline">
          Back to the Replications Database
        </Link>
      </main>
      <Footer />
    </div>
  );
}
