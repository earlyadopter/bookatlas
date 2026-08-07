import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    // Prevent Next from inferring a parent "workspace root" (e.g. a Dropbox lockfile).
    root: configDir
  }
};

export default nextConfig;
