import fs from "fs";
import path from "path";
import Link from "next/link";
import { BirdsEyeNavbar } from "@/components/BirdsEyeNavbar";
import { Footer } from "@/components/Footer";
import { PrismaDiagram, PrismaCounts } from "./PrismaDiagram";

export const metadata = {
  title: "Screening | Lithium & Weight Gain | Bird's Eye Reviews | The Metascience Observatory",
  description:
    "How 24,918 search results were narrowed to the studies reporting weight change under lithium — every exclusion counted.",
};

const DATA_DIR = "data/birds_eye_reviews/lithium_weight_gain";

function loadPrisma(): PrismaCounts | null {
  const fp = path.join(process.cwd(), DATA_DIR, "prisma.json");
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf-8")) as PrismaCounts;
  } catch {
    return null;
  }
}

export default function ScreeningPage() {
  const prisma = loadPrisma();

  return (
    <>
      <BirdsEyeNavbar />
      <main className="container mx-auto px-4 pt-24 pb-16 min-h-screen">
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
          <Link
            href="/birds-eye-reviews/lithium-weight-gain"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            &larr; Back to Lithium &amp; Weight Gain
          </Link>
        </div>

        <h1 className="font-clarendon font-bold text-3xl mb-2">Screening process</h1>
        <p className="mb-8 max-w-3xl text-sm text-foreground/70">
          Every number below is measured from the pipeline&apos;s own artifacts
          rather than entered by hand. Papers we could not obtain are counted
          openly — an unread paper is a limitation of the review, not an
          exclusion from it.
        </p>

        {prisma ? (
          <PrismaDiagram c={prisma} />
        ) : (
          <p className="text-sm text-foreground/50">
            Screening data has not been generated for this review yet.
          </p>
        )}
      </main>
      <Footer />
    </>
  );
}
