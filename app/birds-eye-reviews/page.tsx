import { BirdsEyeNavbar } from "@/components/BirdsEyeNavbar";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Bird's Eye Reviews | The Metascience Observatory",
  description: "Pioneering a new type of large-scale systematic review, using interactive dashboards to convey information..",
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
  return (
    <div className="min-h-screen">
      <BirdsEyeNavbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-4 py-12 max-w-3xl">
          <Image
            src="/assets/looking_at_stars_cropped.png"
            alt="Looking at stars"
            width={800}
            height={400}
            className="w-full mb-8 rounded"
          />
          <div className="mb-6">
            <Link
              href="/overview-birds-eye-reviews"
              className="text-blue-600 hover:text-blue-700 underline"
            >
              About Bird&rsquo;s Eye Reviews
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {reviews.map((review) => (
              <Link key={review.href} href={review.href} className="group block">
                <Card className="p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/50">
                  <h2 className="font-clarendon text-xl font-bold text-foreground group-hover:text-blue-700">
                    {review.title} <span className="text-blue-600">&rarr;</span>
                  </h2>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
