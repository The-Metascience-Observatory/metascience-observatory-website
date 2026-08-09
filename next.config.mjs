import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Default .next inside the project. Build artifacts must NOT live outside the project root
  // or Node can't resolve node_modules from the build worker (react/jsx-runtime not found).
  // The Dropbox sync-race this used to work around is avoided by pausing Dropbox during builds
  // (see the npm prebuild/postbuild scripts in package.json).
  reactStrictMode: true,
  allowedDevOrigins: ["10.0.0.16"],
  experimental: {
    externalDir: true
  },
  images: {
    dangerouslyAllowSVG: true
  },
  // Explicitly set the workspace root so Next.js
  // doesn't accidentally pick a parent directory
  // (e.g., your home folder) just because it finds
  // another lockfile there.
  outputFileTracingRoot: path.join(process.cwd()),
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
        destination: '/overview-birds-eye-reviews',
        permanent: true,
      },
      {
        source: '/birds-eye-review-overview',
        destination: '/overview-birds-eye-reviews',
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

