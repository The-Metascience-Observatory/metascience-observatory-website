import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import Link from "next/link";

interface DocMeta {
  href: string;
  title: string;
}


const documentation: DocMeta[] = [
  {
    href: "/docs/defining-replication",
    title: "Defining replication",
  },
  {
    href: "/docs/data-dictionary",
    title: "Replications database data dictionary",
  },
  {
    href: "/docs/effect-size-normalization",
    title: "Effect size types and their normalization",
  },
  {
    href: "/docs/replication-outcome-classification",
    title: "Mathematical methods for classifying replication outcomes",
  },
  {
    href: "/docs/ontology",
    title: "Our Ontology for Classifying Paper Subjects",
  },
  {
    href: "/docs/pipeline-evaluation",
    title: "V6 extraction pipeline evaluation",
  },
  {
    href: "https://explore.metascienceobservatory.org/about",
    title: "Metascience Observatory Explorer Data Sources",
  },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-4 py-12 max-w-3xl">
          <h1 className="text-3xl font-bold mb-3 text-foreground">Technical Documentation</h1>
          <p className="mb-8 text-foreground/70">
            Essay-style pieces now live on the{" "}
            <Link href="/articles" className="text-blue-600 hover:text-blue-700 underline">
              Articles
            </Link>{" "}
            page.
          </p>
          <div className="space-y-4">
            {documentation.map((doc) => (
              <div key={doc.href}>
                <Link
                  href={doc.href}
                  className="text-blue-600 hover:text-blue-700 underline"
                >
                  {doc.title}
                </Link>
              </div>
            ))}
          </div>


        </div>
      </main>
      <Footer />
    </div>
  );
}
