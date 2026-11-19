"use client";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { About } from "@/components/About";
import { Team } from "@/components/Team";
import { Boards } from "@/components/Boards";
import { Collaborators } from "@/components/Collaborators";
import { Donate } from "@/components/Donate";
import { Footer } from "@/components/Footer";

export default function Page() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <About />
      <Team />
      <Boards />
      <Collaborators />
      <Donate />
      <Footer />
    </div>
  );
}


