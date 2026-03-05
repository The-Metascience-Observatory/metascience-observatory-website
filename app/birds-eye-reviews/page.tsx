import { BirdsEyeNavbar } from "@/components/BirdsEyeNavbar";
import { Footer } from "@/components/Footer";
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Bird's Eye Reviews | The Metascience Observatory",
  description: "Interactive dashboards into publication data on specific research subjects.",
};

interface ReviewMeta {
  href: string;
  title: string;
  description: string;
}

const reviews: ReviewMeta[] = [
  {
    href: "/birds-eye-reviews/long-covid",
    title: "Long Covid",
    description: "Interactive dashboard into publication data on Long Covid research.",
  },
];

export default function BirdsEyeReviewsPage() {
  return (
    <div className="min-h-screen">
      <BirdsEyeNavbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-4 py-12 max-w-3xl">
          <Image
            src="/assets/bird-up-high-woodcut.png"
            alt="Bird's eye view woodcut"
            width={800}
            height={400}
            className="w-full mb-8 rounded"
          />
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
