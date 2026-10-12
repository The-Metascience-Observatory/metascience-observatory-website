// Capability columns of the fit matrix. Add a new column here and tick it in
// each company's `capabilities` list.
const CAPABILITIES = [
  { key: "image_within", label: "Within-paper image duplication and manipulation" },
  { key: "image_between", label: "Between-paper image duplication" },
  { key: "dataset_si", label: "SI/SM/Dataverse copy-paste errors" },
  { key: "dataset_repo", label: "Open Source Repo dataset copy-paste errors" },
  { key: "phrases", label: "Tortured phrases" },
  { key: "ai_text", label: "AI text detection" },
  { key: "plagiarism", label: "Plagiarism detection" },
  { key: "stats", label: "Check stats and arithmetic" },
  { key: "ai_review", label: "AI peer review" },
] as const;

type CapabilityKey = (typeof CAPABILITIES)[number]["key"];

interface ToolCompany {
  name: string;
  href?: string;
  /** Logo image; the name renders as text when absent. */
  src?: string;
  /** Render the name as text next to the logo. */
  showName?: boolean;
  /** This project's row — site-primary accent. */
  highlight?: boolean;
  capabilities: CapabilityKey[];
  /** Capabilities partially covered — rendered as a half-filled (diagonal) box. */
  partial?: CapabilityKey[];
  /** Cost per paper at list price, as checked on the vendor's pricing page. */
  cost: string;
  /** Tooltip explaining where `cost` comes from. */
  costNote: string;
}

const companies: ToolCompany[] = [
  {
    name: "Proofig AI",
    href: "https://www.proofig.com/",
    src: "/assets/forensic/proofig_logo.png",
    capabilities: ["image_within", "image_between"],
    cost: "$25–33",
    costNote:
      "Pay-as-you-go packs: $99 for 3 submissions down to $549 for 22 (proofig.com/pricing-page, Oct 2026). Multi-user and enterprise pricing on request.",
  },
  {
    name: "ImageTwin",
    href: "https://imagetwin.ai/",
    src: "/assets/forensic/imagetwin_logo.png",
    capabilities: ["image_within", "image_between"],
    cost: "$29",
    costNote:
      "€29 (≈$29) for a single scan; bulk plans go down to €3.50/scan (imagetwin.ai/pricing, Oct 2026).",
  },
  {
    name: "ReviewerZero",
    href: "https://www.reviewerzero.ai/",
    src: "/assets/forensic/reviewerzero_logo.png",
    capabilities: ["image_within", "image_between", "phrases", "ai_text", "plagiarism", "ai_review"],
    partial: ["stats"],
    cost: "??",
    costNote:
      "No public pricing; plans are scoped per customer after a demo (reviewerzero.ai/pricing, Oct 2026).",
  },
  {
    name: "River Valley Technologies",
    href: "https://rivervalley.io/",
    src: "/assets/forensic/river_valley_tech_logo.png",
    showName: true,
    capabilities: ["phrases"],
    partial: ["image_within", "stats"],
    cost: "??",
    costNote:
      "Integrity checks are bundled into the ReView 3.0 submission system sold to publishers; no per-paper pricing is published.",
  },
  {
    name: "Refine",
    href: "https://refine.ink/",
    src: "/assets/forensic/refine_logo.png",
    capabilities: ["phrases", "ai_review"],
    cost: "$30–50",
    costNote:
      "$49.99 for one review, $299.99 for ten (refine.ink/pricing, Oct 2026).",
  },
  {
    name: "iThenticate",
    href: "https://www.ithenticate.com/",
    src: "/assets/forensic/ithenticate.png",
    capabilities: ["plagiarism"],
    cost: "$100–125",
    costNote:
      "$125 for one manuscript up to 25,000 words; $300 for three (ithenticate.com/pricing, Oct 2026). Organizational pricing is custom.",
  },
  {
    name: "Reviewer 3",
    href: "https://reviewer3.com/home",
    src: "/assets/forensic/reviewer3_logo.png",
    showName: true,
    capabilities: ["ai_review"],
    cost: "$19",
    costNote:
      "$19 for a one-time review, or $29/month for unlimited reviews (reviewer3.com/pricing, Oct 2026).",
  },
  {
    name: "ScienceDetective.org",
    href: "https://www.sciencedetective.org/scientific-datasets-are-riddled-with-copy-paste-errors/",
    src: "/assets/forensic/science_detective_logo.png",
    showName: true,
    capabilities: ["dataset_repo"],
    cost: "n/a",
    costNote:
      "Open-source (github.com/markusenglund/copy-paste-detective); grant-funded, no usage fees.",
  },
  {
    name: "Forensic Metascience AI toolkit",
    src: "/assets/globe.svg",
    showName: true,
    highlight: true,
    capabilities: ["image_within", "stats", "dataset_si", "ai_review"],
    partial: ["phrases", "image_between"],
    cost: "$0.50–1.00*",
    costNote:
      "AI API cost of a full run, depending on paper length and model provider. The image and copy-paste modules alone cost pennies per paper.",
  },
];

