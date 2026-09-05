import path from "path";

const isVercel = !!process.env.VERCEL;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Default .next inside the project. Build artifacts must NOT live outside the project root
  // or Node can't resolve node_modules from the build worker (react/jsx-runtime not found).
  // The Dropbox sync-race this used to work around is avoided by pausing Dropbox during builds
  // (see the npm prebuild/postbuild scripts in package.json).
  reactStrictMode: true,
  // `next dev` and `next build` share the default `.next` and clobber each
  // other when a dev server is running during a production build (symptom:
  // phantom ENOENT / "Cannot find module for page: /_error" build failures).
  // Give dev its own directory so the two never touch the same files.
  // NODE_ENV is "development" only under `next dev`; build/start use `.next`.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  allowedDevOrigins: ["10.0.0.16"],
  experimental: {
    externalDir: true,
    // Already the effective default (no custom `webpack` key), but the two
    // parallel* flags below hard-error (E101) if the build worker is disabled,
    // so pin it explicitly.
    webpackBuildWorker: true,
    parallelServerCompiles: true,
    parallelServerBuildTraces: true,
    // Static generation is the slowest build phase; the default minimum of 25
    // pages per export worker packs the ~56 routes into just 2-3 workers. Fan
    // out locally; on Vercel Hobby (~2 vCPU, 8 GB) keep the defaults. Note the
    // phase's wall time is floored at ~16s regardless of worker count by the
    // correlates-of-reproducibility bootstrap CIs (buildCorrelationTable).
    ...(isVercel ? {} : { cpus: 6, staticGenerationMinPagesPerWorker: 6 }),
  },
  images: {
    dangerouslyAllowSVG: true
  },
  // Explicitly set the workspace root so Next.js
  // doesn't accidentally pick a parent directory
  // (e.g., your home folder) just because it finds
  // another lockfile there.
  outputFileTracingRoot: path.join(process.cwd()),
  // data/backup/ (superseded master CSVs, ~800 MB) is referenced by nothing in
  // app/ — keep the build-trace walk and Vercel function bundles out of it.
  outputFileTracingExcludes: {
    "*": ["./data/backup/**"],
  },
  async redirects() {
    return [
      {
        source: '/replication-projectsnew',
        destination: '/replication-initiatives',
        permanent: true,
      },
      {
        source: '/replication-projects',
        destination: '/replication-initiatives',
        permanent: true,
      },
      {
        source: '/docs/about-birds-eye-reviews',
        destination: '/birds-eye-reviews',
        permanent: true,
      },
      {
        source: '/birds-eye-review-overview',
        destination: '/birds-eye-reviews',
        permanent: true,
      },
      {
        source: '/overview-birds-eye-reviews',
        destination: '/birds-eye-reviews',
        permanent: true,
      },
      {
        source: '/replication-database-overview',
        destination: '/overview-replication-database',
        permanent: true,
      },
      {
        source: '/donate',
        destination: '/#donate',
        permanent: true,
      },
      {
        source: '/docs',
        destination: '/articles',
        permanent: true,
      },
      {
        source: '/docs/previous-initiatives',
        destination: '/docs/other-initiatives',
        permanent: true,
      },
      // The "what we've learned" article was retired in August 2026 and now
      // lives on the More Is Different blog (its selection-bias section became
      // /docs/checking-for-bias). Both old URLs point at the blog post.
      {
        source: '/docs/what-weve-learned',
        destination: 'https://moreisdifferent.blog/p/what-weve-learned-so-far-at-the-metascience',
        permanent: true,
      },
      {
        source: '/articles/what-weve-learned',
        destination: 'https://moreisdifferent.blog/p/what-weve-learned-so-far-at-the-metascience',
        permanent: true,
      },
      // forensicmetascience.org is an alias domain on this Vercel project;
      // every path on it forwards to the forensic metascience agent page.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'forensicmetascience.org' }],
        destination: 'https://metascienceobservatory.org/forensic-metascience-agent',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.forensicmetascience.org' }],
        destination: 'https://metascienceobservatory.org/forensic-metascience-agent',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
