# CLAUDE.md — Metascience Observatory Website

## Project Overview

The **Metascience Observatory** is a Next.js 15 full-stack application for exploring scientific replication data and running interactive "Bird's Eye Reviews" of research literatures. It is deployed on Vercel and lives at https://metascienceobservatory.org.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router), React 18, TypeScript 5 |
| Styling | Tailwind CSS 3 + HSL design tokens + Radix UI primitives |
| Charts | Recharts 2, react-simple-maps 3 |
| State | React Query (TanStack Query v5) for server state; useState for local |
| Content | react-markdown + remark-gfm + remark-math + rehype-katex |
| Stats | jstat |
| Data parsing | d3-dsv (CSV), JSON.parse / JSONL line splitting |
| Icons | lucide-react |
| Forms | react-hook-form |
| Notifications | sonner |

---

## Repository Structure

```
app/                        # Next.js App Router
  layout.tsx                # Root layout — wraps in <Providers>
  globals.css               # Design tokens (HSL CSS vars), dark mode, Tailwind directives
  page.tsx                  # Homepage ("use client") — Hero, About, Team, Advisory, Donate
  roadmap/                  # Roadmap page (renders Markdown)
  donate/
  docs/                     # Documentation — each subdirectory renders a Markdown file
  replications-database/    # Main interactive database (complex filtering/vis, "use client")
    by-discipline/
    by-journal/
    by-author/
  replication-initiatives/
  birds-eye-reviews/
    page.tsx                # Index listing reviews
    long-covid/
      page.tsx              # Server component — parses JSONL, passes props to client
      LongCovidDashboard.tsx  # "use client" — all interactive charts + table
      types.ts              # TypeScript interfaces for dashboard data

components/
  Navbar.tsx                # Default site nav
  ReplicationsNavbar.tsx    # Nav for /replications-database/* pages
  BirdsEyeNavbar.tsx        # Nav for /birds-eye-reviews/* pages
  Footer.tsx
  Hero.tsx / About.tsx / Team.tsx / AdvisoryBoard.tsx / Donate.tsx
  MarkdownContent.tsx       # react-markdown renderer (math, email obfuscation)
  Providers.tsx             # QueryClientProvider + TooltipProvider + Sonner
  ui/                       # shadcn/ui style primitives (button, card, input, toast, etc.)

lib/
  utils.ts                  # cn() — clsx + tailwind-merge
  citations.ts              # Citation HTML generation + normalization

data/
  replications_database_*.csv   # Versioned main database (currently replications_database_2026_02_20_072016.csv)
  birds_eye_reviews/
    long_covid_trial_extractions.jsonl  # 9.6 MB, 339 clinical trials
  initiative_tag_names.json             # Tag → full project name mapping
  journal_name_mappings.json            # Journal name standardization
  metascience_observatory_topic_ontology.json
  data_dictionary.csv
  previous_replication_initiatives.csv
  version_history.txt

content/docs/               # Markdown source for /docs/* pages

public/assets/              # Static images (woodcuts, headshots, hero, SVGs)

types/                      # Shared TypeScript type definitions
```

---

## Key Conventions

### Server vs. Client Components
- Pages default to **server components** for data loading
- Add `"use client"` only when interactivity or hooks are needed
- The pattern for large data pages (e.g. Long Covid): server `page.tsx` reads the file, processes into lean typed props, passes to a `"use client"` dashboard component — **raw data files never reach the browser**

### Data Files
- The main replications database is a **CSV** loaded via the `/api/fred` API route (cached in module scope between requests)
- Bird's Eye Review data is **JSONL** read by the server component using `fs.readFileSync` at build/request time
- Always use `process.cwd()` + `path.join()` to build file paths in server code

### Styling
- **Tailwind utility-first** everywhere
- Color system uses **HSL CSS variables** (`--background`, `--foreground`, `--primary`, etc.) defined in `globals.css` — never hard-code colors, use Tailwind tokens
- Color overrides for charts use hex codes defined as constants at the top of the component file
- Dark mode: class-based (`.dark`) via next-themes, CSS vars have dark variants
- Responsive: `md:` breakpoints throughout; mobile-first

