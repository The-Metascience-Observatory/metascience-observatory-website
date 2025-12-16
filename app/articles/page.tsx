import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import Link from "next/link";

interface ArticleMeta {
  href: string;
  title: string;
  date: string;
}

const articles: ArticleMeta[] = [
  {
    href: "/replication-projects",
    title: "Previous replication initiatives",
    date: "2025-12-10",
  },
  {
    href: "https://moreisdifferent.substack.com/p/german-scientific-paternalism-and-the-golden-age",
    title: "The golden age of German science (1880 - 1930)",
    date: "2025-01-28",
  },
  {
    href: "https://www.asimov.press/p/peer-review",
    title: "A Defense of Peer Review (Asimov Press)",
    date: "2024-10-22",
  },
  {
    href: "https://moreisdifferent.blog/p/wth-is-cerebrolysin-actually",
    title: "WTH is Cerebrolysin, actually?",
    date: "2024-08-05",
  },
  {
    href: "https://moreisdifferent.substack.com/p/how-common-is-scientific-fraud",
    title: "How common is scientific fraud?",
    date: "2023-08-05",
  },
  {
    href: "https://moreisdifferent.substack.com/p/the-deluge-of-crappy-papers-must",
    title: "The deluge of crappy papers must stop",
    date: "2022-02-28",
  },
  {
    href: "https://moreisdifferent.substack.com/p/ai-for-covid-19-diagnosis-a-case",
    title: "AI for COVID-19 diagnosis - a case study in bad incentives",
    date: "2021-04-15",
  },
];

export default function ArticlesPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-4 py-12 max-w-3xl">
          <h1 className="text-4xl font-bold mb-8 text-foreground">Articles</h1>
          <div className="space-y-4">
            {articles.map((article) => (
              <div key={article.href} className="flex items-baseline gap-3">
                <span className="text-sm text-foreground/60">
                  {article.date}
                </span>
                <Link
                  href={article.href}
                  className="text-blue-600 hover:text-blue-700 underline"
                >
                  {article.title}
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



