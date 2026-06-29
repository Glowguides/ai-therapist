import type { NextConfig } from "next";

// When STATIC_EXPORT=1 we build a static, server-less bundle for GitHub Pages.
// The repo is served from https://<user>.github.io/ai-therapist/, so assets
// need the repo name as a base path. The real (server) build leaves all of
// this off so /api/chat and streaming work normally on Vercel/Node.
const isStaticExport = process.env.STATIC_EXPORT === "1";
const repo = "ai-therapist";

const nextConfig: NextConfig = isStaticExport
  ? {
      output: "export",
      basePath: `/${repo}`,
      assetPrefix: `/${repo}/`,
      images: { unoptimized: true },
      trailingSlash: true,
    }
  : {};

export default nextConfig;
