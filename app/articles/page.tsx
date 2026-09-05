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
    href: "/overview-replication-database",
    title: "Replications\nDatabase",
    image: "/assets/woodcut_square_crops/square_1610_library_Leiden.png",
    alt: "Engraving of two scholars reading chained books in the 1610 Leiden university library",
  },
  {
    href: "/forensic-metascience-agent",
    title: "Forensic Metascience Agent",
    image: "/assets/woodcut_square_crops/radiometer_square.png",
    alt: "Woodcut of a Crookes radiometer",
  },
  {
    href: "/birds-eye-reviews",
    title: "Bird's Eye\nReviews",
    image: "/assets/woodcut_square_crops/flying_machine_square.png",
    alt: "Woodcut of an aerial flying machine",
  },
  {
    href: "/overview-explorer",
    title: "Metascience Observatory Explorer",
    image: "/assets/woodcut_square_crops/microscope_square.png",
    alt: "Engraving of a labeled compound microscope",
  },
];

const articles: ArticleMeta[] = [
  {
    href: "https://moreisdifferent.blog/p/what-weve-learned-so-far-at-the-metascience",
    title: "What we've learned\nso far (Aug 2026)",
    image: "/assets/woodcut_square_crops/1556_agricola_digging.png",
    alt:
      "Woodcut of two miners sorting ore into a pan, from Agricola's De re metallica (1556)",
  },
  {
    href: "/replication-initiatives",
    title: "Replication\ninitiatives",
    image: "/assets/woodcut_square_crops/john_milton_watch_1631.png",
    alt: "Engraving of John Milton's 1631 pocket watch",
  },
  {
    href: "/reanalysis-initiatives",
    title: "Re-analysis\ninitiatives",
    image: "/assets/woodcut_square_crops/ancient_table_watch_1525.png",
    alt: "Engraving of an ornate 1525 table watch",
  },
  {
    href: "/docs/other-initiatives",
    title: "Other replication database initiatives",
    image: "/assets/woodcut_square_crops/polar_clock_square.png",
    alt: "Woodcut of a telescope on a stand",
  },
  {
    href: "/docs/defining-replication",
    title: "Defining\nreplication",
    image: "/assets/woodcut_square_crops/compass_square.png",
    alt: "Woodcut of a weather vane compass",
  },
  {
    href: "/articles/nature-2016-reproducibility-survey",
    title: "Nature's 2016 reproducibility survey",
    image: "/assets/woodcut_square_crops/carriage_clock.png",
    alt: "Woodcut of an ornate carriage clock",
  },
];

// Mirrors the link cluster on the replications database page itself, minus its
// "Show other pages" disclosure control (which is UI, not a page) and minus the
// correlates-of-reproducibility summary, which is deliberately not surfaced here
// (it is still linked from the replications database page).
const replicationsDatabasePages: DocMeta[] = [
  {
    href: "/replications-database/by-discipline",
    title: "Replication rate by discipline",
  },
  {
    href: "/replications-database/by-journal",
    title: "Replication rate by journal",
  },
  {
    href: "/replications-database/by-p-value",
    title: "Replication rate by original p-value",
  },
  {
    href: "/replications-database/by-impact-factor",
    title: "Replication rate by journal impact factor",
  },
  {
    href: "/replications-database/by-journal-rank",
    title: "Replication rate by journal rank",
  },
  {
    href: "/replications-database/by-citation-count",
    title: "Replication rate by citation count",
  },
  {
    href: "/replications-database/by-h-index",
    title: "Replication rate by author h-index",
  },
  {
    href: "/replications-database/by-author-overlap",
    title: "Replication rate by author overlap",
  },
  {
    href: "/replications-database/by-year",
    title: "Replication rate by year",
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
    title: "Our ontology for classifying paper subjects",
  },
  {
    href: "/docs/pipeline-evaluation",
    title: "V6 extraction pipeline evaluation",
  },
  {
    href: "/docs/checking-for-bias",
    title: 'Checking for bias by comparing with "random sampled" replication initiatives',
  },
  {
    href: "/forensic-metascience-agent/tools",
    title: "Forensic Metascience Agent tools",
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
    date: "2024-08-05",
    title: "WTH is Cerebrolysin, actually?",
    href: "https://moreisdifferent.blog/p/wth-is-cerebrolysin-actually",
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

const newsletters: SubstackMeta[] = [
  {
    date: "2026-08-04",
    title: "Newsletter #3 — Q2, 2026",
    href: "https://metascienceobservatory.substack.com/p/newsletter-3-q2-2026",
  },
  {
    date: "2026-04-23",
    title: "Newsletter #2 — Q1, 2026",
    href: "https://metascienceobservatory.substack.com/p/the-metascience-observatory-newsletter",
  },
  {
    date: "2026-01-29",
    title: "Newsletter #1",
    href: "https://metascienceobservatory.substack.com/p/metascience-observatory-newsletter",
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {projectOverviews.map((project) => (
              <Link key={project.href} href={project.href} className="group block">
                <Card className="aspect-square flex flex-col overflow-hidden border-border transition-colors hover:border-primary/50 hover:shadow-md">
                  <div className="relative flex-1 min-h-0 overflow-hidden bg-muted">
                    <Image
                      src={project.image}
                      alt={project.alt}
                      fill
                      sizes="(max-width: 1024px) 50vw, 25vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-3 shrink-0">
                    <h2 className="font-clarendon font-semibold text-sm sm:text-base text-foreground text-center whitespace-pre-line line-clamp-3">
                      {project.title}
                    </h2>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          <h2 className="text-2xl font-bold mt-16 mb-6 text-foreground">Articles and Pages</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {articles.map((article) => (
              <Link
                key={article.href}
                href={article.href}
                className="group block"
                // Some entries point off-site (e.g. the Substack essay).
                {...(article.href.startsWith("http")
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                <Card className="aspect-square flex flex-col overflow-hidden border-border transition-colors hover:border-primary/50 hover:shadow-md">
                  <div className="relative flex-1 min-h-0 overflow-hidden bg-muted">
                    <Image
                      src={article.image}
                      alt={article.alt}
                      fill
                      sizes="(max-width: 1024px) 50vw, 25vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-3 shrink-0">
                    <h2 className="font-clarendon font-semibold text-sm sm:text-base text-foreground text-center whitespace-pre-line line-clamp-3">
                      {article.title}
                    </h2>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mt-16">
            <div>
              <h2 className="text-2xl font-bold mb-3 text-foreground">
                Replications Database Pages
              </h2>
              <div className="space-y-4">
                {replicationsDatabasePages.map((page) => (
                  <div key={page.href}>
                    <Link
                      href={page.href}
                      className="text-foreground hover:text-foreground/70 underline"
                    >
                      {page.title}
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-3 text-foreground">
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
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mt-16">
            <div>
              <h2 className="text-2xl font-bold mb-3 text-foreground">
                Metascience articles by Dan Elton
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

            <div>
              <h2 className="text-2xl font-bold mb-3 text-foreground">
                Newsletters
              </h2>
              <div className="space-y-4">
                {newsletters.map((item) => (
                  <div key={item.title}>
                    <span className="text-foreground/60 mr-2">{item.date}</span>
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="text-foreground hover:text-foreground/70 underline"
                      >
                        {item.title}
                      </Link>
                    ) : (
                      <span className="text-foreground">{item.title}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
