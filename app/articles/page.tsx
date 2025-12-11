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
    date: "12-10-2025",
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



