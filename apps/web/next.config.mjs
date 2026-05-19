/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ecommerce/config", "@ecommerce/types", "@ecommerce/ui"]
};

export default nextConfig;
