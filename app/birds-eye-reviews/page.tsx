import fs from "fs";
import path from "path";
import { BirdsEyeNavbar } from "@/components/BirdsEyeNavbar";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { MarkdownContent } from "@/components/MarkdownContent";
import { FunnelFigure } from "./FunnelFigure";
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Bird's Eye Reviews | The Metascience Observatory",
  description: "Explore Bird's Eye Reviews: large-scale literature reviews with interactive dashboards, and learn how they work.",
};

interface ReviewMeta {
  href: string;
  title: string;
}

const reviews: ReviewMeta[] = [
  {
    href: "/birds-eye-reviews/long-covid",
    title: "Long Covid",
  },
  {
    href: "/birds-eye-reviews/antiviral-nasal-sprays",
    title: "Antiviral Nasal Sprays",
  },
  {
    href: "/birds-eye-reviews/restless-legs-syndrome",
    title: "Restless Legs Syndrome",
  },
  // Hidden for now — the ME/CFS review isn't ready to be listed publicly.
  // {
  //   href: "/birds-eye-reviews/me-cfs",
  //   title: "ME/CFS",
  // },
  {
    href: "/birds-eye-reviews/lithium-weight-gain",
    title: "Lithium and weight gain",
  },
];

export default function BirdsEyeReviewsPage() {
  const content = fs.readFileSync(
    path.join(process.cwd(), "content/docs/birds-eye-reviews.md"),
    "utf-8",
  );
  const [, body = ""] = content.split("<!-- FIGURE -->");

  return (
    <div className="min-h-screen">
      <BirdsEyeNavbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto mb-8">
            <Image
              src="/assets/looking_at_stars_clean.png"
              alt="Woodcut of two figures among stars"
              width={2048}
              height={768}
              sizes="(max-width: 800px) calc(100vw - 32px), 768px"
              className="w-full h-auto rounded"
            />
          </div>
          <h2 className="max-w-3xl mx-auto mb-4 font-clarendon text-2xl font-bold text-foreground">
            Explore Bird&apos;s Eye Reviews
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 max-w-3xl mx-auto mb-12">
            {reviews.map((review) => (
              <Link key={review.href} href={review.href} className="group block">
                <Card className="p-5 border border-gray-600 shadow-sm transition-all hover:shadow-md hover:border-gray-800">
                  <h2 className="font-clarendon text-xl font-bold text-foreground group-hover:text-blue-700">
                    {review.title} <span className="text-blue-600">&rarr;</span>
                  </h2>
                </Card>
              </Link>
            ))}
          </div>
          <h2 className="max-w-3xl mx-auto mb-4 font-clarendon text-2xl font-bold text-foreground">
            About Bird&apos;s Eye Reviews
          </h2>
          <FunnelFigure />
          <div className="max-w-3xl mx-auto">
            <MarkdownContent content={body} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
