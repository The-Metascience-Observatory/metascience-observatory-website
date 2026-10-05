import fs from "fs";
import path from "path";
import Link from "next/link";
import { BirdsEyeNavbar } from "@/components/BirdsEyeNavbar";
import { Footer } from "@/components/Footer";
import { PrismaDiagram, PrismaCounts } from "./PrismaDiagram";
import { EXCLUDED_DOIS } from "../utils";

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
  const raw = loadPrisma();
  // The dashboard hand-excludes a few spurious extractions (EXCLUDED_DOIS in
  // ../utils — e.g. a metformin trial where lithium is only a renal tracer),
  // so the "displayed on dashboard" box must count what is actually shown.
  const prisma = raw
    ? { ...raw, with_weight_outcome: raw.with_weight_outcome - EXCLUDED_DOIS.size }
    : null;

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
        <p className="mb-8 max-w-3xl text-sm text-foreground">
          Unlike other Bird&apos;s Eye Reviews we had to screen using the full text, not
          just looking at abstracts, since weight gain information is typically not
          mentioned in abstracts.
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
