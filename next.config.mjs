import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
        destination: '/replication-projects',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

