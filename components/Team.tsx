import { Card } from "@/components/ui/card";
import { Users } from "lucide-react";
import Image from "next/image";

export const Team = () => {
  return (
    <section id="team" className="py-12 scroll-mt-24">
      <div className="container px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3">
              <Users className="w-10 h-10 text-primary" />
              <h2 className="font-clarendon text-2xl md:text-3xl font-bold">Team</h2>
            </div>
          </div>

          <Card className="p-8 md:p-10 shadow-lg">
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <Image 
                    src="/assets/dan_elton_podium_cropped.png"
                    alt="Dan Elton, Ph.D."
                    width={192}
                    height={192}
                    className="w-48 h-48 object-cover rounded-lg"
                  />
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      <span>Dan Elton, Ph.D.</span>
                      <span className="ml-2 font-normal text-foreground/80">- Founder and Director</span>
                    </h3>
                    <p className="text-foreground/90 leading-relaxed">
                    Dan spent 15 years in academic research before founding The Metascience Observatory. He has co-authored about 50 peer-reviewed papers in physics, materials science, and AI for healthcare. On <a href="https://moreisdifferent.blog/">his Substack</a> he writes about AI, progress, metascience, and other topics. 
                    </p>
                  </div>
              </div>
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <Image 
                  src="/assets/greg_fitzgerald.png"
                  alt="Greg Fitzgerald"
                  width={192}
                  height={192}
                  className="w-48 h-48 object-cover rounded-lg"
                />
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                      <span>Greg Fitzgerald</span>
                      <span className="ml-2 font-normal text-foreground/80">- Prompt Engineer and meta-analysis expert</span>
                    </h3>
                  <p className="text-foreground/90 leading-relaxed">
                    Greg Fitzgerald is a neuroscience Ph.D. student at the State University of New York, Albany. 
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
};

