import type { Metadata } from "next";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DocsBackLink } from "@/components/DocsBackLink";
import findings from "./findings.json";
import { VideoComparison } from "./VideoComparison";
import { FindingsDisclaimer } from "../FindingsDisclaimer";

export const metadata: Metadata = {
  title: "Image Findings and PubPeer Comments | The Metascience Observatory",
  description:
    "This page contains a continually-updated list of findings from the Forensic Metascience Agent image analysis system which we have submitted to PubPeer. Every finding undergoes thorough human review by Dan Elton and Greg Fitzgerald before submission.",
};

function displayAuthors(authors: string) {
  return authors.split(";").map((author) => {
    const name = author.trim();
    return name === name.toUpperCase()
      ? name.toLowerCase().replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
      : name;
  }).join("; ");
}

type FindingImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
  wide?: boolean;
  caption?: string;
};

function findingImages(finding: (typeof findings)[number]): FindingImage[] {
  if ("images" in finding && finding.images) {
    return finding.images.map((image) => ({
      src: image.src,
      width: image.width,
      height: image.height,
      alt: image.alt,
      wide: "wide" in image ? Boolean(image.wide) : undefined,
      caption: "caption" in image && typeof image.caption === "string" ? image.caption : undefined,
    }));
  }
  if (finding.image) {
    return [{
      src: finding.image.src,
      width: finding.image.width,
      height: finding.image.height,
      alt: finding.image.alt,
    }];
  }
  return [];
}

export default function ImageFindingsPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-4 py-12">
          <DocsBackLink
            href="/forensic-metascience-agent/findings"
            label="return to all forensic metascience findings"
          />
          <h1 className="text-4xl font-bold mb-6 mt-0 text-foreground leading-tight">
            FMA Image Findings and PubPeer comments
          </h1>
          <p className="mb-4 leading-relaxed text-foreground/90 max-w-4xl">
            This page contains a continually-updated list of findings from the
            Forensic Metascience Agent image analysis system which we have
            submitted to PubPeer. Every finding undergoes thorough human review
            by Dan Elton and Greg Fitzgerald before submission.
          </p>
          <FindingsDisclaimer />
          <h2 className="text-2xl font-semibold mb-6 mt-10 text-foreground border-b border-border pb-2">
            Image findings submitted to PubPeer
            <span className="ml-3 text-base font-normal text-muted-foreground">({findings.length} papers)</span>
          </h2>
          <div className="space-y-8">
            {findings.map((finding) => {
              const citation = finding.citation;
              const images = findingImages(finding);
              return (
                <article key={finding.doi} id={finding.id} className="scroll-mt-24 rounded-xl border border-foreground bg-card p-5 md:p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-clarendon font-semibold text-lg text-foreground mb-2 leading-snug">
                        <a href={`https://doi.org/${finding.doi}`} target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-4">
                          {citation.title}
                        </a>
                      </h3>
                      <p className="text-sm text-foreground/70 leading-relaxed">
                        {displayAuthors(citation.authors)}{citation.authors.endsWith(".") ? " " : ". "}
                        <i>{citation.journal}</i>{" "}<b>{citation.volume}</b>
                        {citation.issue && <>({citation.issue})</>}
                        {citation.pages && <>: {citation.pages.replace(/-/g, "–")}</>}
                        {" "}({citation.year}).{" "}
                        <a href={`https://doi.org/${finding.doi}`} target="_blank" rel="noopener noreferrer" className="underline decoration-foreground/30 underline-offset-2 break-all hover:text-foreground">
                          doi:{finding.doi}
                        </a>
                      </p>
                    </div>
                    <a href={finding.pubpeerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 self-start items-center gap-2 rounded-md border border-primary px-4 py-3 text-sm font-medium text-primary hover:bg-primary/10 transition-colors">
                      View on PubPeer <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </div>
                  <p className="mt-4 text-sm text-foreground/90 leading-relaxed">
                    <span className="font-semibold">Issue submitted:</span> {finding.summary}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Submitted <time dateTime={finding.submitted}>{new Date(`${finding.submitted}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}</time>.
                  </p>
                  {images.length > 0 && (
                    <div className="mt-5 space-y-6">
                      {images.map((image) => {
                        const isWide = Boolean(image.wide) || image.width / image.height >= 2.5;
                        return (
                          <figure key={image.src}>
                            <a href={image.src} target="_blank" rel="noopener noreferrer" className={`block mx-auto rounded-md border border-border overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${isWide ? "w-full max-w-4xl" : "w-1/2 max-w-md"}`} aria-label={`Open full-size comparison for ${citation.title}`}>
                              <Image src={image.src} alt={image.alt} width={image.width} height={image.height} sizes={isWide ? "(max-width: 960px) 100vw, 896px" : "(max-width: 960px) 50vw, 448px"} unoptimized className="h-auto w-full" />
                            </a>
                            {image.caption ? (
                              <figcaption className="mt-2 text-center text-xs text-muted-foreground">
                                {image.caption}
                              </figcaption>
                            ) : null}
                          </figure>
                        );
                      })}
                    </div>
                  )}
                  {finding.videoEmbedUrl && finding.videoUrl && finding.videoThumbnail && finding.videoCaption && (
                    <VideoComparison
                      embedUrl={finding.videoEmbedUrl}
                      videoUrl={finding.videoUrl}
                      title={citation.title}
                      thumbnailUrl={finding.videoThumbnail}
                      thumbnailAlt={"videoThumbnailAlt" in finding && typeof finding.videoThumbnailAlt === "string" ? finding.videoThumbnailAlt : `Preview of the video comparison for ${citation.title}`}
                      caption={finding.videoCaption}
                    />
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
