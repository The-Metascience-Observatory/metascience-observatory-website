"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";

export const Hero = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inlineToastMessage, setInlineToastMessage] = useState<string | null>(null);
  const [showInlineToast, setShowInlineToast] = useState(false);
  const formWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showInlineToast) return;
    const timer = setTimeout(() => setShowInlineToast(false), 2500);
    return () => clearTimeout(timer);
  }, [showInlineToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setInlineToastMessage("Please enter your email address");
      setShowInlineToast(true);
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInlineToastMessage(data.error ?? "Something went wrong. Please try again.");
      } else {
        setInlineToastMessage("Thank you! Please check your email to confirm.");
        setEmail("");
      }
    } catch {
      setInlineToastMessage("Network error. Please try again.");
    } finally {
      setShowInlineToast(true);
      setIsSubmitting(false);
    }
  };

  return (
    <section className="pt-20 pb-10 md:pt-24 md:pb-16">
      <div className="container px-4">
        <div className="grid md:grid-cols-2 gap-6 items-center">
          <div className="space-y-8">
            <div className="space-y-4 text-base text-muted-foreground">
              <p className="font-medium text-foreground">
                Is science healthy? How do rigor and reproducibility vary across fields, journals, and institutions?
              </p>
              <p>
                At The Metascience Observatory, we are using AI to analyze scientific papers at scale to help answer these questions.
              </p>
            </div>

            <div ref={formWrapperRef} className="relative max-w-md">
              {showInlineToast && inlineToastMessage ? (
                <div className="absolute -top-12 left-0 right-0 z-20 flex justify-center">
                  <div className="rounded-md border bg-background px-4 py-2 text-xs text-foreground shadow-lg">
                    {inlineToastMessage}
                  </div>
                </div>
              ) : null}

              <form onSubmit={handleSubmit}>
                <p className="text-xs text-muted-foreground mt-3">Subscribe to our newsletter: </p>
                <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 h-12 text-sm"
                  disabled={isSubmitting}
                />
                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  disabled={isSubmitting}
                  className="h-12 px-8"
                >
                  {isSubmitting ? "Submitting..." : "Subscribe"}
                </Button>
                </div>
              </form>
            </div>
          </div>

          <div className="flex justify-center md:justify-end">
            <Image
              src="/assets/herschel-observatory.jpeg"
              alt="Historical observatory with telescope"
              width={323}
              height={404}
              className="max-w-md rounded-lg mix-blend-multiply dark:mix-blend-screen dark:invert"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
