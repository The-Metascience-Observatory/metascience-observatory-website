import { Card } from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";

const ExternalLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} target="_blank" rel="noopener noreferrer" className="underline">
    {children}
  </Link>
);

export const Collaborators = () => {
  return (
    <section id="collaborators" className="py-8 scroll-mt-24">
      <div className="container px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center space-y-4">
            <h2 className="font-clarendon text-2xl md:text-3xl font-bold">
              Collaborators
            </h2>
          </div>

          <Card className="p-8 md:p-10 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <Link
                href="https://forrt.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 self-center"
              >
                <Image
                  src="/assets/collaborators/forrt_logo.png"
                  alt="FORRT logo"
                  width={270}
                  height={270}
                  className="w-36 h-auto"
                />
              </Link>
              <p className="text-foreground/80 leading-relaxed">
                Since October 2026 we have been working with{" "}
                <ExternalLink href="https://flavioazevedo.com/">Flavio Azevedo</ExternalLink>,{" "}
                <ExternalLink href="https://www.lukaswallrich.coffee/">Lukas Wallrich</ExternalLink>, and{" "}
                <ExternalLink href="https://lukasroeseler.github.io/home/">Lukas Röseler</ExternalLink>{" "}
                from FORRT to merge our replications database project in with their{" "}
                <ExternalLink href="https://forrt.org/flora-explorer/">FLoRA</ExternalLink> effort.{" "}
                <ExternalLink href="https://forrt.org/">FORRT</ExternalLink> (Framework for Open and
                Reproducible Research Training) is a global volunteer-led initiative &ldquo;advancing
                research transparency, reproducibility, rigor, and ethics through pedagogical reform
                and meta-scientific research.&rdquo;
              </p>
            </div>

            <hr className="my-8 border-border" />

            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <Link
                href="https://blacklight.science/"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 self-center"
              >
                <Image
                  src="/assets/collaborators/blacklight_logo.png"
                  alt="Blacklight logo"
                  width={540}
                  height={300}
                  className="w-36 h-auto"
                />
              </Link>
              <p className="text-foreground/80 leading-relaxed">
                <ExternalLink href="https://derikk.com/">Derik Kauffman</ExternalLink> &ndash;{" "}
                <ExternalLink href="https://blacklight.science/">Blacklight</ExternalLink>
              </p>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
};
