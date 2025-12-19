"use client";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";

export const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Go to homepage" className="flex items-center gap-3">
            <Image
              src="/assets/globe.svg"
              alt="Globe"
              width={40}
              height={40}
            />
            <h1 className="font-clarendon font-bold text-xl sm:text-2xl text-foreground">
              The Metascience Observatory
            </h1>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/#about" className="text-foreground/80 hover:text-foreground transition-colors">About</Link>
            <Link href="/#team" className="text-foreground/80 hover:text-foreground transition-colors">Team</Link>
            <Link href="/approach" className="text-foreground/80 hover:text-foreground transition-colors">Approach</Link>
            <Link href="/articles" className="text-foreground/80 hover:text-foreground transition-colors">Articles</Link>
            <Link href="/#donate" className="text-foreground/80 hover:text-foreground transition-colors">Donate</Link>
            <Button variant="outline" size="sm" asChild>
              <Link href="/replications-database">
                Replications Database
              </Link>
            </Button>
            {/* <Button variant="outline" size="sm" asChild>
              <Link href="https://explore.metascienceobservatory.org/" target="_blank" rel="noopener noreferrer">
                SciSci-V2 Explorer
              </Link>
            </Button> */}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-foreground/80 hover:text-foreground transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {isMobileMenuOpen ? (
                <path d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-border mt-3 pt-3 pb-3">
            <div className="flex flex-col gap-3">
              <Link
                href="/#about"
                className="text-foreground/80 hover:text-foreground transition-colors py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                About
              </Link>
              <Link
                href="/#team"
                className="text-foreground/80 hover:text-foreground transition-colors py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Team
              </Link>
              <Link
                href="/approach"
                className="text-foreground/80 hover:text-foreground transition-colors py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Approach
              </Link>
              <Link
                href="/articles"
                className="text-foreground/80 hover:text-foreground transition-colors py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Articles
              </Link>
              <Link
                href="/#donate"
                className="text-foreground/80 hover:text-foreground transition-colors py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Donate
              </Link>
              <Button variant="outline" size="sm" asChild className="w-full justify-center">
                <Link href="/replications-database" onClick={() => setIsMobileMenuOpen(false)}>
                  Replications Database
                </Link>
              </Button>
              {/* <Button variant="outline" size="sm" asChild className="w-full justify-center">
                <Link href="https://explore.metascienceobservatory.org/" target="_blank" rel="noopener noreferrer" onClick={() => setIsMobileMenuOpen(false)}>
                  SciSci-V2 Explorer
                </Link>
              </Button> */}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};


