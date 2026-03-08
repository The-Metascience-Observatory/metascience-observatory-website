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
            <h1 className="font-clarendon font-bold text-lg sm:text-xl text-foreground">
              The Metascience Observatory
            </h1>
          </Link>

          <div className="hidden md:flex items-center gap-3 text-xs">
            <Link href="/#about" className="text-foreground/80 hover:text-foreground transition-colors">About</Link>
            <Link href="/#team" className="text-foreground/80 hover:text-foreground transition-colors">Team</Link>
            <Button variant="outline-gradient" size="sm" asChild className="border-gray-400 text-gray-600 dark:text-gray-400 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
              <Link href="/docs">
                Docs
              </Link>
            </Button>
            <Button variant="outline-gradient" size="sm" asChild className="border-teal-500 text-teal-700 dark:text-teal-400 bg-gradient-to-r from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900">
              <Link href="/birds-eye-reviews">
                Reviews
              </Link>
            </Button>
            <Button variant="outline-gradient" size="sm" asChild className="border-violet-500 text-violet-700 dark:text-violet-400 bg-gradient-to-r from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900">
              <Link href="https://explore.metascienceobservatory.org/" target="_blank" rel="noopener noreferrer">
                Explorer
              </Link>
            </Button>
            <Button variant="outline-gradient" size="sm" asChild className="border-sky-500 text-sky-700 dark:text-sky-400 bg-gradient-to-r from-sky-50 to-sky-100 dark:from-sky-950 dark:to-sky-900">
              <Link href="/replications-database">
                Replications Database
              </Link>
            </Button>
            <Button variant="outline-gradient" size="sm" asChild className="ml-auto border-red-500 text-red-700 dark:text-red-400 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-950 dark:to-red-900">
              <Link href="/#donate">
                Donate
              </Link>
            </Button>
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
              <Button variant="outline-gradient" size="sm" asChild className="w-full justify-center border-gray-400 text-gray-600 dark:text-gray-400 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
                <Link href="/docs" onClick={() => setIsMobileMenuOpen(false)}>
                  Docs
                </Link>
              </Button>
              <Button variant="outline-gradient" size="sm" asChild className="w-full justify-center border-teal-500 text-teal-700 dark:text-teal-400 bg-gradient-to-r from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900">
                <Link href="/birds-eye-reviews" onClick={() => setIsMobileMenuOpen(false)}>
                  Reviews
                </Link>
              </Button>
              <Button variant="outline-gradient" size="sm" asChild className="w-full justify-center border-violet-500 text-violet-700 dark:text-violet-400 bg-gradient-to-r from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900">
                <Link href="https://explore.metascienceobservatory.org/" target="_blank" rel="noopener noreferrer" onClick={() => setIsMobileMenuOpen(false)}>
                  Explorer
                </Link>
              </Button>
              <Button variant="outline-gradient" size="sm" asChild className="w-full justify-center border-sky-500 text-sky-700 dark:text-sky-400 bg-gradient-to-r from-sky-50 to-sky-100 dark:from-sky-950 dark:to-sky-900">
                <Link href="/replications-database" onClick={() => setIsMobileMenuOpen(false)}>
                  Replications Database
                </Link>
              </Button>
              <Button variant="outline-gradient" size="sm" asChild className="w-full justify-center border-red-500 text-red-700 dark:text-red-400 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-950 dark:to-red-900">
                <Link href="/#donate" onClick={() => setIsMobileMenuOpen(false)}>
                  Donate
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
