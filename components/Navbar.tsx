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
              unoptimized
            />
            <h1 className="font-clarendon font-bold text-lg sm:text-xl text-foreground">
              The Metascience Observatory
            </h1>
          </Link>

          <div className="hidden md:flex items-center gap-3 text-xs">
            <Button variant="outline-gradient" size="sm" asChild className="border-gray-400 text-gray-600 dark:text-gray-400 bg-transparent">
              <Link href="/#about">
                About
              </Link>
            </Button>
            <Button variant="outline-gradient" size="sm" asChild className="border-gray-400 text-gray-600 dark:text-gray-400 bg-transparent">
              <Link href="/articles">
                Articles
              </Link>
            </Button>
            <Button variant="outline-gradient" size="sm" asChild className="border-gray-400 text-gray-600 dark:text-gray-400 bg-transparent">
              <Link href="/birds-eye-reviews">
                Reviews
              </Link>
            </Button>
            <Button variant="outline-gradient" size="sm" asChild className="border-gray-400 text-gray-600 dark:text-gray-400 bg-transparent">
              <Link href="https://explore.metascienceobservatory.org/">
                Explorer
              </Link>
            </Button>
            <Button variant="outline-gradient" size="sm" asChild className="border-gray-400 text-gray-600 dark:text-gray-400 bg-transparent">
              <Link href="/replications-database">
                Replications Database
              </Link>
            </Button>
            <Button variant="outline-gradient" size="sm" asChild className="ml-auto border-blue-500 text-blue-700 dark:text-blue-400 bg-transparent">
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
              <Button variant="outline-gradient" size="sm" asChild className="w-full justify-center border-gray-400 text-gray-600 dark:text-gray-400 bg-transparent">
                <Link href="/#about" onClick={() => setIsMobileMenuOpen(false)}>
                  About
                </Link>
              </Button>
              <Button variant="outline-gradient" size="sm" asChild className="w-full justify-center border-gray-400 text-gray-600 dark:text-gray-400 bg-transparent">
                <Link href="/articles" onClick={() => setIsMobileMenuOpen(false)}>
                  Articles
                </Link>
              </Button>
              <Button variant="outline-gradient" size="sm" asChild className="w-full justify-center border-gray-400 text-gray-600 dark:text-gray-400 bg-transparent">
                <Link href="/birds-eye-reviews" onClick={() => setIsMobileMenuOpen(false)}>
                  Reviews
                </Link>
              </Button>
              <Button variant="outline-gradient" size="sm" asChild className="w-full justify-center border-gray-400 text-gray-600 dark:text-gray-400 bg-transparent">
                <Link href="https://explore.metascienceobservatory.org/" onClick={() => setIsMobileMenuOpen(false)}>
                  Explorer
                </Link>
              </Button>
              <Button variant="outline-gradient" size="sm" asChild className="w-full justify-center border-gray-400 text-gray-600 dark:text-gray-400 bg-transparent">
                <Link href="/replications-database" onClick={() => setIsMobileMenuOpen(false)}>
                  Replications Database
                </Link>
              </Button>
              <Button variant="outline-gradient" size="sm" asChild className="w-full justify-center border-blue-500 text-blue-700 dark:text-blue-400 bg-transparent">
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
