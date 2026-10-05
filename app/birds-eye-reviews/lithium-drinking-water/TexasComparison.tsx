"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const TexasComparisonContext = createContext<{ request: number; selectTexas: () => void } | null>(null);

export function TexasComparisonProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState(0);
  return <TexasComparisonContext.Provider value={{ request, selectTexas: () => setRequest(current => current + 1) }}>{children}</TexasComparisonContext.Provider>;
}

export function useTexasComparison() {
  const context = useContext(TexasComparisonContext);
  if (!context) throw new Error("Texas comparison controls require TexasComparisonProvider.");
  return context;
}

export function TexasComparisonButton() {
  const { selectTexas } = useTexasComparison();
  return <button type="button" onClick={selectTexas} className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-left text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Select Texas and compare Hidalgo &amp; Bexar</button>;
}