type BoxFill = "full" | "half" | "none";

function CapabilityBox({ fill }: { fill: BoxFill }) {
  const label = fill === "full" ? "Covered" : fill === "half" ? "Partial" : "Not covered";
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex h-5 w-5 overflow-hidden rounded border ${
        fill === "none" ? "border-foreground/25 bg-white" : "border-primary bg-white"
      }`}
    >
      {fill === "full" && <span className="h-full w-full bg-primary" />}
      {fill === "half" && (
        <svg viewBox="0 0 16 16" className="h-full w-full text-primary" aria-hidden>
          <polygon points="0,0 16,16 0,16" fill="currentColor" />
        </svg>
      )}
    </span>
  );
}

export function FitMatrix({
  compact = false,
  boxedLabels = true,
}: {
  compact?: boolean;
  boxedLabels?: boolean;
}) {
  return (
    <div className="overflow-x-auto my-8">
      <table className={`border-collapse mx-auto ${boxedLabels ? "" : "border-b border-border"}`}>
        <thead>
          <tr>
            <th className="w-56" aria-label="Tool" />
            {CAPABILITIES.map((cap) => (
              <th key={cap.key} className="relative h-64 w-12 p-0 align-bottom" title={cap.label}>
                <div className="absolute bottom-1 left-1/2 origin-bottom-left -rotate-45 whitespace-nowrap text-xs font-medium text-foreground">
                  {cap.label}
                </div>
              </th>
            ))}
            <th className="relative h-64 w-28 p-0 align-bottom">
              <div className="absolute bottom-1 left-6 origin-bottom-left -rotate-45 whitespace-nowrap text-xs font-semibold text-foreground">
                Cost per paper
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr
              key={company.name}
              className={`border-t border-border ${company.highlight ? "bg-primary/5" : ""}`}
            >
              <td className={`${compact ? "py-0.5" : "py-2"} pr-4`}>
                {(() => {
                  const chipContent = (
                    <>
                      {company.src && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={company.src}
                          alt={`${company.name} logo`}
                          className="max-h-5 w-auto"
                        />
                      )}
                      {(!company.src || company.showName) && (
                        <span
                          className={`${
                            company.highlight ? "whitespace-normal leading-tight" : "truncate"
                          } text-xs font-medium text-foreground ${company.src ? "ml-2" : ""}`}
                        >
                          {company.name}
                        </span>
                      )}
                    </>
                  );
                  const chipClass = `flex ${
                    compact
                      ? company.highlight ? "h-8" : "h-7"
                      : company.highlight ? "h-12" : "h-9"
                  } w-56 items-center px-3 ${boxedLabels ? "rounded border border-border bg-white" : ""}`;
                  return company.href ? (
                    <a
                      href={company.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={company.name}
                      className={`${chipClass} ${boxedLabels ? "hover:shadow-md transition-shadow" : "hover:opacity-80 transition-opacity"}`}
                    >
                      {chipContent}
                    </a>
                  ) : (
                    <div className={chipClass}>{chipContent}</div>
                  );
                })()}
              </td>
              {CAPABILITIES.map((cap) => (
                <td key={cap.key} className={`px-2 ${compact ? "py-0.5" : "py-2"} text-center`}>
                  <CapabilityBox
                    fill={
                      company.capabilities.includes(cap.key)
                        ? "full"
                        : company.partial?.includes(cap.key)
                          ? "half"
                          : "none"
                    }
                  />
                </td>
              ))}
              <td
                className={`pl-4 pr-2 ${compact ? "py-0.5" : "py-2"} whitespace-nowrap text-xs tabular-nums ${
                  company.highlight ? "font-semibold text-primary" : "text-foreground"
                }`}
                title={company.costNote}
              >
                {company.cost}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mx-auto mt-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">
        * Using a subscription service. With the Claude Code $200/month plan, our system costs
        $0.50–1.50 per paper with Opus 5.5, or less with Sonnet 4.6. It costs $0.50–1.00 with the
        Grok Build $100/month plan, or $0.25–1.00 with the Luna model on the Claude Code $200/month
        plan.
      </p>
    </div>
  );
}
