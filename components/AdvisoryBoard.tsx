import { Card } from "@/components/ui/card";
import Link from "next/link";

export const AdvisoryBoard = () => {
  return (
    <section id="advisory-board" className="scroll-mt-24 flex flex-col gap-6">
          <div className="text-center space-y-4">
            <h2 className="font-clarendon text-2xl md:text-3xl font-bold">
                Metascientific <br className="hidden md:inline" />
                Advisory Board
              </h2>
          </div>

          <Card className="flex-1 p-8 md:p-10 shadow-lg border-black">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">
                  <Link
                    href="https://www.linkedin.com/in/paullitvak/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Paul Litvak, Ph.D.
                  </Link>
                  <span className="ml-2 font-normal text-foreground/80">
                    -{" "}
                    <Link
                      href="https://www.dawes.institute/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Robin Dawes Institute
                    </Link>
                  </span>
                </h3>
              </div>

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
            </div>
          </Card>
    </section>
  );
};


