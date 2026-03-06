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
    href: "/replication-initiatives",
    title: "Replication initiatives",
  },
  {
    href: "/docs/previous-initiatives",
    title: "Previous replication database initiatives",
  },
  {
    href: "/docs/ontology",
    title: "Our ontology for classifying papers",
  },
  {
    href: "/docs/pipeline-evaluation",
    title: "V6 extraction pipeline evaluation",
  },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-4 py-12 max-w-3xl">
          <h1 className="text-3xl font-bold mb-8 text-foreground">Documentation (continually updated)</h1>
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
