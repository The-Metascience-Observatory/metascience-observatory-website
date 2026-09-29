import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { FitMatrix } from "../FitMatrix";

export const metadata: Metadata = {
  title: "Research integrity landscape preview | The Metascience Observatory",
  robots: { index: false, follow: false },
};

export default function LandscapePreviewPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-4 py-12">
          <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="text-muted-foreground">Temporary preview · Compact rows</span>
            <Link
              href="/forensic-metascience-ai-toolkit#where-this-toolkit-fits-in-the-ai-for-research-integrity-landscape"
              className="text-primary underline underline-offset-4"
            >
              View original
            </Link>
          </div>
          <h1 className="text-2xl font-semibold mb-4 text-foreground border-b border-border pb-2">
            Where this toolkit fits in the AI for research integrity landscape
          </h1>
          <FitMatrix compact boxedLabels={false} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
