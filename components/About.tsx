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
    <section id="about" className="pt-8 pb-8 scroll-mt-1">
      <div className="container px-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="text-center space-y-4">
            <h2 className="font-clarendon text-2xl md:text-3xl font-bold">About</h2>
            <p className="text-foreground/90 leading-relaxed">
              The Metascience Observatory has three major projects:
            </p>
          </div>

          <div className="grid md:grid-cols-5 gap-10 items-center">
            <div className="flex justify-center md:justify-start md:col-span-2">
              <Image
                src="/assets/woodcut-looking-at-world.jpeg"
                alt="Woodcut illustration of a person observing the world"
                width={360}
                height={450}
                className="max-w-md rounded-lg shadow-lg object-cover h-auto"
                priority
              />
            </div>

            <div className="md:col-span-3 space-y-4">
              {projects.map((project) => (
                <Card
                  key={project.href}
                  className="p-6 shadow-lg hover:shadow-xl transition-shadow"
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
