import { Card } from "@/components/ui/card";
import Link from "next/link";

export const AdvisoryBoard = () => {
  return (
    <section id="advisory-board" className="py-8 scroll-mt-24">
      <div className="container px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center space-y-4">
            <h2 className="font-clarendon text-2xl md:text-3xl font-bold">
                Advisory Board
              </h2>
          </div>

          <Card className="p-8 md:p-10 shadow-lg">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">
                  <Link
                    href="https://goodscienceproject.org/about/stuart-buck/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Stuart Buck, Ph.D.
                  </Link>
                  <span className="ml-2 font-normal text-foreground/80">
                    -{" "}
                    <Link
                      href="https://goodscienceproject.org/about/stuart-buck/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Good Science Project
                    </Link>
                  </span>
                </h3>
              </div>

              {/* <div>
                <h3 className="text-lg font-semibold mb-1">
                  <Link
                    href="https://www.linkedin.com/in/james-heathers-phd-63a70240"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    James Heathers, Ph.D.
                  </Link>
                  <span className="ml-2 font-normal text-foreground/80">
                    -{" "}
                    <Link
                      href="http://medicalevidenceproject.org/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Medical Evidence Project
                    </Link>
                  </span>
                </h3>
              </div> */}

              <div>
                <h3 className="text-lg font-semibold mb-1">
                  <Link
                    href="https://www.gleech.org/about/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Gavin Leech, Ph.D.
                  </Link>
                  <span className="ml-2 font-normal text-foreground/80">
                    -{" "}
                    <Link
                      href="https://arbresearch.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Arb Research
                    </Link>
                  </span>
                </h3>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-1">
                  <Link
                    href="https://en.wikipedia.org/wiki/Preston_Estep"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Preston Estep III, Ph.D.
                  </Link>
                  <span className="ml-2 font-normal text-foreground/80">
                    -{" "}
                    <Link
                      href="http://mindfirst.foundation/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Mind First Foundation
                    </Link>
                  </span>
                </h3>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
};


