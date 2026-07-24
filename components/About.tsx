import { Card } from "@/components/ui/card";
import Link from "next/link";
import Image from "next/image";

interface ProjectMeta {
  href: string;
  title: string;
  description: string;
}

const projects: ProjectMeta[] = [
  {
    href: "/replication-database-overview",
    title: "Replications Database",
    description:
      "The world's largest collection information on replication experiments, spanning all of science, enabling research on how reproducibility varies across fields.",
  },
  {
    href: "/forensic-metascience-agent",
    title: "Forensic Metascience Agent",
    description:
      "An AI agent equipped with 30+ tools for detecting statistical inconsistencies and data-integrity anomalies in scientific papers.",
  },
  {
    href: "/birds-eye-review-overview",
    title: "Bird's Eye Reviews",
    description:
      "A new form of AI-powered high-level literature review where results are displayed in an interactive dashboard with filtering options.",
  },
];

export const About = () => {
  return (
    <section id="about" className="pt-8 pb-8 scroll-mt-24">
      <div className="container px-4">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Heading + intro overlaid on the woodcut banner */}
          <div className="relative w-full h-56 sm:h-64 md:h-72 overflow-hidden rounded-lg shadow-lg">
            <Image
              src="/assets/woodcut-looking-at-world.jpeg"
              alt="Woodcut illustration of a person observing the world"
              fill
              sizes="(max-width: 1152px) 100vw, 1152px"
              priority
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-black/55" />
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              <h2 className="font-clarendon text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
                About
              </h2>
              <p className="mt-2 max-w-xl text-base md:text-lg text-white/90 drop-shadow">
                The Metascience Observatory has three major projects:
              </p>
            </div>
          </div>

          {/* Project cards */}
          <div className="grid gap-6 md:grid-cols-3">
            {projects.map((project) => (
              <Card
                key={project.href}
                className="flex flex-col p-6 shadow-lg hover:shadow-xl transition-shadow"
              >
                <h3 className="font-clarendon font-semibold text-lg text-foreground mb-2">
                  {project.title}
                </h3>
                <p className="text-sm text-foreground/90 leading-relaxed">
                  {project.description}{" "}
                  <Link
                    href={project.href}
                    className="font-medium text-blue-600 hover:text-blue-700 underline"
                  >
                    Read more &rarr;
                  </Link>
                </p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
