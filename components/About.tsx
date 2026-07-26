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
    href: "/overview-replication-database",
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
    href: "/overview-birds-eye-reviews",
    title: "Bird's Eye Reviews",
    description:
      "A new form of AI-powered high-level literature review where results are displayed in an interactive dashboard with filtering options.",
  },
];

export const About = () => {
  return (
    <section id="about" className="pt-8 pb-8 scroll-mt-24">
      <div className="container px-4">
        <div className="max-w-6xl mx-auto md:space-y-6">
          {/* Desktop heading. On mobile this text is overlaid on the banner below instead. */}
          <div className="hidden md:block text-center space-y-4">
            <h2 className="font-clarendon text-3xl font-bold">About</h2>
            <p className="text-foreground/90 leading-relaxed">
              The Metascience Observatory has three major projects:
            </p>
          </div>

          <div className="space-y-8 md:space-y-0 md:grid md:grid-cols-5 md:gap-10 md:items-center">
            {/* Full-width overlaid banner on mobile; portrait image in the left column on desktop */}
            <div className="relative w-full h-56 sm:h-64 overflow-hidden rounded-lg shadow-lg md:h-auto md:aspect-[4/5] md:max-w-[360px] md:col-span-2">
              <Image
                src="/assets/woodcut-looking-at-world.jpeg"
                alt="Woodcut illustration of a person observing the world"
                fill
                sizes="(max-width: 767px) 100vw, 360px"
                priority
                className="object-cover object-center"
              />
              <div className="absolute inset-0 bg-black/55 md:hidden" />
              <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center md:hidden">
                <h2 className="font-clarendon text-3xl font-bold text-white drop-shadow-lg">
                  About
                </h2>
                <p className="mt-2 max-w-xl text-base text-white/90 drop-shadow">
                  The Metascience Observatory has three major projects:
                </p>
              </div>
            </div>

            {/* Project cards — stacked vertically beside the image on desktop */}
            <div className="md:col-span-3 space-y-6 md:space-y-4">
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
      </div>
    </section>
  );
};
