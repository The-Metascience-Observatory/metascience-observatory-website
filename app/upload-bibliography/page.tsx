"use client";

import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Match = {
  doi: string;
  originalUrl: string;
  description: string;
  result: string;
  originalEs: number | null;
  replicationEs: number | null;
  originalEsType: string;
  replicationEsType: string;
  originalN: number | null;
  replicationN: number | null;
};

type ApiResponse = {
  message: string;
  matches: Match[];
  totalDois: number;
  matchedDois: number;
  error?: string;
};

function formatEffectSize(es: number | null, esType: string): string {
  if (es == null || !Number.isFinite(es)) return "N/A";
  const formatted = es.toPrecision(4);
  return `${formatted}${esType ? ` ${esType}` : ""}`;
}

export default function UploadBibliographyPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const ext = selectedFile.name.toLowerCase().split(".").pop();
      if (!["bib", "xml", "ris"].includes(ext || "")) {
        setError("Please select a .bib, .xml, or .ris file");
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload-bibliography", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        setError(data.error || "Failed to process file");
        return;
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-24 px-6 sm:px-8 md:px-12 lg:px-16 xl:px-24 py-10">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold mb-2">Upload Bibliography</h1>
          <p className="text-foreground/70 mb-8">
            Upload a bibliography file (.bib, .xml, or .ris) from your reference manager (e.g., Mendeley, Zotero) 
            to check if any of the papers in your bibliography have been replicated in our database.
          </p>

          <Card className="p-6 mb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="file" className="block text-sm font-medium mb-2">
                  Select Bibliography File
                </label>
                <input
                  id="file"
                  type="file"
                  accept=".bib,.xml,.ris"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-foreground/70
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary file:text-primary-foreground
                    hover:file:bg-primary/90
                    file:cursor-pointer
                    border border-border rounded-md p-2"
                  disabled={uploading}
                />
                <p className="text-xs text-foreground/60 mt-1">
                  Supported formats: .bib (BibTeX), .xml (BibTeX XML), .ris (RIS)
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-800 dark:text-red-200">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={!file || uploading} className="w-full sm:w-auto">
                {uploading ? "Processing..." : "Check Bibliography"}
              </Button>
            </form>
          </Card>

          {result && (
            <Card className="p-6">
              <h2 className="text-2xl font-semibold mb-4">Results</h2>
              
              <div className="mb-6 p-4 bg-muted rounded-md">
                <p className="font-medium mb-2">{result.message}</p>
                <div className="text-sm text-foreground/70 space-y-1">
                  <p>Total DOIs found in bibliography: {result.totalDois}</p>
                  <p>DOIs matched in database: {result.matchedDois}</p>
                </div>
              </div>

              {result.matches.length === 0 ? (
                <p className="text-foreground/70">
                  No matches found. None of the DOIs in your bibliography appear in our replication database.
                </p>
              ) : (
                <div className="space-y-6">
                  {result.matches.map((match, index) => (
                    <div key={index} className="border rounded-lg p-5 space-y-3">
                      <div>
                        <h3 className="font-semibold text-lg mb-2">Match {index + 1}</h3>
                        <p className="text-sm text-foreground/70">
                          <strong>DOI:</strong>{" "}
                          <a
                            href={match.originalUrl.startsWith("http") ? match.originalUrl : `https://doi.org/${match.doi}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {match.doi}
                          </a>
                        </p>
                      </div>

                      <div>
                        <h4 className="font-medium mb-1">Description of the replicated effect:</h4>
                        <p className="text-sm text-foreground/80">{match.description || "No description available"}</p>
                      </div>

                      <div>
                        <h4 className="font-medium mb-1">Replication Result:</h4>
                        <p className="text-sm">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              match.result === "success"
                                ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                                : match.result === "failure"
                                ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                            }`}
                          >
                            {match.result || "Not specified"}
                          </span>
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                        <div>
                          <h4 className="font-medium mb-2 text-sm">Original Study</h4>
                          <div className="text-sm space-y-1 text-foreground/80">
                            <p>
                              <strong>Effect Size:</strong> {formatEffectSize(match.originalEs, match.originalEsType)}
                            </p>
                            {match.originalN != null && (
                              <p>
                                <strong>Sample Size (N):</strong> {match.originalN}
                              </p>
                            )}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2 text-sm">Replication Study</h4>
                          <div className="text-sm space-y-1 text-foreground/80">
                            <p>
                              <strong>Effect Size:</strong> {formatEffectSize(match.replicationEs, match.replicationEsType)}
                            </p>
                            {match.replicationN != null && (
                              <p>
                                <strong>Sample Size (N):</strong> {match.replicationN}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}



