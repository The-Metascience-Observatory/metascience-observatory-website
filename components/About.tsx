import { Card } from "@/components/ui/card";
import Link from "next/link";
import Image from "next/image";

interface ProjectMeta {
  /** Where the card links. Omit for a project with no public page yet; the card is then not clickable. */
  href?: string;
  title: string;
  /** Short one-line purpose shown under the title, in smaller text. */
  tagline: string;
  description?: string;
  /** Square woodcut shown left of the text, shared with the Articles page. */
  image: string;
  alt: string;
}

const projects: ProjectMeta[] = [
  {
    // Planned address: forensics.metascienceobservatory.org (not deployed yet).
    image: "/assets/woodcut_square_crops/flammarion_square_crop.png",
    alt: "Detail of the Flammarion engraving: a traveller peering through the edge of the starry sky",
    title: "Scaling forensic metascience",
    tagline: "Scanning millions of scientific papers for major issues using custom tools",
  },
  {
    href: "/forensic-metascience-ai-toolkit",
    image: "/assets/woodcut_square_crops/microscope_square.png",
    alt: "Engraving of a labeled compound microscope",
    title: "Forensic metascience AI toolkit",
    tagline: "For AI peer review and deep paper auditing",
    description:
      "A toolkit with 30+ tools for detecting statistical inconsistencies and data integrity anomalies in scientific papers. Can be used at low cost with an AI subscription (Claude Code, Codex, etc.)",
  },
  {
    href: "/replications-database",
    image: "/assets/woodcut_square_crops/square_1610_library_Leiden_tighter.png",
    alt: "Engraving of two scholars reading chained books in the 1610 Leiden university library",
    title: "Replications Database",
    tagline: "For tracking replicability across fields, time, and space",
    description:
      "The world's largest collection of information on replication experiments.",
  },
  {
    href: "/birds-eye-reviews",
    image: "/assets/woodcut_square_crops/looking-at-stars-close-crop.png",
    alt: "Woodcut of two figures among stars",
    title: "Bird's Eye Reviews",
    tagline: "For rapid high-level understanding of all literature on a topic",
    description:
      "Experiments in AI-powered high-level literature review where results are displayed in an interactive dashboard.",
  },
  {
    href: "https://explore.metascienceobservatory.org/",
    image: "/assets/woodcut_square_crops/1556_agricola_digging.png",
    alt: "Woodcut of two miners sorting ore into a pan, from Agricola's De re metallica (1556)",
    title: "The Metascience Observatory Explorer",
    tagline: "For metascientific research",
    description:
      "Integrating open source scientometrics data into one unified interface.",
  },
];

export const About = () => {
  return (
    <section id="about" className="pt-8 pb-8 scroll-mt-24">
      <div className="container px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center space-y-4">
            <h2 className="font-clarendon text-2xl md:text-3xl font-bold">Projects</h2>
          </div>

            <div className="space-y-6 md:space-y-4">
              {projects.map((project) => {
                const card = (
                  <Card
                    className={`flex flex-row items-center gap-4 sm:gap-6 p-2 sm:p-2.5 shadow-lg transition-all ${
                      project.href ? "group-hover:shadow-xl group-hover:border-primary" : ""
                    }`}
                  >
                    <Image
                      src={project.image}
                      alt={project.alt}
                      width={144}
                      height={144}
                      className="w-24 h-24 sm:w-36 sm:h-36 shrink-0 rounded-md object-cover"
                    />
                    <div className="flex flex-col py-2 pr-2 sm:pr-4">
                      <h3
                        className={`font-clarendon font-semibold text-lg text-foreground transition-colors ${
                          project.href ? "group-hover:text-primary" : ""
                        }`}
                      >
                        {project.title}
                      </h3>
                      <p className={`text-sm italic text-black ${project.description ? "mb-2" : ""}`}>
                        {project.tagline}
                      </p>
                      {project.description && (
                        <p className="text-sm text-foreground/90 leading-relaxed">
                          {project.description}
                        </p>
                      )}
                    </div>
                  </Card>
                );
                return project.href ? (
                  <Link
                    key={project.title}
                    href={project.href}
                    className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    {card}
                  </Link>
                ) : (
                  <div key={project.title}>{card}</div>
                );
              })}
            </div>
        </div>
      </div>
    </section>
  );
};