### Component Patterns
- UI primitives in `components/ui/` follow shadcn/ui conventions (CVA variants, Radix primitives)
- Chart sections use a shared `ChartSection` wrapper with title/subtitle
- RoB (Risk of Bias) colors: `low=#22c55e`, `some_concerns=#f59e0b`, `high=#ef4444`
- Intervention category colors are defined in `CATEGORY_COLORS` / `INTERVENTION_PALETTE`

### TypeScript
- Strict mode enabled (`tsconfig.json`)
- Data shape interfaces live alongside the component/page that uses them (e.g. `types.ts` next to the dashboard)
- Avoid `any`; use `eslint-disable` comments only when truly unavoidable

### Routing
- Pages use the Next.js App Router file convention
- Backward-compatibility redirects are defined in `next.config.mjs`
- The `@/` alias maps to the project root

---

## Data: Replications Database

- **File:** `data/replications_database_YYYY_MM_DD_HHMMSS.csv` (update the filename when a new version is added)
- ~1400 rows; one row per replication study
- Key columns: `original_title`, `original_url` (full DOI resolver URL), `replication_url`, `replication_initiative_tag`, `original_es_r`, `replication_es_r`, `replication_es_95_CI` (string `[low, high]`), `original_es_type`, `replication_es_type`, `discipline`, `result`
- DOIs stored as full resolver URLs: `https://doi.org/10.xxxx/...`
- Effect size CIs stored as strings: `[lower, upper]` — parse with JSON.parse after stripping
- `replication_initiative_tag` groups rows by project (e.g. `XPHIR`, `RP:P`, `ML1`)
- `initiative_tag_names.json` maps tags to human-readable project names

## Data: Long Covid JSONL

- **File:** `data/birds_eye_reviews/long_covid_trial_extractions.jsonl` (9.6 MB, 339 records)
- One JSON object per line
- Each record: `paper_id` (DOI), `study_design` (arms, countries, blinding, design_type), `sample_sizes`, `outcomes` (is_primary, symptom_domain, between_group_effects with effect_value/ci/p_value, higher_is_better), `risk_of_bias` (overall_judgment + RoB2 domains), `participants` (long_covid_definition, min_time_since_infection_weeks), `follow_up`
- Server-side processing in `page.tsx` converts this into ~10 typed data structures for the dashboard

---

## Environment Variables (`.env.local`)

```
OPENALEX_API_KEY
CROSSREF_API_KEY
CORE_API_KEY
SEMANTIC_SCHOLAR_API_KEY
ENTREZ_API_KEY
SCOPUS_API_KEY
MAILCHIMP_API_KEY
MAILCHIMP_LIST_ID
MAILCHIMP_SERVER
```

---

## API Routes

| Route | Purpose |
|---|---|
| `/api/fred` | Loads main replications CSV, caches in memory, serves as JSON |
| `/api/retraction-watch` | Loads retraction watch data; provides aggregations |
| `/api/subscribe` | Mailchimp newsletter subscription |
| `/api/upload-bibliography` | File upload handling |

---

## Common Commands

```bash
npm run dev     # Start dev server (localhost:3000)
npm run build   # Production build (validates types + checks for errors)
npm run lint    # Run ESLint
```

Always run `npm run build` before pushing to verify there are no TypeScript or compilation errors. Vercel builds on push to `main`.

---

## Vercel Deployment Notes

- Deployed on **Vercel Hobby plan** — commits must have a GitHub-linked email as the author
- Use `git config user.email` matching your GitHub account email to avoid blocked deployments
- The `outputFileTracingRoot` in `next.config.mjs` is set to `path.join(__dirname, "../")` to correctly trace data files outside the app directory

---

## Sanity CMS

Sanity CMS is **not used**. The `next-sanity` dependency, `sanity.config.ts`, and `check-sanity-setup.js` have all been removed. Ignore any Sanity references.
