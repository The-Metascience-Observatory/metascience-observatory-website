import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Donate = () => {
  return (
    <section id="donate" className="pt-8 pb-14 scroll-mt-24">
      <div className="container px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center space-y-4">
            <h2 className="font-clarendon text-2xl md:text-3xl font-bold">Donate</h2>
          </div>

          <Card className="p-8 md:p-10 shadow-lg">
            <div className="space-y-6 text-center">

              <p className="text-foreground/90 leading-relaxed">
                The Metascience Observatory is fiscally sponsored by <a href="https://mindfirst.foundation/" target="_blank" rel="noopener noreferrer" className="underline">Mind First Foundation</a>, a 501(c)(3) nonprofit, so your donation is tax-deductible.
              </p>
              <Button size="lg" variant="hero" className="mt-4 ml-4" asChild>
                <a href="https://manifund.org/projects/llm-driven-metascience-observatory" target="_blank" rel="noopener noreferrer">
                  Donate via Manifund
                </a>
              </Button>

              <Button size="lg" variant="hero" className="mt-4 ml-4" asChild>
                <a href="https://www.paypal.com/ncp/payment/CW5LKALSFKY72" target="_blank" rel="noopener noreferrer">
                  Donate via PayPal
                </a>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
};

