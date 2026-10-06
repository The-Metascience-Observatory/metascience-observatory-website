# Metascience Observatory

Source code for [metascienceobservatory.org](https://metascienceobservatory.org),
a website for exploring scientific replication data, Bird's Eye Reviews, and
forensic metascience tools.

Built with Next.js 15 (App Router), React 18, TypeScript, Tailwind CSS,
Radix UI, React Query, and Recharts. See `package.json` and `package-lock.json`
for the installed versions.

## Copyright and licensing

Copyright © 2026 The Metascience Observatory and its contributors.
**All rights reserved**, except for the replications database, the data
ingestion code, and separately licensed material described in [LICENSE](LICENSE).

- The replications database (`data/replications_database_<timestamp>.csv`; the
  current version is named on the last line of `data/version_history.txt`) is
  licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
  Please credit the Metascience Observatory and cite the version filename.
- Python source files (`*.py`) under `data_ingestor/`, including subdirectories,
  and `scripts/ingest_eroe_effect_sizes.py` are licensed under the
  [MIT License](data_ingestor/LICENSE).
- These exceptions do not cover other datasets, metadata caches,
  documentation, images, or generated outputs. Other original website and
  repository material remains all rights reserved.
- Third-party material retains its own licenses, including the existing
  CC BY 4.0 licenses for FORRT FReD and FLoRA data. Public-domain material and
  unprotected facts are not subject to this copyright claim.

Public availability does not grant a general reuse license. For permissions,
contact [info@metascienceobservatory.org](mailto:info@metascienceobservatory.org).

## Run locally

Use Node.js 22 LTS and npm. From the repository root:

```bash
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The included research datasets
support local browsing without API keys. Newsletter subscriptions require
Mailchimp configuration:

```bash
cp .env.example .env.local
```

Fill in only the settings you need. Keep `.env.local` private. Analytics is
optional; `NEXT_PUBLIC_GA_ID` is intentionally visible to browsers.

## Build and checks

```bash
npm run build
npm start
npm run check:tools
npm run test:publications
npx tsx --test tests/security.test.ts tests/request-guards.test.ts
```

Run `npm run build` before pushing. The browser regression suite is available as
`npm run test:publication-ui`; see `tests/publications.playwright.config.ts`
for its server setup. `npm run lint` currently invokes `next lint`, but ESLint
and its configuration are not installed; it is not an unattended validation
command yet.

The development server uses `.next-dev/`; production builds use `.next/`.
The predev/prebuild scripts mark generated directories as ignored by Dropbox
when the relevant filesystem utilities are available. Dropbox is not required.
For a checkout inside Dropbox, `npm run dev:safe` and `npm run build:safe`
provide optional wrappers that pause syncing.

## Repository structure

- `app/` — pages, layouts, and public API routes.
- `components/` — reusable UI and review dashboards.
- `lib/` — statistics, citations, and review data processing.
- `content/docs/` — Markdown rendered by the website.
- `data/` — research datasets and release metadata.
- `data_ingestor/` — optional Python data ingestion tools; see its [README](data_ingestor/README.md).
- `scripts/` — data preparation and validation helpers.
- `tests/` — regression tests.
- `public/` — assets served directly to visitors.

The active replication CSV is selected by the last non-comment entry in
`data/version_history.txt`. Superseded masters belong in `data/backup/`, which
is ignored by Git. Long Covid review releases live in
`data/birds_eye_reviews/long_covid/`. Data preparation tools may need credentials
and separately installed Python dependencies; they are not needed to run the site.

## Contributing and deployment

Read [AGENTS.md](AGENTS.md) before changing code or research data, especially
its rules for effect-level records and duplicate detection. Styling tokens
live in `app/globals.css`. Load large review datasets on the server and pass
only the fields needed by client components.

The production site is hosted on Vercel. Keep credentials in Vercel's environment
settings and verify the connected repository and deployment branch when moving
the project to a new GitHub organization. Commits must satisfy the deployment
project's author-access requirements.

## Public repository preparation

- Review all committed data, documents, notebook outputs, and Git history before
  publishing. Files excluded from the website can still be downloaded from GitHub.
- Keep credentials out of Git. `.gitignore` excludes environment files and
  `.vercel/`; `.env.example` contains configuration names only.
- Enable secret scanning, push protection, dependency alerts, and branch
  protection in the destination repository where available.
- Run `npm audit --omit=dev` and evaluate advisories against the deployed app.
- Confirm redistribution permissions for bundled research data and third-party
  assets, and preserve their source notices and licenses. See [LICENSE](LICENSE)
  for the repository's default terms and ingestion-code exception.

## Public endpoint limits

Newsletter signup and bibliography upload each allow 10 requests per 10 minutes
per client address on each server instance. Blocked requests receive HTTP 429
and a `Retry-After` header. Newsletter request bodies are limited to 4 KiB;
bibliography files to 2 MiB, with 64 KiB extra for the multipart envelope.
Actual body bytes are counted before JSON or multipart parsing, even when
`Content-Length` is absent or incorrect. Newsletter provider calls time out
after 10 seconds.

These in-memory rate limits are best-effort: they reset on restart and are not
shared across Vercel instances. The limiter uses Vercel's overwritten
[`x-forwarded-for` header](https://vercel.com/docs/headers/request-headers).
An upstream proxy may cause visitors to share an address and quota. Outside
Vercel, requests share a fallback bucket rather than trusting arbitrary
forwarding headers. For deployment-wide limits and accurate visitor quotas
behind Cloudflare, configure rate limiting at that edge or use a shared store
with a verified client-address source.
