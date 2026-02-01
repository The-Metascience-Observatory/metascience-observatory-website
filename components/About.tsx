import { Card } from "@/components/ui/card";
import Link from "next/link";
import Image from "next/image";

export const About = () => {
  return (
    <section id="about" className="py-20 scroll-mt-1 bg-gradient-to-b from-background to-muted/30">
      <div className="container px-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="text-center space-y-4">
            <h2 className="font-clarendon text-2xl md:text-3xl font-bold">About</h2>
          </div>

          <div className="grid md:grid-cols-5 gap-10 items-center" >
            <div className="flex justify-center md:justify-start md:col-span-2">
              <Image
                src="/assets/woodcut-looking-at-world.jpeg"
                alt="Woodcut illustration of a person observing the world"
                width={400}
                height={500}
                className="max-w-lg rounded-lg shadow-lg object-cover h-auto"
                priority
              />
            </div>

            <Card className="p-[30px] md:p-[38px] shadow-lg hover:shadow-xl transition-shadow md:col-span-3">
              <div className="space-y-6 text-foreground/90 leading-relaxed">
              <p>
                The first major project of The Metascience Observatory is to build a <Link href="/replications-database" className="underline">public database of experimental replications across all of science</Link>. There have already been several great studies assessing reproducibility, most famously in <Link href="https://www.science.org/doi/10.1126/science.aac4716" target="_blank" rel="noopener noreferrer" className="underline">psychology</Link> and <Link href="https://www.cos.io/rpcb" target="_blank" rel="noopener noreferrer" className="underline">cancer biology</Link>. These were large, concerted efforts requiring large teams and lots of funding.
              </p>
              <p>
                However, there are also one-off "garden variety" replication attempts. They are rare (perhaps 1% of papers), but there are thousands out there. Using both manual curation and AI/LLMs, we are creating a database of replications and compiling statistics on how reproducibility varies across fields, including fields like materials science and engineering, where insights into reproducibility are scarce.
              </p>
              <p>
                A database of replications will enable new avenues of metascience research looking at "correlates of reproducibility". Additionally, we will be able to do p-curve analysis, z-curve analysis, and funnel plots at a larger scale than was possible before.
              </p>
              <p>
                Longer term, we hope to create a reproducibility ranking for journals. Reproducibility rankings for journals could improve science by shifting focus away from impact factor (citation counts) towards the actual quality and rigor of scientific work. Previous work <Link href="https://www.pnas.org/doi/10.1073/pnas.1909046117" target="_blank" rel="noopener noreferrer" className="underline">shows that</Link> citation counts are not correlated with reproducibility and that citation count is positively correlated with the chance that a paper will be retracted.
              </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

