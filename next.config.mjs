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
        destination: '/birds-eye-review-overview',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

