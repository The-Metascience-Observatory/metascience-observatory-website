import { BirdsEyeNavbar } from "@/components/BirdsEyeNavbar";
import { Footer } from "@/components/Footer";
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
              href="/docs/about-birds-eye-reviews"
              className="text-blue-600 hover:text-blue-700 underline"
            >
              About Bird&rsquo;s Eye Reviews
            </Link>
          </div>
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.href}>
                <Link
                  href={review.href}
                  className="text-2xl font-bold text-blue-600 hover:text-blue-700 underline"
                >
                  {review.title}
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
