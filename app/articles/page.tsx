import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Articles | The Metascience Observatory",
  description: "Essays, background pieces, and documentation from the Metascience Observatory.",
};

interface ArticleMeta {
  href: string;
  title: string;
  image: string;
  alt: string;
}

interface DocMeta {
  href: string;
  title: string;
}

interface SubstackMeta {
  date: string;
  title: string;
  href?: string;
}

const projectOverviews: ArticleMeta[] = [
  {
    href: "/replication-database-overview",
    title: "Replications Database",
    image: "/assets/herschel-observatory-cropped.png",
    alt: "Engraving of the Herschel observatory telescope",
  },
  {
    href: "/forensic-metascience-agent",
    title: "Forensic Metascience Agent",
    image: "/assets/woodcut_square_crops/radiometer_square.png",
    alt: "Woodcut of a Crookes radiometer",
  },
  {
    href: "/birds-eye-review-overview",
    title: "Bird's Eye Reviews",
    image: "/assets/woodcut_square_crops/flying_machine_square.png",
    alt: "Woodcut of an aerial flying machine",
  },
];

const articles: ArticleMeta[] = [
  {
    href: "/replication-initiatives",
    title: "Replication initiatives",
    image: "/assets/woodcut_square_crops/watch_square.png",
    alt: "Woodcut of an ornate watch face marked with many cities",
  },
  {
    href: "/docs/previous-initiatives",
    title: "Previous replication database initiatives",
    image: "/assets/woodcut_square_crops/polar_clock_square.png",
    alt: "Woodcut of a telescope on a stand",
  },
  {
    href: "/docs/defining-replication",
    title: "Defining replication",
    image: "/assets/woodcut_square_crops/compass_square.png",
    alt: "Woodcut of a weather vane compass",
  },
];

const documentation: DocMeta[] = [
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

const substackArticles: SubstackMeta[] = [
  {
    date: "2025-01-28",
    title: "The golden age of German science (1880 - 1930)",
    href: "https://moreisdifferent.blog/p/german-scientific-paternalism",
  },
  {
    date: "2024-10-22",
    title: "A Defense of Peer Review",
    href: "https://www.asimov.press/p/peer-review",
  },
  {
    date: "2024-10-21",
    title:
      'When "weak links" in science matter — high profile fraud in Alzheimer\'s disease research',
    href: "https://moreisdifferent.blog/p/when-weak-links-in-science-matter",
  },
  {
    date: "2023-08-05",
    title: "How common is scientific fraud?",
    href: "https://moreisdifferent.substack.com/p/how-common-is-scientific-fraud",
  },
  {
    date: "2022-02-28",
    title: "The deluge of crappy papers must stop",
    href: "https://moreisdifferent.substack.com/p/the-deluge-of-crappy-papers-must",
  },
];

export default function ArticlesPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-4 py-12 max-w-5xl">
          <h1 className="text-3xl font-bold mb-8 text-foreground">Articles</h1>

          <h2 className="text-2xl font-bold mb-6 text-foreground">Project Overviews</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projectOverviews.map((project) => (
              <Link key={project.href} href={project.href} className="group block">
                <Card className="aspect-square flex flex-col overflow-hidden border-border transition-colors hover:border-primary/50 hover:shadow-md">
                  <div className="relative flex-1 min-h-0 overflow-hidden bg-muted">
                    <Image
                      src={project.image}
                      alt={project.alt}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-3 shrink-0">
                    <h2 className="font-clarendon font-semibold text-base text-foreground line-clamp-2">
                      {project.title}
                    </h2>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          <h2 className="text-2xl font-bold mt-16 mb-6 text-foreground">Articles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => (
              <Link key={article.href} href={article.href} className="group block">
                <Card className="aspect-square flex flex-col overflow-hidden border-border transition-colors hover:border-primary/50 hover:shadow-md">
                  <div className="relative flex-1 min-h-0 overflow-hidden bg-muted">
                    <Image
                      src={article.image}
                      alt={article.alt}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-3 shrink-0">
                    <h2 className="font-clarendon font-semibold text-base text-foreground line-clamp-2">
                      {article.title}
                    </h2>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          <h2 className="text-2xl font-bold mt-16 mb-3 text-foreground">
            Technical Documentation
          </h2>
          <div className="space-y-4">
            {documentation.map((doc) => (
              <div key={doc.href}>
                <Link
                  href={doc.href}
                  className="text-foreground hover:text-foreground/70 underline"
                >
                  {doc.title}
                </Link>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-bold mt-16 mb-3 text-foreground">
            Metascience Substack articles by Dan Elton
          </h2>
          <div className="space-y-4">
            {substackArticles.map((article) => (
              <div key={article.title}>
                <span className="text-foreground/60 mr-2">{article.date}</span>
                {article.href ? (
                  <Link
                    href={article.href}
                    className="text-foreground hover:text-foreground/70 underline"
                  >
                    {article.title}
                  </Link>
                ) : (
                  <span className="text-foreground">{article.title}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
