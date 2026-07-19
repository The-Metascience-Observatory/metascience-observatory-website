import "./globals.css";
import { ReactNode } from "react";
import { Providers } from "@/components/Providers";
import { Analytics } from "@vercel/analytics/next";
import { GoogleAnalytics } from "@next/third-parties/google";

export const metadata = {
  title: "The Metascience Observatory | Analyzing Scientific Reproducibility",
  description:
    "Using AI to analyze every scientific paper to assess reproducibility, rigor, and fraud across all fields of science.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/assets/globe.svg" type="image/svg+xml" />
        <link rel="icon" href="/assets/globe.png" type="image/png" />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
        <Analytics />
        {process.env.NEXT_PUBLIC_GA_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
        )}
      </body>
    </html>
  );
}


