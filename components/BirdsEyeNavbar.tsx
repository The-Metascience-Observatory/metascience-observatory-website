"use client";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const BirdsEyeNavbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/birds-eye-reviews" aria-label="Birds Eye Reviews home" className="flex items-center gap-3">
            <Image
              src="/assets/globe.svg"
              alt="Globe"
              width={40}
              height={40}
            />
            <h1 className="font-clarendon font-bold text-lg sm:text-xl text-foreground">
              The Metascience Observatory: Bird&apos;s Eye Reviews
            </h1>
          </Link>

          <div className="hidden md:flex items-center gap-4 text-sm">
            <Link href="/#about" className="text-foreground/80 hover:text-foreground transition-colors">About</Link>
            <Link href="/#team" className="text-foreground/80 hover:text-foreground transition-colors">Team</Link>
            <Link href="/roadmap" className="text-foreground/80 hover:text-foreground transition-colors">Roadmap</Link>
            <Link href="/docs" className="text-foreground/80 hover:text-foreground transition-colors">Docs</Link>
            <Link href="/#donate" className="text-foreground/80 hover:text-foreground transition-colors">Donate</Link>
            <Button variant="outline" size="sm" asChild>
              <Link href="https://explore.metascienceobservatory.org/" target="_blank" rel="noopener noreferrer">
                Explorer
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};
