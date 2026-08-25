import type { NextConfig } from 'next';

const isGitHubPages = process.env.GITHUB_PAGES === 'true';
const githubBasePath = isGitHubPages ? '/class-teacher-desk' : '';

const nextConfig: NextConfig = {
  output: isGitHubPages ? 'export' : undefined,
  basePath: githubBasePath,
  assetPrefix: githubBasePath,
  trailingSlash: isGitHubPages,
  images: { unoptimized: isGitHubPages },
};

export default nextConfig;
