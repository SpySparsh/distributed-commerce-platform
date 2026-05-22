import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true
  },
  transpilePackages: ["@ecommerce/config", "@ecommerce/types", "@ecommerce/ui"],
  webpack(config) {
    config.resolve.alias["react-router-dom"] = path.join(dirname, "src/lib/router.tsx");
    return config;
  }
};

export default nextConfig;
