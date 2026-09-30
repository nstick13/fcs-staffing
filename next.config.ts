import type { NextConfig } from "next";

// GitHub Pages serves the site under /<repo>; the deploy workflow sets PAGES_BASE_PATH.
const basePath = process.env.PAGES_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export", // plain static files in out/, deployable to any static host
  basePath,
  images: { unoptimized: true },
  devIndicators: false, // the dev badge sits on top of the map legend
};

export default nextConfig;
