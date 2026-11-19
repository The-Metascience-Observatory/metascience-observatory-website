import fs from "fs";
import path from "path";
import { BirdsEyeNavbar } from "@/components/BirdsEyeNavbar";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { MarkdownContent } from "@/components/MarkdownContent";
import { FunnelFigure } from "./FunnelFigure";
import Link from "next/link";
import Image from "next/image";

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
          <div className="max-w-3xl mx-auto md:max-w-6xl md:grid md:grid-cols-[minmax(0,280px)_minmax(0,48rem)] md:justify-center md:gap-10 md:items-start">
            <div className="relative hidden md:block w-full aspect-[4/5] overflow-hidden rounded-lg shadow-lg md:sticky md:top-24">
              <Image
                src="/assets/woodcut-looking-at-world.jpeg"
                alt="Woodcut illustration of a person observing the world"
                fill
                sizes="280px"
                className="object-cover object-center"
              />
            </div>
            <div className="min-w-0">
              <MarkdownContent content={body} />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
