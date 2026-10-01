import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Copyright and licensing | The Metascience Observatory",
  description: "Copyright terms for the website and the MIT exception for data ingestion code.",
};

export default function LicensingPage() {
  const terms = fs.readFileSync(path.join(process.cwd(), "LICENSE"), "utf8");
  const mitLicense = fs.readFileSync(
    path.join(process.cwd(), "data_ingestor", "LICENSE"),
    "utf8",
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container mx-auto max-w-4xl px-4 pb-16 pt-28">
        <h1 className="mb-8 text-3xl font-bold">Copyright and licensing</h1>
        <div className="space-y-5 leading-relaxed">
          {terms.trim().split("\n\n").map((paragraph, index) =>
            paragraph.includes("\n") ? (
              <p key={index}>{paragraph.replace(/\n/g, " ")}</p>
            ) : paragraph.startsWith("Permission requests:") ? (
              <p key={index}>
                Permission requests: <a className="underline hover:text-primary" href="mailto:info@metascienceobservatory.org">info@metascienceobservatory.org</a>
              </p>
            ) : (
              <h2 key={index} className="pt-4 text-xl font-semibold">{paragraph}</h2>
            ),
          )}
        </div>
        <section className="mt-12" aria-labelledby="mit-license">
          <h2 id="mit-license" className="mb-5 text-xl font-semibold">Data ingestion code: MIT License</h2>
          <pre className="whitespace-pre-wrap break-words rounded-lg border border-border bg-muted p-6 font-mono text-sm leading-relaxed">
            {mitLicense}
          </pre>
        </section>
      </main>
      <Footer />
    </div>
  );
}
