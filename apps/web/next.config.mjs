/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["@ecommerce/config", "@ecommerce/types", "@ecommerce/ui"]
};

export default nextConfig;
